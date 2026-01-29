# Travony Design Guidelines

## Design Philosophy
Travony adopts a **Careem-inspired design language**: clean, minimal, and trustworthy. The interface prioritizes clarity and speed, enabling users to book rides in under 30 seconds while maintaining visual sophistication.

---

## Architecture Decisions

### Authentication
**Required** - Multi-user ride-booking platform with social/multiplayer features.

**Implementation:**
- **Primary:** Apple Sign-In (iOS), Google Sign-In (Android/cross-platform)
- **Secondary:** Email/password with OTP verification via email
- **Guest Mode:** Allow ride booking as guest; prompt sign-up before payment/ride confirmation
- **Onboarding Flow:** 3-screen splash → Sign-up/Login → Location permissions → Home
- **Account Management:**
  - Profile screen with avatar upload, display name, phone, email
  - Nested Settings: Account → Delete Account (double confirmation: "Are you sure?" → "This action cannot be undone")
  - Privacy Policy & Terms links in footer of auth screens

**Driver-Specific Auth:**
- Document upload during registration (license, insurance, vehicle registration photos)
- Admin approval required before account activation
- Verification badge displayed post-approval

---

### Navigation Architecture

#### Customer App
**Tab Navigation** (4 tabs + FAB):
1. **Home** - Map view with ride booking
2. **Bookings** - Ride history (upcoming/past)
3. **FAB (center)** - Quick "Book Ride" floating action button
4. **Wallet** - Payment methods, promo codes, transaction history
5. **Profile** - Account settings, support, sign out

**Modal Screens:**
- Ride request confirmation (bottom sheet)
- Driver details during active ride (bottom sheet)
- Emergency contacts share (full modal)
- Rating/review after ride completion (modal)

#### Driver App
**Tab Navigation** (3 tabs):
1. **Home** - Map with ride requests and online/offline toggle
2. **Earnings** - Revenue breakdown and trip history
3. **Profile** - Account info, documents, support

**Stack Screens:**
- Active ride navigation (full-screen map)
- Trip details (modal)
- Help/Support (stack)

#### Admin Dashboard (Web)
**Drawer Navigation** with:
- Dashboard (live map, metrics)
- Users Management
- Drivers Management
- Fleet Management
- Rides & Scheduling
- Service Types
- Surge Pricing
- Coupons
- Payments & Wallets
- Analytics
- Settings

---

## Screen Specifications

### Customer App: Home Screen
- **Purpose:** Book rides quickly with minimal friction
- **Layout:**
  - **Header:** Transparent with hamburger menu (left), notifications bell (right)
  - **Main Content:** Full-screen map view (non-scrollable)
    - Current location pin (blue pulsing dot)
    - Live car icons for nearby drivers (car icon with direction arrow)
    - Surge zones (red overlay with opacity 0.15)
  - **Floating Elements:**
    - Bottom sheet (white, rounded top corners 24px) containing:
      - Pickup address input (with GPS icon, tap to change)
      - Dropoff address input (with destination icon)
      - Vehicle type horizontal scroll cards
      - "Confirm Ride" primary button
    - "My Location" FAB (bottom-right, 16px from bottom + tabBarHeight)
- **Safe Area:** 
  - Top: insets.top (map extends to screen edge)
  - Bottom: tabBarHeight + 16px (bottom sheet anchored here)

### Customer App: Active Ride Screen
- **Purpose:** Track driver and ride progress in real-time
- **Layout:**
  - **Header:** Transparent with back button (left), share trip (right)
  - **Main Content:** Full-screen map (non-scrollable)
    - Driver car icon (animated, rotates based on direction)
    - Route polyline (green stroke, 4px width)
    - Pickup and dropoff pins
  - **Floating Elements:**
    - Driver info card (top, below header): Photo, name, rating, vehicle, plate number
    - Bottom action sheet: ETA, fare, "Call Driver," "Message Driver," "Cancel Ride"
    - Panic button (red, bottom-left, 16px from edges)
- **Safe Area:**
  - Top: insets.top + 80px (driver card height)
  - Bottom: 240px (action sheet height)

### Driver App: Home Screen
- **Purpose:** Accept ride requests and navigate to customers
- **Layout:**
  - **Header:** Custom non-transparent (green background, white text)
    - Online/Offline toggle (right)
    - Earnings today (center)
  - **Main Content:** Full-screen map with current location
  - **Floating Elements:**
    - Ride request card (bottom sheet when request comes in):
      - Customer photo, name, rating
      - Pickup/dropoff addresses
      - Estimated fare and distance
      - "Accept" (green) and "Reject" (gray outline) buttons
      - Countdown timer (30s)
    - Surge zone indicator (top-center badge showing multiplier)
- **Safe Area:**
  - Top: headerHeight + 16px
  - Bottom: tabBarHeight + 16px

### Driver App: Earnings Screen
- **Purpose:** Track income and performance
- **Layout:**
  - **Header:** Default navigation with title "Earnings"
  - **Main Content:** Scrollable
    - Revenue summary cards (Today, Week, Month, All-time) in 2x2 grid
    - Bar chart showing daily earnings (7 days)
    - Trip history list (card-based)
  - **Safe Area:**
    - Top: 16px (header not transparent)
    - Bottom: tabBarHeight + 16px

### Admin Dashboard: Live Dashboard
- **Purpose:** Monitor platform activity in real-time
- **Layout:**
  - **Sidebar:** Fixed drawer with navigation
  - **Header:** Top bar with search, notifications, admin avatar
  - **Main Content:** Grid layout
    - Metric cards row: Active Rides, Online Drivers, Total Customers, Today's Revenue
    - Live map (2/3 width) showing active rides with lines connecting drivers to destinations
    - Recent activity feed (1/3 width) with real-time ride updates

---

## Design System

### Color Palette
**Primary (Travony Green):**
- `primary.500`: #00B14F (Careem-inspired green)
- `primary.400`: #00C95C
- `primary.600`: #009940

**Neutral:**
- `neutral.900`: #1A1A1A (headings)
- `neutral.700`: #4A4A4A (body text)
- `neutral.400`: #9E9E9E (disabled text)
- `neutral.200`: #E0E0E0 (borders)
- `neutral.50`: #F5F5F5 (backgrounds)

**Semantic:**
- `error.500`: #E53935 (panic button, errors)
- `warning.500`: #FB8C00 (surge pricing)
- `success.500`: #43A047 (confirmations)

**Surface:**
- White (#FFFFFF) for cards and sheets
- `neutral.50` for screen backgrounds

### Typography
**Headings:**
- H1: 28px, Bold, neutral.900
- H2: 22px, Semibold, neutral.900
- H3: 18px, Semibold, neutral.700

**Body:**
- Large: 16px, Regular, neutral.700 (primary text)
- Medium: 14px, Regular, neutral.700 (secondary text)
- Small: 12px, Regular, neutral.400 (captions)

**Buttons:**
- 16px, Semibold, white (on primary buttons)

### Spacing Scale
- XS: 4px
- S: 8px
- M: 16px
- L: 24px
- XL: 32px

### Component Specifications

#### Primary Button
- Height: 52px
- Border radius: 12px
- Background: primary.500
- Text: 16px Semibold white
- **Pressed state:** Background darkens to primary.600, scale 0.98
- **Drop shadow:** For FABs only: `shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.10, shadowRadius: 2`

#### Bottom Sheet
- Background: white
- Border radius: 24px (top corners only)
- Min height: 280px
- Drag handle: 40px wide, 4px tall, neutral.300, centered 12px from top

#### Map Markers
- Driver car icon: 40x40px, green circle background, white car icon
- Pickup pin: Blue teardrop, 32x48px
- Dropoff pin: Green teardrop, 32x48px
- Current location: Blue circle with white border, pulsing animation

#### Vehicle Type Cards (Horizontal Scroll)
- Card size: 120x140px
- Border: 1.5px neutral.200 (selected: 2px primary.500)
- Border radius: 16px
- Content: Vehicle icon (top), type name (center), fare estimate (bottom)
- **Pressed state:** Scale 0.96, border color primary.400

#### Rating Component
- 5 stars, 24px each
- Filled: warning.500 (#FB8C00 gold)
- Empty: neutral.300

---

## Visual Design

### Icons
- Use **Feather icons** from @expo/vector-icons exclusively
- Icon sizes: 20px (inline), 24px (buttons), 32px (feature icons)
- Color: neutral.700 (default), primary.500 (active state)

### Assets (Generate These)
1. **Travony Logo** - Green wordmark with subtle car/road element
2. **Empty State Illustrations:**
   - No bookings yet (simple line drawing of map with pin)
   - No drivers nearby (simple car icon with search radius)
3. **Vehicle Type Icons:**
   - Economy (sedan outline)
   - Comfort (SUV outline)
   - Premium (luxury car outline)
   - XL (van outline)
4. **Onboarding Illustrations** (3 screens):
   - Screen 1: Safe travels concept
   - Screen 2: Real-time tracking concept
   - Screen 3: Easy payments concept

### Imagery Guidelines
- Driver photos: Circular, 48px (list), 64px (active ride), 80px (profile)
- Vehicle photos: 16:9 ratio, 320x180px
- Document uploads: Maintain aspect ratio, max 800x600px

---

## Accessibility

- Minimum touch target: 44x44px
- Color contrast ratio: 4.5:1 for text, 3:1 for UI elements
- All interactive elements announce purpose for screen readers
- Panic button: High contrast (red with white icon), always visible
- Font scaling: Support up to 150% text size
- Haptic feedback: Light tap on button press, medium tap on ride confirmation

---

## Interaction Design

### Transitions
- Screen transitions: 300ms ease-in-out
- Bottom sheet slide: 250ms ease-out
- Map animations: 400ms ease-in-out (camera movements)

### Micro-interactions
- Ride request sent: Success checkmark animation (500ms)
- Driver approaching: Pulsing pin animation on map
- Payment processing: Loading spinner in button (button text changes to spinner)
- OTP verification: Auto-advance between input fields

### Error States
- Inline errors below input fields (error.500 text, 14px)
- Toast notifications for system errors (slide from top, 3s duration)
- Network errors: Banner at top of screen with retry button