import { db } from "./db";
import { 
  cities, drivers, users, vehicles, driverDocuments, driverVerificationQueue,
  cityChampions, driverReferrals, driverEducation, driverIntake, 
  driverTrustProtection, educationModules, ratings, rides
} from "@shared/schema";
import { eq, and, gte, desc, sql, count } from "drizzle-orm";

interface CityConfig {
  regionCode: string;
  name: string;
  slug: string;
  timezone: string;
  centerLat: string;
  centerLng: string;
  radiusKm: string;
  targetDrivers: number;
  tier: 1 | 2 | 3;
  launchOrder: number;
  marketingAngle: string;
  languages: string[];
  vehicleTypes: string[];
}

const EXPANSION_CITIES: CityConfig[] = [
  {
    regionCode: "MX",
    name: "Mexico City",
    slug: "mexico-city",
    timezone: "America/Mexico_City",
    centerLat: "19.4326",
    centerLng: "-99.1332",
    radiusKm: "40",
    targetDrivers: 100,
    tier: 1,
    launchOrder: 1,
    marketingAngle: "Precios justos. Sin sorpresas.",
    languages: ["es"],
    vehicleTypes: ["economy", "comfort", "premium"],
  },
  {
    regionCode: "CO",
    name: "Bogotá",
    slug: "bogota",
    timezone: "America/Bogota",
    centerLat: "4.7110",
    centerLng: "-74.0721",
    radiusKm: "35",
    targetDrivers: 150,
    tier: 1,
    launchOrder: 2,
    marketingAngle: "Precios justos. Sin desactivaciones repentinas.",
    languages: ["es"],
    vehicleTypes: ["economy", "comfort", "premium", "xl"],
  },
  {
    regionCode: "TR",
    name: "Istanbul",
    slug: "istanbul",
    timezone: "Europe/Istanbul",
    centerLat: "41.0082",
    centerLng: "28.9784",
    radiusKm: "50",
    targetDrivers: 200,
    tier: 1,
    launchOrder: 3,
    marketingAngle: "Taksiler hayır dediğinde güvenilir yolculuklar.",
    languages: ["tr"],
    vehicleTypes: ["economy", "comfort", "premium", "minibus"],
  },
  {
    regionCode: "KE",
    name: "Nairobi",
    slug: "nairobi",
    timezone: "Africa/Nairobi",
    centerLat: "-1.2921",
    centerLng: "36.8219",
    radiusKm: "30",
    targetDrivers: 120,
    tier: 1,
    launchOrder: 4,
    marketingAngle: "More earnings. More respect.",
    languages: ["en", "sw"],
    vehicleTypes: ["economy", "comfort", "boda"],
  },
  {
    regionCode: "PH",
    name: "Manila",
    slug: "manila",
    timezone: "Asia/Manila",
    centerLat: "14.5995",
    centerLng: "120.9842",
    radiusKm: "35",
    targetDrivers: 180,
    tier: 1,
    launchOrder: 5,
    marketingAngle: "Know your price before you ride.",
    languages: ["en", "fil"],
    vehicleTypes: ["economy", "comfort", "tricycle", "motorcycle"],
  },
  {
    regionCode: "MA",
    name: "Casablanca",
    slug: "casablanca",
    timezone: "Africa/Casablanca",
    centerLat: "33.5731",
    centerLng: "-7.5898",
    radiusKm: "25",
    targetDrivers: 80,
    tier: 2,
    launchOrder: 6,
    marketingAngle: "Pas de barrières linguistiques. Pas de confusion.",
    languages: ["ar", "fr"],
    vehicleTypes: ["economy", "comfort", "premium"],
  },
  {
    regionCode: "EG",
    name: "Cairo",
    slug: "cairo",
    timezone: "Africa/Cairo",
    centerLat: "30.0444",
    centerLng: "31.2357",
    radiusKm: "45",
    targetDrivers: 200,
    tier: 2,
    launchOrder: 7,
    marketingAngle: "قواعد واضحة. رحلات أكثر أماناً.",
    languages: ["ar"],
    vehicleTypes: ["economy", "comfort", "premium", "tuktuk"],
  },
  {
    regionCode: "PE",
    name: "Lima",
    slug: "lima",
    timezone: "America/Lima",
    centerLat: "-12.0464",
    centerLng: "-77.0428",
    radiusKm: "35",
    targetDrivers: 100,
    tier: 2,
    launchOrder: 8,
    marketingAngle: "Precios claros que no cambian.",
    languages: ["es"],
    vehicleTypes: ["economy", "comfort", "mototaxi"],
  },
  {
    regionCode: "ZA",
    name: "Johannesburg",
    slug: "johannesburg",
    timezone: "Africa/Johannesburg",
    centerLat: "-26.2041",
    centerLng: "28.0473",
    radiusKm: "40",
    targetDrivers: 150,
    tier: 3,
    launchOrder: 9,
    marketingAngle: "Safety and fairness built in.",
    languages: ["en", "zu"],
    vehicleTypes: ["economy", "comfort", "premium", "xl"],
  },
  {
    regionCode: "RO",
    name: "Bucharest",
    slug: "bucharest",
    timezone: "Europe/Bucharest",
    centerLat: "44.4268",
    centerLng: "26.1025",
    radiusKm: "25",
    targetDrivers: 80,
    tier: 3,
    launchOrder: 10,
    marketingAngle: "Mobilitate modernă fără reguli ascunse.",
    languages: ["ro"],
    vehicleTypes: ["economy", "comfort", "premium"],
  },
  {
    regionCode: "TH",
    name: "Bangkok",
    slug: "bangkok",
    timezone: "Asia/Bangkok",
    centerLat: "13.7563",
    centerLng: "100.5018",
    radiusKm: "40",
    targetDrivers: 200,
    tier: 3,
    launchOrder: 11,
    marketingAngle: "เดินทางได้อิสระ แม้ไม่พูดภาษาไทย",
    languages: ["th", "en"],
    vehicleTypes: ["economy", "comfort", "tuktuk", "motorcycle"],
  },
];

const DEFAULT_EDUCATION_MODULES = [
  { moduleId: "pricing", title: "How Pricing Works", description: "Learn how fares are calculated and displayed", durationMinutes: 2, sortOrder: 1 },
  { moduleId: "ratings", title: "Rating Protection", description: "Understand how ratings work and how you're protected", durationMinutes: 2, sortOrder: 2 },
  { moduleId: "disputes", title: "Dispute Resolution", description: "How disputes are handled fairly with AI verification", durationMinutes: 2, sortOrder: 3 },
  { moduleId: "emergency", title: "Emergency & Safety", description: "Safety protocols and emergency procedures", durationMinutes: 2, sortOrder: 4 },
  { moduleId: "city_rules", title: "City-Specific Rules", description: "Local regulations and best practices", durationMinutes: 2, sortOrder: 5 },
];

async function initializeCity(config: CityConfig): Promise<void> {
  const existing = await db.select().from(cities).where(eq(cities.slug, config.slug)).limit(1);
  
  if (existing.length === 0) {
    const launchStatus = config.launchOrder === 1 ? "supply_seeding" : "pre_launch";
    
    const [city] = await db.insert(cities).values({
      regionCode: config.regionCode,
      name: config.name,
      slug: config.slug,
      timezone: config.timezone,
      centerLat: config.centerLat,
      centerLng: config.centerLng,
      radiusKm: config.radiusKm,
      targetDrivers: config.targetDrivers,
      launchStatus,
    }).returning();

    for (const module of DEFAULT_EDUCATION_MODULES) {
      await db.insert(educationModules).values({
        ...module,
        cityId: city.id,
        isRequired: true,
        isActive: true,
      }).onConflictDoNothing();
    }

    console.log(`Initialized ${config.name} (Tier ${config.tier}, Order ${config.launchOrder}): ${city.id}`);
  }
}

export async function initializeMexicoCityLaunch(): Promise<void> {
  await initializeAllCities();
}

export async function initializeAllCities(): Promise<void> {
  console.log("Initializing expansion cities...");
  
  for (const cityConfig of EXPANSION_CITIES) {
    await initializeCity(cityConfig);
  }
  
  console.log(`City initialization complete. Total cities configured: ${EXPANSION_CITIES.length}`);
}

export function getExpansionCities(): CityConfig[] {
  return EXPANSION_CITIES;
}

export function getCityConfig(slug: string): CityConfig | undefined {
  return EXPANSION_CITIES.find(c => c.slug === slug);
}

export async function getCityBySlug(slug: string) {
  const [city] = await db.select().from(cities).where(eq(cities.slug, slug)).limit(1);
  return city || null;
}

export async function getAllCities() {
  return db.select().from(cities).where(eq(cities.isActive, true));
}

export async function recordDriverIntake(data: {
  citySlug: string;
  channel: "facebook" | "whatsapp" | "telegram" | "referral" | "website" | "other";
  phone: string;
  name?: string;
  referralCode?: string;
}) {
  const city = await getCityBySlug(data.citySlug);
  
  const [intake] = await db.insert(driverIntake).values({
    cityId: city?.id,
    channel: data.channel,
    phone: data.phone,
    name: data.name,
    referralCode: data.referralCode,
    status: "lead",
    conversionStep: "signup",
  }).returning();

  return intake;
}

export async function uploadDriverDocument(
  driverId: string,
  type: "id_card" | "drivers_license" | "vehicle_registration" | "insurance" | "selfie_video",
  fileUrl: string,
  fileName?: string,
  fileSize?: number,
  mimeType?: string
) {
  const existing = await db.select().from(driverDocuments)
    .where(and(eq(driverDocuments.driverId, driverId), eq(driverDocuments.type, type)))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db.update(driverDocuments)
      .set({ fileUrl, fileName, fileSize, mimeType, status: "pending", reviewedAt: null, reviewNotes: null })
      .where(eq(driverDocuments.id, existing[0].id))
      .returning();
    return updated;
  }

  const [doc] = await db.insert(driverDocuments).values({
    driverId,
    type,
    fileUrl,
    fileName,
    fileSize,
    mimeType,
    status: "pending",
  }).returning();

  await updateVerificationQueue(driverId);
  return doc;
}

export async function getDriverDocuments(driverId: string) {
  return db.select().from(driverDocuments).where(eq(driverDocuments.driverId, driverId));
}

export async function updateVerificationQueue(driverId: string) {
  const docs = await getDriverDocuments(driverId);
  
  const hasId = docs.some(d => d.type === "id_card" && d.status !== "rejected");
  const hasLicense = docs.some(d => d.type === "drivers_license" && d.status !== "rejected");
  const hasVehicle = docs.some(d => d.type === "vehicle_registration" && d.status !== "rejected");
  const hasSelfie = docs.some(d => d.type === "selfie_video" && d.status !== "rejected");
  const documentsComplete = hasId && hasLicense && hasVehicle && hasSelfie;

  const idVerified = docs.some(d => d.type === "id_card" && d.status === "approved");
  const licenseVerified = docs.some(d => d.type === "drivers_license" && d.status === "approved");
  const vehicleVerified = docs.some(d => d.type === "vehicle_registration" && d.status === "approved");
  const selfieVerified = docs.some(d => d.type === "selfie_video" && d.status === "approved");

  const existing = await db.select().from(driverVerificationQueue)
    .where(eq(driverVerificationQueue.driverId, driverId))
    .limit(1);

  if (existing.length > 0) {
    await db.update(driverVerificationQueue)
      .set({
        documentsComplete,
        idVerified,
        licenseVerified,
        vehicleVerified,
        selfieVerified,
        updatedAt: new Date(),
      })
      .where(eq(driverVerificationQueue.id, existing[0].id));
  } else {
    await db.insert(driverVerificationQueue).values({
      driverId,
      documentsComplete,
      idVerified,
      licenseVerified,
      vehicleVerified,
      selfieVerified,
      status: "pending",
    });
  }
}

export async function reviewDocument(
  documentId: string,
  reviewerId: string,
  status: "approved" | "rejected",
  notes?: string
) {
  const [doc] = await db.update(driverDocuments)
    .set({
      status,
      reviewedBy: reviewerId,
      reviewNotes: notes,
      reviewedAt: new Date(),
    })
    .where(eq(driverDocuments.id, documentId))
    .returning();

  if (doc) {
    await updateVerificationQueue(doc.driverId);
    await checkDriverActivation(doc.driverId);
  }

  return doc;
}

export async function getVerificationQueue(cityId?: string, status?: string) {
  let query = db.select({
    queue: driverVerificationQueue,
    driver: drivers,
    user: users,
  })
  .from(driverVerificationQueue)
  .innerJoin(drivers, eq(driverVerificationQueue.driverId, drivers.id))
  .innerJoin(users, eq(drivers.userId, users.id));

  if (cityId) {
    query = query.where(eq(driverVerificationQueue.cityId, cityId)) as any;
  }

  return query;
}

async function checkDriverActivation(driverId: string) {
  const [queue] = await db.select().from(driverVerificationQueue)
    .where(eq(driverVerificationQueue.driverId, driverId))
    .limit(1);

  if (!queue) return false;

  const allDocsVerified = queue.idVerified && queue.licenseVerified && 
    queue.vehicleVerified && queue.selfieVerified;
  
  if (allDocsVerified && queue.educationCompleted) {
    await db.update(drivers)
      .set({ status: "approved" })
      .where(eq(drivers.id, driverId));

    await db.update(driverVerificationQueue)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(driverVerificationQueue.id, queue.id));

    await initializeTrustProtection(driverId);
    return true;
  }

  return false;
}

export async function initializeTrustProtection(driverId: string) {
  const existing = await db.select().from(driverTrustProtection)
    .where(eq(driverTrustProtection.driverId, driverId))
    .limit(1);

  if (existing.length > 0) return existing[0];

  const protectionEndsAt = new Date();
  protectionEndsAt.setDate(protectionEndsAt.getDate() + 7);

  const [protection] = await db.insert(driverTrustProtection).values({
    driverId,
    protectionActive: true,
    ridesCompleted: 0,
    protectionEndsAtRides: 20,
    earningsFloorActive: true,
    manualDisputeOverride: true,
    protectionEndsAt,
  }).returning();

  return protection;
}

export async function getTrustProtectionStatus(driverId: string) {
  const [protection] = await db.select().from(driverTrustProtection)
    .where(eq(driverTrustProtection.driverId, driverId))
    .limit(1);

  if (!protection) return null;

  const ridesCompleted = protection.ridesCompleted ?? 0;
  const maxRides = protection.protectionEndsAtRides ?? 20;
  const isActive = protection.protectionActive && ridesCompleted < maxRides;

  return {
    ...protection,
    isActive,
    ridesRemaining: Math.max(0, maxRides - ridesCompleted),
  };
}

export async function updateTrustProtectionAfterRide(driverId: string) {
  const [protection] = await db.select().from(driverTrustProtection)
    .where(eq(driverTrustProtection.driverId, driverId))
    .limit(1);

  if (!protection) return;

  const currentRides = protection.ridesCompleted ?? 0;
  const newRideCount = currentRides + 1;
  const maxRides = protection.protectionEndsAtRides ?? 20;
  const shouldDeactivate = newRideCount >= maxRides;

  await db.update(driverTrustProtection)
    .set({
      ridesCompleted: newRideCount,
      protectionActive: !shouldDeactivate,
      updatedAt: new Date(),
    })
    .where(eq(driverTrustProtection.id, protection.id));
}

export async function getEducationModules(cityId?: string) {
  if (cityId) {
    return db.select().from(educationModules)
      .where(and(eq(educationModules.cityId, cityId), eq(educationModules.isActive, true)))
      .orderBy(educationModules.sortOrder);
  }
  
  return db.select().from(educationModules)
    .where(eq(educationModules.isActive, true))
    .orderBy(educationModules.sortOrder);
}

export async function getDriverEducationProgress(driverId: string) {
  return db.select().from(driverEducation)
    .where(eq(driverEducation.driverId, driverId));
}

export async function startEducationModule(driverId: string, moduleId: string, moduleName: string) {
  const existing = await db.select().from(driverEducation)
    .where(and(eq(driverEducation.driverId, driverId), eq(driverEducation.moduleId, moduleId)))
    .limit(1);

  if (existing.length > 0) {
    if (existing[0].status === "completed") return existing[0];
    
    await db.update(driverEducation)
      .set({ status: "in_progress", startedAt: new Date() })
      .where(eq(driverEducation.id, existing[0].id));
    return existing[0];
  }

  const [record] = await db.insert(driverEducation).values({
    driverId,
    moduleId,
    moduleName,
    status: "in_progress",
    startedAt: new Date(),
  }).returning();

  return record;
}

export async function completeEducationModule(driverId: string, moduleId: string, score?: number) {
  const [record] = await db.update(driverEducation)
    .set({ status: "completed", completedAt: new Date(), progress: 100, score })
    .where(and(eq(driverEducation.driverId, driverId), eq(driverEducation.moduleId, moduleId)))
    .returning();

  await checkEducationCompletion(driverId);
  return record;
}

async function checkEducationCompletion(driverId: string) {
  const modules = await db.select().from(educationModules)
    .where(and(eq(educationModules.isRequired, true), eq(educationModules.isActive, true)));
  
  const progress = await getDriverEducationProgress(driverId);
  const completedModules = progress.filter(p => p.status === "completed").map(p => p.moduleId);
  
  const allRequired = modules.every(m => completedModules.includes(m.moduleId));

  if (allRequired) {
    await db.update(driverVerificationQueue)
      .set({ educationCompleted: true, updatedAt: new Date() })
      .where(eq(driverVerificationQueue.driverId, driverId));

    await checkDriverActivation(driverId);
  }
}

export async function generateReferralCode(driverId: string): Promise<string> {
  const [driver] = await db.select().from(drivers).where(eq(drivers.id, driverId)).limit(1);
  if (!driver) throw new Error("Driver not found");

  const [user] = await db.select().from(users).where(eq(users.id, driver.userId)).limit(1);
  const baseName = (user?.name || "driver").replace(/[^a-zA-Z]/g, "").substring(0, 6).toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  
  return `${baseName}${randomSuffix}`;
}

export async function createReferral(referrerId: string, referredDriverId: string, referralCode: string, cityId?: string) {
  const [referral] = await db.insert(driverReferrals).values({
    referrerId,
    referredDriverId,
    cityId,
    referralCode,
    status: "pending",
  }).returning();

  return referral;
}

export async function activateReferral(referredDriverId: string) {
  const [referral] = await db.select().from(driverReferrals)
    .where(eq(driverReferrals.referredDriverId, referredDriverId))
    .limit(1);

  if (!referral) return null;

  await db.update(driverReferrals)
    .set({ status: "activated", activatedAt: new Date() })
    .where(eq(driverReferrals.id, referral.id));

  const champion = await db.select().from(cityChampions)
    .where(eq(cityChampions.driverId, referral.referrerId))
    .limit(1);

  if (champion.length > 0) {
    await db.update(cityChampions)
      .set({
        totalReferrals: (champion[0].totalReferrals || 0) + 1,
        activeReferrals: (champion[0].activeReferrals || 0) + 1,
      })
      .where(eq(cityChampions.id, champion[0].id));
  }

  return referral;
}

export async function getCityHealth(cityId: string) {
  const [city] = await db.select().from(cities).where(eq(cities.id, cityId)).limit(1);
  if (!city) return null;

  const activeDriversResult = await db.select({ count: count() })
    .from(drivers)
    .innerJoin(driverVerificationQueue, eq(drivers.id, driverVerificationQueue.driverId))
    .where(and(
      eq(driverVerificationQueue.cityId, cityId),
      eq(drivers.status, "approved")
    ));

  const pendingVerificationsResult = await db.select({ count: count() })
    .from(driverVerificationQueue)
    .where(and(
      eq(driverVerificationQueue.cityId, cityId),
      eq(driverVerificationQueue.status, "pending")
    ));

  const championsResult = await db.select({ count: count() })
    .from(cityChampions)
    .where(and(
      eq(cityChampions.cityId, cityId),
      eq(cityChampions.status, "active")
    ));

  return {
    city,
    metrics: {
      activeDrivers: activeDriversResult[0]?.count || 0,
      targetDrivers: city.targetDrivers || 100,
      pendingVerifications: pendingVerificationsResult[0]?.count || 0,
      activeChampions: championsResult[0]?.count || 0,
      avgEtaMinutes: city.avgEtaMinutes ? parseFloat(city.avgEtaMinutes) : null,
      rideAcceptanceRate: city.rideAcceptanceRate ? parseFloat(city.rideAcceptanceRate) : null,
      monthlyChurnPercent: city.monthlyChurnPercent ? parseFloat(city.monthlyChurnPercent) : null,
      disputesPer1000: city.disputesPer1000 ? parseFloat(city.disputesPer1000) : null,
    },
    launchStatus: city.launchStatus,
    telegramGroupLink: city.telegramGroupLink,
    whatsappGroupLink: city.whatsappGroupLink,
  };
}

export async function checkChampionEligibility(driverId: string): Promise<{
  eligible: boolean;
  reason?: string;
  stats: {
    totalTrips: number;
    rating: number;
    disputeRate: number;
  };
}> {
  const [driver] = await db.select().from(drivers).where(eq(drivers.id, driverId)).limit(1);
  if (!driver) return { eligible: false, reason: "Driver not found", stats: { totalTrips: 0, rating: 0, disputeRate: 0 } };

  const totalTrips = driver.totalTrips || 0;
  const rating = parseFloat(driver.rating || "0");

  const ridesCount = await db.select({ count: count() })
    .from(rides)
    .where(eq(rides.driverId, driverId));
  
  const totalRides = ridesCount[0]?.count || 0;
  const disputeRate = 0;

  const stats = { totalTrips, rating, disputeRate };

  if (totalTrips < 100) {
    return { eligible: false, reason: "Need at least 100 completed rides", stats };
  }

  if (rating < 4.8) {
    return { eligible: false, reason: "Rating must be 4.8 or higher", stats };
  }

  return { eligible: true, stats };
}

export async function nominateChampion(driverId: string, cityId: string) {
  const eligibility = await checkChampionEligibility(driverId);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason || "Driver not eligible");
  }

  const existing = await db.select().from(cityChampions)
    .where(and(eq(cityChampions.driverId, driverId), eq(cityChampions.cityId, cityId)))
    .limit(1);

  if (existing.length > 0) {
    throw new Error("Driver is already a champion for this city");
  }

  const [champion] = await db.insert(cityChampions).values({
    driverId,
    cityId,
    status: "pending",
  }).returning();

  return champion;
}

export async function approveChampion(championId: string) {
  const [champion] = await db.update(cityChampions)
    .set({ status: "active", appointedAt: new Date() })
    .where(eq(cityChampions.id, championId))
    .returning();

  return champion;
}

export async function getCityChampions(cityId: string) {
  return db.select({
    champion: cityChampions,
    driver: drivers,
    user: users,
  })
  .from(cityChampions)
  .innerJoin(drivers, eq(cityChampions.driverId, drivers.id))
  .innerJoin(users, eq(drivers.userId, users.id))
  .where(eq(cityChampions.cityId, cityId));
}

export async function updateCityLaunchStatus(
  cityId: string, 
  status: "pre_launch" | "supply_seeding" | "density_validation" | "soft_launch" | "active" | "paused"
) {
  const [city] = await db.update(cities)
    .set({ 
      launchStatus: status, 
      launchedAt: status === "active" ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(cities.id, cityId))
    .returning();

  return city;
}

export async function updateCityGroupLinks(cityId: string, telegramLink?: string, whatsappLink?: string) {
  const [city] = await db.update(cities)
    .set({
      telegramGroupLink: telegramLink,
      whatsappGroupLink: whatsappLink,
      updatedAt: new Date(),
    })
    .where(eq(cities.id, cityId))
    .returning();

  return city;
}
