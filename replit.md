# Travony - Intelligent Mobility Network

## Overview

Travony is an intelligent mobility network that redefines private vehicles as programmable economic assets. It connects riders and vehicle owners through dedicated React Native mobile applications (T Ride / T Driver) and an Express.js backend. The platform facilitates a peer-to-peer model with a 10% service fee, emphasizing intelligent yield and network optimization over traditional ride-hailing. Key capabilities include AI-powered intent-based matching, dynamic pricing, blockchain verification on Polygon Amoy Testnet, and a comprehensive system for global expansion. Travony aims to transform mobility infrastructure by enabling vehicles to operate as self-optimizing economic units within a distributed network.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend consists of React Native applications for riders and drivers, built with Expo SDK. It features role-based routing, React Navigation for UI flow, and TanStack React Query for server state management. Authentication uses a custom `useAuth` hook with AsyncStorage. The UI is inspired by Careem, supporting light/dark modes and using Reanimated for animations. Map integrations provide real-time tracking, route visualization, and ETA display. OpenClaw screens include a heatmap overlay, hub cards, and AI prompts, while Pay Me to Go Home offers a "Going Home" mode with transparent premium pricing.

### Backend
The backend is an Express.js application in TypeScript, providing a RESTful API. It uses session-based authentication with token generation and scrypt for password hashing. Data is stored in PostgreSQL via Drizzle ORM, with a schema covering users, drivers, vehicles, rides, payments, and regional configurations. It incorporates AI for driver matching, dynamic pricing, a dispute resolution system (Fare Guardian), and a city launch system for international expansion. Key features include AI Vehicle Verification using GPT-4o Vision, OpenClaw for intelligent mobility hub management, and Intent-Based Mobility for sophisticated driver-rider matching.

### Core Architectural Patterns and Features
-   **Internationalization**: Designed for global operation with support for localized currency, pricing, vehicle types, emergency services, and multi-language communication.
-   **City Launch System**: Includes a remote city launch framework with phased rollouts, comprehensive driver onboarding, Driver Trust Protection, and a City Champion program.
-   **City Testing Framework**: Implements a trust-first rollout with systematic testing, including `Launch Mode Progression`, a `Test Checklist System`, a `Founding Driver Program`, and `Driver Feedback Collection`.
-   **Admin Dashboard**: A web-based interface for real-time statistics, management of users, rides, cities, disputes, verification queues, and analytics.
-   **OpenClaw - AI-Powered Hub & Hotspot System**: Transforms high-activity areas into community gathering points using AI for hotspot detection, hub recommendations, and carpool matching. It includes a `CommunityPrestigeService` for ranking participation.
-   **EV Hub Intelligence Layer**: 8 hubs designated as EV charging hubs (malls, airports, marinas) with `is_ev_hub`, `total_charging_ports`, `available_ports` fields. EV staging status (charging/ready/departing) tracked per check-in via `hubCheckIns.evStagingStatus`. EV demand signals logged to `ev_demand_signals` table per EV-preferred ride. Driver check-in at EV hub prompts EV staging modal. Hub Detail screen has an EV tab. Fleet operators can read `/api/openclaw/ev-demand-signals`. EV hub map listing at `/api/openclaw/hubs/ev-hubs`. Per-hub EV status panel at `/api/openclaw/hubs/:id/ev-status`.
-   **Pay Me to Go Home (PMGTH)**: Allows drivers to specify a destination and receive direction-compatible rides with premium pricing, featuring abuse prevention mechanisms.
-   **Crypto Payment System**: Integrates abstracted crypto payments using USDT on Polygon Amoy Testnet with a smart escrow system. Transactions are handled in local currencies for users while the backend manages crypto.
-   **Intent-Based Mobility (IBM)**: Matches drivers and riders based on multi-dimensional intent vectors, utilizing a `City Brain` for zone-level flow modeling and dynamic adjustments. Includes `Anti-Gaming Controls` for platform integrity.
-   **Production Resilience Architecture**: Features an `AppError` class hierarchy for structured error handling, and resilience patterns like `retry<T>()` with exponential backoff and a `CircuitBreaker` class for external service integrations.
-   **Ride Event Sourcing**: Utilizes an immutable `ride_event_log` for a complete audit trail of the ride lifecycle, supporting dispute resolution and temporal queries.
-   **Transactional Email System**: Manages email notifications via an email queue with retry logic, using HTML and plain text templates for deliverability.
-   **Coffee Delivery System**: Integrated coffee ordering with three modes (Order for delivery, Buy for pickup, Gift to send to others). Riders access via a floating coffee icon on the home screen. Drivers see available coffee orders and can accept/fulfill them through a dedicated Coffee Orders screen. Menu includes Gulf-region drinks (Karak Tea, Arabic Coffee, Turkish Coffee) alongside standard cafe offerings. Backend routes in `server/coffeeRoutes.ts`, schema in `coffee_orders` table.
-   **Hub Browse System**: When no hubs are nearby, the OpenClaw screen automatically shows a browse-all view grouped by country (UAE, KSA, Kuwait, Bahrain) and city with 44 hubs across 11 cities. Browse endpoint at `/api/openclaw/hubs/browse`.
-   **Trust-First Framework**: Ensures transparency and fairness through an auto-rematch system, rider compensation credits, transparent driver pay formulas (10% platform commission), and phase-based incentive policies tied to city launch modes.

## External Dependencies

-   **Maps & Location**: `react-native-maps`, `expo-location`
-   **Database**: PostgreSQL (via Drizzle ORM)
-   **Expo Modules**: `expo-image-picker`, `expo-haptics`, `expo-blur`, `expo-web-browser`, `expo-splash-screen`, `expo-local-authentication`
-   **Payment Gateways**: NOWPayments (for card and USDT cryptocurrency payments)
-   **Blockchain**: Polygon Amoy Testnet (using `ethers.js` for ride record verification)
-   **Email Service**: SMTP (via Nodemailer)
-   **SMS Integration**: Twilio (for OTP SMS delivery)