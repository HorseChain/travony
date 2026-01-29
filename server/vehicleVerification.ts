import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export type VehicleCategory = 
  | "motorcycle" 
  | "auto_rickshaw" 
  | "cng" 
  | "tuktuk" 
  | "economy_car" 
  | "comfort_car" 
  | "premium_car" 
  | "suv" 
  | "minivan" 
  | "minibus"
  | "unknown";

export interface VehicleVerificationResult {
  isValid: boolean;
  category: VehicleCategory;
  confidence: number;
  make?: string;
  model?: string;
  color?: string;
  year?: number;
  passengerCapacity: number;
  licensePlateVisible: boolean;
  conditionScore: number;
  issues: string[];
  details: string;
}

const VEHICLE_CATEGORIES = {
  motorcycle: {
    names: ["motorcycle", "bike", "motorbike", "scooter", "moped", "two-wheeler"],
    capacity: 1,
    description: "Two-wheeled motorized vehicle"
  },
  auto_rickshaw: {
    names: ["auto rickshaw", "auto-rickshaw", "three-wheeler", "tuk-tuk", "bajaj", "tempo"],
    capacity: 3,
    description: "Three-wheeled passenger vehicle common in South Asia"
  },
  cng: {
    names: ["cng auto", "cng rickshaw", "green rickshaw", "baby taxi"],
    capacity: 3,
    description: "CNG-powered three-wheeler, common in Bangladesh"
  },
  tuktuk: {
    names: ["tuk tuk", "tuktuk", "three wheeler taxi"],
    capacity: 3,
    description: "Motorized rickshaw for short-distance transport"
  },
  economy_car: {
    names: ["sedan", "hatchback", "compact car", "economy car", "small car"],
    capacity: 4,
    description: "Standard 4-door car for budget rides"
  },
  comfort_car: {
    names: ["midsize sedan", "toyota corolla", "honda civic", "camry", "accord"],
    capacity: 4,
    description: "Mid-range comfortable sedan"
  },
  premium_car: {
    names: ["luxury car", "bmw", "mercedes", "audi", "lexus", "premium sedan"],
    capacity: 4,
    description: "High-end luxury vehicle"
  },
  suv: {
    names: ["suv", "crossover", "jeep", "land cruiser", "fortuner"],
    capacity: 6,
    description: "Sport utility vehicle with more space"
  },
  minivan: {
    names: ["minivan", "mpv", "van", "innova", "hiace"],
    capacity: 7,
    description: "Multi-purpose vehicle for families"
  },
  minibus: {
    names: ["minibus", "microbus", "tempo traveller", "coaster"],
    capacity: 12,
    description: "Small bus for group transport"
  }
};

export async function verifyVehicleImage(
  imageUrl: string,
  regionCode: string = "BD"
): Promise<VehicleVerificationResult> {
  const regionContext = getRegionContext(regionCode);
  
  const systemPrompt = `You are an expert vehicle verification system for a ride-hailing platform operating in ${regionContext.country}. 
Your job is to analyze vehicle photos and classify them accurately.

Common vehicle types in ${regionContext.country}:
${regionContext.vehicleTypes.join("\n")}

Analyze the image and provide:
1. Vehicle category (one of: motorcycle, auto_rickshaw, cng, tuktuk, economy_car, comfort_car, premium_car, suv, minivan, minibus, unknown)
2. Make and model if identifiable
3. Approximate year
4. Color
5. Estimated passenger capacity
6. Whether the license plate is visible and legible
7. Vehicle condition score (1-10)
8. Any issues that would make it unsuitable for passenger transport

Be strict about safety - flag any visible damage, missing parts, or unsafe conditions.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: "Analyze this vehicle image for our ride-hailing platform. Provide your analysis in JSON format." },
          { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
        ]
      }
    ],
    response_format: { type: "json_object" },
    max_tokens: 1000
  });

  const analysisText = response.choices[0]?.message?.content || "{}";
  
  try {
    const analysis = JSON.parse(analysisText);
    
    return {
      isValid: analysis.isValid ?? (analysis.conditionScore >= 6 && !analysis.issues?.length),
      category: normalizeCategory(analysis.category || analysis.vehicleType || "unknown"),
      confidence: analysis.confidence || 0.8,
      make: analysis.make,
      model: analysis.model,
      color: analysis.color,
      year: analysis.year,
      passengerCapacity: analysis.passengerCapacity || VEHICLE_CATEGORIES[analysis.category as keyof typeof VEHICLE_CATEGORIES]?.capacity || 4,
      licensePlateVisible: analysis.licensePlateVisible ?? false,
      conditionScore: analysis.conditionScore || 5,
      issues: analysis.issues || [],
      details: analysis.details || analysis.description || "Vehicle analyzed successfully"
    };
  } catch (e) {
    return {
      isValid: false,
      category: "unknown",
      confidence: 0,
      passengerCapacity: 0,
      licensePlateVisible: false,
      conditionScore: 0,
      issues: ["Failed to parse AI response"],
      details: analysisText
    };
  }
}

function normalizeCategory(input: string): VehicleCategory {
  const lowered = input.toLowerCase().replace(/[_-]/g, " ");
  
  for (const [category, data] of Object.entries(VEHICLE_CATEGORIES)) {
    if (data.names.some(name => lowered.includes(name) || name.includes(lowered))) {
      return category as VehicleCategory;
    }
  }
  
  if (lowered.includes("car") || lowered.includes("sedan")) return "economy_car";
  if (lowered.includes("bike") || lowered.includes("motor")) return "motorcycle";
  if (lowered.includes("rickshaw") || lowered.includes("wheeler")) return "auto_rickshaw";
  
  return "unknown";
}

function getRegionContext(regionCode: string): { country: string; vehicleTypes: string[] } {
  const contexts: Record<string, { country: string; vehicleTypes: string[] }> = {
    BD: {
      country: "Bangladesh",
      vehicleTypes: [
        "- CNG Auto-rickshaw (Baby taxi): Green three-wheelers running on compressed natural gas",
        "- Motorcycle: Honda, Bajaj, TVS bikes used for bike taxi services",
        "- Economy Car: Toyota Corolla, Honda City, Suzuki Swift",
        "- Comfort Car: Toyota Camry, Honda Accord",
        "- Minivan: Toyota Hiace, Nissan Urvan for group transport"
      ]
    },
    IN: {
      country: "India",
      vehicleTypes: [
        "- Auto-rickshaw: Yellow/green three-wheelers (Bajaj, Piaggio)",
        "- Motorcycle: Hero, Bajaj, TVS, Royal Enfield bikes",
        "- Economy Car: Maruti Swift, Hyundai i20, Tata Tiago",
        "- Comfort Car: Honda City, Hyundai Verna, Maruti Ciaz",
        "- Premium Car: BMW, Mercedes, Audi",
        "- SUV: Toyota Fortuner, Mahindra Scorpio",
        "- Minivan: Toyota Innova"
      ]
    },
    PK: {
      country: "Pakistan",
      vehicleTypes: [
        "- Rickshaw: Qingqi/Chingchi three-wheelers",
        "- Motorcycle: Honda CD70, CG125, Yamaha bikes",
        "- Economy Car: Suzuki Alto, Toyota Vitz, Honda City",
        "- Comfort Car: Toyota Corolla, Honda Civic",
        "- SUV: Toyota Land Cruiser, Fortuner"
      ]
    },
    AE: {
      country: "UAE",
      vehicleTypes: [
        "- Economy Car: Toyota Yaris, Nissan Sunny",
        "- Comfort Car: Toyota Camry, Nissan Altima",
        "- Premium Car: BMW 5-Series, Mercedes E-Class",
        "- SUV: Toyota Land Cruiser, Nissan Patrol"
      ]
    }
  };
  
  return contexts[regionCode] || contexts["IN"];
}

export async function verifyMultipleVehicleImages(
  imageUrls: string[],
  regionCode: string = "BD"
): Promise<VehicleVerificationResult> {
  if (imageUrls.length === 0) {
    return {
      isValid: false,
      category: "unknown",
      confidence: 0,
      passengerCapacity: 0,
      licensePlateVisible: false,
      conditionScore: 0,
      issues: ["No images provided"],
      details: "At least one vehicle image is required"
    };
  }

  const results = await Promise.all(
    imageUrls.map(url => verifyVehicleImage(url, regionCode))
  );

  const validResults = results.filter(r => r.category !== "unknown");
  
  if (validResults.length === 0) {
    return results[0];
  }

  const categoryCounts = validResults.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const dominantCategory = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])[0][0] as VehicleCategory;

  const matchingResults = validResults.filter(r => r.category === dominantCategory);
  const avgCondition = matchingResults.reduce((sum, r) => sum + r.conditionScore, 0) / matchingResults.length;
  const allIssues = [...new Set(matchingResults.flatMap(r => r.issues))];
  const hasPlate = matchingResults.some(r => r.licensePlateVisible);

  return {
    isValid: avgCondition >= 6 && allIssues.length === 0,
    category: dominantCategory,
    confidence: matchingResults.length / results.length,
    make: matchingResults[0].make,
    model: matchingResults[0].model,
    color: matchingResults[0].color,
    year: matchingResults[0].year,
    passengerCapacity: matchingResults[0].passengerCapacity,
    licensePlateVisible: hasPlate,
    conditionScore: Math.round(avgCondition),
    issues: allIssues,
    details: `Analyzed ${results.length} images. Category: ${dominantCategory} (${Math.round(matchingResults.length / results.length * 100)}% confidence)`
  };
}

export function getVehicleCategoryInfo(category: VehicleCategory) {
  return VEHICLE_CATEGORIES[category as keyof typeof VEHICLE_CATEGORIES] || {
    names: [category],
    capacity: 4,
    description: "Unknown vehicle type"
  };
}
