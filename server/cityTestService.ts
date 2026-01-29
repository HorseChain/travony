import { db } from "./db";
import { 
  cities, cityTestChecklist, driverTags, riderInviteCodes, riderInviteUses,
  driverFeedback, simulatedEntities, drivers, users
} from "@shared/schema";
import { eq, and, sql, count } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const TEST_CATEGORIES = [
  {
    category: "account_lifecycle",
    tests: [
      { name: "valid_signup", description: "Sign up with valid data", isBlocking: true },
      { name: "invalid_signup", description: "Sign up with invalid data rejected", isBlocking: true },
      { name: "duplicate_account", description: "Duplicate account attempt blocked", isBlocking: true },
      { name: "blocked_reattempt", description: "Blocked driver re-attempt handled", isBlocking: false },
      { name: "reactivation", description: "Reactivation after rejection works", isBlocking: false },
    ]
  },
  {
    category: "identity_verification",
    tests: [
      { name: "clear_id_scan", description: "Clear ID scan approved", isBlocking: true },
      { name: "blurry_id_scan", description: "Blurry ID scan rejected with explanation", isBlocking: true },
      { name: "expired_license", description: "Expired license rejected", isBlocking: true },
      { name: "mismatched_selfie", description: "Mismatched selfie vs ID rejected", isBlocking: true },
      { name: "wrong_vehicle_type", description: "Wrong vehicle type flagged", isBlocking: false },
      { name: "multiple_vehicles", description: "Multiple vehicles upload works", isBlocking: false },
    ]
  },
  {
    category: "education_activation",
    tests: [
      { name: "no_online_before_training", description: "Cannot go online before training", isBlocking: true },
      { name: "partial_training", description: "Partial training tracked correctly", isBlocking: true },
      { name: "full_training", description: "Full training completion enables online", isBlocking: true },
      { name: "training_retake", description: "Training retake available", isBlocking: false },
    ]
  },
  {
    category: "online_offline",
    tests: [
      { name: "online_toggle", description: "Online toggle works correctly", isBlocking: true },
      { name: "offline_during_trip", description: "Offline during trip blocked", isBlocking: true },
      { name: "auto_offline_inactivity", description: "Auto-offline on inactivity", isBlocking: false },
      { name: "network_loss_recovery", description: "Network loss recovery handled", isBlocking: false },
    ]
  },
  {
    category: "ride_assignment",
    tests: [
      { name: "ride_request_received", description: "Ride request received by driver", isBlocking: true },
      { name: "driver_accepts", description: "Driver accepts ride correctly", isBlocking: true },
      { name: "driver_ignores", description: "Driver ignore timeout handled", isBlocking: true },
      { name: "driver_rejects", description: "Driver rejection flows correctly", isBlocking: true },
      { name: "timeout_behavior", description: "Request timeout reassigns ride", isBlocking: true },
      { name: "multiple_drivers_zone", description: "Multiple drivers in zone handled", isBlocking: false },
    ]
  },
  {
    category: "pricing_earnings",
    tests: [
      { name: "fare_calculation", description: "Fare calculation is correct", isBlocking: true },
      { name: "surge_multiplier", description: "Surge/multiplier logic works", isBlocking: true },
      { name: "commission_deduction", description: "Commission deduction (10%) correct", isBlocking: true },
      { name: "earnings_summary", description: "Earnings summary accurate", isBlocking: true },
      { name: "daily_payout", description: "Daily payout calculation correct", isBlocking: true },
    ]
  },
  {
    category: "ride_flow",
    tests: [
      { name: "normal_ride", description: "Normal ride completes successfully", isBlocking: true },
      { name: "rider_no_show", description: "Rider no-show handled with fee", isBlocking: true },
      { name: "driver_no_show", description: "Driver no-show handled with penalty", isBlocking: true },
      { name: "mid_ride_cancel", description: "Mid-ride cancellation handled", isBlocking: true },
      { name: "route_deviation", description: "Route deviation tracked", isBlocking: false },
      { name: "trip_completion", description: "Trip completion flow works", isBlocking: true },
    ]
  },
  {
    category: "ratings_feedback",
    tests: [
      { name: "rider_rates_driver", description: "Rider rates driver correctly", isBlocking: true },
      { name: "driver_rates_rider", description: "Driver rates rider correctly", isBlocking: true },
      { name: "no_rating_submitted", description: "No rating submitted handled", isBlocking: false },
      { name: "low_rating_protection", description: "Low rating protection for new drivers", isBlocking: true },
      { name: "rating_dispute", description: "Rating dispute flow works", isBlocking: false },
    ]
  },
  {
    category: "disputes",
    tests: [
      { name: "fare_dispute", description: "Fare dispute flow works", isBlocking: true },
      { name: "cancellation_dispute", description: "Cancellation dispute handled", isBlocking: true },
      { name: "rating_dispute_flow", description: "Rating dispute handled", isBlocking: true },
      { name: "false_complaint", description: "False complaint detected", isBlocking: false },
      { name: "ai_decision", description: "AI decision logic works", isBlocking: true },
      { name: "manual_override", description: "Manual override path exists", isBlocking: true },
      { name: "reason_display", description: "Reason shown to driver", isBlocking: true },
      { name: "rule_display", description: "Rule applied shown", isBlocking: true },
      { name: "outcome_display", description: "Outcome shown clearly", isBlocking: true },
    ]
  },
  {
    category: "safety_emergency",
    tests: [
      { name: "emergency_button", description: "Emergency button works", isBlocking: true },
      { name: "false_alarm", description: "False alarm handled", isBlocking: false },
      { name: "emergency_during_ride", description: "Emergency during ride handled", isBlocking: true },
      { name: "emergency_after_ride", description: "Emergency after ride handled", isBlocking: false },
      { name: "location_accuracy", description: "Location accuracy sufficient", isBlocking: true },
      { name: "event_logging", description: "Emergency events logged", isBlocking: true },
    ]
  },
  {
    category: "notifications_bots",
    tests: [
      { name: "push_notifications", description: "Push notifications work", isBlocking: true },
      { name: "whatsapp_bot", description: "WhatsApp bot responses work", isBlocking: false },
      { name: "telegram_bot", description: "Telegram bot responses work", isBlocking: false },
      { name: "error_message_clarity", description: "Error messages are clear", isBlocking: true },
      { name: "silence_detection", description: "Silence/no response detected", isBlocking: false },
    ]
  },
  {
    category: "abuse_fraud",
    tests: [
      { name: "fake_gps", description: "Fake GPS detected", isBlocking: true },
      { name: "multi_account", description: "Multi-account attempt blocked", isBlocking: true },
      { name: "ride_manipulation", description: "Ride manipulation detected", isBlocking: true },
      { name: "referral_abuse", description: "Referral abuse detected", isBlocking: true },
    ]
  },
];

export async function initializeCityTestChecklist(cityId: string): Promise<void> {
  const existing = await db.select().from(cityTestChecklist).where(eq(cityTestChecklist.cityId, cityId)).limit(1);
  if (existing.length > 0) {
    console.log(`Test checklist already initialized for city ${cityId}`);
    return;
  }

  let sortOrder = 0;
  for (const cat of TEST_CATEGORIES) {
    for (const test of cat.tests) {
      await db.insert(cityTestChecklist).values({
        cityId,
        category: cat.category as any,
        testName: test.name,
        description: test.description,
        isBlocking: test.isBlocking,
        sortOrder: sortOrder++,
        status: "pending",
      });
    }
  }
  console.log(`Initialized ${sortOrder} test items for city ${cityId}`);
}

export async function getCityTestProgress(cityId: string) {
  const tests = await db.select().from(cityTestChecklist).where(eq(cityTestChecklist.cityId, cityId));
  
  const byCategory: Record<string, { total: number; passed: number; failed: number; pending: number }> = {};
  let totalPassed = 0;
  let totalFailed = 0;
  let blockingFailed = 0;

  for (const test of tests) {
    if (!byCategory[test.category]) {
      byCategory[test.category] = { total: 0, passed: 0, failed: 0, pending: 0 };
    }
    byCategory[test.category].total++;
    
    if (test.status === "passed") {
      byCategory[test.category].passed++;
      totalPassed++;
    } else if (test.status === "failed") {
      byCategory[test.category].failed++;
      totalFailed++;
      if (test.isBlocking) blockingFailed++;
    } else {
      byCategory[test.category].pending++;
    }
  }

  const allBlockingPassed = blockingFailed === 0 && tests.filter(t => t.isBlocking && t.status !== "passed").length === 0;

  return {
    cityId,
    totalTests: tests.length,
    passed: totalPassed,
    failed: totalFailed,
    pending: tests.length - totalPassed - totalFailed,
    blockingFailed,
    allBlockingPassed,
    exitCriteriaMet: allBlockingPassed,
    byCategory,
    tests,
  };
}

export async function updateTestStatus(
  cityId: string,
  testName: string,
  status: "passed" | "failed",
  failureReason?: string,
  testedBy?: string
) {
  const now = new Date();
  await db.update(cityTestChecklist)
    .set({
      status,
      passedAt: status === "passed" ? now : null,
      failedAt: status === "failed" ? now : null,
      failureReason: status === "failed" ? failureReason : null,
      testedBy,
      updatedAt: now,
    })
    .where(and(eq(cityTestChecklist.cityId, cityId), eq(cityTestChecklist.testName, testName)));

  const progress = await getCityTestProgress(cityId);
  if (progress.exitCriteriaMet) {
    await db.update(cities).set({ testChecklistPassed: true }).where(eq(cities.id, cityId));
  }
  return progress;
}

export async function transitionCityLaunchMode(
  cityId: string,
  newMode: "pre_launch" | "internal_driver_test" | "controlled_real_driver_access" | "invite_only_riders" | "supply_seeding" | "soft_launch" | "active"
) {
  const [city] = await db.select().from(cities).where(eq(cities.id, cityId)).limit(1);
  if (!city) throw new Error("City not found");

  const validTransitions: Record<string, string[]> = {
    pre_launch: ["internal_driver_test"],
    internal_driver_test: ["controlled_real_driver_access", "pre_launch"],
    controlled_real_driver_access: ["invite_only_riders", "internal_driver_test"],
    invite_only_riders: ["supply_seeding", "controlled_real_driver_access"],
    supply_seeding: ["density_validation", "invite_only_riders"],
    density_validation: ["soft_launch", "supply_seeding"],
    soft_launch: ["active", "density_validation"],
    active: ["paused"],
    paused: ["active", "soft_launch"],
  };

  const currentMode = city.launchStatus || "pre_launch";
  if (!validTransitions[currentMode]?.includes(newMode)) {
    throw new Error(`Invalid transition from ${currentMode} to ${newMode}. Valid: ${validTransitions[currentMode]?.join(", ")}`);
  }

  if (newMode === "controlled_real_driver_access") {
    const progress = await getCityTestProgress(cityId);
    if (!progress.exitCriteriaMet) {
      throw new Error(`Cannot transition to controlled access. Exit criteria not met. ${progress.blockingFailed} blocking tests failed.`);
    }
  }

  if (newMode === "internal_driver_test") {
    await initializeCityTestChecklist(cityId);
  }

  await db.update(cities).set({ launchStatus: newMode, updatedAt: new Date() }).where(eq(cities.id, cityId));

  return { cityId, previousMode: currentMode, newMode, transitionedAt: new Date() };
}

export async function tagDriverAsFounder(driverId: string, cityId: string, assignedBy?: string) {
  const [city] = await db.select().from(cities).where(eq(cities.id, cityId)).limit(1);
  if (!city) throw new Error("City not found");
  
  if (city.launchStatus !== "controlled_real_driver_access") {
    throw new Error("City must be in controlled_real_driver_access mode to add founding drivers");
  }

  if ((city.foundingDriverCount || 0) >= (city.maxFoundingDrivers || 10)) {
    throw new Error(`Maximum founding driver limit (${city.maxFoundingDrivers}) reached`);
  }

  const existingTag = await db.select().from(driverTags)
    .where(and(eq(driverTags.driverId, driverId), eq(driverTags.tag, "founding_driver")))
    .limit(1);
  
  if (existingTag.length > 0) {
    throw new Error("Driver already tagged as founding driver");
  }

  const [tag] = await db.insert(driverTags).values({
    driverId,
    cityId,
    tag: "founding_driver",
    assignedBy,
    notes: `Founding driver for ${city.name}`,
  }).returning();

  await db.update(cities)
    .set({ foundingDriverCount: sql`${cities.foundingDriverCount} + 1` })
    .where(eq(cities.id, cityId));

  return tag;
}

export async function getFoundingDrivers(cityId: string) {
  const tags = await db.select().from(driverTags)
    .where(and(eq(driverTags.cityId, cityId), eq(driverTags.tag, "founding_driver")));
  
  const driverIds = tags.map(t => t.driverId);
  if (driverIds.length === 0) return [];

  const driverData = await db.select().from(drivers).where(sql`${drivers.id} IN (${sql.join(driverIds.map(id => sql`${id}`), sql`, `)})`);
  return driverData;
}

export async function generateRiderInviteCode(driverId: string, cityId: string) {
  const [city] = await db.select().from(cities).where(eq(cities.id, cityId)).limit(1);
  if (!city) throw new Error("City not found");

  if (city.launchStatus !== "invite_only_riders" && city.launchStatus !== "controlled_real_driver_access") {
    throw new Error("City must be in invite_only_riders or controlled_real_driver_access mode");
  }

  const isFounder = await db.select().from(driverTags)
    .where(and(eq(driverTags.driverId, driverId), eq(driverTags.tag, "founding_driver")))
    .limit(1);
  
  if (isFounder.length === 0 && city.launchStatus === "controlled_real_driver_access") {
    throw new Error("Only founding drivers can generate invite codes in controlled access mode");
  }

  const code = `TV-${city.slug.toUpperCase().slice(0, 3)}-${uuidv4().slice(0, 6).toUpperCase()}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [inviteCode] = await db.insert(riderInviteCodes).values({
    code,
    driverId,
    cityId,
    maxUses: 5,
    expiresAt,
  }).returning();

  return inviteCode;
}

export async function useRiderInviteCode(code: string, riderId: string) {
  const [inviteCode] = await db.select().from(riderInviteCodes).where(eq(riderInviteCodes.code, code)).limit(1);
  
  if (!inviteCode) throw new Error("Invalid invite code");
  if (!inviteCode.isActive) throw new Error("Invite code is no longer active");
  if (inviteCode.expiresAt && new Date() > inviteCode.expiresAt) throw new Error("Invite code has expired");
  if ((inviteCode.usedCount || 0) >= (inviteCode.maxUses || 5)) throw new Error("Invite code has reached max uses");

  const existingUse = await db.select().from(riderInviteUses)
    .where(and(eq(riderInviteUses.inviteCodeId, inviteCode.id), eq(riderInviteUses.riderId, riderId)))
    .limit(1);
  
  if (existingUse.length > 0) throw new Error("You have already used this invite code");

  await db.insert(riderInviteUses).values({
    inviteCodeId: inviteCode.id,
    riderId,
  });

  await db.update(riderInviteCodes)
    .set({ usedCount: sql`${riderInviteCodes.usedCount} + 1` })
    .where(eq(riderInviteCodes.id, inviteCode.id));

  return { success: true, cityId: inviteCode.cityId, driverId: inviteCode.driverId };
}

export async function submitDriverFeedback(
  driverId: string,
  cityId: string,
  category: string,
  feedback: string,
  confusionLevel?: number,
  screenName?: string,
  actionAttempted?: string,
  question?: string
) {
  const [record] = await db.insert(driverFeedback).values({
    driverId,
    cityId,
    category,
    question,
    feedback,
    confusionLevel,
    screenName,
    actionAttempted,
  }).returning();

  return record;
}

export async function getUnresolvedFeedback(cityId: string) {
  return db.select().from(driverFeedback)
    .where(and(eq(driverFeedback.cityId, cityId), eq(driverFeedback.resolved, false)));
}

export async function resolveFeedback(feedbackId: string, resolution: string, resolvedBy: string) {
  await db.update(driverFeedback).set({
    resolved: true,
    resolution,
    resolvedBy,
    resolvedAt: new Date(),
  }).where(eq(driverFeedback.id, feedbackId));
}

export async function createSimulatedDriver(cityId: string, name: string) {
  const [city] = await db.select().from(cities).where(eq(cities.id, cityId)).limit(1);
  if (!city) throw new Error("City not found");

  if (city.launchStatus !== "internal_driver_test") {
    throw new Error("Simulated drivers can only be created in internal_driver_test mode");
  }

  const simId = `sim-driver-${uuidv4().slice(0, 8)}`;
  
  await db.insert(simulatedEntities).values({
    cityId,
    entityType: "driver",
    entityId: simId,
    name,
    metadata: JSON.stringify({ isSimulated: true, createdFor: "internal_test" }),
  });

  return { id: simId, name, type: "driver", isSimulated: true };
}

export async function createSimulatedRider(cityId: string, name: string) {
  const [city] = await db.select().from(cities).where(eq(cities.id, cityId)).limit(1);
  if (!city) throw new Error("City not found");

  if (city.launchStatus !== "internal_driver_test" && city.launchStatus !== "controlled_real_driver_access") {
    throw new Error("Simulated riders can only be created in internal_driver_test or controlled_real_driver_access mode");
  }

  const simId = `sim-rider-${uuidv4().slice(0, 8)}`;
  
  await db.insert(simulatedEntities).values({
    cityId,
    entityType: "rider",
    entityId: simId,
    name,
    metadata: JSON.stringify({ isSimulated: true, createdFor: "internal_test" }),
  });

  return { id: simId, name, type: "rider", isSimulated: true };
}

export async function getSimulatedEntities(cityId: string, entityType?: string) {
  if (entityType) {
    return db.select().from(simulatedEntities)
      .where(and(eq(simulatedEntities.cityId, cityId), eq(simulatedEntities.entityType, entityType)));
  }
  return db.select().from(simulatedEntities).where(eq(simulatedEntities.cityId, cityId));
}

export async function getCityLaunchStatus(cityId: string) {
  const [city] = await db.select().from(cities).where(eq(cities.id, cityId)).limit(1);
  if (!city) throw new Error("City not found");

  const testProgress = await getCityTestProgress(cityId);
  const foundingDrivers = await getFoundingDrivers(cityId);
  const unresolvedFeedback = await getUnresolvedFeedback(cityId);

  return {
    city: {
      id: city.id,
      name: city.name,
      slug: city.slug,
      launchStatus: city.launchStatus,
      maxFoundingDrivers: city.maxFoundingDrivers,
      foundingDriverCount: city.foundingDriverCount,
      testChecklistPassed: city.testChecklistPassed,
    },
    testProgress,
    foundingDrivers: foundingDrivers.length,
    unresolvedFeedbackCount: unresolvedFeedback.length,
    readyForNextPhase: testProgress.exitCriteriaMet && unresolvedFeedback.length === 0,
  };
}
