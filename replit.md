# Travony - Intelligent Mobility Network (v4.4.0)

## Overview

Travony is a smart mobility network where private vehicles operate as intelligent economic assets. It connects riders and vehicle owners through React Native mobile apps (T Ride / T Driver) and an Express.js backend. The platform operates on a peer-to-peer model with a 10% platform fee. Key features include AI-powered intent-based matching, dynamic pricing, blockchain verification on Polygon Amoy Testnet, and a robust system for international expansion.

## Brand Identity & Language Guidelines (Consolidated Feb 2026)

Travoney is NOT a ride-hailing app, side hustle tool, or cheaper Uber. It IS distributed mobility infrastructure where private vehicles operate as programmable economic assets.

**Terminology Map:**
- Driver → Vehicle Owner (internal: driver)
- Go Online → Activate Vehicle
- Go Offline → Deactivate
- Trip/Ride → Route/Access
- Earnings → Yield
- Completed Trips → Completed Routes
- Wallet Balance → Asset Balance

**Never use:** "Earn extra cash", "Make money fast", "Side income", "Flexible job", "Gig"
**Instead use:** Intelligent Yield, Asset Participation, Network Optimization, Autonomous Activation

**Premium Consolidation (Completed):**
- Splash screen: "Movement has value." / "Welcome to the Travoney Mobility Network."
- Driver Home: 3 core elements only (Vehicle Status, Current Route, Monthly Yield)
- Rider Home: Destination input + Network Status: Optimal
- Signature moment on Vehicle Activation (haptic + overlay animation)
- About the Network page in both apps
- Long-term metrics in driver profile (Lifetime Yield, Network Participation)
- Network Efficiency indicator for drivers, Network Status for riders

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend uses React Native with Expo SDK 54, featuring role-based routing (customer/driver apps) and React Navigation. State management is handled by TanStack React Query for server state and a custom `useAuth` hook with AsyncStorage for authentication. UI design is inspired by Careem, supporting light/dark modes and using Reanimated for animations. Map integration provides real-time tracking, route visualization, and ETA display.

### Backend
The backend is an Express.js application in TypeScript, offering a RESTful API. It uses session-based authentication with token generation and scrypt for password hashing. Data is persisted in PostgreSQL via Drizzle ORM, with a schema covering users, drivers, vehicles, rides, payments, and regional configurations. It incorporates AI for driver matching and dynamic pricing, an AI-powered dispute resolution system (Fare Guardian), and a city launch system for global expansion.

### Internationalization
Travony is designed for international operation, supporting various regions with localized currency, pricing, vehicle types, emergency numbers, and multi-language support with in-app translation for rider-driver communication.

### City Launch & Driver Management
The platform includes a remote city launch system with a phased rollout. A comprehensive driver onboarding flow covers document verification and educational modules. It also features Driver Trust Protection for new drivers and a City Champion program for top drivers, alongside a driver referral system.

### City Testing Framework
A trust-first rollout approach is implemented, involving systematic testing before public launch. This includes a `Launch Mode Progression` (e.g., `pre_launch` to `active`), a `Test Checklist System` with over 60 tests across various categories (e.g., account lifecycle, identity verification, ride flow), a `Founding Driver Program` for initial market penetration, and a `Driver Feedback Collection` system to refine the user experience.

### Admin Dashboard
A web-based admin dashboard provides real-time statistics, driver and rider management, ride history, city management with launch mode progression, dispute tracking, a verification queue for documents and vehicles, and analytics.

### AI Vehicle Verification (South Asian Expansion)
**Vehicle Verification Service** (`server/vehicleVerification.ts`):
- Uses GPT-4o Vision via Replit AI Integrations for vehicle photo analysis
- Supports South Asian vehicle types: motorcycle, CNG auto (Bangladesh), auto-rickshaw, tuk-tuk
- Also supports standard types: economy, comfort, premium, SUV, minivan, minibus
- Analyzes multiple photos (front, side) to verify vehicle condition, type, and license plate visibility
- Confidence scoring (0-1 scale) determines automatic AI verification vs. admin review
- Region-specific analysis adapts to local vehicle standards

**Verification Status Flow**:
- `pending`: Awaiting review (low AI confidence or photo issues)
- `ai_verified`: Automatically approved by AI (high confidence)
- `admin_verified`: Manually approved by admin
- `rejected`: Vehicle not suitable for platform

**Driver Vehicle Screen**: Drivers can upload vehicle photos and select from region-appropriate vehicle types. AI verification provides instant feedback, with fallback to admin queue for manual review.

### OpenClaw - AI-Powered Hub & Hotspot System
OpenClaw is an intelligent mobility hub system that transforms high-activity areas into community gathering points with AI-powered insights.

**Backend Services:**
- `server/openClawService.ts`: 10 AI functions for hotspot detection (spatial bucketing ~500m grid), hub recommendations, yield estimates, carpool matching, smart prompts
- `server/hubRoutes.ts`: Full REST API with 15+ endpoints for hubs, hotspots, messaging, check-ins, feedback
- `server/communityPrestigeService.ts`: Prestige tier calculation (bronze/silver/gold/platinum/diamond) based on participation, contributions, efficiency

**Database Tables (8 new):** hubs, hotspots, hubMessages, hubReactions, hubCheckIns, communityPrestige, userFeedback, carpoolSuggestions

**Frontend Screens (5 new):**
- `OpenClawScreen.tsx`: Main hub/hotspot map with heatmap overlay, hub cards, AI prompts (variant: rider/driver)
- `HubDetailScreen.tsx`: Hub detail with ephemeral messaging, check-ins, reactions, carpool suggestions
- `NetworkAnalyticsScreen.tsx`: Analytics dashboard with stats, prestige card, hub activity, weekly trends
- `CommunityPrestigeScreen.tsx`: Full prestige display with tier cards, leaderboard (top 20)
- `FeedbackScreen.tsx`: In-app feedback with categories, star rating, text input

**Components (3 new):** HeatmapOverlay (animated gradient grid), HubCard (hub preview card), SmartPromptBanner (contextual AI suggestions)

**Navigation:** OpenClaw screens in both rider and driver home stacks; analytics/prestige/feedback in profile stacks; entry buttons on both home screens

### Pay Me to Go Home (PMGTH)
This feature allows drivers to set a destination and receive only direction-compatible rides with transparent premium pricing. Drivers activate "Going Home" mode, and the system uses vector math for direction compatibility. Riders see a "Faster Pickup" option with a premium, of which the driver receives 80%. Abuse prevention mechanisms include session limits and detour manipulation detection.

### Crypto Payment System (USDT Stablecoin)
Travony integrates abstracted crypto payments using USDT stablecoin on Polygon Amoy Testnet with a smart escrow system. Users interact with local currencies, while the backend handles crypto transactions. The system ensures rider funds are locked on acceptance and released upon completion, with premiums paid instantly to the driver. Live FX rates are sourced from Coinbase API.

### Intent-Based Mobility (IBM)
Travony uses Intent-Based Mobility to match drivers and riders based on intent alignment rather than just proximity. Key components:

**Intent Engine** (`server/intentEngine.ts`):
- Driver Intent Vector (6 dimensions): directionality, time constraint, earnings urgency, trip preference, zone affinity, fatigue index
- Rider Intent Vector (5 dimensions): priority, flexibility, pickup urgency, destination constraint, reliability sensitivity
- Alignment scoring with city-specific weights and thresholds (instant ≥0.85, soft commitment 0.7-0.85, wait/compensate <0.7)

**City Brain** (`server/cityBrain.ts`):
- Zone-level flow modeling with supply/demand imbalance tracking
- Adaptive thresholds based on city density (low/default/high)
- Dynamic guarantee thresholds and premium multipliers
- Flow recommendations for drivers to move to higher-demand zones

**Rider Priority Selection**:
- Fastest: Priority pickup with aligned drivers
- Cheapest: Best value matching
- Most Reliable: Trusted driver matching

**Anti-Gaming Controls** (`server/antiGamingService.ts`):
- Entropy analysis for location variety
- Eligibility decay based on cancellation/late arrival rates
- Suspicion detection with restrictions (guarantee ineligibility, reduced payouts, manual review)

### Trust-First Framework

The platform operates on trust-first principles ensuring transparency and fairness for both riders and drivers.

**Auto-Rematch System** (`server/rematchService.ts`):
- When a driver cancels, system automatically finds a new driver within 10km radius
- Original guaranteed fare is preserved for the rider
- Maximum 3 rematch attempts before issuing rider compensation credit
- Driver receives accountability record for cancellation

**Rider Compensation Credits** (`server/accountabilityService.ts`):
- Automatic credits for trust violations (late ETA, driver cancellations, price discrepancies)
- Credits tracked in wallet with clear descriptions
- Proactive compensation preserves rider trust

**Driver Pay Transparency** (API: `/api/driver/pay-formula`):
- Complete earnings breakdown shown before ride acceptance
- Flat 10% platform commission, 90% driver share
- PMGTH bonus: 80% of direction premium goes to driver
- Tips: 100% go to driver with no platform cut
- Weekly payouts guaranteed via bank transfer or USDT

**Incentive Policy** (`server/incentivePolicy.ts`):
- Phase-based incentive management tied to city launch mode
- **Seeding Phase**: Signup bonuses active (50 after 10 rides), referral bonuses (25), weather/emergency boosts only, no surge pricing
- **Growth Phase**: Signup bonuses auto-disabled, referrals active (15), surge pricing enabled (max 1.5x), peak hour boosts
- **Mature Phase**: All bonuses disabled, full dynamic pricing (max 2.0x surge)
- Weather boost (20-30%) and emergency boost (30-50%) always active in all phases

**Trust Guarantees**:
- Guaranteed earnings shown BEFORE driver accepts
- Fare cannot decrease after acceptance
- No hidden fees or deductions
- Fair cancellation protection for non-driver-fault

## External Dependencies

### Maps & Location
-   `react-native-maps`
-   `expo-location`

### Database
-   **PostgreSQL**: Primary data store, with `pg` driver and Drizzle ORM.

### Key Expo Modules
-   `expo-image-picker`
-   `expo-haptics`
-   `expo-blur`
-   `expo-web-browser`
-   `expo-splash-screen`
-   `expo-local-authentication`

### Payment Gateways
-   **NOWPayments**: For card and USDT cryptocurrency payments (`NOWPAYMENTS_API_KEY`). Supports cash, card, wallet, and USDT stablecoin.

### Blockchain
-   **Polygon Amoy Testnet (chainId: 80002)**: For blockchain verification of ride records, using `ethers.js` (`BLOCKCHAIN_PRIVATE_KEY`, `RIDE_REGISTRY_CONTRACT`).

### Email Service
-   **SMTP (Nodemailer)**: For notifications (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`).

### Twilio SMS Integration
-   **Twilio**: For OTP SMS delivery (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`).