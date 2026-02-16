import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["customer", "driver", "admin", "fleet_owner"]);
export const rideStatusEnum = pgEnum("ride_status", ["pending", "accepted", "arriving", "started", "in_progress", "completed", "cancelled"]);
export const riderPriorityEnum = pgEnum("rider_priority", ["fastest", "cheapest", "reliable"]);
export const paymentMethodEnum = pgEnum("payment_method", ["card", "cash", "wallet", "usdt"]);
export const driverStatusEnum = pgEnum("driver_status", ["pending", "approved", "rejected", "suspended"]);
export const vehicleTypeEnum = pgEnum("vehicle_type", ["economy", "comfort", "premium", "xl", "moto", "rickshaw", "tuktuk", "minibus", "cng", "auto_rickshaw", "motorcycle", "suv", "minivan"]);
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const drivers = pgTable("drivers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
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

export const documentTypeEnum = pgEnum("document_type", ["id_card", "drivers_license", "vehicle_registration", "insurance", "selfie_video"]);
export const documentStatusEnum = pgEnum("document_status", ["pending", "approved", "rejected", "expired"]);
export const cityLaunchStatusEnum = pgEnum("city_launch_status", ["pre_launch", "internal_driver_test", "controlled_real_driver_access", "invite_only_riders", "supply_seeding", "density_validation", "soft_launch", "active", "paused"]);
export const driverTagEnum = pgEnum("driver_tag", ["founding_driver", "city_champion", "top_performer", "trusted", "new"]);
export const testCategoryEnum = pgEnum("test_category", ["account_lifecycle", "identity_verification", "education_activation", "online_offline", "ride_assignment", "pricing_earnings", "ride_flow", "ratings_feedback", "disputes", "safety_emergency", "notifications_bots", "abuse_fraud"]);
export const championStatusEnum = pgEnum("champion_status", ["pending", "active", "suspended", "retired"]);
export const educationModuleStatusEnum = pgEnum("education_module_status", ["not_started", "in_progress", "completed"]);
export const intakeChannelEnum = pgEnum("intake_channel", ["facebook", "whatsapp", "telegram", "referral", "website", "other"]);
export const pmgthSessionStatusEnum = pgEnum("pmgth_session_status", ["active", "completed", "expired", "cancelled"]);

export const hubTypeEnum = pgEnum("hub_type", ["station", "park", "coworking", "coffee_shop", "mall", "airport", "university", "hospital", "custom"]);
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
});

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
});

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

export type Hub = typeof hubs.$inferSelect;
export type Hotspot = typeof hotspots.$inferSelect;
export type HubMessage = typeof hubMessages.$inferSelect;
export type HubReaction = typeof hubReactions.$inferSelect;
export type HubCheckIn = typeof hubCheckIns.$inferSelect;
export type CommunityPrestige = typeof communityPrestige.$inferSelect;
export type UserFeedback = typeof userFeedback.$inferSelect;
export type CarpoolSuggestion = typeof carpoolSuggestions.$inferSelect;
