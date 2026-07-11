import { db } from "./db";
import { hubs, cities } from "../shared/schema";
import { eq, sql, isNull } from "drizzle-orm";

interface HubSeed {
  name: string;
  type: "mall" | "station" | "airport" | "custom";
  lat: string;
  lng: string;
  radiusMeters: number;
  regionCode: string;
  description: string;
  address: string;
  peakHours: string;
}

const hubData: HubSeed[] = [
  { name: "Dubai Mall & Downtown", type: "mall", lat: "25.19720000", lng: "55.27440000", radiusMeters: 500, regionCode: "AE-DU", description: "Premium mobility hub at Dubai Mall & Burj Khalifa area - highest foot traffic zone in Dubai with 54M+ annual visitors", address: "Downtown Dubai, Dubai Mall, UAE", peakHours: "10:00-14:00,17:00-23:00" },
  { name: "JBR Beach & The Walk", type: "custom", lat: "25.07300000", lng: "55.13430000", radiusMeters: 400, regionCode: "AE-DU", description: "Beachfront lifestyle hub at Jumeirah Beach Residence - popular dining, shopping and beach destination", address: "JBR The Walk, Dubai, UAE", peakHours: "09:00-12:00,17:00-23:00" },
  { name: "Dubai Marina Walk", type: "custom", lat: "25.07550000", lng: "55.13980000", radiusMeters: 350, regionCode: "AE-DU", description: "Waterfront marina hub with restaurants, yachts and nightlife - one of Dubai's most active social zones", address: "Dubai Marina, Dubai, UAE", peakHours: "11:00-14:00,18:00-00:00" },
  { name: "Mall of the Emirates", type: "mall", lat: "25.11810000", lng: "55.20060000", radiusMeters: 400, regionCode: "AE-DU", description: "Major shopping and entertainment hub featuring Ski Dubai - high-traffic retail zone in Al Barsha", address: "Al Barsha, Mall of the Emirates, Dubai, UAE", peakHours: "10:00-14:00,16:00-22:00" },
  { name: "DIFC Financial Centre", type: "custom", lat: "25.21000000", lng: "55.27940000", radiusMeters: 300, regionCode: "AE-DU", description: "Dubai International Financial Centre - premium business district with high-value professional traffic", address: "DIFC, Dubai, UAE", peakHours: "07:00-09:00,12:00-14:00,17:00-19:00" },
  { name: "Dubai International Airport", type: "airport", lat: "25.25320000", lng: "55.36570000", radiusMeters: 600, regionCode: "AE-DU", description: "World's busiest international airport hub - 24/7 high-demand zone for airport transfers and pickups", address: "DXB Airport, Dubai, UAE", peakHours: "00:00-06:00,08:00-11:00,19:00-23:00" },
  { name: "Business Bay Metro Hub", type: "station", lat: "25.18600000", lng: "55.26160000", radiusMeters: 350, regionCode: "AE-DU", description: "Business Bay commercial district - mix of offices, hotels and residential towers with steady demand", address: "Business Bay, Dubai, UAE", peakHours: "07:00-10:00,17:00-20:00" },
  { name: "Deira Gold Souk & Creek", type: "custom", lat: "25.26960000", lng: "55.29980000", radiusMeters: 350, regionCode: "AE-DU", description: "Historic trading hub at Deira - Gold Souk, Spice Souk and Dubai Creek area with heavy tourist and local traffic", address: "Deira, Gold Souk, Dubai, UAE", peakHours: "09:00-13:00,16:00-21:00" },
  { name: "Palm Jumeirah Gateway", type: "custom", lat: "25.11240000", lng: "55.13900000", radiusMeters: 400, regionCode: "AE-DU", description: "Gateway to Palm Jumeirah - luxury residential island with hotels, restaurants and beach clubs", address: "Palm Jumeirah, Dubai, UAE", peakHours: "10:00-14:00,18:00-23:00" },
  { name: "Dubai Hills Mall", type: "mall", lat: "25.10320000", lng: "55.22630000", radiusMeters: 350, regionCode: "AE-DU", description: "Growing family-oriented hub in Dubai Hills Estate - rapidly expanding community with modern mall", address: "Dubai Hills Estate, Dubai, UAE", peakHours: "10:00-13:00,16:00-21:00" },

  { name: "Muwailah Commercial Hub", type: "mall", lat: "25.29820000", lng: "55.45720000", radiusMeters: 400, regionCode: "AE-SH", description: "Central mobility hub in Muwailah Commercial, Sharjah - high-traffic commercial and residential zone near University City", address: "Muwailah Commercial, Sharjah, UAE", peakHours: "07:00-09:00,17:00-20:00" },
  { name: "Al Khan Beach & Aquarium", type: "custom", lat: "25.33200000", lng: "55.37600000", radiusMeters: 350, regionCode: "AE-SH", description: "Coastal leisure hub - Sharjah Aquarium, Al Khan beach, family attractions and waterfront dining", address: "Al Khan, Sharjah, UAE", peakHours: "09:00-12:00,16:00-21:00" },
  { name: "Al Majaz Waterfront", type: "custom", lat: "25.33800000", lng: "55.38700000", radiusMeters: 400, regionCode: "AE-SH", description: "Sharjah's premier waterfront destination - dancing fountains, restaurants, green spaces and cultural events", address: "Al Majaz Waterfront, Sharjah, UAE", peakHours: "16:00-22:00" },
  { name: "Sharjah City Centre Mall", type: "mall", lat: "25.32850000", lng: "55.39300000", radiusMeters: 350, regionCode: "AE-SH", description: "Major shopping mall in Sharjah with high retail traffic and entertainment", address: "City Centre Sharjah, UAE", peakHours: "10:00-14:00,16:00-22:00" },

  { name: "Abu Dhabi Corniche", type: "custom", lat: "24.46310000", lng: "54.35530000", radiusMeters: 500, regionCode: "AE-AZ", description: "Iconic 8km waterfront corniche - popular beach, cycling and family leisure destination in Abu Dhabi", address: "Corniche Road, Abu Dhabi, UAE", peakHours: "06:00-09:00,16:00-21:00" },
  { name: "Abu Dhabi Marina Mall", type: "mall", lat: "24.47600000", lng: "54.32150000", radiusMeters: 350, regionCode: "AE-AZ", description: "Popular waterfront mall near the Corniche with dining, shopping and marina views", address: "Marina Mall, Abu Dhabi, UAE", peakHours: "10:00-14:00,16:00-22:00" },
  { name: "Yas Island Entertainment Hub", type: "custom", lat: "24.49000000", lng: "54.60100000", radiusMeters: 600, regionCode: "AE-AZ", description: "Major entertainment island - Ferrari World, Yas Waterworld, Warner Bros World, F1 circuit", address: "Yas Island, Abu Dhabi, UAE", peakHours: "10:00-14:00,16:00-22:00" },
  { name: "Saadiyat Cultural District", type: "custom", lat: "24.53400000", lng: "54.40980000", radiusMeters: 400, regionCode: "AE-AZ", description: "World-class cultural hub - Louvre Abu Dhabi, Guggenheim, luxury resorts and pristine beaches", address: "Saadiyat Island, Abu Dhabi, UAE", peakHours: "09:00-13:00,16:00-20:00" },
  { name: "Al Reem Island", type: "custom", lat: "24.49750000", lng: "54.40500000", radiusMeters: 400, regionCode: "AE-AZ", description: "Modern residential and commercial island - high-rise towers, shopping centers and urban living hub", address: "Al Reem Island, Abu Dhabi, UAE", peakHours: "07:00-09:00,17:00-20:00" },

  { name: "Ajman Corniche", type: "custom", lat: "25.41000000", lng: "55.44700000", radiusMeters: 400, regionCode: "AE-AJ", description: "Ajman's scenic corniche - beachfront promenade with hotels, dining and family recreation areas", address: "Corniche Road, Ajman, UAE", peakHours: "16:00-21:00" },
  { name: "City Centre Ajman", type: "mall", lat: "25.40460000", lng: "55.47820000", radiusMeters: 300, regionCode: "AE-AJ", description: "Main shopping and entertainment hub in Ajman - retail, dining, cinema and family activities", address: "City Centre Ajman, UAE", peakHours: "10:00-14:00,16:00-22:00" },

  { name: "Al Olaya District & Kingdom Centre", type: "custom", lat: "24.71100000", lng: "46.67450000", radiusMeters: 500, regionCode: "SA-RY", description: "Riyadh's premium financial and commercial district - Kingdom Centre Tower, luxury shopping, corporate offices", address: "Al Olaya, Riyadh, KSA", peakHours: "07:00-09:00,12:00-14:00,17:00-21:00" },
  { name: "Riyadh Boulevard", type: "custom", lat: "24.69500000", lng: "46.68400000", radiusMeters: 500, regionCode: "SA-RY", description: "Major entertainment zone - restaurants, events, concerts, themed attractions and seasonal festivals", address: "Boulevard Riyadh City, KSA", peakHours: "16:00-00:00" },
  { name: "Riyadh Park Mall", type: "mall", lat: "24.63720000", lng: "46.61770000", radiusMeters: 350, regionCode: "SA-RY", description: "Large modern mall with family entertainment, dining and retail in south Riyadh", address: "Riyadh Park, Riyadh, KSA", peakHours: "10:00-14:00,16:00-22:00" },
  { name: "Al Nakheel & Diplomatic Quarter", type: "custom", lat: "24.68900000", lng: "46.62500000", radiusMeters: 400, regionCode: "SA-RY", description: "Upscale residential and diplomatic hub - embassies, international schools, expat compounds", address: "Al Nakheel, Diplomatic Quarter, Riyadh, KSA", peakHours: "07:00-09:00,14:00-17:00" },
  { name: "King Khalid International Airport", type: "airport", lat: "24.95780000", lng: "46.69890000", radiusMeters: 600, regionCode: "SA-RY", description: "Riyadh's main airport - 24/7 high-demand zone for airport transfers, serving 30M+ passengers annually", address: "KKIA Airport, Riyadh, KSA", peakHours: "00:00-06:00,08:00-11:00,19:00-23:00" },
  { name: "Diriyah Gate Heritage", type: "custom", lat: "24.73450000", lng: "46.57280000", radiusMeters: 400, regionCode: "SA-RY", description: "UNESCO World Heritage Site - At-Turaif district, heritage dining at Al Bujairi, luxury entertainment mega-project", address: "Diriyah, Riyadh, KSA", peakHours: "10:00-14:00,17:00-23:00" },

  { name: "Jeddah Corniche & King Fahd Fountain", type: "custom", lat: "21.55500000", lng: "39.10600000", radiusMeters: 500, regionCode: "SA-JD", description: "Iconic Red Sea waterfront - world's tallest fountain, seaside dining, family recreation along 30km corniche", address: "Jeddah Corniche, Jeddah, KSA", peakHours: "16:00-23:00" },
  { name: "King Abdulaziz International Airport", type: "airport", lat: "21.66980000", lng: "39.15670000", radiusMeters: 600, regionCode: "SA-JD", description: "Jeddah airport and Hajj terminal - gateway for pilgrims to Mecca and Medina, massive seasonal demand", address: "KAIA Airport, Jeddah, KSA", peakHours: "00:00-06:00,08:00-12:00,18:00-23:00" },
  { name: "Red Sea Mall", type: "mall", lat: "21.61410000", lng: "39.11310000", radiusMeters: 400, regionCode: "SA-JD", description: "Major shopping destination in north Jeddah - 500+ stores, entertainment, dining and events", address: "Red Sea Mall, Jeddah, KSA", peakHours: "10:00-14:00,16:00-23:00" },
  { name: "Al Balad Historic District", type: "custom", lat: "21.48250000", lng: "39.18620000", radiusMeters: 400, regionCode: "SA-JD", description: "UNESCO World Heritage Site - ancient coral stone buildings, traditional souks, cultural heart of Jeddah", address: "Al Balad, Old Jeddah, KSA", peakHours: "09:00-13:00,17:00-22:00" },

  { name: "Dammam Corniche", type: "custom", lat: "26.42970000", lng: "50.11330000", radiusMeters: 400, regionCode: "SA-DM", description: "Eastern Province waterfront - family leisure, seafood restaurants, scenic Gulf views", address: "Dammam Corniche, Dammam, KSA", peakHours: "16:00-22:00" },
  { name: "Dhahran Mall & KFUPM", type: "mall", lat: "26.30760000", lng: "50.13940000", radiusMeters: 400, regionCode: "SA-DM", description: "Major commercial hub near King Fahd University - student traffic, shopping and dining zone", address: "Dhahran, Eastern Province, KSA", peakHours: "10:00-14:00,16:00-22:00" },

  { name: "Salmiya Commercial District", type: "custom", lat: "29.33400000", lng: "48.07700000", radiusMeters: 500, regionCode: "KW-KU", description: "Kuwait's largest residential and commercial area - Marina Mall, beachfront promenades, upscale shopping and dining", address: "Salmiya, Kuwait", peakHours: "10:00-14:00,17:00-23:00" },
  { name: "The Avenues Mall", type: "mall", lat: "29.31050000", lng: "47.94200000", radiusMeters: 500, regionCode: "KW-KU", description: "Kuwait's largest mall with 1,100+ stores - busiest shopping destination, peak activity on Friday evenings", address: "The Avenues, Rai, Kuwait", peakHours: "10:00-14:00,16:00-23:00" },
  { name: "Souq Mubarakiya", type: "custom", lat: "29.37600000", lng: "47.97300000", radiusMeters: 300, regionCode: "KW-KU", description: "Kuwait's oldest and most famous traditional market - spices, gold, textiles, street food, cultural heritage hub", address: "Souq Mubarakiya, Kuwait City, Kuwait", peakHours: "09:00-13:00,17:00-22:00" },
  { name: "Kuwait Towers & Sharq", type: "custom", lat: "29.38700000", lng: "47.99100000", radiusMeters: 350, regionCode: "KW-KU", description: "Iconic Kuwait Towers landmark area - waterfront, Souq Sharq shopping, tourist attraction zone", address: "Kuwait Towers, Sharq, Kuwait City", peakHours: "10:00-14:00,16:00-21:00" },
  { name: "360 Mall", type: "mall", lat: "29.28900000", lng: "48.02600000", radiusMeters: 350, regionCode: "KW-KU", description: "Premium luxury shopping mall - upscale brands, fine dining, entertainment, popular social gathering point", address: "360 Mall, South Surra, Kuwait", peakHours: "10:00-14:00,16:00-22:00" },
  { name: "Fahaheel Waterfront & Al Kout", type: "custom", lat: "29.08300000", lng: "48.13100000", radiusMeters: 400, regionCode: "KW-KU", description: "Southern coastal hub - Al Kout Mall, fish market, waterfront dining, family-friendly area in Ahmadi", address: "Fahaheel, Al Kout, Kuwait", peakHours: "10:00-13:00,16:00-22:00" },

  { name: "Seef District & City Centre", type: "mall", lat: "26.23610000", lng: "50.53310000", radiusMeters: 450, regionCode: "BH-MA", description: "Major commercial hub - Bahrain City Centre Mall, Seef Mall, high-rise towers, dining and entertainment", address: "Seef District, Manama, Bahrain", peakHours: "10:00-14:00,16:00-23:00" },
  { name: "Bab Al Bahrain & Manama Souq", type: "custom", lat: "26.22850000", lng: "50.58600000", radiusMeters: 350, regionCode: "BH-MA", description: "Historic gateway to Manama Souq - gold, spices, perfumes, traditional crafts, heavy foot traffic since 1926", address: "Bab Al Bahrain, Manama, Bahrain", peakHours: "09:00-13:00,16:00-21:00" },
  { name: "Adliya Art & Dining District", type: "custom", lat: "26.21500000", lng: "50.58000000", radiusMeters: 300, regionCode: "BH-MA", description: "Trendy art and dining hub - galleries, upscale cafes, Block 338, weekend brunch hotspot", address: "Adliya, Manama, Bahrain", peakHours: "10:00-14:00,18:00-23:00" },
  { name: "Juffair District", type: "custom", lat: "26.21350000", lng: "50.60440000", radiusMeters: 400, regionCode: "BH-MA", description: "Bahrain's vibrant expat and nightlife district - restaurants, bars, entertainment, near US Naval base", address: "Juffair, Manama, Bahrain", peakHours: "11:00-14:00,18:00-02:00" },
  { name: "Amwaj Islands", type: "custom", lat: "26.27300000", lng: "50.66200000", radiusMeters: 400, regionCode: "BH-MA", description: "Beach community island - waterfront dining, expat families, weekend recreation and beach activities", address: "Amwaj Islands, Bahrain", peakHours: "09:00-12:00,16:00-22:00" },
];

export async function initializeHubs(): Promise<void> {
  const result = await db.select({ count: sql<number>`cast(count(*) as integer)` }).from(hubs);
  const count = result[0].count;

  if (count > 0) {
    console.log(`Hubs already initialized: ${count} hubs`);
    // Backfill regionCode for existing hubs that have null regionCode
    const hubsWithNullRegion = await db.select({ id: hubs.id, name: hubs.name }).from(hubs).where(isNull(hubs.regionCode));
    if (hubsWithNullRegion.length > 0) {
      const regionMap = new Map(hubData.map(h => [h.name, h.regionCode]));
      for (const hub of hubsWithNullRegion) {
        const regionCode = regionMap.get(hub.name);
        if (regionCode) {
          await db.update(hubs).set({ regionCode }).where(eq(hubs.id, hub.id));
        }
      }
      console.log(`[HUBS] Backfilled regionCode for ${hubsWithNullRegion.length} hubs`);
    }
    return;
  }

  const allCities = await db.select({ id: cities.id, regionCode: cities.regionCode }).from(cities);
  const cityMap = new Map<string, string>();
  for (const city of allCities) {
    if (city.regionCode) {
      cityMap.set(city.regionCode, city.id);
    }
  }

  const hubsToInsert = [];
  let skipped = 0;

  for (const hub of hubData) {
    const cityId = cityMap.get(hub.regionCode);
    if (!cityId) {
      console.log(`[HUBS] Skipping "${hub.name}" - no city found for region ${hub.regionCode}`);
      skipped++;
      continue;
    }

    hubsToInsert.push({
      name: hub.name,
      type: hub.type,
      lat: hub.lat,
      lng: hub.lng,
      radiusMeters: hub.radiusMeters,
      cityId,
      regionCode: hub.regionCode,
      description: hub.description,
      address: hub.address,
      peakHours: hub.peakHours,
      status: "active" as const,
    });
  }

  if (hubsToInsert.length > 0) {
    await db.insert(hubs).values(hubsToInsert);
  }

  console.log(`Initialized ${hubsToInsert.length} hubs across Gulf region${skipped > 0 ? ` (${skipped} skipped - missing cities)` : ""}`);
}

// EV hubs: 8 specific hubs upgraded with charging infrastructure
const EV_HUB_NAMES = [
  "Dubai Mall & Downtown",
  "Dubai International Airport",
  "Mall of the Emirates",
  "Yas Island Entertainment Hub",
  "Abu Dhabi Corniche",
  "DIFC Financial Centre",
  "Seef District & City Centre",
  "Palm Jumeirah Gateway",
];

const EV_HUB_PORTS: Record<string, { total: number; available: number }> = {
  "Dubai Mall & Downtown":       { total: 24, available: 11 },
  "Dubai International Airport": { total: 32, available: 18 },
  "Mall of the Emirates":        { total: 20, available: 9 },
  "Yas Island Entertainment Hub":{ total: 16, available: 7 },
  "Abu Dhabi Corniche":          { total: 12, available: 5 },
  "DIFC Financial Centre":       { total: 18, available: 14 },
  "Seef District & City Centre": { total: 10, available: 4 },
  "Palm Jumeirah Gateway":       { total: 14, available: 10 },
};

export async function initializeEvHubs(): Promise<void> {
  // Update hubs that should be EV hubs but are not yet marked
  const allHubs = await db.select({ id: hubs.id, name: hubs.name, isEvHub: hubs.isEvHub }).from(hubs);

  let updated = 0;
  for (const hub of allHubs) {
    if (EV_HUB_NAMES.includes(hub.name)) {
      if (!hub.isEvHub) {
        const ports = EV_HUB_PORTS[hub.name] || { total: 12, available: 6 };
        await db.update(hubs).set({
          isEvHub: true,
          totalChargingPorts: ports.total,
          availablePorts: ports.available,
          avgDemandScore: "7.50",
          updatedAt: new Date(),
        }).where(eq(hubs.id, hub.id));
        updated++;
      }
    }
  }

  if (updated > 0) {
    console.log(`[EV HUBS] Upgraded ${updated} hubs with EV charging infrastructure`);
  } else {
    console.log(`[EV HUBS] All EV hubs already configured`);
  }
}

// Mosque hubs for Prayer Rides — one landmark mosque per launch city.
// Seeded idempotently by name (safe to run on every boot).
const mosqueHubData = [
  { name: "Jumeirah Mosque", lat: "25.23360000", lng: "55.26550000", radiusMeters: 350, regionCode: "AE-DU", description: "Dubai's iconic mosque on Jumeirah Beach Road - major prayer and cultural visit destination", address: "Jumeirah Beach Road, Jumeirah 1, Dubai, UAE", peakHours: "04:30-06:00,12:00-13:30,18:00-20:30" },
  { name: "Sheikh Zayed Grand Mosque", lat: "24.41290000", lng: "54.47500000", radiusMeters: 500, regionCode: "AE-AZ", description: "UAE's largest mosque - landmark prayer destination with capacity for 40,000+ worshippers", address: "Sheikh Rashid Bin Saeed Street, Abu Dhabi, UAE", peakHours: "04:30-06:00,12:00-13:30,18:00-20:30" },
  { name: "Al Noor Mosque", lat: "25.33900000", lng: "55.38620000", radiusMeters: 300, regionCode: "AE-SH", description: "Sharjah's landmark mosque on Khaled Lagoon - Ottoman-style architecture, central prayer hub", address: "Corniche Street, Al Majaz, Sharjah, UAE", peakHours: "04:30-06:00,12:00-13:30,18:00-20:30" },
  { name: "Sheikh Zayed Mosque Ajman", lat: "25.39930000", lng: "55.47940000", radiusMeters: 300, regionCode: "AE-AJ", description: "Ajman's largest mosque - central Friday prayer destination", address: "Sheikh Rashid Bin Humaid Street, Ajman, UAE", peakHours: "04:30-06:00,12:00-13:30,18:00-20:30" },
  { name: "Al Rajhi Grand Mosque", lat: "24.65440000", lng: "46.75980000", radiusMeters: 400, regionCode: "SA-RY", description: "One of Riyadh's largest mosques - major Friday congregation point in east Riyadh", address: "Al Rabwah, Riyadh, KSA", peakHours: "04:00-05:30,11:45-13:15,17:45-20:00" },
  { name: "Al Rahma Floating Mosque", lat: "21.60540000", lng: "39.10230000", radiusMeters: 300, regionCode: "SA-JD", description: "Jeddah's famous mosque on the Red Sea corniche - popular prayer and visit destination", address: "Corniche Road, Al Shati, Jeddah, KSA", peakHours: "04:00-05:30,11:45-13:15,17:45-20:00" },
  { name: "Imam Feisal Bin Turki Mosque", lat: "26.42300000", lng: "50.08800000", radiusMeters: 300, regionCode: "SA-DM", description: "Central Dammam mosque near the corniche - key Friday prayer gathering point", address: "King Saud Street, Dammam, KSA", peakHours: "04:00-05:30,11:45-13:15,17:45-20:00" },
  { name: "Grand Mosque of Kuwait", lat: "29.37890000", lng: "47.98550000", radiusMeters: 400, regionCode: "KW-KU", description: "Kuwait's largest mosque - national landmark hosting major congregations in Kuwait City", address: "Al Soor Street, Kuwait City, Kuwait", peakHours: "04:00-05:30,11:45-13:15,17:45-20:00" },
  { name: "Al Fateh Grand Mosque", lat: "26.21230000", lng: "50.59560000", radiusMeters: 400, regionCode: "BH-MA", description: "Bahrain's largest mosque - landmark prayer destination for up to 7,000 worshippers", address: "Awal Avenue, Juffair, Manama, Bahrain", peakHours: "04:00-05:30,11:45-13:15,17:45-20:00" },
];

export async function initializeMosqueHubs(): Promise<void> {
  const existing = await db.select({ name: hubs.name }).from(hubs).where(eq(hubs.type, "mosque"));
  const existingNames = new Set(existing.map((h) => h.name));

  const allCities = await db.select({ id: cities.id, regionCode: cities.regionCode }).from(cities);
  const cityMap = new Map<string, string>();
  for (const city of allCities) {
    if (city.regionCode) cityMap.set(city.regionCode, city.id);
  }

  const toInsert = [];
  for (const m of mosqueHubData) {
    if (existingNames.has(m.name)) continue;
    const cityId = cityMap.get(m.regionCode);
    if (!cityId) continue;
    toInsert.push({
      name: m.name,
      type: "mosque" as const,
      lat: m.lat,
      lng: m.lng,
      radiusMeters: m.radiusMeters,
      cityId,
      regionCode: m.regionCode,
      description: m.description,
      address: m.address,
      peakHours: m.peakHours,
      status: "active" as const,
    });
  }

  if (toInsert.length > 0) {
    await db.insert(hubs).values(toInsert);
    console.log(`[MOSQUE HUBS] Seeded ${toInsert.length} mosque hubs`);
  } else {
    console.log(`[MOSQUE HUBS] All mosque hubs already configured`);
  }
}
