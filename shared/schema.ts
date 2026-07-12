import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, pgEnum, primaryKey, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["customer", "driver", "admin", "fleet_owner"]);
export const rideStatusEnum = pgEnum("ride_status", ["pending", "accepted", "arriving", "started", "in_progress", "completed", "cancelled"]);
export const riderPriorityEnum = pgEnum("rider_priority", ["fastest", "cheapest", "reliable"]);
export const paymentMethodEnum = pgEnum("payment_method", ["card", "cash", "wallet", "usdt"]);
export const driverStatusEnum = pgEnum("driver_status", ["pending", "approved", "rejected", "suspended"]);
export const vehicleTypeEnum = pgEnum("vehicle_type", ["economy", "comfort", "premium", "xl", "moto", "rickshaw", "tuktuk", "minibus", "cng", "auto_rickshaw", "motorcycle", "suv", "minivan", "safe_driver"]);
export const transactionTypeEnum = pgEnum("transaction_type", [
  "ride_payment",
  "wallet_topup",
  "refund",
  "withdrawal",
  "payout",
  "platform_fee",
  "guarantee_payout",
  "directional_premium",
  "accountability_credit",
  "ride_fare_debit",
  "tip"
]);
export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "completed", "failed", "cancelled"]);
export const payoutStatusEnum = pgEnum("payout_status", ["pending", "processing", "completed", "failed"]);
export const payoutMethodEnum = pgEnum("payout_method", ["bank", "crypto"]);
export const currencyEnum = pgEnum("currency", ["AED", "USDT", "USD", "EUR", "GBP", "RUB", "INR", "NGN", "KES", "ZAR", "CNY", "JPY", "KRW", "SGD", "THB", "VND", "IDR", "PHP", "MYR", "PKR", "BDT", "EGP", "TRY", "BRL", "MXN"]);
export const invoiceTypeEnum = pgEnum("invoice_type", ["customer", "driver"]);
export const disputeStatusEnum = pgEnum("dispute_status", ["open", "investigating", "resolved_rider_favor", "resolved_driver_favor", "resolved_partial", "closed"]);
export const evStagingStatusEnum = pgEnum("ev_staging_status_enum", ["charging", "ready", "departing"]);
export const evConnectionStatusEnum = pgEnum("ev_connection_status_enum", ["connected", "expired", "error", "disconnected"]);
export const disputeTypeEnum = pgEnum("dispute_type", ["fare", "route", "rating", "payment", "safety", "behavior", "damage"]);
export const disputeResolutionEnum = pgEnum("dispute_resolution", ["refund_full", "refund_partial", "no_action", "warning_driver", "warning_rider", "suspend_driver", "suspend_rider", "rating_removed"]);
export const vehicleVerificationStatusEnum = pgEnum("vehicle_verification_status", ["pending", "ai_verified", "admin_verified", "rejected"]);

export const sessions = pgTable("sessions", {
  token: varchar("token").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  role: text("role").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password"),
  name: text("name").notNull(),
  phone: text("phone"),
  avatar: text("avatar"),
  role: userRoleEnum("role").default("customer").notNull(),
  isGuest: boolean("is_guest").default(false),
  stripeCustomerId: text("stripe_customer_id"),
  walletBalance: decimal("wallet_balance", { precision: 12, scale: 2 }).default("0.00"),
  regionCode: text("region_code").default("AE"),
  preferredLanguage: text("preferred_language").default("en"),
  telegramChatId: text("telegram_chat_id"),
  whatsappOptIn: boolean("whatsapp_opt_in").default(false),
  // Twitch channel login for ride streaming (validated against Twitch on save).
  twitchChannel: text("twitch_channel"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const drivers = pgTable("drivers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  licenseNumber: text("license_number"),
  licensePhoto: text("license_photo"),
  insurancePhoto: text("insurance_photo"),
  registrationPhoto: text("registration_photo"),
  status: driverStatusEnum("status").default("pending").notNull(),
  isOnline: boolean("is_online").default(false),
  currentLat: decimal("current_lat", { precision: 10, scale: 8 }),
  currentLng: decimal("current_lng", { precision: 11, scale: 8 }),
  currentHeading: decimal("current_heading", { precision: 5, scale: 2 }),
  lastOnlineAt: timestamp("last_online_at"),
  homeAddress: text("home_address"),
  cryptoWalletAddress: text("crypto_wallet_address"),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("5.00"),
  totalTrips: integer("total_trips").default(0),
  totalEarnings: decimal("total_earnings", { precision: 12, scale: 2 }).default("0.00"),
  walletBalance: decimal("wallet_balance", { precision: 12, scale: 2 }).default("0.00"),
  minRiderRating: decimal("min_rider_rating", { precision: 3, scale: 2 }),
  minRiderRatingEnabled: boolean("min_rider_rating_enabled").default(false),
  evReady: boolean("ev_ready").default(false),
  evReadyAt: timestamp("ev_ready_at"),
  prayerPauseEnabled: boolean("prayer_pause_enabled").default(false),
  prayerPausePrayers: text("prayer_pause_prayers"),
  fleetOwnerId: varchar("fleet_owner_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const vehicles = pgTable("vehicles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").references(() => drivers.id).notNull(),
  type: vehicleTypeEnum("type").notNull(),
  make: text("make").notNull(),
  model: text("model").notNull(),
  year: integer("year"),
  color: text("color"),
  plateNumber: text("plate_number").notNull(),
  photo: text("photo"),
  photoFront: text("photo_front"),
  photoSide: text("photo_side"),
  photoInterior: text("photo_interior"),
  publicHandle: text("public_handle").unique(),
  nickname: text("nickname"),
  walletBalance: decimal("wallet_balance", { precision: 12, scale: 2 }).default("0.00"),
  totalEarnings: decimal("total_earnings", { precision: 12, scale: 2 }).default("0.00"),
  totalTrips: integer("total_trips").default(0),
  reputationScore: decimal("reputation_score", { precision: 3, scale: 2 }).default("5.00"),
  ratingCount: integer("rating_count").default(0),
  verificationStatus: vehicleVerificationStatusEnum("verification_status").default("pending"),
  aiCategory: text("ai_category"),
  aiConfidence: decimal("ai_confidence", { precision: 5, scale: 4 }),
  aiConditionScore: integer("ai_condition_score"),
  aiPassengerCapacity: integer("ai_passenger_capacity"),
  aiIssues: text("ai_issues"),
  aiVerifiedAt: timestamp("ai_verified_at"),
  adminVerifiedBy: varchar("admin_verified_by").references(() => users.id),
  adminVerifiedAt: timestamp("admin_verified_at"),
  adminNotes: text("admin_notes"),
  isActive: boolean("is_active").default(true),
  isElectric: boolean("is_electric").default(false),
  evBatteryCapacityKwh: decimal("ev_battery_capacity_kwh", { precision: 6, scale: 2 }),
  evRatedRangeKm: integer("ev_rated_range_km"),
  manualBatteryPercent: integer("manual_battery_percent"),
  manualBatteryUpdatedAt: timestamp("manual_battery_updated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const savedAddresses = pgTable("saved_addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  label: text("label").notNull(),
  address: text("address").notNull(),
  lat: decimal("lat", { precision: 10, scale: 8 }).notNull(),
  lng: decimal("lng", { precision: 11, scale: 8 }).notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const serviceTypes = pgTable("service_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: vehicleTypeEnum("type").notNull().unique(),
  baseFare: decimal("base_fare", { precision: 10, scale: 2 }).notNull(),
  perKmRate: decimal("per_km_rate", { precision: 10, scale: 2 }).notNull(),
  perMinuteRate: decimal("per_minute_rate", { precision: 10, scale: 2 }).notNull(),
  icon: text("icon"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rides = pgTable("rides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => users.id).notNull(),
  driverId: varchar("driver_id").references(() => drivers.id),
  vehicleId: varchar("vehicle_id").references(() => vehicles.id),
  serviceTypeId: varchar("service_type_id").references(() => serviceTypes.id),
  pickupAddress: text("pickup_address").notNull(),
  pickupLat: decimal("pickup_lat", { precision: 10, scale: 8 }).notNull(),
  pickupLng: decimal("pickup_lng", { precision: 11, scale: 8 }).notNull(),
  dropoffAddress: text("dropoff_address").notNull(),
  dropoffLat: decimal("dropoff_lat", { precision: 10, scale: 8 }).notNull(),
  dropoffLng: decimal("dropoff_lng", { precision: 11, scale: 8 }).notNull(),
  status: rideStatusEnum("status").default("pending").notNull(),
  estimatedFare: decimal("estimated_fare", { precision: 10, scale: 2 }),
  actualFare: decimal("actual_fare", { precision: 10, scale: 2 }),
  distance: decimal("distance", { precision: 10, scale: 2 }),
  duration: integer("duration"),
  surgeMultiplier: decimal("surge_multiplier", { precision: 3, scale: 2 }).default("1.00"),
  otp: text("otp"),
  paymentMethod: paymentMethodEnum("payment_method").default("cash"),
  paymentStatus: text("payment_status").default("pending"),
  bitpayInvoiceId: text("bitpay_invoice_id"),
  bitpayInvoiceUrl: text("bitpay_invoice_url"),
  scheduledAt: timestamp("scheduled_at"),
  acceptedAt: timestamp("accepted_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  blockchainHash: text("blockchain_hash"),
  blockchainTxHash: text("blockchain_tx_hash"),
  aiMatchScore: decimal("ai_match_score", { precision: 5, scale: 2 }),
  priceBreakdown: text("price_breakdown"),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }),
  driverEarnings: decimal("driver_earnings", { precision: 10, scale: 2 }),
  regionCode: text("region_code").default("AE"),
  currency: currencyEnum("currency").default("AED"),
  isEvRide: boolean("is_ev_ride").default(false),
  // Safe Driver (Gulf): a vetted driver drives the RIDER'S OWN car. No driver
  // vehicle is attached to the ride; payout falls back to the driver wallet.
  isSafeDriver: boolean("is_safe_driver").default(false),
  isPmgthRide: boolean("is_pmgth_ride").default(false),
  pmgthPremiumAmount: decimal("pmgth_premium_amount", { precision: 10, scale: 2 }),
  pmgthPremiumPercent: decimal("pmgth_premium_percent", { precision: 5, scale: 2 }),
  riderPriority: riderPriorityEnum("rider_priority").default("reliable"),
  intentAlignmentScore: decimal("intent_alignment_score", { precision: 5, scale: 2 }),
  matchType: text("match_type"),
  tipAmount: decimal("tip_amount", { precision: 10, scale: 2 }).default("0.00"),
  shareToken: text("share_token"),
  carbonFootprintKg: decimal("carbon_footprint_kg", { precision: 6, scale: 3 }),
  originalGuaranteedFare: decimal("original_guaranteed_fare", { precision: 10, scale: 2 }),
  rematchCount: integer("rematch_count").default(0),
  rematchFromRideId: varchar("rematch_from_ride_id"),
  isRematchInProgress: boolean("is_rematch_in_progress").default(false),
  isGhostRide: boolean("is_ghost_ride").default(false),
  ghostRideLocalId: text("ghost_ride_local_id"),
  // Shared/pooled three-wheeler rides (fare split). isShared flags a poolable
  // tuktuk request; poolGroupId links riders sharing one vehicle. soloFare is the
  // full private fare (used for savings display + no-match fallback), and
  // sharedDiscountPercent is the per-rider discount locked when a driver accepts.
  isShared: boolean("is_shared").default(false),
  poolGroupId: varchar("pool_group_id"),
  soloFare: decimal("solo_fare", { precision: 10, scale: 2 }),
  sharedDiscountPercent: decimal("shared_discount_percent", { precision: 5, scale: 2 }).default("0.00"),
  // Name Your Fare (rider-proposed pricing). isNamedFare flags a negotiated
  // booking; riderProposedFare is the rider's current open offer (server-clamped
  // between region minFare and the surge-capped server estimate); offerExpiresAt
  // gates driver visibility — expired offers vanish from the driver feed until
  // the rider raises (which resets the window). Once a bid is accepted the
  // agreed price is frozen into estimatedFare and flows downstream unchanged.
  isNamedFare: boolean("is_named_fare").default(false),
  riderProposedFare: decimal("rider_proposed_fare", { precision: 10, scale: 2 }),
  offerExpiresAt: timestamp("offer_expires_at"),
  // Surge-capped server estimate frozen at booking — the immutable upper bound
  // for offers/counters so repeated raises can't compound the ceiling upward.
  offerCeiling: decimal("offer_ceiling", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rideId: varchar("ride_id").references(() => rides.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  method: paymentMethodEnum("method").notNull(),
  status: text("status").default("pending").notNull(),
  stripePaymentId: text("stripe_payment_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ratings = pgTable("ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rideId: varchar("ride_id").references(() => rides.id).notNull(),
  fromUserId: varchar("from_user_id").references(() => users.id).notNull(),
  toDriverId: varchar("to_driver_id").references(() => drivers.id).notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const coupons = pgTable("coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  discountType: text("discount_type").notNull(),
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(),
  minOrderValue: decimal("min_order_value", { precision: 10, scale: 2 }),
  maxDiscount: decimal("max_discount", { precision: 10, scale: 2 }),
  usageLimit: integer("usage_limit"),
  usedCount: integer("used_count").default(0),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userCoupons = pgTable("user_coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  couponId: varchar("coupon_id").references(() => coupons.id).notNull(),
  rideId: varchar("ride_id").references(() => rides.id),
  usedAt: timestamp("used_at").defaultNow().notNull(),
});

export const emergencyContacts = pgTable("emergency_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const paymentMethods = pgTable("payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(),
  last4: text("last4"),
  brand: text("brand"),
  stripePaymentMethodId: text("stripe_payment_method_id"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const walletTransactions = pgTable("wallet_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  driverId: varchar("driver_id").references(() => drivers.id),
  vehicleId: varchar("vehicle_id").references(() => vehicles.id),
  rideId: varchar("ride_id").references(() => rides.id),
  type: transactionTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: currencyEnum("currency").default("AED"),
  status: transactionStatusEnum("status").default("pending").notNull(),
  description: text("description"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeTransferId: text("stripe_transfer_id"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const driverPayouts = pgTable("driver_payouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").references(() => drivers.id).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: currencyEnum("currency").default("AED"),
  method: payoutMethodEnum("method").default("bank"),
  status: payoutStatusEnum("status").default("pending").notNull(),
  stripePayoutId: text("stripe_payout_id"),
  stripeAccountId: text("stripe_account_id"),
  bankLast4: text("bank_last4"),
  bankName: text("bank_name"),
  cryptoWalletAddress: text("crypto_wallet_address"),
  bitpayPayoutId: text("bitpay_payout_id"),
  txHash: text("tx_hash"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  completedAt: timestamp("completed_at"),
});

export const driverCryptoSettings = pgTable("driver_crypto_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").references(() => drivers.id).notNull().unique(),
  usdtWalletAddress: text("usdt_wallet_address"),
  preferredCurrency: currencyEnum("preferred_currency").default("AED"),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const rideInvoices = pgTable("ride_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rideId: varchar("ride_id").references(() => rides.id).notNull(),
  invoiceType: invoiceTypeEnum("invoice_type").notNull(),
  recipientId: varchar("recipient_id").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 12, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  currency: currencyEnum("currency").default("AED"),
  paymentMethod: paymentMethodEnum("payment_method"),
  blockchainHash: text("blockchain_hash"),
  pickupAddress: text("pickup_address"),
  dropoffAddress: text("dropoff_address"),
  distance: decimal("distance", { precision: 10, scale: 2 }),
  duration: integer("duration"),
  rideCompletedAt: timestamp("ride_completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const driverBankAccounts = pgTable("driver_bank_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").references(() => drivers.id).notNull(),
  stripeExternalAccountId: text("stripe_external_account_id"),
  bankName: text("bank_name"),
  last4: text("last4"),
  accountHolderName: text("account_holder_name"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const regions = pgTable("regions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  currency: currencyEnum("currency").notNull(),
  currencySymbol: text("currency_symbol").notNull(),
  phoneCode: text("phone_code").notNull(),
  timezone: text("timezone").notNull(),
  language: text("language").default("en"),
  surgeCap: decimal("surge_cap", { precision: 3, scale: 2 }).default("1.50"),
  platformFeePercent: decimal("platform_fee_percent", { precision: 5, scale: 2 }).default("10.00"),
  minFare: decimal("min_fare", { precision: 10, scale: 2 }).default("5.00"),
  emergencyNumber: text("emergency_number"),
  supportedPaymentMethods: text("supported_payment_methods").default("cash,usdt"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const regionalVehicleTypes = pgTable("regional_vehicle_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  regionId: varchar("region_id").references(() => regions.id).notNull(),
  type: vehicleTypeEnum("type").notNull(),
  localName: text("local_name").notNull(),
  description: text("description"),
  icon: text("icon"),
  baseFare: decimal("base_fare", { precision: 10, scale: 2 }).notNull(),
  perKmRate: decimal("per_km_rate", { precision: 10, scale: 2 }).notNull(),
  perMinuteRate: decimal("per_minute_rate", { precision: 10, scale: 2 }).notNull(),
  minFare: decimal("min_fare", { precision: 10, scale: 2 }),
  maxPassengers: integer("max_passengers").default(4),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const disputes = pgTable("disputes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rideId: varchar("ride_id").references(() => rides.id).notNull(),
  reporterId: varchar("reporter_id").references(() => users.id).notNull(),
  reporterRole: text("reporter_role").notNull(),
  type: disputeTypeEnum("type").notNull(),
  status: disputeStatusEnum("status").default("open").notNull(),
  description: text("description"),
  evidenceGps: text("evidence_gps"),
  evidenceBlockchain: text("evidence_blockchain"),
  estimatedFare: decimal("estimated_fare", { precision: 10, scale: 2 }),
  actualFare: decimal("actual_fare", { precision: 10, scale: 2 }),
  expectedRoute: text("expected_route"),
  actualRoute: text("actual_route"),
  aiAnalysis: text("ai_analysis"),
  aiConfidence: decimal("ai_confidence", { precision: 5, scale: 2 }),
  aiRecommendation: disputeResolutionEnum("ai_recommendation"),
  resolution: disputeResolutionEnum("resolution"),
  resolutionNotes: text("resolution_notes"),
  refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }),
  resolvedBy: varchar("resolved_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const rideTelemetry = pgTable("ride_telemetry", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rideId: varchar("ride_id").references(() => rides.id).notNull(),
  lat: decimal("lat", { precision: 10, scale: 8 }).notNull(),
  lng: decimal("lng", { precision: 11, scale: 8 }).notNull(),
  speed: decimal("speed", { precision: 6, scale: 2 }),
  heading: decimal("heading", { precision: 5, scale: 2 }),
  accuracy: decimal("accuracy", { precision: 6, scale: 2 }),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
});

export const translations = pgTable("translations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull(),
  language: text("language").notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rideMessages = pgTable("ride_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rideId: varchar("ride_id").references(() => rides.id).notNull(),
  senderId: varchar("sender_id").references(() => users.id).notNull(),
  senderRole: text("sender_role").notNull(),
  originalMessage: text("original_message").notNull(),
  originalLanguage: text("original_language"),
  translatedMessage: text("translated_message"),
  translatedLanguage: text("translated_language"),
  isQuickReply: boolean("is_quick_reply").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const regionalEmergencyContacts = pgTable("regional_emergency_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  regionId: varchar("region_id").references(() => regions.id).notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  type: text("type").notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const exchangeRates = pgTable("exchange_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromCurrency: currencyEnum("from_currency").notNull(),
  toCurrency: currencyEnum("to_currency").notNull(),
  rate: decimal("rate", { precision: 18, scale: 8 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  savedAddresses: many(savedAddresses),
  rides: many(rides),
  emergencyContacts: many(emergencyContacts),
  paymentMethods: many(paymentMethods),
}));

export const driversRelations = relations(drivers, ({ one, many }) => ({
  user: one(users, { fields: [drivers.userId], references: [users.id] }),
  vehicles: many(vehicles),
  rides: many(rides),
  ratings: many(ratings),
}));

export const vehiclesRelations = relations(vehicles, ({ one }) => ({
  driver: one(drivers, { fields: [vehicles.driverId], references: [drivers.id] }),
}));

export const ridesRelations = relations(rides, ({ one }) => ({
  customer: one(users, { fields: [rides.customerId], references: [users.id] }),
  driver: one(drivers, { fields: [rides.driverId], references: [drivers.id] }),
  vehicle: one(vehicles, { fields: [rides.vehicleId], references: [vehicles.id] }),
  serviceType: one(serviceTypes, { fields: [rides.serviceTypeId], references: [serviceTypes.id] }),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
  stripeCustomerId: true,
  walletBalance: true,
  isGuest: true,
  avatar: true,
});

export const insertDriverSchema = createInsertSchema(drivers).pick({
  userId: true,
  licenseNumber: true,
});

export const insertRideSchema = createInsertSchema(rides).pick({
  customerId: true,
  pickupAddress: true,
  pickupLat: true,
  pickupLng: true,
  dropoffAddress: true,
  dropoffLat: true,
  dropoffLng: true,
  serviceTypeId: true,
  scheduledAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Driver = typeof drivers.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type Ride = typeof rides.$inferSelect;
export type Rating = typeof ratings.$inferSelect;
export type SavedAddress = typeof savedAddresses.$inferSelect;
export type ServiceType = typeof serviceTypes.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type EmergencyContact = typeof emergencyContacts.$inferSelect;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type DriverPayout = typeof driverPayouts.$inferSelect;
export type DriverBankAccount = typeof driverBankAccounts.$inferSelect;
export type DriverCryptoSettings = typeof driverCryptoSettings.$inferSelect;
export type RideInvoice = typeof rideInvoices.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Region = typeof regions.$inferSelect;
export type RegionalVehicleType = typeof regionalVehicleTypes.$inferSelect;
export type Dispute = typeof disputes.$inferSelect;
export type RideTelemetry = typeof rideTelemetry.$inferSelect;
export type Translation = typeof translations.$inferSelect;
export type RideMessage = typeof rideMessages.$inferSelect;
export type RegionalEmergencyContact = typeof regionalEmergencyContacts.$inferSelect;
export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type EvCarConnection = typeof evCarConnections.$inferSelect;
export type InsertEvCarConnection = typeof evCarConnections.$inferInsert;

export const documentTypeEnum = pgEnum("document_type", ["id_card", "drivers_license", "vehicle_registration", "insurance", "selfie_video"]);
export const documentStatusEnum = pgEnum("document_status", ["pending", "approved", "rejected", "expired"]);
export const cityLaunchStatusEnum = pgEnum("city_launch_status", ["pre_launch", "internal_driver_test", "controlled_real_driver_access", "invite_only_riders", "supply_seeding", "density_validation", "soft_launch", "active", "paused"]);
export const driverTagEnum = pgEnum("driver_tag", ["founding_driver", "city_champion", "top_performer", "trusted", "new"]);
export const testCategoryEnum = pgEnum("test_category", ["account_lifecycle", "identity_verification", "education_activation", "online_offline", "ride_assignment", "pricing_earnings", "ride_flow", "ratings_feedback", "disputes", "safety_emergency", "notifications_bots", "abuse_fraud"]);
export const championStatusEnum = pgEnum("champion_status", ["pending", "active", "suspended", "retired"]);
export const educationModuleStatusEnum = pgEnum("education_module_status", ["not_started", "in_progress", "completed"]);
export const intakeChannelEnum = pgEnum("intake_channel", ["facebook", "whatsapp", "telegram", "referral", "website", "other"]);
export const pmgthSessionStatusEnum = pgEnum("pmgth_session_status", ["active", "completed", "expired", "cancelled"]);

export const hubTypeEnum = pgEnum("hub_type", ["station", "park", "coworking", "coffee_shop", "mall", "airport", "university", "hospital", "mosque", "custom"]);
export const hubStatusEnum = pgEnum("hub_status", ["active", "inactive", "predicted"]);
export const hubMessageStatusEnum = pgEnum("hub_message_status", ["active", "expired", "moderated"]);
export const prestigeTierEnum = pgEnum("prestige_tier", ["bronze", "silver", "gold", "platinum", "diamond"]);
export const feedbackTypeEnum = pgEnum("feedback_type", ["rating", "suggestion", "issue", "compliment"]);

export const cities = pgTable("cities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  regionCode: text("region_code").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  timezone: text("timezone").notNull(),
  centerLat: decimal("center_lat", { precision: 10, scale: 8 }),
  centerLng: decimal("center_lng", { precision: 11, scale: 8 }),
  radiusKm: decimal("radius_km", { precision: 6, scale: 2 }).default("30"),
  launchStatus: cityLaunchStatusEnum("launch_status").default("pre_launch"),
  targetDrivers: integer("target_drivers").default(100),
  activeDrivers: integer("active_drivers").default(0),
  avgEtaMinutes: decimal("avg_eta_minutes", { precision: 5, scale: 2 }),
  rideAcceptanceRate: decimal("ride_acceptance_rate", { precision: 5, scale: 2 }),
  monthlyChurnPercent: decimal("monthly_churn_percent", { precision: 5, scale: 2 }),
  disputesPer1000: decimal("disputes_per_1000", { precision: 6, scale: 2 }),
  telegramGroupLink: text("telegram_group_link"),
  whatsappGroupLink: text("whatsapp_group_link"),
  maxFoundingDrivers: integer("max_founding_drivers").default(10),
  foundingDriverCount: integer("founding_driver_count").default(0),
  testChecklistPassed: boolean("test_checklist_passed").default(false),
  isActive: boolean("is_active").default(true),
  launchedAt: timestamp("launched_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const driverDocuments = pgTable("driver_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").references(() => drivers.id).notNull(),
  type: documentTypeEnum("type").notNull(),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  status: documentStatusEnum("status").default("pending"),
  reviewedBy: varchar("reviewed_by"),
  reviewNotes: text("review_notes"),
  expiresAt: timestamp("expires_at"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
});

export const driverVerificationQueue = pgTable("driver_verification_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").references(() => drivers.id).notNull(),
  cityId: varchar("city_id").references(() => cities.id),
  priority: integer("priority").default(0),
  status: text("status").default("pending").notNull(),
  documentsComplete: boolean("documents_complete").default(false),
  idVerified: boolean("id_verified").default(false),
  licenseVerified: boolean("license_verified").default(false),
  vehicleVerified: boolean("vehicle_verified").default(false),
  selfieVerified: boolean("selfie_verified").default(false),
  educationCompleted: boolean("education_completed").default(false),
  notes: text("notes"),
  assignedTo: varchar("assigned_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const cityChampions = pgTable("city_champions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").references(() => drivers.id).notNull(),
  cityId: varchar("city_id").references(() => cities.id).notNull(),
  status: championStatusEnum("status").default("pending"),
  appointedAt: timestamp("appointed_at"),
  retiredAt: timestamp("retired_at"),
  totalReferrals: integer("total_referrals").default(0),
  activeReferrals: integer("active_referrals").default(0),
  referralEarnings: decimal("referral_earnings", { precision: 12, scale: 2 }).default("0.00"),
  commissionReduction: decimal("commission_reduction", { precision: 5, scale: 2 }).default("2.00"),
  monthlyBonus: decimal("monthly_bonus", { precision: 10, scale: 2 }).default("0.00"),
  isModerator: boolean("is_moderator").default(true),
  canOnboardDrivers: boolean("can_onboard_drivers").default(true),
  canEscalateIssues: boolean("can_escalate_issues").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const driverReferrals = pgTable("driver_referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerId: varchar("referrer_id").references(() => drivers.id).notNull(),
  referredDriverId: varchar("referred_driver_id").references(() => drivers.id).notNull(),
  cityId: varchar("city_id").references(() => cities.id),
  referralCode: text("referral_code").notNull(),
  status: text("status").default("pending").notNull(),
  bonusPaid: boolean("bonus_paid").default(false),
  bonusAmount: decimal("bonus_amount", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  activatedAt: timestamp("activated_at"),
});

export const driverEducation = pgTable("driver_education", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").references(() => drivers.id).notNull(),
  moduleId: text("module_id").notNull(),
  moduleName: text("module_name").notNull(),
  status: educationModuleStatusEnum("status").default("not_started"),
  progress: integer("progress").default(0),
  score: integer("score"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const driverIntake = pgTable("driver_intake", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").references(() => drivers.id),
  userId: varchar("user_id").references(() => users.id),
  cityId: varchar("city_id").references(() => cities.id),
  channel: intakeChannelEnum("channel").notNull(),
  referralCode: text("referral_code"),
  phone: text("phone"),
  name: text("name"),
  status: text("status").default("lead").notNull(),
  conversionStep: text("conversion_step").default("signup"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  convertedAt: timestamp("converted_at"),
});

export const driverTrustProtection = pgTable("driver_trust_protection", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").references(() => drivers.id).notNull().unique(),
  protectionActive: boolean("protection_active").default(true),
  ridesCompleted: integer("rides_completed").default(0),
  protectionEndsAtRides: integer("protection_ends_at_rides").default(20),
  earningsFloorActive: boolean("earnings_floor_active").default(true),
  earningsFloorAmount: decimal("earnings_floor_amount", { precision: 10, scale: 2 }),
  manualDisputeOverride: boolean("manual_dispute_override").default(true),
  protectionStartedAt: timestamp("protection_started_at").defaultNow().notNull(),
  protectionEndsAt: timestamp("protection_ends_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const educationModules = pgTable("education_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: text("module_id").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  content: text("content"),
  durationMinutes: integer("duration_minutes").default(2),
  sortOrder: integer("sort_order").default(0),
  isRequired: boolean("is_required").default(true),
  regionCode: text("region_code"),
  cityId: varchar("city_id").references(() => cities.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const driverTags = pgTable("driver_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").references(() => drivers.id).notNull(),
  cityId: varchar("city_id").references(() => cities.id),
  tag: driverTagEnum("tag").notNull(),
  assignedBy: varchar("assigned_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

export const cityTestChecklist = pgTable("city_test_checklist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cityId: varchar("city_id").references(() => cities.id).notNull(),
  category: testCategoryEnum("category").notNull(),
  testName: text("test_name").notNull(),
  description: text("description"),
  status: text("status").default("pending").notNull(),
  passedAt: timestamp("passed_at"),
  failedAt: timestamp("failed_at"),
  failureReason: text("failure_reason"),
  testedBy: varchar("tested_by"),
  isBlocking: boolean("is_blocking").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const riderInviteCodes = pgTable("rider_invite_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  driverId: varchar("driver_id").references(() => drivers.id).notNull(),
  cityId: varchar("city_id").references(() => cities.id).notNull(),
  maxUses: integer("max_uses").default(5),
  usedCount: integer("used_count").default(0),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const riderInviteUses = pgTable("rider_invite_uses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  inviteCodeId: varchar("invite_code_id").references(() => riderInviteCodes.id).notNull(),
  riderId: varchar("rider_id").references(() => users.id).notNull(),
  usedAt: timestamp("used_at").defaultNow().notNull(),
});

export const driverFeedback = pgTable("driver_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").references(() => drivers.id).notNull(),
  cityId: varchar("city_id").references(() => cities.id),
  category: text("category").notNull(),
  question: text("question"),
  feedback: text("feedback").notNull(),
  confusionLevel: integer("confusion_level"),
  screenName: text("screen_name"),
  actionAttempted: text("action_attempted"),
  resolved: boolean("resolved").default(false),
  resolvedBy: varchar("resolved_by"),
  resolution: text("resolution"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const simulatedEntities = pgTable("simulated_entities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cityId: varchar("city_id").references(() => cities.id).notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  name: text("name"),
  metadata: text("metadata"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pmgthSessions = pgTable("pmgth_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").references(() => drivers.id).notNull(),
  destinationAddress: text("destination_address").notNull(),
  destinationLat: decimal("destination_lat", { precision: 10, scale: 8 }).notNull(),
  destinationLng: decimal("destination_lng", { precision: 11, scale: 8 }).notNull(),
  startLat: decimal("start_lat", { precision: 10, scale: 8 }).notNull(),
  startLng: decimal("start_lng", { precision: 11, scale: 8 }).notNull(),
  timeWindowMinutes: integer("time_window_minutes").default(45),
  maxDetourPercent: decimal("max_detour_percent", { precision: 5, scale: 2 }).default("15.00"),
  status: pmgthSessionStatusEnum("status").default("active"),
  ridesCompleted: integer("rides_completed").default(0),
  totalEarnings: decimal("total_earnings", { precision: 12, scale: 2 }).default("0.00"),
  totalPremiumEarnings: decimal("total_premium_earnings", { precision: 12, scale: 2 }).default("0.00"),
  expiresAt: timestamp("expires_at").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pmgthRideMatches = pgTable("pmgth_ride_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => pmgthSessions.id).notNull(),
  rideId: varchar("ride_id").references(() => rides.id).notNull(),
  directionScore: decimal("direction_score", { precision: 5, scale: 2 }).notNull(),
  detourPercent: decimal("detour_percent", { precision: 5, scale: 2 }).notNull(),
  pickupProximityKm: decimal("pickup_proximity_km", { precision: 6, scale: 2 }),
  premiumAmount: decimal("premium_amount", { precision: 10, scale: 2 }).notNull(),
  premiumPercent: decimal("premium_percent", { precision: 5, scale: 2 }).notNull(),
  driverPremiumShare: decimal("driver_premium_share", { precision: 10, scale: 2 }).notNull(),
  platformPremiumShare: decimal("platform_premium_share", { precision: 10, scale: 2 }).notNull(),
  estimatedArrivalMinutes: integer("estimated_arrival_minutes"),
  wasAccepted: boolean("was_accepted").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pmgthDailyUsage = pgTable("pmgth_daily_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").references(() => drivers.id).notNull(),
  date: timestamp("date").notNull(),
  sessionsStarted: integer("sessions_started").default(0),
  sessionsCompleted: integer("sessions_completed").default(0),
  totalActiveMinutes: integer("total_active_minutes").default(0),
  ridesMatched: integer("rides_matched").default(0),
  premiumEarnings: decimal("premium_earnings", { precision: 12, scale: 2 }).default("0.00"),
  noMatchCount: integer("no_match_count").default(0),
  cooldownUntil: timestamp("cooldown_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pmgthEscrow = pgTable("pmgth_escrow", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  intentId: varchar("intent_id").unique().notNull(),
  rideId: varchar("ride_id").notNull(),
  riderId: varchar("rider_id").notNull(),
  driverId: varchar("driver_id").notNull(),
  baseFareUsdt: decimal("base_fare_usdt", { precision: 12, scale: 6 }),
  premiumUsdt: decimal("premium_usdt", { precision: 12, scale: 6 }),
  platformFeeUsdt: decimal("platform_fee_usdt", { precision: 12, scale: 6 }),
  driverEarningsUsdt: decimal("driver_earnings_usdt", { precision: 12, scale: 6 }),
  totalUsdt: decimal("total_usdt", { precision: 12, scale: 6 }),
  localCurrency: varchar("local_currency", { length: 3 }),
  fxRate: decimal("fx_rate", { precision: 12, scale: 6 }),
  status: varchar("status", { length: 50 }).default("pending"),
  premiumPaid: boolean("premium_paid").default(false),
  premiumTxHash: varchar("premium_tx_hash", { length: 100 }),
  fundedAt: timestamp("funded_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  releaseTxHash: varchar("release_tx_hash", { length: 100 }),
  riderWalletAddress: varchar("rider_wallet_address", { length: 50 }),
  driverWalletAddress: varchar("driver_wallet_address", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export type City = typeof cities.$inferSelect;
export type DriverDocument = typeof driverDocuments.$inferSelect;
export type DriverVerificationQueue = typeof driverVerificationQueue.$inferSelect;
export type CityChampion = typeof cityChampions.$inferSelect;
export type DriverReferral = typeof driverReferrals.$inferSelect;
export type DriverEducationRecord = typeof driverEducation.$inferSelect;
export type DriverIntake = typeof driverIntake.$inferSelect;
export type DriverTrustProtection = typeof driverTrustProtection.$inferSelect;
export type EducationModule = typeof educationModules.$inferSelect;
export type DriverTag = typeof driverTags.$inferSelect;
export type CityTestChecklist = typeof cityTestChecklist.$inferSelect;
export type RiderInviteCode = typeof riderInviteCodes.$inferSelect;
export type RiderInviteUse = typeof riderInviteUses.$inferSelect;
export type DriverFeedback = typeof driverFeedback.$inferSelect;
export type SimulatedEntity = typeof simulatedEntities.$inferSelect;
export type PmgthSession = typeof pmgthSessions.$inferSelect;
export type PmgthRideMatch = typeof pmgthRideMatches.$inferSelect;
export type PmgthDailyUsage = typeof pmgthDailyUsage.$inferSelect;
export type PmgthEscrow = typeof pmgthEscrow.$inferSelect;

export const guaranteeStatusEnum = pgEnum("guarantee_status", ["pending", "fulfilled_by_ride", "paid", "expired", "cancelled"]);

export const firstRideGuarantees = pgTable("first_ride_guarantees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").references(() => drivers.id).notNull(),
  sessionStartedAt: timestamp("session_started_at").notNull(),
  status: guaranteeStatusEnum("status").default("pending").notNull(),
  guaranteeAmount: decimal("guarantee_amount", { precision: 10, scale: 2 }).default("15.00").notNull(),
  currency: currencyEnum("currency").default("AED").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  fulfilledAt: timestamp("fulfilled_at"),
  rideId: varchar("ride_id").references(() => rides.id),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FirstRideGuarantee = typeof firstRideGuarantees.$inferSelect;

export const accountabilityCreditTypeEnum = pgEnum("accountability_credit_type", [
  "eta_breach",
  "pickup_wait",
  "driver_cancel",
  "rider_cancel_late",
  "no_show",
  "ride_delay",
  "system_failure"
]);

export const accountabilityCredits = pgTable("accountability_credits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  driverId: varchar("driver_id").references(() => drivers.id),
  rideId: varchar("ride_id").references(() => rides.id),
  creditType: accountabilityCreditTypeEnum("credit_type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: currencyEnum("currency").default("AED").notNull(),
  reason: text("reason"),
  metricsSnapshot: text("metrics_snapshot"),
  creditedAt: timestamp("credited_at").defaultNow().notNull(),
  appliedToWallet: boolean("applied_to_wallet").default(false),
  seenByUser: boolean("seen_by_user").default(false),
});

export type AccountabilityCredit = typeof accountabilityCredits.$inferSelect;

export const platformLedgerTypeEnum = pgEnum("platform_ledger_type", [
  "platform_fee_income",
  "guarantee_payout",
  "accountability_payout",
  "operational_expense",
  "adjustment"
]);

export const platformLedger = pgTable("platform_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: platformLedgerTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: currencyEnum("currency").default("AED").notNull(),
  rideId: varchar("ride_id").references(() => rides.id),
  driverId: varchar("driver_id").references(() => drivers.id),
  userId: varchar("user_id").references(() => users.id),
  description: text("description"),
  balanceBefore: decimal("balance_before", { precision: 12, scale: 2 }),
  balanceAfter: decimal("balance_after", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PlatformLedger = typeof platformLedger.$inferSelect;

export const truthSignalStatusEnum = pgEnum("truth_signal_status", ["extracted", "unknown", "invalid"]);
export const truthConsentStatusEnum = pgEnum("truth_consent_status", ["granted", "revoked"]);
export const ghostRideStatusEnum = pgEnum("ghost_ride_status", ["broadcasting", "accepted", "in_progress", "completed", "expired", "synced"]);
export const syncStatusEnum = pgEnum("sync_status", ["pending", "syncing", "synced", "failed"]);

export const truthProviders = pgTable("truth_providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  deepLinkScheme: text("deep_link_scheme"),
  androidPackage: text("android_package"),
  iosUrlScheme: text("ios_url_scheme"),
  iconUrl: text("icon_url"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TruthProvider = typeof truthProviders.$inferSelect;

export const truthConsent = pgTable("truth_consent", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  screenshotCapture: boolean("screenshot_capture").default(false),
  notificationParsing: boolean("notification_parsing").default(false),
  gpsTracking: boolean("gps_tracking").default(false),
  postRideConfirmation: boolean("post_ride_confirmation").default(true),
  status: truthConsentStatusEnum("status").default("granted").notNull(),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type TruthConsent = typeof truthConsent.$inferSelect;

export const truthRides = pgTable("truth_rides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  providerId: varchar("provider_id").references(() => truthProviders.id).notNull(),
  cityName: text("city_name"),
  routeType: text("route_type"),
  timeBlock: text("time_block"),
  rideDate: timestamp("ride_date").notNull(),
  quotedPrice: decimal("quoted_price", { precision: 10, scale: 2 }),
  finalPrice: decimal("final_price", { precision: 10, scale: 2 }),
  quotedEtaMinutes: decimal("quoted_eta_minutes", { precision: 6, scale: 2 }),
  actualPickupMinutes: decimal("actual_pickup_minutes", { precision: 6, scale: 2 }),
  driverCancelled: boolean("driver_cancelled"),
  cancellationCount: integer("cancellation_count").default(0),
  expectedDistanceKm: decimal("expected_distance_km", { precision: 8, scale: 2 }),
  actualDistanceKm: decimal("actual_distance_km", { precision: 8, scale: 2 }),
  expectedDurationMin: decimal("expected_duration_min", { precision: 6, scale: 2 }),
  actualDurationMin: decimal("actual_duration_min", { precision: 6, scale: 2 }),
  supportResolved: boolean("support_resolved"),
  supportOutcome: text("support_outcome"),
  screenshotUrl: text("screenshot_url"),
  gpsTraceJson: text("gps_trace_json"),
  notificationData: text("notification_data"),
  proofOfRide: boolean("proof_of_ride").default(false),
  pickupLat: decimal("pickup_lat", { precision: 10, scale: 8 }),
  pickupLng: decimal("pickup_lng", { precision: 11, scale: 8 }),
  dropoffLat: decimal("dropoff_lat", { precision: 10, scale: 8 }),
  dropoffLng: decimal("dropoff_lng", { precision: 11, scale: 8 }),
  isFromTravony: boolean("is_from_travony").default(false),
  travonyRideId: varchar("travony_ride_id").references(() => rides.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TruthRide = typeof truthRides.$inferSelect;

export const truthSignals = pgTable("truth_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  truthRideId: varchar("truth_ride_id").references(() => truthRides.id).notNull(),
  signalType: text("signal_type").notNull(),
  rawValue: text("raw_value"),
  normalizedScore: decimal("normalized_score", { precision: 5, scale: 2 }),
  status: truthSignalStatusEnum("status").default("extracted").notNull(),
  extractionMethod: text("extraction_method"),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TruthSignal = typeof truthSignals.$inferSelect;

export const truthScores = pgTable("truth_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  truthRideId: varchar("truth_ride_id").references(() => truthRides.id).notNull(),
  priceIntegrityScore: decimal("price_integrity_score", { precision: 5, scale: 2 }),
  pickupReliabilityScore: decimal("pickup_reliability_score", { precision: 5, scale: 2 }),
  cancellationScore: decimal("cancellation_score", { precision: 5, scale: 2 }),
  routeIntegrityScore: decimal("route_integrity_score", { precision: 5, scale: 2 }),
  supportResolutionScore: decimal("support_resolution_score", { precision: 5, scale: 2 }),
  totalScore: decimal("total_score", { precision: 5, scale: 2 }).notNull(),
  explanation: text("explanation").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TruthScore = typeof truthScores.$inferSelect;

export const truthAggregations = pgTable("truth_aggregations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").references(() => truthProviders.id).notNull(),
  cityName: text("city_name").notNull(),
  timeBlock: text("time_block"),
  routeType: text("route_type"),
  avgScore: decimal("avg_score", { precision: 5, scale: 2 }).notNull(),
  sampleCount: integer("sample_count").notNull(),
  priceAvg: decimal("price_avg", { precision: 5, scale: 2 }),
  pickupAvg: decimal("pickup_avg", { precision: 5, scale: 2 }),
  cancellationAvg: decimal("cancellation_avg", { precision: 5, scale: 2 }),
  routeAvg: decimal("route_avg", { precision: 5, scale: 2 }),
  supportAvg: decimal("support_avg", { precision: 5, scale: 2 }),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export type TruthAggregation = typeof truthAggregations.$inferSelect;

export const ghostRides = pgTable("ghost_rides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  localId: text("local_id").notNull(),
  riderId: varchar("rider_id").references(() => users.id),
  driverId: varchar("driver_id").references(() => drivers.id),
  riderPeerId: text("rider_peer_id").notNull(),
  driverPeerId: text("driver_peer_id"),
  pickupAddress: text("pickup_address"),
  pickupLat: decimal("pickup_lat", { precision: 10, scale: 8 }).notNull(),
  pickupLng: decimal("pickup_lng", { precision: 11, scale: 8 }).notNull(),
  dropoffAddress: text("dropoff_address"),
  dropoffLat: decimal("dropoff_lat", { precision: 10, scale: 8 }),
  dropoffLng: decimal("dropoff_lng", { precision: 11, scale: 8 }),
  estimatedFare: decimal("estimated_fare", { precision: 10, scale: 2 }),
  agreedFare: decimal("agreed_fare", { precision: 10, scale: 2 }),
  currency: currencyEnum("currency").default("AED"),
  vehicleType: vehicleTypeEnum("vehicle_type"),
  cityName: text("city_name"),
  status: ghostRideStatusEnum("status").default("broadcasting").notNull(),
  gpsTraceJson: text("gps_trace_json"),
  chatMessagesJson: text("chat_messages_json"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  syncStatus: syncStatusEnum("sync_status").default("pending").notNull(),
  syncedRideId: varchar("synced_ride_id").references(() => rides.id),
  syncedAt: timestamp("synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type GhostRide = typeof ghostRides.$inferSelect;

export const ghostMessages = pgTable("ghost_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ghostRideId: varchar("ghost_ride_id").references(() => ghostRides.id).notNull(),
  localId: text("local_id").notNull(),
  senderPeerId: text("sender_peer_id").notNull(),
  senderRole: text("sender_role").notNull(),
  content: text("content").notNull(),
  messageType: text("message_type").default("text"),
  sentAt: timestamp("sent_at").notNull(),
  syncStatus: syncStatusEnum("sync_status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type GhostMessage = typeof ghostMessages.$inferSelect;

export const offlineSyncQueue = pgTable("offline_sync_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  entityType: text("entity_type").notNull(),
  entityLocalId: text("entity_local_id").notNull(),
  payload: text("payload").notNull(),
  syncStatus: syncStatusEnum("sync_status").default("pending").notNull(),
  retryCount: integer("retry_count").default(0),
  lastError: text("last_error"),
  queuedAt: timestamp("queued_at").defaultNow().notNull(),
  syncedAt: timestamp("synced_at"),
});

export type OfflineSyncQueue = typeof offlineSyncQueue.$inferSelect;

export const cachedPricing = pgTable("cached_pricing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cityName: text("city_name").notNull(),
  regionCode: text("region_code").notNull(),
  vehicleType: vehicleTypeEnum("vehicle_type").notNull(),
  baseFare: decimal("base_fare", { precision: 10, scale: 2 }).notNull(),
  perKmRate: decimal("per_km_rate", { precision: 10, scale: 4 }).notNull(),
  perMinRate: decimal("per_min_rate", { precision: 10, scale: 4 }).notNull(),
  minimumFare: decimal("minimum_fare", { precision: 10, scale: 2 }).notNull(),
  currency: currencyEnum("currency").default("AED").notNull(),
  validFrom: timestamp("valid_from").defaultNow().notNull(),
  validUntil: timestamp("valid_until"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CachedPricing = typeof cachedPricing.$inferSelect;

export const hubs = pgTable("hubs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: hubTypeEnum("type").notNull(),
  status: hubStatusEnum("status").default("active"),
  lat: decimal("lat", { precision: 10, scale: 8 }).notNull(),
  lng: decimal("lng", { precision: 11, scale: 8 }).notNull(),
  radiusMeters: integer("radius_meters").default(300),
  cityId: varchar("city_id").references(() => cities.id),
  regionCode: text("region_code"),
  description: text("description"),
  address: text("address"),
  avgDemandScore: decimal("avg_demand_score", { precision: 5, scale: 2 }).default("0.00"),
  peakHours: text("peak_hours"),
  isAiDetected: boolean("is_ai_detected").default(false),
  lastActivityAt: timestamp("last_activity_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  isEvHub: boolean("is_ev_hub").default(false),
  totalChargingPorts: integer("total_charging_ports").default(0),
  availablePorts: integer("available_ports").default(0),
});

// On-Time Arrivals: "get me there on time" auto-scheduled rides. The engine
// computes pickup time = arrival deadline − travel ETA − category buffer and
// auto-creates the ride ~7 minutes before pickup. Works for malls, airports,
// universities, hotels, or any destination.
export const scheduledArrivals = pgTable("scheduled_arrivals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  label: text("label").notNull(),
  category: text("category").notNull().default("other"),
  hubId: varchar("hub_id").references(() => hubs.id),
  destAddress: text("dest_address").notNull(),
  destLat: decimal("dest_lat", { precision: 10, scale: 8 }).notNull(),
  destLng: decimal("dest_lng", { precision: 11, scale: 8 }).notNull(),
  pickupAddress: text("pickup_address").notNull(),
  pickupLat: decimal("pickup_lat", { precision: 10, scale: 8 }).notNull(),
  pickupLng: decimal("pickup_lng", { precision: 11, scale: 8 }).notNull(),
  mode: text("mode").notNull().default("once"),
  arriveAtUtc: timestamp("arrive_at_utc"),
  daysOfWeek: text("days_of_week"),
  arriveTimeLocal: text("arrive_time_local"),
  tzOffsetMinutes: integer("tz_offset_minutes").default(0),
  bufferMinutes: integer("buffer_minutes").notNull().default(10),
  status: text("status").notNull().default("active"),
  lastScheduledKey: text("last_scheduled_key"),
  lastRideId: varchar("last_ride_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ScheduledArrival = typeof scheduledArrivals.$inferSelect;
export type InsertScheduledArrival = typeof scheduledArrivals.$inferInsert;

// Prayer Rides: auto-scheduled rides to a mosque hub before each selected
// prayer. The deadline engine computes pickup = prayer time − ETA − wudu
// buffer and auto-dispatches ~7 minutes before pickup.
export const prayerRideSubscriptions = pgTable("prayer_ride_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  hubId: varchar("hub_id").references(() => hubs.id).notNull(),
  mosqueName: text("mosque_name").notNull(),
  mosqueAddress: text("mosque_address"),
  mosqueLat: decimal("mosque_lat", { precision: 10, scale: 8 }).notNull(),
  mosqueLng: decimal("mosque_lng", { precision: 11, scale: 8 }).notNull(),
  pickupAddress: text("pickup_address").notNull(),
  pickupLat: decimal("pickup_lat", { precision: 10, scale: 8 }).notNull(),
  pickupLng: decimal("pickup_lng", { precision: 11, scale: 8 }).notNull(),
  prayers: text("prayers").notNull(), // csv: fajr,dhuhr,asr,maghrib,isha,jumuah
  bufferMinutes: integer("buffer_minutes").notNull().default(10), // wudu buffer
  status: text("status").notNull().default("active"), // active | paused
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// One row per rider/prayer/day — makes dispatch idempotent (re-runs never
// double-book) and records one-tap skips.
export const prayerRideDispatches = pgTable("prayer_ride_dispatches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").references(() => prayerRideSubscriptions.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  prayer: text("prayer").notNull(),
  dayKey: text("day_key").notNull(), // local YYYY-MM-DD at the mosque
  rideId: varchar("ride_id"),
  status: text("status").notNull().default("dispatched"), // dispatched | skipped
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  unique("prayer_dispatch_once").on(t.subscriptionId, t.prayer, t.dayKey),
]);

export type PrayerRideSubscription = typeof prayerRideSubscriptions.$inferSelect;
export type PrayerRideDispatch = typeof prayerRideDispatches.$inferSelect;

export const hotspots = pgTable("hotspots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  hubId: varchar("hub_id").references(() => hubs.id),
  lat: decimal("lat", { precision: 10, scale: 8 }).notNull(),
  lng: decimal("lng", { precision: 11, scale: 8 }).notNull(),
  demandScore: decimal("demand_score", { precision: 5, scale: 2 }).notNull(),
  supplyCount: integer("supply_count").default(0),
  demandCount: integer("demand_count").default(0),
  avgYieldEstimate: decimal("avg_yield_estimate", { precision: 10, scale: 2 }),
  peakMultiplier: decimal("peak_multiplier", { precision: 3, scale: 2 }).default("1.00"),
  isActive: boolean("is_active").default(true),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  cityId: varchar("city_id").references(() => cities.id),
  regionCode: text("region_code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const hubMessages = pgTable("hub_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  hubId: varchar("hub_id").references(() => hubs.id).notNull(),
  authorId: varchar("author_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  category: text("category"),
  reportCount: integer("report_count").default(0),
  aiScore: decimal("ai_score", { precision: 3, scale: 2 }),
  status: hubMessageStatusEnum("status").default("active"),
  likesCount: integer("likes_count").default(0),
  isCurated: boolean("is_curated").default(false),
  moderationScore: decimal("moderation_score", { precision: 3, scale: 2 }),
  moderationReason: text("moderation_reason"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const hubReactions = pgTable("hub_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").references(() => hubMessages.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  reactionType: text("reaction_type").default("like"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const hubCheckIns = pgTable("hub_check_ins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  hubId: varchar("hub_id").references(() => hubs.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  userRole: text("user_role").notNull(),
  lat: decimal("lat", { precision: 10, scale: 8 }),
  lng: decimal("lng", { precision: 11, scale: 8 }),
  checkedInAt: timestamp("checked_in_at").defaultNow().notNull(),
  checkedOutAt: timestamp("checked_out_at"),
  evStagingStatus: evStagingStatusEnum("ev_staging_status"),
  evStagingSource: text("ev_staging_source"),
});

export const evDemandSignals = pgTable("ev_demand_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  pickupLat: decimal("pickup_lat", { precision: 10, scale: 8 }),
  pickupLng: decimal("pickup_lng", { precision: 11, scale: 8 }),
  regionCode: text("region_code"),
  matchFound: boolean("match_found").default(false),
  evDriversAvailable: integer("ev_drivers_available").default(0),
  nearestHubId: varchar("nearest_hub_id").references(() => hubs.id),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
});

export const evCarConnections = pgTable("ev_car_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").references(() => drivers.id).notNull().unique(),
  vehicleId: varchar("vehicle_id").references(() => vehicles.id),
  provider: text("provider").default("smartcar").notNull(),
  status: evConnectionStatusEnum("status").default("connected").notNull(),
  isSimulated: boolean("is_simulated").default(false),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  externalVehicleId: text("external_vehicle_id"),
  batteryPercent: integer("battery_percent"),
  rangeKm: decimal("range_km", { precision: 6, scale: 1 }),
  isCharging: boolean("is_charging").default(false),
  chargingState: text("charging_state"),
  targetChargePercent: integer("target_charge_percent").default(80),
  snapshotAt: timestamp("snapshot_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const evCarConnectionsRelations = relations(evCarConnections, ({ one }) => ({
  driver: one(drivers, { fields: [evCarConnections.driverId], references: [drivers.id] }),
  vehicle: one(vehicles, { fields: [evCarConnections.vehicleId], references: [vehicles.id] }),
}));

export const communityPrestige = pgTable("community_prestige", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  driverId: varchar("driver_id").references(() => drivers.id),
  tier: prestigeTierEnum("tier").default("bronze"),
  totalContributions: integer("total_contributions").default(0),
  networkParticipationScore: decimal("network_participation_score", { precision: 5, scale: 2 }).default("0.00"),
  efficiencyRating: decimal("efficiency_rating", { precision: 5, scale: 2 }).default("0.00"),
  lifetimeYield: decimal("lifetime_yield", { precision: 12, scale: 2 }).default("0.00"),
  hubMessagesCount: integer("hub_messages_count").default(0),
  helpfulReactionsReceived: integer("helpful_reactions_received").default(0),
  monthlyActiveHubs: integer("monthly_active_hubs").default(0),
  isTopContributor: boolean("is_top_contributor").default(false),
  lastActivityAt: timestamp("last_activity_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userFeedback = pgTable("user_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  feedbackType: feedbackTypeEnum("feedback_type").notNull(),
  category: text("category"),
  content: text("content").notNull(),
  rating: integer("rating"),
  screenName: text("screen_name"),
  appVersion: text("app_version"),
  deviceInfo: text("device_info"),
  isResolved: boolean("is_resolved").default(false),
  resolvedBy: varchar("resolved_by"),
  resolution: text("resolution"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const carpoolSuggestions = pgTable("carpool_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  hubId: varchar("hub_id").references(() => hubs.id),
  riderId: varchar("rider_id").references(() => users.id).notNull(),
  matchedRiderId: varchar("matched_rider_id").references(() => users.id),
  pickupLat: decimal("pickup_lat", { precision: 10, scale: 8 }).notNull(),
  pickupLng: decimal("pickup_lng", { precision: 11, scale: 8 }).notNull(),
  dropoffLat: decimal("dropoff_lat", { precision: 10, scale: 8 }).notNull(),
  dropoffLng: decimal("dropoff_lng", { precision: 11, scale: 8 }).notNull(),
  routeOverlapPercent: decimal("route_overlap_percent", { precision: 5, scale: 2 }),
  estimatedSavings: decimal("estimated_savings", { precision: 10, scale: 2 }),
  status: text("status").default("suggested"),
  acceptedAt: timestamp("accepted_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// A pool of riders sharing one three-wheeler (fare split). Each member keeps
// their own rides row (poolGroupId points here); the group is the unit a driver
// accepts. seatsFilled tracks current riders, maxSeats is the vehicle limit.
// Status: forming (waiting for co-riders) -> ready (>=2 riders, broadcast to
// drivers) -> accepted -> started -> completed | cancelled. The anchor* columns
// hold the first rider's route, used for same-direction matching.
export const sharedRideGroups = pgTable("shared_ride_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  regionCode: text("region_code").notNull(),
  currency: text("currency").default("AED").notNull(),
  serviceTypeId: varchar("service_type_id"),
  vehicleType: text("vehicle_type").notNull(),
  driverId: varchar("driver_id").references(() => drivers.id),
  vehicleId: varchar("vehicle_id").references(() => vehicles.id),
  maxSeats: integer("max_seats").default(3).notNull(),
  seatsFilled: integer("seats_filled").default(1).notNull(),
  status: text("status").default("forming").notNull(),
  anchorPickupLat: decimal("anchor_pickup_lat", { precision: 10, scale: 8 }).notNull(),
  anchorPickupLng: decimal("anchor_pickup_lng", { precision: 11, scale: 8 }).notNull(),
  anchorDropoffLat: decimal("anchor_dropoff_lat", { precision: 10, scale: 8 }).notNull(),
  anchorDropoffLng: decimal("anchor_dropoff_lng", { precision: 11, scale: 8 }).notNull(),
  routeBearing: decimal("route_bearing", { precision: 6, scale: 2 }),
  combinedFare: decimal("combined_fare", { precision: 10, scale: 2 }).default("0.00"),
  matchWindowExpiresAt: timestamp("match_window_expires_at"),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SharedRideGroup = typeof sharedRideGroups.$inferSelect;
export type InsertSharedRideGroup = typeof sharedRideGroups.$inferInsert;

export const rideEventTypeEnum = pgEnum("ride_event_type", [
  "requested", "matched", "accepted", "driver_arriving", "driver_arrived", 
  "started", "in_progress", "completed", "cancelled_rider", "cancelled_driver",
  "cancelled_system", "fare_updated", "route_deviated", "payment_initiated",
  "payment_completed", "payment_failed", "dispute_opened", "dispute_resolved",
  "tip_added", "rating_submitted", "rematch_initiated", "rematch_completed",
  "blockchain_recorded", "eta_updated",
  "offer_created", "offer_raised", "offer_expired",
  "bid_placed", "bid_accepted", "bids_closed"
]);

// Name Your Fare driver bids. One row per driver counter-offer on an open
// named-fare ride. status: active (open counter) → accepted (rider picked it,
// price frozen into the ride) | closed (another driver won / offer ended).
export const fareBidStatusEnum = pgEnum("fare_bid_status", [
  "active", "accepted", "closed"
]);

export const fareBids = pgTable("fare_bids", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rideId: varchar("ride_id").references(() => rides.id).notNull(),
  driverId: varchar("driver_id").references(() => drivers.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("AED"),
  status: fareBidStatusEnum("status").default("active").notNull(),
  // How many counters this driver has sent on this ride (anti-spam cap).
  counterCount: integer("counter_count").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  // One bid row per driver per ride — counters update the same row. This is
  // the DB-level guard that makes the API's upsert race-safe.
  unique("fare_bids_ride_driver_unique").on(table.rideId, table.driverId),
]);

export type FareBid = typeof fareBids.$inferSelect;
export type InsertFareBid = typeof fareBids.$inferInsert;

export const rideEventLog = pgTable("ride_event_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rideId: varchar("ride_id").references(() => rides.id).notNull(),
  eventType: rideEventTypeEnum("event_type").notNull(),
  actorId: varchar("actor_id"),
  actorRole: text("actor_role"),
  payload: text("payload"),
  previousState: text("previous_state"),
  newState: text("new_state"),
  correlationId: varchar("correlation_id"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const coffeeOrderStatusEnum = pgEnum("coffee_order_status", [
  "pending", "accepted", "preparing", "ready", "picked_up", "delivering", "delivered", "cancelled"
]);

export const coffeeOrderTypeEnum = pgEnum("coffee_order_type", [
  "order", "buy", "gift"
]);

export const coffeeSizeEnum = pgEnum("coffee_size", ["small", "medium", "large"]);

export const coffeeOrders = pgTable("coffee_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ordererId: varchar("orderer_id").references(() => users.id).notNull(),
  recipientId: varchar("recipient_id").references(() => users.id),
  recipientPhone: text("recipient_phone"),
  recipientName: text("recipient_name"),
  driverId: varchar("driver_id").references(() => drivers.id),
  hubId: varchar("hub_id").references(() => hubs.id),
  orderType: coffeeOrderTypeEnum("order_type").notNull(),
  status: coffeeOrderStatusEnum("status").default("pending").notNull(),
  coffeeName: text("coffee_name").notNull(),
  coffeeSize: coffeeSizeEnum("coffee_size").default("medium").notNull(),
  quantity: integer("quantity").default(1).notNull(),
  specialInstructions: text("special_instructions"),
  giftMessage: text("gift_message"),
  pickupLat: decimal("pickup_lat", { precision: 10, scale: 7 }),
  pickupLng: decimal("pickup_lng", { precision: 10, scale: 7 }),
  pickupAddress: text("pickup_address"),
  deliveryLat: decimal("delivery_lat", { precision: 10, scale: 7 }),
  deliveryLng: decimal("delivery_lng", { precision: 10, scale: 7 }),
  deliveryAddress: text("delivery_address"),
  itemPrice: decimal("item_price", { precision: 10, scale: 2 }).notNull(),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("AED").notNull(),
  paymentMethod: text("payment_method").default("card"),
  paymentStatus: text("payment_status").default("pending"),
  estimatedDeliveryMinutes: integer("estimated_delivery_minutes"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancelReason: text("cancel_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CoffeeOrder = typeof coffeeOrders.$inferSelect;
export type InsertCoffeeOrder = typeof coffeeOrders.$inferInsert;

export type Hub = typeof hubs.$inferSelect;
export type Hotspot = typeof hotspots.$inferSelect;
export type HubMessage = typeof hubMessages.$inferSelect;
export type HubReaction = typeof hubReactions.$inferSelect;
export type HubCheckIn = typeof hubCheckIns.$inferSelect;
export type CommunityPrestige = typeof communityPrestige.$inferSelect;
export type UserFeedback = typeof userFeedback.$inferSelect;
export type CarpoolSuggestion = typeof carpoolSuggestions.$inferSelect;
export type RideEventLog = typeof rideEventLog.$inferSelect;

export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  keyPrefix: varchar("key_prefix", { length: 16 }).notNull().unique(),
  keyHash: text("key_hash").notNull(),
  scopes: text("scopes").array().notNull().default(sql`'{}'::text[]`),
  isActive: boolean("is_active").default(true).notNull(),
  // Billing / plan tier — drives quota + rate limit. See PLAN_TIERS in server/partnerApi.ts
  planTier: varchar("plan_tier", { length: 24 }).notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

// Immutable per-call audit log for partner API metering (which key called which
// endpoint, when, and the response status). Written fire-and-forget so a logging
// failure never blocks a partner request.
export const apiUsageEvents = pgTable("api_usage_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  keyId: varchar("key_id").references(() => apiKeys.id).notNull(),
  ownerId: varchar("owner_id").notNull(),
  endpoint: text("endpoint").notNull(),
  method: varchar("method", { length: 8 }).notNull(),
  statusCode: integer("status_code").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ApiUsageEvent = typeof apiUsageEvents.$inferSelect;
export type InsertApiUsageEvent = typeof apiUsageEvents.$inferInsert;

// Aggregate counter per key per billing period ("YYYY-MM"). Upserted on every
// metered call so the monthly quota check is a single indexed read.
export const apiUsageCounters = pgTable("api_usage_counters", {
  keyId: varchar("key_id").references(() => apiKeys.id).notNull(),
  period: varchar("period", { length: 7 }).notNull(),
  callCount: integer("call_count").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.keyId, t.period] }),
}));

export type ApiUsageCounter = typeof apiUsageCounters.$inferSelect;
export type InsertApiUsageCounter = typeof apiUsageCounters.$inferInsert;

// Shared (Postgres-backed) fixed-window rate limiter state. One row per key per
// 60s window bucket. Replaces the old in-memory sliding window so the per-minute
// limit survives restarts/deploys and stays consistent across load-balanced
// instances. windowStart is the UTC minute boundary the hits belong to.
export const apiRateLimits = pgTable("api_rate_limits", {
  keyId: varchar("key_id").references(() => apiKeys.id).notNull(),
  windowStart: timestamp("window_start").notNull(),
  hitCount: integer("hit_count").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.keyId, t.windowStart] }),
}));

export type ApiRateLimit = typeof apiRateLimits.$inferSelect;
export type InsertApiRateLimit = typeof apiRateLimits.$inferInsert;

// Persists each Telegram rider chat's in-progress booking wizard state so that
// riders mid-booking are not lost when the backend restarts. Keyed by chat id;
// rows are deleted once the booking completes or is cancelled.
export const telegramBookingSessions = pgTable("telegram_booking_sessions", {
  chatId: varchar("chat_id").primaryKey(),
  data: text("data").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type TelegramBookingSession = typeof telegramBookingSessions.$inferSelect;
export type InsertTelegramBookingSession = typeof telegramBookingSessions.$inferInsert;

// ---------------------------------------------------------------------------
// Social layer: follows between users + published / Twitch-streamed rides.
// ---------------------------------------------------------------------------

export const userFollows = pgTable("user_follows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  followerId: varchar("follower_id").references(() => users.id).notNull(),
  followingId: varchar("following_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  // One follow edge per pair — makes follow requests idempotent/race-safe.
  unique("user_follows_pair_unique").on(table.followerId, table.followingId),
]);

export type UserFollow = typeof userFollows.$inferSelect;
export type InsertUserFollow = typeof userFollows.$inferInsert;

export const ridePostTypeEnum = pgEnum("ride_post_type", ["published", "stream"]);

// A ride shared to the social feed. type="published" is an after-ride card;
// type="stream" is a live Twitch broadcast of an in-progress ride. Privacy:
// only server-derived, coarse fields are stored (city name, distance) — never
// addresses or coordinates. twitchChannel is snapshotted at post time.
export const ridePosts = pgTable("ride_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rideId: varchar("ride_id").references(() => rides.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: ridePostTypeEnum("type").notNull(),
  twitchChannel: text("twitch_channel"),
  caption: text("caption"),
  // Optional rider photo attached when sharing a ride memory to the feed.
  // Stored inline as a compressed data URL (validated + size-capped server-side).
  photoUrl: text("photo_url"),
  cityName: text("city_name"),
  distanceKm: decimal("distance_km", { precision: 8, scale: 2 }),
  isLive: boolean("is_live").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
});

export type RidePost = typeof ridePosts.$inferSelect;
export type InsertRidePost = typeof ridePosts.$inferInsert;

// A reaction on a feed post. One reaction per (post, user) — changing your
// reaction replaces the row (upsert), removing it deletes the row.
export const ridePostReactions = pgTable("ride_post_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").references(() => ridePosts.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("ride_post_reactions_user_unique").on(table.postId, table.userId),
]);

export type RidePostReaction = typeof ridePostReactions.$inferSelect;
export type InsertRidePostReaction = typeof ridePostReactions.$inferInsert;

// A comment on a feed post. Kept short (server-capped) and only ever exposes
// the author's public fields (id / name / avatar).
export const ridePostComments = pgTable("ride_post_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").references(() => ridePosts.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type RidePostComment = typeof ridePostComments.$inferSelect;
export type InsertRidePostComment = typeof ridePostComments.$inferInsert;
