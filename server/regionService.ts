import { db } from "./db";
import { regions, regionalVehicleTypes, regionalEmergencyContacts, exchangeRates } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface RegionConfig {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  phoneCode: string;
  timezone: string;
  language: string;
  surgeCap: number;
  platformFeePercent: number;
  minFare: number;
  emergencyNumber: string;
  supportedPaymentMethods: string[];
  vehicleTypes: RegionalVehicle[];
  emergencyContacts: EmergencyContactInfo[];
}

export interface RegionalVehicle {
  type: string;
  localName: string;
  description: string;
  icon: string;
  baseFare: number;
  perKmRate: number;
  perMinuteRate: number;
  minFare: number;
  maxPassengers: number;
}

export interface EmergencyContactInfo {
  name: string;
  phone: string;
  type: string;
}

const DEFAULT_REGIONS: Omit<RegionConfig, 'vehicleTypes' | 'emergencyContacts'>[] = [
  { code: "AE", name: "United Arab Emirates", currency: "AED", currencySymbol: "د.إ", phoneCode: "+971", timezone: "Asia/Dubai", language: "ar", surgeCap: 1.5, platformFeePercent: 10, minFare: 10, emergencyNumber: "999", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "US", name: "United States", currency: "USD", currencySymbol: "$", phoneCode: "+1", timezone: "America/New_York", language: "en", surgeCap: 1.5, platformFeePercent: 10, minFare: 5, emergencyNumber: "911", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "GB", name: "United Kingdom", currency: "GBP", currencySymbol: "£", phoneCode: "+44", timezone: "Europe/London", language: "en", surgeCap: 1.5, platformFeePercent: 10, minFare: 4, emergencyNumber: "999", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "RU", name: "Russia", currency: "RUB", currencySymbol: "₽", phoneCode: "+7", timezone: "Europe/Moscow", language: "ru", surgeCap: 1.5, platformFeePercent: 10, minFare: 150, emergencyNumber: "112", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "IN", name: "India", currency: "INR", currencySymbol: "₹", phoneCode: "+91", timezone: "Asia/Kolkata", language: "hi", surgeCap: 1.5, platformFeePercent: 10, minFare: 30, emergencyNumber: "112", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "NG", name: "Nigeria", currency: "NGN", currencySymbol: "₦", phoneCode: "+234", timezone: "Africa/Lagos", language: "en", surgeCap: 1.5, platformFeePercent: 10, minFare: 500, emergencyNumber: "199", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "KE", name: "Kenya", currency: "KES", currencySymbol: "KSh", phoneCode: "+254", timezone: "Africa/Nairobi", language: "sw", surgeCap: 1.5, platformFeePercent: 10, minFare: 150, emergencyNumber: "999", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "ZA", name: "South Africa", currency: "ZAR", currencySymbol: "R", phoneCode: "+27", timezone: "Africa/Johannesburg", language: "en", surgeCap: 1.5, platformFeePercent: 10, minFare: 30, emergencyNumber: "10111", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "DE", name: "Germany", currency: "EUR", currencySymbol: "€", phoneCode: "+49", timezone: "Europe/Berlin", language: "de", surgeCap: 1.5, platformFeePercent: 10, minFare: 4, emergencyNumber: "112", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "FR", name: "France", currency: "EUR", currencySymbol: "€", phoneCode: "+33", timezone: "Europe/Paris", language: "fr", surgeCap: 1.5, platformFeePercent: 10, minFare: 4, emergencyNumber: "112", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "CN", name: "China", currency: "CNY", currencySymbol: "¥", phoneCode: "+86", timezone: "Asia/Shanghai", language: "zh", surgeCap: 1.5, platformFeePercent: 10, minFare: 10, emergencyNumber: "110", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "JP", name: "Japan", currency: "JPY", currencySymbol: "¥", phoneCode: "+81", timezone: "Asia/Tokyo", language: "ja", surgeCap: 1.5, platformFeePercent: 10, minFare: 500, emergencyNumber: "110", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "TH", name: "Thailand", currency: "THB", currencySymbol: "฿", phoneCode: "+66", timezone: "Asia/Bangkok", language: "th", surgeCap: 1.5, platformFeePercent: 10, minFare: 35, emergencyNumber: "191", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "VN", name: "Vietnam", currency: "VND", currencySymbol: "₫", phoneCode: "+84", timezone: "Asia/Ho_Chi_Minh", language: "vi", surgeCap: 1.5, platformFeePercent: 10, minFare: 15000, emergencyNumber: "113", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "ID", name: "Indonesia", currency: "IDR", currencySymbol: "Rp", phoneCode: "+62", timezone: "Asia/Jakarta", language: "id", surgeCap: 1.5, platformFeePercent: 10, minFare: 10000, emergencyNumber: "110", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "PH", name: "Philippines", currency: "PHP", currencySymbol: "₱", phoneCode: "+63", timezone: "Asia/Manila", language: "fil", surgeCap: 1.5, platformFeePercent: 10, minFare: 50, emergencyNumber: "911", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "EG", name: "Egypt", currency: "EGP", currencySymbol: "E£", phoneCode: "+20", timezone: "Africa/Cairo", language: "ar", surgeCap: 1.5, platformFeePercent: 10, minFare: 20, emergencyNumber: "122", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "TR", name: "Turkey", currency: "TRY", currencySymbol: "₺", phoneCode: "+90", timezone: "Europe/Istanbul", language: "tr", surgeCap: 1.5, platformFeePercent: 10, minFare: 50, emergencyNumber: "112", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "BR", name: "Brazil", currency: "BRL", currencySymbol: "R$", phoneCode: "+55", timezone: "America/Sao_Paulo", language: "pt", surgeCap: 1.5, platformFeePercent: 10, minFare: 8, emergencyNumber: "190", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "MX", name: "Mexico", currency: "MXN", currencySymbol: "$", phoneCode: "+52", timezone: "America/Mexico_City", language: "es", surgeCap: 1.5, platformFeePercent: 10, minFare: 35, emergencyNumber: "911", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "BD", name: "Bangladesh", currency: "BDT", currencySymbol: "৳", phoneCode: "+880", timezone: "Asia/Dhaka", language: "bn", surgeCap: 1.5, platformFeePercent: 10, minFare: 50, emergencyNumber: "999", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "PK", name: "Pakistan", currency: "PKR", currencySymbol: "₨", phoneCode: "+92", timezone: "Asia/Karachi", language: "ur", surgeCap: 1.5, platformFeePercent: 10, minFare: 100, emergencyNumber: "15", supportedPaymentMethods: ["cash", "usdt"] },
];

const REGIONAL_VEHICLES: Record<string, RegionalVehicle[]> = {
  "AE": [
    { type: "economy", localName: "Economy", description: "Affordable rides", icon: "car", baseFare: 10, perKmRate: 2.5, perMinuteRate: 0.5, minFare: 10, maxPassengers: 4 },
    { type: "comfort", localName: "Comfort", description: "Spacious comfort", icon: "car", baseFare: 15, perKmRate: 3.5, perMinuteRate: 0.75, minFare: 15, maxPassengers: 4 },
    { type: "premium", localName: "Premium", description: "Luxury experience", icon: "car", baseFare: 25, perKmRate: 5, perMinuteRate: 1, minFare: 25, maxPassengers: 4 },
    { type: "xl", localName: "XL", description: "For groups", icon: "truck", baseFare: 20, perKmRate: 4, perMinuteRate: 0.8, minFare: 20, maxPassengers: 6 },
  ],
  "IN": [
    { type: "rickshaw", localName: "Auto Rickshaw", description: "Quick city rides", icon: "navigation", baseFare: 25, perKmRate: 12, perMinuteRate: 2, minFare: 25, maxPassengers: 3 },
    { type: "moto", localName: "Bike", description: "Fast solo rides", icon: "navigation", baseFare: 15, perKmRate: 8, perMinuteRate: 1, minFare: 15, maxPassengers: 1 },
    { type: "economy", localName: "Mini", description: "Affordable hatchback", icon: "car", baseFare: 40, perKmRate: 15, perMinuteRate: 2, minFare: 40, maxPassengers: 4 },
    { type: "comfort", localName: "Sedan", description: "Comfortable sedan", icon: "car", baseFare: 60, perKmRate: 20, perMinuteRate: 3, minFare: 60, maxPassengers: 4 },
    { type: "premium", localName: "Prime", description: "Premium rides", icon: "car", baseFare: 100, perKmRate: 30, perMinuteRate: 5, minFare: 100, maxPassengers: 4 },
  ],
  "TH": [
    { type: "tuktuk", localName: "Tuk Tuk", description: "Classic Thai ride", icon: "navigation", baseFare: 40, perKmRate: 15, perMinuteRate: 3, minFare: 40, maxPassengers: 3 },
    { type: "moto", localName: "Motorbike", description: "Beat the traffic", icon: "navigation", baseFare: 25, perKmRate: 10, perMinuteRate: 2, minFare: 25, maxPassengers: 1 },
    { type: "economy", localName: "Taxi", description: "Regular taxi", icon: "car", baseFare: 35, perKmRate: 12, perMinuteRate: 2, minFare: 35, maxPassengers: 4 },
    { type: "comfort", localName: "JustGrab", description: "Comfortable ride", icon: "car", baseFare: 50, perKmRate: 18, perMinuteRate: 3, minFare: 50, maxPassengers: 4 },
  ],
  "NG": [
    { type: "moto", localName: "Okada", description: "Motorcycle taxi", icon: "navigation", baseFare: 200, perKmRate: 100, perMinuteRate: 20, minFare: 200, maxPassengers: 1 },
    { type: "rickshaw", localName: "Keke", description: "Tricycle ride", icon: "navigation", baseFare: 300, perKmRate: 150, perMinuteRate: 30, minFare: 300, maxPassengers: 3 },
    { type: "economy", localName: "Economy", description: "Affordable car", icon: "car", baseFare: 500, perKmRate: 200, perMinuteRate: 40, minFare: 500, maxPassengers: 4 },
    { type: "comfort", localName: "Comfort", description: "AC car", icon: "car", baseFare: 800, perKmRate: 300, perMinuteRate: 60, minFare: 800, maxPassengers: 4 },
  ],
  "KE": [
    { type: "moto", localName: "Boda Boda", description: "Motorcycle taxi", icon: "navigation", baseFare: 50, perKmRate: 30, perMinuteRate: 5, minFare: 50, maxPassengers: 1 },
    { type: "tuktuk", localName: "Tuk Tuk", description: "Three-wheeler", icon: "navigation", baseFare: 100, perKmRate: 40, perMinuteRate: 8, minFare: 100, maxPassengers: 3 },
    { type: "economy", localName: "Chap Chap", description: "Quick & cheap", icon: "car", baseFare: 150, perKmRate: 50, perMinuteRate: 10, minFare: 150, maxPassengers: 4 },
    { type: "comfort", localName: "Go", description: "Comfortable ride", icon: "car", baseFare: 250, perKmRate: 80, perMinuteRate: 15, minFare: 250, maxPassengers: 4 },
  ],
  "ID": [
    { type: "moto", localName: "Ojek", description: "Motorcycle taxi", icon: "navigation", baseFare: 8000, perKmRate: 2500, perMinuteRate: 500, minFare: 8000, maxPassengers: 1 },
    { type: "rickshaw", localName: "Bajaj", description: "Three-wheeler", icon: "navigation", baseFare: 12000, perKmRate: 4000, perMinuteRate: 800, minFare: 12000, maxPassengers: 3 },
    { type: "economy", localName: "GoCar", description: "Budget car", icon: "car", baseFare: 15000, perKmRate: 5000, perMinuteRate: 1000, minFare: 15000, maxPassengers: 4 },
    { type: "comfort", localName: "GoCar Comfort", description: "Premium ride", icon: "car", baseFare: 25000, perKmRate: 8000, perMinuteRate: 1500, minFare: 25000, maxPassengers: 4 },
  ],
  "VN": [
    { type: "moto", localName: "Xe Ôm", description: "Motorcycle taxi", icon: "navigation", baseFare: 12000, perKmRate: 4000, perMinuteRate: 700, minFare: 12000, maxPassengers: 1 },
    { type: "economy", localName: "4 Chỗ", description: "4-seater car", icon: "car", baseFare: 25000, perKmRate: 10000, perMinuteRate: 2000, minFare: 25000, maxPassengers: 4 },
    { type: "comfort", localName: "7 Chỗ", description: "7-seater car", icon: "truck", baseFare: 35000, perKmRate: 12000, perMinuteRate: 2500, minFare: 35000, maxPassengers: 7 },
  ],
  "PH": [
    { type: "moto", localName: "Angkas", description: "Motorcycle", icon: "navigation", baseFare: 40, perKmRate: 12, perMinuteRate: 2, minFare: 40, maxPassengers: 1 },
    { type: "rickshaw", localName: "Tricycle", description: "Local tricycle", icon: "navigation", baseFare: 30, perKmRate: 10, perMinuteRate: 2, minFare: 30, maxPassengers: 3 },
    { type: "economy", localName: "GrabCar", description: "Economy ride", icon: "car", baseFare: 60, perKmRate: 18, perMinuteRate: 3, minFare: 60, maxPassengers: 4 },
    { type: "comfort", localName: "Premium", description: "Premium car", icon: "car", baseFare: 100, perKmRate: 25, perMinuteRate: 5, minFare: 100, maxPassengers: 4 },
  ],
  "RU": [
    { type: "economy", localName: "Эконом", description: "Budget ride", icon: "car", baseFare: 99, perKmRate: 15, perMinuteRate: 3, minFare: 99, maxPassengers: 4 },
    { type: "comfort", localName: "Комфорт", description: "Comfortable car", icon: "car", baseFare: 149, perKmRate: 20, perMinuteRate: 4, minFare: 149, maxPassengers: 4 },
    { type: "premium", localName: "Бизнес", description: "Business class", icon: "car", baseFare: 299, perKmRate: 35, perMinuteRate: 7, minFare: 299, maxPassengers: 4 },
    { type: "minibus", localName: "Минивэн", description: "For groups", icon: "truck", baseFare: 249, perKmRate: 30, perMinuteRate: 6, minFare: 249, maxPassengers: 7 },
  ],
  "BD": [
    { type: "cng", localName: "CNG Auto", description: "Green auto rickshaw", icon: "navigation", baseFare: 30, perKmRate: 12, perMinuteRate: 2, minFare: 30, maxPassengers: 3 },
    { type: "rickshaw", localName: "Easy Bike", description: "Electric rickshaw", icon: "navigation", baseFare: 20, perKmRate: 8, perMinuteRate: 1.5, minFare: 20, maxPassengers: 3 },
    { type: "moto", localName: "Bike", description: "Motorcycle ride", icon: "navigation", baseFare: 25, perKmRate: 10, perMinuteRate: 2, minFare: 25, maxPassengers: 1 },
    { type: "economy", localName: "Car", description: "Affordable car", icon: "car", baseFare: 80, perKmRate: 25, perMinuteRate: 4, minFare: 80, maxPassengers: 4 },
    { type: "comfort", localName: "Sedan", description: "AC sedan", icon: "car", baseFare: 120, perKmRate: 35, perMinuteRate: 6, minFare: 120, maxPassengers: 4 },
  ],
  "PK": [
    { type: "rickshaw", localName: "Rickshaw", description: "Auto rickshaw", icon: "navigation", baseFare: 50, perKmRate: 20, perMinuteRate: 3, minFare: 50, maxPassengers: 3 },
    { type: "moto", localName: "Bike", description: "Motorcycle ride", icon: "navigation", baseFare: 40, perKmRate: 15, perMinuteRate: 2.5, minFare: 40, maxPassengers: 1 },
    { type: "economy", localName: "Mini", description: "Budget car", icon: "car", baseFare: 150, perKmRate: 40, perMinuteRate: 7, minFare: 150, maxPassengers: 4 },
    { type: "comfort", localName: "Go", description: "Comfortable ride", icon: "car", baseFare: 200, perKmRate: 55, perMinuteRate: 10, minFare: 200, maxPassengers: 4 },
    { type: "premium", localName: "Executive", description: "Premium sedan", icon: "car", baseFare: 350, perKmRate: 80, perMinuteRate: 15, minFare: 350, maxPassengers: 4 },
  ],
};

const DEFAULT_VEHICLES: RegionalVehicle[] = [
  { type: "economy", localName: "Economy", description: "Affordable rides", icon: "car", baseFare: 5, perKmRate: 1.5, perMinuteRate: 0.3, minFare: 5, maxPassengers: 4 },
  { type: "comfort", localName: "Comfort", description: "Comfortable rides", icon: "car", baseFare: 8, perKmRate: 2, perMinuteRate: 0.4, minFare: 8, maxPassengers: 4 },
  { type: "premium", localName: "Premium", description: "Premium experience", icon: "car", baseFare: 15, perKmRate: 3, perMinuteRate: 0.6, minFare: 15, maxPassengers: 4 },
  { type: "xl", localName: "XL", description: "For groups", icon: "truck", baseFare: 12, perKmRate: 2.5, perMinuteRate: 0.5, minFare: 12, maxPassengers: 6 },
];

export async function initializeRegions(): Promise<void> {
  console.log("Initializing regions...");
  
  for (const regionData of DEFAULT_REGIONS) {
    const existing = await db.select().from(regions).where(eq(regions.code, regionData.code)).limit(1);
    
    if (existing.length === 0) {
      const [region] = await db.insert(regions).values({
        code: regionData.code,
        name: regionData.name,
        currency: regionData.currency as any,
        currencySymbol: regionData.currencySymbol,
        phoneCode: regionData.phoneCode,
        timezone: regionData.timezone,
        language: regionData.language,
        surgeCap: regionData.surgeCap.toString(),
        platformFeePercent: regionData.platformFeePercent.toString(),
        minFare: regionData.minFare.toString(),
        emergencyNumber: regionData.emergencyNumber,
        supportedPaymentMethods: regionData.supportedPaymentMethods.join(","),
      }).returning();

      const vehicles = REGIONAL_VEHICLES[regionData.code] || DEFAULT_VEHICLES;
      for (let i = 0; i < vehicles.length; i++) {
        const v = vehicles[i];
        await db.insert(regionalVehicleTypes).values({
          regionId: region.id,
          type: v.type as any,
          localName: v.localName,
          description: v.description,
          icon: v.icon,
          baseFare: v.baseFare.toString(),
          perKmRate: v.perKmRate.toString(),
          perMinuteRate: v.perMinuteRate.toString(),
          minFare: v.minFare.toString(),
          maxPassengers: v.maxPassengers,
          sortOrder: i,
        });
      }

      await db.insert(regionalEmergencyContacts).values({
        regionId: region.id,
        name: "Emergency Services",
        phone: regionData.emergencyNumber,
        type: "emergency",
        isDefault: true,
      });

      console.log(`Initialized region: ${regionData.name}`);
    }
  }
  
  console.log("Regions initialization complete");
}

export async function getRegionByCode(code: string): Promise<RegionConfig | null> {
  const [region] = await db.select().from(regions).where(eq(regions.code, code)).limit(1);
  
  if (!region) return null;
  
  const vehicles = await db.select().from(regionalVehicleTypes)
    .where(and(eq(regionalVehicleTypes.regionId, region.id), eq(regionalVehicleTypes.isActive, true)));
  
  const emergencyContactsList = await db.select().from(regionalEmergencyContacts)
    .where(eq(regionalEmergencyContacts.regionId, region.id));
  
  return {
    code: region.code,
    name: region.name,
    currency: region.currency,
    currencySymbol: region.currencySymbol,
    phoneCode: region.phoneCode,
    timezone: region.timezone,
    language: region.language || "en",
    surgeCap: parseFloat(region.surgeCap || "1.5"),
    platformFeePercent: parseFloat(region.platformFeePercent || "10"),
    minFare: parseFloat(region.minFare || "5"),
    emergencyNumber: region.emergencyNumber || "",
    supportedPaymentMethods: (region.supportedPaymentMethods || "cash,usdt").split(","),
    vehicleTypes: vehicles.map(v => ({
      type: v.type,
      localName: v.localName,
      description: v.description || "",
      icon: v.icon || "car",
      baseFare: parseFloat(v.baseFare),
      perKmRate: parseFloat(v.perKmRate),
      perMinuteRate: parseFloat(v.perMinuteRate),
      minFare: parseFloat(v.minFare || "0"),
      maxPassengers: v.maxPassengers || 4,
    })),
    emergencyContacts: emergencyContactsList.map(c => ({
      name: c.name,
      phone: c.phone,
      type: c.type,
    })),
  };
}

export async function getAllRegions(): Promise<RegionConfig[]> {
  const allRegions = await db.select().from(regions).where(eq(regions.isActive, true));
  
  const result: RegionConfig[] = [];
  for (const region of allRegions) {
    const config = await getRegionByCode(region.code);
    if (config) result.push(config);
  }
  
  return result;
}

export async function detectRegionFromPhone(phone: string): Promise<string> {
  const allRegions = await db.select().from(regions).where(eq(regions.isActive, true));
  
  for (const region of allRegions) {
    if (phone.startsWith(region.phoneCode)) {
      return region.code;
    }
  }
  
  return "AE";
}

export async function calculateFare(
  regionCode: string,
  vehicleType: string,
  distanceKm: number,
  durationMinutes: number,
  surgeMultiplier: number = 1.0
): Promise<{ fare: number; breakdown: any; driverEarnings: number; platformFee: number }> {
  const region = await getRegionByCode(regionCode);
  if (!region) throw new Error("Region not found");
  
  const vehicle = region.vehicleTypes.find(v => v.type === vehicleType);
  if (!vehicle) throw new Error("Vehicle type not available in this region");
  
  const cappedSurge = Math.min(surgeMultiplier, region.surgeCap);
  
  const baseFare = vehicle.baseFare;
  const distanceFare = distanceKm * vehicle.perKmRate;
  const timeFare = durationMinutes * vehicle.perMinuteRate;
  
  let subtotal = baseFare + distanceFare + timeFare;
  subtotal = subtotal * cappedSurge;
  
  const fare = Math.max(subtotal, vehicle.minFare);
  
  const platformFee = fare * (region.platformFeePercent / 100);
  const driverEarnings = fare - platformFee;
  
  return {
    fare: Math.round(fare * 100) / 100,
    breakdown: {
      baseFare,
      distanceFare: Math.round(distanceFare * 100) / 100,
      timeFare: Math.round(timeFare * 100) / 100,
      surgeMultiplier: cappedSurge,
      currency: region.currency,
      currencySymbol: region.currencySymbol,
    },
    driverEarnings: Math.round(driverEarnings * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100,
  };
}

export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  if (fromCurrency === toCurrency) return amount;
  
  const [rate] = await db.select().from(exchangeRates)
    .where(and(
      eq(exchangeRates.fromCurrency, fromCurrency as any),
      eq(exchangeRates.toCurrency, toCurrency as any)
    ))
    .limit(1);
  
  if (rate) {
    return amount * parseFloat(rate.rate);
  }
  
  const [reverseRate] = await db.select().from(exchangeRates)
    .where(and(
      eq(exchangeRates.fromCurrency, toCurrency as any),
      eq(exchangeRates.toCurrency, fromCurrency as any)
    ))
    .limit(1);
  
  if (reverseRate) {
    return amount / parseFloat(reverseRate.rate);
  }
  
  console.warn(`No exchange rate found for ${fromCurrency} to ${toCurrency}`);
  return amount;
}

export function getPhoneCodesList(): { code: string; phoneCode: string; name: string }[] {
  return DEFAULT_REGIONS.map(r => ({
    code: r.code,
    phoneCode: r.phoneCode,
    name: r.name,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

// Initialize default service types for ride booking
import { serviceTypes } from "@shared/schema";

const DEFAULT_SERVICE_TYPES = [
  { id: "st-economy", name: "Economy", type: "economy", baseFare: "5.00", perKmRate: "1.50", perMinuteRate: "0.30", icon: "car", isActive: true },
  { id: "st-comfort", name: "Comfort", type: "comfort", baseFare: "8.00", perKmRate: "2.00", perMinuteRate: "0.40", icon: "car", isActive: true },
  { id: "st-premium", name: "Premium", type: "premium", baseFare: "15.00", perKmRate: "3.00", perMinuteRate: "0.60", icon: "car", isActive: true },
  { id: "st-xl", name: "XL", type: "xl", baseFare: "12.00", perKmRate: "2.50", perMinuteRate: "0.50", icon: "truck", isActive: true },
];

export async function initializeServiceTypes(): Promise<void> {
  console.log("Initializing service types...");
  
  for (const st of DEFAULT_SERVICE_TYPES) {
    const existing = await db.select().from(serviceTypes).where(eq(serviceTypes.id, st.id)).limit(1);
    
    if (existing.length === 0) {
      await db.insert(serviceTypes).values(st as any);
      console.log(`Created service type: ${st.name}`);
    }
  }
  
  console.log("Service types initialization complete");
}
