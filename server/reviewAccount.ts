import { db } from "./db";
import { users, drivers, vehicles, rides } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
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
        nickname: "Camry",
        verificationStatus: "admin_verified",
        isActive: true,
      });
    }
  }

  return user;
}

// Fictional Dubai rider used only as the customer side of seeded demo rides.
const DEMO_RIDER_EMAIL = "review-rider@travony.com";

// Real Dubai areas used to give the seeded demo rides honest, varied place
// labels (so the AI Car Agent can name a strong area). Drop-offs repeat Dubai
// Marina so it surfaces as the car's "where we earn well" suggestion.
const DEMO_TRIP_LEGS: Array<{
  pickup: string;
  pickupLat: string;
  pickupLng: string;
  dropoff: string;
  dropoffLat: string;
  dropoffLng: string;
}> = [
  { pickup: "Dubai International Airport, Dubai", pickupLat: "25.25275000", pickupLng: "55.36441000", dropoff: "Dubai Marina, Dubai", dropoffLat: "25.08010000", dropoffLng: "55.14030000" },
  { pickup: "Downtown Dubai, Dubai", pickupLat: "25.19720000", pickupLng: "55.27440000", dropoff: "Dubai Marina, Dubai", dropoffLat: "25.08010000", dropoffLng: "55.14030000" },
  { pickup: "Business Bay, Dubai", pickupLat: "25.18790000", pickupLng: "55.26310000", dropoff: "Dubai Marina, Dubai", dropoffLat: "25.08010000", dropoffLng: "55.14030000" },
  { pickup: "Jumeirah Beach Residence, Dubai", pickupLat: "25.07620000", pickupLng: "55.13340000", dropoff: "DIFC, Dubai", dropoffLat: "25.21130000", dropoffLng: "55.27960000" },
  { pickup: "Deira, Dubai", pickupLat: "25.27130000", pickupLng: "55.30890000", dropoff: "The Dubai Mall, Dubai", dropoffLat: "25.19720000", dropoffLng: "55.27960000" },
  { pickup: "Al Barsha, Dubai", pickupLat: "25.11270000", pickupLng: "55.19620000", dropoff: "Dubai Marina, Dubai", dropoffLat: "25.08010000", dropoffLng: "55.14030000" },
  { pickup: "Palm Jumeirah, Dubai", pickupLat: "25.11240000", pickupLng: "55.13880000", dropoff: "Dubai Marina, Dubai", dropoffLat: "25.08010000", dropoffLng: "55.14030000" },
];

// Build a single completed ride row for a vehicle. Earnings are the driver's
// 90% share (10% platform commission) of the fare, currency AED, region AE.
function buildCompletedRide(opts: {
  customerId: string;
  driverId: string;
  vehicleId: string;
  fare: number;
  completedAt: Date;
  legIndex: number;
}) {
  const leg = DEMO_TRIP_LEGS[opts.legIndex % DEMO_TRIP_LEGS.length];
  const fare = Math.round(opts.fare * 100) / 100;
  const platformFee = Math.round(fare * 0.1 * 100) / 100;
  const driverEarnings = Math.round((fare - platformFee) * 100) / 100;
  const accepted = new Date(opts.completedAt.getTime() - 22 * 60 * 1000);
  const started = new Date(opts.completedAt.getTime() - 18 * 60 * 1000);
  return {
    customerId: opts.customerId,
    driverId: opts.driverId,
    vehicleId: opts.vehicleId,
    pickupAddress: leg.pickup,
    pickupLat: leg.pickupLat,
    pickupLng: leg.pickupLng,
    dropoffAddress: leg.dropoff,
    dropoffLat: leg.dropoffLat,
    dropoffLng: leg.dropoffLng,
    status: "completed" as const,
    estimatedFare: fare.toFixed(2),
    actualFare: fare.toFixed(2),
    platformFee: platformFee.toFixed(2),
    driverEarnings: driverEarnings.toFixed(2),
    paymentMethod: "cash" as const,
    paymentStatus: "paid",
    regionCode: "AE",
    currency: "AED" as const,
    acceptedAt: accepted,
    startedAt: started,
    completedAt: opts.completedAt,
    createdAt: accepted,
  };
}

// Ensure a fictional "fleet" driver+vehicle exists (idempotent by email) so the
// city has enough earning cars for a meaningful weekly rank. Returns the
// vehicle id, or null if it could not be provisioned.
async function ensureCompetitorVehicle(index: number): Promise<string | null> {
  const email = `review-fleet-${index}@travony.com`;
  let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(randomBytes(8).toString("hex"), salt, 64).toString("hex");
    const inserted = await db
      .insert(users)
      .values({
        id: uuidv4(),
        email,
        password: `${salt}:${hash}`,
        name: `Fleet Car ${index}`,
        role: "driver",
        regionCode: "AE",
      })
      .onConflictDoNothing()
      .returning();
    user = inserted[0];
    if (!user) [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  }
  if (!user) return null;

  let [driver] = await db.select().from(drivers).where(eq(drivers.userId, user.id)).limit(1);
  if (!driver) {
    const inserted = await db
      .insert(drivers)
      .values({ userId: user.id, status: "approved", licenseNumber: `DEMO-FLEET-${index}`, isOnline: false })
      .onConflictDoNothing()
      .returning();
    driver = inserted[0];
    if (!driver) [driver] = await db.select().from(drivers).where(eq(drivers.userId, user.id)).limit(1);
  }
  if (!driver) return null;

  let [vehicle] = await db.select().from(vehicles).where(eq(vehicles.driverId, driver.id)).limit(1);
  if (!vehicle) {
    const makes = ["Nissan", "Hyundai", "Honda", "Kia", "Mazda"];
    const models = ["Altima", "Elantra", "Accord", "Optima", "6"];
    const inserted = await db
      .insert(vehicles)
      .values({
        driverId: driver.id,
        type: "economy",
        make: makes[index % makes.length],
        model: models[index % models.length],
        year: 2021,
        color: "Silver",
        plateNumber: `DEMO-FLEET-${index}`,
        verificationStatus: "admin_verified",
        isActive: true,
      })
      .onConflictDoNothing()
      .returning();
    vehicle = inserted[0];
    if (!vehicle) [vehicle] = await db.select().from(vehicles).where(eq(vehicles.driverId, driver.id)).limit(1);
  }
  return vehicle?.id ?? null;
}

// Seed several completed rides THIS WEEK for the demo driver's car, plus a small
// fleet of other earning cars, so the AI Car Agent shows a populated story:
// a real weekly earnings figure, a meaningful city rank, and an area-based
// "where to earn next" suggestion. Idempotent: gated on the demo car already
// having recent weekly rides, so it self-refreshes once a week and never
// duplicates on restart. Demo-only data — clearly fictional accounts/plates.
export async function seedReviewDemoRides() {
  // Resolve the demo driver's car.
  const [user] = await db.select().from(users).where(eq(users.email, REVIEW_EMAIL)).limit(1);
  if (!user) return;
  const [driver] = await db.select().from(drivers).where(eq(drivers.userId, user.id)).limit(1);
  if (!driver) return;
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.driverId, driver.id)).limit(1);
  if (!vehicle) return;

  // Idempotency: if the car already has enough completed rides in the trailing
  // 7 days, the demo is already populated — do nothing.
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [{ count: existingThisWeek }] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(rides)
    .where(
      and(
        eq(rides.vehicleId, vehicle.id),
        eq(rides.status, "completed"),
        sql`${rides.completedAt} >= ${weekAgo}`
      )
    );
  if (existingThisWeek >= 5) return;

  // Ensure the rider (customer side of every seeded ride) exists.
  let [rider] = await db.select().from(users).where(eq(users.email, DEMO_RIDER_EMAIL)).limit(1);
  if (!rider) {
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(randomBytes(8).toString("hex"), salt, 64).toString("hex");
    const inserted = await db
      .insert(users)
      .values({
        id: uuidv4(),
        email: DEMO_RIDER_EMAIL,
        password: `${salt}:${hash}`,
        name: "Demo Rider",
        role: "customer",
        regionCode: "AE",
      })
      .onConflictDoNothing()
      .returning();
    rider = inserted[0];
    if (!rider) [rider] = await db.select().from(users).where(eq(users.email, DEMO_RIDER_EMAIL)).limit(1);
  }
  if (!rider) return;

  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000);

  // Demo car's week: 7 trips spread over the last 6 days, two of them today,
  // strong fares so it ranks as a top earning car. Total driver earnings land
  // around AED 1,300 for the week.
  const demoTrips: Array<{ fare: number; completedAt: Date }> = [
    { fare: 95, completedAt: hoursAgo(3) },
    { fare: 142, completedAt: hoursAgo(7) },
    { fare: 168, completedAt: hoursAgo(27) },
    { fare: 120, completedAt: hoursAgo(51) },
    { fare: 210, completedAt: hoursAgo(75) },
    { fare: 134, completedAt: hoursAgo(99) },
    { fare: 178, completedAt: hoursAgo(123) },
  ];
  const demoRows = demoTrips.map((t, i) =>
    buildCompletedRide({
      customerId: rider!.id,
      driverId: driver.id,
      vehicleId: vehicle.id,
      fare: t.fare,
      completedAt: t.completedAt,
      legIndex: i,
    })
  );
  await db.insert(rides).values(demoRows);

  // A small fleet of other earning cars so the rank is meaningful (rank only
  // shows once at least 3 cars have weekly earnings). Each earns less than the
  // demo car's weekly total, so the demo car ranks at the top of its city.
  const competitorWeeklyFares = [
    [80, 75, 90, 60],
    [110, 95, 70],
    [60, 55, 65, 50, 70],
    [130, 90],
    [85, 70, 60, 75],
  ];
  for (let i = 0; i < competitorWeeklyFares.length; i++) {
    const vehicleId = await ensureCompetitorVehicle(i + 1);
    if (!vehicleId) continue;
    const fares = competitorWeeklyFares[i];
    const rows = fares.map((fare, j) =>
      buildCompletedRide({
        customerId: rider!.id,
        driverId: driver.id, // unused for ranking; rank groups by vehicleId
        vehicleId,
        fare,
        completedAt: hoursAgo(6 + j * 17 + i * 5),
        legIndex: j + i,
      })
    );
    await db.insert(rides).values(rows);
  }
}
