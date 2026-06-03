import { db } from "./db";
import { users, drivers, vehicles } from "@shared/schema";
import { eq } from "drizzle-orm";
import { scryptSync, randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";

// Fixed credentials for app-store (Google Play / App Store) review.
//
// Store reviewers cannot receive OTP text messages, so this phone number + code
// always logs in WITHOUT sending an SMS, straight into a pre-approved demo
// driver account. This lets reviewers see the full app.
//
// Safety properties (see guards in routes.ts):
//   - Uses a reserved fictional phone number, never a real subscriber number.
//   - Only ever operates on the account whose email === REVIEW_EMAIL; if a real
//     user somehow owns the phone, seeding is a no-op and login is refused.
//   - The demo account is blocked from claiming/accepting live rides, so even if
//     the code leaked it cannot affect real riders.
export const REVIEW_PHONE = (process.env.REVIEW_LOGIN_PHONE || "+15555550100").trim();
export const REVIEW_OTP = (process.env.REVIEW_LOGIN_CODE || "424242").trim();
export const REVIEW_EMAIL = "review-driver@travony.com";

// Cached after seeding so hot request paths can recognise the demo account
// without an extra DB lookup.
let reviewUserId: string | null = null;

export function isReviewLogin(phone: string): boolean {
  return typeof phone === "string" && phone.trim() === REVIEW_PHONE;
}

export function isReviewUserId(userId: string | null | undefined): boolean {
  return !!userId && userId === reviewUserId;
}

// Idempotent and collision-safe. Ensures the demo driver user exists (role
// "driver"), has an approved drivers row and one verified vehicle so the app is
// fully reviewable. Never mutates a pre-existing real account that happens to own
// the phone. Returns the demo user, or null if it cannot be safely provisioned.
export async function seedReviewDriver() {
  const [byPhone] = await db.select().from(users).where(eq(users.phone, REVIEW_PHONE)).limit(1);
  let user = byPhone;

  // A real account already owns this phone — do not touch it, do not allow login.
  if (user && user.email !== REVIEW_EMAIL) {
    return null;
  }

  if (!user) {
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(REVIEW_OTP, salt, 64).toString("hex");
    const inserted = await db
      .insert(users)
      .values({
        id: uuidv4(),
        email: REVIEW_EMAIL,
        password: `${salt}:${hash}`,
        name: "Demo Driver",
        phone: REVIEW_PHONE,
        role: "driver",
        regionCode: "AE",
      })
      .onConflictDoNothing()
      .returning();
    user = inserted[0];
    if (!user) {
      // Lost an insert race (or email already present) — re-read.
      [user] = await db.select().from(users).where(eq(users.email, REVIEW_EMAIL)).limit(1);
    }
  } else if (user.role !== "driver") {
    await db.update(users).set({ role: "driver" }).where(eq(users.id, user.id));
  }

  if (!user) return null;
  reviewUserId = user.id;

  let [driver] = await db.select().from(drivers).where(eq(drivers.userId, user.id)).limit(1);
  if (!driver) {
    const inserted = await db
      .insert(drivers)
      .values({
        userId: user.id,
        status: "approved",
        licenseNumber: "DEMO-REVIEW-001",
        isOnline: false,
      })
      .onConflictDoNothing()
      .returning();
    driver = inserted[0];
    if (!driver) {
      [driver] = await db.select().from(drivers).where(eq(drivers.userId, user.id)).limit(1);
    }
  } else if (driver.status !== "approved") {
    await db.update(drivers).set({ status: "approved" }).where(eq(drivers.id, driver.id));
  }

  if (driver) {
    const existingVehicle = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.driverId, driver.id))
      .limit(1);
    if (existingVehicle.length === 0) {
      await db.insert(vehicles).values({
        driverId: driver.id,
        type: "economy",
        make: "Toyota",
        model: "Camry",
        year: 2022,
        color: "White",
        plateNumber: "DEMO-0100",
        verificationStatus: "admin_verified",
        isActive: true,
      });
    }
  }

  return user;
}
