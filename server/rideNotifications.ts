import { db } from "./db";
import { vehicles, drivers } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { storage } from "./storage";
import { calculateFeeBreakdown } from "./blockchain";
import { sendRideReceiptEmail, sendDriverEarningsEmail, sendDriverRideRequestEmail } from "./email";
import { sendDriverNotification, sendTelegramMessage } from "./telegramBot";
import { sendSmsMessage } from "./twilioService";
import { sendWhatsAppMessage } from "./whatsappBot";

// Real, dialable phone numbers only (skip empty/synthetic).
function isSendablePhone(phone?: string | null): boolean {
  if (!phone) return false;
  return /^\+?\d{7,15}$/.test(phone.trim().replace(/[\s-]/g, ""));
}

// Phone/Telegram signups are auto-provisioned with synthetic, non-deliverable
// addresses (e.g. phone_...@travony.local, ...@telegram.travony). Never email those.
function isSendableEmail(email?: string | null): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  if (lower.endsWith("@telegram.travony")) return false;
  if (lower.endsWith("@travony.local")) return false;
  if (lower.endsWith(".local")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function getDriverDescriptors(driverId: string | null | undefined): Promise<{
  driverName?: string;
  vehicleInfo?: string;
}> {
  if (!driverId) return {};
  const driver = await storage.getDriver(driverId);
  if (!driver) return {};
  const driverUser = await storage.getUser(driver.userId);
  const [veh] = await db.select().from(vehicles).where(eq(vehicles.driverId, driver.id)).limit(1);
  let vehicleInfo: string | undefined;
  if (veh) {
    const desc = `${veh.color ? veh.color + " " : ""}${veh.make || ""} ${veh.model || ""}`.trim();
    vehicleInfo = (desc + (veh.plateNumber ? ` · ${veh.plateNumber}` : "")).trim() || undefined;
  }
  return { driverName: driverUser?.name || undefined, vehicleInfo };
}

// Canonical rider-receipt builder. Shared by the Telegram "email me this receipt"
// button and the automatic completion email, so the receipt format stays identical.
export async function buildAndSendRiderReceipt(
  rideId: string,
  toEmail: string,
  fallbackName: string,
): Promise<boolean> {
  try {
    const ride = await storage.getRide(rideId);
    if (!ride) return false;
    const total = parseFloat(ride.actualFare || ride.estimatedFare || "0");
    const fees = calculateFeeBreakdown(total);
    const { driverName, vehicleInfo } = await getDriverDescriptors(ride.driverId);

    return await sendRideReceiptEmail({
      customerName: fallbackName || "there",
      customerEmail: toEmail,
      rideId: ride.id,
      pickupAddress: ride.pickupAddress,
      dropoffAddress: ride.dropoffAddress,
      distance: ride.distance ? parseFloat(ride.distance).toFixed(1) : "0",
      duration: ride.duration ? String(ride.duration) : "0",
      fare: total.toFixed(2),
      platformFee: fees.platformFee.toFixed(2),
      driverEarnings: fees.driverShare.toFixed(2),
      blockchainHash: ride.blockchainHash || "",
      blockchainTxHash: (ride as any).blockchainTxHash || undefined,
      completedAt: new Date(ride.completedAt || new Date()).toISOString(),
      driverName,
      vehicleInfo,
    });
  } catch (error) {
    console.error("[RideNotifications] buildAndSendRiderReceipt error:", error);
    return false;
  }
}

// Fire-and-forget: on completion, email the receipt to the rider and an earnings
// summary to the driver. Placeholder/synthetic emails are skipped silently.
export async function sendRideCompletionEmails(rideId: string): Promise<void> {
  try {
    const ride = await storage.getRide(rideId);
    if (!ride) return;
    const total = parseFloat(ride.actualFare || ride.estimatedFare || "0");
    const fees = calculateFeeBreakdown(total);
    const completedAt = new Date(ride.completedAt || new Date()).toISOString();

    // Rider receipt
    const rider = await storage.getUser(ride.customerId);
    if (rider && isSendableEmail(rider.email)) {
      await buildAndSendRiderReceipt(rideId, rider.email!, rider.name || "there");
    }

    // Driver earnings summary
    if (ride.driverId) {
      const driver = await storage.getDriver(ride.driverId);
      const driverUser = driver ? await storage.getUser(driver.userId) : undefined;
      if (driverUser && isSendableEmail(driverUser.email)) {
        await sendDriverEarningsEmail({
          driverName: driverUser.name || "Driver",
          driverEmail: driverUser.email!,
          rideId: ride.id,
          pickupAddress: ride.pickupAddress,
          dropoffAddress: ride.dropoffAddress,
          totalFare: total.toFixed(2),
          platformFee: fees.platformFee.toFixed(2),
          earnings: fees.driverShare.toFixed(2),
          blockchainHash: ride.blockchainHash || "",
          blockchainTxHash: (ride as any).blockchainTxHash || undefined,
          completedAt,
        });
      }
    }
  } catch (error) {
    console.error("[RideNotifications] sendRideCompletionEmails error:", error);
  }
}

// Fire-and-forget: instantly ping the matched driver on Telegram about a new ride,
// instead of waiting for the T Driver app's 5s poll to surface it.
export async function notifyDriverOfNewRide(rideId: string): Promise<void> {
  try {
    const ride = await storage.getRide(rideId);
    if (!ride || !ride.driverId || ride.driverId === "pending") return;

    const fare = parseFloat(ride.estimatedFare || ride.actualFare || "0");
    const dist = ride.distance ? `${parseFloat(ride.distance).toFixed(1)} km` : null;
    const currency = ride.currency || "AED";

    const lines = [
      "<b>New ride request</b>",
      `<b>From</b>  ${ride.pickupAddress}`,
      `<b>To</b>  ${ride.dropoffAddress}`,
      `Fare: ${currency} ${fare.toFixed(2)} (you keep 90%)`,
      ...(dist ? [`Distance: ~${dist}`] : []),
      "",
      "Open your T Driver app to accept.",
    ];
    await sendDriverNotification(ride.driverId, lines.join("\n"));
  } catch (error) {
    console.error("[RideNotifications] notifyDriverOfNewRide error:", error);
  }
  // Email + SMS + WhatsApp the matched driver too (in addition to Telegram + app poll).
  await messageDriverOfNewRide(rideId);
}

// Fire-and-forget: notify the matched driver about a new ride request across
// email, SMS, and WhatsApp. Each channel is independent and best-effort: a
// synthetic email or missing phone simply skips that channel. Safe to call from
// any ride-creation path.
export async function messageDriverOfNewRide(rideId: string): Promise<void> {
  try {
    const ride = await storage.getRide(rideId);
    if (!ride || !ride.driverId || ride.driverId === "pending") return;

    const driver = await storage.getDriver(ride.driverId);
    const driverUser = driver ? await storage.getUser(driver.userId) : undefined;
    if (!driverUser) return;

    const fare = parseFloat(ride.estimatedFare || ride.actualFare || "0");
    const fees = calculateFeeBreakdown(fare);
    const currency = ride.currency || "AED";
    const driverName = driverUser.name || "Driver";

    // Email (skips synthetic/placeholder addresses).
    if (isSendableEmail(driverUser.email)) {
      await sendDriverRideRequestEmail({
        driverName,
        driverEmail: driverUser.email!,
        rideId: ride.id,
        pickupAddress: ride.pickupAddress,
        dropoffAddress: ride.dropoffAddress,
        fare: fare.toFixed(2),
        earnings: fees.driverShare.toFixed(2),
        currency,
        distance: ride.distance ? `${parseFloat(ride.distance).toFixed(1)} km` : undefined,
        paymentMethod: ride.paymentMethod || undefined,
      }).catch((e) => console.error("[RideNotifications] driver request email error:", e));
    }

    // SMS + WhatsApp (skips missing/synthetic phone numbers).
    if (isSendablePhone(driverUser.phone)) {
      const smsBody =
        `Travony: New ride request\n` +
        `From: ${ride.pickupAddress}\n` +
        `To: ${ride.dropoffAddress}\n` +
        `Fare ${currency} ${fare.toFixed(2)} · you earn ${currency} ${fees.driverShare.toFixed(2)}\n` +
        `Open your T Driver app to accept.`;

      await sendSmsMessage(driverUser.phone!, smsBody).catch((e) =>
        console.error("[RideNotifications] driver request SMS error:", e),
      );
      await sendWhatsAppMessage(driverUser.phone!, smsBody).catch((e) =>
        console.error("[RideNotifications] driver request WhatsApp error:", e),
      );
    }
  } catch (error) {
    console.error("[RideNotifications] messageDriverOfNewRide error:", error);
  }
}

/**
 * Broadcast a new pending ride to EVERY approved + online driver. The
 * pending-rides model is a broadcast — any approved, online driver can claim the
 * ride from their T Driver app — so a new request must ping them all, not only a
 * single proximity-matched driver. Channels: Telegram, SMS, WhatsApp, email
 * (each best-effort). The rider is never notified about their own ride (a driver
 * can also book as a rider).
 */
export async function notifyOnlineDriversOfNewRide(rideId: string): Promise<void> {
  try {
    const ride = await storage.getRide(rideId);
    if (!ride) return;

    const onlineDrivers = await db
      .select()
      .from(drivers)
      .where(and(eq(drivers.isOnline, true), eq(drivers.status, "approved")));
    if (onlineDrivers.length === 0) return;

    const fare = parseFloat(ride.estimatedFare || ride.actualFare || "0");
    const fees = calculateFeeBreakdown(fare);
    const currency = ride.currency || "AED";

    const smsBody =
      `Travony: New ride request\n` +
      `From: ${ride.pickupAddress}\n` +
      `To: ${ride.dropoffAddress}\n` +
      `Fare ${currency} ${fare.toFixed(2)} · you earn ${currency} ${fees.driverShare.toFixed(2)}\n` +
      `Open your T Driver app to accept.`;
    const tgBody =
      `<b>New ride request</b>\n\n` +
      `Pickup: ${ride.pickupAddress}\n` +
      `Drop-off: ${ride.dropoffAddress}\n` +
      `Fare: ${currency} ${fare.toFixed(2)}  ·  your share ${currency} ${fees.driverShare.toFixed(2)}\n\n` +
      `Open your T Driver app to accept.`;

    for (const driver of onlineDrivers) {
      const driverUser = await storage.getUser(driver.userId);
      if (!driverUser) continue;
      // Don't notify the rider about their own ride request.
      if (driverUser.id === ride.customerId) continue;

      if (driverUser.telegramChatId) {
        await sendTelegramMessage(driverUser.telegramChatId, tgBody).catch((e) =>
          console.error("[RideNotifications] broadcast Telegram error:", e),
        );
      }
      if (isSendablePhone(driverUser.phone)) {
        await sendSmsMessage(driverUser.phone!, smsBody).catch((e) =>
          console.error("[RideNotifications] broadcast SMS error:", e),
        );
        await sendWhatsAppMessage(driverUser.phone!, smsBody).catch((e) =>
          console.error("[RideNotifications] broadcast WhatsApp error:", e),
        );
      }
      if (isSendableEmail(driverUser.email)) {
        await sendDriverRideRequestEmail({
          driverName: driverUser.name || "Driver",
          driverEmail: driverUser.email!,
          rideId: ride.id,
          pickupAddress: ride.pickupAddress,
          dropoffAddress: ride.dropoffAddress,
          fare: fare.toFixed(2),
          earnings: fees.driverShare.toFixed(2),
          currency,
          distance: ride.distance ? `${parseFloat(ride.distance).toFixed(1)} km` : undefined,
          paymentMethod: ride.paymentMethod || undefined,
        }).catch((e) => console.error("[RideNotifications] broadcast email error:", e));
      }
    }
  } catch (error) {
    console.error("[RideNotifications] notifyOnlineDriversOfNewRide error:", error);
  }
}
