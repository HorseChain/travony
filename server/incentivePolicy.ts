import { storage } from "./storage";

export interface IncentivePolicy {
  cityId: string;
  phase: "seeding" | "growth" | "mature";
  signupBonusEnabled: boolean;
  signupBonusAmount: number;
  signupBonusRidesRequired: number;
  referralBonusEnabled: boolean;
  referralBonusAmount: number;
  surgePricingEnabled: boolean;
  maxSurgeMultiplier: number;
  weatherBoostEnabled: boolean;
  weatherBoostMultiplier: number;
  emergencyBoostEnabled: boolean;
  emergencyBoostMultiplier: number;
  peakHourBoostEnabled: boolean;
  peakHourBoostMultiplier: number;
  updatedAt: Date;
}

export interface PhaseThresholds {
  seedingToGrowth: {
    minActiveDrivers: number;
    minDailyRides: number;
    minDaysActive: number;
  };
  growthToMature: {
    minActiveDrivers: number;
    minDailyRides: number;
    minDaysActive: number;
  };
}

const defaultThresholds: PhaseThresholds = {
  seedingToGrowth: {
    minActiveDrivers: 50,
    minDailyRides: 100,
    minDaysActive: 30
  },
  growthToMature: {
    minActiveDrivers: 200,
    minDailyRides: 500,
    minDaysActive: 90
  }
};

const phasePolicies: Record<IncentivePolicy["phase"], Partial<IncentivePolicy>> = {
  seeding: {
    signupBonusEnabled: true,
    signupBonusAmount: 50,
    signupBonusRidesRequired: 10,
    referralBonusEnabled: true,
    referralBonusAmount: 25,
    surgePricingEnabled: false,
    maxSurgeMultiplier: 1.0,
    weatherBoostEnabled: true,
    weatherBoostMultiplier: 1.3,
    emergencyBoostEnabled: true,
    emergencyBoostMultiplier: 1.5,
    peakHourBoostEnabled: false,
    peakHourBoostMultiplier: 1.0
  },
  growth: {
    signupBonusEnabled: false,
    signupBonusAmount: 0,
    signupBonusRidesRequired: 0,
    referralBonusEnabled: true,
    referralBonusAmount: 15,
    surgePricingEnabled: true,
    maxSurgeMultiplier: 1.5,
    weatherBoostEnabled: true,
    weatherBoostMultiplier: 1.25,
    emergencyBoostEnabled: true,
    emergencyBoostMultiplier: 1.4,
    peakHourBoostEnabled: true,
    peakHourBoostMultiplier: 1.2
  },
  mature: {
    signupBonusEnabled: false,
    signupBonusAmount: 0,
    signupBonusRidesRequired: 0,
    referralBonusEnabled: false,
    referralBonusAmount: 0,
    surgePricingEnabled: true,
    maxSurgeMultiplier: 2.0,
    weatherBoostEnabled: true,
    weatherBoostMultiplier: 1.2,
    emergencyBoostEnabled: true,
    emergencyBoostMultiplier: 1.3,
    peakHourBoostEnabled: true,
    peakHourBoostMultiplier: 1.25
  }
};

interface CityData {
  launchMode?: string;
  launchedAt?: Date;
}

const cityCache = new Map<string, CityData>();

function setCityData(cityId: string, data: CityData): void {
  cityCache.set(cityId, data);
}

function getCityDataCached(cityId: string): CityData | null {
  return cityCache.get(cityId) || null;
}

async function getActiveDriverCountForCity(_cityId: string): Promise<number> {
  return 0;
}

async function getDailyRideCountForCity(_cityId: string): Promise<number> {
  return 0;
}

export async function getCityPhase(cityId: string): Promise<IncentivePolicy["phase"]> {
  const city = getCityDataCached(cityId);
  if (!city) {
    return "seeding";
  }
  
  const launchMode = city.launchMode || "pre_launch";
  
  if (launchMode === "pre_launch" || launchMode === "founding_driver") {
    return "seeding";
  } else if (launchMode === "limited" || launchMode === "beta") {
    return "growth";
  } else {
    return "mature";
  }
}

export async function getIncentivePolicy(cityId: string): Promise<IncentivePolicy> {
  const phase = await getCityPhase(cityId);
  const basePolicy = phasePolicies[phase];
  
  return {
    cityId,
    phase,
    signupBonusEnabled: basePolicy.signupBonusEnabled!,
    signupBonusAmount: basePolicy.signupBonusAmount!,
    signupBonusRidesRequired: basePolicy.signupBonusRidesRequired!,
    referralBonusEnabled: basePolicy.referralBonusEnabled!,
    referralBonusAmount: basePolicy.referralBonusAmount!,
    surgePricingEnabled: basePolicy.surgePricingEnabled!,
    maxSurgeMultiplier: basePolicy.maxSurgeMultiplier!,
    weatherBoostEnabled: basePolicy.weatherBoostEnabled!,
    weatherBoostMultiplier: basePolicy.weatherBoostMultiplier!,
    emergencyBoostEnabled: basePolicy.emergencyBoostEnabled!,
    emergencyBoostMultiplier: basePolicy.emergencyBoostMultiplier!,
    peakHourBoostEnabled: basePolicy.peakHourBoostEnabled!,
    peakHourBoostMultiplier: basePolicy.peakHourBoostMultiplier!,
    updatedAt: new Date()
  };
}

export async function shouldOfferSignupBonus(cityId: string): Promise<{ eligible: boolean; amount: number; ridesRequired: number }> {
  const policy = await getIncentivePolicy(cityId);
  
  return {
    eligible: policy.signupBonusEnabled,
    amount: policy.signupBonusAmount,
    ridesRequired: policy.signupBonusRidesRequired
  };
}

export async function shouldOfferReferralBonus(cityId: string): Promise<{ eligible: boolean; amount: number }> {
  const policy = await getIncentivePolicy(cityId);
  
  return {
    eligible: policy.referralBonusEnabled,
    amount: policy.referralBonusAmount
  };
}

export interface BoostConditions {
  isRaining: boolean;
  isEmergency: boolean;
  isPeakHour: boolean;
  currentDemand: number;
  currentSupply: number;
}

export async function calculateBoostMultiplier(cityId: string, conditions: BoostConditions): Promise<{
  multiplier: number;
  reasons: string[];
  breakdown: { type: string; multiplier: number }[];
}> {
  const policy = await getIncentivePolicy(cityId);
  
  let finalMultiplier = 1.0;
  const reasons: string[] = [];
  const breakdown: { type: string; multiplier: number }[] = [];
  
  if (conditions.isEmergency && policy.emergencyBoostEnabled) {
    finalMultiplier = Math.max(finalMultiplier, policy.emergencyBoostMultiplier);
    reasons.push("Emergency boost active");
    breakdown.push({ type: "emergency", multiplier: policy.emergencyBoostMultiplier });
  }
  
  if (conditions.isRaining && policy.weatherBoostEnabled) {
    const weatherMultiplier = policy.weatherBoostMultiplier;
    if (weatherMultiplier > finalMultiplier) {
      finalMultiplier = weatherMultiplier;
      reasons.push("Weather boost active (rain)");
    }
    breakdown.push({ type: "weather", multiplier: weatherMultiplier });
  }
  
  if (conditions.isPeakHour && policy.peakHourBoostEnabled) {
    const peakMultiplier = policy.peakHourBoostMultiplier;
    if (peakMultiplier > finalMultiplier) {
      finalMultiplier = peakMultiplier;
      reasons.push("Peak hour boost active");
    }
    breakdown.push({ type: "peak_hour", multiplier: peakMultiplier });
  }
  
  if (policy.surgePricingEnabled && conditions.currentDemand > 0 && conditions.currentSupply > 0) {
    const demandSupplyRatio = conditions.currentDemand / conditions.currentSupply;
    if (demandSupplyRatio > 1.5) {
      const surgeMultiplier = Math.min(
        1 + (demandSupplyRatio - 1) * 0.3,
        policy.maxSurgeMultiplier
      );
      if (surgeMultiplier > finalMultiplier) {
        finalMultiplier = surgeMultiplier;
        reasons.push(`Surge pricing (${Math.round(demandSupplyRatio * 10) / 10}x demand)`);
      }
      breakdown.push({ type: "surge", multiplier: surgeMultiplier });
    }
  }
  
  finalMultiplier = Math.round(finalMultiplier * 100) / 100;
  
  return {
    multiplier: finalMultiplier,
    reasons,
    breakdown
  };
}

export async function checkPhaseTransition(cityId: string): Promise<{
  currentPhase: IncentivePolicy["phase"];
  shouldTransition: boolean;
  nextPhase: IncentivePolicy["phase"] | null;
  requirements: {
    met: boolean;
    activeDrivers: { current: number; required: number };
    dailyRides: { current: number; required: number };
    daysActive: { current: number; required: number };
  } | null;
}> {
  const currentPhase = await getCityPhase(cityId);
  const city = getCityDataCached(cityId);
  
  if (!city || currentPhase === "mature") {
    return {
      currentPhase,
      shouldTransition: false,
      nextPhase: null,
      requirements: null
    };
  }
  
  const activeDrivers = await getActiveDriverCountForCity(cityId);
  const dailyRides = await getDailyRideCountForCity(cityId);
  const daysActive = city.launchedAt 
    ? Math.floor((Date.now() - city.launchedAt.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  
  const thresholds = currentPhase === "seeding" 
    ? defaultThresholds.seedingToGrowth 
    : defaultThresholds.growthToMature;
  
  const nextPhase = currentPhase === "seeding" ? "growth" : "mature";
  
  const driversMet = activeDrivers >= thresholds.minActiveDrivers;
  const ridesMet = dailyRides >= thresholds.minDailyRides;
  const daysMet = daysActive >= thresholds.minDaysActive;
  
  const shouldTransition = driversMet && ridesMet && daysMet;
  
  return {
    currentPhase,
    shouldTransition,
    nextPhase: shouldTransition ? nextPhase : null,
    requirements: {
      met: shouldTransition,
      activeDrivers: { current: activeDrivers, required: thresholds.minActiveDrivers },
      dailyRides: { current: dailyRides, required: thresholds.minDailyRides },
      daysActive: { current: daysActive, required: thresholds.minDaysActive }
    }
  };
}

export async function getPhaseThresholds(): Promise<PhaseThresholds> {
  return defaultThresholds;
}

export async function getPolicyExplanation(cityId: string): Promise<{
  phase: string;
  phaseName: string;
  description: string;
  incentives: {
    name: string;
    enabled: boolean;
    value: string;
    reason: string;
  }[];
  nextPhase: string | null;
  transitionCriteria: string[];
}> {
  const policy = await getIncentivePolicy(cityId);
  const transition = await checkPhaseTransition(cityId);
  
  const phaseNames: Record<IncentivePolicy["phase"], string> = {
    seeding: "Launch Phase",
    growth: "Growth Phase",
    mature: "Established Market"
  };
  
  const phaseDescriptions: Record<IncentivePolicy["phase"], string> = {
    seeding: "Building driver supply with signup bonuses. Only weather/emergency boosts apply.",
    growth: "Scaling operations with referral programs. Surge pricing activated.",
    mature: "Stable market with full pricing dynamics. Driver supply is self-sustaining."
  };
  
  const incentives = [
    {
      name: "Driver Signup Bonus",
      enabled: policy.signupBonusEnabled,
      value: policy.signupBonusEnabled ? `${policy.signupBonusAmount} after ${policy.signupBonusRidesRequired} rides` : "Disabled",
      reason: policy.signupBonusEnabled 
        ? "Active during launch to attract early drivers" 
        : "Auto-disabled after seeding phase"
    },
    {
      name: "Referral Bonus",
      enabled: policy.referralBonusEnabled,
      value: policy.referralBonusEnabled ? `${policy.referralBonusAmount} per referral` : "Disabled",
      reason: policy.referralBonusEnabled 
        ? "Active to grow driver network organically" 
        : "Disabled in mature markets"
    },
    {
      name: "Weather Boost",
      enabled: policy.weatherBoostEnabled,
      value: `${Math.round((policy.weatherBoostMultiplier - 1) * 100)}% boost`,
      reason: "Always active to incentivize driving in bad weather"
    },
    {
      name: "Emergency Boost",
      enabled: policy.emergencyBoostEnabled,
      value: `${Math.round((policy.emergencyBoostMultiplier - 1) * 100)}% boost`,
      reason: "Always active for critical situations"
    },
    {
      name: "Peak Hour Boost",
      enabled: policy.peakHourBoostEnabled,
      value: policy.peakHourBoostEnabled ? `${Math.round((policy.peakHourBoostMultiplier - 1) * 100)}% boost` : "Disabled",
      reason: policy.peakHourBoostEnabled 
        ? "Active to balance supply during rush hours" 
        : "Disabled during launch phase"
    },
    {
      name: "Surge Pricing",
      enabled: policy.surgePricingEnabled,
      value: policy.surgePricingEnabled ? `Up to ${policy.maxSurgeMultiplier}x` : "Disabled",
      reason: policy.surgePricingEnabled 
        ? "Dynamic pricing based on demand" 
        : "Disabled during launch for predictable pricing"
    }
  ];
  
  const transitionCriteria = transition.requirements ? [
    `${transition.requirements.activeDrivers.current}/${transition.requirements.activeDrivers.required} active drivers`,
    `${transition.requirements.dailyRides.current}/${transition.requirements.dailyRides.required} daily rides`,
    `${transition.requirements.daysActive.current}/${transition.requirements.daysActive.required} days active`
  ] : [];
  
  return {
    phase: policy.phase,
    phaseName: phaseNames[policy.phase],
    description: phaseDescriptions[policy.phase],
    incentives,
    nextPhase: transition.nextPhase,
    transitionCriteria
  };
}
