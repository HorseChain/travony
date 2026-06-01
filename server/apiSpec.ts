export const apiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Travony Mobility Network API",
    version: "1.0.0",
    description: `## The Travony Partner API

Travony is an intelligent mobility network that transforms private vehicles — especially EVs — into programmable economic assets.

**This API enables:**
- EV manufacturers and car brands to onboard entire fleets in minutes
- Fleet operators to dispatch, monitor, and earn from their vehicles
- Third-party apps to embed ride-hailing, EV hub intelligence, and blockchain-verified trip records

**Base URL:** \`https://api.travony.app/api\`

**Authentication:**
- **User sessions:** Pass \`Authorization: Bearer <session_token>\` after OTP login
- **B2B partners:** Pass \`X-API-Key: tvny_live_xxxx\` (request a key at /developer)

**10% Platform Commission** — Travony takes 10% per ride. The rest goes to the driver/fleet.`,
    contact: {
      name: "Travony Developer Relations",
      url: "https://travony.app/developer",
      email: "api@travony.app",
    },
    license: {
      name: "Proprietary",
      url: "https://travony.app/terms",
    },
  },
  servers: [
    {
      url: "/api",
      description: "Current server",
    },
    {
      url: "https://api.travony.app/api",
      description: "Production",
    },
  ],
  tags: [
    { name: "Authentication", description: "OTP phone login and session management" },
    { name: "Rides", description: "Request, track, and complete rides" },
    { name: "Drivers", description: "Driver status, location, earnings, and documents" },
    { name: "Fleet", description: "Fleet owner dashboard — multi-vehicle management" },
    { name: "EV Hubs (OpenClaw)", description: "EV charging hub network — check-in, staging, demand signals" },
    { name: "Vehicles", description: "Register and verify vehicles (including EVs)" },
    { name: "Wallet & Payments", description: "Wallet top-up, driver payouts, payment records" },
    { name: "Blockchain", description: "Immutable ride verification on Polygon Amoy Testnet" },
    { name: "AI & Pricing", description: "AI-powered matching and dynamic fare calculation" },
    { name: "Coffee", description: "Coffee ordering service at mobility hubs" },
    { name: "B2B API Keys", description: "Manage partner API keys for programmatic access" },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "session_token",
        description: "Session token obtained from /api/auth/verify-otp",
      },
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "X-API-Key",
        description: "B2B partner API key. Format: tvny_live_xxxx. Request at /developer",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string", example: "Unauthorized" },
          code: { type: "string", example: "AUTH_REQUIRED" },
          message: { type: "string", example: "Valid session token required" },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", example: "Ahmed Al Rashid" },
          email: { type: "string", format: "email" },
          phone: { type: "string", example: "+971501234567" },
          role: { type: "string", enum: ["customer", "driver", "fleet_owner", "admin"] },
          walletBalance: { type: "string", example: "250.00" },
          regionCode: { type: "string", example: "AE" },
        },
      },
      Driver: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          status: { type: "string", enum: ["pending", "approved", "rejected", "suspended"] },
          isOnline: { type: "boolean" },
          currentLat: { type: "string", example: "25.2048" },
          currentLng: { type: "string", example: "55.2708" },
          rating: { type: "string", example: "4.92" },
          totalTrips: { type: "integer", example: 234 },
          walletBalance: { type: "string", example: "1240.50" },
          fleetOwnerId: { type: "string", nullable: true },
        },
      },
      Vehicle: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          driverId: { type: "string", format: "uuid" },
          make: { type: "string", example: "BYD" },
          model: { type: "string", example: "Atto 3" },
          year: { type: "integer", example: 2024 },
          plateNumber: { type: "string", example: "DXB-A-12345" },
          isElectric: { type: "boolean", example: true },
          type: {
            type: "string",
            enum: ["economy", "comfort", "premium", "xl", "suv", "minivan"],
          },
          verificationStatus: {
            type: "string",
            enum: ["pending", "ai_verified", "admin_verified", "rejected"],
          },
          aiConditionScore: { type: "integer", example: 8, description: "AI condition score out of 10. Must be >= 6 to pass." },
        },
      },
      Ride: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          riderId: { type: "string", format: "uuid" },
          driverId: { type: "string", format: "uuid", nullable: true },
          status: {
            type: "string",
            enum: ["pending", "accepted", "arriving", "started", "in_progress", "completed", "cancelled"],
          },
          pickupAddress: { type: "string", example: "Dubai Mall, Dubai" },
          dropoffAddress: { type: "string", example: "Dubai Airport T3, Dubai" },
          pickupLat: { type: "string", example: "25.1972" },
          pickupLng: { type: "string", example: "55.2796" },
          dropoffLat: { type: "string", example: "25.2532" },
          dropoffLng: { type: "string", example: "55.3657" },
          fare: { type: "string", example: "32.50" },
          currency: { type: "string", example: "AED" },
          paymentMethod: { type: "string", enum: ["card", "cash", "wallet", "usdt"] },
          evPreferred: { type: "boolean", example: true, description: "Rider requests an EV vehicle" },
          blockchainHash: { type: "string", nullable: true, description: "Polygon Amoy TX hash after ride completion" },
        },
      },
      Hub: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", example: "Dubai Mall EV Hub" },
          city: { type: "string", example: "Dubai" },
          country: { type: "string", example: "UAE" },
          lat: { type: "string" },
          lng: { type: "string" },
          isEvHub: { type: "boolean" },
          totalChargingPorts: { type: "integer", example: 12 },
          availablePorts: { type: "integer", example: 4 },
          activeDrivers: { type: "integer", example: 8 },
          demandScore: { type: "number", example: 87.5 },
        },
      },
      ApiKey: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", example: "BYD Fleet Integration" },
          keyPrefix: { type: "string", example: "tvny_live_ab12" },
          scopes: {
            type: "array",
            items: { type: "string" },
            example: ["fleet:read", "fleet:write", "ev-hubs:read", "rides:read"],
          },
          isActive: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          lastUsedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
    },
  },
  security: [{ BearerAuth: [] }],
  paths: {
    "/auth/send-otp": {
      post: {
        tags: ["Authentication"],
        summary: "Send OTP to phone number",
        description: "Sends a 6-digit SMS verification code via Twilio. Works for both new and existing users.",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["phone"],
                properties: {
                  phone: { type: "string", example: "+971501234567" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "OTP sent successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    message: { type: "string", example: "OTP sent" },
                  },
                },
              },
            },
          },
          "400": { description: "Invalid phone number", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/auth/verify-otp": {
      post: {
        tags: ["Authentication"],
        summary: "Verify OTP and get session token",
        description: "Verifies the OTP. Returns a session token and user profile. Use the token as `Authorization: Bearer <token>` for all subsequent requests.",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["phone", "code"],
                properties: {
                  phone: { type: "string", example: "+971501234567" },
                  code: { type: "string", example: "123456" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "OTP verified — session token returned",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    token: { type: "string", example: "abc123def456..." },
                    user: { $ref: "#/components/schemas/User" },
                    isNewUser: { type: "boolean" },
                  },
                },
              },
            },
          },
          "401": { description: "Invalid or expired OTP" },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Authentication"],
        summary: "Get current user profile",
        description: "Returns the authenticated user's full profile including role and wallet balance.",
        responses: {
          "200": { description: "User profile", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
          "401": { description: "Not authenticated" },
        },
      },
    },
    "/auth/complete-registration": {
      post: {
        tags: ["Authentication"],
        summary: "Complete registration for new user or driver",
        description: "Called after OTP verification for new users. Set `role: 'driver'` or `role: 'fleet_owner'` to register as a partner.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email"],
                properties: {
                  name: { type: "string", example: "Ahmed Al Rashid" },
                  email: { type: "string", format: "email" },
                  role: { type: "string", enum: ["customer", "driver", "fleet_owner"], default: "customer" },
                  regionCode: { type: "string", example: "AE", description: "ISO 3166-1 alpha-2 country code" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Registration complete", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
        },
      },
    },
    "/rides": {
      get: {
        tags: ["Rides"],
        summary: "List rides for current user",
        description: "Returns ride history. Drivers see rides they served. Riders see rides they took.",
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["pending", "accepted", "completed", "cancelled"] } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: {
          "200": { description: "Ride list", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Ride" } } } } },
        },
      },
      post: {
        tags: ["Rides"],
        summary: "Request a new ride",
        description: "Creates a ride request. The AI engine matches the nearest suitable driver. Set `evPreferred: true` to request an EV vehicle specifically.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["pickupLat", "pickupLng", "dropoffLat", "dropoffLng", "pickupAddress", "dropoffAddress", "paymentMethod"],
                properties: {
                  pickupLat: { type: "number", example: 25.2048 },
                  pickupLng: { type: "number", example: 55.2708 },
                  dropoffLat: { type: "number", example: 25.1972 },
                  dropoffLng: { type: "number", example: 55.2796 },
                  pickupAddress: { type: "string", example: "DIFC, Dubai" },
                  dropoffAddress: { type: "string", example: "Dubai Mall, Dubai" },
                  paymentMethod: { type: "string", enum: ["card", "cash", "wallet", "usdt"] },
                  vehicleType: { type: "string", enum: ["economy", "comfort", "premium", "xl", "suv"] },
                  evPreferred: { type: "boolean", default: false, description: "Request EV vehicle specifically" },
                  ridePriority: { type: "string", enum: ["fastest", "cheapest", "reliable"] },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Ride created", content: { "application/json": { schema: { $ref: "#/components/schemas/Ride" } } } },
          "400": { description: "Invalid request" },
        },
      },
    },
    "/rides/{id}": {
      get: {
        tags: ["Rides"],
        summary: "Get ride details",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Ride details", content: { "application/json": { schema: { $ref: "#/components/schemas/Ride" } } } },
          "404": { description: "Ride not found" },
        },
      },
      patch: {
        tags: ["Rides"],
        summary: "Update ride status",
        description: "Drivers use this to move a ride through its lifecycle: accepted → arriving → started → completed.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: { type: "string", enum: ["accepted", "arriving", "started", "in_progress", "completed", "cancelled"] },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Ride updated", content: { "application/json": { schema: { $ref: "#/components/schemas/Ride" } } } },
        },
      },
    },
    "/rides/{id}/telemetry": {
      post: {
        tags: ["Rides"],
        summary: "Submit ride telemetry",
        description: "Send GPS/speed/heading data during a ride. Used for blockchain transparency records and dispute resolution.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  lat: { type: "number" },
                  lng: { type: "number" },
                  speed: { type: "number", description: "km/h" },
                  heading: { type: "number", description: "degrees 0-360" },
                  timestamp: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Telemetry recorded" } },
      },
    },
    "/ai/calculate-price": {
      post: {
        tags: ["AI & Pricing"],
        summary: "Calculate dynamic fare estimate",
        description: "Returns an AI-calculated fare based on distance, time-of-day, demand, vehicle type, and city surge multipliers.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["pickupLat", "pickupLng", "dropoffLat", "dropoffLng"],
                properties: {
                  pickupLat: { type: "number" },
                  pickupLng: { type: "number" },
                  dropoffLat: { type: "number" },
                  dropoffLng: { type: "number" },
                  vehicleType: { type: "string", enum: ["economy", "comfort", "premium", "xl"] },
                  regionCode: { type: "string", example: "AE" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Fare estimate",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    estimatedFare: { type: "string", example: "34.50" },
                    currency: { type: "string", example: "AED" },
                    distanceKm: { type: "number", example: 12.4 },
                    durationMinutes: { type: "number", example: 18 },
                    surgeMultiplier: { type: "number", example: 1.2 },
                    driverEarnings: { type: "string", example: "31.05", description: "After 10% platform fee" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/ai/optimal-match": {
      post: {
        tags: ["AI & Pricing"],
        summary: "Find best driver match",
        description: "Uses intent vectors, proximity, and driver performance history to recommend the optimal driver for a ride.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  pickupLat: { type: "number" },
                  pickupLng: { type: "number" },
                  vehicleType: { type: "string" },
                  evPreferred: { type: "boolean" },
                  ridePriority: { type: "string", enum: ["fastest", "cheapest", "reliable"] },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Matched driver list with scores" } },
      },
    },
    "/drivers/me": {
      get: {
        tags: ["Drivers"],
        summary: "Get current driver profile",
        responses: {
          "200": { description: "Driver profile", content: { "application/json": { schema: { $ref: "#/components/schemas/Driver" } } } },
        },
      },
    },
    "/drivers/status": {
      patch: {
        tags: ["Drivers"],
        summary: "Toggle driver online/offline",
        description: "Set the driver available (online) or unavailable (offline) for ride dispatch.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["isOnline"],
                properties: { isOnline: { type: "boolean", example: true } },
              },
            },
          },
        },
        responses: { "200": { description: "Status updated" } },
      },
    },
    "/drivers/{id}/location": {
      post: {
        tags: ["Drivers"],
        summary: "Update driver GPS location",
        description: "Called by the driver app (or vehicle system) every few seconds to update the driver's position on the dispatch map.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["lat", "lng"],
                properties: {
                  lat: { type: "number", example: 25.2048 },
                  lng: { type: "number", example: 55.2708 },
                  heading: { type: "number", example: 270, description: "Direction of travel in degrees" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Location updated" } },
      },
    },
    "/drivers/earnings": {
      get: {
        tags: ["Drivers"],
        summary: "Get driver earnings breakdown",
        description: "Returns daily, weekly, and monthly earnings with per-ride breakdown and pending payouts.",
        parameters: [
          { name: "period", in: "query", schema: { type: "string", enum: ["day", "week", "month"], default: "week" } },
        ],
        responses: {
          "200": {
            description: "Earnings data",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    totalEarnings: { type: "string", example: "2340.00" },
                    platformFee: { type: "string", example: "260.00" },
                    netEarnings: { type: "string", example: "2080.00" },
                    totalRides: { type: "integer", example: 47 },
                    currency: { type: "string", example: "AED" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/fleet/dashboard/hubs": {
      get: {
        tags: ["Fleet"],
        summary: "Get all hubs with live EV status",
        description: "Returns all network hubs with real-time driver counts, EV port availability, and demand signals. Ideal for fleet routing decisions.",
        security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
        responses: {
          "200": {
            description: "Hub list with EV data",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Hub" } } } },
          },
        },
      },
    },
    "/fleet/dashboard/vehicles": {
      get: {
        tags: ["Fleet"],
        summary: "List all fleet vehicles with live positions",
        description: "Returns all vehicles belonging to the fleet owner with their current GPS position, driver, and status.",
        security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
        responses: {
          "200": {
            description: "Vehicle fleet list",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Vehicle" } } } },
          },
        },
      },
    },
    "/fleet/dashboard/demand": {
      get: {
        tags: ["Fleet"],
        summary: "Get demand heatmap data",
        description: "Returns aggregated demand signals across the city — useful for deciding where to deploy vehicles.",
        security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
        responses: { "200": { description: "Demand signals by zone" } },
      },
    },
    "/fleet/dashboard/dispatch-suggestions": {
      get: {
        tags: ["Fleet"],
        summary: "Get AI dispatch suggestions",
        description: "Returns the top hubs with the largest supply/demand gap — tells you exactly where to send your vehicles next.",
        security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
        responses: { "200": { description: "Dispatch suggestions list" } },
      },
    },
    "/openclaw/hubs": {
      get: {
        tags: ["EV Hubs (OpenClaw)"],
        summary: "Get nearby hubs",
        description: "Returns hubs near a given coordinate. If no hubs are nearby, use /browse for the full network.",
        parameters: [
          { name: "lat", in: "query", schema: { type: "number" }, example: 25.2048 },
          { name: "lng", in: "query", schema: { type: "number" }, example: 55.2708 },
          { name: "radiusKm", in: "query", schema: { type: "number", default: 10 } },
        ],
        responses: {
          "200": { description: "Hub list", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Hub" } } } } },
        },
      },
    },
    "/openclaw/hubs/browse": {
      get: {
        tags: ["EV Hubs (OpenClaw)"],
        summary: "Browse all 44 hubs across the network",
        description: "Returns all hubs grouped by country and city. Covers UAE, KSA, Kuwait, and Bahrain.",
        responses: {
          "200": { description: "Full hub network grouped by country/city" },
        },
      },
    },
    "/openclaw/hubs/ev-hubs": {
      get: {
        tags: ["EV Hubs (OpenClaw)"],
        summary: "List EV-designated charging hubs",
        description: "Returns only hubs with EV charging infrastructure — includes port counts and real-time availability.",
        responses: {
          "200": { description: "EV hub list", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Hub" } } } } },
        },
      },
    },
    "/openclaw/hubs/{hubId}/ev-status": {
      get: {
        tags: ["EV Hubs (OpenClaw)"],
        summary: "Get live EV status for a specific hub",
        description: "Returns port availability, vehicles currently charging, and staging queue (charging → ready → departing).",
        parameters: [{ name: "hubId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "EV hub status",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    hubId: { type: "string" },
                    totalPorts: { type: "integer", example: 12 },
                    availablePorts: { type: "integer", example: 4 },
                    chargingDrivers: { type: "integer", example: 5 },
                    readyDrivers: { type: "integer", example: 3 },
                    departingDrivers: { type: "integer", example: 0 },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/openclaw/hubs/{hubId}/check-in": {
      post: {
        tags: ["EV Hubs (OpenClaw)"],
        summary: "Driver check-in to a hub",
        description: "Registers a driver's presence at a hub. For EVs, triggers the staging modal (charging/ready/departing).",
        parameters: [{ name: "hubId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  evStagingStatus: { type: "string", enum: ["charging", "ready", "departing"], description: "EV drivers only" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Check-in successful" } },
      },
    },
    "/openclaw/hubs/{hubId}/check-out": {
      post: {
        tags: ["EV Hubs (OpenClaw)"],
        summary: "Driver check-out from a hub",
        parameters: [{ name: "hubId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Check-out successful" } },
      },
    },
    "/openclaw/ev-demand-signals": {
      get: {
        tags: ["EV Hubs (OpenClaw)"],
        summary: "Get EV demand signals",
        description: "Returns aggregated EV ride demand data — how many riders requested EVs, by zone and time. Use this to plan charging schedules and fleet deployment.",
        security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
        responses: { "200": { description: "EV demand signals by zone and time" } },
      },
      post: {
        tags: ["EV Hubs (OpenClaw)"],
        summary: "Log an EV demand signal",
        description: "Called automatically when a rider selects EV-preferred. Can also be called by third-party apps to signal EV demand.",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  lat: { type: "number" },
                  lng: { type: "number" },
                  regionCode: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Signal logged" } },
      },
    },
    "/openclaw/fleet/ev-staging": {
      get: {
        tags: ["EV Hubs (OpenClaw)"],
        summary: "Get EV staging status across all hubs",
        description: "Fleet-level view: which EVs are charging, which are ready to dispatch, which are departing — across all hubs.",
        security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
        responses: { "200": { description: "Fleet-wide EV staging status" } },
      },
    },
    "/vehicles": {
      post: {
        tags: ["Vehicles"],
        summary: "Register a vehicle",
        description: "Add a vehicle to the network. Set `isElectric: true` for EVs. After registration, upload photos for AI verification.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["make", "model", "plateNumber", "type"],
                properties: {
                  make: { type: "string", example: "BYD" },
                  model: { type: "string", example: "Han EV" },
                  year: { type: "integer", example: 2024 },
                  color: { type: "string", example: "White" },
                  plateNumber: { type: "string", example: "DXB-A-12345" },
                  type: { type: "string", enum: ["economy", "comfort", "premium", "xl", "suv"] },
                  isElectric: { type: "boolean", example: true },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Vehicle registered", content: { "application/json": { schema: { $ref: "#/components/schemas/Vehicle" } } } },
        },
      },
    },
    "/vehicles/verify": {
      post: {
        tags: ["Vehicles"],
        summary: "Submit vehicle photos for AI verification",
        description: "Upload front, side, and interior photos. GPT-4o Vision analyzes the vehicle and assigns a condition score (1–10). Score >= 6 passes automatically.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["vehicleId", "photoFront", "photoSide", "photoInterior"],
                properties: {
                  vehicleId: { type: "string" },
                  photoFront: { type: "string", description: "Base64 encoded image or URL" },
                  photoSide: { type: "string" },
                  photoInterior: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Verification result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    verificationStatus: { type: "string", enum: ["ai_verified", "rejected"] },
                    conditionScore: { type: "integer", example: 8 },
                    issues: { type: "array", items: { type: "string" }, example: ["Minor scratch on door"] },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/wallet/balance/{userId}": {
      get: {
        tags: ["Wallet & Payments"],
        summary: "Get wallet balance",
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Wallet balance",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    balance: { type: "string", example: "250.00" },
                    currency: { type: "string", example: "AED" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/wallet/topup": {
      post: {
        tags: ["Wallet & Payments"],
        summary: "Top up user wallet",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["amount", "currency"],
                properties: {
                  amount: { type: "number", example: 100 },
                  currency: { type: "string", example: "AED" },
                  paymentMethod: { type: "string", enum: ["card", "usdt"] },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Top-up initiated" } },
      },
    },
    "/drivers/{driverId}/withdraw": {
      post: {
        tags: ["Wallet & Payments"],
        summary: "Request driver payout",
        description: "Driver requests withdrawal of their wallet balance to bank or crypto wallet.",
        parameters: [{ name: "driverId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["amount", "method"],
                properties: {
                  amount: { type: "number", example: 500 },
                  method: { type: "string", enum: ["bank", "crypto"] },
                  cryptoWalletAddress: { type: "string", description: "Required if method is crypto" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Withdrawal initiated" } },
      },
    },
    "/blockchain/status": {
      get: {
        tags: ["Blockchain"],
        summary: "Get blockchain connection status",
        description: "Returns connection status to Polygon Amoy Testnet and the smart contract address used for ride verification.",
        security: [],
        responses: {
          "200": {
            description: "Blockchain status",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    connected: { type: "boolean" },
                    network: { type: "string", example: "Polygon Amoy Testnet" },
                    contractAddress: { type: "string", example: "0x1234...abcd" },
                    latestBlock: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/blockchain/verify/{rideHash}": {
      get: {
        tags: ["Blockchain"],
        summary: "Verify a ride on the blockchain",
        description: "Public endpoint — no auth required. Verifies a ride's integrity using its blockchain hash. Returns the original fare, distance, and driver identity.",
        security: [],
        parameters: [{ name: "rideHash", in: "path", required: true, schema: { type: "string" }, description: "Transaction hash from ride completion" }],
        responses: {
          "200": {
            description: "Ride verification result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    verified: { type: "boolean" },
                    rideId: { type: "string" },
                    fare: { type: "string" },
                    distanceKm: { type: "number" },
                    timestamp: { type: "string", format: "date-time" },
                    tampered: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/coffee/menu": {
      get: {
        tags: ["Coffee"],
        summary: "Get coffee menu",
        description: "Returns available drinks at mobility hubs — includes Gulf-region specialties (Karak Tea, Arabic Coffee, Turkish Coffee).",
        security: [],
        responses: { "200": { description: "Menu items list" } },
      },
    },
    "/coffee/orders": {
      get: {
        tags: ["Coffee"],
        summary: "List coffee orders",
        responses: { "200": { description: "Orders list" } },
      },
      post: {
        tags: ["Coffee"],
        summary: "Place a coffee order",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["menuItemId", "hubId", "mode"],
                properties: {
                  menuItemId: { type: "string" },
                  hubId: { type: "string" },
                  mode: { type: "string", enum: ["delivery", "pickup", "gift"], description: "delivery=bring to me, pickup=I collect, gift=send to someone" },
                  quantity: { type: "integer", default: 1 },
                  giftRecipientPhone: { type: "string", description: "Required if mode is gift" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Order placed" } },
      },
    },
    "/api-keys": {
      get: {
        tags: ["B2B API Keys"],
        summary: "List your API keys",
        description: "Returns all API keys for the authenticated fleet owner or admin account.",
        responses: {
          "200": {
            description: "API keys list",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/ApiKey" } } } },
          },
        },
      },
      post: {
        tags: ["B2B API Keys"],
        summary: "Create a new API key",
        description: "Generate a B2B API key for programmatic access. The full key is only shown once — save it securely.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "scopes"],
                properties: {
                  name: { type: "string", example: "BYD Fleet Integration" },
                  scopes: {
                    type: "array",
                    items: { type: "string", enum: ["fleet:read", "fleet:write", "ev-hubs:read", "rides:read", "rides:write", "drivers:read", "demand:read"] },
                    example: ["fleet:read", "ev-hubs:read", "demand:read"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "API key created — full key shown only once",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    key: { type: "string", example: "tvny_live_ab12cd34ef56gh78ij90kl12mn34op56" },
                    id: { type: "string" },
                    name: { type: "string" },
                    scopes: { type: "array", items: { type: "string" } },
                    warning: { type: "string", example: "Store this key securely — it will not be shown again." },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api-keys/{id}": {
      delete: {
        tags: ["B2B API Keys"],
        summary: "Revoke an API key",
        description: "Permanently deactivates an API key. This cannot be undone.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Key revoked" } },
      },
    },
  },
};
