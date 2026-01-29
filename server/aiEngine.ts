import { storage } from "./storage";

interface DriverScore {
  driverId: string;
  userId: string;
  name: string;
  rating: number;
  totalTrips: number;
  distance: number;
  eta: number;
  vehicleType: string;
  vehicleMake: string;
  vehicleModel: string;
  plateNumber: string;
  score: number;
  scoreBreakdown: {
    distanceScore: number;
    ratingScore: number;
    experienceScore: number;
    availabilityScore: number;
  };
}

interface PriceBreakdown {
  baseFare: number;
  distanceCharge: number;
  timeCharge: number;
  demandMultiplier: number;
  timeOfDayMultiplier: number;
  trafficMultiplier: number;
  platformFee: number;
  total: number;
  driverEarnings: number;
  savings: number;
  priceExplanation: string[];
}

interface DemandData {
  activeRides: number;
  availableDrivers: number;
  demandRatio: number;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getTimeOfDayMultiplier(): { multiplier: number; reason: string } {
  const hour = new Date().getHours();
  
  if (hour >= 7 && hour <= 9) {
    return { multiplier: 1.15, reason: "Morning rush hour" };
  }
  if (hour >= 17 && hour <= 19) {
    return { multiplier: 1.20, reason: "Evening rush hour" };
  }
  if (hour >= 22 || hour <= 5) {
    return { multiplier: 1.10, reason: "Late night surcharge" };
  }
  if (hour >= 13 && hour <= 15) {
    return { multiplier: 0.95, reason: "Off-peak discount" };
  }
  return { multiplier: 1.0, reason: "Standard rate" };
}

function getTrafficMultiplier(distance: number): { multiplier: number; reason: string } {
  const hour = new Date().getHours();
  const isWeekend = [0, 6].includes(new Date().getDay());
  
  if (isWeekend) {
    return { multiplier: 0.95, reason: "Weekend - less traffic" };
  }
  
  if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
    if (distance > 10) {
      return { multiplier: 1.25, reason: "Heavy traffic on long route" };
    }
    return { multiplier: 1.15, reason: "Rush hour traffic" };
  }
  
  return { multiplier: 1.0, reason: "Normal traffic" };
}

async function getDemandData(lat: number, lng: number): Promise<DemandData> {
  const activeRides = await storage.getActiveRidesCount();
  const availableDrivers = await storage.getAvailableDriversCount(lat, lng, 10);
  
  const demandRatio = availableDrivers > 0 ? activeRides / availableDrivers : 2;
  
  return {
    activeRides,
    availableDrivers,
    demandRatio: Math.min(demandRatio, 3),
  };
}

function getDemandMultiplier(demandRatio: number): { multiplier: number; reason: string } {
  if (demandRatio <= 0.5) {
    return { multiplier: 0.90, reason: "Low demand - 10% discount" };
  }
  if (demandRatio <= 1) {
    return { multiplier: 1.0, reason: "Normal demand" };
  }
  if (demandRatio <= 1.5) {
    return { multiplier: 1.10, reason: "High demand (+10%)" };
  }
  if (demandRatio <= 2) {
    return { multiplier: 1.20, reason: "Very high demand (+20%)" };
  }
  return { multiplier: 1.30, reason: "Peak demand - capped at +30%" };
}

export async function findOptimalDrivers(
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
  vehicleType?: string
): Promise<DriverScore[]> {
  const availableDrivers = await storage.getAvailableDriversWithVehicles(
    pickupLat,
    pickupLng,
    15
  );

  const scoredDrivers: DriverScore[] = [];

  for (const driver of availableDrivers) {
    if (vehicleType && driver.vehicleType !== vehicleType) {
      continue;
    }

    const driverLat = parseFloat(driver.currentLat || "0");
    const driverLng = parseFloat(driver.currentLng || "0");
    
    if (driverLat === 0 || driverLng === 0) continue;

    const distance = calculateDistance(pickupLat, pickupLng, driverLat, driverLng);
    const eta = Math.round(distance * 3 + 2);
    
    const rating = parseFloat(driver.rating || "5.0");
    const totalTrips = driver.totalTrips || 0;

    const distanceScore = Math.max(0, 100 - (distance * 10));
    
    const ratingScore = (rating / 5) * 100;
    
    let experienceScore = 50;
    if (totalTrips >= 100) experienceScore = 90;
    else if (totalTrips >= 50) experienceScore = 80;
    else if (totalTrips >= 20) experienceScore = 70;
    else if (totalTrips >= 10) experienceScore = 60;
    
    const availabilityScore = 100;

    const score = (
      distanceScore * 0.40 +
      ratingScore * 0.30 +
      experienceScore * 0.20 +
      availabilityScore * 0.10
    );

    scoredDrivers.push({
      driverId: driver.id,
      userId: driver.userId,
      name: driver.name,
      rating,
      totalTrips,
      distance: Math.round(distance * 10) / 10,
      eta,
      vehicleType: driver.vehicleType,
      vehicleMake: driver.vehicleMake,
      vehicleModel: driver.vehicleModel,
      plateNumber: driver.plateNumber,
      score: Math.round(score * 10) / 10,
      scoreBreakdown: {
        distanceScore: Math.round(distanceScore),
        ratingScore: Math.round(ratingScore),
        experienceScore: Math.round(experienceScore),
        availabilityScore: Math.round(availabilityScore),
      },
    });
  }

  return scoredDrivers.sort((a, b) => b.score - a.score);
}

export async function calculateOptimalPrice(
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
  vehicleType: string = "economy"
): Promise<PriceBreakdown> {
  const distance = calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
  const estimatedMinutes = Math.round(distance * 3 + 5);

  const serviceTypes = await storage.getServiceTypes();
  const service = serviceTypes.find(s => s.type === vehicleType) || {
    baseFare: "5.00",
    perKmRate: "2.00",
    perMinuteRate: "0.30",
  };

  const baseFare = parseFloat(service.baseFare);
  const perKmRate = parseFloat(service.perKmRate);
  const perMinuteRate = parseFloat(service.perMinuteRate);

  const distanceCharge = distance * perKmRate;
  const timeCharge = estimatedMinutes * perMinuteRate;

  const demandData = await getDemandData(pickupLat, pickupLng);
  const demandInfo = getDemandMultiplier(demandData.demandRatio);
  
  const timeOfDayInfo = getTimeOfDayMultiplier();
  const trafficInfo = getTrafficMultiplier(distance);

  const priceExplanation: string[] = [];
  
  priceExplanation.push(`Base fare: AED ${baseFare.toFixed(2)}`);
  priceExplanation.push(`Distance (${distance.toFixed(1)} km × ${perKmRate.toFixed(2)}): AED ${distanceCharge.toFixed(2)}`);
  priceExplanation.push(`Time (~${estimatedMinutes} min × ${perMinuteRate.toFixed(2)}): AED ${timeCharge.toFixed(2)}`);

  let subtotal = baseFare + distanceCharge + timeCharge;

  if (demandInfo.multiplier !== 1) {
    priceExplanation.push(`${demandInfo.reason}: ${((demandInfo.multiplier - 1) * 100).toFixed(0)}%`);
  }
  if (timeOfDayInfo.multiplier !== 1) {
    priceExplanation.push(`${timeOfDayInfo.reason}: ${((timeOfDayInfo.multiplier - 1) * 100).toFixed(0)}%`);
  }
  if (trafficInfo.multiplier !== 1) {
    priceExplanation.push(`${trafficInfo.reason}: ${((trafficInfo.multiplier - 1) * 100).toFixed(0)}%`);
  }

  const combinedMultiplier = Math.min(
    demandInfo.multiplier * timeOfDayInfo.multiplier * trafficInfo.multiplier,
    1.5
  );

  const adjustedTotal = subtotal * combinedMultiplier;

  const platformFeeRate = 0.10;
  const platformFee = adjustedTotal * platformFeeRate;
  const total = adjustedTotal;
  const driverEarnings = total - platformFee;

  priceExplanation.push(`Platform fee (10%): AED ${platformFee.toFixed(2)}`);
  priceExplanation.push(`Driver receives: AED ${driverEarnings.toFixed(2)}`);

  const regularPrice = subtotal * 1.25;
  const savings = Math.max(0, regularPrice - total);

  if (savings > 0) {
    priceExplanation.push(`AI optimization saved you: AED ${savings.toFixed(2)}`);
  }

  return {
    baseFare,
    distanceCharge: Math.round(distanceCharge * 100) / 100,
    timeCharge: Math.round(timeCharge * 100) / 100,
    demandMultiplier: demandInfo.multiplier,
    timeOfDayMultiplier: timeOfDayInfo.multiplier,
    trafficMultiplier: trafficInfo.multiplier,
    platformFee: Math.round(platformFee * 100) / 100,
    total: Math.round(total * 100) / 100,
    driverEarnings: Math.round(driverEarnings * 100) / 100,
    savings: Math.round(savings * 100) / 100,
    priceExplanation,
  };
}

export async function getOptimalRideMatch(
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
  vehicleType?: string
) {
  const [drivers, pricing] = await Promise.all([
    findOptimalDrivers(pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType),
    calculateOptimalPrice(pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType),
  ]);

  const bestDriver = drivers[0] || null;
  const alternativeDrivers = drivers.slice(1, 4);

  return {
    bestMatch: bestDriver ? {
      driver: bestDriver,
      pricing,
      aiConfidence: Math.min(95, bestDriver.score),
      matchReason: `Best match based on ${bestDriver.distance.toFixed(1)}km distance, ${bestDriver.rating} rating, and ${bestDriver.totalTrips} completed trips`,
    } : null,
    alternatives: alternativeDrivers.map(d => ({
      driver: d,
      pricing,
    })),
    demandInfo: {
      availableDrivers: drivers.length,
      searchRadius: 15,
    },
    pricingTransparency: pricing.priceExplanation,
  };
}
