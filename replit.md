# Travony - Ride Booking Platform

## Overview

Travony is a ride-booking platform inspired by Careem and Uber, connecting passengers and drivers through React Native mobile apps and an Express.js backend. It supports multiple user roles (customers, drivers, admins, fleet owners) and operates on a peer-to-peer model with a 10% platform fee. Key features include AI-powered driver matching, dynamic pricing, blockchain verification of ride records on Polygon Amoy Testnet, and a robust system for international expansion. The project aims to deliver a seamless, fair, and globally scalable ride-sharing experience.

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
-   **BitPay**: For USDT cryptocurrency payments (`BITPAY_API_TOKEN`, `BITPAY_ENV`).

### Blockchain
-   **Polygon Amoy Testnet (chainId: 80002)**: For blockchain verification of ride records, using `ethers.js` (`BLOCKCHAIN_PRIVATE_KEY`, `RIDE_REGISTRY_CONTRACT`).

### Email Service
-   **SMTP (Nodemailer)**: For notifications (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`).

### Twilio SMS Integration
-   **Twilio**: For OTP SMS delivery (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`).