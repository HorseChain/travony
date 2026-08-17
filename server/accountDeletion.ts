/**
 * Account deletion — Google Play "User Data: Account Deletion" compliance.
 *
 * Two entry points:
 *  - recordDeletionRequest(): persists a request from the public /data-deletion
 *    web form (no auth — we only store the request for manual processing).
 *  - deleteAccount(): authenticated in-app deletion. Immediately scrubs all
 *    direct PII on the user (and driver) rows AND the PII side tables (saved
 *    addresses, emergency contacts, payment methods, driver bank accounts,
 *    crypto settings, driver documents, EV connection tokens), kills every
 *    session, and records a minimal completed audit entry (anonymized email,
 *    no phone). The user row itself is kept (anonymized) so ride, payment,
 *    and dispute records stay referentially intact — matching the retention
 *    language on the public deletion page (financial/legal records retained).
 *
 * Guards:
 *  - Active ride check runs INSIDE the deletion transaction (atomic).
 *  - Deletion is blocked while the user, driver, or any of the driver's
 *    vehicles hold a positive wallet balance (funds must be withdrawn first,
 *    otherwise the money would be stranded on an anonymized account).
 */
import { db } from "./db";
import {
  users,
  drivers,
  vehicles,
  sessions,
  rides,
  savedAddresses,
  emergencyContacts,
  paymentMethods,
  driverBankAccounts,
  driverCryptoSettings,
  driverDocuments,
  evCarConnections,
  accountDeletionRequests,
} from "@shared/schema";
import { eq, inArray, and } from "drizzle-orm";
import { storage } from "./storage";

const ACTIVE_RIDE_STATUSES = ["pending", "accepted", "arriving", "in_progress", "started"];

// ---- Public web form: simple per-IP rate limit (abuse guard) ----
const requestLog = new Map<string, number[]>();
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_MAX = 5;

export function deletionRequestRateLimited(ip: string): boolean {
  const now = Date.now();
  const key = ip || "unknown";
  const times = (requestLog.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (times.length >= RATE_MAX) {
    requestLog.set(key, times);
    return true;
  }
  times.push(now);
  requestLog.set(key, times);
  // Opportunistic prune so the map cannot grow unbounded.
  if (requestLog.size > 5000) {
    for (const [k, v] of requestLog) {
      if (v.every((t) => now - t >= RATE_WINDOW_MS)) requestLog.delete(k);
    }
  }
  return false;
}

export async function recordDeletionRequest(params: {
  email: string;
  phone?: string;
  userType?: string;
  reason?: string;
  source: "web" | "in_app";
}): Promise<void> {
  // Link to a real user when the email matches, so support can process it.
  let userId: string | undefined;
  try {
    const user = await storage.getUserByEmail(params.email.trim().toLowerCase());
    if (user) userId = user.id;
  } catch {
    // Linking is best-effort; the request is stored either way.
  }
  await db.insert(accountDeletionRequests).values({
    userId: userId ?? null,
    email: String(params.email).slice(0, 200),
    phone: params.phone ? String(params.phone).slice(0, 40) : null,
    userType: params.userType ? String(params.userType).slice(0, 20) : null,
    reason: params.reason ? String(params.reason).slice(0, 1000) : null,
    source: params.source,
    status: "pending",
  });
}

export async function deleteAccount(
  userId: string
): Promise<{ ok: true } | { ok: false; code: number; message: string }> {
  const user = await storage.getUser(userId);
  if (!user) return { ok: false, code: 404, message: "Account not found" };
  if (user.deletedAt) return { ok: true }; // idempotent — already deleted

  const driverRecord = await storage.getDriverByUserId(userId);

  // Block deletion while money would be stranded on the anonymized account.
  const balances: number[] = [parseFloat(user.walletBalance || "0")];
  if (driverRecord) {
    balances.push(parseFloat(driverRecord.walletBalance || "0"));
    const driverVehicles = await db
      .select({ walletBalance: vehicles.walletBalance })
      .from(vehicles)
      .where(eq(vehicles.driverId, driverRecord.id));
    for (const v of driverVehicles) balances.push(parseFloat(v.walletBalance || "0"));
  }
  if (balances.some((b) => b >= 0.01)) {
    return {
      ok: false,
      code: 409,
      message:
        "You still have money in your wallet. Please withdraw your balance before deleting your account, or contact support for help.",
    };
  }

  const anonEmail = `deleted-${userId}@removed.travony.app`;

  let blockedByActiveRide = false;
  await db.transaction(async (tx) => {
    // Atomic active-ride check: runs inside the same transaction as the
    // scrub so a ride accepted mid-flight cannot slip through.
    const activeCustomerRides = await tx
      .select({ id: rides.id })
      .from(rides)
      .where(and(eq(rides.customerId, userId), inArray(rides.status, ACTIVE_RIDE_STATUSES as any)))
      .limit(1);
    let hasActive = activeCustomerRides.length > 0;
    if (!hasActive && driverRecord) {
      const activeDriverRides = await tx
        .select({ id: rides.id })
        .from(rides)
        .where(and(eq(rides.driverId, driverRecord.id), inArray(rides.status, ACTIVE_RIDE_STATUSES as any)))
        .limit(1);
      hasActive = activeDriverRides.length > 0;
    }
    if (hasActive) {
      blockedByActiveRide = true;
      return; // nothing written yet — transaction is a no-op
    }

    await tx
      .update(users)
      .set({
        email: anonEmail,
        password: null,
        name: "Deleted User",
        phone: null,
        avatar: null,
        bio: null,
        telegramChatId: null,
        whatsappOptIn: false,
        ethWalletAddress: null,
        stripeCustomerId: null,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // PII side tables owned by the user.
    await tx.delete(savedAddresses).where(eq(savedAddresses.userId, userId));
    await tx.delete(emergencyContacts).where(eq(emergencyContacts.userId, userId));
    await tx.delete(paymentMethods).where(eq(paymentMethods.userId, userId));

    if (driverRecord) {
      await tx
        .update(drivers)
        .set({
          isOnline: false,
          status: "suspended",
          licenseNumber: null,
          licensePhoto: null,
          insurancePhoto: null,
          registrationPhoto: null,
          homeAddress: null,
          cryptoWalletAddress: null,
          updatedAt: new Date(),
        })
        .where(eq(drivers.id, driverRecord.id));

      // Driver PII side tables: identity documents, bank details, crypto
      // settings, and connected-car OAuth tokens.
      await tx.delete(driverDocuments).where(eq(driverDocuments.driverId, driverRecord.id));
      await tx.delete(driverBankAccounts).where(eq(driverBankAccounts.driverId, driverRecord.id));
      await tx.delete(driverCryptoSettings).where(eq(driverCryptoSettings.driverId, driverRecord.id));
      await tx.delete(evCarConnections).where(eq(evCarConnections.driverId, driverRecord.id));
    }

    // Kill every session so no device stays signed in.
    await tx.delete(sessions).where(eq(sessions.userId, userId));

    // Minimal audit entry: no original email/phone is re-retained — the
    // anonymized address plus userId is enough to prove the deletion happened.
    await tx.insert(accountDeletionRequests).values({
      userId,
      email: anonEmail,
      phone: null,
      userType: user.role,
      reason: null,
      source: "in_app",
      status: "completed",
      processedAt: new Date(),
    });
  });

  if (blockedByActiveRide) {
    return {
      ok: false,
      code: 409,
      message: "You have an active ride. Please complete or cancel it before deleting your account.",
    };
  }

  console.log(`[ACCOUNT-DELETE] Account ${userId} anonymized and sessions revoked (in-app request)`);
  return { ok: true };
}
