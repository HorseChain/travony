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

**10% Platform Commission** — Travony takes 10% per ride. The rest goes to the driver/fleet.

## Plans, quotas & rate limits

Every partner key belongs to a plan tier. Each metered call counts against your monthly quota and a per-minute rate limit:

| Plan | Price | Monthly quota | Rate limit |
| --- | --- | --- | --- |
| Free | $0 | 1,000 calls | 30 req/min |
| Starter | $49/mo | 50,000 calls | 120 req/min |
| Growth | $199/mo | 500,000 calls | 600 req/min |

- Exceeding the per-minute rate returns **429** with a \`Retry-After\` header.
- Exceeding the monthly quota returns **429** with code \`QUOTA_EXCEEDED\` — upgrade at /developer.
- Responses include \`X-Quota-Limit\`, \`X-Quota-Remaining\` and \`X-RateLimit-Limit\` headers.
- Check your own consumption any time with \`GET /api/partner/usage\` (send your key).

## Scopes

Keys carry granular scopes (\`resource:action\`): \`fleet:read\`, \`fleet:write\`, \`rides:read\`, \`rides:write\`, \`hubs:read\`, \`pricing:read\`, \`demand:read\`. The legacy \`ev-hubs:read\` alias maps to \`hubs:read\`.`,
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
    { name: "Taxi Mode (Partners)", description: "The simplest API: onboard a car, flip taxi mode on/off, check status. Built for EV brands and fleets. Uses your X-API-Key." },
    { name: "Partner Data API", description: "Metered, scope-gated read access to hubs, pricing, rides and EV demand. Authenticate with X-API-Key. Counts against your plan quota." },
    { name: "Partner Usage & Billing", description: "Inspect your API consumption and manage your plan (Free/Starter/Growth) via Stripe." },
    { name: "Authentication", description: "OTP phone login and session management" },
    { name: "Rides", description: "Request, track, and complete rides" },
    { name: "Drivers", description: "Driver status, location, earnings, and documents" },
    { name: "Fleet", description: "Fleet owner dashboard — multi-vehicle management" },
    { name: "EV Hubs (OpenClaw)", description: "EV charging hub network — check-in, staging, demand signals" },
    { name: "EV Driver", description: "Individual EV driver experience — car connection (Smartcar), live battery, public chargers, range checks" },
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
      Car: {
        type: "object",
        description: "A car onboarded through the Taxi Mode API. `carId` is what you pass to every other call.",
        properties: {
          carId: { type: "string", format: "uuid" },
          taxiMode: { type: "boolean", example: false, description: "true = available for rides, false = private" },
          status: { type: "string", enum: ["pending", "approved", "rejected", "suspended"], example: "approved" },
          owner: {
            type: "object",
            nullable: true,
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string", example: "Ahmed Al Rashid" },
              email: { type: "string", format: "email" },
            },
          },
          vehicle: {
            type: "object",
            properties: {
              make: { type: "string", example: "BYD" },
              model: { type: "string", example: "Atto 3" },
              year: { type: "integer", nullable: true, example: 2024 },
              color: { type: "string", nullable: true, example: "White" },
              plateNumber: { type: "string", example: "DXB-A-12345" },
              isElectric: { type: "boolean", example: true },
              verificationStatus: { type: "string", example: "admin_verified" },
            },
          },
          battery: {
            type: "object",
            nullable: true,
            description: "Only present for electric cars.",
            properties: {
              percent: { type: "integer", nullable: true, example: 78 },
              source: { type: "string", example: "manual", enum: ["manual", "unknown"] },
              updatedAt: { type: "string", format: "date-time", nullable: true },
            },
          },
          stats: {
            type: "object",
            properties: {
              rating: { type: "string", example: "5.00" },
              totalTrips: { type: "integer", example: 0 },
              totalEarnings: { type: "string", example: "0.00" },
            },
          },
          currentRide: {
            type: "object",
            nullable: true,
            description: "The ride this car is on right now, or null.",
            properties: {
              id: { type: "string", format: "uuid" },
              status: { type: "string", example: "started" },
              pickup: { type: "string", example: "Dubai Mall, Dubai" },
              dropoff: { type: "string", example: "Dubai Airport T3, Dubai" },
              fare: { type: "string", nullable: true, example: "32.50" },
            },
          },
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
    "/v1/cars": {
      post: {
        tags: ["Taxi Mode (Partners)"],
        summary: "Onboard a car (Step 1)",
        description:
          "Register a car and its owner in a single call. The car starts in PRIVATE mode — it will not receive rides until you turn taxi mode on. Returns a `carId` you use for every other call. Defaults to electric (isElectric: true).",
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["ownerName", "ownerEmail", "make", "model", "plateNumber"],
                properties: {
                  ownerName: { type: "string", example: "Ahmed Al Rashid" },
                  ownerEmail: { type: "string", format: "email", example: "ahmed@example.com" },
                  ownerPhone: { type: "string", example: "+971501234567" },
                  make: { type: "string", example: "BYD" },
                  model: { type: "string", example: "Atto 3" },
                  plateNumber: { type: "string", example: "DXB-A-12345" },
                  color: { type: "string", example: "White" },
                  year: { type: "integer", example: 2024 },
                  type: { type: "string", enum: ["economy", "comfort", "premium", "xl", "suv", "minivan"], example: "comfort" },
                  isElectric: { type: "boolean", example: true, default: true },
                  batteryCapacityKwh: { type: "number", example: 60.5 },
                  ratedRangeKm: { type: "integer", example: 420 },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Car onboarded (still private)", content: { "application/json": { schema: { $ref: "#/components/schemas/Car" } } } },
          "400": { description: "Missing required fields", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "API key required", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "409": { description: "An owner with this email already exists" },
        },
      },
      get: {
        tags: ["Taxi Mode (Partners)"],
        summary: "List all your cars (Step 3)",
        description: "Returns every car onboarded under your API key, with how many are currently in taxi mode.",
        security: [{ ApiKeyAuth: [] }],
        responses: {
          "200": {
            description: "Your cars",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    count: { type: "integer", example: 3 },
                    online: { type: "integer", example: 1 },
                    cars: { type: "array", items: { $ref: "#/components/schemas/Car" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/v1/cars/{carId}/taxi-mode": {
      post: {
        tags: ["Taxi Mode (Partners)"],
        summary: "Turn taxi mode on or off (Step 2)",
        description:
          "The one switch. Send `{ \"active\": true }` to make the car available for rides, or `{ \"active\": false }` to make it private again. Optionally include the car's current `lat`/`lng`. This is the exact same action the driver app's 'Go Online' switch performs.",
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: "carId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["active"],
                properties: {
                  active: { type: "boolean", example: true },
                  lat: { type: "number", example: 25.2048 },
                  lng: { type: "number", example: 55.2708 },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Taxi mode switched",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    carId: { type: "string", format: "uuid" },
                    taxiMode: { type: "boolean", example: true },
                    message: { type: "string", example: "Taxi mode ON. This car can now receive rides." },
                    since: { type: "string", format: "date-time", nullable: true },
                  },
                },
              },
            },
          },
          "400": { description: "Missing 'active' flag", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Car not found under your API key" },
        },
      },
    },
    "/v1/cars/{carId}": {
      get: {
        tags: ["Taxi Mode (Partners)"],
        summary: "Check one car's status (Step 3)",
        description: "Returns whether the car is in taxi mode, its battery (if electric), lifetime stats, and the ride it is on right now (if any).",
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: "carId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "Car status", content: { "application/json": { schema: { $ref: "#/components/schemas/Car" } } } },
          "404": { description: "Car not found under your API key" },
        },
      },
    },
    "/partner/v1/hubs": {
      get: {
        tags: ["Partner Data API"],
        summary: "List EV charging hubs",
        description: "Returns the active hub network with locations, EV charging port availability and demand scores. Requires the `hubs:read` scope. Metered.",
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: "evOnly", in: "query", required: false, schema: { type: "boolean" }, description: "When true, only return designated EV charging hubs." },
        ],
        responses: {
          "200": { description: "Hub list", content: { "application/json": { schema: { type: "object", properties: { count: { type: "integer" }, hubs: { type: "array", items: { type: "object" } } } } } } },
          "401": { description: "Missing API key" },
          "403": { description: "Key lacks hubs:read scope" },
          "429": { description: "Rate limit or monthly quota exceeded" },
        },
      },
    },
    "/partner/v1/pricing": {
      get: {
        tags: ["Partner Data API"],
        summary: "Get a dynamic fare quote",
        description: "Returns an AI-computed fare breakdown (base, distance, time, demand/time/traffic multipliers, platform fee) for a pickup/dropoff and vehicle type. Requires the `pricing:read` scope. Metered.",
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: "pickupLat", in: "query", required: true, schema: { type: "number" } },
          { name: "pickupLng", in: "query", required: true, schema: { type: "number" } },
          { name: "dropoffLat", in: "query", required: true, schema: { type: "number" } },
          { name: "dropoffLng", in: "query", required: true, schema: { type: "number" } },
          { name: "vehicleType", in: "query", required: false, schema: { type: "string", default: "economy" } },
        ],
        responses: {
          "200": { description: "Fare quote", content: { "application/json": { schema: { type: "object" } } } },
          "400": { description: "Missing coordinates" },
          "401": { description: "Missing API key" },
          "403": { description: "Key lacks pricing:read scope" },
          "429": { description: "Rate limit or monthly quota exceeded" },
        },
      },
    },
    "/partner/v1/rides": {
      get: {
        tags: ["Partner Data API"],
        summary: "List rides for your fleet",
        description: "Returns ride records served by the cars you onboarded under this key (status, fare, blockchain hash). Requires the `rides:read` scope. Metered.",
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: "limit", in: "query", required: false, schema: { type: "integer", default: 50, maximum: 200 } },
          { name: "status", in: "query", required: false, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Ride list", content: { "application/json": { schema: { type: "object", properties: { count: { type: "integer" }, rides: { type: "array", items: { type: "object" } } } } } } },
          "401": { description: "Missing API key" },
          "403": { description: "Key lacks rides:read scope" },
          "429": { description: "Rate limit or monthly quota exceeded" },
        },
      },
    },
    "/partner/v1/ev-demand-signals": {
      get: {
        tags: ["Partner Data API"],
        summary: "EV demand signals",
        description: "Returns recent EV demand signals and the match rate — useful for fleet positioning and city planning. Requires the `demand:read` scope. Metered.",
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: "limit", in: "query", required: false, schema: { type: "integer", default: 100, maximum: 500 } },
        ],
        responses: {
          "200": { description: "Demand signals", content: { "application/json": { schema: { type: "object", properties: { count: { type: "integer" }, matched: { type: "integer" }, matchRate: { type: "integer" }, signals: { type: "array", items: { type: "object" } } } } } } },
          "401": { description: "Missing API key" },
          "403": { description: "Key lacks demand:read scope" },
          "429": { description: "Rate limit or monthly quota exceeded" },
        },
      },
    },
    "/partner/usage": {
      get: {
        tags: ["Partner Usage & Billing"],
        summary: "Check your API usage",
        description: "Returns your current plan, billing period, calls used this month, remaining quota and rate limit. Send your X-API-Key — any valid key works regardless of scope.",
        security: [{ ApiKeyAuth: [] }],
        responses: {
          "200": { description: "Usage summary", content: { "application/json": { schema: { type: "object", properties: { keyId: { type: "string" }, callsThisPeriod: { type: "integer" }, monthlyQuota: { type: "integer" }, remaining: { type: "integer" }, rateLimitPerMin: { type: "integer" } } } } } },
          "401": { description: "Missing API key" },
        },
      },
    },
    "/partner/billing/plans": {
      get: {
        tags: ["Partner Usage & Billing"],
        summary: "List plan tiers",
        description: "Public list of plan tiers (Free/Starter/Growth) with price, monthly quota and rate limit.",
        security: [],
        responses: {
          "200": { description: "Plan list", content: { "application/json": { schema: { type: "object", properties: { plans: { type: "array", items: { type: "object" } } } } } } },
        },
      },
    },
    "/partner/billing/checkout": {
      post: {
        tags: ["Partner Usage & Billing"],
        summary: "Start a plan upgrade (Stripe Checkout)",
        description: "Creates a Stripe Checkout subscription session for a paid tier, tied to one of your API keys. Session-authenticated (Bearer). Returns a `checkoutUrl` to redirect the user to.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["keyId", "tier"], properties: { keyId: { type: "string", format: "uuid" }, tier: { type: "string", enum: ["starter", "growth"] } } } } },
        },
        responses: {
          "200": { description: "Checkout session created", content: { "application/json": { schema: { type: "object", properties: { checkoutUrl: { type: "string" }, sessionId: { type: "string" } } } } } },
          "400": { description: "Invalid tier or free plan requested" },
          "401": { description: "Sign in required" },
          "404": { description: "API key not found" },
        },
      },
    },
    "/partner/billing/cancel": {
      post: {
        tags: ["Partner Usage & Billing"],
        summary: "Downgrade to Free",
        description: "Cancels any active Stripe subscription for the key and drops it back to the Free plan. Session-authenticated (Bearer).",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["keyId"], properties: { keyId: { type: "string", format: "uuid" } } } } },
        },
        responses: {
          "200": { description: "Downgraded to Free" },
          "401": { description: "Sign in required" },
          "404": { description: "API key not found" },
        },
      },
    },
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
    "/ev/connection": {
      get: {
        tags: ["EV Driver"],
        summary: "Get the driver's car connection + best-available battery snapshot",
        description:
          "Returns the current EV car connection state plus the best battery snapshot available, resolved across sources: live (Smartcar) → simulated → manual entry → none. The `source` and `updatedAt` fields tell you how fresh the data is. `liveDataAvailable` reports whether Smartcar credentials are configured on the server.",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Connection + battery snapshot",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    connected: { type: "boolean" },
                    liveDataAvailable: { type: "boolean", description: "True when Smartcar credentials are configured" },
                    source: { type: "string", enum: ["live", "simulated", "stale", "manual", "none"] },
                    status: { type: "string", enum: ["connected", "expired", "error", "disconnected"] },
                    batteryPercent: { type: "integer", nullable: true, example: 64 },
                    rangeKm: { type: "number", nullable: true, example: 210 },
                    isCharging: { type: "boolean" },
                    chargingState: { type: "string", nullable: true, example: "CHARGING" },
                    targetChargePercent: { type: "integer", example: 80 },
                    timeToReadyMinutes: { type: "integer", nullable: true, example: 35 },
                    updatedAt: { type: "string", format: "date-time", nullable: true },
                    provider: { type: "string", nullable: true, example: "smartcar" },
                    isSimulated: { type: "boolean" },
                  },
                },
              },
            },
          },
          "401": { description: "Unauthorized" },
          "404": { description: "Driver profile not found" },
        },
      },
    },
    "/ev/connect": {
      post: {
        tags: ["EV Driver"],
        summary: "Start an EV car connection",
        description:
          "Starts linking the driver's car. When Smartcar credentials are configured the response is `{ mode: 'live', authUrl }` — open `authUrl` so the driver can authorize, then the car is linked via the callback. When no credentials are configured a simulated connection is created immediately and the battery snapshot is returned.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  vehicleId: { type: "string", description: "Optional — defaults to the driver's primary active vehicle" },
                  targetChargePercent: { type: "integer", minimum: 50, maximum: 100, example: 80 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Live auth URL ({ mode:'live', authUrl }) or a simulated connection snapshot" },
          "401": { description: "Unauthorized" },
          "403": { description: "Drivers only" },
        },
      },
    },
    "/ev/connect/callback": {
      get: {
        tags: ["EV Driver"],
        summary: "Smartcar OAuth redirect target (live mode)",
        description:
          "The redirect URI Smartcar calls after the driver authorizes. Exchanges the code for tokens, persists the connection, and returns a small confirmation page. Not called directly by clients.",
        parameters: [
          { name: "code", in: "query", schema: { type: "string" } },
          { name: "state", in: "query", schema: { type: "string" } },
          { name: "error", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "HTML confirmation page" } },
      },
    },
    "/ev/disconnect": {
      post: {
        tags: ["EV Driver"],
        summary: "Disconnect the driver's car",
        description: "Clears stored tokens and marks the connection disconnected. Manual battery entry remains available as a fallback.",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "Disconnected" },
          "401": { description: "Unauthorized" },
          "404": { description: "Driver profile not found" },
        },
      },
    },
    "/ev/refresh": {
      post: {
        tags: ["EV Driver"],
        summary: "Force a fresh battery snapshot",
        description:
          "Pulls a fresh snapshot (refreshing the access token first if needed), persists it, and auto-updates hub staging (charging/ready/departing) unless the driver set staging manually. Degrades to last-known data on failure.",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "Fresh battery snapshot" },
          "401": { description: "Unauthorized" },
          "404": { description: "Driver profile not found" },
        },
      },
    },
    "/ev/manual-battery": {
      post: {
        tags: ["EV Driver"],
        summary: "Set battery level manually (fallback)",
        description: "Manual fallback when no live connection exists. Stores the battery percent on the driver's primary vehicle and derives range from its rated range.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["batteryPercent"],
                properties: { batteryPercent: { type: "integer", minimum: 0, maximum: 100, example: 70 } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Battery saved + refreshed snapshot" },
          "400": { description: "batteryPercent must be 0-100" },
          "401": { description: "Unauthorized" },
          "404": { description: "Driver profile or vehicle not found" },
        },
      },
    },
    "/ev/chargers/nearby": {
      get: {
        tags: ["EV Driver"],
        summary: "Find nearby public chargers (Open Charge Map)",
        description:
          "Proxies Open Charge Map for public charging stations near a location. Results are cached for ~10 minutes. `source` is `live`/`cache` when an `OPENCHARGEMAP_API_KEY` is configured, `simulated` otherwise (a plausible local set), or `unavailable` on failure. `keyed` reports whether a real API key is in use.",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "lat", in: "query", required: true, schema: { type: "number" } },
          { name: "lng", in: "query", required: true, schema: { type: "number" } },
          { name: "radius", in: "query", schema: { type: "number", minimum: 1, maximum: 50, default: 8 }, description: "Search radius in km" },
          { name: "max", in: "query", schema: { type: "integer", minimum: 1, maximum: 50, default: 25 } },
        ],
        responses: {
          "200": {
            description: "Nearby chargers",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    source: { type: "string", enum: ["live", "cache", "simulated", "unavailable"] },
                    keyed: { type: "boolean" },
                    chargers: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                          lat: { type: "number" },
                          lng: { type: "number" },
                          operator: { type: "string", nullable: true },
                          numberOfPoints: { type: "integer", nullable: true },
                          connectorTypes: { type: "array", items: { type: "string" } },
                          maxPowerKw: { type: "number", nullable: true },
                          isOperational: { type: "boolean" },
                          distanceKm: { type: "number" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "lat and lng are required" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/ev/range-check": {
      post: {
        tags: ["EV Driver"],
        summary: "Soft low-battery check before accepting a trip",
        description:
          "Advisory only — never blocks. Given a trip distance (or pickup/dropoff coordinates), compares the driver's available range (with a 25% safety buffer) against the trip and flags a warning if range is tight or battery is at/below 20%. When warning, includes up to 3 nearby chargers. Returns `warn:false, canComplete:true` for non-EVs or when no battery data is available.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  tripDistanceKm: { type: "number", description: "Direct trip distance; if omitted, computed from coordinates" },
                  pickupLat: { type: "number" },
                  pickupLng: { type: "number" },
                  dropoffLat: { type: "number" },
                  dropoffLng: { type: "number" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Range advisory",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    warn: { type: "boolean" },
                    canComplete: { type: "boolean" },
                    lowBattery: { type: "boolean" },
                    tripDistanceKm: { type: "number", nullable: true },
                    requiredRangeKm: { type: "number" },
                    rangeKm: { type: "number", nullable: true },
                    batteryPercent: { type: "integer", nullable: true },
                    source: { type: "string" },
                    updatedAt: { type: "string", format: "date-time", nullable: true },
                    nearbyChargers: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
          "401": { description: "Unauthorized" },
          "404": { description: "Driver profile not found" },
        },
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
