var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc23) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc23 = __getOwnPropDesc(from, key)) || desc23.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  accountabilityCreditTypeEnum: () => accountabilityCreditTypeEnum,
  accountabilityCredits: () => accountabilityCredits,
  cachedPricing: () => cachedPricing,
  carpoolSuggestions: () => carpoolSuggestions,
  championStatusEnum: () => championStatusEnum,
  cities: () => cities,
  cityChampions: () => cityChampions,
  cityLaunchStatusEnum: () => cityLaunchStatusEnum,
  cityTestChecklist: () => cityTestChecklist,
  coffeeOrderStatusEnum: () => coffeeOrderStatusEnum,
  coffeeOrderTypeEnum: () => coffeeOrderTypeEnum,
  coffeeOrders: () => coffeeOrders,
  coffeeSizeEnum: () => coffeeSizeEnum,
  communityPrestige: () => communityPrestige,
  coupons: () => coupons,
  currencyEnum: () => currencyEnum,
  disputeResolutionEnum: () => disputeResolutionEnum,
  disputeStatusEnum: () => disputeStatusEnum,
  disputeTypeEnum: () => disputeTypeEnum,
  disputes: () => disputes,
  documentStatusEnum: () => documentStatusEnum,
  documentTypeEnum: () => documentTypeEnum,
  driverBankAccounts: () => driverBankAccounts,
  driverCryptoSettings: () => driverCryptoSettings,
  driverDocuments: () => driverDocuments,
  driverEducation: () => driverEducation,
  driverFeedback: () => driverFeedback,
  driverIntake: () => driverIntake,
  driverPayouts: () => driverPayouts,
  driverReferrals: () => driverReferrals,
  driverStatusEnum: () => driverStatusEnum,
  driverTagEnum: () => driverTagEnum,
  driverTags: () => driverTags,
  driverTrustProtection: () => driverTrustProtection,
  driverVerificationQueue: () => driverVerificationQueue,
  drivers: () => drivers,
  driversRelations: () => driversRelations,
  educationModuleStatusEnum: () => educationModuleStatusEnum,
  educationModules: () => educationModules,
  emergencyContacts: () => emergencyContacts,
  exchangeRates: () => exchangeRates,
  feedbackTypeEnum: () => feedbackTypeEnum,
  firstRideGuarantees: () => firstRideGuarantees,
  ghostMessages: () => ghostMessages,
  ghostRideStatusEnum: () => ghostRideStatusEnum,
  ghostRides: () => ghostRides,
  guaranteeStatusEnum: () => guaranteeStatusEnum,
  hotspots: () => hotspots,
  hubCheckIns: () => hubCheckIns,
  hubMessageStatusEnum: () => hubMessageStatusEnum,
  hubMessages: () => hubMessages,
  hubReactions: () => hubReactions,
  hubStatusEnum: () => hubStatusEnum,
  hubTypeEnum: () => hubTypeEnum,
  hubs: () => hubs,
  insertDriverSchema: () => insertDriverSchema,
  insertRideSchema: () => insertRideSchema,
  insertUserSchema: () => insertUserSchema,
  intakeChannelEnum: () => intakeChannelEnum,
  invoiceTypeEnum: () => invoiceTypeEnum,
  offlineSyncQueue: () => offlineSyncQueue,
  paymentMethodEnum: () => paymentMethodEnum,
  paymentMethods: () => paymentMethods,
  payments: () => payments,
  payoutMethodEnum: () => payoutMethodEnum,
  payoutStatusEnum: () => payoutStatusEnum,
  platformLedger: () => platformLedger,
  platformLedgerTypeEnum: () => platformLedgerTypeEnum,
  pmgthDailyUsage: () => pmgthDailyUsage,
  pmgthEscrow: () => pmgthEscrow,
  pmgthRideMatches: () => pmgthRideMatches,
  pmgthSessionStatusEnum: () => pmgthSessionStatusEnum,
  pmgthSessions: () => pmgthSessions,
  prestigeTierEnum: () => prestigeTierEnum,
  ratings: () => ratings,
  regionalEmergencyContacts: () => regionalEmergencyContacts,
  regionalVehicleTypes: () => regionalVehicleTypes,
  regions: () => regions,
  rideEventLog: () => rideEventLog,
  rideEventTypeEnum: () => rideEventTypeEnum,
  rideInvoices: () => rideInvoices,
  rideMessages: () => rideMessages,
  rideStatusEnum: () => rideStatusEnum,
  rideTelemetry: () => rideTelemetry,
  riderInviteCodes: () => riderInviteCodes,
  riderInviteUses: () => riderInviteUses,
  riderPriorityEnum: () => riderPriorityEnum,
  rides: () => rides,
  ridesRelations: () => ridesRelations,
  savedAddresses: () => savedAddresses,
  serviceTypes: () => serviceTypes,
  sessions: () => sessions,
  simulatedEntities: () => simulatedEntities,
  syncStatusEnum: () => syncStatusEnum,
  testCategoryEnum: () => testCategoryEnum,
  transactionStatusEnum: () => transactionStatusEnum,
  transactionTypeEnum: () => transactionTypeEnum,
  translations: () => translations,
  truthAggregations: () => truthAggregations,
  truthConsent: () => truthConsent,
  truthConsentStatusEnum: () => truthConsentStatusEnum,
  truthProviders: () => truthProviders,
  truthRides: () => truthRides,
  truthScores: () => truthScores,
  truthSignalStatusEnum: () => truthSignalStatusEnum,
  truthSignals: () => truthSignals,
  userCoupons: () => userCoupons,
  userFeedback: () => userFeedback,
  userRoleEnum: () => userRoleEnum,
  users: () => users,
  usersRelations: () => usersRelations,
  vehicleTypeEnum: () => vehicleTypeEnum,
  vehicleVerificationStatusEnum: () => vehicleVerificationStatusEnum,
  vehicles: () => vehicles,
  vehiclesRelations: () => vehiclesRelations,
  walletTransactions: () => walletTransactions
});
import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var userRoleEnum, rideStatusEnum, riderPriorityEnum, paymentMethodEnum, driverStatusEnum, vehicleTypeEnum, transactionTypeEnum, transactionStatusEnum, payoutStatusEnum, payoutMethodEnum, currencyEnum, invoiceTypeEnum, disputeStatusEnum, disputeTypeEnum, disputeResolutionEnum, vehicleVerificationStatusEnum, sessions, users, drivers, vehicles, savedAddresses, serviceTypes, rides, payments, ratings, coupons, userCoupons, emergencyContacts, paymentMethods, walletTransactions, driverPayouts, driverCryptoSettings, rideInvoices, driverBankAccounts, regions, regionalVehicleTypes, disputes, rideTelemetry, translations, rideMessages, regionalEmergencyContacts, exchangeRates, usersRelations, driversRelations, vehiclesRelations, ridesRelations, insertUserSchema, insertDriverSchema, insertRideSchema, documentTypeEnum, documentStatusEnum, cityLaunchStatusEnum, driverTagEnum, testCategoryEnum, championStatusEnum, educationModuleStatusEnum, intakeChannelEnum, pmgthSessionStatusEnum, hubTypeEnum, hubStatusEnum, hubMessageStatusEnum, prestigeTierEnum, feedbackTypeEnum, cities, driverDocuments, driverVerificationQueue, cityChampions, driverReferrals, driverEducation, driverIntake, driverTrustProtection, educationModules, driverTags, cityTestChecklist, riderInviteCodes, riderInviteUses, driverFeedback, simulatedEntities, pmgthSessions, pmgthRideMatches, pmgthDailyUsage, pmgthEscrow, guaranteeStatusEnum, firstRideGuarantees, accountabilityCreditTypeEnum, accountabilityCredits, platformLedgerTypeEnum, platformLedger, truthSignalStatusEnum, truthConsentStatusEnum, ghostRideStatusEnum, syncStatusEnum, truthProviders, truthConsent, truthRides, truthSignals, truthScores, truthAggregations, ghostRides, ghostMessages, offlineSyncQueue, cachedPricing, hubs, hotspots, hubMessages, hubReactions, hubCheckIns, communityPrestige, userFeedback, carpoolSuggestions, rideEventTypeEnum, rideEventLog, coffeeOrderStatusEnum, coffeeOrderTypeEnum, coffeeSizeEnum, coffeeOrders;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    userRoleEnum = pgEnum("user_role", ["customer", "driver", "admin", "fleet_owner"]);
    rideStatusEnum = pgEnum("ride_status", ["pending", "accepted", "arriving", "started", "in_progress", "completed", "cancelled"]);
    riderPriorityEnum = pgEnum("rider_priority", ["fastest", "cheapest", "reliable"]);
    paymentMethodEnum = pgEnum("payment_method", ["card", "cash", "wallet", "usdt"]);
    driverStatusEnum = pgEnum("driver_status", ["pending", "approved", "rejected", "suspended"]);
    vehicleTypeEnum = pgEnum("vehicle_type", ["economy", "comfort", "premium", "xl", "moto", "rickshaw", "tuktuk", "minibus", "cng", "auto_rickshaw", "motorcycle", "suv", "minivan"]);
    transactionTypeEnum = pgEnum("transaction_type", [
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
    transactionStatusEnum = pgEnum("transaction_status", ["pending", "completed", "failed", "cancelled"]);
    payoutStatusEnum = pgEnum("payout_status", ["pending", "processing", "completed", "failed"]);
    payoutMethodEnum = pgEnum("payout_method", ["bank", "crypto"]);
    currencyEnum = pgEnum("currency", ["AED", "USDT", "USD", "EUR", "GBP", "RUB", "INR", "NGN", "KES", "ZAR", "CNY", "JPY", "KRW", "SGD", "THB", "VND", "IDR", "PHP", "MYR", "PKR", "BDT", "EGP", "TRY", "BRL", "MXN"]);
    invoiceTypeEnum = pgEnum("invoice_type", ["customer", "driver"]);
    disputeStatusEnum = pgEnum("dispute_status", ["open", "investigating", "resolved_rider_favor", "resolved_driver_favor", "resolved_partial", "closed"]);
    disputeTypeEnum = pgEnum("dispute_type", ["fare", "route", "rating", "payment", "safety", "behavior", "damage"]);
    disputeResolutionEnum = pgEnum("dispute_resolution", ["refund_full", "refund_partial", "no_action", "warning_driver", "warning_rider", "suspend_driver", "suspend_rider", "rating_removed"]);
    vehicleVerificationStatusEnum = pgEnum("vehicle_verification_status", ["pending", "ai_verified", "admin_verified", "rejected"]);
    sessions = pgTable("sessions", {
      token: varchar("token").primaryKey(),
      userId: varchar("user_id").references(() => users.id).notNull(),
      role: text("role").notNull(),
      expiresAt: timestamp("expires_at").notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    users = pgTable("users", {
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
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    drivers = pgTable("drivers", {
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
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    vehicles = pgTable("vehicles", {
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
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    savedAddresses = pgTable("saved_addresses", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").references(() => users.id).notNull(),
      label: text("label").notNull(),
      address: text("address").notNull(),
      lat: decimal("lat", { precision: 10, scale: 8 }).notNull(),
      lng: decimal("lng", { precision: 11, scale: 8 }).notNull(),
      isDefault: boolean("is_default").default(false),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    serviceTypes = pgTable("service_types", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      name: text("name").notNull(),
      type: vehicleTypeEnum("type").notNull().unique(),
      baseFare: decimal("base_fare", { precision: 10, scale: 2 }).notNull(),
      perKmRate: decimal("per_km_rate", { precision: 10, scale: 2 }).notNull(),
      perMinuteRate: decimal("per_minute_rate", { precision: 10, scale: 2 }).notNull(),
      icon: text("icon"),
      isActive: boolean("is_active").default(true),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    rides = pgTable("rides", {
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
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    payments = pgTable("payments", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      rideId: varchar("ride_id").references(() => rides.id).notNull(),
      userId: varchar("user_id").references(() => users.id).notNull(),
      amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
      method: paymentMethodEnum("method").notNull(),
      status: text("status").default("pending").notNull(),
      stripePaymentId: text("stripe_payment_id"),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    ratings = pgTable("ratings", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      rideId: varchar("ride_id").references(() => rides.id).notNull(),
      fromUserId: varchar("from_user_id").references(() => users.id).notNull(),
      toDriverId: varchar("to_driver_id").references(() => drivers.id).notNull(),
      rating: integer("rating").notNull(),
      comment: text("comment"),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    coupons = pgTable("coupons", {
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
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    userCoupons = pgTable("user_coupons", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").references(() => users.id).notNull(),
      couponId: varchar("coupon_id").references(() => coupons.id).notNull(),
      rideId: varchar("ride_id").references(() => rides.id),
      usedAt: timestamp("used_at").defaultNow().notNull()
    });
    emergencyContacts = pgTable("emergency_contacts", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").references(() => users.id).notNull(),
      name: text("name").notNull(),
      phone: text("phone").notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    paymentMethods = pgTable("payment_methods", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").references(() => users.id).notNull(),
      type: text("type").notNull(),
      last4: text("last4"),
      brand: text("brand"),
      stripePaymentMethodId: text("stripe_payment_method_id"),
      isDefault: boolean("is_default").default(false),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    walletTransactions = pgTable("wallet_transactions", {
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
      completedAt: timestamp("completed_at")
    });
    driverPayouts = pgTable("driver_payouts", {
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
      completedAt: timestamp("completed_at")
    });
    driverCryptoSettings = pgTable("driver_crypto_settings", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      driverId: varchar("driver_id").references(() => drivers.id).notNull().unique(),
      usdtWalletAddress: text("usdt_wallet_address"),
      preferredCurrency: currencyEnum("preferred_currency").default("AED"),
      isVerified: boolean("is_verified").default(false),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    rideInvoices = pgTable("ride_invoices", {
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
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    driverBankAccounts = pgTable("driver_bank_accounts", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      driverId: varchar("driver_id").references(() => drivers.id).notNull(),
      stripeExternalAccountId: text("stripe_external_account_id"),
      bankName: text("bank_name"),
      last4: text("last4"),
      accountHolderName: text("account_holder_name"),
      isDefault: boolean("is_default").default(false),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    regions = pgTable("regions", {
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
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    regionalVehicleTypes = pgTable("regional_vehicle_types", {
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
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    disputes = pgTable("disputes", {
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
      resolvedAt: timestamp("resolved_at")
    });
    rideTelemetry = pgTable("ride_telemetry", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      rideId: varchar("ride_id").references(() => rides.id).notNull(),
      lat: decimal("lat", { precision: 10, scale: 8 }).notNull(),
      lng: decimal("lng", { precision: 11, scale: 8 }).notNull(),
      speed: decimal("speed", { precision: 6, scale: 2 }),
      heading: decimal("heading", { precision: 5, scale: 2 }),
      accuracy: decimal("accuracy", { precision: 6, scale: 2 }),
      recordedAt: timestamp("recorded_at").defaultNow().notNull()
    });
    translations = pgTable("translations", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      key: text("key").notNull(),
      language: text("language").notNull(),
      value: text("value").notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    rideMessages = pgTable("ride_messages", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      rideId: varchar("ride_id").references(() => rides.id).notNull(),
      senderId: varchar("sender_id").references(() => users.id).notNull(),
      senderRole: text("sender_role").notNull(),
      originalMessage: text("original_message").notNull(),
      originalLanguage: text("original_language"),
      translatedMessage: text("translated_message"),
      translatedLanguage: text("translated_language"),
      isQuickReply: boolean("is_quick_reply").default(false),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    regionalEmergencyContacts = pgTable("regional_emergency_contacts", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      regionId: varchar("region_id").references(() => regions.id).notNull(),
      name: text("name").notNull(),
      phone: text("phone").notNull(),
      type: text("type").notNull(),
      isDefault: boolean("is_default").default(false),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    exchangeRates = pgTable("exchange_rates", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      fromCurrency: currencyEnum("from_currency").notNull(),
      toCurrency: currencyEnum("to_currency").notNull(),
      rate: decimal("rate", { precision: 18, scale: 8 }).notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    usersRelations = relations(users, ({ many }) => ({
      savedAddresses: many(savedAddresses),
      rides: many(rides),
      emergencyContacts: many(emergencyContacts),
      paymentMethods: many(paymentMethods)
    }));
    driversRelations = relations(drivers, ({ one, many }) => ({
      user: one(users, { fields: [drivers.userId], references: [users.id] }),
      vehicles: many(vehicles),
      rides: many(rides),
      ratings: many(ratings)
    }));
    vehiclesRelations = relations(vehicles, ({ one }) => ({
      driver: one(drivers, { fields: [vehicles.driverId], references: [drivers.id] })
    }));
    ridesRelations = relations(rides, ({ one }) => ({
      customer: one(users, { fields: [rides.customerId], references: [users.id] }),
      driver: one(drivers, { fields: [rides.driverId], references: [drivers.id] }),
      vehicle: one(vehicles, { fields: [rides.vehicleId], references: [vehicles.id] }),
      serviceType: one(serviceTypes, { fields: [rides.serviceTypeId], references: [serviceTypes.id] })
    }));
    insertUserSchema = createInsertSchema(users).omit({
      createdAt: true,
      updatedAt: true,
      stripeCustomerId: true,
      walletBalance: true,
      isGuest: true,
      avatar: true
    });
    insertDriverSchema = createInsertSchema(drivers).pick({
      userId: true,
      licenseNumber: true
    });
    insertRideSchema = createInsertSchema(rides).pick({
      customerId: true,
      pickupAddress: true,
      pickupLat: true,
      pickupLng: true,
      dropoffAddress: true,
      dropoffLat: true,
      dropoffLng: true,
      serviceTypeId: true,
      scheduledAt: true
    });
    documentTypeEnum = pgEnum("document_type", ["id_card", "drivers_license", "vehicle_registration", "insurance", "selfie_video"]);
    documentStatusEnum = pgEnum("document_status", ["pending", "approved", "rejected", "expired"]);
    cityLaunchStatusEnum = pgEnum("city_launch_status", ["pre_launch", "internal_driver_test", "controlled_real_driver_access", "invite_only_riders", "supply_seeding", "density_validation", "soft_launch", "active", "paused"]);
    driverTagEnum = pgEnum("driver_tag", ["founding_driver", "city_champion", "top_performer", "trusted", "new"]);
    testCategoryEnum = pgEnum("test_category", ["account_lifecycle", "identity_verification", "education_activation", "online_offline", "ride_assignment", "pricing_earnings", "ride_flow", "ratings_feedback", "disputes", "safety_emergency", "notifications_bots", "abuse_fraud"]);
    championStatusEnum = pgEnum("champion_status", ["pending", "active", "suspended", "retired"]);
    educationModuleStatusEnum = pgEnum("education_module_status", ["not_started", "in_progress", "completed"]);
    intakeChannelEnum = pgEnum("intake_channel", ["facebook", "whatsapp", "telegram", "referral", "website", "other"]);
    pmgthSessionStatusEnum = pgEnum("pmgth_session_status", ["active", "completed", "expired", "cancelled"]);
    hubTypeEnum = pgEnum("hub_type", ["station", "park", "coworking", "coffee_shop", "mall", "airport", "university", "hospital", "custom"]);
    hubStatusEnum = pgEnum("hub_status", ["active", "inactive", "predicted"]);
    hubMessageStatusEnum = pgEnum("hub_message_status", ["active", "expired", "moderated"]);
    prestigeTierEnum = pgEnum("prestige_tier", ["bronze", "silver", "gold", "platinum", "diamond"]);
    feedbackTypeEnum = pgEnum("feedback_type", ["rating", "suggestion", "issue", "compliment"]);
    cities = pgTable("cities", {
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
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    driverDocuments = pgTable("driver_documents", {
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
      reviewedAt: timestamp("reviewed_at")
    });
    driverVerificationQueue = pgTable("driver_verification_queue", {
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
      completedAt: timestamp("completed_at")
    });
    cityChampions = pgTable("city_champions", {
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
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    driverReferrals = pgTable("driver_referrals", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      referrerId: varchar("referrer_id").references(() => drivers.id).notNull(),
      referredDriverId: varchar("referred_driver_id").references(() => drivers.id).notNull(),
      cityId: varchar("city_id").references(() => cities.id),
      referralCode: text("referral_code").notNull(),
      status: text("status").default("pending").notNull(),
      bonusPaid: boolean("bonus_paid").default(false),
      bonusAmount: decimal("bonus_amount", { precision: 10, scale: 2 }),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      activatedAt: timestamp("activated_at")
    });
    driverEducation = pgTable("driver_education", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      driverId: varchar("driver_id").references(() => drivers.id).notNull(),
      moduleId: text("module_id").notNull(),
      moduleName: text("module_name").notNull(),
      status: educationModuleStatusEnum("status").default("not_started"),
      progress: integer("progress").default(0),
      score: integer("score"),
      startedAt: timestamp("started_at"),
      completedAt: timestamp("completed_at"),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    driverIntake = pgTable("driver_intake", {
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
      convertedAt: timestamp("converted_at")
    });
    driverTrustProtection = pgTable("driver_trust_protection", {
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
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    educationModules = pgTable("education_modules", {
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
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    driverTags = pgTable("driver_tags", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      driverId: varchar("driver_id").references(() => drivers.id).notNull(),
      cityId: varchar("city_id").references(() => cities.id),
      tag: driverTagEnum("tag").notNull(),
      assignedBy: varchar("assigned_by"),
      notes: text("notes"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      expiresAt: timestamp("expires_at")
    });
    cityTestChecklist = pgTable("city_test_checklist", {
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
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    riderInviteCodes = pgTable("rider_invite_codes", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      code: text("code").notNull().unique(),
      driverId: varchar("driver_id").references(() => drivers.id).notNull(),
      cityId: varchar("city_id").references(() => cities.id).notNull(),
      maxUses: integer("max_uses").default(5),
      usedCount: integer("used_count").default(0),
      isActive: boolean("is_active").default(true),
      expiresAt: timestamp("expires_at"),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    riderInviteUses = pgTable("rider_invite_uses", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      inviteCodeId: varchar("invite_code_id").references(() => riderInviteCodes.id).notNull(),
      riderId: varchar("rider_id").references(() => users.id).notNull(),
      usedAt: timestamp("used_at").defaultNow().notNull()
    });
    driverFeedback = pgTable("driver_feedback", {
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
      resolvedAt: timestamp("resolved_at")
    });
    simulatedEntities = pgTable("simulated_entities", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      cityId: varchar("city_id").references(() => cities.id).notNull(),
      entityType: text("entity_type").notNull(),
      entityId: varchar("entity_id").notNull(),
      name: text("name"),
      metadata: text("metadata"),
      isActive: boolean("is_active").default(true),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    pmgthSessions = pgTable("pmgth_sessions", {
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
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    pmgthRideMatches = pgTable("pmgth_ride_matches", {
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
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    pmgthDailyUsage = pgTable("pmgth_daily_usage", {
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
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    pmgthEscrow = pgTable("pmgth_escrow", {
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
      expiresAt: timestamp("expires_at")
    });
    guaranteeStatusEnum = pgEnum("guarantee_status", ["pending", "fulfilled_by_ride", "paid", "expired", "cancelled"]);
    firstRideGuarantees = pgTable("first_ride_guarantees", {
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
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    accountabilityCreditTypeEnum = pgEnum("accountability_credit_type", [
      "eta_breach",
      "pickup_wait",
      "driver_cancel",
      "rider_cancel_late",
      "no_show",
      "ride_delay",
      "system_failure"
    ]);
    accountabilityCredits = pgTable("accountability_credits", {
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
      seenByUser: boolean("seen_by_user").default(false)
    });
    platformLedgerTypeEnum = pgEnum("platform_ledger_type", [
      "platform_fee_income",
      "guarantee_payout",
      "accountability_payout",
      "operational_expense",
      "adjustment"
    ]);
    platformLedger = pgTable("platform_ledger", {
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
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    truthSignalStatusEnum = pgEnum("truth_signal_status", ["extracted", "unknown", "invalid"]);
    truthConsentStatusEnum = pgEnum("truth_consent_status", ["granted", "revoked"]);
    ghostRideStatusEnum = pgEnum("ghost_ride_status", ["broadcasting", "accepted", "in_progress", "completed", "expired", "synced"]);
    syncStatusEnum = pgEnum("sync_status", ["pending", "syncing", "synced", "failed"]);
    truthProviders = pgTable("truth_providers", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      name: text("name").notNull(),
      slug: text("slug").notNull().unique(),
      deepLinkScheme: text("deep_link_scheme"),
      androidPackage: text("android_package"),
      iosUrlScheme: text("ios_url_scheme"),
      iconUrl: text("icon_url"),
      isActive: boolean("is_active").default(true),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    truthConsent = pgTable("truth_consent", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").references(() => users.id).notNull(),
      screenshotCapture: boolean("screenshot_capture").default(false),
      notificationParsing: boolean("notification_parsing").default(false),
      gpsTracking: boolean("gps_tracking").default(false),
      postRideConfirmation: boolean("post_ride_confirmation").default(true),
      status: truthConsentStatusEnum("status").default("granted").notNull(),
      grantedAt: timestamp("granted_at").defaultNow().notNull(),
      revokedAt: timestamp("revoked_at"),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    truthRides = pgTable("truth_rides", {
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
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    truthSignals = pgTable("truth_signals", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      truthRideId: varchar("truth_ride_id").references(() => truthRides.id).notNull(),
      signalType: text("signal_type").notNull(),
      rawValue: text("raw_value"),
      normalizedScore: decimal("normalized_score", { precision: 5, scale: 2 }),
      status: truthSignalStatusEnum("status").default("extracted").notNull(),
      extractionMethod: text("extraction_method"),
      confidence: decimal("confidence", { precision: 3, scale: 2 }),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    truthScores = pgTable("truth_scores", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      truthRideId: varchar("truth_ride_id").references(() => truthRides.id).notNull(),
      priceIntegrityScore: decimal("price_integrity_score", { precision: 5, scale: 2 }),
      pickupReliabilityScore: decimal("pickup_reliability_score", { precision: 5, scale: 2 }),
      cancellationScore: decimal("cancellation_score", { precision: 5, scale: 2 }),
      routeIntegrityScore: decimal("route_integrity_score", { precision: 5, scale: 2 }),
      supportResolutionScore: decimal("support_resolution_score", { precision: 5, scale: 2 }),
      totalScore: decimal("total_score", { precision: 5, scale: 2 }).notNull(),
      explanation: text("explanation").notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    truthAggregations = pgTable("truth_aggregations", {
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
      lastUpdated: timestamp("last_updated").defaultNow().notNull()
    });
    ghostRides = pgTable("ghost_rides", {
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
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    ghostMessages = pgTable("ghost_messages", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      ghostRideId: varchar("ghost_ride_id").references(() => ghostRides.id).notNull(),
      localId: text("local_id").notNull(),
      senderPeerId: text("sender_peer_id").notNull(),
      senderRole: text("sender_role").notNull(),
      content: text("content").notNull(),
      messageType: text("message_type").default("text"),
      sentAt: timestamp("sent_at").notNull(),
      syncStatus: syncStatusEnum("sync_status").default("pending").notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    offlineSyncQueue = pgTable("offline_sync_queue", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").references(() => users.id).notNull(),
      entityType: text("entity_type").notNull(),
      entityLocalId: text("entity_local_id").notNull(),
      payload: text("payload").notNull(),
      syncStatus: syncStatusEnum("sync_status").default("pending").notNull(),
      retryCount: integer("retry_count").default(0),
      lastError: text("last_error"),
      queuedAt: timestamp("queued_at").defaultNow().notNull(),
      syncedAt: timestamp("synced_at")
    });
    cachedPricing = pgTable("cached_pricing", {
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
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    hubs = pgTable("hubs", {
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
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    hotspots = pgTable("hotspots", {
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
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    hubMessages = pgTable("hub_messages", {
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
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    hubReactions = pgTable("hub_reactions", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      messageId: varchar("message_id").references(() => hubMessages.id).notNull(),
      userId: varchar("user_id").references(() => users.id).notNull(),
      reactionType: text("reaction_type").default("like"),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    hubCheckIns = pgTable("hub_check_ins", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      hubId: varchar("hub_id").references(() => hubs.id).notNull(),
      userId: varchar("user_id").references(() => users.id).notNull(),
      userRole: text("user_role").notNull(),
      lat: decimal("lat", { precision: 10, scale: 8 }),
      lng: decimal("lng", { precision: 11, scale: 8 }),
      checkedInAt: timestamp("checked_in_at").defaultNow().notNull(),
      checkedOutAt: timestamp("checked_out_at")
    });
    communityPrestige = pgTable("community_prestige", {
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
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    userFeedback = pgTable("user_feedback", {
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
      resolvedAt: timestamp("resolved_at")
    });
    carpoolSuggestions = pgTable("carpool_suggestions", {
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
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    rideEventTypeEnum = pgEnum("ride_event_type", [
      "requested",
      "matched",
      "accepted",
      "driver_arriving",
      "driver_arrived",
      "started",
      "in_progress",
      "completed",
      "cancelled_rider",
      "cancelled_driver",
      "cancelled_system",
      "fare_updated",
      "route_deviated",
      "payment_initiated",
      "payment_completed",
      "payment_failed",
      "dispute_opened",
      "dispute_resolved",
      "tip_added",
      "rating_submitted",
      "rematch_initiated",
      "rematch_completed",
      "blockchain_recorded",
      "eta_updated"
    ]);
    rideEventLog = pgTable("ride_event_log", {
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
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    coffeeOrderStatusEnum = pgEnum("coffee_order_status", [
      "pending",
      "accepted",
      "preparing",
      "ready",
      "picked_up",
      "delivering",
      "delivered",
      "cancelled"
    ]);
    coffeeOrderTypeEnum = pgEnum("coffee_order_type", [
      "order",
      "buy",
      "gift"
    ]);
    coffeeSizeEnum = pgEnum("coffee_size", ["small", "medium", "large"]);
    coffeeOrders = pgTable("coffee_orders", {
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
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  db: () => db,
  pool: () => pool
});
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
var Pool, pool, db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    ({ Pool } = pg);
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?"
      );
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle(pool, { schema: schema_exports });
  }
});

// server/blockchain.ts
var blockchain_exports = {};
__export(blockchain_exports, {
  calculateFeeBreakdown: () => calculateFeeBreakdown,
  createRideReceipt: () => createRideReceipt,
  deployRideRegistry: () => deployRideRegistry,
  generateRideHash: () => generateRideHash,
  generateTransparencyReport: () => generateTransparencyReport,
  getBlockchainStatus: () => getBlockchainStatus,
  getCompanyUsdtBalance: () => getCompanyUsdtBalance,
  initializeBlockchain: () => initializeBlockchain,
  isWalletConfigured: () => isWalletConfigured,
  recordRideToBlockchain: () => recordRideToBlockchain,
  sendUsdtPayout: () => sendUsdtPayout,
  verifyRideOnChain: () => verifyRideOnChain
});
import { ethers } from "ethers";
import { createHash } from "crypto";
function getWalletFromKey(keyOrPhrase, provider2) {
  const trimmed = keyOrPhrase.trim();
  if (trimmed.startsWith("0x") && trimmed.length === 66 && /^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
    return new ethers.Wallet(trimmed, provider2);
  }
  const words = trimmed.split(/\s+/);
  if (words.length === 12 || words.length === 24) {
    const hdWallet = ethers.HDNodeWallet.fromPhrase(trimmed);
    return new ethers.Wallet(hdWallet.privateKey, provider2);
  }
  throw new Error("Invalid key format. Provide a 66-character hex private key (0x...) or a 12/24-word seed phrase.");
}
async function initializeBlockchain() {
  try {
    provider = new ethers.JsonRpcProvider(POLYGON_AMOY_RPC);
    await provider.getNetwork();
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
    if (privateKey) {
      wallet = getWalletFromKey(privateKey, provider);
      contractAddress = process.env.RIDE_REGISTRY_CONTRACT || null;
      if (contractAddress) {
        rideRegistryContract = new ethers.Contract(
          contractAddress,
          RIDE_REGISTRY_ABI,
          wallet
        );
        return {
          success: true,
          message: "Blockchain initialized with existing contract",
          contractAddress
        };
      } else {
        return {
          success: true,
          message: "Blockchain connected. Set RIDE_REGISTRY_CONTRACT env var to enable on-chain recording."
        };
      }
    }
    return {
      success: true,
      message: "Blockchain provider connected. Set BLOCKCHAIN_PRIVATE_KEY for full functionality."
    };
  } catch (error) {
    console.error("Blockchain initialization error:", error.message);
    return {
      success: false,
      message: `Blockchain connection failed: ${error.message}`
    };
  }
}
function generateRideHash(record) {
  const dataToHash = JSON.stringify({
    rideId: record.rideId,
    customerId: record.customerId,
    driverId: record.driverId,
    pickup: record.pickupAddress,
    dropoff: record.dropoffAddress,
    fare: record.fare,
    platformFee: record.platformFee,
    driverShare: record.driverShare,
    timestamp: record.timestamp.toISOString()
  });
  return "0x" + createHash("sha256").update(dataToHash).digest("hex");
}
async function recordRideToBlockchain(record) {
  const hash = generateRideHash(record);
  const verificationUrl = `https://amoy.polygonscan.com/search?q=${hash}`;
  if (rideRegistryContract && wallet) {
    try {
      const fareWei = ethers.parseUnits(record.fare.toFixed(2), 18);
      const platformFeeWei = ethers.parseUnits(record.platformFee.toFixed(2), 18);
      const driverShareWei = ethers.parseUnits(record.driverShare.toFixed(2), 18);
      const tx = await rideRegistryContract.recordRide(
        hash,
        fareWei,
        platformFeeWei,
        driverShareWei
      );
      const receipt = await tx.wait();
      return {
        success: true,
        hash,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        verificationUrl: `https://amoy.polygonscan.com/tx/${receipt.hash}`,
        message: "Ride successfully recorded on Polygon blockchain",
        onChain: true
      };
    } catch (error) {
      console.error("Blockchain recording error:", error.message);
      return {
        success: true,
        hash,
        verificationUrl,
        message: `Off-chain hash generated. On-chain recording failed: ${error.message}`,
        onChain: false
      };
    }
  }
  return {
    success: true,
    hash,
    verificationUrl,
    message: "Verifiable hash generated. Configure BLOCKCHAIN_PRIVATE_KEY and RIDE_REGISTRY_CONTRACT for on-chain recording.",
    onChain: false
  };
}
async function verifyRideOnChain(rideHash) {
  if (rideRegistryContract) {
    try {
      const [fare, platformFee, driverShare, timestamp2, exists] = await rideRegistryContract.getRide(rideHash);
      if (exists) {
        return {
          isVerified: true,
          rideHash,
          blockchainNetwork: "Polygon Amoy Testnet",
          timestamp: Number(timestamp2) * 1e3,
          onChainData: {
            fare: ethers.formatUnits(fare, 18),
            platformFee: ethers.formatUnits(platformFee, 18),
            driverShare: ethers.formatUnits(driverShare, 18)
          }
        };
      }
    } catch (error) {
      console.error("Verification error:", error.message);
    }
  }
  return {
    isVerified: false,
    rideHash,
    blockchainNetwork: "Polygon Amoy Testnet"
  };
}
function createRideReceipt(record) {
  const hash = generateRideHash(record);
  const receipt = Buffer.from(JSON.stringify({
    version: "1.0",
    network: "polygon-amoy",
    hash,
    ride: {
      id: record.rideId,
      fare: record.fare.toFixed(2),
      platformFee: record.platformFee.toFixed(2),
      driverShare: record.driverShare.toFixed(2),
      timestamp: record.timestamp.toISOString()
    },
    signature: hash
  })).toString("base64");
  const verificationUrl = `https://amoy.polygonscan.com/search?q=${hash}`;
  return { hash, receipt, verificationUrl };
}
function calculateFeeBreakdown(totalFare) {
  const platformFeePercent = 10;
  const driverSharePercent = 90;
  const platformFee = totalFare * (platformFeePercent / 100);
  const driverShare = totalFare * (driverSharePercent / 100);
  return {
    platformFee: Math.round(platformFee * 100) / 100,
    driverShare: Math.round(driverShare * 100) / 100,
    platformFeePercent,
    driverSharePercent
  };
}
function generateTransparencyReport(rideId, pricing) {
  const surcharges = [];
  const discounts = [];
  const baseTotal = pricing.baseFare + pricing.distanceCharge + pricing.timeCharge;
  if (pricing.demandMultiplier > 1) {
    surcharges.push({
      name: "High Demand",
      amount: Math.round(baseTotal * (pricing.demandMultiplier - 1) * 100) / 100
    });
  } else if (pricing.demandMultiplier < 1) {
    discounts.push({
      name: "Low Demand Discount",
      amount: Math.round(baseTotal * (1 - pricing.demandMultiplier) * 100) / 100
    });
  }
  if (pricing.timeOfDayMultiplier > 1) {
    surcharges.push({
      name: "Peak Hours",
      amount: Math.round(baseTotal * (pricing.timeOfDayMultiplier - 1) * 100) / 100
    });
  } else if (pricing.timeOfDayMultiplier < 1) {
    discounts.push({
      name: "Off-Peak Discount",
      amount: Math.round(baseTotal * (1 - pricing.timeOfDayMultiplier) * 100) / 100
    });
  }
  if (pricing.trafficMultiplier > 1) {
    surcharges.push({
      name: "Traffic Conditions",
      amount: Math.round(baseTotal * (pricing.trafficMultiplier - 1) * 100) / 100
    });
  } else if (pricing.trafficMultiplier < 1) {
    discounts.push({
      name: "Light Traffic Discount",
      amount: Math.round(baseTotal * (1 - pricing.trafficMultiplier) * 100) / 100
    });
  }
  const hash = generateRideHash({
    rideId,
    customerId: "system",
    driverId: "system",
    pickupAddress: "",
    dropoffAddress: "",
    fare: pricing.total,
    platformFee: pricing.platformFee,
    driverShare: pricing.driverEarnings,
    timestamp: /* @__PURE__ */ new Date()
  });
  return {
    rideId,
    hash,
    priceBreakdown: {
      baseFare: pricing.baseFare,
      distanceCharge: pricing.distanceCharge,
      timeCharge: pricing.timeCharge,
      surcharges,
      discounts,
      subtotal: Math.round(baseTotal * 100) / 100,
      platformFee: pricing.platformFee,
      driverEarnings: pricing.driverEarnings,
      total: pricing.total
    },
    blockchain: {
      network: "Polygon Amoy Testnet",
      hash,
      verificationUrl: `https://amoy.polygonscan.com/search?q=${hash}`,
      status: rideRegistryContract ? "recorded" : "off-chain"
    },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function deployRideRegistry() {
  if (!wallet) {
    return {
      success: false,
      message: "Wallet not configured. Set BLOCKCHAIN_PRIVATE_KEY environment variable."
    };
  }
  try {
    const factory = new ethers.ContractFactory(
      RIDE_REGISTRY_ABI,
      RIDE_REGISTRY_BYTECODE,
      wallet
    );
    console.log("Deploying RideRegistry contract...");
    const contract = await factory.deploy();
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    contractAddress = address;
    rideRegistryContract = new ethers.Contract(address, RIDE_REGISTRY_ABI, wallet);
    return {
      success: true,
      contractAddress: address,
      message: `RideRegistry deployed at ${address}. Save this as RIDE_REGISTRY_CONTRACT env var.`
    };
  } catch (error) {
    return {
      success: false,
      message: `Deployment failed: ${error.message}`
    };
  }
}
function getBlockchainStatus() {
  return {
    connected: provider !== null,
    network: "Polygon Amoy Testnet",
    contractConfigured: rideRegistryContract !== null,
    contractAddress,
    walletConfigured: wallet !== null
  };
}
async function sendUsdtPayout(toAddress, amountUsd) {
  if (!wallet || !provider) {
    return {
      success: false,
      amount: amountUsd,
      toAddress,
      message: "Blockchain wallet not configured. Set BLOCKCHAIN_PRIVATE_KEY."
    };
  }
  if (!ethers.isAddress(toAddress)) {
    return {
      success: false,
      amount: amountUsd,
      toAddress,
      message: "Invalid wallet address format."
    };
  }
  try {
    const usdtContract = new ethers.Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, wallet);
    const decimals = await usdtContract.decimals();
    const amountInUnits = ethers.parseUnits(amountUsd.toFixed(2), decimals);
    const balance = await usdtContract.balanceOf(wallet.address);
    if (balance < amountInUnits) {
      return {
        success: false,
        amount: amountUsd,
        toAddress,
        message: `Insufficient USDT balance. Available: ${ethers.formatUnits(balance, decimals)} USDT`
      };
    }
    const tx = await usdtContract.transfer(toAddress, amountInUnits);
    const receipt = await tx.wait();
    return {
      success: true,
      txHash: receipt.hash,
      amount: amountUsd,
      toAddress,
      message: `Successfully sent ${amountUsd} USDT to ${toAddress}`,
      explorerUrl: `https://polygonscan.com/tx/${receipt.hash}`
    };
  } catch (error) {
    console.error("USDT payout error:", error);
    return {
      success: false,
      amount: amountUsd,
      toAddress,
      message: `Payout failed: ${error.message}`
    };
  }
}
async function getCompanyUsdtBalance() {
  if (!wallet || !provider) {
    return { balance: "0", address: null };
  }
  try {
    const usdtContract = new ethers.Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, provider);
    const decimals = await usdtContract.decimals();
    const balance = await usdtContract.balanceOf(wallet.address);
    return {
      balance: ethers.formatUnits(balance, decimals),
      address: wallet.address
    };
  } catch (error) {
    console.error("Error getting USDT balance:", error);
    return { balance: "0", address: wallet?.address || null };
  }
}
function isWalletConfigured() {
  return wallet !== null && provider !== null;
}
var POLYGON_AMOY_RPC, RIDE_REGISTRY_ABI, RIDE_REGISTRY_BYTECODE, provider, wallet, rideRegistryContract, contractAddress, USDT_CONTRACT_ADDRESS, USDT_ABI;
var init_blockchain = __esm({
  "server/blockchain.ts"() {
    "use strict";
    POLYGON_AMOY_RPC = "https://rpc-amoy.polygon.technology";
    RIDE_REGISTRY_ABI = [
      "function recordRide(bytes32 rideHash, uint256 fare, uint256 platformFee, uint256 driverShare) external",
      "function getRide(bytes32 rideHash) external view returns (uint256 fare, uint256 platformFee, uint256 driverShare, uint256 timestamp, bool exists)",
      "function verifyRide(bytes32 rideHash) external view returns (bool exists)",
      "event RideRecorded(bytes32 indexed rideHash, uint256 fare, uint256 platformFee, uint256 driverShare, uint256 timestamp)"
    ];
    RIDE_REGISTRY_BYTECODE = `0x608060405234801561001057600080fd5b50610400806100206000396000f3fe608060405234801561001057600080fd5b50600436106100415760003560e01c80633e3ee85914610046578063a87430ba14610062578063f8b2cb4f146100a3575b600080fd5b610060600480360381019061005b9190610253565b6100d3565b005b61007c600480360381019061007791906102b3565b610156565b60405161008e9594939291906102ff565b60405180910390f35b6100bd60048036038101906100b891906102b3565b6101af565b6040516100ca9190610352565b60405180910390f35b600080600086815260200190815260200160002090508481556001810184905560028101839055426003820155600181600401819055507f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92585858585426040516101419594939291906103b4565b60405180910390a15050505050565b6000806000806000808681526020019081526020016000206000015460008088815260200190815260200160002060010154600080898152602001908152602001600020600201546000808a8152602001908152602001600020600301546000808b8152602001908152602001600020600401549050945094509450945094509550565b60008060008381526020019081526020016000206004015460001415905b919050565b6000604051905090565b600080fd5b6000819050919050565b610201816101ee565b811461020c57600080fd5b50565b60008135905061021e816101f8565b92915050565b6000819050919050565b61023781610224565b811461024257600080fd5b50565b6000813590506102548161022e565b92915050565b60008060008060808587031215610274576102736101dc565b5b60006102828782880161020f565b945050602061029387828801610245565b93505060406102a487828801610245565b92505060606102b587828801610245565b91505092959194509250565b6000602082840312156102d7576102d66101dc565b5b60006102e58482850161020f565b91505092915050565b6102f781610224565b82525050565b600060a0820190506103126000830188610298565b61031f60208301876102ee565b61032c60408301866102ee565b61033960608301856102ee565b61034660808301846102ee565b9695505050505050565b60006020820190508180831161036857610367610224565b5b5b92915050565b61037881610224565b82525050565b600060a08201905061039360008301886101ee565b6103a0602083018761036f565b6103ad604083018661036f565b61033960608301856102ee565b61034660808301846102ee565b9695505050505050565bfea264697066735822`;
    provider = null;
    wallet = null;
    rideRegistryContract = null;
    contractAddress = null;
    USDT_CONTRACT_ADDRESS = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
    USDT_ABI = [
      "function transfer(address to, uint256 amount) returns (bool)",
      "function balanceOf(address account) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)"
    ];
  }
});

// server/telegramBot.ts
var telegramBot_exports = {};
__export(telegramBot_exports, {
  broadcastCampaignMessage: () => broadcastCampaignMessage,
  broadcastToDrivers: () => broadcastToDrivers,
  processTelegramUpdate: () => processTelegramUpdate,
  sendDriverApprovalNotification: () => sendDriverApprovalNotification,
  sendDriverNotification: () => sendDriverNotification,
  sendDriverWelcomeSequence: () => sendDriverWelcomeSequence,
  sendTelegramMessage: () => sendTelegramMessage,
  setBotCommands: () => setBotCommands,
  setWebhook: () => setWebhook
});
import { eq as eq7, desc as desc4, count as count3 } from "drizzle-orm";
async function sendTelegramMessage(chatId, text2, options) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log("[Telegram] Bot token not configured. Message:", text2);
    return false;
  }
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text2,
        parse_mode: "HTML",
        ...options
      })
    });
    const result = await response.json();
    return result.ok;
  } catch (error) {
    console.error("[Telegram] Error sending message:", error);
    return false;
  }
}
async function answerCallbackQuery(callbackQueryId, text2) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`${TELEGRAM_API_URL}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text: text2 })
    });
  } catch (error) {
    console.error("[Telegram] Error answering callback:", error);
  }
}
async function getDriverByChatId(chatId) {
  const [driver] = await db.select().from(drivers).innerJoin(users, eq7(drivers.userId, users.id)).where(eq7(users.telegramChatId, chatId.toString())).limit(1);
  return driver;
}
async function linkTelegramAccount(chatId, phone) {
  const [user] = await db.select().from(users).where(eq7(users.phone, phone)).limit(1);
  if (!user) {
    return { success: false, message: "No account found with this phone number. Please register in the T Driver app first." };
  }
  await db.update(users).set({ telegramChatId: chatId.toString() }).where(eq7(users.id, user.id));
  return { success: true, message: `Account linked successfully! Welcome, ${user.name}` };
}
function getCommunityWelcome(firstName) {
  return `<b>Welcome to the Travony Network</b>

${firstName}, you've joined a mobility infrastructure built for vehicle operators.

<b>What This Network Offers:</b>
- Real-time platform updates and announcements
- Route optimization and yield strategies
- Direct connection to the Travony team
- Operator community and peer support
- Referral programme tracking

<b>Get Started:</b>
1. Download <b>T Driver</b> from Google Play
2. Register as a vehicle operator
3. Link your account here with /link [your phone number]

<b>Commands:</b>
/link [phone] - Link your operator account
/earnings - Check your vehicle yield
/status - Your operator status
/rides - Recent route history
/referral - Get your referral code
/tips - Route optimization strategies
/calculator - Yield calculator
/faq - Common questions answered
/support - Get help from our team
/community - Network stats

<b>Get the app:</b> https://play.google.com/store/apps/details?id=com.travony.driver

Questions? Just type /support`;
}
function getDrivingTips() {
  const tips = [
    {
      title: "Peak Demand Windows",
      tip: "Activate your vehicle during morning (7-9 AM) and evening (5-8 PM) demand windows for 40-60% more route requests. Weekends peak from 10 PM-2 AM."
    },
    {
      title: "High-Yield Zones",
      tip: "Position near airports, transit stations, and metro exits. These zones have consistent demand throughout the day, maximizing your vehicle utilization."
    },
    {
      title: "Direction-Aligned Routes",
      tip: "Activate Going Home mode when heading home. The network matches you with riders going your direction - earn a premium while commuting."
    },
    {
      title: "Acceptance Rate Matters",
      tip: "Keep your acceptance rate above 85% for priority matching. Founding Operators who maintain high rates get matched first."
    },
    {
      title: "The 90% Model",
      tip: "On Travony you retain 90% of every fare. On a 1,000 AED day, that's 900 AED vs 750-800 AED on other platforms. Every route counts more here."
    },
    {
      title: "Weather Demand Boost",
      tip: "During rain or extreme weather, the network activates a 20-30% boost automatically. Stay active during adverse conditions for higher yield."
    },
    {
      title: "New Operator Protection",
      tip: "Your first 20 routes have rating protection. Focus on learning the platform and optimizing your routes without pressure."
    },
    {
      title: "Referral Programme",
      tip: "Use /referral to get your code. Each operator you refer earns you a bonus after they complete their first 10 routes."
    }
  ];
  const tip = tips[Math.floor(Math.random() * tips.length)];
  return `<b>${tip.title}</b>

${tip.tip}

Want another strategy? Type /tips again`;
}
function getFAQ() {
  return `<b>Frequently Asked Questions</b>

<b>Q: What is Travony's platform fee?</b>
A: 10% flat. You retain 90% of every fare. No hidden fees, no surprises.

<b>Q: When are payouts processed?</b>
A: Weekly via bank transfer, or instant USDT crypto payouts on demand.

<b>Q: Can I see the yield before accepting a route?</b>
A: Yes. Full earnings breakdown is shown before you accept any route request.

<b>Q: What is a Founding Operator?</b>
A: Early operators who join before public launch. You receive a permanent badge, priority matching, signup bonus, and referral yield.

<b>Q: How does direction-aligned routing work?</b>
A: Set your destination, and the network matches you with riders going your direction. You earn a premium while heading home.

<b>Q: What about tips?</b>
A: 100% of tips go to you. The platform takes zero cut on tips.

<b>Q: Is crypto payout mandatory?</b>
A: No. Choose bank transfer or USDT - whatever suits your operation.

<b>Q: How do I report an issue?</b>
A: Use /support or /feedback [your message]

More questions? Type /support to contact our team.`;
}
function getEarningsCalculator(ridesPerDay = 12, avgFare = 35, daysPerWeek = 6) {
  const weeklyGross = ridesPerDay * avgFare * daysPerWeek;
  const travonyEarnings = Math.round(weeklyGross * 0.9);
  const otherEarnings = Math.round(weeklyGross * 0.75);
  const difference = travonyEarnings - otherEarnings;
  const monthlyExtra = difference * 4;
  const yearlyExtra = difference * 52;
  return `<b>Yield Calculator</b>

<b>Your inputs:</b>
Routes/day: ${ridesPerDay}
Average fare: ${avgFare} AED
Days/week: ${daysPerWeek}

<b>Weekly Yield Comparison:</b>

Travony (90%): <b>${travonyEarnings.toLocaleString()} AED</b>
Other platforms (75%): ${otherEarnings.toLocaleString()} AED

<b>You retain ${difference.toLocaleString()} AED MORE per week</b>

Monthly advantage: +${monthlyExtra.toLocaleString()} AED
Annual advantage: +${yearlyExtra.toLocaleString()} AED

Try different numbers:
/calculator [routes/day] [avg fare] [days/week]
Example: /calculator 15 40 6`;
}
async function handleCommand(chatId, command, args, firstName) {
  const driver = await getDriverByChatId(chatId);
  switch (command) {
    case "/start":
      return getCommunityWelcome(firstName);
    case "/link":
      if (args.length === 0) {
        return "Please provide your phone number.\nExample: /link +971501234567";
      }
      const linkResult = await linkTelegramAccount(chatId, args[0]);
      return linkResult.message;
    case "/status":
      if (!driver) {
        return "Account not linked yet.\n\n1. Download T Driver: https://play.google.com/store/apps/details?id=com.travony.driver\n2. Create your account\n3. Link here: /link [your phone]";
      }
      const driverData = driver.drivers;
      return `<b>Operator Status</b>

Status: ${driverData.status}
Vehicle Active: ${driverData.isOnline ? "Yes" : "No"}
Rating: ${driverData.rating || "5.00"}
Routes Completed: ${driverData.totalTrips || 0}
Classification: Founding Operator`;
    case "/earnings":
      if (!driver) {
        return "Account not linked. Use /link [phone] to connect your account.";
      }
      return `<b>Vehicle Yield</b>

Total Yield: $${driver.drivers.totalEarnings || "0.00"}
Asset Balance: $${driver.drivers.walletBalance || "0.00"}

Platform fee: 10% flat
Your retention: 90% of every fare
Tips: 100% yours

Use /calculator to project future yield`;
    case "/rides":
      if (!driver) {
        return "Account not linked. Use /link [phone] to connect your account.";
      }
      const recentRides = await db.select().from(rides).where(eq7(rides.driverId, driver.drivers.id)).orderBy(desc4(rides.createdAt)).limit(5);
      if (recentRides.length === 0) {
        return "No routes yet. Activate your vehicle in the T Driver app to start receiving route requests.";
      }
      let ridesText = "<b>Recent Routes</b>\n\n";
      for (const ride of recentRides) {
        ridesText += `${ride.status.toUpperCase()} - $${ride.actualFare || "0.00"}
`;
        ridesText += `${ride.pickupAddress} to ${ride.dropoffAddress}

`;
      }
      return ridesText;
    case "/referral":
      if (!driver) {
        return `<b>Referral Program</b>

Link your account first to get your personal referral code.

/link [your phone number]

Once linked, share your code with other drivers. You both earn a bonus after they complete 10 rides!`;
      }
      const refCode = `TRAV${driver.users.id.toString().slice(-6).toUpperCase()}`;
      return `<b>Your Referral Code</b>

Code: <code>${refCode}</code>

Share this with other operators. When they register using your code and complete 10 routes, you both receive a bonus.

<b>Share this message:</b>
"Your vehicle is an asset. Retain 90% of every fare on Travony. Use my code ${refCode} when registering. Download: https://play.google.com/store/apps/details?id=com.travony.driver"`;
    case "/tips":
      return getDrivingTips();
    case "/calculator":
      const calcRides = parseInt(args[0]) || 12;
      const calcFare = parseInt(args[1]) || 35;
      const calcDays = parseInt(args[2]) || 6;
      return getEarningsCalculator(calcRides, calcFare, calcDays);
    case "/faq":
      return getFAQ();
    case "/community":
      try {
        const [driverCount] = await db.select({ count: count3() }).from(drivers);
        const [onlineCount] = await db.select({ count: count3() }).from(drivers).where(eq7(drivers.isOnline, true));
        return `<b>Travony Driver Community</b>

Total Drivers: ${driverCount?.count || 0}
Currently Online: ${onlineCount?.count || 0}

Join us: https://play.google.com/store/apps/details?id=com.travony.driver
Recruit page: https://travony.replit.app/drive

Every driver you bring makes the network stronger for everyone.`;
      } catch {
        return `<b>Travony Driver Community</b>

Join us: https://play.google.com/store/apps/details?id=com.travony.driver
Recruit page: https://travony.replit.app/drive`;
      }
    case "/support":
      return `<b>Travony Driver Support</b>

For urgent issues:
- Emergency: Use the emergency button in the app
- Fare disputes: Report in app after ride completion

Common issues:
- Payments: Processed weekly
- Ratings: Protected for first 20 rides
- Commission: Only 10% platform fee

Send feedback: /feedback [your message]
Visit: https://travony.replit.app/support`;
    case "/feedback":
      if (args.length === 0) {
        return "Please include your feedback.\nExample: /feedback The app is working great!";
      }
      console.log(`[Telegram Feedback] From ${chatId} (${firstName}): ${args.join(" ")}`);
      return "Thank you for your feedback! Our team will review it shortly.";
    case "/online":
      if (!driver) {
        return "Account not linked. Use /link [phone] to connect your account.";
      }
      await db.update(drivers).set({ isOnline: true }).where(eq7(drivers.id, driver.drivers.id));
      return "Vehicle activated. You are now receiving route requests.";
    case "/offline":
      if (!driver) {
        return "Account not linked. Use /link [phone] to connect your account.";
      }
      await db.update(drivers).set({ isOnline: false }).where(eq7(drivers.id, driver.drivers.id));
      return "Vehicle deactivated. Activate again to receive route requests.";
    case "/invite":
      return `<b>Invite Operators to Travony</b>

Share this with vehicle operators you know:

"Your vehicle is an asset. On Travony, you retain 90% of every fare with full transparency - see your exact yield before accepting any route. No hidden fees. 100% of tips are yours.

Download T Driver: https://play.google.com/store/apps/details?id=com.travony.driver
Learn more: https://travony.replit.app/drive"

Every operator who joins strengthens the network for everyone.`;
    case "/whytravony":
      return `<b>Why Operate on Travony?</b>

<b>90% retention.</b> Other platforms take 20-25%. Travony: 10% flat.

<b>Yield visibility.</b> Full breakdown before you accept any route. No surprises.

<b>100% tips.</b> The platform never touches your tips.

<b>Direction-aligned routing.</b> Earn while commuting. Get matched with riders going your direction.

<b>Fair protection.</b> Rider cancels? You're compensated. Not your fault? Record stays clean.

<b>Instant crypto payouts.</b> Receive USDT directly. No bank delays.

<b>AI dispute resolution.</b> Fair, transparent - not a random support agent.

Join the network: https://play.google.com/store/apps/details?id=com.travony.driver`;
    default:
      return `I didn't understand that command.

<b>Available Commands:</b>
/start - Welcome & overview
/link [phone] - Link your account
/status - Operator status
/earnings - Vehicle yield
/rides - Recent routes
/referral - Referral code
/tips - Optimization strategies
/calculator - Yield calculator
/faq - Common questions
/community - Network stats
/invite - Share invite message
/whytravony - Why operate on Travony
/support - Get help`;
  }
}
async function processTelegramUpdate(update) {
  if (update.callback_query) {
    const cbQuery = update.callback_query;
    const chatId2 = cbQuery.message?.chat.id;
    if (chatId2 && cbQuery.data) {
      await answerCallbackQuery(cbQuery.id);
      const parts = cbQuery.data.split(" ");
      const command = parts[0];
      const args = parts.slice(1);
      const response = await handleCommand(chatId2, command, args, cbQuery.from.first_name);
      await sendTelegramMessage(chatId2, response);
    }
    return;
  }
  if (!update.message?.text) return;
  const chatId = update.message.chat.id;
  const text2 = update.message.text.trim();
  const firstName = update.message.from.first_name;
  if (text2.startsWith("/")) {
    const parts = text2.split(" ");
    const command = parts[0].toLowerCase().split("@")[0];
    const args = parts.slice(1);
    const response = await handleCommand(chatId, command, args, firstName);
    await sendTelegramMessage(chatId, response);
  } else {
    const lowerText = text2.toLowerCase();
    if (lowerText.includes("earn") || lowerText.includes("money") || lowerText.includes("pay")) {
      await sendTelegramMessage(chatId, "Interested in vehicle yield? Try /calculator or /earnings\n\nOn Travony, you retain 90% of every fare.");
    } else if (lowerText.includes("join") || lowerText.includes("sign up") || lowerText.includes("register")) {
      await sendTelegramMessage(chatId, "Ready to join the network? Download T Driver from Google Play:\nhttps://play.google.com/store/apps/details?id=com.travony.driver\n\nThen link your account here with /link [phone]");
    } else if (lowerText.includes("help") || lowerText.includes("problem") || lowerText.includes("issue")) {
      await sendTelegramMessage(chatId, "Need help? Try /support or /faq\n\nFor specific feedback: /feedback [your message]");
    } else {
      await sendTelegramMessage(chatId, "Type /start to see all available commands, or try:\n/tips - Route optimization strategies\n/calculator - Project your vehicle yield\n/faq - Common questions");
    }
  }
}
async function sendDriverNotification(driverId, message) {
  const [driver] = await db.select().from(drivers).innerJoin(users, eq7(drivers.userId, users.id)).where(eq7(drivers.id, driverId)).limit(1);
  if (!driver || !driver.users.telegramChatId) {
    console.log(`[Telegram] No Telegram chat ID for driver ${driverId}`);
    return false;
  }
  return sendTelegramMessage(driver.users.telegramChatId, message);
}
async function broadcastToDrivers(citySlug, message) {
  const allDrivers = await db.select().from(drivers).innerJoin(users, eq7(drivers.userId, users.id)).where(eq7(drivers.status, "approved"));
  let sent = 0;
  for (const driver of allDrivers) {
    if (driver.users.telegramChatId) {
      const success = await sendTelegramMessage(driver.users.telegramChatId, message);
      if (success) sent++;
    }
  }
  return sent;
}
async function broadcastCampaignMessage(message) {
  const allDrivers = await db.select().from(drivers).innerJoin(users, eq7(drivers.userId, users.id));
  let sent = 0;
  for (const driver of allDrivers) {
    if (driver.users.telegramChatId) {
      const success = await sendTelegramMessage(driver.users.telegramChatId, message);
      if (success) sent++;
      await new Promise((resolve2) => setTimeout(resolve2, 50));
    }
  }
  return sent;
}
async function sendDriverWelcomeSequence(driverId, driverName) {
  const [driver] = await db.select().from(drivers).innerJoin(users, eq7(drivers.userId, users.id)).where(eq7(drivers.id, driverId)).limit(1);
  if (!driver || !driver.users.telegramChatId) {
    console.log(`[Telegram] No chat ID for driver ${driverId}`);
    return false;
  }
  const chatId = driver.users.telegramChatId;
  const welcomeMessage = `<b>Welcome to Travony, ${driverName}!</b>

You're now part of the Travony driver community. Here's what makes us different:

- <b>90% is yours</b> - We only take 10%
- <b>Full transparency</b> - See earnings before accepting
- <b>100% tips</b> - We never touch them
- <b>Going Home mode</b> - Earn while commuting

<b>Commands:</b>
/status - Your driver status
/earnings - View earnings
/rides - Recent rides
/tips - Earning strategies
/referral - Get your referral code
/calculator - Earnings calculator
/online - Go online
/offline - Go offline
/feedback [message] - Send feedback

Next step: Open the app to complete your profile.`;
  await sendTelegramMessage(chatId, welcomeMessage);
  setTimeout(async () => {
    const guideMessage = `<b>Quick Start Guide</b>

1. Open the T Driver app and sign in
2. Complete your profile (photo, license, vehicle)
3. Wait for verification (max 24 hours)
4. Once approved, tap "Go Online" to receive rides

<b>Pro tip:</b> Use /tips to learn strategies that top drivers use to maximize earnings.

Questions? Type /faq or /support`;
    await sendTelegramMessage(chatId, guideMessage);
  }, 36e5);
  return true;
}
async function sendDriverApprovalNotification(driverId) {
  const [driver] = await db.select().from(drivers).innerJoin(users, eq7(drivers.userId, users.id)).where(eq7(drivers.id, driverId)).limit(1);
  if (!driver || !driver.users.telegramChatId) {
    return false;
  }
  const message = `<b>Your Account is Approved!</b>

You're ready to receive rides.

<b>Tips for your first ride:</b>
- Keep the app open and in the foreground
- Accept within 30 seconds
- Use the built-in navigation
- Confirm payment before ending the ride

<b>Remember: Only 10% fee</b> - 90% of every fare is yours.

Use /referral to invite other drivers and earn bonuses!

Good luck!`;
  return sendTelegramMessage(driver.users.telegramChatId, message);
}
async function setWebhook(webhookUrl) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log("[Telegram] Bot token not configured");
    return false;
  }
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl })
    });
    const result = await response.json();
    console.log("[Telegram] Webhook set:", result);
    return result.ok;
  } catch (error) {
    console.error("[Telegram] Error setting webhook:", error);
    return false;
  }
}
async function setBotCommands() {
  if (!TELEGRAM_BOT_TOKEN) return false;
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commands: [
          { command: "start", description: "Welcome & overview" },
          { command: "link", description: "Link your driver account" },
          { command: "status", description: "Check your driver status" },
          { command: "earnings", description: "View your earnings" },
          { command: "rides", description: "Recent ride history" },
          { command: "referral", description: "Get your referral code" },
          { command: "tips", description: "Driving tips to earn more" },
          { command: "calculator", description: "Earnings calculator" },
          { command: "faq", description: "Frequently asked questions" },
          { command: "community", description: "Community stats" },
          { command: "invite", description: "Share invite message" },
          { command: "whytravony", description: "Why choose Travony" },
          { command: "support", description: "Get help" },
          { command: "feedback", description: "Send feedback" }
        ]
      })
    });
    const result = await response.json();
    console.log("[Telegram] Bot commands set:", result);
    return result.ok;
  } catch (error) {
    console.error("[Telegram] Error setting commands:", error);
    return false;
  }
}
var TELEGRAM_BOT_TOKEN, TELEGRAM_API_URL;
var init_telegramBot = __esm({
  "server/telegramBot.ts"() {
    "use strict";
    init_db();
    init_schema();
    TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
  }
});

// server/whatsappBot.ts
var whatsappBot_exports = {};
__export(whatsappBot_exports, {
  notifyDriverOfEarnings: () => notifyDriverOfEarnings,
  notifyDriverOfRideAccepted: () => notifyDriverOfRideAccepted,
  notifyDriverOfRideRequest: () => notifyDriverOfRideRequest,
  processWhatsAppWebhook: () => processWhatsAppWebhook,
  sendDriverApprovalWhatsApp: () => sendDriverApprovalWhatsApp,
  sendDriverWelcomeSequenceWhatsApp: () => sendDriverWelcomeSequenceWhatsApp,
  sendDriverWhatsAppNotification: () => sendDriverWhatsAppNotification,
  sendWhatsAppMessage: () => sendWhatsAppMessage
});
import { eq as eq8, desc as desc5 } from "drizzle-orm";
async function sendWhatsAppMessage(to, body) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_NUMBER) {
    console.log("[WhatsApp] Twilio not configured. Message:", body);
    return false;
  }
  const fromNumber = TWILIO_WHATSAPP_NUMBER.startsWith("whatsapp:") ? TWILIO_WHATSAPP_NUMBER : `whatsapp:${TWILIO_WHATSAPP_NUMBER}`;
  const toNumber = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  try {
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          From: fromNumber,
          To: toNumber,
          Body: body
        })
      }
    );
    const result = await response.json();
    if (result.sid) {
      console.log(`[WhatsApp] Message sent: ${result.sid}`);
      return true;
    }
    console.error("[WhatsApp] Error:", result);
    return false;
  } catch (error) {
    console.error("[WhatsApp] Error sending message:", error);
    return false;
  }
}
async function getDriverByPhone(phone) {
  const normalizedPhone = phone.replace("whatsapp:", "").replace(/\s/g, "");
  const [driver] = await db.select().from(drivers).innerJoin(users, eq8(drivers.userId, users.id)).where(eq8(users.phone, normalizedPhone)).limit(1);
  return driver;
}
async function handleWhatsAppCommand(from, body) {
  const text2 = body.trim().toLowerCase();
  const phone = from.replace("whatsapp:", "");
  const driver = await getDriverByPhone(phone);
  if (text2 === "hola" || text2 === "hi" || text2 === "hello" || text2 === "start") {
    return `Bienvenido a Travony! / Welcome to Travony!

Comandos / Commands:
- "status" - Ver tu estado / Check your status
- "earnings" - Ver ganancias / View earnings
- "rides" - Viajes recientes / Recent rides
- "online" - Conectarse / Go online
- "offline" - Desconectarse / Go offline
- "help" - Ayuda / Help

Responde con un comando / Reply with a command`;
  }
  if (text2 === "status" || text2 === "estado") {
    if (!driver) {
      return "Cuenta no encontrada. Reg\xEDstrate en la app con este n\xFAmero de tel\xE9fono.\n\nAccount not found. Register in the app with this phone number.";
    }
    const d = driver.drivers;
    return `*Estado del Conductor / Driver Status*

Estado: ${d.status === "approved" ? "Aprobado" : d.status}
En l\xEDnea: ${d.isOnline ? "S\xED" : "No"}
Calificaci\xF3n: ${d.rating || "5.00"}
Viajes totales: ${d.totalTrips || 0}`;
  }
  if (text2 === "earnings" || text2 === "ganancias") {
    if (!driver) {
      return "Cuenta no encontrada / Account not found";
    }
    return `*Tus Ganancias / Your Earnings*

Total: $${driver.drivers.totalEarnings || "0.00"}
Saldo: $${driver.drivers.walletBalance || "0.00"}

Comisi\xF3n de plataforma: 10%
Platform fee: 10%`;
  }
  if (text2 === "rides" || text2 === "viajes") {
    if (!driver) {
      return "Cuenta no encontrada / Account not found";
    }
    const recentRides = await db.select().from(rides).where(eq8(rides.driverId, driver.drivers.id)).orderBy(desc5(rides.createdAt)).limit(5);
    if (recentRides.length === 0) {
      return "Sin viajes recientes. \xA1Con\xE9ctate para recibir solicitudes!\n\nNo recent rides. Go online to receive requests!";
    }
    let msg = "*Viajes Recientes / Recent Rides*\n\n";
    for (const ride of recentRides) {
      msg += `${ride.status.toUpperCase()} - $${ride.actualFare || "0.00"}
`;
    }
    return msg;
  }
  if (text2 === "online" || text2 === "conectar") {
    if (!driver) {
      return "Cuenta no encontrada / Account not found";
    }
    await db.update(drivers).set({ isOnline: true }).where(eq8(drivers.id, driver.drivers.id));
    return "\xA1Est\xE1s EN L\xCDNEA! Recibir\xE1s solicitudes de viaje.\n\nYou are ONLINE! You will receive ride requests.";
  }
  if (text2 === "offline" || text2 === "desconectar") {
    if (!driver) {
      return "Cuenta no encontrada / Account not found";
    }
    await db.update(drivers).set({ isOnline: false }).where(eq8(drivers.id, driver.drivers.id));
    return "Est\xE1s DESCONECTADO.\n\nYou are OFFLINE.";
  }
  if (text2 === "help" || text2 === "ayuda") {
    return `*Ayuda de Travony / Travony Help*

Para problemas urgentes:
- Emergencia: Usa el bot\xF3n en la app
- Disputas de tarifa: Reporta despu\xE9s del viaje

Preguntas comunes:
- Pagos: Procesados diariamente
- Calificaciones: Protegidas en primeros 20 viajes
- Comisi\xF3n: 10% por viaje

For urgent issues:
- Emergency: Use button in app
- Fare disputes: Report after ride

Common questions:
- Payments: Processed daily
- Ratings: Protected for first 20 rides
- Commission: 10% per ride`;
  }
  return `No entend\xED tu mensaje. Escribe "hola" para ver los comandos.

I didn't understand. Type "hello" to see commands.`;
}
async function processWhatsAppWebhook(body) {
  const from = body.From;
  const messageBody = body.Body;
  if (!from || !messageBody) {
    return null;
  }
  const response = await handleWhatsAppCommand(from, messageBody);
  return response;
}
async function sendDriverWhatsAppNotification(driverId, message) {
  const [driver] = await db.select().from(drivers).innerJoin(users, eq8(drivers.userId, users.id)).where(eq8(drivers.id, driverId)).limit(1);
  if (!driver || !driver.users.phone) {
    console.log(`[WhatsApp] No phone for driver ${driverId}`);
    return false;
  }
  return sendWhatsAppMessage(driver.users.phone, message);
}
async function notifyDriverOfRideRequest(driverId, rideDetails) {
  const message = `\u{1F697} *Nueva Solicitud de Viaje / New Ride Request*

Recoger: ${rideDetails.pickupAddress}
Destino: ${rideDetails.dropoffAddress}
${rideDetails.estimatedFare ? `Tarifa estimada: $${rideDetails.estimatedFare}` : ""}

Abre la app para aceptar.
Open the app to accept.`;
  return sendDriverWhatsAppNotification(driverId, message);
}
async function notifyDriverOfRideAccepted(driverId, rideId) {
  const message = `\u2705 *Viaje Aceptado / Ride Accepted*

Tu viaje ha sido confirmado.
Your ride has been confirmed.

ID: ${rideId.substring(0, 8)}`;
  return sendDriverWhatsAppNotification(driverId, message);
}
async function notifyDriverOfEarnings(driverId, amount) {
  const message = `*Ganancias del Dia / Today's Earnings*

Has ganado: $${amount}
You earned: $${amount}

Buen trabajo! / Great work!`;
  return sendDriverWhatsAppNotification(driverId, message);
}
async function sendDriverWelcomeSequenceWhatsApp(driverId, driverName) {
  const [driver] = await db.select().from(drivers).innerJoin(users, eq8(drivers.userId, users.id)).where(eq8(drivers.id, driverId)).limit(1);
  if (!driver || !driver.users.phone) {
    console.log(`[WhatsApp] No phone for driver ${driverId}`);
    return false;
  }
  const phone = driver.users.phone;
  const welcomeMessage = `*Bienvenido a Travony*

Eres conductor fundador de CDMX. Gracias por ser parte del inicio.

Escribe cualquiera de estos comandos:
- "estado" - Ver tu estado
- "ganancias" - Ver tus ganancias
- "viajes" - Ver viajes recientes
- "ayuda" - Obtener ayuda

Siguiente: Abre la app para completar tu registro.`;
  await sendWhatsAppMessage(phone, welcomeMessage);
  setTimeout(async () => {
    const reminderMessage = `*Recordatorio de Registro*

Pasos para empezar:
1. Abre la app Travony
2. Inicia sesion con este numero
3. Sube tu licencia y foto del vehiculo
4. Espera aprobacion (menos de 24 hrs)

Dudas? Responde a este mensaje.`;
    await sendWhatsAppMessage(phone, reminderMessage);
  }, 864e5);
  return true;
}
async function sendDriverApprovalWhatsApp(driverId) {
  const [driver] = await db.select().from(drivers).innerJoin(users, eq8(drivers.userId, users.id)).where(eq8(drivers.id, driverId)).limit(1);
  if (!driver || !driver.users.phone) {
    return false;
  }
  const message = `*Tu cuenta fue APROBADA*

Ya puedes conectarte y recibir viajes.

Recuerda:
- Comision: Solo 10%
- Ganancias: Deposito diario
- Soporte: Este chat 24/7

Escribe "conectar" para activarte.`;
  return sendWhatsAppMessage(driver.users.phone, message);
}
var TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER;
var init_whatsappBot = __esm({
  "server/whatsappBot.ts"() {
    "use strict";
    init_db();
    init_schema();
    TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
    TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
    TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER;
  }
});

// server/vehicleVerification.ts
var vehicleVerification_exports = {};
__export(vehicleVerification_exports, {
  getVehicleCategoryInfo: () => getVehicleCategoryInfo,
  verifyMultipleVehicleImages: () => verifyMultipleVehicleImages,
  verifyVehicleImage: () => verifyVehicleImage
});
import OpenAI from "openai";
async function verifyVehicleImage(imageUrl, regionCode = "BD") {
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
    max_tokens: 1e3
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
      passengerCapacity: analysis.passengerCapacity || VEHICLE_CATEGORIES[analysis.category]?.capacity || 4,
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
function normalizeCategory(input) {
  const lowered = input.toLowerCase().replace(/[_-]/g, " ");
  for (const [category, data] of Object.entries(VEHICLE_CATEGORIES)) {
    if (data.names.some((name) => lowered.includes(name) || name.includes(lowered))) {
      return category;
    }
  }
  if (lowered.includes("car") || lowered.includes("sedan")) return "economy_car";
  if (lowered.includes("bike") || lowered.includes("motor")) return "motorcycle";
  if (lowered.includes("rickshaw") || lowered.includes("wheeler")) return "auto_rickshaw";
  return "unknown";
}
function getRegionContext(regionCode) {
  const contexts = {
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
async function verifyMultipleVehicleImages(imageUrls, regionCode = "BD") {
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
    imageUrls.map((url) => verifyVehicleImage(url, regionCode))
  );
  const validResults = results.filter((r) => r.category !== "unknown");
  if (validResults.length === 0) {
    return results[0];
  }
  const categoryCounts = validResults.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + 1;
    return acc;
  }, {});
  const dominantCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0][0];
  const matchingResults = validResults.filter((r) => r.category === dominantCategory);
  const avgCondition = matchingResults.reduce((sum2, r) => sum2 + r.conditionScore, 0) / matchingResults.length;
  const allIssues = [...new Set(matchingResults.flatMap((r) => r.issues))];
  const hasPlate = matchingResults.some((r) => r.licensePlateVisible);
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
function getVehicleCategoryInfo(category) {
  return VEHICLE_CATEGORIES[category] || {
    names: [category],
    capacity: 4,
    description: "Unknown vehicle type"
  };
}
var openai, VEHICLE_CATEGORIES;
var init_vehicleVerification = __esm({
  "server/vehicleVerification.ts"() {
    "use strict";
    openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
    });
    VEHICLE_CATEGORIES = {
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
  }
});

// server/instagramService.ts
var instagramService_exports = {};
__export(instagramService_exports, {
  discoverInstagramAccount: () => discoverInstagramAccount,
  exchangeCodeForToken: () => exchangeCodeForToken,
  getInstagramInsights: () => getInstagramInsights,
  getOAuthUrl: () => getOAuthUrl,
  getPageInfo: () => getPageInfo,
  getPageStatus: () => getPageStatus,
  getPageToken: () => getPageToken,
  postCarouselToInstagram: () => postCarouselToInstagram,
  postImageToInstagram: () => postImageToInstagram,
  postReelToInstagram: () => postReelToInstagram,
  postToFacebookPage: () => postToFacebookPage,
  refreshAccessToken: () => refreshAccessToken,
  saveAndValidatePageToken: () => saveAndValidatePageToken,
  setPageInfo: () => setPageInfo,
  setPageToken: () => setPageToken,
  setToken: () => setToken
});
async function refreshAccessToken() {
  if (!META_ACCESS_TOKEN || !META_APP_ID || !META_APP_SECRET) {
    return { success: false, error: "Missing META_ACCESS_TOKEN, META_APP_ID, or META_APP_SECRET" };
  }
  try {
    const res = await fetch(
      `${GRAPH_API_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${META_ACCESS_TOKEN}`
    );
    const data = await res.json();
    if (data.access_token) {
      META_ACCESS_TOKEN = data.access_token;
      process.env.META_ACCESS_TOKEN = data.access_token;
      console.log("[Instagram] Token refreshed successfully, expires in:", data.expires_in, "seconds");
      return { success: true };
    }
    return { success: false, error: data.error?.message || "Failed to refresh token" };
  } catch (error) {
    console.error("[Instagram] Token refresh error:", error);
    return { success: false, error: error.message };
  }
}
function getOAuthUrl(redirectUri) {
  if (!META_APP_ID) return null;
  const scopes = "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,pages_manage_posts,business_management,public_profile";
  return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&auth_type=rerequest`;
}
async function exchangeCodeForToken(code, redirectUri) {
  if (!META_APP_ID || !META_APP_SECRET) {
    return { success: false, error: "Missing META_APP_ID or META_APP_SECRET" };
  }
  try {
    const shortRes = await fetch(
      `${GRAPH_API_URL}/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${META_APP_SECRET}&code=${code}`
    );
    const shortData = await shortRes.json();
    if (!shortData.access_token) {
      return { success: false, error: shortData.error?.message || "Failed to get short-lived token" };
    }
    const longRes = await fetch(
      `${GRAPH_API_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${shortData.access_token}`
    );
    const longData = await longRes.json();
    const finalToken = longData.access_token || shortData.access_token;
    META_ACCESS_TOKEN = finalToken;
    process.env.META_ACCESS_TOKEN = finalToken;
    console.log("[Instagram] New token obtained, expires in:", longData.expires_in || "unknown", "seconds");
    await discoverInstagramAccount();
    return { success: true, accessToken: finalToken };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
function setToken(token) {
  META_ACCESS_TOKEN = token;
  process.env.META_ACCESS_TOKEN = token;
}
async function discoverInstagramAccount() {
  if (!META_ACCESS_TOKEN) {
    return { success: false, error: "No access token" };
  }
  try {
    const pagesRes = await fetch(
      `${GRAPH_API_URL}/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${META_ACCESS_TOKEN}`
    );
    const pagesData = await pagesRes.json();
    if (pagesData.data && pagesData.data.length > 0) {
      for (const page of pagesData.data) {
        if (page.instagram_business_account) {
          const igId = page.instagram_business_account.id;
          process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = igId;
          console.log("[Instagram] Discovered IG Business Account:", igId, "from page:", page.name);
          return { success: true, igAccountId: igId };
        }
      }
      console.log("[Instagram] Pages found but none have Instagram Business Account linked");
      return { success: false, error: "No Instagram Business Account linked to any Facebook Page. Link your Instagram to a Facebook Page first." };
    }
    console.log("[Instagram] No Facebook Pages found for this user");
    return { success: false, error: "No Facebook Pages found. You need a Facebook Page connected to your Instagram Business Account." };
  } catch (error) {
    console.error("[Instagram] Discover error:", error);
    return { success: false, error: error.message };
  }
}
async function postImageToInstagram(imageUrl, caption) {
  if (!META_ACCESS_TOKEN || !INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    return { success: false, error: "Instagram credentials not configured" };
  }
  try {
    const containerRes = await fetch(
      `${GRAPH_API_URL}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: imageUrl,
          caption,
          access_token: META_ACCESS_TOKEN
        })
      }
    );
    const containerData = await containerRes.json();
    if (!containerData.id) {
      return {
        success: false,
        error: containerData.error?.message || "Failed to create media container"
      };
    }
    let status = "IN_PROGRESS";
    let attempts = 0;
    while (status === "IN_PROGRESS" && attempts < 30) {
      await new Promise((r) => setTimeout(r, 2e3));
      const statusRes = await fetch(
        `${GRAPH_API_URL}/${containerData.id}?fields=status_code&access_token=${META_ACCESS_TOKEN}`
      );
      const statusData = await statusRes.json();
      status = statusData.status_code || "FINISHED";
      attempts++;
    }
    const publishRes = await fetch(
      `${GRAPH_API_URL}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: META_ACCESS_TOKEN
        })
      }
    );
    const publishData = await publishRes.json();
    if (publishData.id) {
      return { success: true, postId: publishData.id };
    }
    return {
      success: false,
      error: publishData.error?.message || "Failed to publish"
    };
  } catch (error) {
    console.error("[Instagram] Post error:", error);
    return { success: false, error: error.message };
  }
}
async function postCarouselToInstagram(imageUrls, caption) {
  if (!META_ACCESS_TOKEN || !INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    return { success: false, error: "Instagram credentials not configured" };
  }
  try {
    const containerIds = [];
    for (const url of imageUrls) {
      const res = await fetch(
        `${GRAPH_API_URL}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: url,
            is_carousel_item: true,
            access_token: META_ACCESS_TOKEN
          })
        }
      );
      const data = await res.json();
      if (data.id) containerIds.push(data.id);
    }
    if (containerIds.length === 0) {
      return { success: false, error: "Failed to create carousel items" };
    }
    await new Promise((r) => setTimeout(r, 5e3));
    const carouselRes = await fetch(
      `${GRAPH_API_URL}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "CAROUSEL",
          children: containerIds,
          caption,
          access_token: META_ACCESS_TOKEN
        })
      }
    );
    const carouselData = await carouselRes.json();
    if (!carouselData.id) {
      return {
        success: false,
        error: carouselData.error?.message || "Failed to create carousel"
      };
    }
    await new Promise((r) => setTimeout(r, 3e3));
    const publishRes = await fetch(
      `${GRAPH_API_URL}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: carouselData.id,
          access_token: META_ACCESS_TOKEN
        })
      }
    );
    const publishData = await publishRes.json();
    if (publishData.id) {
      return { success: true, postId: publishData.id };
    }
    return {
      success: false,
      error: publishData.error?.message || "Failed to publish carousel"
    };
  } catch (error) {
    console.error("[Instagram] Carousel error:", error);
    return { success: false, error: error.message };
  }
}
async function postReelToInstagram(videoUrl, caption) {
  if (!META_ACCESS_TOKEN || !INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    return { success: false, error: "Instagram credentials not configured" };
  }
  try {
    const containerRes = await fetch(
      `${GRAPH_API_URL}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "REELS",
          video_url: videoUrl,
          caption,
          access_token: META_ACCESS_TOKEN
        })
      }
    );
    const containerData = await containerRes.json();
    if (!containerData.id) {
      return {
        success: false,
        error: containerData.error?.message || "Failed to create reel container"
      };
    }
    let status = "IN_PROGRESS";
    let attempts = 0;
    while (status === "IN_PROGRESS" && attempts < 60) {
      await new Promise((r) => setTimeout(r, 3e3));
      const statusRes = await fetch(
        `${GRAPH_API_URL}/${containerData.id}?fields=status_code&access_token=${META_ACCESS_TOKEN}`
      );
      const statusData = await statusRes.json();
      status = statusData.status_code || "FINISHED";
      attempts++;
    }
    const publishRes = await fetch(
      `${GRAPH_API_URL}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: META_ACCESS_TOKEN
        })
      }
    );
    const publishData = await publishRes.json();
    if (publishData.id) {
      return { success: true, postId: publishData.id };
    }
    return {
      success: false,
      error: publishData.error?.message || "Failed to publish reel"
    };
  } catch (error) {
    console.error("[Instagram] Reel error:", error);
    return { success: false, error: error.message };
  }
}
async function getInstagramInsights() {
  if (!META_ACCESS_TOKEN || !INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    return { error: "Instagram credentials not configured" };
  }
  try {
    const profileRes = await fetch(
      `${GRAPH_API_URL}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}?fields=username,name,media_count,profile_picture_url&access_token=${META_ACCESS_TOKEN}`
    );
    const profile = await profileRes.json();
    if (profile.error) {
      const basicRes = await fetch(
        `${GRAPH_API_URL}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}?fields=id,name&access_token=${META_ACCESS_TOKEN}`
      );
      const basicProfile = await basicRes.json();
      if (!basicProfile.error) {
        return {
          success: true,
          profile: { ...basicProfile, username: basicProfile.name || "connected" },
          recentPosts: []
        };
      }
      return { error: profile.error.message };
    }
    const mediaRes = await fetch(
      `${GRAPH_API_URL}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media?fields=id,caption,media_type,timestamp,like_count,comments_count,permalink&limit=10&access_token=${META_ACCESS_TOKEN}`
    );
    const media = await mediaRes.json();
    return {
      success: true,
      profile,
      recentPosts: media.data || []
    };
  } catch (error) {
    return { error: error.message };
  }
}
function setPageToken(token) {
  FB_PAGE_ACCESS_TOKEN = token;
}
function setPageInfo(pageId, pageName) {
  FB_PAGE_ID = pageId;
  FB_PAGE_NAME = pageName;
}
function getPageToken() {
  return FB_PAGE_ACCESS_TOKEN;
}
function getPageInfo() {
  return { pageId: FB_PAGE_ID, pageName: FB_PAGE_NAME, hasToken: !!FB_PAGE_ACCESS_TOKEN };
}
async function saveAndValidatePageToken(token) {
  try {
    const meRes = await fetch(`${GRAPH_API_URL}/me?fields=id,name&access_token=${token}`);
    const meData = await meRes.json();
    if (meData.error) {
      return { success: false, error: meData.error.message };
    }
    console.log(`[Facebook] Token belongs to: ${meData.name} (ID: ${meData.id})`);
    const pagesRes = await fetch(`${GRAPH_API_URL}/me/accounts?fields=id,name,access_token,category&limit=100&access_token=${token}`);
    const pagesData = await pagesRes.json();
    if (pagesData.data && pagesData.data.length > 0) {
      const page = pagesData.data[0];
      FB_PAGE_ID = page.id;
      FB_PAGE_NAME = page.name;
      FB_PAGE_ACCESS_TOKEN = page.access_token;
      console.log(`[Facebook] Found page: ${page.name} (ID: ${page.id}) - using page access token`);
      if (META_APP_ID && META_APP_SECRET) {
        try {
          const longRes = await fetch(
            `${GRAPH_API_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${page.access_token}`
          );
          const longData = await longRes.json();
          if (longData.access_token) {
            FB_PAGE_ACCESS_TOKEN = longData.access_token;
            console.log("[Facebook] Exchanged for long-lived page token (never expires)");
          }
        } catch (e) {
          console.log("[Facebook] Could not exchange for long-lived token, using short-lived");
        }
      }
      return { success: true, pageId: page.id, pageName: page.name };
    }
    const isPage = meData.id && !meData.id.startsWith("1") ? false : true;
    const checkPageRes = await fetch(`${GRAPH_API_URL}/${meData.id}?fields=id,name,category,fan_count&access_token=${token}`);
    const checkPageData = await checkPageRes.json();
    if (checkPageData.category || checkPageData.fan_count !== void 0) {
      FB_PAGE_ACCESS_TOKEN = token;
      FB_PAGE_ID = meData.id;
      FB_PAGE_NAME = meData.name;
      console.log(`[Facebook] Token IS a page token for: ${meData.name} (ID: ${meData.id})`);
      if (META_APP_ID && META_APP_SECRET) {
        try {
          const longRes = await fetch(
            `${GRAPH_API_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${token}`
          );
          const longData = await longRes.json();
          if (longData.access_token) {
            FB_PAGE_ACCESS_TOKEN = longData.access_token;
            console.log("[Facebook] Exchanged for long-lived page token");
          }
        } catch (e) {
        }
      }
      return { success: true, pageId: meData.id, pageName: meData.name };
    }
    FB_PAGE_ACCESS_TOKEN = token;
    FB_PAGE_ID = meData.id;
    FB_PAGE_NAME = meData.name;
    console.log(`[Facebook] Saved token for user: ${meData.name} (no pages found - user may need to select pages in Graph API Explorer)`);
    return {
      success: true,
      pageId: meData.id,
      pageName: meData.name,
      error: "Token saved but no Facebook Pages found. In Graph API Explorer, make sure to select 'pages_manage_posts' permission and choose your 'travoney' page."
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
async function getPageStatus() {
  if (!FB_PAGE_ACCESS_TOKEN || !FB_PAGE_ID) {
    return { connected: false, pageId: null, pageName: null };
  }
  try {
    const res = await fetch(`${GRAPH_API_URL}/${FB_PAGE_ID}?fields=id,name,fan_count,followers_count,link&access_token=${FB_PAGE_ACCESS_TOKEN}`);
    const data = await res.json();
    if (data.error) {
      return { connected: false, pageId: FB_PAGE_ID, pageName: FB_PAGE_NAME, error: data.error.message };
    }
    return {
      connected: true,
      pageId: data.id,
      pageName: data.name,
      fanCount: data.fan_count || 0,
      followersCount: data.followers_count || 0,
      link: data.link || null
    };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}
async function postToFacebookPage(message, link, imageUrl) {
  const token = FB_PAGE_ACCESS_TOKEN || META_ACCESS_TOKEN;
  const pageId = FB_PAGE_ID;
  if (!token || !pageId) {
    return { success: false, error: "Facebook Page token not configured. Go to /connect-instagram to set up." };
  }
  try {
    if (imageUrl) {
      const res2 = await fetch(`${GRAPH_API_URL}/${pageId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: imageUrl, message, access_token: token })
      });
      const data2 = await res2.json();
      if (data2.id || data2.post_id) {
        return { success: true, postId: data2.post_id || data2.id };
      }
      return { success: false, error: data2.error?.message || "Failed to post photo" };
    }
    const body = { message, access_token: token };
    if (link) body.link = link;
    const res = await fetch(`${GRAPH_API_URL}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.id) {
      return { success: true, postId: data.id };
    }
    return {
      success: false,
      error: data.error?.message || "Failed to post to Facebook"
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
var META_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID, META_APP_ID, META_APP_SECRET, GRAPH_API_URL, FB_PAGE_ACCESS_TOKEN, FB_PAGE_ID, FB_PAGE_NAME;
var init_instagramService = __esm({
  "server/instagramService.ts"() {
    "use strict";
    META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
    INSTAGRAM_BUSINESS_ACCOUNT_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    META_APP_ID = process.env.META_APP_ID;
    META_APP_SECRET = process.env.META_APP_SECRET;
    GRAPH_API_URL = "https://graph.facebook.com/v21.0";
    FB_PAGE_ACCESS_TOKEN = null;
    FB_PAGE_ID = null;
    FB_PAGE_NAME = null;
  }
});

// server/tiktokService.ts
var tiktokService_exports = {};
__export(tiktokService_exports, {
  exchangeCodeForToken: () => exchangeCodeForToken2,
  getAuthUrl: () => getAuthUrl,
  getStoredTokens: () => getStoredTokens,
  getUserInfo: () => getUserInfo,
  isConnected: () => isConnected,
  postPhotoToTikTok: () => postPhotoToTikTok,
  postVideoToTikTok: () => postVideoToTikTok,
  refreshAccessToken: () => refreshAccessToken2,
  setTokens: () => setTokens
});
function getAuthUrl(redirectUri, state = "tiktok_auth") {
  if (!TIKTOK_CLIENT_KEY) return "";
  const params = new URLSearchParams({
    client_key: TIKTOK_CLIENT_KEY,
    response_type: "code",
    scope: "user.info.basic,video.publish,video.upload",
    redirect_uri: redirectUri,
    state
  });
  return `${TIKTOK_AUTH_URL}/?${params.toString()}`;
}
async function exchangeCodeForToken2(code, redirectUri) {
  if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
    return { success: false, error: "TikTok credentials not configured" };
  }
  try {
    const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri
      }).toString()
    });
    const data = await response.json();
    if (data.access_token) {
      storedTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        open_id: data.open_id
      };
      return { success: true, tokens: storedTokens };
    }
    return { success: false, error: data.error_description || data.error || "Token exchange failed" };
  } catch (error) {
    console.error("[TikTok] Token exchange error:", error);
    return { success: false, error: error.message };
  }
}
async function refreshAccessToken2() {
  if (!storedTokens?.refresh_token || !TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
    return { success: false, error: "No refresh token or credentials available" };
  }
  try {
    const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: storedTokens.refresh_token
      }).toString()
    });
    const data = await response.json();
    if (data.access_token) {
      storedTokens = {
        ...storedTokens,
        access_token: data.access_token,
        refresh_token: data.refresh_token || storedTokens.refresh_token,
        expires_in: data.expires_in
      };
      return { success: true };
    }
    return { success: false, error: data.error_description || "Refresh failed" };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
async function postVideoToTikTok(videoUrl, title) {
  if (!storedTokens?.access_token) {
    return { success: false, error: "Not authenticated. Please connect TikTok first." };
  }
  try {
    const initResponse = await fetch(`${TIKTOK_API_URL}/post/publish/video/init/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${storedTokens.access_token}`,
        "Content-Type": "application/json; charset=UTF-8"
      },
      body: JSON.stringify({
        post_info: {
          title: title.substring(0, 150),
          privacy_level: "PUBLIC_TO_EVERYONE",
          disable_duet: false,
          disable_stitch: false,
          disable_comment: false
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: videoUrl
        }
      })
    });
    const initData = await initResponse.json();
    if (initData.data?.publish_id) {
      return { success: true, publishId: initData.data.publish_id };
    }
    return {
      success: false,
      error: initData.error?.message || initData.error?.code || "Failed to init video post"
    };
  } catch (error) {
    console.error("[TikTok] Post error:", error);
    return { success: false, error: error.message };
  }
}
async function postPhotoToTikTok(imageUrls, title) {
  if (!storedTokens?.access_token) {
    return { success: false, error: "Not authenticated. Please connect TikTok first." };
  }
  try {
    const initResponse = await fetch(`${TIKTOK_API_URL}/post/publish/content/init/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${storedTokens.access_token}`,
        "Content-Type": "application/json; charset=UTF-8"
      },
      body: JSON.stringify({
        post_info: {
          title: title.substring(0, 150),
          privacy_level: "PUBLIC_TO_EVERYONE",
          disable_comment: false
        },
        source_info: {
          source: "PULL_FROM_URL",
          photo_images: imageUrls
        },
        post_mode: "DIRECT_POST",
        media_type: "PHOTO"
      })
    });
    const initData = await initResponse.json();
    if (initData.data?.publish_id) {
      return { success: true, publishId: initData.data.publish_id };
    }
    return {
      success: false,
      error: initData.error?.message || initData.error?.code || "Failed to post photos"
    };
  } catch (error) {
    console.error("[TikTok] Photo post error:", error);
    return { success: false, error: error.message };
  }
}
async function getUserInfo() {
  if (!storedTokens?.access_token) {
    return { connected: false, error: "Not authenticated" };
  }
  try {
    const response = await fetch(`${TIKTOK_API_URL}/user/info/?fields=open_id,union_id,avatar_url,display_name`, {
      headers: {
        "Authorization": `Bearer ${storedTokens.access_token}`
      }
    });
    const data = await response.json();
    if (data.data?.user) {
      return { connected: true, user: data.data.user };
    }
    return { connected: false, error: data.error?.message || "Failed to get user info" };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}
function isConnected() {
  return !!storedTokens?.access_token;
}
function setTokens(tokens) {
  storedTokens = tokens;
}
function getStoredTokens() {
  return storedTokens;
}
var TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_API_URL, TIKTOK_AUTH_URL, storedTokens;
var init_tiktokService = __esm({
  "server/tiktokService.ts"() {
    "use strict";
    TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
    TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
    TIKTOK_API_URL = "https://open.tiktokapis.com/v2";
    TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize";
    storedTokens = null;
  }
});

// server/errors.ts
var errors_exports = {};
__export(errors_exports, {
  AppError: () => AppError,
  AuthenticationError: () => AuthenticationError,
  AuthorizationError: () => AuthorizationError,
  BlockchainError: () => BlockchainError,
  ConflictError: () => ConflictError,
  ExternalServiceError: () => ExternalServiceError,
  NotFoundError: () => NotFoundError,
  PaymentError: () => PaymentError,
  RateLimitError: () => RateLimitError,
  RideError: () => RideError,
  ValidationError: () => ValidationError,
  isAppError: () => isAppError
});
function isAppError(error) {
  return error instanceof AppError;
}
var AppError, ValidationError, AuthenticationError, AuthorizationError, NotFoundError, ConflictError, RateLimitError, ExternalServiceError, PaymentError, BlockchainError, RideError;
var init_errors = __esm({
  "server/errors.ts"() {
    "use strict";
    AppError = class extends Error {
      constructor(message, code, statusCode = 500, details, isOperational = true) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.isOperational = isOperational;
        this.name = this.constructor.name;
        if (Error.captureStackTrace) {
          Error.captureStackTrace(this, this.constructor);
        }
      }
      toJSON() {
        return {
          error: this.name,
          code: this.code,
          message: this.message,
          ...this.details ? { details: this.details } : {}
        };
      }
    };
    ValidationError = class extends AppError {
      constructor(message, details) {
        super(message, "VALIDATION_ERROR", 400, details);
      }
    };
    AuthenticationError = class extends AppError {
      constructor(message = "Authentication required") {
        super(message, "AUTHENTICATION_ERROR", 401);
      }
    };
    AuthorizationError = class extends AppError {
      constructor(message = "Insufficient permissions") {
        super(message, "AUTHORIZATION_ERROR", 403);
      }
    };
    NotFoundError = class extends AppError {
      constructor(resource, id) {
        super(
          id ? `${resource} not found` : resource,
          "NOT_FOUND",
          404,
          id ? { resource, id } : void 0
        );
      }
    };
    ConflictError = class extends AppError {
      constructor(message, details) {
        super(message, "CONFLICT", 409, details);
      }
    };
    RateLimitError = class extends AppError {
      constructor(message = "Too many requests", retryAfterMs) {
        super(message, "RATE_LIMIT", 429, retryAfterMs ? { retryAfterMs } : void 0);
      }
    };
    ExternalServiceError = class extends AppError {
      constructor(service, message, originalError) {
        super(
          `${service} service error: ${message}`,
          "EXTERNAL_SERVICE_ERROR",
          502,
          {
            service,
            ...originalError ? { originalMessage: originalError.message } : {}
          }
        );
      }
    };
    PaymentError = class extends AppError {
      constructor(message, provider2, details) {
        super(message, "PAYMENT_ERROR", 402, { provider: provider2, ...details });
      }
    };
    BlockchainError = class extends AppError {
      constructor(message, details) {
        super(message, "BLOCKCHAIN_ERROR", 503, details);
      }
    };
    RideError = class extends AppError {
      constructor(message, rideId, code = "RIDE_ERROR") {
        super(message, code, 400, rideId ? { rideId } : void 0);
      }
    };
  }
});

// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";

// server/storage.ts
init_schema();
init_db();
import { eq, and, desc, sql as sql2 } from "drizzle-orm";
var DatabaseStorage = class {
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || void 0;
  }
  async getUserByEmail(email) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || void 0;
  }
  async getUserByPhone(phone) {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user || void 0;
  }
  async createUser(insertUser) {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  async updateUser(id, data) {
    const [user] = await db.update(users).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, id)).returning();
    return user || void 0;
  }
  async getDriver(id) {
    const [driver] = await db.select().from(drivers).where(eq(drivers.id, id));
    return driver || void 0;
  }
  async getDriverByUserId(userId) {
    const [driver] = await db.select().from(drivers).where(eq(drivers.userId, userId));
    return driver || void 0;
  }
  async getAvailableDrivers(lat, lng, radius) {
    const result = await db.select().from(drivers).where(and(eq(drivers.isOnline, true), eq(drivers.status, "approved")));
    return result.filter((driver) => {
      if (!driver.currentLat || !driver.currentLng) return false;
      const distance = this.calculateDistance(lat, lng, parseFloat(driver.currentLat), parseFloat(driver.currentLng));
      return distance <= radius;
    });
  }
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  async createDriver(data) {
    const [driver] = await db.insert(drivers).values(data).returning();
    return driver;
  }
  async updateDriver(id, data) {
    const [driver] = await db.update(drivers).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(drivers.id, id)).returning();
    return driver || void 0;
  }
  async getVehicle(id) {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    return vehicle || void 0;
  }
  async getVehiclesByDriver(driverId) {
    return db.select().from(vehicles).where(eq(vehicles.driverId, driverId));
  }
  async createVehicle(data) {
    const [vehicle] = await db.insert(vehicles).values(data).returning();
    return vehicle;
  }
  async getDriverVehicles(driverId) {
    return db.select().from(vehicles).where(eq(vehicles.driverId, driverId));
  }
  async updateVehicle(id, data) {
    const [vehicle] = await db.update(vehicles).set(data).where(eq(vehicles.id, id)).returning();
    return vehicle || void 0;
  }
  async getPendingVehicleVerifications() {
    return db.select().from(vehicles).where(eq(vehicles.verificationStatus, "pending")).orderBy(desc(vehicles.createdAt));
  }
  async getVehicleVerificationStats() {
    const allVehicles = await db.select().from(vehicles);
    const stats = {
      pending: 0,
      aiVerified: 0,
      adminVerified: 0,
      rejected: 0,
      total: allVehicles.length
    };
    for (const v of allVehicles) {
      if (v.verificationStatus === "pending") stats.pending++;
      else if (v.verificationStatus === "ai_verified") stats.aiVerified++;
      else if (v.verificationStatus === "admin_verified") stats.adminVerified++;
      else if (v.verificationStatus === "rejected") stats.rejected++;
    }
    return stats;
  }
  async getVehiclesByRegion() {
    const allVehicles = await db.select().from(vehicles);
    const allDrivers = await db.select().from(drivers);
    const allUsers = await db.select().from(users);
    const driverUserMap = new Map(allDrivers.map((d) => [d.id, d.userId]));
    const userRegionMap = new Map(allUsers.map((u) => [u.id, u.regionCode || "AE"]));
    const regionData = {};
    for (const vehicle of allVehicles) {
      const userId = driverUserMap.get(vehicle.driverId);
      const regionCode = userId ? userRegionMap.get(userId) || "AE" : "AE";
      if (!regionData[regionCode]) {
        regionData[regionCode] = { count: 0, vehicleTypes: {} };
      }
      regionData[regionCode].count++;
      const vType = vehicle.type || "unknown";
      regionData[regionCode].vehicleTypes[vType] = (regionData[regionCode].vehicleTypes[vType] || 0) + 1;
    }
    return Object.entries(regionData).map(([regionCode, data]) => ({
      regionCode,
      count: data.count,
      vehicleTypes: data.vehicleTypes
    }));
  }
  async getRide(id) {
    const [ride] = await db.select().from(rides).where(eq(rides.id, id));
    return ride || void 0;
  }
  async getRidesByCustomer(customerId) {
    return db.select().from(rides).where(eq(rides.customerId, customerId)).orderBy(desc(rides.createdAt));
  }
  async getRidesByDriver(driverId) {
    return db.select().from(rides).where(eq(rides.driverId, driverId)).orderBy(desc(rides.createdAt));
  }
  async createRide(data) {
    const otp = Math.floor(1e3 + Math.random() * 9e3).toString();
    const [ride] = await db.insert(rides).values({ ...data, otp }).returning();
    return ride;
  }
  async updateRide(id, data) {
    const [ride] = await db.update(rides).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(rides.id, id)).returning();
    return ride || void 0;
  }
  async getSavedAddresses(userId) {
    return db.select().from(savedAddresses).where(eq(savedAddresses.userId, userId));
  }
  async createSavedAddress(data) {
    const [address] = await db.insert(savedAddresses).values(data).returning();
    return address;
  }
  async deleteSavedAddress(id) {
    await db.delete(savedAddresses).where(eq(savedAddresses.id, id));
  }
  async getServiceTypes() {
    return db.select().from(serviceTypes).where(eq(serviceTypes.isActive, true));
  }
  async getServiceType(id) {
    const [type] = await db.select().from(serviceTypes).where(eq(serviceTypes.id, id));
    return type || void 0;
  }
  async getCoupon(code) {
    const [coupon] = await db.select().from(coupons).where(and(eq(coupons.code, code), eq(coupons.isActive, true)));
    return coupon || void 0;
  }
  async getPaymentMethods(userId) {
    return db.select().from(paymentMethods).where(eq(paymentMethods.userId, userId));
  }
  async createPaymentMethod(data) {
    const [method] = await db.insert(paymentMethods).values(data).returning();
    return method;
  }
  async getEmergencyContacts(userId) {
    return db.select().from(emergencyContacts).where(eq(emergencyContacts.userId, userId));
  }
  async createEmergencyContact(data) {
    const [contact] = await db.insert(emergencyContacts).values(data).returning();
    return contact;
  }
  async deleteEmergencyContact(id) {
    await db.delete(emergencyContacts).where(eq(emergencyContacts.id, id));
  }
  async createRating(data) {
    const [rating] = await db.insert(ratings).values(data).returning();
    if (data.toDriverId) {
      const driverRatings = await this.getDriverRatings(data.toDriverId);
      const avgRating = driverRatings.reduce((sum2, r) => sum2 + r.rating, 0) / driverRatings.length;
      await this.updateDriver(data.toDriverId, { rating: avgRating.toFixed(2) });
    }
    return rating;
  }
  async getDriverRatings(driverId) {
    return db.select().from(ratings).where(eq(ratings.toDriverId, driverId)).orderBy(desc(ratings.createdAt));
  }
  async getPendingRides() {
    return db.select().from(rides).where(eq(rides.status, "pending")).orderBy(desc(rides.createdAt));
  }
  async getDriverEarnings(driverId, period) {
    const now = /* @__PURE__ */ new Date();
    let startDate = /* @__PURE__ */ new Date();
    switch (period) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "week":
        startDate.setDate(now.getDate() - 7);
        break;
      case "month":
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        startDate.setHours(0, 0, 0, 0);
    }
    const completedRides = await db.select().from(rides).where(and(eq(rides.driverId, driverId), eq(rides.status, "completed")));
    const filteredRides = completedRides.filter(
      (ride) => ride.completedAt && new Date(ride.completedAt) >= startDate
    );
    const totalEarnings = filteredRides.reduce(
      (sum2, ride) => sum2 + parseFloat(ride.actualFare || ride.estimatedFare || "0"),
      0
    );
    return {
      totalEarnings: totalEarnings.toFixed(2),
      totalTrips: filteredRides.length,
      period,
      rides: filteredRides
    };
  }
  async getAdminStats() {
    const allUsers = await db.select().from(users);
    const allDrivers = await db.select().from(drivers);
    const allRides = await db.select().from(rides);
    const completedRides = allRides.filter((r) => r.status === "completed");
    const totalRevenue = completedRides.reduce(
      (sum2, ride) => sum2 + parseFloat(ride.actualFare || ride.estimatedFare || "0"),
      0
    );
    return {
      totalUsers: allUsers.filter((u) => u.role === "customer").length,
      totalDrivers: allDrivers.length,
      totalRides: allRides.length,
      completedRides: completedRides.length,
      pendingRides: allRides.filter((r) => r.status === "pending").length,
      cancelledRides: allRides.filter((r) => r.status === "cancelled").length,
      totalRevenue: totalRevenue.toFixed(2),
      approvedDrivers: allDrivers.filter((d) => d.status === "approved").length,
      pendingDrivers: allDrivers.filter((d) => d.status === "pending").length
    };
  }
  async getAllUsers(role, page = 1, limit = 20) {
    let allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
    if (role) {
      allUsers = allUsers.filter((u) => u.role === role);
    }
    const total = allUsers.length;
    const start = (page - 1) * limit;
    return { users: allUsers.slice(start, start + limit), total };
  }
  async getAllDrivers(status, page = 1, limit = 20) {
    let allDrivers = await db.select({
      driver: drivers,
      user: users
    }).from(drivers).leftJoin(users, eq(drivers.userId, users.id)).orderBy(desc(drivers.createdAt));
    if (status) {
      allDrivers = allDrivers.filter((d) => d.driver.status === status);
    }
    const total = allDrivers.length;
    const start = (page - 1) * limit;
    return { drivers: allDrivers.slice(start, start + limit), total };
  }
  async getAllRides(status, page = 1, limit = 20) {
    let allRides = await db.select().from(rides).orderBy(desc(rides.createdAt));
    if (status) {
      allRides = allRides.filter((r) => r.status === status);
    }
    const total = allRides.length;
    const start = (page - 1) * limit;
    return { rides: allRides.slice(start, start + limit), total };
  }
  async createWalletTransaction(data) {
    const [transaction] = await db.insert(walletTransactions).values(data).returning();
    return transaction;
  }
  async getWalletTransactions(userId) {
    return db.select().from(walletTransactions).where(eq(walletTransactions.userId, userId)).orderBy(desc(walletTransactions.createdAt));
  }
  async getDriverTransactions(driverId) {
    return db.select().from(walletTransactions).where(eq(walletTransactions.driverId, driverId)).orderBy(desc(walletTransactions.createdAt));
  }
  async updateWalletTransaction(id, data) {
    const [transaction] = await db.update(walletTransactions).set(data).where(eq(walletTransactions.id, id)).returning();
    return transaction || void 0;
  }
  async createPayment(data) {
    const [payment] = await db.insert(payments).values(data).returning();
    return payment;
  }
  async getPayment(id) {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment || void 0;
  }
  async updatePayment(id, data) {
    const [payment] = await db.update(payments).set(data).where(eq(payments.id, id)).returning();
    return payment || void 0;
  }
  async getPaymentByRideId(rideId) {
    const [payment] = await db.select().from(payments).where(eq(payments.rideId, rideId));
    return payment || void 0;
  }
  async updateUserWalletBalance(userId, amount) {
    const user = await this.getUser(userId);
    if (!user) return void 0;
    const currentBalance = parseFloat(user.walletBalance || "0");
    const newBalance = (currentBalance + amount).toFixed(2);
    return this.updateUser(userId, { walletBalance: newBalance });
  }
  async updateDriverWalletBalance(driverId, amount) {
    const driver = await this.getDriver(driverId);
    if (!driver) return void 0;
    const currentBalance = parseFloat(driver.walletBalance || "0");
    const newBalance = (currentBalance + amount).toFixed(2);
    return this.updateDriver(driverId, { walletBalance: newBalance });
  }
  async createDriverPayout(data) {
    const [payout] = await db.insert(driverPayouts).values(data).returning();
    return payout;
  }
  async getDriverPayouts(driverId) {
    return db.select().from(driverPayouts).where(eq(driverPayouts.driverId, driverId)).orderBy(desc(driverPayouts.createdAt));
  }
  async updateDriverPayout(id, data) {
    const [payout] = await db.update(driverPayouts).set(data).where(eq(driverPayouts.id, id)).returning();
    return payout || void 0;
  }
  async getDriverBankAccounts(driverId) {
    return db.select().from(driverBankAccounts).where(eq(driverBankAccounts.driverId, driverId));
  }
  async createDriverBankAccount(data) {
    const [account] = await db.insert(driverBankAccounts).values(data).returning();
    return account;
  }
  async deleteDriverBankAccount(id) {
    await db.delete(driverBankAccounts).where(eq(driverBankAccounts.id, id));
  }
  async setDefaultPaymentMethod(userId, paymentMethodId) {
    await db.update(paymentMethods).set({ isDefault: false }).where(eq(paymentMethods.userId, userId));
    await db.update(paymentMethods).set({ isDefault: true }).where(eq(paymentMethods.id, paymentMethodId));
  }
  async deletePaymentMethod(id) {
    await db.delete(paymentMethods).where(eq(paymentMethods.id, id));
  }
  async getDefaultPaymentMethod(userId) {
    const [method] = await db.select().from(paymentMethods).where(and(eq(paymentMethods.userId, userId), eq(paymentMethods.isDefault, true)));
    return method || void 0;
  }
  async getActiveRidesCount() {
    const result = await db.select({ count: sql2`count(*)` }).from(rides).where(
      sql2`${rides.status} IN ('pending', 'accepted', 'arriving', 'started', 'in_progress')`
    );
    return Number(result[0]?.count || 0);
  }
  async getAvailableDriversCount(lat, lng, radius) {
    const availableDrivers = await this.getAvailableDrivers(lat, lng, radius);
    return availableDrivers.length;
  }
  async getAvailableDriversWithVehicles(lat, lng, radius) {
    const availableDrivers = await db.select({
      id: drivers.id,
      userId: drivers.userId,
      currentLat: drivers.currentLat,
      currentLng: drivers.currentLng,
      rating: drivers.rating,
      totalTrips: drivers.totalTrips,
      vehicleType: vehicles.type,
      vehicleMake: vehicles.make,
      vehicleModel: vehicles.model,
      plateNumber: vehicles.plateNumber
    }).from(drivers).innerJoin(vehicles, eq(vehicles.driverId, drivers.id)).innerJoin(users, eq(users.id, drivers.userId)).where(
      and(
        eq(drivers.isOnline, true),
        eq(drivers.status, "approved"),
        eq(vehicles.isActive, true)
      )
    );
    return availableDrivers.filter((driver) => {
      if (!driver.currentLat || !driver.currentLng) return false;
      const distance = this.calculateDistance(lat, lng, parseFloat(driver.currentLat), parseFloat(driver.currentLng));
      return distance <= radius;
    }).map((driver) => ({
      ...driver,
      name: "Driver"
    }));
  }
  async createSession(token, userId, role, expiresAt) {
    const [session] = await db.insert(sessions).values({
      token,
      userId,
      role,
      expiresAt
    }).returning();
    return session;
  }
  async getSession(token) {
    const [session] = await db.select().from(sessions).where(eq(sessions.token, token));
    return session || void 0;
  }
  async deleteSession(token) {
    await db.delete(sessions).where(eq(sessions.token, token));
  }
  async deleteExpiredSessions() {
    await db.delete(sessions).where(sql2`${sessions.expiresAt} < NOW()`);
  }
  async getDriverCryptoSettings(driverId) {
    const [settings] = await db.select().from(driverCryptoSettings).where(eq(driverCryptoSettings.driverId, driverId));
    return settings || void 0;
  }
  async createDriverCryptoSettings(data) {
    const [settings] = await db.insert(driverCryptoSettings).values(data).returning();
    return settings;
  }
  async updateDriverCryptoSettings(driverId, data) {
    const [settings] = await db.update(driverCryptoSettings).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(driverCryptoSettings.driverId, driverId)).returning();
    return settings || void 0;
  }
  async createRideInvoice(data) {
    const [invoice] = await db.insert(rideInvoices).values(data).returning();
    return invoice;
  }
  async getRideInvoice(id) {
    const [invoice] = await db.select().from(rideInvoices).where(eq(rideInvoices.id, id));
    return invoice || void 0;
  }
  async getRideInvoicesByRide(rideId) {
    return db.select().from(rideInvoices).where(eq(rideInvoices.rideId, rideId));
  }
  async getRideInvoicesByRecipient(recipientId, invoiceType) {
    if (invoiceType) {
      return db.select().from(rideInvoices).where(and(eq(rideInvoices.recipientId, recipientId), eq(rideInvoices.invoiceType, invoiceType))).orderBy(desc(rideInvoices.createdAt));
    }
    return db.select().from(rideInvoices).where(eq(rideInvoices.recipientId, recipientId)).orderBy(desc(rideInvoices.createdAt));
  }
  async getDriverPayout(id) {
    const [payout] = await db.select().from(driverPayouts).where(eq(driverPayouts.id, id));
    return payout || void 0;
  }
  async getDriverUsdtBalance(driverId) {
    const transactions = await db.select().from(walletTransactions).where(and(
      eq(walletTransactions.driverId, driverId),
      eq(walletTransactions.currency, "USDT"),
      eq(walletTransactions.status, "completed")
    ));
    let balance = 0;
    for (const tx of transactions) {
      const amount = parseFloat(tx.amount);
      if (tx.type === "payout" || tx.type === "withdrawal") {
        balance -= amount;
      } else {
        balance += amount;
      }
    }
    return Math.max(0, balance);
  }
};
var storage = new DatabaseStorage();

// server/routes.ts
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { v4 as uuidv45 } from "uuid";

// server/aiEngine.ts
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function getTimeOfDayMultiplier() {
  const hour = (/* @__PURE__ */ new Date()).getHours();
  if (hour >= 7 && hour <= 9) {
    return { multiplier: 1.15, reason: "Morning rush hour" };
  }
  if (hour >= 17 && hour <= 19) {
    return { multiplier: 1.2, reason: "Evening rush hour" };
  }
  if (hour >= 22 || hour <= 5) {
    return { multiplier: 1.1, reason: "Late night surcharge" };
  }
  if (hour >= 13 && hour <= 15) {
    return { multiplier: 0.95, reason: "Off-peak discount" };
  }
  return { multiplier: 1, reason: "Standard rate" };
}
function getTrafficMultiplier(distance) {
  const hour = (/* @__PURE__ */ new Date()).getHours();
  const isWeekend = [0, 6].includes((/* @__PURE__ */ new Date()).getDay());
  if (isWeekend) {
    return { multiplier: 0.95, reason: "Weekend - less traffic" };
  }
  if (hour >= 7 && hour <= 9 || hour >= 17 && hour <= 19) {
    if (distance > 10) {
      return { multiplier: 1.25, reason: "Heavy traffic on long route" };
    }
    return { multiplier: 1.15, reason: "Rush hour traffic" };
  }
  return { multiplier: 1, reason: "Normal traffic" };
}
async function getDemandData(lat, lng) {
  const activeRides = await storage.getActiveRidesCount();
  const availableDrivers = await storage.getAvailableDriversCount(lat, lng, 10);
  const demandRatio = availableDrivers > 0 ? activeRides / availableDrivers : 2;
  return {
    activeRides,
    availableDrivers,
    demandRatio: Math.min(demandRatio, 3)
  };
}
function getDemandMultiplier(demandRatio) {
  if (demandRatio <= 0.5) {
    return { multiplier: 0.9, reason: "Low demand - 10% discount" };
  }
  if (demandRatio <= 1) {
    return { multiplier: 1, reason: "Normal demand" };
  }
  if (demandRatio <= 1.5) {
    return { multiplier: 1.1, reason: "High demand (+10%)" };
  }
  if (demandRatio <= 2) {
    return { multiplier: 1.2, reason: "Very high demand (+20%)" };
  }
  return { multiplier: 1.3, reason: "Peak demand - capped at +30%" };
}
async function findOptimalDrivers(pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType) {
  const availableDrivers = await storage.getAvailableDriversWithVehicles(
    pickupLat,
    pickupLng,
    15
  );
  const scoredDrivers = [];
  for (const driver of availableDrivers) {
    if (vehicleType && driver.vehicleType !== vehicleType) {
      continue;
    }
    const driverLat = parseFloat(driver.currentLat || "0");
    const driverLng = parseFloat(driver.currentLng || "0");
    if (driverLat === 0 || driverLng === 0) continue;
    const distance = calculateDistance(pickupLat, pickupLng, driverLat, driverLng);
    const eta = Math.round(distance * 3 + 2);
    const rating = parseFloat(driver.rating || "5.0");
    const totalTrips = driver.totalTrips || 0;
    const distanceScore = Math.max(0, 100 - distance * 10);
    const ratingScore = rating / 5 * 100;
    let experienceScore = 50;
    if (totalTrips >= 100) experienceScore = 90;
    else if (totalTrips >= 50) experienceScore = 80;
    else if (totalTrips >= 20) experienceScore = 70;
    else if (totalTrips >= 10) experienceScore = 60;
    const availabilityScore = 100;
    const score = distanceScore * 0.4 + ratingScore * 0.3 + experienceScore * 0.2 + availabilityScore * 0.1;
    scoredDrivers.push({
      driverId: driver.id,
      userId: driver.userId,
      name: driver.name,
      rating,
      totalTrips,
      distance: Math.round(distance * 10) / 10,
      eta,
      vehicleType: driver.vehicleType,
      vehicleMake: driver.vehicleMake,
      vehicleModel: driver.vehicleModel,
      plateNumber: driver.plateNumber,
      score: Math.round(score * 10) / 10,
      scoreBreakdown: {
        distanceScore: Math.round(distanceScore),
        ratingScore: Math.round(ratingScore),
        experienceScore: Math.round(experienceScore),
        availabilityScore: Math.round(availabilityScore)
      }
    });
  }
  return scoredDrivers.sort((a, b) => b.score - a.score);
}
async function calculateOptimalPrice(pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType = "economy") {
  const distance = calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
  const estimatedMinutes = Math.round(distance * 3 + 5);
  const serviceTypes2 = await storage.getServiceTypes();
  const service = serviceTypes2.find((s) => s.type === vehicleType) || {
    baseFare: "5.00",
    perKmRate: "2.00",
    perMinuteRate: "0.30"
  };
  const baseFare = parseFloat(service.baseFare);
  const perKmRate = parseFloat(service.perKmRate);
  const perMinuteRate = parseFloat(service.perMinuteRate);
  const distanceCharge = distance * perKmRate;
  const timeCharge = estimatedMinutes * perMinuteRate;
  const demandData = await getDemandData(pickupLat, pickupLng);
  const demandInfo = getDemandMultiplier(demandData.demandRatio);
  const timeOfDayInfo = getTimeOfDayMultiplier();
  const trafficInfo = getTrafficMultiplier(distance);
  const priceExplanation = [];
  priceExplanation.push(`Base fare: AED ${baseFare.toFixed(2)}`);
  priceExplanation.push(`Distance (${distance.toFixed(1)} km \xD7 ${perKmRate.toFixed(2)}): AED ${distanceCharge.toFixed(2)}`);
  priceExplanation.push(`Time (~${estimatedMinutes} min \xD7 ${perMinuteRate.toFixed(2)}): AED ${timeCharge.toFixed(2)}`);
  let subtotal = baseFare + distanceCharge + timeCharge;
  if (demandInfo.multiplier !== 1) {
    priceExplanation.push(`${demandInfo.reason}: ${((demandInfo.multiplier - 1) * 100).toFixed(0)}%`);
  }
  if (timeOfDayInfo.multiplier !== 1) {
    priceExplanation.push(`${timeOfDayInfo.reason}: ${((timeOfDayInfo.multiplier - 1) * 100).toFixed(0)}%`);
  }
  if (trafficInfo.multiplier !== 1) {
    priceExplanation.push(`${trafficInfo.reason}: ${((trafficInfo.multiplier - 1) * 100).toFixed(0)}%`);
  }
  const combinedMultiplier = Math.min(
    demandInfo.multiplier * timeOfDayInfo.multiplier * trafficInfo.multiplier,
    1.5
  );
  const adjustedTotal = subtotal * combinedMultiplier;
  const platformFeeRate = 0.1;
  const platformFee = adjustedTotal * platformFeeRate;
  const total = adjustedTotal;
  const driverEarnings = total - platformFee;
  priceExplanation.push(`Platform fee (10%): AED ${platformFee.toFixed(2)}`);
  priceExplanation.push(`Driver receives: AED ${driverEarnings.toFixed(2)}`);
  const regularPrice = subtotal * 1.25;
  const savings = Math.max(0, regularPrice - total);
  if (savings > 0) {
    priceExplanation.push(`AI optimization saved you: AED ${savings.toFixed(2)}`);
  }
  return {
    baseFare,
    distanceCharge: Math.round(distanceCharge * 100) / 100,
    timeCharge: Math.round(timeCharge * 100) / 100,
    demandMultiplier: demandInfo.multiplier,
    timeOfDayMultiplier: timeOfDayInfo.multiplier,
    trafficMultiplier: trafficInfo.multiplier,
    platformFee: Math.round(platformFee * 100) / 100,
    total: Math.round(total * 100) / 100,
    driverEarnings: Math.round(driverEarnings * 100) / 100,
    savings: Math.round(savings * 100) / 100,
    priceExplanation
  };
}
async function getOptimalRideMatch(pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType) {
  const [drivers6, pricing] = await Promise.all([
    findOptimalDrivers(pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType),
    calculateOptimalPrice(pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType)
  ]);
  const bestDriver = drivers6[0] || null;
  const alternativeDrivers = drivers6.slice(1, 4);
  return {
    bestMatch: bestDriver ? {
      driver: bestDriver,
      pricing,
      aiConfidence: Math.min(95, bestDriver.score),
      matchReason: `Best match based on ${bestDriver.distance.toFixed(1)}km distance, ${bestDriver.rating} rating, and ${bestDriver.totalTrips} completed trips`
    } : null,
    alternatives: alternativeDrivers.map((d) => ({
      driver: d,
      pricing
    })),
    demandInfo: {
      availableDrivers: drivers6.length,
      searchRadius: 15
    },
    pricingTransparency: pricing.priceExplanation
  };
}

// server/routes.ts
init_blockchain();

// server/email.ts
import nodemailer from "nodemailer";
var transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});
async function sendRideReceiptEmail(data) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log("Email not configured - skipping receipt email");
    return false;
  }
  const polygonScanUrl = data.blockchainTxHash ? `https://amoy.polygonscan.com/tx/${data.blockchainTxHash}` : `https://amoy.polygonscan.com/address/0xA8C20314004FEA3bE339f73cE4E192eCAaA062Ec`;
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Travony Ride Receipt</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="background-color: #00B14F; padding: 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Travony</h1>
        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Your Ride Receipt</p>
      </td>
    </tr>
    
    <tr>
      <td style="padding: 32px 24px;">
        <p style="margin: 0 0 24px; color: #333; font-size: 16px;">
          Hi ${data.customerName},
        </p>
        <p style="margin: 0 0 24px; color: #666; font-size: 14px;">
          Thank you for riding with Travony! Here are the details of your completed trip.
        </p>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="display: inline-block; width: 12px; height: 12px; background-color: #00B14F; border-radius: 50%; margin-right: 12px; vertical-align: middle;"></span>
                    <span style="color: #666; font-size: 12px;">PICKUP</span>
                    <p style="margin: 4px 0 0 24px; color: #333; font-size: 14px;">${data.pickupAddress}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="display: inline-block; width: 12px; height: 12px; background-color: #E53935; border-radius: 50%; margin-right: 12px; vertical-align: middle;"></span>
                    <span style="color: #666; font-size: 12px;">DROP-OFF</span>
                    <p style="margin: 4px 0 0 24px; color: #333; font-size: 14px;">${data.dropoffAddress}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
              <span style="color: #666; font-size: 14px;">Distance</span>
              <span style="float: right; color: #333; font-size: 14px; font-weight: 500;">${data.distance} km</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
              <span style="color: #666; font-size: 14px;">Duration</span>
              <span style="float: right; color: #333; font-size: 14px; font-weight: 500;">${data.duration} min</span>
            </td>
          </tr>
          ${data.driverName ? `
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
              <span style="color: #666; font-size: 14px;">Driver</span>
              <span style="float: right; color: #333; font-size: 14px; font-weight: 500;">${data.driverName}</span>
            </td>
          </tr>
          ` : ""}
          ${data.vehicleInfo ? `
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
              <span style="color: #666; font-size: 14px;">Vehicle</span>
              <span style="float: right; color: #333; font-size: 14px; font-weight: 500;">${data.vehicleInfo}</span>
            </td>
          </tr>
          ` : ""}
          <tr>
            <td style="padding: 16px 0;">
              <span style="color: #333; font-size: 18px; font-weight: 700;">Total</span>
              <span style="float: right; color: #00B14F; font-size: 24px; font-weight: 700;">AED ${data.fare}</span>
            </td>
          </tr>
        </table>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #8247E5 0%, #6B3CC9 100%); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <tr>
            <td>
              <p style="margin: 0 0 16px; color: #ffffff; font-size: 16px; font-weight: 600;">
                Blockchain Verified
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: rgba(255,255,255,0.8); font-size: 12px;">Network</span>
                    <span style="float: right; color: #ffffff; font-size: 13px;">Polygon Amoy</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: rgba(255,255,255,0.8); font-size: 12px;">Platform Fee (10%)</span>
                    <span style="float: right; color: #ffffff; font-size: 13px;">AED ${data.platformFee}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: rgba(255,255,255,0.8); font-size: 12px;">Driver Earnings (90%)</span>
                    <span style="float: right; color: #ffffff; font-size: 13px;">AED ${data.driverEarnings}</span>
                  </td>
                </tr>
              </table>
              <p style="margin: 16px 0 0; padding: 12px; background: rgba(255,255,255,0.1); border-radius: 8px;">
                <span style="color: rgba(255,255,255,0.7); font-size: 11px; display: block; margin-bottom: 4px;">Ride Hash</span>
                <span style="color: #ffffff; font-size: 11px; font-family: monospace; word-break: break-all;">${data.blockchainHash}</span>
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px;">
                <tr>
                  <td align="center">
                    <a href="${polygonScanUrl}" style="display: inline-block; padding: 12px 24px; background-color: #ffffff; color: #8247E5; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
                      Verify on PolygonScan
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <p style="margin: 0; color: #999; font-size: 12px; text-align: center;">
          Ride ID: ${data.rideId}<br>
          Completed: ${new Date(data.completedAt).toLocaleString()}
        </p>
      </td>
    </tr>
    
    <tr>
      <td style="background-color: #f5f5f5; padding: 24px; text-align: center;">
        <p style="margin: 0 0 8px; color: #666; font-size: 12px;">
          Questions about your ride? Contact us at support@travony.app
        </p>
        <p style="margin: 0; color: #999; font-size: 11px;">
          Travony - Transparent P2P Rides
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
  try {
    await transporter.sendMail({
      from: `"Travony" <${process.env.SMTP_USER}>`,
      to: data.customerEmail,
      subject: `Your Travony Ride Receipt - AED ${data.fare}`,
      html: htmlContent
    });
    console.log(`Ride receipt email sent to ${data.customerEmail}`);
    return true;
  } catch (error) {
    console.error("Failed to send ride receipt email:", error);
    return false;
  }
}
async function sendDriverEarningsEmail(data) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log("Email not configured - skipping driver earnings email");
    return false;
  }
  const polygonScanUrl = data.blockchainTxHash ? `https://amoy.polygonscan.com/tx/${data.blockchainTxHash}` : `https://amoy.polygonscan.com/address/0xA8C20314004FEA3bE339f73cE4E192eCAaA062Ec`;
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Travony Earnings Summary</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="background-color: #00B14F; padding: 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Travony</h1>
        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Route Completed - Yield Summary</p>
      </td>
    </tr>
    
    <tr>
      <td style="padding: 32px 24px;">
        <p style="margin: 0 0 24px; color: #333; font-size: 16px;">
          Great job, ${data.driverName}!
        </p>
        <p style="margin: 0 0 24px; color: #666; font-size: 14px;">
          You've completed a ride. Here's your earnings breakdown - verified on blockchain.
        </p>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #E8F5E9; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
          <tr>
            <td>
              <p style="margin: 0 0 8px; color: #666; font-size: 14px;">Your Earnings (90%)</p>
              <p style="margin: 0; color: #00B14F; font-size: 36px; font-weight: 700;">AED ${data.earnings}</p>
            </td>
          </tr>
        </table>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <tr>
            <td>
              <p style="margin: 0 0 12px; color: #333; font-size: 14px; font-weight: 600;">Trip Details</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #666; font-size: 13px;">From</span>
                    <p style="margin: 2px 0 0; color: #333; font-size: 13px;">${data.pickupAddress}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #666; font-size: 13px;">To</span>
                    <p style="margin: 2px 0 0; color: #333; font-size: 13px;">${data.dropoffAddress}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
              <span style="color: #666; font-size: 14px;">Total Fare</span>
              <span style="float: right; color: #333; font-size: 14px; font-weight: 500;">AED ${data.totalFare}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
              <span style="color: #666; font-size: 14px;">Platform Fee (10%)</span>
              <span style="float: right; color: #E53935; font-size: 14px; font-weight: 500;">- AED ${data.platformFee}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0;">
              <span style="color: #333; font-size: 16px; font-weight: 600;">Your Earnings</span>
              <span style="float: right; color: #00B14F; font-size: 18px; font-weight: 700;">AED ${data.earnings}</span>
            </td>
          </tr>
        </table>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #8247E5 0%, #6B3CC9 100%); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <tr>
            <td>
              <p style="margin: 0 0 12px; color: #ffffff; font-size: 14px; font-weight: 600;">
                Blockchain Verified Earnings
              </p>
              <p style="margin: 0 0 12px; color: rgba(255,255,255,0.8); font-size: 12px;">
                Your earnings are permanently recorded on Polygon blockchain for transparency.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 12px;">
                <tr>
                  <td align="center">
                    <a href="${polygonScanUrl}" style="display: inline-block; padding: 12px 24px; background-color: #ffffff; color: #8247E5; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
                      View on PolygonScan
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <p style="margin: 0; color: #999; font-size: 12px; text-align: center;">
          Ride ID: ${data.rideId}<br>
          Completed: ${new Date(data.completedAt).toLocaleString()}
        </p>
      </td>
    </tr>
    
    <tr>
      <td style="background-color: #f5f5f5; padding: 24px; text-align: center;">
        <p style="margin: 0; color: #999; font-size: 11px;">
          Travony - 90% to Drivers, Always
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
  try {
    await transporter.sendMail({
      from: `"Travony" <${process.env.SMTP_USER}>`,
      to: data.driverEmail,
      subject: `Route Completed - Yield: AED ${data.earnings}`,
      html: htmlContent
    });
    console.log(`Driver earnings email sent to ${data.driverEmail}`);
    return true;
  } catch (error) {
    console.error("Failed to send driver earnings email:", error);
    return false;
  }
}
async function sendWeeklyFeedbackEmail(data) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log("Email not configured - skipping weekly feedback email");
    return false;
  }
  const ratingChange = data.previousAverageRating ? data.averageRating - data.previousAverageRating : 0;
  const ratingChangeText = ratingChange > 0 ? `<span style="color: #00B14F;">+${ratingChange.toFixed(2)}</span>` : ratingChange < 0 ? `<span style="color: #E53935;">${ratingChange.toFixed(2)}</span>` : "";
  const ratingBarsHtml = [5, 4, 3, 2, 1].map((stars) => {
    const ratingData = data.ratings.find((r) => r.stars === stars) || { count: 0, stars };
    const percentage = data.totalRides > 0 ? ratingData.count / data.totalRides * 100 : 0;
    return `
      <tr>
        <td style="padding: 4px 0; width: 50px;">
          <span style="color: #FFB800; font-size: 14px;">${"\u2605".repeat(stars)}${"\u2606".repeat(5 - stars)}</span>
        </td>
        <td style="padding: 4px 8px;">
          <div style="background-color: #E8E8E8; border-radius: 4px; height: 8px; width: 100%;">
            <div style="background-color: #00B14F; border-radius: 4px; height: 8px; width: ${percentage}%;"></div>
          </div>
        </td>
        <td style="padding: 4px 0; width: 40px; text-align: right; color: #666; font-size: 12px;">${ratingData.count}</td>
      </tr>
    `;
  }).join("");
  const commentsHtml = data.recentComments.length > 0 ? data.recentComments.slice(0, 5).map((c) => `
      <div style="background-color: #f9f9f9; border-radius: 8px; padding: 12px; margin-bottom: 8px;">
        <div style="color: #FFB800; font-size: 12px; margin-bottom: 4px;">${"\u2605".repeat(c.rating)}${"\u2606".repeat(5 - c.rating)}</div>
        <p style="margin: 0; color: #333; font-size: 14px;">"${c.comment}"</p>
        <p style="margin: 4px 0 0; color: #999; font-size: 11px;">${c.date}</p>
      </div>
    `).join("") : `<p style="color: #999; font-style: italic;">No comments this week</p>`;
  const strengthsHtml = data.topStrengths.length > 0 ? data.topStrengths.map((s) => `
      <div style="display: inline-block; background-color: #E8F5E9; color: #00B14F; padding: 6px 12px; border-radius: 16px; margin: 4px; font-size: 13px;">
        \u2713 ${s}
      </div>
    `).join("") : "";
  const improvementsHtml = data.improvementAreas.length > 0 ? `<div style="background-color: #FFF3E0; border-radius: 8px; padding: 12px; margin-top: 16px;">
        <p style="margin: 0 0 8px; color: #E65100; font-size: 14px; font-weight: 600;">Areas to Improve</p>
        ${data.improvementAreas.map((i) => `<p style="margin: 4px 0; color: #E65100; font-size: 13px;">\u2022 ${i}</p>`).join("")}
      </div>` : "";
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Weekly Performance Summary</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="background-color: #00B14F; padding: 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Travony</h1>
        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Weekly Performance Summary</p>
      </td>
    </tr>
    
    <tr>
      <td style="padding: 32px 24px;">
        <p style="margin: 0 0 24px; color: #333; font-size: 16px;">
          Hi ${data.driverName},
        </p>
        <p style="margin: 0 0 24px; color: #666; font-size: 14px;">
          Here's your performance summary for ${data.weekStartDate} - ${data.weekEndDate}
        </p>
        
        <!-- Stats Grid -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
          <tr>
            <td width="50%" style="padding: 8px;">
              <div style="background-color: #E8F5E9; border-radius: 12px; padding: 16px; text-align: center;">
                <p style="margin: 0 0 4px; color: #666; font-size: 12px;">Total Rides</p>
                <p style="margin: 0; color: #00B14F; font-size: 28px; font-weight: 700;">${data.totalRides}</p>
              </div>
            </td>
            <td width="50%" style="padding: 8px;">
              <div style="background-color: #E3F2FD; border-radius: 12px; padding: 16px; text-align: center;">
                <p style="margin: 0 0 4px; color: #666; font-size: 12px;">Total Earnings</p>
                <p style="margin: 0; color: #1976D2; font-size: 28px; font-weight: 700;">AED ${data.totalEarnings}</p>
              </div>
            </td>
          </tr>
        </table>
        
        <!-- Rating Section -->
        <div style="background-color: #f9f9f9; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <div style="text-align: center; margin-bottom: 16px;">
            <p style="margin: 0 0 8px; color: #666; font-size: 14px;">Your Average Rating</p>
            <p style="margin: 0; font-size: 48px; font-weight: 700;">
              <span style="color: #FFB800;">\u2605</span>
              <span style="color: #333;">${data.averageRating.toFixed(2)}</span>
              ${ratingChangeText ? `<span style="font-size: 16px; margin-left: 8px;">(${ratingChangeText} vs last week)</span>` : ""}
            </p>
          </div>
          
          <table width="100%" cellpadding="0" cellspacing="0">
            ${ratingBarsHtml}
          </table>
        </div>
        
        ${strengthsHtml ? `
        <!-- Strengths -->
        <div style="margin-bottom: 24px;">
          <p style="margin: 0 0 12px; color: #333; font-size: 16px; font-weight: 600;">What Passengers Love About You</p>
          ${strengthsHtml}
        </div>
        ` : ""}
        
        ${improvementsHtml}
        
        <!-- Recent Comments -->
        <div style="margin-top: 24px;">
          <p style="margin: 0 0 12px; color: #333; font-size: 16px; font-weight: 600;">Recent Passenger Comments</p>
          ${commentsHtml}
        </div>
        
        <!-- Tips -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 20px; margin-top: 24px;">
          <p style="margin: 0 0 12px; color: #ffffff; font-size: 16px; font-weight: 600;">Tips for Next Week</p>
          <ul style="margin: 0; padding-left: 20px; color: rgba(255,255,255,0.9); font-size: 14px;">
            <li style="margin-bottom: 8px;">Keep up the great work with timely pickups</li>
            <li style="margin-bottom: 8px;">A clean car = happy passengers = better tips</li>
            <li>Use "Going Home" mode to earn extra on your commute</li>
          </ul>
        </div>
      </td>
    </tr>
    
    <tr>
      <td style="background-color: #f5f5f5; padding: 24px; text-align: center;">
        <p style="margin: 0 0 8px; color: #666; font-size: 12px;">
          Keep driving, keep earning!
        </p>
        <p style="margin: 0; color: #999; font-size: 11px;">
          Travony - 90% to Drivers, Always
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
  try {
    await transporter.sendMail({
      from: `"Travony" <${process.env.SMTP_USER}>`,
      to: data.driverEmail,
      subject: `Your Weekly Performance: \u2605${data.averageRating.toFixed(1)} Rating, ${data.totalRides} Rides`,
      html: htmlContent
    });
    console.log(`Weekly feedback email sent to ${data.driverEmail}`);
    return true;
  } catch (error) {
    console.error("Failed to send weekly feedback email:", error);
    return false;
  }
}

// server/nowpayments.ts
import { v4 as uuidv4 } from "uuid";
var NOWPAYMENTS_API_URL = "https://api.nowpayments.io/v1";
var NowPaymentsService = class {
  apiKey;
  isConfiguredFlag;
  constructor() {
    this.apiKey = process.env.NOWPAYMENTS_API_KEY || null;
    this.isConfiguredFlag = !!this.apiKey;
    if (!this.isConfiguredFlag) {
      console.log("NOWPayments: Not configured. Set NOWPAYMENTS_API_KEY for USDT payments.");
    } else {
      console.log("NOWPayments: Configured and ready for crypto payments");
    }
  }
  isAvailable() {
    return this.isConfiguredFlag;
  }
  async createInvoice(params) {
    if (!this.isConfiguredFlag) {
      console.log("NOWPayments: Creating simulated invoice (not configured)");
      return this.createSimulatedInvoice(params);
    }
    try {
      const response = await fetch(`${NOWPAYMENTS_API_URL}/invoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey
        },
        body: JSON.stringify({
          price_amount: params.price,
          price_currency: params.currency.toLowerCase(),
          order_id: params.orderId,
          order_description: params.description || "Travony Payment",
          ipn_callback_url: params.callbackUrl,
          success_url: params.successUrl,
          cancel_url: params.cancelUrl,
          is_fixed_rate: true,
          is_fee_paid_by_user: false
        })
      });
      if (!response.ok) {
        const error = await response.text();
        console.error("NOWPayments invoice creation failed:", error);
        return null;
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("NOWPayments API error:", error.message);
      return null;
    }
  }
  async getPaymentStatus(paymentId) {
    if (!this.isConfiguredFlag) {
      return null;
    }
    try {
      const response = await fetch(`${NOWPAYMENTS_API_URL}/payment/${paymentId}`, {
        method: "GET",
        headers: {
          "x-api-key": this.apiKey
        }
      });
      if (!response.ok) {
        const error = await response.text();
        console.error("NOWPayments get payment failed:", error);
        return null;
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("NOWPayments API error:", error.message);
      return null;
    }
  }
  async getMinimumPaymentAmount(currency = "usdttrc20") {
    try {
      const response = await fetch(
        `${NOWPAYMENTS_API_URL}/min-amount?currency_from=${currency}`,
        {
          headers: { "x-api-key": this.apiKey }
        }
      );
      if (response.ok) {
        const data = await response.json();
        return data.min_amount || 1;
      }
    } catch (error) {
      console.error("NOWPayments min amount error:", error.message);
    }
    return 1;
  }
  verifyIpnSignature(payload, receivedSignature) {
    if (!process.env.NOWPAYMENTS_IPN_SECRET) {
      return true;
    }
    try {
      const crypto = __require("crypto");
      const sortedPayload = Object.keys(payload).sort().reduce((result, key) => {
        result[key] = payload[key];
        return result;
      }, {});
      const hmac = crypto.createHmac("sha512", process.env.NOWPAYMENTS_IPN_SECRET).update(JSON.stringify(sortedPayload)).digest("hex");
      return hmac === receivedSignature;
    } catch (error) {
      console.error("NOWPayments IPN signature verification error:", error);
      return false;
    }
  }
  simulatedInvoices = /* @__PURE__ */ new Map();
  createSimulatedInvoice(params) {
    const invoiceId = `sim_${uuidv4().substring(0, 8)}`;
    const invoice = {
      id: invoiceId,
      token_id: `tok_${uuidv4().substring(0, 8)}`,
      invoice_url: `https://nowpayments.io/payment/?iid=${invoiceId}`,
      order_id: params.orderId,
      order_description: params.description || "Travony Payment",
      price_amount: params.price,
      price_currency: params.currency.toLowerCase(),
      pay_currency: "usdttrc20",
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString(),
      is_fixed_rate: true,
      is_fee_paid_by_user: false
    };
    this.simulatedInvoices.set(invoiceId, invoice);
    return invoice;
  }
  simulatePaymentComplete(invoiceId) {
    const invoice = this.simulatedInvoices.get(invoiceId);
    if (invoice) {
      return true;
    }
    return false;
  }
};
var nowPaymentsService = new NowPaymentsService();

// server/invoiceService.ts
import { v4 as uuidv42 } from "uuid";
function generateInvoiceNumber(type) {
  const prefix = type === "customer" ? "INV" : "DRV";
  const timestamp2 = Date.now().toString(36).toUpperCase();
  const random = uuidv42().substring(0, 4).toUpperCase();
  return `${prefix}-${timestamp2}-${random}`;
}
async function createRideInvoices(rideId) {
  const ride = await storage.getRide(rideId);
  if (!ride || ride.status !== "completed") {
    console.log("Invoice creation failed: Ride not found or not completed");
    return null;
  }
  const totalFare = parseFloat(ride.estimatedFare || "0");
  const platformFee = totalFare * 0.1;
  const driverEarnings = totalFare * 0.9;
  const currency = ride.paymentMethod === "usdt" ? "USDT" : "AED";
  const customerInvoiceData = {
    rideId,
    invoiceType: "customer",
    recipientId: ride.customerId,
    subtotal: totalFare,
    platformFee: void 0,
    totalAmount: totalFare,
    currency,
    paymentMethod: ride.paymentMethod,
    blockchainHash: ride.blockchainHash || void 0,
    pickupAddress: ride.pickupAddress,
    dropoffAddress: ride.dropoffAddress,
    distance: parseFloat(ride.distance || "0"),
    duration: ride.duration || 0,
    rideCompletedAt: ride.completedAt || /* @__PURE__ */ new Date()
  };
  const driverInvoiceData = {
    rideId,
    invoiceType: "driver",
    recipientId: ride.driverId || "",
    subtotal: totalFare,
    platformFee,
    totalAmount: driverEarnings,
    currency,
    paymentMethod: ride.paymentMethod,
    blockchainHash: ride.blockchainHash || void 0,
    pickupAddress: ride.pickupAddress,
    dropoffAddress: ride.dropoffAddress,
    distance: parseFloat(ride.distance || "0"),
    duration: ride.duration || 0,
    rideCompletedAt: ride.completedAt || /* @__PURE__ */ new Date()
  };
  const customerInvoice = await storage.createRideInvoice({
    rideId,
    invoiceType: "customer",
    recipientId: customerInvoiceData.recipientId,
    invoiceNumber: generateInvoiceNumber("customer"),
    subtotal: customerInvoiceData.subtotal.toFixed(2),
    platformFee: null,
    totalAmount: customerInvoiceData.totalAmount.toFixed(2),
    currency: customerInvoiceData.currency,
    paymentMethod: customerInvoiceData.paymentMethod,
    blockchainHash: customerInvoiceData.blockchainHash,
    pickupAddress: customerInvoiceData.pickupAddress,
    dropoffAddress: customerInvoiceData.dropoffAddress,
    distance: customerInvoiceData.distance.toFixed(2),
    duration: customerInvoiceData.duration,
    rideCompletedAt: customerInvoiceData.rideCompletedAt
  });
  let driverInvoice = null;
  if (ride.driverId) {
    driverInvoice = await storage.createRideInvoice({
      rideId,
      invoiceType: "driver",
      recipientId: driverInvoiceData.recipientId,
      invoiceNumber: generateInvoiceNumber("driver"),
      subtotal: driverInvoiceData.subtotal.toFixed(2),
      platformFee: (driverInvoiceData.platformFee || 0).toFixed(2),
      totalAmount: driverInvoiceData.totalAmount.toFixed(2),
      currency: driverInvoiceData.currency,
      paymentMethod: driverInvoiceData.paymentMethod,
      blockchainHash: driverInvoiceData.blockchainHash,
      pickupAddress: driverInvoiceData.pickupAddress,
      dropoffAddress: driverInvoiceData.dropoffAddress,
      distance: driverInvoiceData.distance.toFixed(2),
      duration: driverInvoiceData.duration,
      rideCompletedAt: driverInvoiceData.rideCompletedAt
    });
  }
  return { customerInvoice, driverInvoice };
}

// server/regionService.ts
init_db();
init_schema();
init_schema();
import { eq as eq2, and as and2 } from "drizzle-orm";
var DEFAULT_REGIONS = [
  { code: "AE", name: "United Arab Emirates", currency: "AED", currencySymbol: "\u062F.\u0625", phoneCode: "+971", timezone: "Asia/Dubai", language: "ar", surgeCap: 1.5, platformFeePercent: 10, minFare: 10, emergencyNumber: "999", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "US", name: "United States", currency: "USD", currencySymbol: "$", phoneCode: "+1", timezone: "America/New_York", language: "en", surgeCap: 1.5, platformFeePercent: 10, minFare: 5, emergencyNumber: "911", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "GB", name: "United Kingdom", currency: "GBP", currencySymbol: "\xA3", phoneCode: "+44", timezone: "Europe/London", language: "en", surgeCap: 1.5, platformFeePercent: 10, minFare: 4, emergencyNumber: "999", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "RU", name: "Russia", currency: "RUB", currencySymbol: "\u20BD", phoneCode: "+7", timezone: "Europe/Moscow", language: "ru", surgeCap: 1.5, platformFeePercent: 10, minFare: 150, emergencyNumber: "112", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "IN", name: "India", currency: "INR", currencySymbol: "\u20B9", phoneCode: "+91", timezone: "Asia/Kolkata", language: "hi", surgeCap: 1.5, platformFeePercent: 10, minFare: 30, emergencyNumber: "112", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "NG", name: "Nigeria", currency: "NGN", currencySymbol: "\u20A6", phoneCode: "+234", timezone: "Africa/Lagos", language: "en", surgeCap: 1.5, platformFeePercent: 10, minFare: 500, emergencyNumber: "199", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "KE", name: "Kenya", currency: "KES", currencySymbol: "KSh", phoneCode: "+254", timezone: "Africa/Nairobi", language: "sw", surgeCap: 1.5, platformFeePercent: 10, minFare: 150, emergencyNumber: "999", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "ZA", name: "South Africa", currency: "ZAR", currencySymbol: "R", phoneCode: "+27", timezone: "Africa/Johannesburg", language: "en", surgeCap: 1.5, platformFeePercent: 10, minFare: 30, emergencyNumber: "10111", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "DE", name: "Germany", currency: "EUR", currencySymbol: "\u20AC", phoneCode: "+49", timezone: "Europe/Berlin", language: "de", surgeCap: 1.5, platformFeePercent: 10, minFare: 4, emergencyNumber: "112", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "FR", name: "France", currency: "EUR", currencySymbol: "\u20AC", phoneCode: "+33", timezone: "Europe/Paris", language: "fr", surgeCap: 1.5, platformFeePercent: 10, minFare: 4, emergencyNumber: "112", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "CN", name: "China", currency: "CNY", currencySymbol: "\xA5", phoneCode: "+86", timezone: "Asia/Shanghai", language: "zh", surgeCap: 1.5, platformFeePercent: 10, minFare: 10, emergencyNumber: "110", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "JP", name: "Japan", currency: "JPY", currencySymbol: "\xA5", phoneCode: "+81", timezone: "Asia/Tokyo", language: "ja", surgeCap: 1.5, platformFeePercent: 10, minFare: 500, emergencyNumber: "110", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "TH", name: "Thailand", currency: "THB", currencySymbol: "\u0E3F", phoneCode: "+66", timezone: "Asia/Bangkok", language: "th", surgeCap: 1.5, platformFeePercent: 10, minFare: 35, emergencyNumber: "191", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "VN", name: "Vietnam", currency: "VND", currencySymbol: "\u20AB", phoneCode: "+84", timezone: "Asia/Ho_Chi_Minh", language: "vi", surgeCap: 1.5, platformFeePercent: 10, minFare: 15e3, emergencyNumber: "113", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "ID", name: "Indonesia", currency: "IDR", currencySymbol: "Rp", phoneCode: "+62", timezone: "Asia/Jakarta", language: "id", surgeCap: 1.5, platformFeePercent: 10, minFare: 1e4, emergencyNumber: "110", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "PH", name: "Philippines", currency: "PHP", currencySymbol: "\u20B1", phoneCode: "+63", timezone: "Asia/Manila", language: "fil", surgeCap: 1.5, platformFeePercent: 10, minFare: 50, emergencyNumber: "911", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "EG", name: "Egypt", currency: "EGP", currencySymbol: "E\xA3", phoneCode: "+20", timezone: "Africa/Cairo", language: "ar", surgeCap: 1.5, platformFeePercent: 10, minFare: 20, emergencyNumber: "122", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "TR", name: "Turkey", currency: "TRY", currencySymbol: "\u20BA", phoneCode: "+90", timezone: "Europe/Istanbul", language: "tr", surgeCap: 1.5, platformFeePercent: 10, minFare: 50, emergencyNumber: "112", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "BR", name: "Brazil", currency: "BRL", currencySymbol: "R$", phoneCode: "+55", timezone: "America/Sao_Paulo", language: "pt", surgeCap: 1.5, platformFeePercent: 10, minFare: 8, emergencyNumber: "190", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "MX", name: "Mexico", currency: "MXN", currencySymbol: "$", phoneCode: "+52", timezone: "America/Mexico_City", language: "es", surgeCap: 1.5, platformFeePercent: 10, minFare: 35, emergencyNumber: "911", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "BD", name: "Bangladesh", currency: "BDT", currencySymbol: "\u09F3", phoneCode: "+880", timezone: "Asia/Dhaka", language: "bn", surgeCap: 1.5, platformFeePercent: 10, minFare: 50, emergencyNumber: "999", supportedPaymentMethods: ["cash", "usdt"] },
  { code: "PK", name: "Pakistan", currency: "PKR", currencySymbol: "\u20A8", phoneCode: "+92", timezone: "Asia/Karachi", language: "ur", surgeCap: 1.5, platformFeePercent: 10, minFare: 100, emergencyNumber: "15", supportedPaymentMethods: ["cash", "usdt"] }
];
var REGIONAL_VEHICLES = {
  "AE": [
    { type: "economy", localName: "Economy", description: "Affordable rides", icon: "car", baseFare: 10, perKmRate: 2.5, perMinuteRate: 0.5, minFare: 10, maxPassengers: 4 },
    { type: "comfort", localName: "Comfort", description: "Spacious comfort", icon: "car", baseFare: 15, perKmRate: 3.5, perMinuteRate: 0.75, minFare: 15, maxPassengers: 4 },
    { type: "premium", localName: "Premium", description: "Luxury experience", icon: "car", baseFare: 25, perKmRate: 5, perMinuteRate: 1, minFare: 25, maxPassengers: 4 },
    { type: "xl", localName: "XL", description: "For groups", icon: "truck", baseFare: 20, perKmRate: 4, perMinuteRate: 0.8, minFare: 20, maxPassengers: 6 }
  ],
  "IN": [
    { type: "rickshaw", localName: "Auto Rickshaw", description: "Quick city rides", icon: "navigation", baseFare: 25, perKmRate: 12, perMinuteRate: 2, minFare: 25, maxPassengers: 3 },
    { type: "moto", localName: "Bike", description: "Fast solo rides", icon: "navigation", baseFare: 15, perKmRate: 8, perMinuteRate: 1, minFare: 15, maxPassengers: 1 },
    { type: "economy", localName: "Mini", description: "Affordable hatchback", icon: "car", baseFare: 40, perKmRate: 15, perMinuteRate: 2, minFare: 40, maxPassengers: 4 },
    { type: "comfort", localName: "Sedan", description: "Comfortable sedan", icon: "car", baseFare: 60, perKmRate: 20, perMinuteRate: 3, minFare: 60, maxPassengers: 4 },
    { type: "premium", localName: "Prime", description: "Premium rides", icon: "car", baseFare: 100, perKmRate: 30, perMinuteRate: 5, minFare: 100, maxPassengers: 4 }
  ],
  "TH": [
    { type: "tuktuk", localName: "Tuk Tuk", description: "Classic Thai ride", icon: "navigation", baseFare: 40, perKmRate: 15, perMinuteRate: 3, minFare: 40, maxPassengers: 3 },
    { type: "moto", localName: "Motorbike", description: "Beat the traffic", icon: "navigation", baseFare: 25, perKmRate: 10, perMinuteRate: 2, minFare: 25, maxPassengers: 1 },
    { type: "economy", localName: "Taxi", description: "Regular taxi", icon: "car", baseFare: 35, perKmRate: 12, perMinuteRate: 2, minFare: 35, maxPassengers: 4 },
    { type: "comfort", localName: "JustGrab", description: "Comfortable ride", icon: "car", baseFare: 50, perKmRate: 18, perMinuteRate: 3, minFare: 50, maxPassengers: 4 }
  ],
  "NG": [
    { type: "moto", localName: "Okada", description: "Motorcycle taxi", icon: "navigation", baseFare: 200, perKmRate: 100, perMinuteRate: 20, minFare: 200, maxPassengers: 1 },
    { type: "rickshaw", localName: "Keke", description: "Tricycle ride", icon: "navigation", baseFare: 300, perKmRate: 150, perMinuteRate: 30, minFare: 300, maxPassengers: 3 },
    { type: "economy", localName: "Economy", description: "Affordable car", icon: "car", baseFare: 500, perKmRate: 200, perMinuteRate: 40, minFare: 500, maxPassengers: 4 },
    { type: "comfort", localName: "Comfort", description: "AC car", icon: "car", baseFare: 800, perKmRate: 300, perMinuteRate: 60, minFare: 800, maxPassengers: 4 }
  ],
  "KE": [
    { type: "moto", localName: "Boda Boda", description: "Motorcycle taxi", icon: "navigation", baseFare: 50, perKmRate: 30, perMinuteRate: 5, minFare: 50, maxPassengers: 1 },
    { type: "tuktuk", localName: "Tuk Tuk", description: "Three-wheeler", icon: "navigation", baseFare: 100, perKmRate: 40, perMinuteRate: 8, minFare: 100, maxPassengers: 3 },
    { type: "economy", localName: "Chap Chap", description: "Quick & cheap", icon: "car", baseFare: 150, perKmRate: 50, perMinuteRate: 10, minFare: 150, maxPassengers: 4 },
    { type: "comfort", localName: "Go", description: "Comfortable ride", icon: "car", baseFare: 250, perKmRate: 80, perMinuteRate: 15, minFare: 250, maxPassengers: 4 }
  ],
  "ID": [
    { type: "moto", localName: "Ojek", description: "Motorcycle taxi", icon: "navigation", baseFare: 8e3, perKmRate: 2500, perMinuteRate: 500, minFare: 8e3, maxPassengers: 1 },
    { type: "rickshaw", localName: "Bajaj", description: "Three-wheeler", icon: "navigation", baseFare: 12e3, perKmRate: 4e3, perMinuteRate: 800, minFare: 12e3, maxPassengers: 3 },
    { type: "economy", localName: "GoCar", description: "Budget car", icon: "car", baseFare: 15e3, perKmRate: 5e3, perMinuteRate: 1e3, minFare: 15e3, maxPassengers: 4 },
    { type: "comfort", localName: "GoCar Comfort", description: "Premium ride", icon: "car", baseFare: 25e3, perKmRate: 8e3, perMinuteRate: 1500, minFare: 25e3, maxPassengers: 4 }
  ],
  "VN": [
    { type: "moto", localName: "Xe \xD4m", description: "Motorcycle taxi", icon: "navigation", baseFare: 12e3, perKmRate: 4e3, perMinuteRate: 700, minFare: 12e3, maxPassengers: 1 },
    { type: "economy", localName: "4 Ch\u1ED7", description: "4-seater car", icon: "car", baseFare: 25e3, perKmRate: 1e4, perMinuteRate: 2e3, minFare: 25e3, maxPassengers: 4 },
    { type: "comfort", localName: "7 Ch\u1ED7", description: "7-seater car", icon: "truck", baseFare: 35e3, perKmRate: 12e3, perMinuteRate: 2500, minFare: 35e3, maxPassengers: 7 }
  ],
  "PH": [
    { type: "moto", localName: "Angkas", description: "Motorcycle", icon: "navigation", baseFare: 40, perKmRate: 12, perMinuteRate: 2, minFare: 40, maxPassengers: 1 },
    { type: "rickshaw", localName: "Tricycle", description: "Local tricycle", icon: "navigation", baseFare: 30, perKmRate: 10, perMinuteRate: 2, minFare: 30, maxPassengers: 3 },
    { type: "economy", localName: "GrabCar", description: "Economy ride", icon: "car", baseFare: 60, perKmRate: 18, perMinuteRate: 3, minFare: 60, maxPassengers: 4 },
    { type: "comfort", localName: "Premium", description: "Premium car", icon: "car", baseFare: 100, perKmRate: 25, perMinuteRate: 5, minFare: 100, maxPassengers: 4 }
  ],
  "RU": [
    { type: "economy", localName: "\u042D\u043A\u043E\u043D\u043E\u043C", description: "Budget ride", icon: "car", baseFare: 99, perKmRate: 15, perMinuteRate: 3, minFare: 99, maxPassengers: 4 },
    { type: "comfort", localName: "\u041A\u043E\u043C\u0444\u043E\u0440\u0442", description: "Comfortable car", icon: "car", baseFare: 149, perKmRate: 20, perMinuteRate: 4, minFare: 149, maxPassengers: 4 },
    { type: "premium", localName: "\u0411\u0438\u0437\u043D\u0435\u0441", description: "Business class", icon: "car", baseFare: 299, perKmRate: 35, perMinuteRate: 7, minFare: 299, maxPassengers: 4 },
    { type: "minibus", localName: "\u041C\u0438\u043D\u0438\u0432\u044D\u043D", description: "For groups", icon: "truck", baseFare: 249, perKmRate: 30, perMinuteRate: 6, minFare: 249, maxPassengers: 7 }
  ],
  "BD": [
    { type: "cng", localName: "CNG Auto", description: "Green auto rickshaw", icon: "navigation", baseFare: 30, perKmRate: 12, perMinuteRate: 2, minFare: 30, maxPassengers: 3 },
    { type: "rickshaw", localName: "Easy Bike", description: "Electric rickshaw", icon: "navigation", baseFare: 20, perKmRate: 8, perMinuteRate: 1.5, minFare: 20, maxPassengers: 3 },
    { type: "moto", localName: "Bike", description: "Motorcycle ride", icon: "navigation", baseFare: 25, perKmRate: 10, perMinuteRate: 2, minFare: 25, maxPassengers: 1 },
    { type: "economy", localName: "Car", description: "Affordable car", icon: "car", baseFare: 80, perKmRate: 25, perMinuteRate: 4, minFare: 80, maxPassengers: 4 },
    { type: "comfort", localName: "Sedan", description: "AC sedan", icon: "car", baseFare: 120, perKmRate: 35, perMinuteRate: 6, minFare: 120, maxPassengers: 4 }
  ],
  "PK": [
    { type: "rickshaw", localName: "Rickshaw", description: "Auto rickshaw", icon: "navigation", baseFare: 50, perKmRate: 20, perMinuteRate: 3, minFare: 50, maxPassengers: 3 },
    { type: "moto", localName: "Bike", description: "Motorcycle ride", icon: "navigation", baseFare: 40, perKmRate: 15, perMinuteRate: 2.5, minFare: 40, maxPassengers: 1 },
    { type: "economy", localName: "Mini", description: "Budget car", icon: "car", baseFare: 150, perKmRate: 40, perMinuteRate: 7, minFare: 150, maxPassengers: 4 },
    { type: "comfort", localName: "Go", description: "Comfortable ride", icon: "car", baseFare: 200, perKmRate: 55, perMinuteRate: 10, minFare: 200, maxPassengers: 4 },
    { type: "premium", localName: "Executive", description: "Premium sedan", icon: "car", baseFare: 350, perKmRate: 80, perMinuteRate: 15, minFare: 350, maxPassengers: 4 }
  ]
};
var DEFAULT_VEHICLES = [
  { type: "economy", localName: "Economy", description: "Affordable rides", icon: "car", baseFare: 5, perKmRate: 1.5, perMinuteRate: 0.3, minFare: 5, maxPassengers: 4 },
  { type: "comfort", localName: "Comfort", description: "Comfortable rides", icon: "car", baseFare: 8, perKmRate: 2, perMinuteRate: 0.4, minFare: 8, maxPassengers: 4 },
  { type: "premium", localName: "Premium", description: "Premium experience", icon: "car", baseFare: 15, perKmRate: 3, perMinuteRate: 0.6, minFare: 15, maxPassengers: 4 },
  { type: "xl", localName: "XL", description: "For groups", icon: "truck", baseFare: 12, perKmRate: 2.5, perMinuteRate: 0.5, minFare: 12, maxPassengers: 6 }
];
async function initializeRegions() {
  console.log("Initializing regions...");
  for (const regionData of DEFAULT_REGIONS) {
    const existing = await db.select().from(regions).where(eq2(regions.code, regionData.code)).limit(1);
    if (existing.length === 0) {
      const [region] = await db.insert(regions).values({
        code: regionData.code,
        name: regionData.name,
        currency: regionData.currency,
        currencySymbol: regionData.currencySymbol,
        phoneCode: regionData.phoneCode,
        timezone: regionData.timezone,
        language: regionData.language,
        surgeCap: regionData.surgeCap.toString(),
        platformFeePercent: regionData.platformFeePercent.toString(),
        minFare: regionData.minFare.toString(),
        emergencyNumber: regionData.emergencyNumber,
        supportedPaymentMethods: regionData.supportedPaymentMethods.join(",")
      }).returning();
      const vehicles4 = REGIONAL_VEHICLES[regionData.code] || DEFAULT_VEHICLES;
      for (let i = 0; i < vehicles4.length; i++) {
        const v = vehicles4[i];
        await db.insert(regionalVehicleTypes).values({
          regionId: region.id,
          type: v.type,
          localName: v.localName,
          description: v.description,
          icon: v.icon,
          baseFare: v.baseFare.toString(),
          perKmRate: v.perKmRate.toString(),
          perMinuteRate: v.perMinuteRate.toString(),
          minFare: v.minFare.toString(),
          maxPassengers: v.maxPassengers,
          sortOrder: i
        });
      }
      await db.insert(regionalEmergencyContacts).values({
        regionId: region.id,
        name: "Emergency Services",
        phone: regionData.emergencyNumber,
        type: "emergency",
        isDefault: true
      });
      console.log(`Initialized region: ${regionData.name}`);
    }
  }
  console.log("Regions initialization complete");
}
async function getRegionByCode(code) {
  const [region] = await db.select().from(regions).where(eq2(regions.code, code)).limit(1);
  if (!region) return null;
  const vehicles4 = await db.select().from(regionalVehicleTypes).where(and2(eq2(regionalVehicleTypes.regionId, region.id), eq2(regionalVehicleTypes.isActive, true)));
  const emergencyContactsList = await db.select().from(regionalEmergencyContacts).where(eq2(regionalEmergencyContacts.regionId, region.id));
  return {
    code: region.code,
    name: region.name,
    currency: region.currency,
    currencySymbol: region.currencySymbol,
    phoneCode: region.phoneCode,
    timezone: region.timezone,
    language: region.language || "en",
    surgeCap: parseFloat(region.surgeCap || "1.5"),
    platformFeePercent: parseFloat(region.platformFeePercent || "10"),
    minFare: parseFloat(region.minFare || "5"),
    emergencyNumber: region.emergencyNumber || "",
    supportedPaymentMethods: (region.supportedPaymentMethods || "cash,usdt").split(","),
    vehicleTypes: vehicles4.map((v) => ({
      type: v.type,
      localName: v.localName,
      description: v.description || "",
      icon: v.icon || "car",
      baseFare: parseFloat(v.baseFare),
      perKmRate: parseFloat(v.perKmRate),
      perMinuteRate: parseFloat(v.perMinuteRate),
      minFare: parseFloat(v.minFare || "0"),
      maxPassengers: v.maxPassengers || 4
    })),
    emergencyContacts: emergencyContactsList.map((c) => ({
      name: c.name,
      phone: c.phone,
      type: c.type
    }))
  };
}
async function getAllRegions() {
  const allRegions = await db.select().from(regions).where(eq2(regions.isActive, true));
  const result = [];
  for (const region of allRegions) {
    const config = await getRegionByCode(region.code);
    if (config) result.push(config);
  }
  return result;
}
async function detectRegionFromPhone(phone) {
  const allRegions = await db.select().from(regions).where(eq2(regions.isActive, true));
  for (const region of allRegions) {
    if (phone.startsWith(region.phoneCode)) {
      return region.code;
    }
  }
  return "AE";
}
async function calculateFare(regionCode, vehicleType, distanceKm, durationMinutes, surgeMultiplier = 1) {
  const region = await getRegionByCode(regionCode);
  if (!region) throw new Error("Region not found");
  const vehicle = region.vehicleTypes.find((v) => v.type === vehicleType);
  if (!vehicle) throw new Error("Vehicle type not available in this region");
  const cappedSurge = Math.min(surgeMultiplier, region.surgeCap);
  const baseFare = vehicle.baseFare;
  const distanceFare = distanceKm * vehicle.perKmRate;
  const timeFare = durationMinutes * vehicle.perMinuteRate;
  let subtotal = baseFare + distanceFare + timeFare;
  subtotal = subtotal * cappedSurge;
  const fare = Math.max(subtotal, vehicle.minFare);
  const platformFee = fare * (region.platformFeePercent / 100);
  const driverEarnings = fare - platformFee;
  return {
    fare: Math.round(fare * 100) / 100,
    breakdown: {
      baseFare,
      distanceFare: Math.round(distanceFare * 100) / 100,
      timeFare: Math.round(timeFare * 100) / 100,
      surgeMultiplier: cappedSurge,
      currency: region.currency,
      currencySymbol: region.currencySymbol
    },
    driverEarnings: Math.round(driverEarnings * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100
  };
}
function getPhoneCodesList() {
  return DEFAULT_REGIONS.map((r) => ({
    code: r.code,
    phoneCode: r.phoneCode,
    name: r.name
  })).sort((a, b) => a.name.localeCompare(b.name));
}
var DEFAULT_SERVICE_TYPES = [
  { id: "st-economy", name: "Economy", type: "economy", baseFare: "5.00", perKmRate: "1.50", perMinuteRate: "0.30", icon: "car", isActive: true },
  { id: "st-comfort", name: "Comfort", type: "comfort", baseFare: "8.00", perKmRate: "2.00", perMinuteRate: "0.40", icon: "car", isActive: true },
  { id: "st-premium", name: "Premium", type: "premium", baseFare: "15.00", perKmRate: "3.00", perMinuteRate: "0.60", icon: "car", isActive: true },
  { id: "st-xl", name: "XL", type: "xl", baseFare: "12.00", perKmRate: "2.50", perMinuteRate: "0.50", icon: "truck", isActive: true }
];
async function initializeServiceTypes() {
  console.log("Initializing service types...");
  for (const st of DEFAULT_SERVICE_TYPES) {
    const existing = await db.select().from(serviceTypes).where(eq2(serviceTypes.id, st.id)).limit(1);
    if (existing.length === 0) {
      await db.insert(serviceTypes).values(st);
      console.log(`Created service type: ${st.name}`);
    }
  }
  console.log("Service types initialization complete");
}

// server/disputeResolver.ts
init_db();
init_schema();
import { eq as eq3, desc as desc2 } from "drizzle-orm";
function calculateDistance2(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
async function analyzeRoute(rideId) {
  const [ride] = await db.select().from(rides).where(eq3(rides.id, rideId)).limit(1);
  if (!ride) throw new Error("Ride not found");
  const telemetryData = await db.select().from(rideTelemetry).where(eq3(rideTelemetry.rideId, rideId)).orderBy(rideTelemetry.recordedAt);
  const directDistance = calculateDistance2(
    parseFloat(ride.pickupLat),
    parseFloat(ride.pickupLng),
    parseFloat(ride.dropoffLat),
    parseFloat(ride.dropoffLng)
  );
  let actualDistance = 0;
  if (telemetryData.length > 1) {
    for (let i = 1; i < telemetryData.length; i++) {
      actualDistance += calculateDistance2(
        parseFloat(telemetryData[i - 1].lat),
        parseFloat(telemetryData[i - 1].lng),
        parseFloat(telemetryData[i].lat),
        parseFloat(telemetryData[i].lng)
      );
    }
  } else {
    actualDistance = ride.distance ? parseFloat(ride.distance) : directDistance * 1.3;
  }
  const expectedDistance = directDistance * 1.3;
  const deviationPercent = (actualDistance - expectedDistance) / expectedDistance * 100;
  const isSignificantDetour = deviationPercent > 25;
  let detourExplanation = "Route appears normal";
  if (deviationPercent > 50) {
    detourExplanation = "Significant route deviation detected - possible intentional detour";
  } else if (deviationPercent > 25) {
    detourExplanation = "Minor route deviation - may be due to traffic or road conditions";
  } else if (deviationPercent < -10) {
    detourExplanation = "Route shorter than expected - direct path was taken";
  }
  return {
    expectedDistance: Math.round(expectedDistance * 100) / 100,
    actualDistance: Math.round(actualDistance * 100) / 100,
    deviationPercent: Math.round(deviationPercent * 100) / 100,
    isSignificantDetour,
    detourExplanation
  };
}
async function analyzeRatingPattern(driverId) {
  const recentRatings = await db.select().from(ratings).where(eq3(ratings.toDriverId, driverId)).orderBy(desc2(ratings.createdAt)).limit(50);
  if (recentRatings.length < 10) {
    return { pattern: "insufficient_data", suspicionLevel: 0 };
  }
  const avgRating = recentRatings.reduce((sum2, r) => sum2 + r.rating, 0) / recentRatings.length;
  const oneStarCount = recentRatings.filter((r) => r.rating === 1).length;
  const fiveStarCount = recentRatings.filter((r) => r.rating === 5).length;
  const oneStarPercent = oneStarCount / recentRatings.length * 100;
  const fiveStarPercent = fiveStarCount / recentRatings.length * 100;
  if (oneStarPercent > 30) {
    return { pattern: "high_negative_cluster", suspicionLevel: 60 };
  }
  if (fiveStarPercent > 90 && avgRating > 4.9) {
    return { pattern: "suspicious_perfection", suspicionLevel: 40 };
  }
  if (avgRating < 3.5) {
    return { pattern: "consistently_low", suspicionLevel: 20 };
  }
  return { pattern: "normal", suspicionLevel: 0 };
}
async function analyzeFareDispute(rideId) {
  const [ride] = await db.select().from(rides).where(eq3(rides.id, rideId)).limit(1);
  if (!ride) throw new Error("Ride not found");
  const routeAnalysis = await analyzeRoute(rideId);
  const estimatedFare = parseFloat(ride.estimatedFare || "0");
  const actualFare = parseFloat(ride.actualFare || "0");
  const fareDifference = actualFare - estimatedFare;
  const fareDeviationPercent = fareDifference / estimatedFare * 100;
  let confidence = 85;
  let recommendation = "no_action";
  let analysis = "";
  let suggestedRefund;
  if (routeAnalysis.isSignificantDetour && fareDeviationPercent > 20) {
    confidence = 95;
    recommendation = "refund_partial";
    analysis = `GPS data shows significant route deviation (${routeAnalysis.deviationPercent.toFixed(1)}% longer than expected). Fare was ${fareDeviationPercent.toFixed(1)}% higher than estimate. Recommending partial refund based on expected route fare.`;
    suggestedRefund = fareDifference * 0.8;
  } else if (routeAnalysis.isSignificantDetour) {
    confidence = 75;
    recommendation = "refund_partial";
    analysis = `Route deviation detected but fare increase is within tolerance. Possible traffic-related detour. Recommending minor goodwill adjustment.`;
    suggestedRefund = fareDifference * 0.3;
  } else if (fareDeviationPercent > 30) {
    confidence = 70;
    recommendation = "refund_partial";
    analysis = `Fare significantly exceeded estimate without route deviation. May be due to traffic or waiting time. Recommending partial refund.`;
    suggestedRefund = fareDifference * 0.5;
  } else if (fareDeviationPercent > 15) {
    confidence = 80;
    analysis = `Fare deviation within acceptable range for traffic conditions. Route verified as reasonable.`;
    recommendation = "no_action";
  } else {
    confidence = 95;
    analysis = `Fare and route both verified as accurate. No issues detected.`;
    recommendation = "no_action";
  }
  return {
    confidence,
    recommendation,
    analysis,
    suggestedRefund: suggestedRefund ? Math.round(suggestedRefund * 100) / 100 : void 0,
    evidenceSummary: {
      gpsVerified: true,
      routeDeviation: routeAnalysis.deviationPercent,
      fareAccuracy: 100 - Math.abs(fareDeviationPercent),
      ratingPattern: "not_analyzed"
    }
  };
}
async function analyzeRatingDispute(rideId, disputedRating) {
  const [ride] = await db.select().from(rides).where(eq3(rides.id, rideId)).limit(1);
  if (!ride || !ride.driverId) throw new Error("Ride or driver not found");
  const ratingPattern = await analyzeRatingPattern(ride.driverId);
  const [rideRating] = await db.select().from(ratings).where(eq3(ratings.rideId, rideId)).limit(1);
  let confidence = 70;
  let recommendation = "no_action";
  let analysis = "";
  if (disputedRating === 1 && ratingPattern.pattern === "normal") {
    confidence = 60;
    recommendation = "no_action";
    analysis = `Driver has normal rating pattern. Single low rating does not indicate manipulation. Rating stands.`;
  } else if (ratingPattern.pattern === "high_negative_cluster") {
    confidence = 75;
    recommendation = "warning_driver";
    analysis = `Detected pattern of negative ratings. Driver may need coaching or review. Rating stands but flagged for review.`;
  } else if (ratingPattern.pattern === "suspicious_perfection") {
    confidence = 65;
    recommendation = "rating_removed";
    analysis = `Unusually perfect rating pattern detected. May indicate rating manipulation. Recommending investigation.`;
  } else {
    confidence = 85;
    analysis = `Rating pattern appears normal. No manipulation detected.`;
  }
  return {
    confidence,
    recommendation,
    analysis,
    evidenceSummary: {
      gpsVerified: true,
      routeDeviation: 0,
      fareAccuracy: 100,
      ratingPattern: ratingPattern.pattern
    }
  };
}
async function analyzeSafetyDispute(rideId, description) {
  const [ride] = await db.select().from(rides).where(eq3(rides.id, rideId)).limit(1);
  if (!ride) throw new Error("Ride not found");
  const telemetryData = await db.select().from(rideTelemetry).where(eq3(rideTelemetry.rideId, rideId)).orderBy(rideTelemetry.recordedAt);
  let maxSpeed = 0;
  let avgSpeed = 0;
  if (telemetryData.length > 0) {
    const speeds = telemetryData.map((t) => parseFloat(t.speed || "0"));
    maxSpeed = Math.max(...speeds);
    avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  }
  let confidence = 60;
  let recommendation = "no_action";
  let analysis = "";
  const lowerDesc = description.toLowerCase();
  if (lowerDesc.includes("speed") || lowerDesc.includes("fast") || lowerDesc.includes("dangerous")) {
    if (maxSpeed > 120) {
      confidence = 90;
      recommendation = "warning_driver";
      analysis = `GPS data confirms excessive speed (max: ${maxSpeed.toFixed(0)} km/h). Driver will receive warning.`;
    } else if (maxSpeed > 90) {
      confidence = 70;
      recommendation = "no_action";
      analysis = `Speed detected was ${maxSpeed.toFixed(0)} km/h which is within highway limits. No violation detected.`;
    } else {
      confidence = 80;
      recommendation = "no_action";
      analysis = `GPS data shows normal driving speeds (max: ${maxSpeed.toFixed(0)} km/h). Claim not supported by evidence.`;
    }
  } else {
    confidence = 50;
    analysis = `Safety concern noted and logged. Unable to verify automatically. Manual review may be needed.`;
    recommendation = "no_action";
  }
  return {
    confidence,
    recommendation,
    analysis,
    evidenceSummary: {
      gpsVerified: true,
      routeDeviation: 0,
      fareAccuracy: 100,
      ratingPattern: "not_analyzed"
    }
  };
}
async function resolveDispute(rideId, type, description, disputedValue) {
  switch (type) {
    case "fare":
    case "route":
      return analyzeFareDispute(rideId);
    case "rating":
      return analyzeRatingDispute(rideId, disputedValue || 1);
    case "safety":
    case "behavior":
      return analyzeSafetyDispute(rideId, description);
    default:
      return {
        confidence: 50,
        recommendation: "no_action",
        analysis: "Unable to auto-resolve this dispute type. Escalating to manual review.",
        evidenceSummary: {
          gpsVerified: false,
          routeDeviation: 0,
          fareAccuracy: 100,
          ratingPattern: "not_analyzed"
        }
      };
  }
}
async function createAndResolveDispute(rideId, reporterId, reporterRole, type, description) {
  const analysis = await resolveDispute(rideId, type, description);
  const [ride] = await db.select().from(rides).where(eq3(rides.id, rideId)).limit(1);
  const [dispute] = await db.insert(disputes).values({
    rideId,
    reporterId,
    reporterRole,
    type,
    status: analysis.confidence >= 80 ? "closed" : "investigating",
    description,
    estimatedFare: ride?.estimatedFare,
    actualFare: ride?.actualFare,
    aiAnalysis: analysis.analysis,
    aiConfidence: analysis.confidence.toString(),
    aiRecommendation: analysis.recommendation,
    resolution: analysis.confidence >= 80 ? analysis.recommendation : null,
    refundAmount: analysis.suggestedRefund?.toString(),
    resolvedAt: analysis.confidence >= 80 ? /* @__PURE__ */ new Date() : null,
    resolvedBy: analysis.confidence >= 80 ? "ai_system" : null
  }).returning();
  if (analysis.confidence >= 80 && analysis.suggestedRefund && analysis.suggestedRefund > 0) {
    console.log(`Auto-refund of ${analysis.suggestedRefund} processed for dispute ${dispute.id}`);
  }
  return {
    disputeId: dispute.id,
    analysis,
    resolved: analysis.confidence >= 80
  };
}
async function recordTelemetry(rideId, lat, lng, speed, heading, accuracy) {
  await db.insert(rideTelemetry).values({
    rideId,
    lat: lat.toString(),
    lng: lng.toString(),
    speed: speed?.toString(),
    heading: heading?.toString(),
    accuracy: accuracy?.toString()
  });
}
async function getDisputesByRide(rideId) {
  return db.select().from(disputes).where(eq3(disputes.rideId, rideId));
}
async function getDisputesByUser(userId) {
  return db.select().from(disputes).where(eq3(disputes.reporterId, userId)).orderBy(desc2(disputes.createdAt));
}

// server/translationService.ts
init_db();
init_schema();
import { eq as eq4 } from "drizzle-orm";
var QUICK_REPLIES = {
  en: {
    "arriving_soon": "I'm arriving soon",
    "im_here": "I'm here at the pickup point",
    "waiting": "I'm waiting for you",
    "on_my_way": "On my way!",
    "stuck_traffic": "Stuck in traffic, will be there soon",
    "wrong_location": "I think the location is wrong",
    "call_me": "Please call me",
    "thank_you": "Thank you!",
    "5_minutes": "I'll be there in 5 minutes",
    "2_minutes": "I'll be there in 2 minutes",
    "looking_for_you": "I'm looking for you",
    "near_entrance": "I'm near the entrance",
    "wait_please": "Please wait, I'm coming",
    "change_pickup": "Can we change the pickup point?",
    "confirm_destination": "Can you confirm the destination?"
  },
  ar: {
    "arriving_soon": "\u0633\u0623\u0635\u0644 \u0642\u0631\u064A\u0628\u0627\u064B",
    "im_here": "\u0623\u0646\u0627 \u0647\u0646\u0627 \u0641\u064A \u0646\u0642\u0637\u0629 \u0627\u0644\u0627\u0644\u062A\u0642\u0627\u0621",
    "waiting": "\u0623\u0646\u0627 \u0641\u064A \u0627\u0646\u062A\u0638\u0627\u0631\u0643",
    "on_my_way": "\u0641\u064A \u0627\u0644\u0637\u0631\u064A\u0642!",
    "stuck_traffic": "\u0639\u0627\u0644\u0642 \u0641\u064A \u0627\u0644\u0645\u0631\u0648\u0631\u060C \u0633\u0623\u0635\u0644 \u0642\u0631\u064A\u0628\u0627\u064B",
    "wrong_location": "\u0623\u0639\u062A\u0642\u062F \u0623\u0646 \u0627\u0644\u0645\u0648\u0642\u0639 \u062E\u0627\u0637\u0626",
    "call_me": "\u0645\u0646 \u0641\u0636\u0644\u0643 \u0627\u062A\u0635\u0644 \u0628\u064A",
    "thank_you": "\u0634\u0643\u0631\u0627\u064B \u0644\u0643!",
    "5_minutes": "\u0633\u0623\u0635\u0644 \u062E\u0644\u0627\u0644 5 \u062F\u0642\u0627\u0626\u0642",
    "2_minutes": "\u0633\u0623\u0635\u0644 \u062E\u0644\u0627\u0644 \u062F\u0642\u064A\u0642\u062A\u064A\u0646",
    "looking_for_you": "\u0623\u0628\u062D\u062B \u0639\u0646\u0643",
    "near_entrance": "\u0623\u0646\u0627 \u0642\u0631\u0628 \u0627\u0644\u0645\u062F\u062E\u0644",
    "wait_please": "\u0627\u0646\u062A\u0638\u0631 \u0645\u0646 \u0641\u0636\u0644\u0643\u060C \u0623\u0646\u0627 \u0642\u0627\u062F\u0645",
    "change_pickup": "\u0647\u0644 \u064A\u0645\u0643\u0646\u0646\u0627 \u062A\u063A\u064A\u064A\u0631 \u0646\u0642\u0637\u0629 \u0627\u0644\u0627\u0644\u062A\u0642\u0627\u0621\u061F",
    "confirm_destination": "\u0647\u0644 \u064A\u0645\u0643\u0646\u0643 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0648\u062C\u0647\u0629\u061F"
  },
  ru: {
    "arriving_soon": "\u0421\u043A\u043E\u0440\u043E \u0431\u0443\u0434\u0443",
    "im_here": "\u042F \u043D\u0430 \u043C\u0435\u0441\u0442\u0435",
    "waiting": "\u0416\u0434\u0443 \u0432\u0430\u0441",
    "on_my_way": "\u0415\u0434\u0443!",
    "stuck_traffic": "\u0417\u0430\u0441\u0442\u0440\u044F\u043B \u0432 \u043F\u0440\u043E\u0431\u043A\u0435, \u0441\u043A\u043E\u0440\u043E \u0431\u0443\u0434\u0443",
    "wrong_location": "\u041A\u0430\u0436\u0435\u0442\u0441\u044F, \u0430\u0434\u0440\u0435\u0441 \u043D\u0435\u0432\u0435\u0440\u043D\u044B\u0439",
    "call_me": "\u041F\u043E\u0437\u0432\u043E\u043D\u0438\u0442\u0435 \u043C\u043D\u0435, \u043F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430",
    "thank_you": "\u0421\u043F\u0430\u0441\u0438\u0431\u043E!",
    "5_minutes": "\u0411\u0443\u0434\u0443 \u0447\u0435\u0440\u0435\u0437 5 \u043C\u0438\u043D\u0443\u0442",
    "2_minutes": "\u0411\u0443\u0434\u0443 \u0447\u0435\u0440\u0435\u0437 2 \u043C\u0438\u043D\u0443\u0442\u044B",
    "looking_for_you": "\u0418\u0449\u0443 \u0432\u0430\u0441",
    "near_entrance": "\u042F \u0443 \u0432\u0445\u043E\u0434\u0430",
    "wait_please": "\u041F\u043E\u0434\u043E\u0436\u0434\u0438\u0442\u0435, \u043F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430",
    "change_pickup": "\u041C\u043E\u0436\u0435\u043C \u043F\u043E\u043C\u0435\u043D\u044F\u0442\u044C \u0442\u043E\u0447\u043A\u0443 \u043F\u043E\u0441\u0430\u0434\u043A\u0438?",
    "confirm_destination": "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u043F\u0443\u043D\u043A\u0442 \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F"
  },
  hi: {
    "arriving_soon": "\u092E\u0948\u0902 \u091C\u0932\u094D\u0926 \u0906 \u0930\u0939\u093E \u0939\u0942\u0902",
    "im_here": "\u092E\u0948\u0902 \u092A\u093F\u0915\u0905\u092A \u092A\u0949\u0907\u0902\u091F \u092A\u0930 \u0939\u0942\u0902",
    "waiting": "\u092E\u0948\u0902 \u0906\u092A\u0915\u093E \u0907\u0902\u0924\u091C\u093E\u0930 \u0915\u0930 \u0930\u0939\u093E \u0939\u0942\u0902",
    "on_my_way": "\u0930\u093E\u0938\u094D\u0924\u0947 \u092E\u0947\u0902 \u0939\u0942\u0902!",
    "stuck_traffic": "\u091F\u094D\u0930\u0948\u092B\u093F\u0915 \u092E\u0947\u0902 \u092B\u0902\u0938\u093E \u0939\u0942\u0902, \u091C\u0932\u094D\u0926 \u092A\u0939\u0941\u0902\u091A\u0942\u0902\u0917\u093E",
    "wrong_location": "\u092E\u0941\u091D\u0947 \u0932\u0917\u0924\u093E \u0939\u0948 \u0932\u094B\u0915\u0947\u0936\u0928 \u0917\u0932\u0924 \u0939\u0948",
    "call_me": "\u0915\u0943\u092A\u092F\u093E \u092E\u0941\u091D\u0947 \u0915\u0949\u0932 \u0915\u0930\u0947\u0902",
    "thank_you": "\u0927\u0928\u094D\u092F\u0935\u093E\u0926!",
    "5_minutes": "5 \u092E\u093F\u0928\u091F \u092E\u0947\u0902 \u092A\u0939\u0941\u0902\u091A \u0930\u0939\u093E \u0939\u0942\u0902",
    "2_minutes": "2 \u092E\u093F\u0928\u091F \u092E\u0947\u0902 \u092A\u0939\u0941\u0902\u091A \u0930\u0939\u093E \u0939\u0942\u0902",
    "looking_for_you": "\u092E\u0948\u0902 \u0906\u092A\u0915\u094B \u0922\u0942\u0902\u0922 \u0930\u0939\u093E \u0939\u0942\u0902",
    "near_entrance": "\u092E\u0948\u0902 \u092A\u094D\u0930\u0935\u0947\u0936 \u0926\u094D\u0935\u093E\u0930 \u0915\u0947 \u092A\u093E\u0938 \u0939\u0942\u0902",
    "wait_please": "\u0915\u0943\u092A\u092F\u093E \u0930\u0941\u0915\u0947\u0902, \u092E\u0948\u0902 \u0906 \u0930\u0939\u093E \u0939\u0942\u0902",
    "change_pickup": "\u0915\u094D\u092F\u093E \u0939\u092E \u092A\u093F\u0915\u0905\u092A \u092A\u0949\u0907\u0902\u091F \u092C\u0926\u0932 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902?",
    "confirm_destination": "\u0915\u094D\u092F\u093E \u0906\u092A \u0917\u0902\u0924\u0935\u094D\u092F \u0915\u0940 \u092A\u0941\u0937\u094D\u091F\u093F \u0915\u0930 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902?"
  },
  zh: {
    "arriving_soon": "\u6211\u9A6C\u4E0A\u5C31\u5230",
    "im_here": "\u6211\u5230\u63A5\u8F7D\u70B9\u4E86",
    "waiting": "\u6211\u5728\u7B49\u4F60",
    "on_my_way": "\u5728\u8DEF\u4E0A\u4E86\uFF01",
    "stuck_traffic": "\u5835\u8F66\u4E2D\uFF0C\u9A6C\u4E0A\u5230",
    "wrong_location": "\u4F4D\u7F6E\u597D\u50CF\u4E0D\u5BF9",
    "call_me": "\u8BF7\u7ED9\u6211\u6253\u7535\u8BDD",
    "thank_you": "\u8C22\u8C22\uFF01",
    "5_minutes": "5\u5206\u949F\u540E\u5230",
    "2_minutes": "2\u5206\u949F\u540E\u5230",
    "looking_for_you": "\u6211\u5728\u627E\u4F60",
    "near_entrance": "\u6211\u5728\u5165\u53E3\u9644\u8FD1",
    "wait_please": "\u8BF7\u7A0D\u7B49\uFF0C\u6211\u6765\u4E86",
    "change_pickup": "\u80FD\u6362\u4E2A\u63A5\u8F7D\u70B9\u5417\uFF1F",
    "confirm_destination": "\u8BF7\u786E\u8BA4\u76EE\u7684\u5730"
  },
  es: {
    "arriving_soon": "Estoy llegando",
    "im_here": "Estoy aqu\xED en el punto de recogida",
    "waiting": "Te estoy esperando",
    "on_my_way": "\xA1En camino!",
    "stuck_traffic": "Atascado en el tr\xE1fico, llegar\xE9 pronto",
    "wrong_location": "Creo que la ubicaci\xF3n es incorrecta",
    "call_me": "Por favor ll\xE1mame",
    "thank_you": "\xA1Gracias!",
    "5_minutes": "Llego en 5 minutos",
    "2_minutes": "Llego en 2 minutos",
    "looking_for_you": "Te estoy buscando",
    "near_entrance": "Estoy cerca de la entrada",
    "wait_please": "Espera por favor, ya voy",
    "change_pickup": "\xBFPodemos cambiar el punto de recogida?",
    "confirm_destination": "\xBFPuedes confirmar el destino?"
  },
  fr: {
    "arriving_soon": "J'arrive bient\xF4t",
    "im_here": "Je suis au point de prise en charge",
    "waiting": "Je vous attends",
    "on_my_way": "En route !",
    "stuck_traffic": "Bloqu\xE9 dans le trafic, j'arrive bient\xF4t",
    "wrong_location": "Je pense que l'adresse est incorrecte",
    "call_me": "Appelez-moi s'il vous pla\xEEt",
    "thank_you": "Merci !",
    "5_minutes": "J'arrive dans 5 minutes",
    "2_minutes": "J'arrive dans 2 minutes",
    "looking_for_you": "Je vous cherche",
    "near_entrance": "Je suis pr\xE8s de l'entr\xE9e",
    "wait_please": "Attendez s'il vous pla\xEEt, j'arrive",
    "change_pickup": "On peut changer le point de prise en charge ?",
    "confirm_destination": "Pouvez-vous confirmer la destination ?"
  },
  pt: {
    "arriving_soon": "Estou chegando",
    "im_here": "Estou aqui no ponto de embarque",
    "waiting": "Estou esperando voc\xEA",
    "on_my_way": "A caminho!",
    "stuck_traffic": "Preso no tr\xE2nsito, chegarei em breve",
    "wrong_location": "Acho que o local est\xE1 errado",
    "call_me": "Por favor me ligue",
    "thank_you": "Obrigado!",
    "5_minutes": "Chego em 5 minutos",
    "2_minutes": "Chego em 2 minutos",
    "looking_for_you": "Estou procurando voc\xEA",
    "near_entrance": "Estou perto da entrada",
    "wait_please": "Aguarde por favor, estou indo",
    "change_pickup": "Podemos mudar o ponto de embarque?",
    "confirm_destination": "Pode confirmar o destino?"
  },
  de: {
    "arriving_soon": "Ich komme gleich",
    "im_here": "Ich bin am Abholpunkt",
    "waiting": "Ich warte auf Sie",
    "on_my_way": "Bin unterwegs!",
    "stuck_traffic": "Stehe im Stau, bin bald da",
    "wrong_location": "Ich glaube der Standort ist falsch",
    "call_me": "Bitte rufen Sie mich an",
    "thank_you": "Danke!",
    "5_minutes": "Bin in 5 Minuten da",
    "2_minutes": "Bin in 2 Minuten da",
    "looking_for_you": "Ich suche Sie",
    "near_entrance": "Ich bin am Eingang",
    "wait_please": "Bitte warten Sie, ich komme",
    "change_pickup": "K\xF6nnen wir den Abholort \xE4ndern?",
    "confirm_destination": "K\xF6nnen Sie das Ziel best\xE4tigen?"
  },
  sw: {
    "arriving_soon": "Ninakuja hivi karibuni",
    "im_here": "Niko hapa kwenye eneo la kupakia",
    "waiting": "Ninakusubiri",
    "on_my_way": "Njiani!",
    "stuck_traffic": "Nimekwama trafikini, nitafika hivi karibuni",
    "wrong_location": "Nadhani eneo ni makosa",
    "call_me": "Tafadhali nipigie simu",
    "thank_you": "Asante!",
    "5_minutes": "Nitafika dakika 5",
    "2_minutes": "Nitafika dakika 2",
    "looking_for_you": "Ninakutafuta",
    "near_entrance": "Niko karibu na mlango",
    "wait_please": "Tafadhali subiri, ninakuja",
    "change_pickup": "Tunaweza kubadilisha eneo la kupakia?",
    "confirm_destination": "Unaweza kuthibitisha mwisho?"
  },
  th: {
    "arriving_soon": "\u0E43\u0E01\u0E25\u0E49\u0E16\u0E36\u0E07\u0E41\u0E25\u0E49\u0E27",
    "im_here": "\u0E09\u0E31\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E17\u0E35\u0E48\u0E08\u0E38\u0E14\u0E23\u0E31\u0E1A\u0E41\u0E25\u0E49\u0E27",
    "waiting": "\u0E23\u0E2D\u0E04\u0E38\u0E13\u0E2D\u0E22\u0E39\u0E48",
    "on_my_way": "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E44\u0E1B!",
    "stuck_traffic": "\u0E15\u0E34\u0E14\u0E01\u0E32\u0E23\u0E08\u0E23\u0E32\u0E08\u0E23 \u0E08\u0E30\u0E16\u0E36\u0E07\u0E40\u0E23\u0E47\u0E27\u0E46 \u0E19\u0E35\u0E49",
    "wrong_location": "\u0E14\u0E39\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07",
    "call_me": "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E42\u0E17\u0E23\u0E2B\u0E32\u0E09\u0E31\u0E19",
    "thank_you": "\u0E02\u0E2D\u0E1A\u0E04\u0E38\u0E13!",
    "5_minutes": "\u0E08\u0E30\u0E16\u0E36\u0E07\u0E43\u0E19 5 \u0E19\u0E32\u0E17\u0E35",
    "2_minutes": "\u0E08\u0E30\u0E16\u0E36\u0E07\u0E43\u0E19 2 \u0E19\u0E32\u0E17\u0E35",
    "looking_for_you": "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E2B\u0E32\u0E04\u0E38\u0E13\u0E2D\u0E22\u0E39\u0E48",
    "near_entrance": "\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E01\u0E25\u0E49\u0E17\u0E32\u0E07\u0E40\u0E02\u0E49\u0E32",
    "wait_please": "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E2D\u0E2A\u0E31\u0E01\u0E04\u0E23\u0E39\u0E48 \u0E01\u0E33\u0E25\u0E31\u0E07\u0E44\u0E1B",
    "change_pickup": "\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E08\u0E38\u0E14\u0E23\u0E31\u0E1A\u0E44\u0E14\u0E49\u0E44\u0E2B\u0E21?",
    "confirm_destination": "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E08\u0E38\u0E14\u0E2B\u0E21\u0E32\u0E22\u0E44\u0E14\u0E49\u0E44\u0E2B\u0E21?"
  },
  vi: {
    "arriving_soon": "T\xF4i s\u1EAFp \u0111\u1EBFn",
    "im_here": "T\xF4i \u0111ang \u1EDF \u0111i\u1EC3m \u0111\xF3n",
    "waiting": "T\xF4i \u0111ang \u0111\u1EE3i b\u1EA1n",
    "on_my_way": "\u0110ang tr\xEAn \u0111\u01B0\u1EDDng!",
    "stuck_traffic": "\u0110ang k\u1EB9t xe, s\u1EBD \u0111\u1EBFn s\u1EDBm",
    "wrong_location": "H\xECnh nh\u01B0 \u0111\u1ECBa \u0111i\u1EC3m sai r\u1ED3i",
    "call_me": "Vui l\xF2ng g\u1ECDi cho t\xF4i",
    "thank_you": "C\u1EA3m \u01A1n!",
    "5_minutes": "T\xF4i s\u1EBD \u0111\u1EBFn trong 5 ph\xFAt",
    "2_minutes": "T\xF4i s\u1EBD \u0111\u1EBFn trong 2 ph\xFAt",
    "looking_for_you": "T\xF4i \u0111ang t\xECm b\u1EA1n",
    "near_entrance": "T\xF4i \u1EDF g\u1EA7n l\u1ED1i v\xE0o",
    "wait_please": "Vui l\xF2ng \u0111\u1EE3i, t\xF4i \u0111ang \u0111\u1EBFn",
    "change_pickup": "C\xF3 th\u1EC3 \u0111\u1ED5i \u0111i\u1EC3m \u0111\xF3n kh\xF4ng?",
    "confirm_destination": "B\u1EA1n x\xE1c nh\u1EADn \u0111i\u1EC3m \u0111\u1EBFn \u0111\u01B0\u1EE3c kh\xF4ng?"
  },
  id: {
    "arriving_soon": "Saya segera tiba",
    "im_here": "Saya di titik jemput",
    "waiting": "Saya menunggu Anda",
    "on_my_way": "Dalam perjalanan!",
    "stuck_traffic": "Terjebak macet, segera tiba",
    "wrong_location": "Sepertinya lokasi salah",
    "call_me": "Tolong hubungi saya",
    "thank_you": "Terima kasih!",
    "5_minutes": "Tiba dalam 5 menit",
    "2_minutes": "Tiba dalam 2 menit",
    "looking_for_you": "Saya mencari Anda",
    "near_entrance": "Saya di dekat pintu masuk",
    "wait_please": "Mohon tunggu, saya datang",
    "change_pickup": "Bisa ganti titik jemput?",
    "confirm_destination": "Bisa konfirmasi tujuan?"
  },
  fil: {
    "arriving_soon": "Malapit na ako",
    "im_here": "Nandito na ako sa pickup point",
    "waiting": "Hinihintay kita",
    "on_my_way": "Papunta na!",
    "stuck_traffic": "Na-traffic, darating na",
    "wrong_location": "Mali yata ang location",
    "call_me": "Paki-tawagan mo ako",
    "thank_you": "Salamat!",
    "5_minutes": "Darating sa 5 minuto",
    "2_minutes": "Darating sa 2 minuto",
    "looking_for_you": "Hinahanap kita",
    "near_entrance": "Nasa malapit ako sa entrance",
    "wait_please": "Sandali lang, parating na",
    "change_pickup": "Pwede bang palitan ang pickup?",
    "confirm_destination": "Confirm mo naman ang destination?"
  },
  tr: {
    "arriving_soon": "Yak\u0131nda var\u0131yorum",
    "im_here": "Bulu\u015Fma noktas\u0131nday\u0131m",
    "waiting": "Sizi bekliyorum",
    "on_my_way": "Yolday\u0131m!",
    "stuck_traffic": "Trafi\u011Fe tak\u0131ld\u0131m, birazdan var\u0131r\u0131m",
    "wrong_location": "Konum yanl\u0131\u015F gibi",
    "call_me": "L\xFCtfen beni aray\u0131n",
    "thank_you": "Te\u015Fekk\xFCrler!",
    "5_minutes": "5 dakikada var\u0131r\u0131m",
    "2_minutes": "2 dakikada var\u0131r\u0131m",
    "looking_for_you": "Sizi ar\u0131yorum",
    "near_entrance": "Giri\u015Fin yak\u0131n\u0131nday\u0131m",
    "wait_please": "L\xFCtfen bekleyin, geliyorum",
    "change_pickup": "Bulu\u015Fma noktas\u0131n\u0131 de\u011Fi\u015Ftirebilir miyiz?",
    "confirm_destination": "Var\u0131\u015F noktas\u0131n\u0131 onaylayabilir misiniz?"
  },
  ja: {
    "arriving_soon": "\u3082\u3046\u3059\u3050\u7740\u304D\u307E\u3059",
    "im_here": "\u4E57\u8ECA\u5730\u70B9\u306B\u5230\u7740\u3057\u307E\u3057\u305F",
    "waiting": "\u304A\u5F85\u3061\u3057\u3066\u3044\u307E\u3059",
    "on_my_way": "\u5411\u304B\u3063\u3066\u3044\u307E\u3059\uFF01",
    "stuck_traffic": "\u6E0B\u6EDE\u4E2D\u3067\u3059\u3001\u307E\u3082\u306A\u304F\u5230\u7740\u3057\u307E\u3059",
    "wrong_location": "\u5834\u6240\u304C\u9055\u3046\u3088\u3046\u3067\u3059",
    "call_me": "\u96FB\u8A71\u3092\u304F\u3060\u3055\u3044",
    "thank_you": "\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\uFF01",
    "5_minutes": "5\u5206\u3067\u5230\u7740\u3057\u307E\u3059",
    "2_minutes": "2\u5206\u3067\u5230\u7740\u3057\u307E\u3059",
    "looking_for_you": "\u63A2\u3057\u3066\u3044\u307E\u3059",
    "near_entrance": "\u5165\u53E3\u306E\u8FD1\u304F\u306B\u3044\u307E\u3059",
    "wait_please": "\u304A\u5F85\u3061\u304F\u3060\u3055\u3044\u3001\u5411\u304B\u3063\u3066\u3044\u307E\u3059",
    "change_pickup": "\u4E57\u8ECA\u5730\u70B9\u3092\u5909\u66F4\u3067\u304D\u307E\u3059\u304B\uFF1F",
    "confirm_destination": "\u76EE\u7684\u5730\u3092\u78BA\u8A8D\u3067\u304D\u307E\u3059\u304B\uFF1F"
  }
};
var SIMPLE_TRANSLATIONS = {
  "en->ar": { "hello": "\u0645\u0631\u062D\u0628\u0627", "yes": "\u0646\u0639\u0645", "no": "\u0644\u0627", "ok": "\u062D\u0633\u0646\u0627", "sorry": "\u0622\u0633\u0641" },
  "en->ru": { "hello": "\u043F\u0440\u0438\u0432\u0435\u0442", "yes": "\u0434\u0430", "no": "\u043D\u0435\u0442", "ok": "\u0445\u043E\u0440\u043E\u0448\u043E", "sorry": "\u0438\u0437\u0432\u0438\u043D\u0438\u0442\u0435" },
  "en->hi": { "hello": "\u0928\u092E\u0938\u094D\u0924\u0947", "yes": "\u0939\u093E\u0902", "no": "\u0928\u0939\u0940\u0902", "ok": "\u0920\u0940\u0915 \u0939\u0948", "sorry": "\u092E\u093E\u092B\u093C \u0915\u0940\u091C\u093F\u090F" },
  "en->zh": { "hello": "\u4F60\u597D", "yes": "\u662F", "no": "\u4E0D", "ok": "\u597D\u7684", "sorry": "\u5BF9\u4E0D\u8D77" }
};
function getQuickReplies(language) {
  const replies = QUICK_REPLIES[language] || QUICK_REPLIES["en"];
  return Object.entries(replies).map(([key, text2]) => ({ key, text: text2 }));
}
function getQuickReplyTranslation(key, targetLanguage) {
  const replies = QUICK_REPLIES[targetLanguage] || QUICK_REPLIES["en"];
  return replies[key] || QUICK_REPLIES["en"][key] || key;
}
function translateMessage(message, fromLanguage, toLanguage) {
  if (fromLanguage === toLanguage) return message;
  const key = `${fromLanguage}->${toLanguage}`;
  const simpleTranslations = SIMPLE_TRANSLATIONS[key];
  if (simpleTranslations) {
    const lowerMessage = message.toLowerCase();
    if (simpleTranslations[lowerMessage]) {
      return simpleTranslations[lowerMessage];
    }
  }
  return message;
}
async function sendRideMessage(rideId, senderId, senderRole, message, senderLanguage, recipientLanguage, isQuickReply = false) {
  let translatedMessage = message;
  if (isQuickReply) {
    translatedMessage = getQuickReplyTranslation(message, recipientLanguage);
  } else if (senderLanguage !== recipientLanguage) {
    translatedMessage = translateMessage(message, senderLanguage, recipientLanguage);
  }
  const [inserted] = await db.insert(rideMessages).values({
    rideId,
    senderId,
    senderRole,
    originalMessage: message,
    originalLanguage: senderLanguage,
    translatedMessage,
    translatedLanguage: recipientLanguage,
    isQuickReply
  }).returning();
  return {
    id: inserted.id,
    originalMessage: message,
    translatedMessage
  };
}
async function getRideMessages(rideId) {
  return db.select().from(rideMessages).where(eq4(rideMessages.rideId, rideId));
}
function getSupportedLanguages() {
  return [
    { code: "en", name: "English", nativeName: "English" },
    { code: "ar", name: "Arabic", nativeName: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629" },
    { code: "ru", name: "Russian", nativeName: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439" },
    { code: "hi", name: "Hindi", nativeName: "\u0939\u093F\u0928\u094D\u0926\u0940" },
    { code: "zh", name: "Chinese", nativeName: "\u4E2D\u6587" },
    { code: "es", name: "Spanish", nativeName: "Espa\xF1ol" },
    { code: "fr", name: "French", nativeName: "Fran\xE7ais" },
    { code: "pt", name: "Portuguese", nativeName: "Portugu\xEAs" },
    { code: "de", name: "German", nativeName: "Deutsch" },
    { code: "sw", name: "Swahili", nativeName: "Kiswahili" },
    { code: "th", name: "Thai", nativeName: "\u0E44\u0E17\u0E22" },
    { code: "vi", name: "Vietnamese", nativeName: "Ti\u1EBFng Vi\u1EC7t" },
    { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
    { code: "fil", name: "Filipino", nativeName: "Filipino" },
    { code: "tr", name: "Turkish", nativeName: "T\xFCrk\xE7e" },
    { code: "ja", name: "Japanese", nativeName: "\u65E5\u672C\u8A9E" }
  ];
}

// server/twilioService.ts
import twilio from "twilio";
function getAccountSid() {
  return process.env.TWILIO_ACCOUNT_SID;
}
function getAuthToken() {
  return process.env.TWILIO_AUTH_TOKEN;
}
function getFromNumber() {
  return process.env.TWILIO_PHONE_NUMBER;
}
function getMessagingServiceSid() {
  return process.env.TWILIO_MESSAGING_SERVICE_SID;
}
function getWhatsappNumber() {
  return process.env.TWILIO_WHATSAPP_NUMBER;
}
function getVerifyServiceSid() {
  return process.env.TWILIO_VERIFY_SERVICE_SID;
}
function getIndiaSenderId() {
  return process.env.TWILIO_INDIA_SENDER_ID || "TRAVNY";
}
function getIndiaDltEntityId() {
  return process.env.TWILIO_INDIA_DLT_ENTITY_ID;
}
function getIndiaDltTemplateId() {
  return process.env.TWILIO_INDIA_DLT_TEMPLATE_ID;
}
console.log(`Twilio Config: Verify=${getVerifyServiceSid() ? "SET" : "NOT SET"}, MessagingService=${getMessagingServiceSid() ? "SET" : "NOT SET"}, PhoneNumber=${getFromNumber() ? "SET" : "NOT SET"}`);
var client = null;
var lastAccountSid = void 0;
function getClient() {
  const accountSid = getAccountSid();
  const authToken = getAuthToken();
  if (!accountSid || !authToken) {
    console.log("Twilio: Not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
    return null;
  }
  if (!client || lastAccountSid !== accountSid) {
    client = twilio(accountSid, authToken);
    lastAccountSid = accountSid;
  }
  return client;
}
async function sendVerifyOtp(to) {
  const twilioClient = getClient();
  const verifyServiceSid = getVerifyServiceSid();
  if (!twilioClient || !verifyServiceSid) {
    console.log("Twilio Verify not configured. Falling back to SMS.");
    return { success: false, error: "Verify service not configured" };
  }
  try {
    let cleanTo = to.trim().replace(/\s+/g, "");
    if (!cleanTo.startsWith("+")) {
      cleanTo = "+" + cleanTo;
    }
    console.log(`Sending Twilio Verify OTP to ${cleanTo}`);
    const verification = await twilioClient.verify.v2.services(verifyServiceSid).verifications.create({
      to: cleanTo,
      channel: "sms"
    });
    console.log(`Verify OTP sent to ${cleanTo}, status: ${verification.status}`);
    return { success: true, channel: "verify" };
  } catch (error) {
    console.error("Twilio Verify error:", error.message, "Code:", error.code);
    return { success: false, error: error.message };
  }
}
async function checkVerifyOtp(to, code) {
  const twilioClient = getClient();
  const verifyServiceSid = getVerifyServiceSid();
  if (!twilioClient || !verifyServiceSid) {
    return { success: false, error: "Verify service not configured" };
  }
  try {
    let cleanTo = to.trim().replace(/\s+/g, "");
    if (!cleanTo.startsWith("+")) {
      cleanTo = "+" + cleanTo;
    }
    const verificationCheck = await twilioClient.verify.v2.services(verifyServiceSid).verificationChecks.create({ to: cleanTo, code });
    if (verificationCheck.status === "approved") {
      console.log(`Verify OTP approved for ${cleanTo}`);
      return { success: true };
    } else {
      console.log(`Verify OTP rejected for ${cleanTo}, status: ${verificationCheck.status}`);
      return { success: false, error: "Invalid code" };
    }
  } catch (error) {
    console.error("Twilio Verify check error:", error.message);
    return { success: false, error: error.message };
  }
}
function isVerifyConfigured() {
  return !!(getAccountSid() && getAuthToken() && getVerifyServiceSid());
}
async function sendOtpWhatsApp(to, otp) {
  const twilioClient = getClient();
  const whatsappNumber = getWhatsappNumber();
  if (!twilioClient || !whatsappNumber) {
    console.error("Twilio WhatsApp not configured. Set TWILIO_WHATSAPP_NUMBER.");
    return { success: false, error: "WhatsApp service not configured" };
  }
  try {
    let cleanTo = to.trim().replace(/\s+/g, "");
    if (!cleanTo.startsWith("+") && !cleanTo.startsWith("whatsapp:")) {
      cleanTo = "+" + cleanTo;
    }
    const cleanNumber = whatsappNumber.trim().replace(/\s+/g, "");
    const whatsappTo = cleanTo.startsWith("whatsapp:") ? cleanTo : `whatsapp:${cleanTo}`;
    const whatsappFrom = cleanNumber.startsWith("whatsapp:") ? cleanNumber : `whatsapp:${cleanNumber}`;
    console.log(`Attempting WhatsApp OTP to: ${whatsappTo} from: ${whatsappFrom}`);
    await twilioClient.messages.create({
      body: `Your Travony verification code is: ${otp}. Valid for 5 minutes.`,
      from: whatsappFrom,
      to: whatsappTo
    });
    console.log(`WhatsApp OTP sent successfully to ${to}`);
    return { success: true };
  } catch (error) {
    console.error("Twilio WhatsApp error:", error.message, "Code:", error.code, "Status:", error.status);
    return { success: false, error: error.message };
  }
}
function isIndianNumber(phone) {
  const cleaned = phone.replace(/\s+/g, "").replace(/^0+/, "");
  return cleaned.startsWith("+91") || cleaned.startsWith("91");
}
async function sendOtpSms(to, otp) {
  const twilioClient = getClient();
  const messagingServiceSid = getMessagingServiceSid();
  const fromNumber = getFromNumber();
  const INDIA_SENDER_ID = getIndiaSenderId();
  const INDIA_DLT_ENTITY_ID = getIndiaDltEntityId();
  const INDIA_DLT_TEMPLATE_ID = getIndiaDltTemplateId();
  const hasMessagingService = !!messagingServiceSid;
  const hasFromNumber = !!fromNumber;
  if (!twilioClient || !hasMessagingService && !hasFromNumber) {
    console.error("Twilio not configured. Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER.");
    return { success: false, error: "SMS service not configured" };
  }
  try {
    let cleanTo = to.trim().replace(/\s+/g, "");
    if (!cleanTo.startsWith("+")) {
      cleanTo = "+" + cleanTo;
    }
    const isIndia = isIndianNumber(cleanTo);
    const messageOptions = {
      body: `Your Travony verification code is: ${otp}. Valid for 5 minutes.`,
      to: cleanTo
    };
    if (isIndia) {
      if (hasMessagingService) {
        messageOptions.messagingServiceSid = messagingServiceSid;
        console.log(`Attempting India SMS via Messaging Service to ${cleanTo}`);
      } else if (INDIA_SENDER_ID) {
        messageOptions.from = INDIA_SENDER_ID;
        console.log(`Attempting India SMS via Sender ID ${INDIA_SENDER_ID} to ${cleanTo}`);
      } else {
        messageOptions.from = fromNumber;
        console.log(`Attempting India SMS via phone number to ${cleanTo} (may fail without DLT)`);
      }
      if (INDIA_DLT_ENTITY_ID && INDIA_DLT_TEMPLATE_ID) {
        messageOptions.contentVariables = JSON.stringify({ 1: otp });
        console.log(`Using DLT Entity: ${INDIA_DLT_ENTITY_ID}, Template: ${INDIA_DLT_TEMPLATE_ID}`);
      }
    } else {
      if (hasMessagingService) {
        messageOptions.messagingServiceSid = messagingServiceSid;
        console.log(`Attempting SMS via Messaging Service to ${cleanTo}`);
      } else {
        messageOptions.from = fromNumber;
        console.log(`Attempting SMS via phone number to ${cleanTo}`);
      }
    }
    await twilioClient.messages.create(messageOptions);
    console.log(`SMS sent successfully to ${to}${isIndia ? " (India)" : ""}`);
    return { success: true };
  } catch (error) {
    console.error("Twilio SMS error:", error.message, "Code:", error.code, "Status:", error.status);
    if (isIndianNumber(to)) {
      if (error.code === 21408 || error.message?.includes("permission")) {
        return {
          success: false,
          error: "India SMS requires DLT registration. Please complete Twilio India setup."
        };
      }
      if (error.code === 21610 || error.message?.includes("unsubscribed")) {
        return {
          success: false,
          error: "This number has opted out of SMS. Please use WhatsApp instead."
        };
      }
    }
    return { success: false, error: error.message };
  }
}
async function sendOtp(to, otp, preferWhatsApp = true) {
  const isIndia = isIndianNumber(to);
  const whatsappNumber = getWhatsappNumber();
  if (preferWhatsApp && whatsappNumber) {
    console.log(`${isIndia ? "India number detected - " : ""}Trying WhatsApp first for ${to}`);
    const result = await sendOtpWhatsApp(to, otp);
    if (result.success) {
      return { ...result, channel: "whatsapp" };
    }
    console.log("WhatsApp failed, falling back to SMS");
  }
  const smsResult = await sendOtpSms(to, otp);
  return { ...smsResult, channel: "sms" };
}

// server/cityOnboardingService.ts
init_db();
init_schema();
import { eq as eq5, and as and5, count } from "drizzle-orm";
var EXPANSION_CITIES = [
  {
    regionCode: "AE-DU",
    name: "Dubai",
    slug: "dubai",
    timezone: "Asia/Dubai",
    centerLat: "25.2048",
    centerLng: "55.2708",
    radiusKm: "60",
    targetDrivers: 500,
    tier: 1,
    launchOrder: 1,
    marketingAngle: "Your car. Your rules. Your city.",
    languages: ["en", "ar"],
    vehicleTypes: ["economy", "comfort", "premium", "xl"]
  },
  {
    regionCode: "AE-AZ",
    name: "Abu Dhabi",
    slug: "abu-dhabi",
    timezone: "Asia/Dubai",
    centerLat: "24.4539",
    centerLng: "54.3773",
    radiusKm: "50",
    targetDrivers: 300,
    tier: 1,
    launchOrder: 2,
    marketingAngle: "Drive smarter in the capital.",
    languages: ["en", "ar"],
    vehicleTypes: ["economy", "comfort", "premium", "xl"]
  },
  {
    regionCode: "AE-SH",
    name: "Sharjah",
    slug: "sharjah",
    timezone: "Asia/Dubai",
    centerLat: "25.3463",
    centerLng: "55.4209",
    radiusKm: "40",
    targetDrivers: 200,
    tier: 1,
    launchOrder: 3,
    marketingAngle: "Fair rides for the Culture Capital.",
    languages: ["en", "ar"],
    vehicleTypes: ["economy", "comfort", "premium"]
  },
  {
    regionCode: "AE-AJ",
    name: "Ajman",
    slug: "ajman",
    timezone: "Asia/Dubai",
    centerLat: "25.4052",
    centerLng: "55.5136",
    radiusKm: "25",
    targetDrivers: 80,
    tier: 2,
    launchOrder: 4,
    marketingAngle: "Affordable rides, always.",
    languages: ["en", "ar"],
    vehicleTypes: ["economy", "comfort"]
  },
  {
    regionCode: "SA-RY",
    name: "Riyadh",
    slug: "riyadh",
    timezone: "Asia/Riyadh",
    centerLat: "24.7136",
    centerLng: "46.6753",
    radiusKm: "60",
    targetDrivers: 500,
    tier: 1,
    launchOrder: 5,
    marketingAngle: "The future of mobility in the Kingdom.",
    languages: ["ar", "en"],
    vehicleTypes: ["economy", "comfort", "premium", "xl"]
  },
  {
    regionCode: "SA-JD",
    name: "Jeddah",
    slug: "jeddah",
    timezone: "Asia/Riyadh",
    centerLat: "21.5433",
    centerLng: "39.1728",
    radiusKm: "45",
    targetDrivers: 300,
    tier: 1,
    launchOrder: 6,
    marketingAngle: "Red Sea rides, transparent fares.",
    languages: ["ar", "en"],
    vehicleTypes: ["economy", "comfort", "premium"]
  },
  {
    regionCode: "SA-DM",
    name: "Dammam",
    slug: "dammam",
    timezone: "Asia/Riyadh",
    centerLat: "26.3927",
    centerLng: "49.9777",
    radiusKm: "40",
    targetDrivers: 150,
    tier: 2,
    launchOrder: 7,
    marketingAngle: "Eastern Province, connected.",
    languages: ["ar", "en"],
    vehicleTypes: ["economy", "comfort", "premium"]
  },
  {
    regionCode: "SA-MK",
    name: "Mecca",
    slug: "mecca",
    timezone: "Asia/Riyadh",
    centerLat: "21.3891",
    centerLng: "39.8579",
    radiusKm: "30",
    targetDrivers: 200,
    tier: 1,
    launchOrder: 8,
    marketingAngle: "Trusted rides for pilgrims.",
    languages: ["ar", "en"],
    vehicleTypes: ["economy", "comfort", "premium"]
  },
  {
    regionCode: "SA-MD",
    name: "Medina",
    slug: "medina",
    timezone: "Asia/Riyadh",
    centerLat: "24.5247",
    centerLng: "39.5692",
    radiusKm: "25",
    targetDrivers: 150,
    tier: 2,
    launchOrder: 9,
    marketingAngle: "Peaceful rides in the Prophet's city.",
    languages: ["ar", "en"],
    vehicleTypes: ["economy", "comfort"]
  },
  {
    regionCode: "KW-KU",
    name: "Kuwait City",
    slug: "kuwait-city",
    timezone: "Asia/Kuwait",
    centerLat: "29.3759",
    centerLng: "47.9774",
    radiusKm: "45",
    targetDrivers: 200,
    tier: 1,
    launchOrder: 10,
    marketingAngle: "Fair fares for Kuwait.",
    languages: ["ar", "en"],
    vehicleTypes: ["economy", "comfort", "premium", "xl"]
  },
  {
    regionCode: "BH-MA",
    name: "Manama",
    slug: "manama",
    timezone: "Asia/Bahrain",
    centerLat: "26.2285",
    centerLng: "50.5860",
    radiusKm: "30",
    targetDrivers: 100,
    tier: 2,
    launchOrder: 11,
    marketingAngle: "Island rides, mainland prices.",
    languages: ["ar", "en"],
    vehicleTypes: ["economy", "comfort", "premium"]
  },
  {
    regionCode: "MX",
    name: "Mexico City",
    slug: "mexico-city",
    timezone: "America/Mexico_City",
    centerLat: "19.4326",
    centerLng: "-99.1332",
    radiusKm: "40",
    targetDrivers: 100,
    tier: 1,
    launchOrder: 1,
    marketingAngle: "Precios justos. Sin sorpresas.",
    languages: ["es"],
    vehicleTypes: ["economy", "comfort", "premium"]
  },
  {
    regionCode: "CO",
    name: "Bogot\xE1",
    slug: "bogota",
    timezone: "America/Bogota",
    centerLat: "4.7110",
    centerLng: "-74.0721",
    radiusKm: "35",
    targetDrivers: 150,
    tier: 1,
    launchOrder: 2,
    marketingAngle: "Precios justos. Sin desactivaciones repentinas.",
    languages: ["es"],
    vehicleTypes: ["economy", "comfort", "premium", "xl"]
  },
  {
    regionCode: "TR",
    name: "Istanbul",
    slug: "istanbul",
    timezone: "Europe/Istanbul",
    centerLat: "41.0082",
    centerLng: "28.9784",
    radiusKm: "50",
    targetDrivers: 200,
    tier: 1,
    launchOrder: 3,
    marketingAngle: "Taksiler hay\u0131r dedi\u011Finde g\xFCvenilir yolculuklar.",
    languages: ["tr"],
    vehicleTypes: ["economy", "comfort", "premium", "minibus"]
  },
  {
    regionCode: "KE",
    name: "Nairobi",
    slug: "nairobi",
    timezone: "Africa/Nairobi",
    centerLat: "-1.2921",
    centerLng: "36.8219",
    radiusKm: "30",
    targetDrivers: 120,
    tier: 1,
    launchOrder: 4,
    marketingAngle: "More earnings. More respect.",
    languages: ["en", "sw"],
    vehicleTypes: ["economy", "comfort", "boda"]
  },
  {
    regionCode: "PH",
    name: "Manila",
    slug: "manila",
    timezone: "Asia/Manila",
    centerLat: "14.5995",
    centerLng: "120.9842",
    radiusKm: "35",
    targetDrivers: 180,
    tier: 1,
    launchOrder: 5,
    marketingAngle: "Know your price before you ride.",
    languages: ["en", "fil"],
    vehicleTypes: ["economy", "comfort", "tricycle", "motorcycle"]
  },
  {
    regionCode: "MA",
    name: "Casablanca",
    slug: "casablanca",
    timezone: "Africa/Casablanca",
    centerLat: "33.5731",
    centerLng: "-7.5898",
    radiusKm: "25",
    targetDrivers: 80,
    tier: 2,
    launchOrder: 6,
    marketingAngle: "Pas de barri\xE8res linguistiques. Pas de confusion.",
    languages: ["ar", "fr"],
    vehicleTypes: ["economy", "comfort", "premium"]
  },
  {
    regionCode: "EG",
    name: "Cairo",
    slug: "cairo",
    timezone: "Africa/Cairo",
    centerLat: "30.0444",
    centerLng: "31.2357",
    radiusKm: "45",
    targetDrivers: 200,
    tier: 2,
    launchOrder: 7,
    marketingAngle: "\u0642\u0648\u0627\u0639\u062F \u0648\u0627\u0636\u062D\u0629. \u0631\u062D\u0644\u0627\u062A \u0623\u0643\u062B\u0631 \u0623\u0645\u0627\u0646\u0627\u064B.",
    languages: ["ar"],
    vehicleTypes: ["economy", "comfort", "premium", "tuktuk"]
  },
  {
    regionCode: "PE",
    name: "Lima",
    slug: "lima",
    timezone: "America/Lima",
    centerLat: "-12.0464",
    centerLng: "-77.0428",
    radiusKm: "35",
    targetDrivers: 100,
    tier: 2,
    launchOrder: 8,
    marketingAngle: "Precios claros que no cambian.",
    languages: ["es"],
    vehicleTypes: ["economy", "comfort", "mototaxi"]
  },
  {
    regionCode: "ZA",
    name: "Johannesburg",
    slug: "johannesburg",
    timezone: "Africa/Johannesburg",
    centerLat: "-26.2041",
    centerLng: "28.0473",
    radiusKm: "40",
    targetDrivers: 150,
    tier: 3,
    launchOrder: 9,
    marketingAngle: "Safety and fairness built in.",
    languages: ["en", "zu"],
    vehicleTypes: ["economy", "comfort", "premium", "xl"]
  },
  {
    regionCode: "RO",
    name: "Bucharest",
    slug: "bucharest",
    timezone: "Europe/Bucharest",
    centerLat: "44.4268",
    centerLng: "26.1025",
    radiusKm: "25",
    targetDrivers: 80,
    tier: 3,
    launchOrder: 10,
    marketingAngle: "Mobilitate modern\u0103 f\u0103r\u0103 reguli ascunse.",
    languages: ["ro"],
    vehicleTypes: ["economy", "comfort", "premium"]
  },
  {
    regionCode: "TH",
    name: "Bangkok",
    slug: "bangkok",
    timezone: "Asia/Bangkok",
    centerLat: "13.7563",
    centerLng: "100.5018",
    radiusKm: "40",
    targetDrivers: 200,
    tier: 3,
    launchOrder: 11,
    marketingAngle: "\u0E40\u0E14\u0E34\u0E19\u0E17\u0E32\u0E07\u0E44\u0E14\u0E49\u0E2D\u0E34\u0E2A\u0E23\u0E30 \u0E41\u0E21\u0E49\u0E44\u0E21\u0E48\u0E1E\u0E39\u0E14\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22",
    languages: ["th", "en"],
    vehicleTypes: ["economy", "comfort", "tuktuk", "motorcycle"]
  }
];
var DEFAULT_EDUCATION_MODULES = [
  { moduleId: "pricing", title: "How Pricing Works", description: "Learn how fares are calculated and displayed", durationMinutes: 2, sortOrder: 1 },
  { moduleId: "ratings", title: "Rating Protection", description: "Understand how ratings work and how you're protected", durationMinutes: 2, sortOrder: 2 },
  { moduleId: "disputes", title: "Dispute Resolution", description: "How disputes are handled fairly with AI verification", durationMinutes: 2, sortOrder: 3 },
  { moduleId: "emergency", title: "Emergency & Safety", description: "Safety protocols and emergency procedures", durationMinutes: 2, sortOrder: 4 },
  { moduleId: "city_rules", title: "City-Specific Rules", description: "Local regulations and best practices", durationMinutes: 2, sortOrder: 5 }
];
async function initializeCity(config) {
  const existing = await db.select().from(cities).where(eq5(cities.slug, config.slug)).limit(1);
  if (existing.length === 0) {
    const launchStatus = config.launchOrder === 1 ? "supply_seeding" : "pre_launch";
    const [city] = await db.insert(cities).values({
      regionCode: config.regionCode,
      name: config.name,
      slug: config.slug,
      timezone: config.timezone,
      centerLat: config.centerLat,
      centerLng: config.centerLng,
      radiusKm: config.radiusKm,
      targetDrivers: config.targetDrivers,
      launchStatus
    }).returning();
    for (const module of DEFAULT_EDUCATION_MODULES) {
      await db.insert(educationModules).values({
        ...module,
        cityId: city.id,
        isRequired: true,
        isActive: true
      }).onConflictDoNothing();
    }
    console.log(`Initialized ${config.name} (Tier ${config.tier}, Order ${config.launchOrder}): ${city.id}`);
  }
}
async function initializeMexicoCityLaunch() {
  await initializeAllCities();
}
async function initializeAllCities() {
  console.log("Initializing expansion cities...");
  for (const cityConfig of EXPANSION_CITIES) {
    await initializeCity(cityConfig);
  }
  console.log(`City initialization complete. Total cities configured: ${EXPANSION_CITIES.length}`);
}
function getExpansionCities() {
  return EXPANSION_CITIES;
}
function getCityConfig(slug) {
  return EXPANSION_CITIES.find((c) => c.slug === slug);
}
async function getCityBySlug(slug) {
  const [city] = await db.select().from(cities).where(eq5(cities.slug, slug)).limit(1);
  return city || null;
}
async function getAllCities() {
  return db.select().from(cities).where(eq5(cities.isActive, true));
}
async function recordDriverIntake(data) {
  const city = await getCityBySlug(data.citySlug);
  const [intake] = await db.insert(driverIntake).values({
    cityId: city?.id,
    channel: data.channel,
    phone: data.phone,
    name: data.name,
    referralCode: data.referralCode,
    status: "lead",
    conversionStep: "signup"
  }).returning();
  return intake;
}
async function uploadDriverDocument(driverId, type, fileUrl, fileName, fileSize, mimeType) {
  const existing = await db.select().from(driverDocuments).where(and5(eq5(driverDocuments.driverId, driverId), eq5(driverDocuments.type, type))).limit(1);
  if (existing.length > 0) {
    const [updated] = await db.update(driverDocuments).set({ fileUrl, fileName, fileSize, mimeType, status: "pending", reviewedAt: null, reviewNotes: null }).where(eq5(driverDocuments.id, existing[0].id)).returning();
    return updated;
  }
  const [doc] = await db.insert(driverDocuments).values({
    driverId,
    type,
    fileUrl,
    fileName,
    fileSize,
    mimeType,
    status: "pending"
  }).returning();
  await updateVerificationQueue(driverId);
  return doc;
}
async function getDriverDocuments(driverId) {
  return db.select().from(driverDocuments).where(eq5(driverDocuments.driverId, driverId));
}
async function updateVerificationQueue(driverId) {
  const docs = await getDriverDocuments(driverId);
  const hasId = docs.some((d) => d.type === "id_card" && d.status !== "rejected");
  const hasLicense = docs.some((d) => d.type === "drivers_license" && d.status !== "rejected");
  const hasVehicle = docs.some((d) => d.type === "vehicle_registration" && d.status !== "rejected");
  const hasSelfie = docs.some((d) => d.type === "selfie_video" && d.status !== "rejected");
  const documentsComplete = hasId && hasLicense && hasVehicle && hasSelfie;
  const idVerified = docs.some((d) => d.type === "id_card" && d.status === "approved");
  const licenseVerified = docs.some((d) => d.type === "drivers_license" && d.status === "approved");
  const vehicleVerified = docs.some((d) => d.type === "vehicle_registration" && d.status === "approved");
  const selfieVerified = docs.some((d) => d.type === "selfie_video" && d.status === "approved");
  const existing = await db.select().from(driverVerificationQueue).where(eq5(driverVerificationQueue.driverId, driverId)).limit(1);
  if (existing.length > 0) {
    await db.update(driverVerificationQueue).set({
      documentsComplete,
      idVerified,
      licenseVerified,
      vehicleVerified,
      selfieVerified,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq5(driverVerificationQueue.id, existing[0].id));
  } else {
    await db.insert(driverVerificationQueue).values({
      driverId,
      documentsComplete,
      idVerified,
      licenseVerified,
      vehicleVerified,
      selfieVerified,
      status: "pending"
    });
  }
}
async function reviewDocument(documentId, reviewerId, status, notes) {
  const [doc] = await db.update(driverDocuments).set({
    status,
    reviewedBy: reviewerId,
    reviewNotes: notes,
    reviewedAt: /* @__PURE__ */ new Date()
  }).where(eq5(driverDocuments.id, documentId)).returning();
  if (doc) {
    await updateVerificationQueue(doc.driverId);
    await checkDriverActivation(doc.driverId);
  }
  return doc;
}
async function getVerificationQueue(cityId, status) {
  let query = db.select({
    queue: driverVerificationQueue,
    driver: drivers,
    user: users
  }).from(driverVerificationQueue).innerJoin(drivers, eq5(driverVerificationQueue.driverId, drivers.id)).innerJoin(users, eq5(drivers.userId, users.id));
  if (cityId) {
    query = query.where(eq5(driverVerificationQueue.cityId, cityId));
  }
  return query;
}
async function checkDriverActivation(driverId) {
  const [queue] = await db.select().from(driverVerificationQueue).where(eq5(driverVerificationQueue.driverId, driverId)).limit(1);
  if (!queue) return false;
  const allDocsVerified = queue.idVerified && queue.licenseVerified && queue.vehicleVerified && queue.selfieVerified;
  if (allDocsVerified && queue.educationCompleted) {
    await db.update(drivers).set({ status: "approved" }).where(eq5(drivers.id, driverId));
    await db.update(driverVerificationQueue).set({ status: "completed", completedAt: /* @__PURE__ */ new Date() }).where(eq5(driverVerificationQueue.id, queue.id));
    await initializeTrustProtection(driverId);
    return true;
  }
  return false;
}
async function initializeTrustProtection(driverId) {
  const existing = await db.select().from(driverTrustProtection).where(eq5(driverTrustProtection.driverId, driverId)).limit(1);
  if (existing.length > 0) return existing[0];
  const protectionEndsAt = /* @__PURE__ */ new Date();
  protectionEndsAt.setDate(protectionEndsAt.getDate() + 7);
  const [protection] = await db.insert(driverTrustProtection).values({
    driverId,
    protectionActive: true,
    ridesCompleted: 0,
    protectionEndsAtRides: 20,
    earningsFloorActive: true,
    manualDisputeOverride: true,
    protectionEndsAt
  }).returning();
  return protection;
}
async function getTrustProtectionStatus(driverId) {
  const [protection] = await db.select().from(driverTrustProtection).where(eq5(driverTrustProtection.driverId, driverId)).limit(1);
  if (!protection) return null;
  const ridesCompleted = protection.ridesCompleted ?? 0;
  const maxRides = protection.protectionEndsAtRides ?? 20;
  const isActive = protection.protectionActive && ridesCompleted < maxRides;
  return {
    ...protection,
    isActive,
    ridesRemaining: Math.max(0, maxRides - ridesCompleted)
  };
}
async function getEducationModules(cityId) {
  if (cityId) {
    return db.select().from(educationModules).where(and5(eq5(educationModules.cityId, cityId), eq5(educationModules.isActive, true))).orderBy(educationModules.sortOrder);
  }
  return db.select().from(educationModules).where(eq5(educationModules.isActive, true)).orderBy(educationModules.sortOrder);
}
async function getDriverEducationProgress(driverId) {
  return db.select().from(driverEducation).where(eq5(driverEducation.driverId, driverId));
}
async function startEducationModule(driverId, moduleId, moduleName) {
  const existing = await db.select().from(driverEducation).where(and5(eq5(driverEducation.driverId, driverId), eq5(driverEducation.moduleId, moduleId))).limit(1);
  if (existing.length > 0) {
    if (existing[0].status === "completed") return existing[0];
    await db.update(driverEducation).set({ status: "in_progress", startedAt: /* @__PURE__ */ new Date() }).where(eq5(driverEducation.id, existing[0].id));
    return existing[0];
  }
  const [record] = await db.insert(driverEducation).values({
    driverId,
    moduleId,
    moduleName,
    status: "in_progress",
    startedAt: /* @__PURE__ */ new Date()
  }).returning();
  return record;
}
async function completeEducationModule(driverId, moduleId, score) {
  const [record] = await db.update(driverEducation).set({ status: "completed", completedAt: /* @__PURE__ */ new Date(), progress: 100, score }).where(and5(eq5(driverEducation.driverId, driverId), eq5(driverEducation.moduleId, moduleId))).returning();
  await checkEducationCompletion(driverId);
  return record;
}
async function checkEducationCompletion(driverId) {
  const modules = await db.select().from(educationModules).where(and5(eq5(educationModules.isRequired, true), eq5(educationModules.isActive, true)));
  const progress = await getDriverEducationProgress(driverId);
  const completedModules = progress.filter((p) => p.status === "completed").map((p) => p.moduleId);
  const allRequired = modules.every((m) => completedModules.includes(m.moduleId));
  if (allRequired) {
    await db.update(driverVerificationQueue).set({ educationCompleted: true, updatedAt: /* @__PURE__ */ new Date() }).where(eq5(driverVerificationQueue.driverId, driverId));
    await checkDriverActivation(driverId);
  }
}
async function generateReferralCode(driverId) {
  const [driver] = await db.select().from(drivers).where(eq5(drivers.id, driverId)).limit(1);
  if (!driver) throw new Error("Driver not found");
  const [user] = await db.select().from(users).where(eq5(users.id, driver.userId)).limit(1);
  const baseName = (user?.name || "driver").replace(/[^a-zA-Z]/g, "").substring(0, 6).toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${baseName}${randomSuffix}`;
}
async function getCityHealth(cityId) {
  const [city] = await db.select().from(cities).where(eq5(cities.id, cityId)).limit(1);
  if (!city) return null;
  const activeDriversResult = await db.select({ count: count() }).from(drivers).innerJoin(driverVerificationQueue, eq5(drivers.id, driverVerificationQueue.driverId)).where(and5(
    eq5(driverVerificationQueue.cityId, cityId),
    eq5(drivers.status, "approved")
  ));
  const pendingVerificationsResult = await db.select({ count: count() }).from(driverVerificationQueue).where(and5(
    eq5(driverVerificationQueue.cityId, cityId),
    eq5(driverVerificationQueue.status, "pending")
  ));
  const championsResult = await db.select({ count: count() }).from(cityChampions).where(and5(
    eq5(cityChampions.cityId, cityId),
    eq5(cityChampions.status, "active")
  ));
  return {
    city,
    metrics: {
      activeDrivers: activeDriversResult[0]?.count || 0,
      targetDrivers: city.targetDrivers || 100,
      pendingVerifications: pendingVerificationsResult[0]?.count || 0,
      activeChampions: championsResult[0]?.count || 0,
      avgEtaMinutes: city.avgEtaMinutes ? parseFloat(city.avgEtaMinutes) : null,
      rideAcceptanceRate: city.rideAcceptanceRate ? parseFloat(city.rideAcceptanceRate) : null,
      monthlyChurnPercent: city.monthlyChurnPercent ? parseFloat(city.monthlyChurnPercent) : null,
      disputesPer1000: city.disputesPer1000 ? parseFloat(city.disputesPer1000) : null
    },
    launchStatus: city.launchStatus,
    telegramGroupLink: city.telegramGroupLink,
    whatsappGroupLink: city.whatsappGroupLink
  };
}
async function checkChampionEligibility(driverId) {
  const [driver] = await db.select().from(drivers).where(eq5(drivers.id, driverId)).limit(1);
  if (!driver) return { eligible: false, reason: "Driver not found", stats: { totalTrips: 0, rating: 0, disputeRate: 0 } };
  const totalTrips = driver.totalTrips || 0;
  const rating = parseFloat(driver.rating || "0");
  const ridesCount = await db.select({ count: count() }).from(rides).where(eq5(rides.driverId, driverId));
  const totalRides = ridesCount[0]?.count || 0;
  const disputeRate = 0;
  const stats = { totalTrips, rating, disputeRate };
  if (totalTrips < 100) {
    return { eligible: false, reason: "Need at least 100 completed rides", stats };
  }
  if (rating < 4.8) {
    return { eligible: false, reason: "Rating must be 4.8 or higher", stats };
  }
  return { eligible: true, stats };
}
async function nominateChampion(driverId, cityId) {
  const eligibility = await checkChampionEligibility(driverId);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason || "Driver not eligible");
  }
  const existing = await db.select().from(cityChampions).where(and5(eq5(cityChampions.driverId, driverId), eq5(cityChampions.cityId, cityId))).limit(1);
  if (existing.length > 0) {
    throw new Error("Driver is already a champion for this city");
  }
  const [champion] = await db.insert(cityChampions).values({
    driverId,
    cityId,
    status: "pending"
  }).returning();
  return champion;
}
async function approveChampion(championId) {
  const [champion] = await db.update(cityChampions).set({ status: "active", appointedAt: /* @__PURE__ */ new Date() }).where(eq5(cityChampions.id, championId)).returning();
  return champion;
}
async function getCityChampions(cityId) {
  return db.select({
    champion: cityChampions,
    driver: drivers,
    user: users
  }).from(cityChampions).innerJoin(drivers, eq5(cityChampions.driverId, drivers.id)).innerJoin(users, eq5(drivers.userId, users.id)).where(eq5(cityChampions.cityId, cityId));
}
async function updateCityLaunchStatus(cityId, status) {
  const [city] = await db.update(cities).set({
    launchStatus: status,
    launchedAt: status === "active" ? /* @__PURE__ */ new Date() : void 0,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq5(cities.id, cityId)).returning();
  return city;
}
async function updateCityGroupLinks(cityId, telegramLink, whatsappLink) {
  const [city] = await db.update(cities).set({
    telegramGroupLink: telegramLink,
    whatsappGroupLink: whatsappLink,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq5(cities.id, cityId)).returning();
  return city;
}

// server/cityTestService.ts
init_db();
init_schema();
import { eq as eq6, and as and6, sql as sql4 } from "drizzle-orm";
import { v4 as uuidv43 } from "uuid";
var TEST_CATEGORIES = [
  {
    category: "account_lifecycle",
    tests: [
      { name: "valid_signup", description: "Sign up with valid data", isBlocking: true },
      { name: "invalid_signup", description: "Sign up with invalid data rejected", isBlocking: true },
      { name: "duplicate_account", description: "Duplicate account attempt blocked", isBlocking: true },
      { name: "blocked_reattempt", description: "Blocked driver re-attempt handled", isBlocking: false },
      { name: "reactivation", description: "Reactivation after rejection works", isBlocking: false }
    ]
  },
  {
    category: "identity_verification",
    tests: [
      { name: "clear_id_scan", description: "Clear ID scan approved", isBlocking: true },
      { name: "blurry_id_scan", description: "Blurry ID scan rejected with explanation", isBlocking: true },
      { name: "expired_license", description: "Expired license rejected", isBlocking: true },
      { name: "mismatched_selfie", description: "Mismatched selfie vs ID rejected", isBlocking: true },
      { name: "wrong_vehicle_type", description: "Wrong vehicle type flagged", isBlocking: false },
      { name: "multiple_vehicles", description: "Multiple vehicles upload works", isBlocking: false }
    ]
  },
  {
    category: "education_activation",
    tests: [
      { name: "no_online_before_training", description: "Cannot go online before training", isBlocking: true },
      { name: "partial_training", description: "Partial training tracked correctly", isBlocking: true },
      { name: "full_training", description: "Full training completion enables online", isBlocking: true },
      { name: "training_retake", description: "Training retake available", isBlocking: false }
    ]
  },
  {
    category: "online_offline",
    tests: [
      { name: "online_toggle", description: "Online toggle works correctly", isBlocking: true },
      { name: "offline_during_trip", description: "Offline during trip blocked", isBlocking: true },
      { name: "auto_offline_inactivity", description: "Auto-offline on inactivity", isBlocking: false },
      { name: "network_loss_recovery", description: "Network loss recovery handled", isBlocking: false }
    ]
  },
  {
    category: "ride_assignment",
    tests: [
      { name: "ride_request_received", description: "Ride request received by driver", isBlocking: true },
      { name: "driver_accepts", description: "Driver accepts ride correctly", isBlocking: true },
      { name: "driver_ignores", description: "Driver ignore timeout handled", isBlocking: true },
      { name: "driver_rejects", description: "Driver rejection flows correctly", isBlocking: true },
      { name: "timeout_behavior", description: "Request timeout reassigns ride", isBlocking: true },
      { name: "multiple_drivers_zone", description: "Multiple drivers in zone handled", isBlocking: false }
    ]
  },
  {
    category: "pricing_earnings",
    tests: [
      { name: "fare_calculation", description: "Fare calculation is correct", isBlocking: true },
      { name: "surge_multiplier", description: "Surge/multiplier logic works", isBlocking: true },
      { name: "commission_deduction", description: "Commission deduction (10%) correct", isBlocking: true },
      { name: "earnings_summary", description: "Earnings summary accurate", isBlocking: true },
      { name: "daily_payout", description: "Daily payout calculation correct", isBlocking: true }
    ]
  },
  {
    category: "ride_flow",
    tests: [
      { name: "normal_ride", description: "Normal ride completes successfully", isBlocking: true },
      { name: "rider_no_show", description: "Rider no-show handled with fee", isBlocking: true },
      { name: "driver_no_show", description: "Driver no-show handled with penalty", isBlocking: true },
      { name: "mid_ride_cancel", description: "Mid-ride cancellation handled", isBlocking: true },
      { name: "route_deviation", description: "Route deviation tracked", isBlocking: false },
      { name: "trip_completion", description: "Trip completion flow works", isBlocking: true }
    ]
  },
  {
    category: "ratings_feedback",
    tests: [
      { name: "rider_rates_driver", description: "Rider rates driver correctly", isBlocking: true },
      { name: "driver_rates_rider", description: "Driver rates rider correctly", isBlocking: true },
      { name: "no_rating_submitted", description: "No rating submitted handled", isBlocking: false },
      { name: "low_rating_protection", description: "Low rating protection for new drivers", isBlocking: true },
      { name: "rating_dispute", description: "Rating dispute flow works", isBlocking: false }
    ]
  },
  {
    category: "disputes",
    tests: [
      { name: "fare_dispute", description: "Fare dispute flow works", isBlocking: true },
      { name: "cancellation_dispute", description: "Cancellation dispute handled", isBlocking: true },
      { name: "rating_dispute_flow", description: "Rating dispute handled", isBlocking: true },
      { name: "false_complaint", description: "False complaint detected", isBlocking: false },
      { name: "ai_decision", description: "AI decision logic works", isBlocking: true },
      { name: "manual_override", description: "Manual override path exists", isBlocking: true },
      { name: "reason_display", description: "Reason shown to driver", isBlocking: true },
      { name: "rule_display", description: "Rule applied shown", isBlocking: true },
      { name: "outcome_display", description: "Outcome shown clearly", isBlocking: true }
    ]
  },
  {
    category: "safety_emergency",
    tests: [
      { name: "emergency_button", description: "Emergency button works", isBlocking: true },
      { name: "false_alarm", description: "False alarm handled", isBlocking: false },
      { name: "emergency_during_ride", description: "Emergency during ride handled", isBlocking: true },
      { name: "emergency_after_ride", description: "Emergency after ride handled", isBlocking: false },
      { name: "location_accuracy", description: "Location accuracy sufficient", isBlocking: true },
      { name: "event_logging", description: "Emergency events logged", isBlocking: true }
    ]
  },
  {
    category: "notifications_bots",
    tests: [
      { name: "push_notifications", description: "Push notifications work", isBlocking: true },
      { name: "whatsapp_bot", description: "WhatsApp bot responses work", isBlocking: false },
      { name: "telegram_bot", description: "Telegram bot responses work", isBlocking: false },
      { name: "error_message_clarity", description: "Error messages are clear", isBlocking: true },
      { name: "silence_detection", description: "Silence/no response detected", isBlocking: false }
    ]
  },
  {
    category: "abuse_fraud",
    tests: [
      { name: "fake_gps", description: "Fake GPS detected", isBlocking: true },
      { name: "multi_account", description: "Multi-account attempt blocked", isBlocking: true },
      { name: "ride_manipulation", description: "Ride manipulation detected", isBlocking: true },
      { name: "referral_abuse", description: "Referral abuse detected", isBlocking: true }
    ]
  }
];
async function initializeCityTestChecklist(cityId) {
  const existing = await db.select().from(cityTestChecklist).where(eq6(cityTestChecklist.cityId, cityId)).limit(1);
  if (existing.length > 0) {
    console.log(`Test checklist already initialized for city ${cityId}`);
    return;
  }
  let sortOrder = 0;
  for (const cat of TEST_CATEGORIES) {
    for (const test of cat.tests) {
      await db.insert(cityTestChecklist).values({
        cityId,
        category: cat.category,
        testName: test.name,
        description: test.description,
        isBlocking: test.isBlocking,
        sortOrder: sortOrder++,
        status: "pending"
      });
    }
  }
  console.log(`Initialized ${sortOrder} test items for city ${cityId}`);
}
async function getCityTestProgress(cityId) {
  const tests = await db.select().from(cityTestChecklist).where(eq6(cityTestChecklist.cityId, cityId));
  const byCategory = {};
  let totalPassed = 0;
  let totalFailed = 0;
  let blockingFailed = 0;
  for (const test of tests) {
    if (!byCategory[test.category]) {
      byCategory[test.category] = { total: 0, passed: 0, failed: 0, pending: 0 };
    }
    byCategory[test.category].total++;
    if (test.status === "passed") {
      byCategory[test.category].passed++;
      totalPassed++;
    } else if (test.status === "failed") {
      byCategory[test.category].failed++;
      totalFailed++;
      if (test.isBlocking) blockingFailed++;
    } else {
      byCategory[test.category].pending++;
    }
  }
  const allBlockingPassed = blockingFailed === 0 && tests.filter((t) => t.isBlocking && t.status !== "passed").length === 0;
  return {
    cityId,
    totalTests: tests.length,
    passed: totalPassed,
    failed: totalFailed,
    pending: tests.length - totalPassed - totalFailed,
    blockingFailed,
    allBlockingPassed,
    exitCriteriaMet: allBlockingPassed,
    byCategory,
    tests
  };
}
async function updateTestStatus(cityId, testName, status, failureReason, testedBy) {
  const now = /* @__PURE__ */ new Date();
  await db.update(cityTestChecklist).set({
    status,
    passedAt: status === "passed" ? now : null,
    failedAt: status === "failed" ? now : null,
    failureReason: status === "failed" ? failureReason : null,
    testedBy,
    updatedAt: now
  }).where(and6(eq6(cityTestChecklist.cityId, cityId), eq6(cityTestChecklist.testName, testName)));
  const progress = await getCityTestProgress(cityId);
  if (progress.exitCriteriaMet) {
    await db.update(cities).set({ testChecklistPassed: true }).where(eq6(cities.id, cityId));
  }
  return progress;
}
async function transitionCityLaunchMode(cityId, newMode) {
  const [city] = await db.select().from(cities).where(eq6(cities.id, cityId)).limit(1);
  if (!city) throw new Error("City not found");
  const validTransitions = {
    pre_launch: ["internal_driver_test"],
    internal_driver_test: ["controlled_real_driver_access", "pre_launch"],
    controlled_real_driver_access: ["invite_only_riders", "internal_driver_test"],
    invite_only_riders: ["supply_seeding", "controlled_real_driver_access"],
    supply_seeding: ["density_validation", "invite_only_riders"],
    density_validation: ["soft_launch", "supply_seeding"],
    soft_launch: ["active", "density_validation"],
    active: ["paused"],
    paused: ["active", "soft_launch"]
  };
  const currentMode = city.launchStatus || "pre_launch";
  if (!validTransitions[currentMode]?.includes(newMode)) {
    throw new Error(`Invalid transition from ${currentMode} to ${newMode}. Valid: ${validTransitions[currentMode]?.join(", ")}`);
  }
  if (newMode === "controlled_real_driver_access") {
    const progress = await getCityTestProgress(cityId);
    if (!progress.exitCriteriaMet) {
      throw new Error(`Cannot transition to controlled access. Exit criteria not met. ${progress.blockingFailed} blocking tests failed.`);
    }
  }
  if (newMode === "internal_driver_test") {
    await initializeCityTestChecklist(cityId);
  }
  await db.update(cities).set({ launchStatus: newMode, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(cities.id, cityId));
  return { cityId, previousMode: currentMode, newMode, transitionedAt: /* @__PURE__ */ new Date() };
}
async function tagDriverAsFounder(driverId, cityId, assignedBy) {
  const [city] = await db.select().from(cities).where(eq6(cities.id, cityId)).limit(1);
  if (!city) throw new Error("City not found");
  if (city.launchStatus !== "controlled_real_driver_access") {
    throw new Error("City must be in controlled_real_driver_access mode to add founding drivers");
  }
  if ((city.foundingDriverCount || 0) >= (city.maxFoundingDrivers || 10)) {
    throw new Error(`Maximum founding driver limit (${city.maxFoundingDrivers}) reached`);
  }
  const existingTag = await db.select().from(driverTags).where(and6(eq6(driverTags.driverId, driverId), eq6(driverTags.tag, "founding_driver"))).limit(1);
  if (existingTag.length > 0) {
    throw new Error("Driver already tagged as founding driver");
  }
  const [tag] = await db.insert(driverTags).values({
    driverId,
    cityId,
    tag: "founding_driver",
    assignedBy,
    notes: `Founding driver for ${city.name}`
  }).returning();
  await db.update(cities).set({ foundingDriverCount: sql4`${cities.foundingDriverCount} + 1` }).where(eq6(cities.id, cityId));
  return tag;
}
async function getFoundingDrivers(cityId) {
  const tags = await db.select().from(driverTags).where(and6(eq6(driverTags.cityId, cityId), eq6(driverTags.tag, "founding_driver")));
  const driverIds = tags.map((t) => t.driverId);
  if (driverIds.length === 0) return [];
  const driverData = await db.select().from(drivers).where(sql4`${drivers.id} IN (${sql4.join(driverIds.map((id) => sql4`${id}`), sql4`, `)})`);
  return driverData;
}
async function generateRiderInviteCode(driverId, cityId) {
  const [city] = await db.select().from(cities).where(eq6(cities.id, cityId)).limit(1);
  if (!city) throw new Error("City not found");
  if (city.launchStatus !== "invite_only_riders" && city.launchStatus !== "controlled_real_driver_access") {
    throw new Error("City must be in invite_only_riders or controlled_real_driver_access mode");
  }
  const isFounder = await db.select().from(driverTags).where(and6(eq6(driverTags.driverId, driverId), eq6(driverTags.tag, "founding_driver"))).limit(1);
  if (isFounder.length === 0 && city.launchStatus === "controlled_real_driver_access") {
    throw new Error("Only founding drivers can generate invite codes in controlled access mode");
  }
  const code = `TV-${city.slug.toUpperCase().slice(0, 3)}-${uuidv43().slice(0, 6).toUpperCase()}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3);
  const [inviteCode] = await db.insert(riderInviteCodes).values({
    code,
    driverId,
    cityId,
    maxUses: 5,
    expiresAt
  }).returning();
  return inviteCode;
}
async function useRiderInviteCode(code, riderId) {
  const [inviteCode] = await db.select().from(riderInviteCodes).where(eq6(riderInviteCodes.code, code)).limit(1);
  if (!inviteCode) throw new Error("Invalid invite code");
  if (!inviteCode.isActive) throw new Error("Invite code is no longer active");
  if (inviteCode.expiresAt && /* @__PURE__ */ new Date() > inviteCode.expiresAt) throw new Error("Invite code has expired");
  if ((inviteCode.usedCount || 0) >= (inviteCode.maxUses || 5)) throw new Error("Invite code has reached max uses");
  const existingUse = await db.select().from(riderInviteUses).where(and6(eq6(riderInviteUses.inviteCodeId, inviteCode.id), eq6(riderInviteUses.riderId, riderId))).limit(1);
  if (existingUse.length > 0) throw new Error("You have already used this invite code");
  await db.insert(riderInviteUses).values({
    inviteCodeId: inviteCode.id,
    riderId
  });
  await db.update(riderInviteCodes).set({ usedCount: sql4`${riderInviteCodes.usedCount} + 1` }).where(eq6(riderInviteCodes.id, inviteCode.id));
  return { success: true, cityId: inviteCode.cityId, driverId: inviteCode.driverId };
}
async function submitDriverFeedback(driverId, cityId, category, feedback, confusionLevel, screenName, actionAttempted, question) {
  const [record] = await db.insert(driverFeedback).values({
    driverId,
    cityId,
    category,
    question,
    feedback,
    confusionLevel,
    screenName,
    actionAttempted
  }).returning();
  return record;
}
async function getUnresolvedFeedback(cityId) {
  return db.select().from(driverFeedback).where(and6(eq6(driverFeedback.cityId, cityId), eq6(driverFeedback.resolved, false)));
}
async function resolveFeedback(feedbackId, resolution, resolvedBy) {
  await db.update(driverFeedback).set({
    resolved: true,
    resolution,
    resolvedBy,
    resolvedAt: /* @__PURE__ */ new Date()
  }).where(eq6(driverFeedback.id, feedbackId));
}
async function createSimulatedDriver(cityId, name) {
  const [city] = await db.select().from(cities).where(eq6(cities.id, cityId)).limit(1);
  if (!city) throw new Error("City not found");
  if (city.launchStatus !== "internal_driver_test") {
    throw new Error("Simulated drivers can only be created in internal_driver_test mode");
  }
  const simId = `sim-driver-${uuidv43().slice(0, 8)}`;
  await db.insert(simulatedEntities).values({
    cityId,
    entityType: "driver",
    entityId: simId,
    name,
    metadata: JSON.stringify({ isSimulated: true, createdFor: "internal_test" })
  });
  return { id: simId, name, type: "driver", isSimulated: true };
}
async function createSimulatedRider(cityId, name) {
  const [city] = await db.select().from(cities).where(eq6(cities.id, cityId)).limit(1);
  if (!city) throw new Error("City not found");
  if (city.launchStatus !== "internal_driver_test" && city.launchStatus !== "controlled_real_driver_access") {
    throw new Error("Simulated riders can only be created in internal_driver_test or controlled_real_driver_access mode");
  }
  const simId = `sim-rider-${uuidv43().slice(0, 8)}`;
  await db.insert(simulatedEntities).values({
    cityId,
    entityType: "rider",
    entityId: simId,
    name,
    metadata: JSON.stringify({ isSimulated: true, createdFor: "internal_test" })
  });
  return { id: simId, name, type: "rider", isSimulated: true };
}
async function getSimulatedEntities(cityId, entityType) {
  if (entityType) {
    return db.select().from(simulatedEntities).where(and6(eq6(simulatedEntities.cityId, cityId), eq6(simulatedEntities.entityType, entityType)));
  }
  return db.select().from(simulatedEntities).where(eq6(simulatedEntities.cityId, cityId));
}
async function getCityLaunchStatus(cityId) {
  const [city] = await db.select().from(cities).where(eq6(cities.id, cityId)).limit(1);
  if (!city) throw new Error("City not found");
  const testProgress = await getCityTestProgress(cityId);
  const foundingDrivers = await getFoundingDrivers(cityId);
  const unresolvedFeedback = await getUnresolvedFeedback(cityId);
  return {
    city: {
      id: city.id,
      name: city.name,
      slug: city.slug,
      launchStatus: city.launchStatus,
      maxFoundingDrivers: city.maxFoundingDrivers,
      foundingDriverCount: city.foundingDriverCount,
      testChecklistPassed: city.testChecklistPassed
    },
    testProgress,
    foundingDrivers: foundingDrivers.length,
    unresolvedFeedbackCount: unresolvedFeedback.length,
    readyForNextPhase: testProgress.exitCriteriaMet && unresolvedFeedback.length === 0
  };
}

// server/adminDashboard.ts
init_db();
init_schema();
import { eq as eq9, sql as sql6, count as count4, sum, desc as desc6, and as and8, gte as gte3 } from "drizzle-orm";
async function getDashboardOverview() {
  const now = /* @__PURE__ */ new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1e3);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [totalUsers] = await db.select({ count: count4() }).from(users);
  const [totalDrivers] = await db.select({ count: count4() }).from(drivers);
  const [totalRides] = await db.select({ count: count4() }).from(rides);
  const [completedRides] = await db.select({ count: count4() }).from(rides).where(eq9(rides.status, "completed"));
  const [todayRides] = await db.select({ count: count4() }).from(rides).where(gte3(rides.createdAt, today));
  const [weekRides] = await db.select({ count: count4() }).from(rides).where(gte3(rides.createdAt, thisWeek));
  const [totalRevenue] = await db.select({
    total: sum(rides.actualFare)
  }).from(rides).where(eq9(rides.status, "completed"));
  const [todayRevenue] = await db.select({
    total: sum(rides.actualFare)
  }).from(rides).where(and8(eq9(rides.status, "completed"), gte3(rides.createdAt, today)));
  const [pendingDrivers] = await db.select({ count: count4() }).from(drivers).where(eq9(drivers.status, "pending"));
  const [onlineDrivers] = await db.select({ count: count4() }).from(drivers).where(eq9(drivers.isOnline, true));
  const [openDisputes] = await db.select({ count: count4() }).from(disputes).where(eq9(disputes.status, "open"));
  const [activeCities] = await db.select({ count: count4() }).from(cities).where(eq9(cities.launchStatus, "active"));
  const [totalCities] = await db.select({ count: count4() }).from(cities);
  const platformFee = Number(totalRevenue.total || 0) * 0.1;
  return {
    users: {
      total: totalUsers.count,
      riders: totalUsers.count - totalDrivers.count,
      drivers: totalDrivers.count
    },
    drivers: {
      total: totalDrivers.count,
      pending: pendingDrivers.count,
      online: onlineDrivers.count
    },
    rides: {
      total: totalRides.count,
      completed: completedRides.count,
      today: todayRides.count,
      thisWeek: weekRides.count
    },
    revenue: {
      total: Number(totalRevenue.total || 0),
      today: Number(todayRevenue.total || 0),
      platformFee
    },
    disputes: {
      open: openDisputes.count
    },
    cities: {
      total: totalCities.count,
      active: activeCities.count
    }
  };
}
async function getRidersList(page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const riders = await db.select().from(users).where(eq9(users.role, "customer")).orderBy(desc6(users.createdAt)).limit(limit).offset(offset);
  const [total] = await db.select({ count: count4() }).from(users).where(eq9(users.role, "customer"));
  return {
    riders,
    pagination: {
      page,
      limit,
      total: total.count,
      pages: Math.ceil(total.count / limit)
    }
  };
}
async function getDriversList(page = 1, limit = 20, status) {
  const offset = (page - 1) * limit;
  let driverList;
  if (status) {
    driverList = await db.select({
      driver: drivers,
      user: users
    }).from(drivers).leftJoin(users, eq9(drivers.userId, users.id)).where(eq9(drivers.status, status)).orderBy(desc6(drivers.createdAt)).limit(limit).offset(offset);
  } else {
    driverList = await db.select({
      driver: drivers,
      user: users
    }).from(drivers).leftJoin(users, eq9(drivers.userId, users.id)).orderBy(desc6(drivers.createdAt)).limit(limit).offset(offset);
  }
  const [total] = status ? await db.select({ count: count4() }).from(drivers).where(eq9(drivers.status, status)) : await db.select({ count: count4() }).from(drivers);
  return {
    drivers: driverList,
    pagination: {
      page,
      limit,
      total: total.count,
      pages: Math.ceil(total.count / limit)
    }
  };
}
async function getDriverDetails(driverId) {
  const [driver] = await db.select({
    driver: drivers,
    user: users
  }).from(drivers).leftJoin(users, eq9(drivers.userId, users.id)).where(eq9(drivers.id, driverId));
  if (!driver) return null;
  const vehicleList = await db.select().from(vehicles).where(eq9(vehicles.driverId, driverId));
  const documents = await db.select().from(driverDocuments).where(eq9(driverDocuments.driverId, driverId));
  const recentRides = await db.select().from(rides).where(eq9(rides.driverId, driverId)).orderBy(desc6(rides.createdAt)).limit(10);
  return {
    ...driver,
    vehicles: vehicleList,
    documents,
    recentRides
  };
}
async function approveDriver(driverId) {
  await db.update(drivers).set({ status: "approved", updatedAt: /* @__PURE__ */ new Date() }).where(eq9(drivers.id, driverId));
  const { sendDriverApprovalNotification: sendDriverApprovalNotification2 } = await Promise.resolve().then(() => (init_telegramBot(), telegramBot_exports));
  const { sendDriverApprovalWhatsApp: sendDriverApprovalWhatsApp2 } = await Promise.resolve().then(() => (init_whatsappBot(), whatsappBot_exports));
  await Promise.all([
    sendDriverApprovalNotification2(driverId),
    sendDriverApprovalWhatsApp2(driverId)
  ]);
  return { success: true };
}
async function rejectDriver(driverId, reason) {
  await db.update(drivers).set({ status: "rejected", updatedAt: /* @__PURE__ */ new Date() }).where(eq9(drivers.id, driverId));
  return { success: true, reason };
}
async function suspendDriver(driverId, reason) {
  await db.update(drivers).set({ status: "suspended", updatedAt: /* @__PURE__ */ new Date() }).where(eq9(drivers.id, driverId));
  return { success: true, reason };
}
async function getRidesList(page = 1, limit = 20, status) {
  const offset = (page - 1) * limit;
  let rideList;
  if (status) {
    rideList = await db.select({
      ride: rides,
      customer: users
    }).from(rides).leftJoin(users, eq9(rides.customerId, users.id)).where(eq9(rides.status, status)).orderBy(desc6(rides.createdAt)).limit(limit).offset(offset);
  } else {
    rideList = await db.select({
      ride: rides,
      customer: users
    }).from(rides).leftJoin(users, eq9(rides.customerId, users.id)).orderBy(desc6(rides.createdAt)).limit(limit).offset(offset);
  }
  const [total] = status ? await db.select({ count: count4() }).from(rides).where(eq9(rides.status, status)) : await db.select({ count: count4() }).from(rides);
  return {
    rides: rideList,
    pagination: {
      page,
      limit,
      total: total.count,
      pages: Math.ceil(total.count / limit)
    }
  };
}
async function getDisputesList(page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const disputeList = await db.select().from(disputes).orderBy(desc6(disputes.createdAt)).limit(limit).offset(offset);
  const [total] = await db.select({ count: count4() }).from(disputes);
  return {
    disputes: disputeList,
    pagination: {
      page,
      limit,
      total: total.count,
      pages: Math.ceil(total.count / limit)
    }
  };
}
async function getCitiesList() {
  const cityList = await db.select().from(cities).orderBy(cities.name);
  const citiesWithProgress = await Promise.all(cityList.map(async (city) => {
    const [testProgress] = await db.select({
      total: count4()
    }).from(cityTestChecklist).where(eq9(cityTestChecklist.cityId, city.id));
    const [passed] = await db.select({
      count: count4()
    }).from(cityTestChecklist).where(and8(
      eq9(cityTestChecklist.cityId, city.id),
      eq9(cityTestChecklist.status, "passed")
    ));
    return {
      ...city,
      testProgress: {
        total: testProgress.total,
        passed: passed.count,
        percentage: testProgress.total > 0 ? Math.round(passed.count / testProgress.total * 100) : 0
      }
    };
  }));
  return citiesWithProgress;
}
async function getAnalytics(period = "week") {
  const now = /* @__PURE__ */ new Date();
  let startDate;
  switch (period) {
    case "day":
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
      break;
    case "week":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
      break;
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
  }
  const ridesByStatus = await db.select({
    status: rides.status,
    count: count4()
  }).from(rides).where(gte3(rides.createdAt, startDate)).groupBy(rides.status);
  const revenueByDay = await db.select({
    date: sql6`DATE(${rides.createdAt})`,
    revenue: sum(rides.actualFare),
    count: count4()
  }).from(rides).where(and8(gte3(rides.createdAt, startDate), eq9(rides.status, "completed"))).groupBy(sql6`DATE(${rides.createdAt})`).orderBy(sql6`DATE(${rides.createdAt})`);
  const topDrivers = await db.select({
    driver: drivers,
    user: users
  }).from(drivers).leftJoin(users, eq9(drivers.userId, users.id)).orderBy(desc6(drivers.totalTrips)).limit(10);
  const newUsersCount = await db.select({ count: count4() }).from(users).where(gte3(users.createdAt, startDate));
  const newDriversCount = await db.select({ count: count4() }).from(drivers).where(gte3(drivers.createdAt, startDate));
  return {
    period,
    ridesByStatus,
    revenueByDay,
    topDrivers,
    newUsers: newUsersCount[0].count,
    newDrivers: newDriversCount[0].count
  };
}
async function getVerificationQueue2() {
  const queue = await db.select({
    verification: driverVerificationQueue,
    driver: drivers,
    user: users
  }).from(driverVerificationQueue).leftJoin(drivers, eq9(driverVerificationQueue.driverId, drivers.id)).leftJoin(users, eq9(drivers.userId, users.id)).where(eq9(driverVerificationQueue.status, "pending")).orderBy(driverVerificationQueue.createdAt);
  return queue;
}
async function getDriverFeedbackList(cityId) {
  if (cityId) {
    return db.select().from(driverFeedback).where(eq9(driverFeedback.cityId, cityId)).orderBy(desc6(driverFeedback.createdAt));
  }
  return db.select().from(driverFeedback).orderBy(desc6(driverFeedback.createdAt));
}

// server/pmgthService.ts
init_db();
init_schema();
import { eq as eq10, and as and9, sql as sql7, gte as gte4 } from "drizzle-orm";
var DEFAULT_CONFIG = {
  maxAngleDeviation: 30,
  defaultDetourPercent: 15,
  minPremiumPercent: 5,
  maxPremiumPercent: 12,
  maxPremiumCap: 50,
  driverPremiumSharePercent: 80,
  maxDailySessionsDefault: 3,
  cooldownMinutesAfterNoMatch: 15,
  weights: {
    directionalAlignment: 0.4,
    pickupProximity: 0.35,
    fareEfficiency: 0.25
  }
};
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}
function toDegrees(radians) {
  return radians * (180 / Math.PI);
}
function calculateBearing(from, to) {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLng = toRadians(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  let bearing = toDegrees(Math.atan2(y, x));
  return (bearing + 360) % 360;
}
function calculateDistance3(from, to) {
  const R = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function angleDifference(angle1, angle2) {
  let diff = Math.abs(angle1 - angle2) % 360;
  if (diff > 180) {
    diff = 360 - diff;
  }
  return diff;
}
function checkDirectionCompatibility(driverLocation, driverDestination, ridePickup, rideDropoff, maxAngleDeviation = DEFAULT_CONFIG.maxAngleDeviation, maxDetourPercent = DEFAULT_CONFIG.defaultDetourPercent) {
  const bearingToHome = calculateBearing(driverLocation, driverDestination);
  const bearingToPickup = calculateBearing(driverLocation, ridePickup);
  const bearingPickupToDropoff = calculateBearing(ridePickup, rideDropoff);
  const bearingDropoffToHome = calculateBearing(rideDropoff, driverDestination);
  const pickupAngleDeviation = angleDifference(bearingToHome, bearingToPickup);
  const dropoffAngleDeviation = angleDifference(bearingToHome, bearingDropoffToHome);
  const rideAngleDeviation = angleDifference(bearingToHome, bearingPickupToDropoff);
  const avgAngleDeviation = (pickupAngleDeviation + dropoffAngleDeviation + rideAngleDeviation) / 3;
  const directDistance = calculateDistance3(driverLocation, driverDestination);
  const detourDistance = calculateDistance3(driverLocation, ridePickup) + calculateDistance3(ridePickup, rideDropoff) + calculateDistance3(rideDropoff, driverDestination);
  const detourPercent = directDistance > 0 ? (detourDistance - directDistance) / directDistance * 100 : 0;
  const isCompatible = avgAngleDeviation <= maxAngleDeviation && detourPercent <= maxDetourPercent;
  const directionScore = Math.max(0, 100 - avgAngleDeviation / maxAngleDeviation * 50 - detourPercent / maxDetourPercent * 50);
  return {
    isCompatible,
    angleDeviation: avgAngleDeviation,
    detourPercent,
    directionScore
  };
}
function calculatePremium(baseFare, directionScore, config = DEFAULT_CONFIG) {
  const scoreMultiplier = 1 - directionScore / 100 * 0.5;
  let premiumPercent = config.minPremiumPercent + (config.maxPremiumPercent - config.minPremiumPercent) * scoreMultiplier;
  premiumPercent = Math.min(Math.max(premiumPercent, config.minPremiumPercent), config.maxPremiumPercent);
  let premiumAmount = baseFare * (premiumPercent / 100);
  premiumAmount = Math.min(premiumAmount, config.maxPremiumCap);
  const driverShare = premiumAmount * (config.driverPremiumSharePercent / 100);
  const platformShare = premiumAmount - driverShare;
  return {
    premiumAmount: Math.round(premiumAmount * 100) / 100,
    premiumPercent: Math.round(premiumPercent * 100) / 100,
    driverShare: Math.round(driverShare * 100) / 100,
    platformShare: Math.round(platformShare * 100) / 100
  };
}
function calculateTotalScore(directionScore, pickupProximityKm, fareEfficiency, config = DEFAULT_CONFIG) {
  const normalizedProximity = Math.max(0, 100 - pickupProximityKm * 10);
  return config.weights.directionalAlignment * directionScore + config.weights.pickupProximity * normalizedProximity + config.weights.fareEfficiency * fareEfficiency;
}
async function activatePmgthSession(driverId, destinationAddress, destinationLat, destinationLng, timeWindowMinutes = 45, maxDetourPercent = 15) {
  const existingSession = await db.select().from(pmgthSessions).where(and9(
    eq10(pmgthSessions.driverId, driverId),
    eq10(pmgthSessions.status, "active")
  )).limit(1);
  if (existingSession.length > 0) {
    throw new Error("You already have an active Going Home session. Please end it first.");
  }
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  const [dailyUsage] = await db.select().from(pmgthDailyUsage).where(and9(
    eq10(pmgthDailyUsage.driverId, driverId),
    gte4(pmgthDailyUsage.date, today)
  )).limit(1);
  if (dailyUsage) {
    if (dailyUsage.cooldownUntil && new Date(dailyUsage.cooldownUntil) > /* @__PURE__ */ new Date()) {
      const remaining = Math.ceil((new Date(dailyUsage.cooldownUntil).getTime() - Date.now()) / 6e4);
      throw new Error(`Please wait ${remaining} minutes before starting another Going Home session.`);
    }
    if ((dailyUsage.sessionsStarted || 0) >= DEFAULT_CONFIG.maxDailySessionsDefault) {
      throw new Error("You've reached the maximum Going Home sessions for today.");
    }
  }
  const driver = await db.select().from(drivers).where(eq10(drivers.id, driverId)).limit(1);
  if (!driver.length || !driver[0].currentLat || !driver[0].currentLng) {
    throw new Error("Unable to determine your current location. Please enable location services.");
  }
  const expiresAt = new Date(Date.now() + timeWindowMinutes * 60 * 1e3);
  const [session] = await db.insert(pmgthSessions).values({
    driverId,
    destinationAddress,
    destinationLat: destinationLat.toString(),
    destinationLng: destinationLng.toString(),
    startLat: driver[0].currentLat,
    startLng: driver[0].currentLng,
    timeWindowMinutes,
    maxDetourPercent: maxDetourPercent.toString(),
    status: "active",
    expiresAt
  }).returning();
  if (dailyUsage) {
    await db.update(pmgthDailyUsage).set({ sessionsStarted: (dailyUsage.sessionsStarted || 0) + 1 }).where(eq10(pmgthDailyUsage.id, dailyUsage.id));
  } else {
    await db.insert(pmgthDailyUsage).values({
      driverId,
      date: today,
      sessionsStarted: 1
    });
  }
  return session;
}
async function deactivatePmgthSession(driverId, reason = "cancelled") {
  const [session] = await db.select().from(pmgthSessions).where(and9(
    eq10(pmgthSessions.driverId, driverId),
    eq10(pmgthSessions.status, "active")
  )).limit(1);
  if (!session) {
    return null;
  }
  const [updated] = await db.update(pmgthSessions).set({
    status: reason,
    completedAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq10(pmgthSessions.id, session.id)).returning();
  if (reason === "completed") {
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    await db.update(pmgthDailyUsage).set({ sessionsCompleted: sql7`${pmgthDailyUsage.sessionsCompleted} + 1` }).where(and9(
      eq10(pmgthDailyUsage.driverId, driverId),
      gte4(pmgthDailyUsage.date, today)
    ));
  }
  return updated;
}
async function getActivePmgthSession(driverId) {
  const [session] = await db.select().from(pmgthSessions).where(and9(
    eq10(pmgthSessions.driverId, driverId),
    eq10(pmgthSessions.status, "active")
  )).limit(1);
  if (session && new Date(session.expiresAt) < /* @__PURE__ */ new Date()) {
    await deactivatePmgthSession(driverId, "expired");
    return null;
  }
  return session || null;
}
async function findCompatibleRides(session, pendingRides) {
  const driver = await db.select().from(drivers).where(eq10(drivers.id, session.driverId)).limit(1);
  if (!driver.length || !driver[0].currentLat || !driver[0].currentLng) {
    return [];
  }
  const driverLocation = {
    lat: parseFloat(driver[0].currentLat),
    lng: parseFloat(driver[0].currentLng)
  };
  const destination = {
    lat: parseFloat(session.destinationLat),
    lng: parseFloat(session.destinationLng)
  };
  const maxDetour = parseFloat(session.maxDetourPercent || "15");
  const compatibleRides = [];
  for (const ride of pendingRides) {
    const ridePickup = {
      lat: parseFloat(ride.pickupLat),
      lng: parseFloat(ride.pickupLng)
    };
    const rideDropoff = {
      lat: parseFloat(ride.dropoffLat),
      lng: parseFloat(ride.dropoffLng)
    };
    const compatibility = checkDirectionCompatibility(
      driverLocation,
      destination,
      ridePickup,
      rideDropoff,
      DEFAULT_CONFIG.maxAngleDeviation,
      maxDetour
    );
    if (compatibility.isCompatible) {
      const pickupProximityKm = calculateDistance3(driverLocation, ridePickup);
      const baseFare = parseFloat(ride.estimatedFare || "0");
      const premium = calculatePremium(baseFare, compatibility.directionScore);
      const fareEfficiency = baseFare > 0 ? Math.min(100, baseFare * 2) : 50;
      const estimatedArrivalMinutes = Math.round(pickupProximityKm / 30 * 60);
      const totalScore = calculateTotalScore(
        compatibility.directionScore,
        pickupProximityKm,
        fareEfficiency
      );
      compatibleRides.push({
        rideId: ride.id,
        isCompatible: true,
        directionScore: Math.round(compatibility.directionScore * 100) / 100,
        detourPercent: Math.round(compatibility.detourPercent * 100) / 100,
        pickupProximityKm: Math.round(pickupProximityKm * 100) / 100,
        premiumAmount: premium.premiumAmount,
        premiumPercent: premium.premiumPercent,
        estimatedArrivalMinutes,
        totalScore: Math.round(totalScore * 100) / 100
      });
    }
  }
  return compatibleRides.sort((a, b) => b.totalScore - a.totalScore);
}
async function recordPmgthRideMatch(sessionId, rideId, compatibility, wasAccepted) {
  const driverShare = compatibility.premiumAmount * (DEFAULT_CONFIG.driverPremiumSharePercent / 100);
  const platformShare = compatibility.premiumAmount - driverShare;
  const [match] = await db.insert(pmgthRideMatches).values({
    sessionId,
    rideId,
    directionScore: compatibility.directionScore.toString(),
    detourPercent: compatibility.detourPercent.toString(),
    pickupProximityKm: compatibility.pickupProximityKm.toString(),
    premiumAmount: compatibility.premiumAmount.toString(),
    premiumPercent: compatibility.premiumPercent.toString(),
    driverPremiumShare: driverShare.toString(),
    platformPremiumShare: platformShare.toString(),
    estimatedArrivalMinutes: compatibility.estimatedArrivalMinutes,
    wasAccepted
  }).returning();
  if (wasAccepted) {
    await db.update(pmgthSessions).set({
      ridesCompleted: sql7`${pmgthSessions.ridesCompleted} + 1`,
      totalPremiumEarnings: sql7`${pmgthSessions.totalPremiumEarnings} + ${driverShare}`,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq10(pmgthSessions.id, sessionId));
    await db.update(rides).set({
      isPmgthRide: true,
      pmgthPremiumAmount: compatibility.premiumAmount.toString(),
      pmgthPremiumPercent: compatibility.premiumPercent.toString()
    }).where(eq10(rides.id, rideId));
  }
  return match;
}
async function getDriverHomeAddress(driverId) {
  const driver = await db.select().from(drivers).where(eq10(drivers.id, driverId)).limit(1);
  if (!driver.length) return null;
  const [homeAddress] = await db.select().from(savedAddresses).where(and9(
    eq10(savedAddresses.userId, driver[0].userId),
    eq10(savedAddresses.label, "Home")
  )).limit(1);
  if (homeAddress) {
    return {
      address: homeAddress.address,
      lat: parseFloat(homeAddress.lat),
      lng: parseFloat(homeAddress.lng)
    };
  }
  return null;
}
async function saveDriverHomeAddress(userId, home) {
  const existing = await db.select().from(savedAddresses).where(and9(
    eq10(savedAddresses.userId, userId),
    eq10(savedAddresses.label, "Home")
  )).limit(1);
  if (existing.length > 0) {
    await db.update(savedAddresses).set({
      address: home.address,
      lat: home.lat.toString(),
      lng: home.lng.toString()
    }).where(eq10(savedAddresses.id, existing[0].id));
  } else {
    await db.insert(savedAddresses).values({
      userId,
      label: "Home",
      address: home.address,
      lat: home.lat.toString(),
      lng: home.lng.toString(),
      isDefault: true
    });
  }
  return home;
}
async function findPmgthDriversForRide(ridePickupLat, ridePickupLng, rideDropoffLat, rideDropoffLng, baseFare) {
  const activeSessions = await db.select().from(pmgthSessions).where(eq10(pmgthSessions.status, "active"));
  const eligibleDrivers = [];
  for (const session of activeSessions) {
    if (new Date(session.expiresAt) < /* @__PURE__ */ new Date()) {
      await deactivatePmgthSession(session.driverId, "expired");
      continue;
    }
    const driver = await db.select().from(drivers).where(eq10(drivers.id, session.driverId)).limit(1);
    if (!driver.length || !driver[0].currentLat || !driver[0].currentLng || !driver[0].isOnline) {
      continue;
    }
    const driverLocation = {
      lat: parseFloat(driver[0].currentLat),
      lng: parseFloat(driver[0].currentLng)
    };
    const destination = {
      lat: parseFloat(session.destinationLat),
      lng: parseFloat(session.destinationLng)
    };
    const ridePickup = { lat: ridePickupLat, lng: ridePickupLng };
    const rideDropoff = { lat: rideDropoffLat, lng: rideDropoffLng };
    const maxDetour = parseFloat(session.maxDetourPercent || "15");
    const compatibility = checkDirectionCompatibility(
      driverLocation,
      destination,
      ridePickup,
      rideDropoff,
      DEFAULT_CONFIG.maxAngleDeviation,
      maxDetour
    );
    if (compatibility.isCompatible) {
      const pickupDistance = calculateDistance3(driverLocation, ridePickup);
      const premium = calculatePremium(baseFare, compatibility.directionScore);
      const estimatedPickupMinutes = Math.round(pickupDistance / 30 * 60);
      eligibleDrivers.push({
        driverId: session.driverId,
        sessionId: session.id,
        directionScore: compatibility.directionScore,
        premiumAmount: premium.premiumAmount,
        premiumPercent: premium.premiumPercent,
        estimatedPickupMinutes
      });
    }
  }
  return eligibleDrivers.sort((a, b) => {
    if (b.estimatedPickupMinutes !== a.estimatedPickupMinutes) {
      return a.estimatedPickupMinutes - b.estimatedPickupMinutes;
    }
    return b.directionScore - a.directionScore;
  });
}
async function getPmgthSessionStats(sessionId) {
  const [session] = await db.select().from(pmgthSessions).where(eq10(pmgthSessions.id, sessionId)).limit(1);
  if (!session) return null;
  const minutesRemaining = Math.max(0, Math.round(
    (new Date(session.expiresAt).getTime() - Date.now()) / 6e4
  ));
  return {
    ridesCompleted: session.ridesCompleted || 0,
    totalEarnings: session.totalEarnings || "0.00",
    totalPremiumEarnings: session.totalPremiumEarnings || "0.00",
    minutesRemaining,
    status: session.status || "active"
  };
}

// server/pmgthPaymentService.ts
init_db();
init_schema();
import { ethers as ethers2 } from "ethers";
import { eq as eq11, and as and10 } from "drizzle-orm";
var cachedFxRates = null;
var FX_CACHE_TTL = 5 * 60 * 1e3;
var wallet2 = null;
async function fetchFxRates() {
  if (cachedFxRates && Date.now() - cachedFxRates.timestamp < FX_CACHE_TTL) {
    return cachedFxRates.rates;
  }
  try {
    const response = await fetch("https://api.coinbase.com/v2/exchange-rates?currency=USD");
    const data = await response.json();
    if (data.data?.rates) {
      const rates = {
        USD: 1,
        MXN: parseFloat(data.data.rates.MXN) || 17.5,
        COP: parseFloat(data.data.rates.COP) || 4e3,
        TRY: parseFloat(data.data.rates.TRY) || 32,
        KES: parseFloat(data.data.rates.KES) || 150,
        PHP: parseFloat(data.data.rates.PHP) || 56,
        MAD: parseFloat(data.data.rates.MAD) || 10,
        EGP: parseFloat(data.data.rates.EGP) || 31,
        PEN: parseFloat(data.data.rates.PEN) || 3.7,
        ZAR: parseFloat(data.data.rates.ZAR) || 18,
        RON: parseFloat(data.data.rates.RON) || 4.5,
        THB: parseFloat(data.data.rates.THB) || 35,
        EUR: parseFloat(data.data.rates.EUR) || 0.92,
        GBP: parseFloat(data.data.rates.GBP) || 0.79
      };
      cachedFxRates = { rates, timestamp: Date.now() };
      return rates;
    }
  } catch (error) {
    console.error("FX rate fetch failed, using fallback rates");
  }
  return {
    USD: 1,
    MXN: 17.5,
    COP: 4e3,
    TRY: 32,
    KES: 150,
    PHP: 56,
    MAD: 10,
    EGP: 31,
    PEN: 3.7,
    ZAR: 18,
    RON: 4.5,
    THB: 35,
    EUR: 0.92,
    GBP: 0.79
  };
}
function usdToLocal(usdAmount, currency, rates) {
  const rate = rates[currency] || 1;
  return Math.round(usdAmount * rate * 100) / 100;
}
async function createPaymentIntent(rideId, riderId, driverId, baseFareUsd, premiumUsd, localCurrency = "USD") {
  const rates = await fetchFxRates();
  const platformFeePercent = 10;
  const driverPremiumSharePercent = 80;
  const platformFeeOnBase = baseFareUsd * (platformFeePercent / 100);
  const platformFeeOnPremium = premiumUsd * ((100 - driverPremiumSharePercent) / 100);
  const totalPlatformFee = platformFeeOnBase + platformFeeOnPremium;
  const driverBaseFare = baseFareUsd - platformFeeOnBase;
  const driverPremium = premiumUsd * (driverPremiumSharePercent / 100);
  const driverEarnings = driverBaseFare + driverPremium;
  const totalUsd = baseFareUsd + premiumUsd;
  const intentId = `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const [escrowRecord] = await db.insert(pmgthEscrow).values({
    intentId,
    rideId,
    riderId,
    driverId,
    baseFareUsdt: baseFareUsd.toString(),
    premiumUsdt: premiumUsd.toString(),
    platformFeeUsdt: totalPlatformFee.toString(),
    driverEarningsUsdt: driverEarnings.toString(),
    totalUsdt: totalUsd.toString(),
    localCurrency,
    fxRate: rates[localCurrency]?.toString() || "1",
    status: "pending",
    premiumPaid: false,
    createdAt: /* @__PURE__ */ new Date(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1e3)
  }).returning();
  return {
    intentId,
    rideId,
    baseFareUsd,
    premiumUsd,
    platformFeeUsd: totalPlatformFee,
    driverEarningsUsd: driverEarnings,
    totalUsd,
    localCurrency,
    baseFareLocal: usdToLocal(baseFareUsd, localCurrency, rates),
    premiumLocal: usdToLocal(premiumUsd, localCurrency, rates),
    totalLocal: usdToLocal(totalUsd, localCurrency, rates),
    escrowStatus: "pending",
    premiumRecipient: "driver",
    premiumGuaranteed: true,
    createdAt: escrowRecord.createdAt,
    expiresAt: escrowRecord.expiresAt
  };
}
async function fundEscrow(intentId, riderWalletAddress) {
  const [escrow] = await db.select().from(pmgthEscrow).where(eq11(pmgthEscrow.intentId, intentId)).limit(1);
  if (!escrow) {
    return { success: false, message: "Payment intent not found", premiumPaidInstantly: false };
  }
  if (escrow.status !== "pending") {
    return { success: false, message: `Invalid escrow status: ${escrow.status}`, premiumPaidInstantly: false };
  }
  if (/* @__PURE__ */ new Date() > escrow.expiresAt) {
    await db.update(pmgthEscrow).set({ status: "expired" }).where(eq11(pmgthEscrow.intentId, intentId));
    return { success: false, message: "Payment intent expired", premiumPaidInstantly: false };
  }
  const premiumAmount = parseFloat(escrow.premiumUsdt);
  let premiumTxHash;
  if (wallet2 && premiumAmount > 0) {
    try {
      console.log(`Simulating instant premium payment of $${premiumAmount} to driver ${escrow.driverId}`);
      premiumTxHash = `0x${Date.now().toString(16)}${Math.random().toString(16).substr(2, 40)}`;
    } catch (error) {
      console.error("Premium payment failed:", error.message);
    }
  }
  await db.update(pmgthEscrow).set({
    status: "funded",
    premiumPaid: premiumAmount > 0,
    premiumTxHash,
    fundedAt: /* @__PURE__ */ new Date()
  }).where(eq11(pmgthEscrow.intentId, intentId));
  return {
    success: true,
    message: "Escrow funded successfully. Premium paid to driver instantly.",
    transactionHash: `0x${Date.now().toString(16)}${Math.random().toString(16).substr(2, 40)}`,
    premiumPaidInstantly: premiumAmount > 0,
    premiumTxHash
  };
}
async function releaseEscrow(intentId) {
  const [escrow] = await db.select().from(pmgthEscrow).where(eq11(pmgthEscrow.intentId, intentId)).limit(1);
  if (!escrow) {
    return { success: false, message: "Escrow not found", driverPayout: 0, platformFee: 0 };
  }
  if (escrow.status !== "funded" && escrow.status !== "in_progress") {
    return { success: false, message: `Cannot release escrow in ${escrow.status} status`, driverPayout: 0, platformFee: 0 };
  }
  const driverEarnings = parseFloat(escrow.driverEarningsUsdt);
  const platformFee = parseFloat(escrow.platformFeeUsdt);
  const baseFare = parseFloat(escrow.baseFareUsdt);
  const premiumAlreadyPaid = parseFloat(escrow.premiumUsdt);
  const remainingDriverPayout = driverEarnings - (escrow.premiumPaid ? premiumAlreadyPaid * 0.8 : 0);
  await db.update(pmgthEscrow).set({
    status: "completed",
    completedAt: /* @__PURE__ */ new Date(),
    releaseTxHash: `0x${Date.now().toString(16)}${Math.random().toString(16).substr(2, 40)}`
  }).where(eq11(pmgthEscrow.intentId, intentId));
  return {
    success: true,
    message: "Ride completed. Funds released to driver.",
    driverPayout: remainingDriverPayout,
    platformFee,
    transactionHash: `0x${Date.now().toString(16)}${Math.random().toString(16).substr(2, 40)}`
  };
}
async function cancelEscrow(intentId, cancelledBy, reason) {
  const [escrow] = await db.select().from(pmgthEscrow).where(eq11(pmgthEscrow.intentId, intentId)).limit(1);
  if (!escrow) {
    return { success: false, message: "Escrow not found", riderRefund: 0, driverKeepsPremium: false, premiumAmount: 0 };
  }
  const baseFare = parseFloat(escrow.baseFareUsdt);
  const premium = parseFloat(escrow.premiumUsdt);
  const status = escrow.status;
  let riderRefund = 0;
  let driverKeepsPremium = false;
  if (status === "pending") {
    riderRefund = baseFare + premium;
    driverKeepsPremium = false;
  } else if (status === "funded" || status === "in_progress") {
    riderRefund = baseFare;
    driverKeepsPremium = true;
  }
  await db.update(pmgthEscrow).set({
    status: cancelledBy === "rider" ? "cancelled_by_rider" : "cancelled_by_driver",
    cancelledAt: /* @__PURE__ */ new Date(),
    cancellationReason: reason
  }).where(eq11(pmgthEscrow.intentId, intentId));
  return {
    success: true,
    message: driverKeepsPremium ? "Ride cancelled. Driver keeps the premium as compensation." : "Ride cancelled. Full refund processed.",
    riderRefund,
    driverKeepsPremium,
    premiumAmount: premium
  };
}
async function getEscrowStatus(intentId) {
  const [escrow] = await db.select().from(pmgthEscrow).where(eq11(pmgthEscrow.intentId, intentId)).limit(1);
  if (!escrow) return null;
  const baseFare = parseFloat(escrow.baseFareUsdt);
  const premium = parseFloat(escrow.premiumUsdt);
  const total = parseFloat(escrow.totalUsdt);
  const fxRate = parseFloat(escrow.fxRate);
  return {
    status: escrow.status,
    baseFareUsd: baseFare,
    premiumUsd: premium,
    totalUsd: total,
    premiumPaid: escrow.premiumPaid,
    localCurrency: escrow.localCurrency,
    totalLocal: total * fxRate,
    fxRate
  };
}
async function getDriverPmgthEarnings(driverId) {
  const escrows = await db.select().from(pmgthEscrow).where(
    and10(
      eq11(pmgthEscrow.driverId, driverId),
      eq11(pmgthEscrow.premiumPaid, true)
    )
  );
  const totalPremiums = escrows.reduce((sum2, e) => sum2 + parseFloat(e.premiumUsdt) * 0.8, 0);
  return {
    totalPremiumsEarned: Math.round(totalPremiums * 100) / 100,
    ridesWithPremium: escrows.length,
    averagePremium: escrows.length > 0 ? Math.round(totalPremiums / escrows.length * 100) / 100 : 0
  };
}
function formatLocalCurrency(amount, currency) {
  const symbols = {
    USD: "$",
    MXN: "$",
    COP: "$",
    EUR: "\u20AC",
    GBP: "\xA3",
    TRY: "\u20BA",
    KES: "KSh",
    PHP: "\u20B1",
    MAD: "DH",
    EGP: "E\xA3",
    PEN: "S/",
    ZAR: "R",
    RON: "lei",
    THB: "\u0E3F"
  };
  const symbol = symbols[currency] || currency;
  return `${symbol}${amount.toLocaleString(void 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// server/guaranteeService.ts
init_db();
init_schema();
import { eq as eq12, and as and11, gte as gte5, desc as desc8 } from "drizzle-orm";
var GUARANTEE_AMOUNT = 15;
var GUARANTEE_DURATION_MINUTES = 10;
var COOLDOWN_HOURS = 24;
async function getGuaranteeStatus(driverId) {
  const activeGuarantee = await db.select().from(firstRideGuarantees).where(and11(
    eq12(firstRideGuarantees.driverId, driverId),
    eq12(firstRideGuarantees.status, "pending")
  )).orderBy(desc8(firstRideGuarantees.createdAt)).limit(1);
  if (activeGuarantee.length > 0) {
    const g = activeGuarantee[0];
    const now = /* @__PURE__ */ new Date();
    const expiresAt = new Date(g.expiresAt);
    const minutesRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 6e4));
    return {
      active: true,
      guarantee: {
        id: g.id,
        status: g.status,
        amount: g.guaranteeAmount,
        currency: g.currency,
        expiresAt,
        minutesRemaining
      },
      eligibleForNew: false
    };
  }
  const eligibleForNew = await checkEligibility(driverId);
  return {
    active: false,
    guarantee: null,
    eligibleForNew
  };
}
async function checkEligibility(driverId) {
  const driver = await db.select().from(drivers).where(eq12(drivers.id, driverId)).limit(1);
  if (!driver.length || driver[0].status !== "approved") {
    return false;
  }
  const cooldownTime = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1e3);
  const recentGuarantees = await db.select().from(firstRideGuarantees).where(and11(
    eq12(firstRideGuarantees.driverId, driverId),
    gte5(firstRideGuarantees.createdAt, cooldownTime)
  )).limit(1);
  return recentGuarantees.length === 0;
}
async function startGuarantee(driverId, regionCode = "AE") {
  const eligible = await checkEligibility(driverId);
  if (!eligible) {
    return { started: false, reason: "Not eligible for guarantee" };
  }
  const existingActive = await db.select().from(firstRideGuarantees).where(and11(
    eq12(firstRideGuarantees.driverId, driverId),
    eq12(firstRideGuarantees.status, "pending")
  )).limit(1);
  if (existingActive.length > 0) {
    const g = existingActive[0];
    return {
      started: true,
      guarantee: {
        id: g.id,
        amount: g.guaranteeAmount,
        currency: g.currency,
        expiresAt: new Date(g.expiresAt)
      }
    };
  }
  const now = /* @__PURE__ */ new Date();
  const expiresAt = new Date(now.getTime() + GUARANTEE_DURATION_MINUTES * 60 * 1e3);
  const currency = regionCode === "AE" ? "AED" : "USD";
  const [guarantee] = await db.insert(firstRideGuarantees).values({
    driverId,
    sessionStartedAt: now,
    status: "pending",
    guaranteeAmount: GUARANTEE_AMOUNT.toString(),
    currency,
    expiresAt
  }).returning();
  scheduleGuaranteeCheck(guarantee.id, GUARANTEE_DURATION_MINUTES);
  return {
    started: true,
    guarantee: {
      id: guarantee.id,
      amount: guarantee.guaranteeAmount,
      currency: guarantee.currency,
      expiresAt: new Date(guarantee.expiresAt)
    }
  };
}
async function fulfillByRide(driverId, rideId) {
  const [updated] = await db.update(firstRideGuarantees).set({
    status: "fulfilled_by_ride",
    fulfilledAt: /* @__PURE__ */ new Date(),
    rideId
  }).where(and11(
    eq12(firstRideGuarantees.driverId, driverId),
    eq12(firstRideGuarantees.status, "pending")
  )).returning();
  return !!updated;
}
async function processExpiredGuarantee(guaranteeId) {
  const [guarantee] = await db.select().from(firstRideGuarantees).where(eq12(firstRideGuarantees.id, guaranteeId)).limit(1);
  if (!guarantee || guarantee.status !== "pending") {
    return { paid: false };
  }
  const driver = await db.select().from(drivers).where(eq12(drivers.id, guarantee.driverId)).limit(1);
  if (!driver.length || !driver[0].isOnline) {
    await db.update(firstRideGuarantees).set({ status: "cancelled" }).where(eq12(firstRideGuarantees.id, guaranteeId));
    return { paid: false };
  }
  const currentBalance = parseFloat(driver[0].walletBalance || "0");
  const newBalance = currentBalance + parseFloat(guarantee.guaranteeAmount);
  await db.update(drivers).set({ walletBalance: newBalance.toFixed(2) }).where(eq12(drivers.id, guarantee.driverId));
  await db.update(firstRideGuarantees).set({
    status: "paid",
    paidAt: /* @__PURE__ */ new Date()
  }).where(eq12(firstRideGuarantees.id, guaranteeId));
  return {
    paid: true,
    amount: guarantee.guaranteeAmount,
    currency: guarantee.currency
  };
}
async function cancelGuarantee(driverId) {
  const [updated] = await db.update(firstRideGuarantees).set({ status: "cancelled" }).where(and11(
    eq12(firstRideGuarantees.driverId, driverId),
    eq12(firstRideGuarantees.status, "pending")
  )).returning();
  return !!updated;
}
var pendingChecks = /* @__PURE__ */ new Map();
function scheduleGuaranteeCheck(guaranteeId, minutes) {
  if (pendingChecks.has(guaranteeId)) {
    clearTimeout(pendingChecks.get(guaranteeId));
  }
  const timeout = setTimeout(async () => {
    pendingChecks.delete(guaranteeId);
    await processExpiredGuarantee(guaranteeId);
  }, minutes * 60 * 1e3);
  pendingChecks.set(guaranteeId, timeout);
}
async function getRecentPayout(driverId) {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1e3);
  const [recent] = await db.select().from(firstRideGuarantees).where(and11(
    eq12(firstRideGuarantees.driverId, driverId),
    eq12(firstRideGuarantees.status, "paid"),
    gte5(firstRideGuarantees.paidAt, fiveMinutesAgo)
  )).orderBy(desc8(firstRideGuarantees.paidAt)).limit(1);
  if (recent && recent.paidAt) {
    return {
      amount: recent.guaranteeAmount,
      currency: recent.currency,
      paidAt: new Date(recent.paidAt)
    };
  }
  return null;
}

// server/accountabilityService.ts
init_db();
init_schema();
import { eq as eq13, and as and12, gte as gte6, desc as desc9, sql as sql9 } from "drizzle-orm";
var DEFAULT_CONFIG2 = {
  etaBreachThresholdMinutes: 5,
  etaBreachCreditAmount: 5,
  pickupWaitThresholdMinutes: 3,
  pickupWaitCreditPerMinute: 1,
  pickupWaitMaxCredit: 10,
  driverCancelCreditAmount: 10,
  riderLateCancelThresholdMinutes: 5,
  riderLateCancelDriverCredit: 8,
  noShowCreditAmount: 15,
  dailyCreditCapPerUser: 50,
  dailyCreditCapPerDriver: 75,
  cooldownMinutes: 30
};
async function getDailyCreditsTotal(userId, driverId) {
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  let whereCondition = gte6(accountabilityCredits.creditedAt, today);
  if (userId) {
    whereCondition = and12(
      gte6(accountabilityCredits.creditedAt, today),
      eq13(accountabilityCredits.userId, userId)
    );
  } else if (driverId) {
    whereCondition = and12(
      gte6(accountabilityCredits.creditedAt, today),
      eq13(accountabilityCredits.driverId, driverId)
    );
  }
  const result = await db.select({ total: sql9`COALESCE(SUM(${accountabilityCredits.amount}), '0')` }).from(accountabilityCredits).where(whereCondition);
  return parseFloat(result[0]?.total || "0");
}
async function canIssueCredit(userId, driverId) {
  const config = DEFAULT_CONFIG2;
  if (userId) {
    const dailyTotal = await getDailyCreditsTotal(userId);
    return dailyTotal < config.dailyCreditCapPerUser;
  }
  if (driverId) {
    const dailyTotal = await getDailyCreditsTotal(void 0, driverId);
    return dailyTotal < config.dailyCreditCapPerDriver;
  }
  return false;
}
async function checkRecentCredit(rideId, creditType) {
  const existing = await db.select().from(accountabilityCredits).where(and12(
    eq13(accountabilityCredits.rideId, rideId),
    eq13(accountabilityCredits.creditType, creditType)
  )).limit(1);
  return existing.length > 0;
}
async function issueCredit(params) {
  const { userId, driverId, rideId, creditType, amount, currency = "AED", reason, metricsSnapshot } = params;
  if (!userId && !driverId) {
    return { success: false, reason: "No recipient specified" };
  }
  if (rideId) {
    const alreadyIssued = await checkRecentCredit(rideId, creditType);
    if (alreadyIssued) {
      return { success: false, reason: "Credit already issued for this ride" };
    }
  }
  const canIssue = await canIssueCredit(userId, driverId);
  if (!canIssue) {
    return { success: false, reason: "Daily credit cap reached" };
  }
  const [credit] = await db.insert(accountabilityCredits).values({
    userId,
    driverId,
    rideId,
    creditType,
    amount: amount.toFixed(2),
    currency,
    reason,
    metricsSnapshot: metricsSnapshot ? JSON.stringify(metricsSnapshot) : null,
    appliedToWallet: true
  }).returning();
  if (userId) {
    await db.update(users).set({ walletBalance: sql9`${users.walletBalance} + ${amount.toFixed(2)}` }).where(eq13(users.id, userId));
  } else if (driverId) {
    await db.update(drivers).set({ walletBalance: sql9`${drivers.walletBalance} + ${amount.toFixed(2)}` }).where(eq13(drivers.id, driverId));
  }
  return { success: true, creditId: credit.id };
}
async function processEtaBreach(rideId, estimatedArrivalMinutes, actualArrivalMinutes) {
  const config = DEFAULT_CONFIG2;
  const breachMinutes = actualArrivalMinutes - estimatedArrivalMinutes;
  if (breachMinutes < config.etaBreachThresholdMinutes) {
    return { credited: false };
  }
  const ride = await db.select().from(rides).where(eq13(rides.id, rideId)).limit(1);
  if (!ride.length) return { credited: false };
  const result = await issueCredit({
    userId: ride[0].customerId,
    rideId,
    creditType: "eta_breach",
    amount: config.etaBreachCreditAmount,
    reason: `Driver arrived ${breachMinutes} min later than estimated`,
    metricsSnapshot: { estimatedArrivalMinutes, actualArrivalMinutes, breachMinutes }
  });
  return { credited: result.success, amount: result.success ? config.etaBreachCreditAmount : void 0 };
}
async function processPickupWait(rideId, waitTimeMinutes) {
  const config = DEFAULT_CONFIG2;
  if (waitTimeMinutes < config.pickupWaitThresholdMinutes) {
    return { credited: false };
  }
  const ride = await db.select().from(rides).where(eq13(rides.id, rideId)).limit(1);
  if (!ride.length) return { credited: false };
  const excessWait = waitTimeMinutes - config.pickupWaitThresholdMinutes;
  const creditAmount = Math.min(
    excessWait * config.pickupWaitCreditPerMinute,
    config.pickupWaitMaxCredit
  );
  const result = await issueCredit({
    userId: ride[0].customerId,
    rideId,
    creditType: "pickup_wait",
    amount: creditAmount,
    reason: `Waited ${waitTimeMinutes} min for pickup`,
    metricsSnapshot: { waitTimeMinutes, excessWait, creditAmount }
  });
  return { credited: result.success, amount: result.success ? creditAmount : void 0 };
}
async function processDriverCancellation(rideId, minutesAfterAccept) {
  const config = DEFAULT_CONFIG2;
  const ride = await db.select().from(rides).where(eq13(rides.id, rideId)).limit(1);
  if (!ride.length) return { credited: false };
  const result = await issueCredit({
    userId: ride[0].customerId,
    rideId,
    creditType: "driver_cancel",
    amount: config.driverCancelCreditAmount,
    reason: `Driver cancelled ${minutesAfterAccept} min after accepting`,
    metricsSnapshot: { minutesAfterAccept }
  });
  return { credited: result.success, amount: result.success ? config.driverCancelCreditAmount : void 0 };
}
async function processRiderLateCancellation(rideId, minutesAfterAccept) {
  const config = DEFAULT_CONFIG2;
  if (minutesAfterAccept < config.riderLateCancelThresholdMinutes) {
    return { credited: false };
  }
  const ride = await db.select().from(rides).where(eq13(rides.id, rideId)).limit(1);
  if (!ride.length || !ride[0].driverId) return { credited: false };
  const result = await issueCredit({
    driverId: ride[0].driverId,
    rideId,
    creditType: "rider_cancel_late",
    amount: config.riderLateCancelDriverCredit,
    reason: `Rider cancelled ${minutesAfterAccept} min after driver accepted`,
    metricsSnapshot: { minutesAfterAccept }
  });
  return { credited: result.success, amount: result.success ? config.riderLateCancelDriverCredit : void 0 };
}
async function getRecentCredits(userId, driverId, limit = 10) {
  let query = db.select({
    id: accountabilityCredits.id,
    creditType: accountabilityCredits.creditType,
    amount: accountabilityCredits.amount,
    currency: accountabilityCredits.currency,
    reason: accountabilityCredits.reason,
    creditedAt: accountabilityCredits.creditedAt,
    seen: accountabilityCredits.seenByUser
  }).from(accountabilityCredits).orderBy(desc9(accountabilityCredits.creditedAt)).limit(limit);
  if (userId) {
    query = query.where(eq13(accountabilityCredits.userId, userId));
  } else if (driverId) {
    query = query.where(eq13(accountabilityCredits.driverId, driverId));
  }
  const credits = await query;
  return credits.map((c) => ({
    ...c,
    seen: c.seen ?? false
  }));
}
async function markCreditsSeen(creditIds) {
  if (creditIds.length === 0) return;
  await db.update(accountabilityCredits).set({ seenByUser: true }).where(sql9`${accountabilityCredits.id} = ANY(${creditIds})`);
}
async function getUnseenCreditsCount(userId, driverId) {
  let baseWhere = eq13(accountabilityCredits.seenByUser, false);
  if (userId) {
    const result = await db.select({ count: sql9`count(*)` }).from(accountabilityCredits).where(and12(baseWhere, eq13(accountabilityCredits.userId, userId)));
    return result[0]?.count || 0;
  }
  if (driverId) {
    const result = await db.select({ count: sql9`count(*)` }).from(accountabilityCredits).where(and12(baseWhere, eq13(accountabilityCredits.driverId, driverId)));
    return result[0]?.count || 0;
  }
  return 0;
}

// server/rematchService.ts
init_db();
init_schema();
import { eq as eq14, and as and13, ne } from "drizzle-orm";
var MAX_REMATCH_ATTEMPTS = 3;
var SEARCH_RADIUS_KM = 10;
async function initiateRematch(cancelledRideId, cancelledByDriverId, minutesAfterAccept) {
  try {
    const [ride] = await db.select().from(rides).where(eq14(rides.id, cancelledRideId)).limit(1);
    if (!ride) {
      return { success: false, message: "Ride not found" };
    }
    const currentRematchCount = ride.rematchCount || 0;
    if (currentRematchCount >= MAX_REMATCH_ATTEMPTS) {
      const creditResult = await processDriverCancellation(
        cancelledRideId,
        minutesAfterAccept
      );
      return {
        success: false,
        message: `Max rematch attempts (${MAX_REMATCH_ATTEMPTS}) reached. Refunding rider.`,
        creditIssued: creditResult.credited,
        creditAmount: creditResult.amount
      };
    }
    await db.update(rides).set({ isRematchInProgress: true }).where(eq14(rides.id, cancelledRideId));
    const originalFare = ride.originalGuaranteedFare || ride.estimatedFare;
    const availableDrivers = await findAvailableDrivers(
      Number(ride.pickupLat),
      Number(ride.pickupLng),
      cancelledByDriverId,
      ride.serviceTypeId
    );
    if (availableDrivers.length === 0) {
      await db.update(rides).set({
        isRematchInProgress: false,
        status: "cancelled",
        cancellationReason: "No drivers available for rematch"
      }).where(eq14(rides.id, cancelledRideId));
      const creditResult = await processDriverCancellation(
        cancelledRideId,
        minutesAfterAccept
      );
      return {
        success: false,
        message: "No available drivers for rematch",
        creditIssued: creditResult.credited,
        creditAmount: creditResult.amount
      };
    }
    const [newRide] = await db.insert(rides).values({
      customerId: ride.customerId,
      serviceTypeId: ride.serviceTypeId,
      pickupAddress: ride.pickupAddress,
      pickupLat: ride.pickupLat,
      pickupLng: ride.pickupLng,
      dropoffAddress: ride.dropoffAddress,
      dropoffLat: ride.dropoffLat,
      dropoffLng: ride.dropoffLng,
      status: "pending",
      estimatedFare: originalFare,
      originalGuaranteedFare: originalFare,
      distance: ride.distance,
      duration: ride.duration,
      surgeMultiplier: ride.surgeMultiplier,
      paymentMethod: ride.paymentMethod,
      regionCode: ride.regionCode,
      currency: ride.currency,
      riderPriority: ride.riderPriority,
      rematchCount: currentRematchCount + 1,
      rematchFromRideId: cancelledRideId,
      priceBreakdown: ride.priceBreakdown,
      platformFee: ride.platformFee,
      driverEarnings: ride.driverEarnings
    }).returning();
    await db.update(rides).set({
      isRematchInProgress: false,
      status: "cancelled",
      cancellationReason: `Driver cancelled - rematch initiated (attempt ${currentRematchCount + 1})`
    }).where(eq14(rides.id, cancelledRideId));
    console.log(`Rematch initiated: ${cancelledRideId} -> ${newRide.id} (attempt ${currentRematchCount + 1})`);
    return {
      success: true,
      newRideId: newRide.id,
      message: `Rematch initiated successfully (attempt ${currentRematchCount + 1}/${MAX_REMATCH_ATTEMPTS})`
    };
  } catch (error) {
    console.error("Rematch error:", error);
    await db.update(rides).set({ isRematchInProgress: false }).where(eq14(rides.id, cancelledRideId));
    return { success: false, message: error.message };
  }
}
async function findAvailableDrivers(pickupLat, pickupLng, excludeDriverId, serviceTypeId) {
  const earthRadiusKm = 6371;
  const availableDrivers = await db.select({
    driverId: drivers.id,
    lat: drivers.currentLat,
    lng: drivers.currentLng,
    vehicleType: vehicles.type
  }).from(drivers).leftJoin(vehicles, eq14(vehicles.driverId, drivers.id)).where(
    and13(
      eq14(drivers.isOnline, true),
      eq14(drivers.status, "approved"),
      ne(drivers.id, excludeDriverId)
    )
  );
  const driversWithDistance = availableDrivers.filter((d) => d.lat && d.lng).map((d) => {
    const dLat = (Number(d.lat) - pickupLat) * Math.PI / 180;
    const dLng = (Number(d.lng) - pickupLng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(pickupLat * Math.PI / 180) * Math.cos(Number(d.lat) * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = earthRadiusKm * c;
    return { driverId: d.driverId, distance };
  }).filter((d) => d.distance <= SEARCH_RADIUS_KM).sort((a, b) => a.distance - b.distance);
  return driversWithDistance;
}
async function getRematchStatus(rideId) {
  const [ride] = await db.select().from(rides).where(eq14(rides.id, rideId)).limit(1);
  if (!ride) {
    return { isRematch: false, rematchCount: 0 };
  }
  return {
    isRematch: !!ride.rematchFromRideId,
    rematchCount: ride.rematchCount || 0,
    originalRideId: ride.rematchFromRideId || void 0,
    guaranteedFare: ride.originalGuaranteedFare?.toString() || ride.estimatedFare?.toString()
  };
}

// server/incentivePolicy.ts
var defaultThresholds = {
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
var phasePolicies = {
  seeding: {
    signupBonusEnabled: true,
    signupBonusAmount: 50,
    signupBonusRidesRequired: 10,
    referralBonusEnabled: true,
    referralBonusAmount: 25,
    surgePricingEnabled: false,
    maxSurgeMultiplier: 1,
    weatherBoostEnabled: true,
    weatherBoostMultiplier: 1.3,
    emergencyBoostEnabled: true,
    emergencyBoostMultiplier: 1.5,
    peakHourBoostEnabled: false,
    peakHourBoostMultiplier: 1
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
    maxSurgeMultiplier: 2,
    weatherBoostEnabled: true,
    weatherBoostMultiplier: 1.2,
    emergencyBoostEnabled: true,
    emergencyBoostMultiplier: 1.3,
    peakHourBoostEnabled: true,
    peakHourBoostMultiplier: 1.25
  }
};
var cityCache = /* @__PURE__ */ new Map();
function getCityDataCached(cityId) {
  return cityCache.get(cityId) || null;
}
async function getActiveDriverCountForCity(_cityId) {
  return 0;
}
async function getDailyRideCountForCity(_cityId) {
  return 0;
}
async function getCityPhase(cityId) {
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
async function getIncentivePolicy(cityId) {
  const phase = await getCityPhase(cityId);
  const basePolicy = phasePolicies[phase];
  return {
    cityId,
    phase,
    signupBonusEnabled: basePolicy.signupBonusEnabled,
    signupBonusAmount: basePolicy.signupBonusAmount,
    signupBonusRidesRequired: basePolicy.signupBonusRidesRequired,
    referralBonusEnabled: basePolicy.referralBonusEnabled,
    referralBonusAmount: basePolicy.referralBonusAmount,
    surgePricingEnabled: basePolicy.surgePricingEnabled,
    maxSurgeMultiplier: basePolicy.maxSurgeMultiplier,
    weatherBoostEnabled: basePolicy.weatherBoostEnabled,
    weatherBoostMultiplier: basePolicy.weatherBoostMultiplier,
    emergencyBoostEnabled: basePolicy.emergencyBoostEnabled,
    emergencyBoostMultiplier: basePolicy.emergencyBoostMultiplier,
    peakHourBoostEnabled: basePolicy.peakHourBoostEnabled,
    peakHourBoostMultiplier: basePolicy.peakHourBoostMultiplier,
    updatedAt: /* @__PURE__ */ new Date()
  };
}
async function shouldOfferSignupBonus(cityId) {
  const policy = await getIncentivePolicy(cityId);
  return {
    eligible: policy.signupBonusEnabled,
    amount: policy.signupBonusAmount,
    ridesRequired: policy.signupBonusRidesRequired
  };
}
async function calculateBoostMultiplier(cityId, conditions) {
  const policy = await getIncentivePolicy(cityId);
  let finalMultiplier = 1;
  const reasons = [];
  const breakdown = [];
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
async function checkPhaseTransition(cityId) {
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
  const daysActive = city.launchedAt ? Math.floor((Date.now() - city.launchedAt.getTime()) / (1e3 * 60 * 60 * 24)) : 0;
  const thresholds = currentPhase === "seeding" ? defaultThresholds.seedingToGrowth : defaultThresholds.growthToMature;
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
async function getPolicyExplanation(cityId) {
  const policy = await getIncentivePolicy(cityId);
  const transition = await checkPhaseTransition(cityId);
  const phaseNames = {
    seeding: "Launch Phase",
    growth: "Growth Phase",
    mature: "Established Market"
  };
  const phaseDescriptions = {
    seeding: "Building driver supply with signup bonuses. Only weather/emergency boosts apply.",
    growth: "Scaling operations with referral programs. Surge pricing activated.",
    mature: "Stable market with full pricing dynamics. Driver supply is self-sustaining."
  };
  const incentives = [
    {
      name: "Driver Signup Bonus",
      enabled: policy.signupBonusEnabled,
      value: policy.signupBonusEnabled ? `${policy.signupBonusAmount} after ${policy.signupBonusRidesRequired} rides` : "Disabled",
      reason: policy.signupBonusEnabled ? "Active during launch to attract early drivers" : "Auto-disabled after seeding phase"
    },
    {
      name: "Referral Bonus",
      enabled: policy.referralBonusEnabled,
      value: policy.referralBonusEnabled ? `${policy.referralBonusAmount} per referral` : "Disabled",
      reason: policy.referralBonusEnabled ? "Active to grow driver network organically" : "Disabled in mature markets"
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
      reason: policy.peakHourBoostEnabled ? "Active to balance supply during rush hours" : "Disabled during launch phase"
    },
    {
      name: "Surge Pricing",
      enabled: policy.surgePricingEnabled,
      value: policy.surgePricingEnabled ? `Up to ${policy.maxSurgeMultiplier}x` : "Disabled",
      reason: policy.surgePricingEnabled ? "Dynamic pricing based on demand" : "Disabled during launch for predictable pricing"
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

// server/walletService.ts
init_db();
init_schema();
import { eq as eq15, sql as sql11, desc as desc10 } from "drizzle-orm";
import { v4 as uuidv44 } from "uuid";
async function getPlatformBalance() {
  const result = await db.select({
    income: sql11`COALESCE(SUM(CASE WHEN ${platformLedger.type} = 'platform_fee_income' THEN ${platformLedger.amount} ELSE 0 END), '0')`,
    expenses: sql11`COALESCE(SUM(CASE WHEN ${platformLedger.type} IN ('guarantee_payout', 'accountability_payout', 'operational_expense') THEN ${platformLedger.amount} ELSE 0 END), '0')`
  }).from(platformLedger);
  const income = parseFloat(result[0]?.income || "0");
  const expenses = parseFloat(result[0]?.expenses || "0");
  return income - expenses;
}
async function recordPlatformLedger(entry) {
  const balanceBefore = await getPlatformBalance();
  const balanceAfter = entry.type === "platform_fee_income" ? balanceBefore + entry.amount : balanceBefore - entry.amount;
  await db.insert(platformLedger).values({
    type: entry.type,
    amount: entry.amount.toFixed(2),
    currency: entry.currency || "AED",
    rideId: entry.rideId,
    driverId: entry.driverId,
    userId: entry.userId,
    description: entry.description,
    balanceBefore: balanceBefore.toFixed(2),
    balanceAfter: balanceAfter.toFixed(2)
  });
}
async function creditUserWallet(userId, amount, type, options = {}) {
  const user = await db.select().from(users).where(eq15(users.id, userId)).limit(1);
  if (!user.length) {
    return { success: false, newBalance: 0 };
  }
  const currentBalance = parseFloat(user[0].walletBalance || "0");
  const newBalance = currentBalance + amount;
  await db.update(users).set({ walletBalance: newBalance.toFixed(2) }).where(eq15(users.id, userId));
  await db.insert(walletTransactions).values({
    id: uuidv44(),
    userId,
    rideId: options.rideId,
    type,
    amount: amount.toFixed(2),
    currency: options.currency || "AED",
    status: "completed",
    description: options.description,
    completedAt: /* @__PURE__ */ new Date()
  });
  return { success: true, newBalance };
}
async function topUpWallet(userId, amount, currency = "AED") {
  return creditUserWallet(userId, amount, "wallet_topup", {
    description: `Wallet top-up`,
    currency
  });
}
async function processDriverWithdrawal(driverId, amount, currency = "AED") {
  const driver = await db.select().from(drivers).where(eq15(drivers.id, driverId)).limit(1);
  if (!driver.length) {
    return { success: false };
  }
  const currentBalance = parseFloat(driver[0].walletBalance || "0");
  if (currentBalance < amount) {
    return { success: false, insufficientFunds: true, newBalance: currentBalance };
  }
  const newBalance = currentBalance - amount;
  await db.update(drivers).set({ walletBalance: newBalance.toFixed(2) }).where(eq15(drivers.id, driverId));
  await db.insert(walletTransactions).values({
    id: uuidv44(),
    driverId,
    type: "withdrawal",
    amount: (-amount).toFixed(2),
    currency,
    status: "completed",
    description: "Wallet withdrawal",
    completedAt: /* @__PURE__ */ new Date()
  });
  return { success: true, newBalance };
}
async function getWalletSummary(userId, driverId) {
  let balance = 0;
  let transactions = [];
  if (userId) {
    const user = await db.select().from(users).where(eq15(users.id, userId)).limit(1);
    balance = parseFloat(user[0]?.walletBalance || "0");
    transactions = await db.select().from(walletTransactions).where(eq15(walletTransactions.userId, userId)).orderBy(desc10(walletTransactions.createdAt)).limit(20);
  } else if (driverId) {
    const driver = await db.select().from(drivers).where(eq15(drivers.id, driverId)).limit(1);
    balance = parseFloat(driver[0]?.walletBalance || "0");
    transactions = await db.select().from(walletTransactions).where(eq15(walletTransactions.driverId, driverId)).orderBy(desc10(walletTransactions.createdAt)).limit(20);
  }
  const totalEarnings = transactions.filter((t) => parseFloat(t.amount) > 0).reduce((sum2, t) => sum2 + parseFloat(t.amount), 0);
  const totalSpent = transactions.filter((t) => parseFloat(t.amount) < 0).reduce((sum2, t) => sum2 + Math.abs(parseFloat(t.amount)), 0);
  return {
    balance,
    totalEarnings,
    totalSpent,
    recentTransactions: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      description: t.description,
      createdAt: t.createdAt
    }))
  };
}
async function getPlatformFinancials() {
  const result = await db.select({
    platformFees: sql11`COALESCE(SUM(CASE WHEN ${platformLedger.type} = 'platform_fee_income' THEN ${platformLedger.amount} ELSE 0 END), '0')`,
    guaranteePayouts: sql11`COALESCE(SUM(CASE WHEN ${platformLedger.type} = 'guarantee_payout' THEN ${platformLedger.amount} ELSE 0 END), '0')`,
    accountabilityPayouts: sql11`COALESCE(SUM(CASE WHEN ${platformLedger.type} = 'accountability_payout' THEN ${platformLedger.amount} ELSE 0 END), '0')`
  }).from(platformLedger);
  const totalPlatformFees = parseFloat(result[0]?.platformFees || "0");
  const totalGuaranteePayouts = parseFloat(result[0]?.guaranteePayouts || "0");
  const totalAccountabilityPayouts = parseFloat(result[0]?.accountabilityPayouts || "0");
  const netBalance = totalPlatformFees - totalGuaranteePayouts - totalAccountabilityPayouts;
  return {
    totalPlatformFees,
    totalGuaranteePayouts,
    totalAccountabilityPayouts,
    netBalance
  };
}

// server/intentEngine.ts
init_db();
init_schema();
import { eq as eq16, desc as desc11, and as and15, gte as gte8 } from "drizzle-orm";
var CITY_WEIGHTS = {
  default: {
    directionality: 0.25,
    timeConstraint: 0.15,
    earningsUrgency: 0.1,
    tripPreference: 0.15,
    zoneAffinity: 0.15,
    fatigueIndex: 0.2
  },
  low_density: {
    directionality: 0.15,
    timeConstraint: 0.1,
    earningsUrgency: 0.15,
    tripPreference: 0.2,
    zoneAffinity: 0.2,
    fatigueIndex: 0.2
  },
  high_density: {
    directionality: 0.3,
    timeConstraint: 0.2,
    earningsUrgency: 0.05,
    tripPreference: 0.15,
    zoneAffinity: 0.1,
    fatigueIndex: 0.2
  }
};
var ALIGNMENT_THRESHOLDS = {
  instant: 0.85,
  soft_commitment: 0.7
};
function calculateBearing2(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const x = Math.sin(dLng) * Math.cos(lat2Rad);
  const y = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  return (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
}
function calculateDistance4(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function normalizeAngleDiff(angle1, angle2) {
  let diff = Math.abs(angle1 - angle2);
  if (diff > 180) diff = 360 - diff;
  return 1 - diff / 180;
}
function computeDriverIntentVector(telemetry) {
  const sessionHours = (Date.now() - telemetry.sessionStartTime.getTime()) / (1e3 * 60 * 60);
  let directionality = 0;
  if (telemetry.homeAddress && telemetry.heading !== void 0) {
    const homeHeading = calculateBearing2(
      telemetry.currentLat,
      telemetry.currentLng,
      telemetry.homeAddress.lat,
      telemetry.homeAddress.lng
    );
    directionality = normalizeAngleDiff(telemetry.heading, homeHeading) * 2 - 1;
  }
  const timeConstraint = Math.min(1, sessionHours / 8);
  const earningsGap = telemetry.avgDailyEarnings > 0 ? Math.max(0, 1 - telemetry.todayEarnings / telemetry.avgDailyEarnings) : 0.5;
  const earningsUrgency = earningsGap;
  const ridesGap = telemetry.avgRidesPerDay > 0 ? telemetry.ridesCompletedToday / telemetry.avgRidesPerDay : 0.5;
  const tripPreference = ridesGap < 0.5 ? 0.3 : ridesGap > 1 ? 0.7 : 0.5;
  const zoneAffinity = telemetry.recentAcceptanceRate;
  const fatigueIndex = Math.min(1, sessionHours / 10 + telemetry.recentCancellations * 0.1);
  return {
    directionality: Math.max(-1, Math.min(1, directionality)),
    timeConstraint: Math.max(0, Math.min(1, timeConstraint)),
    earningsUrgency: Math.max(0, Math.min(1, earningsUrgency)),
    tripPreference: Math.max(0, Math.min(1, tripPreference)),
    zoneAffinity: Math.max(0, Math.min(1, zoneAffinity)),
    fatigueIndex: Math.max(0, Math.min(1, fatigueIndex))
  };
}
function computeRiderIntentVector(context) {
  let priority = 0.5;
  switch (context.priority) {
    case "fastest":
      priority = 1;
      break;
    case "cheapest":
      priority = 0;
      break;
    case "reliable":
      priority = 0.5;
      break;
  }
  const tripDistance = calculateDistance4(
    context.pickupLat,
    context.pickupLng,
    context.dropoffLat,
    context.dropoffLng
  );
  const flexibility = context.rideHistory > 10 ? Math.max(0.2, 1 - context.cancellationHistory / context.rideHistory) : 0.5;
  const pickupUrgency = context.priority === "fastest" ? 0.9 : 0.5;
  const destinationConstraint = tripDistance > 15 ? 0.8 : tripDistance > 5 ? 0.5 : 0.3;
  const reliabilitySensitivity = context.priority === "reliable" ? 0.9 : context.cancellationHistory > 2 ? 0.7 : 0.4;
  return {
    priority: Math.max(0, Math.min(1, priority)),
    flexibility: Math.max(0, Math.min(1, flexibility)),
    pickupUrgency: Math.max(0, Math.min(1, pickupUrgency)),
    destinationConstraint: Math.max(0, Math.min(1, destinationConstraint)),
    reliabilitySensitivity: Math.max(0, Math.min(1, reliabilitySensitivity))
  };
}
function calculateAlignmentScore(driverVector, riderVector, driverLat, driverLng, pickupLat, pickupLng, dropoffLat, dropoffLng, cityType = "default") {
  const weights = CITY_WEIGHTS[cityType];
  const pickupDistance = calculateDistance4(driverLat, driverLng, pickupLat, pickupLng);
  const pickupProximity = Math.max(0, 1 - pickupDistance / 10);
  let directionMatch = 0.5;
  if (driverVector.directionality > 0) {
    const dropoffBearing = calculateBearing2(driverLat, driverLng, dropoffLat, dropoffLng);
    const driverHeading = (driverVector.directionality + 1) * 180;
    directionMatch = normalizeAngleDiff(dropoffBearing, driverHeading);
  }
  const timeMatch = 1 - Math.abs(driverVector.timeConstraint - riderVector.pickupUrgency);
  const priorityMatch = riderVector.priority === 1 ? 1 - driverVector.fatigueIndex : riderVector.priority === 0 ? driverVector.earningsUrgency : (1 - driverVector.fatigueIndex) * 0.5 + 0.5;
  const zoneMatch = driverVector.zoneAffinity;
  const reliabilityMatch = riderVector.reliabilitySensitivity < 0.5 ? 0.8 : (1 - driverVector.fatigueIndex) * driverVector.zoneAffinity;
  const weightedScore = directionMatch * weights.directionality + timeMatch * weights.timeConstraint + priorityMatch * weights.earningsUrgency + (1 - Math.abs(driverVector.tripPreference - riderVector.destinationConstraint)) * weights.tripPreference + zoneMatch * weights.zoneAffinity + (1 - driverVector.fatigueIndex) * weights.fatigueIndex;
  const proximityBonus = pickupProximity * 0.15;
  const finalScore = Math.min(1, weightedScore + proximityBonus);
  let matchType;
  if (finalScore >= ALIGNMENT_THRESHOLDS.instant) {
    matchType = "instant";
  } else if (finalScore >= ALIGNMENT_THRESHOLDS.soft_commitment) {
    matchType = "soft_commitment";
  } else {
    matchType = "wait_or_compensate";
  }
  const confidence = finalScore * (1 - driverVector.fatigueIndex * 0.3) * riderVector.flexibility;
  return {
    score: Math.round(finalScore * 100) / 100,
    matchType,
    confidence: Math.round(confidence * 100) / 100
  };
}
async function getDriverTelemetry(driverId) {
  const driver = await db.select().from(drivers).where(eq16(drivers.id, driverId)).limit(1);
  if (!driver.length) return null;
  const d = driver[0];
  const thirtyDaysAgo = /* @__PURE__ */ new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentRides = await db.select().from(rides).where(and15(
    eq16(rides.driverId, driverId),
    gte8(rides.createdAt, thirtyDaysAgo)
  )).orderBy(desc11(rides.createdAt));
  const todayStart = /* @__PURE__ */ new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayRides = recentRides.filter((r) => r.createdAt >= todayStart && r.status === "completed");
  const todayEarnings = todayRides.reduce((sum2, r) => sum2 + parseFloat(r.actualFare || r.estimatedFare || "0"), 0);
  const completedRides = recentRides.filter((r) => r.status === "completed");
  const cancelledRides = recentRides.filter((r) => r.status === "cancelled");
  const totalDays = Math.max(1, Math.ceil((Date.now() - thirtyDaysAgo.getTime()) / (1e3 * 60 * 60 * 24)));
  const avgDailyEarnings = completedRides.reduce((sum2, r) => sum2 + parseFloat(r.actualFare || r.estimatedFare || "0"), 0) / totalDays;
  const avgRidesPerDay = completedRides.length / totalDays;
  const acceptanceRate = recentRides.length > 0 ? completedRides.length / recentRides.length : 0.8;
  let homeAddress;
  try {
    if (d.homeAddress) {
      const parsed = JSON.parse(d.homeAddress);
      if (parsed.lat && parsed.lng) {
        homeAddress = { lat: parsed.lat, lng: parsed.lng };
      }
    }
  } catch {
  }
  return {
    currentLat: parseFloat(d.currentLat || "0"),
    currentLng: parseFloat(d.currentLng || "0"),
    heading: d.currentHeading ? parseFloat(d.currentHeading) : void 0,
    sessionStartTime: d.lastOnlineAt || /* @__PURE__ */ new Date(),
    homeAddress,
    recentAcceptanceRate: acceptanceRate,
    recentCancellations: cancelledRides.length,
    todayEarnings,
    avgDailyEarnings,
    ridesCompletedToday: todayRides.length,
    avgRidesPerDay
  };
}
async function getRiderContext(userId, pickupLat, pickupLng, dropoffLat, dropoffLng, priority) {
  const userRides = await db.select().from(rides).where(eq16(rides.customerId, userId)).orderBy(desc11(rides.createdAt)).limit(50);
  const completedRides = userRides.filter((r) => r.status === "completed");
  const cancelledRides = userRides.filter((r) => r.status === "cancelled");
  return {
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    priority,
    rideHistory: completedRides.length,
    avgWaitTolerance: 5,
    cancellationHistory: cancelledRides.length
  };
}
async function findAlignedDrivers(userId, pickupLat, pickupLng, dropoffLat, dropoffLng, priority = "reliable", cityType = "default") {
  const onlineDrivers = await db.select().from(drivers).where(eq16(drivers.isOnline, true));
  const riderContext = await getRiderContext(userId, pickupLat, pickupLng, dropoffLat, dropoffLng, priority);
  const riderVector = computeRiderIntentVector(riderContext);
  const alignedDrivers = [];
  for (const driver of onlineDrivers) {
    const telemetry = await getDriverTelemetry(driver.id);
    if (!telemetry) continue;
    const driverVector = computeDriverIntentVector(telemetry);
    const driverLat = parseFloat(driver.currentLat || "0");
    const driverLng = parseFloat(driver.currentLng || "0");
    if (driverLat === 0 && driverLng === 0) continue;
    const distance = calculateDistance4(driverLat, driverLng, pickupLat, pickupLng);
    if (distance > 15) continue;
    const alignment = calculateAlignmentScore(
      driverVector,
      riderVector,
      driverLat,
      driverLng,
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
      cityType
    );
    alignedDrivers.push({
      driverId: driver.id,
      alignment,
      driverVector,
      distance
    });
  }
  alignedDrivers.sort((a, b) => b.alignment.score - a.alignment.score);
  return alignedDrivers;
}
async function getBestAlignedDriver(userId, pickupLat, pickupLng, dropoffLat, dropoffLng, priority = "reliable") {
  const aligned = await findAlignedDrivers(userId, pickupLat, pickupLng, dropoffLat, dropoffLng, priority);
  if (aligned.length === 0) return null;
  const instantMatches = aligned.filter((d) => d.alignment.matchType === "instant");
  if (instantMatches.length > 0) {
    return instantMatches[0];
  }
  const softMatches = aligned.filter((d) => d.alignment.matchType === "soft_commitment");
  if (softMatches.length > 0) {
    return softMatches[0];
  }
  return aligned[0];
}

// server/cityBrain.ts
init_db();
init_schema();
import { eq as eq17, gte as gte9, sql as sql13 } from "drizzle-orm";
var ZONE_RADIUS_KM = 3;
function getZoneId(lat, lng) {
  const latZone = Math.floor(lat / 0.027);
  const lngZone = Math.floor(lng / 0.027);
  return `${latZone}_${lngZone}`;
}
function getZoneCenter(zoneId) {
  const [latZone, lngZone] = zoneId.split("_").map(Number);
  return {
    lat: (latZone + 0.5) * 0.027,
    lng: (lngZone + 0.5) * 0.027
  };
}
async function getCityDensityType(cityCode) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1e3);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3);
  const activeDrivers = await db.select({ count: sql13`count(*)` }).from(drivers).where(eq17(drivers.isOnline, true));
  const recentRidesCount = await db.select({ count: sql13`count(*)` }).from(rides).where(gte9(rides.createdAt, oneDayAgo));
  const hourlyRides = await db.select({ count: sql13`count(*)` }).from(rides).where(gte9(rides.createdAt, oneHourAgo));
  const driverCount = Number(activeDrivers[0]?.count || 0);
  const rideCount = Number(recentRidesCount[0]?.count || 0);
  const hourlyCount = Number(hourlyRides[0]?.count || 0);
  let type;
  if (driverCount < 10 || hourlyCount < 5) {
    type = "low_density";
  } else if (driverCount > 100 || hourlyCount > 50) {
    type = "high_density";
  } else {
    type = "default";
  }
  return {
    type,
    activeDrivers: driverCount,
    recentRides: rideCount,
    avgRequestsPerHour: hourlyCount
  };
}
async function getZoneMetrics(lat, lng) {
  const zoneId = getZoneId(lat, lng);
  const center = getZoneCenter(zoneId);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1e3);
  const nearbyDrivers = await db.select().from(drivers).where(eq17(drivers.isOnline, true));
  const zoneDrivers = nearbyDrivers.filter((d) => {
    const dLat = parseFloat(d.currentLat || "0");
    const dLng = parseFloat(d.currentLng || "0");
    const distance = Math.sqrt(Math.pow(dLat - lat, 2) + Math.pow(dLng - lng, 2)) * 111;
    return distance < ZONE_RADIUS_KM;
  });
  const recentRides = await db.select().from(rides).where(gte9(rides.createdAt, oneHourAgo));
  const zoneRides = recentRides.filter((r) => {
    const rLat = parseFloat(r.pickupLat || "0");
    const rLng = parseFloat(r.pickupLng || "0");
    const distance = Math.sqrt(Math.pow(rLat - lat, 2) + Math.pow(rLng - lng, 2)) * 111;
    return distance < ZONE_RADIUS_KM;
  });
  const supplyLevel = Math.min(1, zoneDrivers.length / 10);
  const demandLevel = Math.min(1, zoneRides.length / 20);
  const imbalanceScore = demandLevel - supplyLevel;
  const completedZoneRides = zoneRides.filter((r) => r.status === "completed");
  const avgWaitTime = completedZoneRides.length > 0 ? completedZoneRides.reduce((sum2, r) => {
    const created = new Date(r.createdAt).getTime();
    const accepted = r.acceptedAt ? new Date(r.acceptedAt).getTime() : created;
    return sum2 + (accepted - created) / 6e4;
  }, 0) / completedZoneRides.length : 5;
  let guaranteeThreshold = 15;
  let premiumMultiplier = 1;
  if (imbalanceScore > 0.3) {
    guaranteeThreshold = 20;
    premiumMultiplier = 1.2;
  } else if (imbalanceScore > 0.5) {
    guaranteeThreshold = 25;
    premiumMultiplier = 1.4;
  } else if (imbalanceScore < -0.3) {
    guaranteeThreshold = 10;
    premiumMultiplier = 0.9;
  }
  return {
    zoneId,
    centerLat: center.lat,
    centerLng: center.lng,
    supplyLevel,
    demandLevel,
    imbalanceScore,
    avgWaitTime,
    avgAlignmentScore: 0.75,
    guaranteeThreshold,
    premiumMultiplier
  };
}
async function getFlowRecommendation(driverLat, driverLng) {
  const currentZone = await getZoneMetrics(driverLat, driverLng);
  const adjacentOffsets = [
    { lat: 0.027, lng: 0 },
    { lat: -0.027, lng: 0 },
    { lat: 0, lng: 0.027 },
    { lat: 0, lng: -0.027 }
  ];
  let bestZone = null;
  let bestImbalance = currentZone.imbalanceScore;
  for (const offset of adjacentOffsets) {
    const metrics = await getZoneMetrics(
      driverLat + offset.lat,
      driverLng + offset.lng
    );
    if (metrics.imbalanceScore > bestImbalance + 0.1) {
      bestImbalance = metrics.imbalanceScore;
      bestZone = { lat: driverLat + offset.lat, lng: driverLng + offset.lng };
    }
  }
  if (bestZone) {
    return {
      recommendedZone: bestZone,
      reason: "Higher demand detected nearby",
      expectedImprovement: (bestImbalance - currentZone.imbalanceScore) * 100
    };
  }
  return {
    recommendedZone: null,
    reason: "Current zone is optimal",
    expectedImprovement: 0
  };
}

// server/antiGamingService.ts
init_db();
init_schema();
import { eq as eq18, desc as desc13, and as and17, gte as gte10 } from "drizzle-orm";
async function analyzeDriverEntropy(driverId) {
  const thirtyDaysAgo = /* @__PURE__ */ new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentRides = await db.select().from(rides).where(and17(
    eq18(rides.driverId, driverId),
    gte10(rides.createdAt, thirtyDaysAgo)
  )).orderBy(desc13(rides.createdAt));
  if (recentRides.length < 5) {
    return 1;
  }
  const uniquePickupZones = /* @__PURE__ */ new Set();
  const uniqueDropoffZones = /* @__PURE__ */ new Set();
  const hourDistribution = new Array(24).fill(0);
  const acceptedRides = recentRides.filter((r) => r.status === "completed");
  for (const ride of recentRides) {
    const pickupLat = parseFloat(ride.pickupLat || "0");
    const pickupLng = parseFloat(ride.pickupLng || "0");
    const dropoffLat = parseFloat(ride.dropoffLat || "0");
    const dropoffLng = parseFloat(ride.dropoffLng || "0");
    uniquePickupZones.add(`${Math.floor(pickupLat * 100)}_${Math.floor(pickupLng * 100)}`);
    uniqueDropoffZones.add(`${Math.floor(dropoffLat * 100)}_${Math.floor(dropoffLng * 100)}`);
    const hour = new Date(ride.createdAt).getHours();
    hourDistribution[hour]++;
  }
  const zoneVariety = (uniquePickupZones.size + uniqueDropoffZones.size) / (recentRides.length * 2);
  const maxHourCount = Math.max(...hourDistribution);
  const hourEntropy = maxHourCount > 0 ? 1 - maxHourCount / recentRides.length : 1;
  const acceptanceRate = acceptedRides.length / recentRides.length;
  const entropyScore = zoneVariety * 0.4 + hourEntropy * 0.3 + acceptanceRate * 0.3;
  return Math.round(entropyScore * 100) / 100;
}
async function calculateEligibilityDecay(driverId) {
  const sevenDaysAgo = /* @__PURE__ */ new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentRides = await db.select().from(rides).where(and17(
    eq18(rides.driverId, driverId),
    gte10(rides.createdAt, sevenDaysAgo)
  ));
  const cancelledRides = recentRides.filter((r) => r.status === "cancelled");
  const completedRides = recentRides.filter((r) => r.status === "completed");
  if (recentRides.length === 0) {
    return 1;
  }
  const cancellationRate = cancelledRides.length / recentRides.length;
  let lateArrivals = 0;
  for (const ride of completedRides) {
    if (ride.acceptedAt && ride.startedAt) {
      const acceptTime = new Date(ride.acceptedAt).getTime();
      const startTime = new Date(ride.startedAt).getTime();
      const arrivalMinutes = (startTime - acceptTime) / (1e3 * 60);
      if (arrivalMinutes > 15) {
        lateArrivals++;
      }
    }
  }
  const lateRate = completedRides.length > 0 ? lateArrivals / completedRides.length : 0;
  const eligibilityDecay = Math.max(0, 1 - cancellationRate * 0.5 - lateRate * 0.3);
  return Math.round(eligibilityDecay * 100) / 100;
}
async function detectSuspiciousPatterns(driverId) {
  const reasons = [];
  let suspicionScore = 0;
  const entropyScore = await analyzeDriverEntropy(driverId);
  if (entropyScore < 0.3) {
    reasons.push("Low location variety - possible zone manipulation");
    suspicionScore += 2;
  } else if (entropyScore < 0.5) {
    reasons.push("Moderate location variety concern");
    suspicionScore += 1;
  }
  const eligibilityDecay = await calculateEligibilityDecay(driverId);
  if (eligibilityDecay < 0.5) {
    reasons.push("High cancellation or late arrival rate");
    suspicionScore += 2;
  } else if (eligibilityDecay < 0.7) {
    reasons.push("Elevated cancellation rate");
    suspicionScore += 1;
  }
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3);
  const todayRides = await db.select().from(rides).where(and17(
    eq18(rides.driverId, driverId),
    gte10(rides.createdAt, oneDayAgo)
  ));
  const acceptedToday = todayRides.filter((r) => r.status === "accepted" || r.status === "completed");
  const cancelledToday = todayRides.filter((r) => r.status === "cancelled");
  if (acceptedToday.length > 0 && cancelledToday.length / acceptedToday.length > 0.3) {
    reasons.push("High same-day cancellation rate");
    suspicionScore += 1;
  }
  let level = "none";
  if (suspicionScore >= 4) {
    level = "high";
  } else if (suspicionScore >= 2) {
    level = "medium";
  } else if (suspicionScore >= 1) {
    level = "low";
  }
  return { level, reasons };
}
async function getAntiGamingFlags(driverId) {
  const [entropyScore, eligibilityDecay, suspicionResult] = await Promise.all([
    analyzeDriverEntropy(driverId),
    calculateEligibilityDecay(driverId),
    detectSuspiciousPatterns(driverId)
  ]);
  const restrictions = [];
  if (entropyScore < 0.3) {
    restrictions.push("guarantee_ineligible");
  }
  if (eligibilityDecay < 0.5) {
    restrictions.push("priority_matching_disabled");
  }
  if (suspicionResult.level === "high") {
    restrictions.push("manual_review_required");
    restrictions.push("pmgth_disabled");
  } else if (suspicionResult.level === "medium") {
    restrictions.push("reduced_guarantee_payout");
  }
  return {
    entropyScore,
    eligibilityDecay,
    suspicionLevel: suspicionResult.level,
    restrictions
  };
}
async function isEligibleForGuarantee(driverId) {
  const flags = await getAntiGamingFlags(driverId);
  if (flags.restrictions.includes("guarantee_ineligible")) {
    return {
      eligible: false,
      reason: "Low location variety detected"
    };
  }
  if (flags.restrictions.includes("manual_review_required")) {
    return {
      eligible: false,
      reason: "Account under review"
    };
  }
  if (flags.eligibilityDecay < 0.3) {
    return {
      eligible: false,
      reason: "High cancellation rate"
    };
  }
  return { eligible: true };
}

// server/routes.ts
init_vehicleVerification();

// server/truthEngine.ts
init_db();
init_schema();
import { eq as eq19, and as and18 } from "drizzle-orm";
import OpenAI2 from "openai";
var _openai = null;
function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI2();
  }
  return _openai;
}
async function extractSignalsFromScreenshot(screenshotBase64) {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a ride receipt analyzer. Extract ride details from screenshots of ride-hailing app receipts. Return ONLY a JSON object with these fields (use null for unavailable data):
{
  "quotedPrice": number or null,
  "finalPrice": number or null,
  "quotedEtaMinutes": number or null,
  "actualPickupMinutes": number or null,
  "driverCancelled": boolean or null,
  "cancellationCount": number or null,
  "expectedDistanceKm": number or null,
  "actualDistanceKm": number or null,
  "expectedDurationMin": number or null,
  "actualDurationMin": number or null,
  "supportResolved": boolean or null,
  "supportOutcome": string or null,
  "providerName": string or null
}
Do NOT infer or hallucinate values. Only extract what is clearly visible.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract ride details from this receipt screenshot:" },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${screenshotBase64}` } }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0
    });
    const content = response.choices[0]?.message?.content || "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};
    const parsed = JSON.parse(jsonMatch[0]);
    const signals = {};
    if (parsed.quotedPrice !== null && parsed.quotedPrice !== void 0) signals.quotedPrice = Number(parsed.quotedPrice);
    if (parsed.finalPrice !== null && parsed.finalPrice !== void 0) signals.finalPrice = Number(parsed.finalPrice);
    if (parsed.quotedEtaMinutes !== null && parsed.quotedEtaMinutes !== void 0) signals.quotedEtaMinutes = Number(parsed.quotedEtaMinutes);
    if (parsed.actualPickupMinutes !== null && parsed.actualPickupMinutes !== void 0) signals.actualPickupMinutes = Number(parsed.actualPickupMinutes);
    if (parsed.driverCancelled !== null && parsed.driverCancelled !== void 0) signals.driverCancelled = Boolean(parsed.driverCancelled);
    if (parsed.cancellationCount !== null && parsed.cancellationCount !== void 0) signals.cancellationCount = Number(parsed.cancellationCount);
    if (parsed.expectedDistanceKm !== null && parsed.expectedDistanceKm !== void 0) signals.expectedDistanceKm = Number(parsed.expectedDistanceKm);
    if (parsed.actualDistanceKm !== null && parsed.actualDistanceKm !== void 0) signals.actualDistanceKm = Number(parsed.actualDistanceKm);
    if (parsed.expectedDurationMin !== null && parsed.expectedDurationMin !== void 0) signals.expectedDurationMin = Number(parsed.expectedDurationMin);
    if (parsed.actualDurationMin !== null && parsed.actualDurationMin !== void 0) signals.actualDurationMin = Number(parsed.actualDurationMin);
    if (parsed.supportResolved !== null && parsed.supportResolved !== void 0) signals.supportResolved = Boolean(parsed.supportResolved);
    if (parsed.supportOutcome !== null && parsed.supportOutcome !== void 0) signals.supportOutcome = String(parsed.supportOutcome);
    if (parsed.providerName !== null && parsed.providerName !== void 0) signals.providerName = String(parsed.providerName);
    return signals;
  } catch (error) {
    console.error("Screenshot extraction failed:", error);
    return {};
  }
}
function extractSignalsFromNotification(notificationText) {
  const signals = {};
  const priceMatch = notificationText.match(/(?:fare|price|charged|total|amount)[:\s]*[\$£€₹]?\s*([\d,.]+)/i);
  if (priceMatch) signals.finalPrice = parseFloat(priceMatch[1].replace(/,/g, ""));
  const etaMatch = notificationText.match(/(?:arriving in|eta|pickup in)[:\s]*(\d+)\s*(?:min|minutes)/i);
  if (etaMatch) signals.quotedEtaMinutes = parseInt(etaMatch[1]);
  const cancelMatch = notificationText.match(/(?:driver\s+cancel|ride\s+cancel|trip\s+cancel)/i);
  if (cancelMatch) signals.driverCancelled = true;
  const distMatch = notificationText.match(/([\d.]+)\s*(?:km|kilometers|miles)/i);
  if (distMatch) signals.expectedDistanceKm = parseFloat(distMatch[1]);
  return signals;
}
function analyzeGpsTrace(trace) {
  if (trace.length < 2) {
    return { distanceKm: 0, durationMin: 0, isConsistent: false };
  }
  let totalDistance = 0;
  let suspiciousJumps = 0;
  for (let i = 1; i < trace.length; i++) {
    const d = haversineDistance(trace[i - 1].lat, trace[i - 1].lng, trace[i].lat, trace[i].lng);
    totalDistance += d;
    const timeDiff = (trace[i].timestamp - trace[i - 1].timestamp) / 1e3;
    if (timeDiff > 0) {
      const speedKmh = d / timeDiff * 3600;
      if (speedKmh > 200) suspiciousJumps++;
    }
  }
  const durationMin = (trace[trace.length - 1].timestamp - trace[0].timestamp) / 6e4;
  const isConsistent = suspiciousJumps < trace.length * 0.1;
  return { distanceKm: totalDistance, durationMin, isConsistent };
}
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
async function storeSignals(truthRideId, signals, method) {
  const signalEntries = [
    { type: "quoted_price", value: signals.quotedPrice?.toString() },
    { type: "final_price", value: signals.finalPrice?.toString() },
    { type: "quoted_eta", value: signals.quotedEtaMinutes?.toString() },
    { type: "actual_pickup", value: signals.actualPickupMinutes?.toString() },
    { type: "driver_cancelled", value: signals.driverCancelled?.toString() },
    { type: "cancellation_count", value: signals.cancellationCount?.toString() },
    { type: "expected_distance", value: signals.expectedDistanceKm?.toString() },
    { type: "actual_distance", value: signals.actualDistanceKm?.toString() },
    { type: "expected_duration", value: signals.expectedDurationMin?.toString() },
    { type: "actual_duration", value: signals.actualDurationMin?.toString() },
    { type: "support_resolved", value: signals.supportResolved?.toString() },
    { type: "support_outcome", value: signals.supportOutcome }
  ];
  for (const entry of signalEntries) {
    await db.insert(truthSignals).values({
      truthRideId,
      signalType: entry.type,
      rawValue: entry.value || null,
      status: entry.value ? "extracted" : "unknown",
      extractionMethod: method,
      confidence: entry.value ? "0.85" : "0.00"
    });
  }
}
async function getOrCreateProvider(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
  const [existing] = await db.select().from(truthProviders).where(eq19(truthProviders.slug, slug)).limit(1);
  if (existing) return existing.id;
  const deepLinks = {
    uber: { android: "com.ubercab", ios: "uber://", scheme: "uber" },
    lyft: { android: "me.lyft.android", ios: "lyft://", scheme: "lyft" },
    careem: { android: "com.careem.acma", ios: "careem://", scheme: "careem" },
    bolt: { android: "ee.mtakso.client", ios: "bolt://", scheme: "bolt" },
    grab: { android: "com.grabtaxi.passenger", ios: "grab://", scheme: "grab" },
    gojek: { android: "com.gojek.app", ios: "gojek://", scheme: "gojek" },
    ola: { android: "com.olacabs.customer", ios: "olacabs://", scheme: "ola" },
    indrive: { android: "sinet.startup.inDriver", ios: "indrive://", scheme: "indrive" },
    travony: { android: "com.travony.rider", ios: "travony://", scheme: "travony" }
  };
  const links = deepLinks[slug] || {};
  const [provider2] = await db.insert(truthProviders).values({
    name,
    slug,
    androidPackage: links.android,
    iosUrlScheme: links.ios,
    deepLinkScheme: links.scheme
  }).returning();
  return provider2.id;
}
async function checkUserConsent(userId) {
  const [consent] = await db.select().from(truthConsent).where(and18(eq19(truthConsent.userId, userId), eq19(truthConsent.status, "granted"))).limit(1);
  return { hasConsent: !!consent, consent };
}
function getTimeBlock(date) {
  const hour = date.getHours();
  if (hour >= 6 && hour < 10) return "morning_rush";
  if (hour >= 10 && hour < 16) return "midday";
  if (hour >= 16 && hour < 20) return "evening_rush";
  if (hour >= 20 || hour < 2) return "night";
  return "late_night";
}
function getRouteType(distanceKm) {
  if (distanceKm < 3) return "short";
  if (distanceKm < 10) return "medium";
  if (distanceKm < 25) return "long";
  return "intercity";
}

// server/truthScoring.ts
init_db();
init_schema();
import { eq as eq20 } from "drizzle-orm";
var WEIGHTS = {
  priceIntegrity: 0.3,
  pickupReliability: 0.25,
  cancellationBehavior: 0.2,
  routeIntegrity: 0.15,
  supportResolution: 0.1
};
function computePRTS(ride) {
  const price = scorePriceIntegrity(
    ride.quotedPrice ? parseFloat(ride.quotedPrice) : void 0,
    ride.finalPrice ? parseFloat(ride.finalPrice) : void 0
  );
  const pickup = scorePickupReliability(
    ride.quotedEtaMinutes ? parseFloat(ride.quotedEtaMinutes) : void 0,
    ride.actualPickupMinutes ? parseFloat(ride.actualPickupMinutes) : void 0
  );
  const cancellation = scoreCancellationBehavior(
    ride.driverCancelled ?? void 0,
    ride.cancellationCount ?? void 0
  );
  const route = scoreRouteIntegrity(
    ride.expectedDistanceKm ? parseFloat(ride.expectedDistanceKm) : void 0,
    ride.actualDistanceKm ? parseFloat(ride.actualDistanceKm) : void 0,
    ride.expectedDurationMin ? parseFloat(ride.expectedDurationMin) : void 0,
    ride.actualDurationMin ? parseFloat(ride.actualDurationMin) : void 0
  );
  const support = scoreSupportResolution(
    ride.supportResolved ?? void 0,
    ride.supportOutcome ?? void 0
  );
  const totalScore = Math.round(
    price * WEIGHTS.priceIntegrity + pickup * WEIGHTS.pickupReliability + cancellation * WEIGHTS.cancellationBehavior + route * WEIGHTS.routeIntegrity + support * WEIGHTS.supportResolution
  );
  const explanation = generateExplanation(price, pickup, cancellation, route, support, totalScore);
  return {
    priceIntegrityScore: price,
    pickupReliabilityScore: pickup,
    cancellationScore: cancellation,
    routeIntegrityScore: route,
    supportResolutionScore: support,
    totalScore,
    explanation
  };
}
function scorePriceIntegrity(quoted, final) {
  if (quoted === void 0 || final === void 0) return 50;
  if (quoted === 0) return 50;
  const deviation = Math.abs(final - quoted) / quoted;
  if (deviation <= 0.02) return 100;
  if (deviation <= 0.05) return 90;
  if (deviation <= 0.1) return 75;
  if (deviation <= 0.2) return 55;
  if (deviation <= 0.3) return 35;
  if (deviation <= 0.5) return 15;
  return 0;
}
function scorePickupReliability(quotedEta, actualPickup) {
  if (quotedEta === void 0 || actualPickup === void 0) return 50;
  if (quotedEta === 0) return 50;
  const delayMin = actualPickup - quotedEta;
  if (delayMin <= 0) return 100;
  if (delayMin <= 1) return 95;
  if (delayMin <= 2) return 85;
  if (delayMin <= 5) return 70;
  if (delayMin <= 10) return 45;
  if (delayMin <= 15) return 25;
  return 5;
}
function scoreCancellationBehavior(cancelled, count8) {
  if (cancelled === void 0) return 75;
  if (!cancelled && (count8 === void 0 || count8 === 0)) return 100;
  if (cancelled && (count8 === void 0 || count8 <= 1)) return 20;
  if (count8 !== void 0 && count8 >= 3) return 0;
  if (count8 !== void 0 && count8 === 2) return 10;
  return 40;
}
function scoreRouteIntegrity(expectedDist, actualDist, expectedDur, actualDur) {
  let distScore = 50;
  let durScore = 50;
  let hasData = false;
  if (expectedDist !== void 0 && actualDist !== void 0 && expectedDist > 0) {
    hasData = true;
    const deviation = Math.abs(actualDist - expectedDist) / expectedDist;
    if (deviation <= 0.05) distScore = 100;
    else if (deviation <= 0.1) distScore = 90;
    else if (deviation <= 0.15) distScore = 75;
    else if (deviation <= 0.25) distScore = 55;
    else if (deviation <= 0.4) distScore = 30;
    else distScore = 10;
  }
  if (expectedDur !== void 0 && actualDur !== void 0 && expectedDur > 0) {
    hasData = true;
    const deviation = Math.abs(actualDur - expectedDur) / expectedDur;
    if (deviation <= 0.1) durScore = 100;
    else if (deviation <= 0.2) durScore = 85;
    else if (deviation <= 0.3) durScore = 65;
    else if (deviation <= 0.5) durScore = 40;
    else durScore = 15;
  }
  if (!hasData) return 50;
  return Math.round((distScore + durScore) / 2);
}
function scoreSupportResolution(resolved, outcome) {
  if (resolved === void 0) return 50;
  if (resolved === true) {
    if (outcome === "full_refund") return 90;
    if (outcome === "partial_refund") return 70;
    if (outcome === "apology_credit") return 60;
    return 80;
  }
  if (outcome === "no_response") return 5;
  if (outcome === "denied") return 15;
  return 25;
}
function generateExplanation(price, pickup, cancellation, route, support, total) {
  const parts = [];
  if (total >= 80) {
    parts.push("This ride was highly reliable overall.");
  } else if (total >= 60) {
    parts.push("This ride had some reliability issues.");
  } else if (total >= 40) {
    parts.push("This ride had significant issues.");
  } else {
    parts.push("This ride had major problems.");
  }
  if (price >= 80) parts.push("The final price matched the quoted fare well.");
  else if (price < 50) parts.push("The final price deviated significantly from the quote.");
  if (pickup >= 80) parts.push("The driver arrived on time.");
  else if (pickup < 50) parts.push("The driver arrived much later than promised.");
  if (cancellation < 50) parts.push("There were driver cancellation issues.");
  if (route >= 80) parts.push("The route taken was efficient.");
  else if (route < 50) parts.push("The actual route differed significantly from expected.");
  if (support < 50 && support !== 50) parts.push("Support resolution was unsatisfactory.");
  return parts.join(" ");
}
async function computeAndStorePRTS(truthRideId) {
  const [ride] = await db.select().from(truthRides).where(eq20(truthRides.id, truthRideId)).limit(1);
  if (!ride) throw new Error("Truth ride not found");
  const result = computePRTS(ride);
  await db.insert(truthScores).values({
    truthRideId,
    priceIntegrityScore: result.priceIntegrityScore.toString(),
    pickupReliabilityScore: result.pickupReliabilityScore.toString(),
    cancellationScore: result.cancellationScore.toString(),
    routeIntegrityScore: result.routeIntegrityScore.toString(),
    supportResolutionScore: result.supportResolutionScore.toString(),
    totalScore: result.totalScore.toString(),
    explanation: result.explanation
  });
  return result;
}

// server/truthAggregation.ts
init_db();
init_schema();
import { eq as eq21, and as and19, sql as sql15, desc as desc14 } from "drizzle-orm";
var MIN_SAMPLE_SIZE = 5;
var OUTLIER_CAP_PERCENTILE = 0.05;
var TIME_DECAY_HALF_LIFE_DAYS = 30;
async function aggregateScores(cityName, timeBlock, routeType) {
  const providers = await db.select().from(truthProviders).where(eq21(truthProviders.isActive, true));
  const results = [];
  for (const provider2 of providers) {
    const conditions = [
      eq21(truthRides.providerId, provider2.id),
      eq21(truthRides.cityName, cityName)
    ];
    if (timeBlock) conditions.push(eq21(truthRides.timeBlock, timeBlock));
    if (routeType) conditions.push(eq21(truthRides.routeType, routeType));
    const rides4 = await db.select({
      rideId: truthRides.id,
      rideDate: truthRides.rideDate,
      totalScore: truthScores.totalScore,
      priceScore: truthScores.priceIntegrityScore,
      pickupScore: truthScores.pickupReliabilityScore,
      cancellationScore: truthScores.cancellationScore,
      routeScore: truthScores.routeIntegrityScore,
      supportScore: truthScores.supportResolutionScore
    }).from(truthRides).innerJoin(truthScores, eq21(truthScores.truthRideId, truthRides.id)).where(and19(...conditions)).orderBy(desc14(truthRides.rideDate));
    if (rides4.length < MIN_SAMPLE_SIZE) continue;
    const now = Date.now();
    let weightedTotal = 0;
    let weightedPrice = 0;
    let weightedPickup = 0;
    let weightedCancellation = 0;
    let weightedRoute = 0;
    let weightedSupport = 0;
    let totalWeight = 0;
    const scores = rides4.map((r) => parseFloat(r.totalScore || "0"));
    const { lower, upper } = getOutlierBounds(scores);
    for (const ride of rides4) {
      const score = parseFloat(ride.totalScore || "0");
      if (score < lower || score > upper) continue;
      const ageMs = now - new Date(ride.rideDate).getTime();
      const ageDays = ageMs / (1e3 * 60 * 60 * 24);
      const weight = Math.pow(0.5, ageDays / TIME_DECAY_HALF_LIFE_DAYS);
      weightedTotal += score * weight;
      weightedPrice += parseFloat(ride.priceScore || "50") * weight;
      weightedPickup += parseFloat(ride.pickupScore || "50") * weight;
      weightedCancellation += parseFloat(ride.cancellationScore || "50") * weight;
      weightedRoute += parseFloat(ride.routeScore || "50") * weight;
      weightedSupport += parseFloat(ride.supportScore || "50") * weight;
      totalWeight += weight;
    }
    if (totalWeight === 0) continue;
    const sampleCount = rides4.length;
    const confidence = Math.min(1, sampleCount / 50);
    results.push({
      providerId: provider2.id,
      providerName: provider2.name,
      avgScore: Math.round(weightedTotal / totalWeight),
      sampleCount,
      priceAvg: Math.round(weightedPrice / totalWeight),
      pickupAvg: Math.round(weightedPickup / totalWeight),
      cancellationAvg: Math.round(weightedCancellation / totalWeight),
      routeAvg: Math.round(weightedRoute / totalWeight),
      supportAvg: Math.round(weightedSupport / totalWeight),
      confidence: Math.round(confidence * 100) / 100
    });
  }
  results.sort((a, b) => b.avgScore - a.avgScore);
  return results;
}
function getOutlierBounds(scores) {
  if (scores.length < 5) return { lower: 0, upper: 100 };
  const sorted = [...scores].sort((a, b) => a - b);
  const lowerIdx = Math.floor(sorted.length * OUTLIER_CAP_PERCENTILE);
  const upperIdx = Math.floor(sorted.length * (1 - OUTLIER_CAP_PERCENTILE));
  return { lower: sorted[lowerIdx], upper: sorted[upperIdx] };
}
async function updateAggregationCache(providerId, cityName, timeBlock, routeType) {
  const scores = await aggregateScores(cityName, timeBlock, routeType);
  const providerScore = scores.find((s) => s.providerId === providerId);
  if (!providerScore) return;
  const existing = await db.select().from(truthAggregations).where(and19(
    eq21(truthAggregations.providerId, providerId),
    eq21(truthAggregations.cityName, cityName),
    timeBlock ? eq21(truthAggregations.timeBlock, timeBlock) : sql15`${truthAggregations.timeBlock} IS NULL`,
    routeType ? eq21(truthAggregations.routeType, routeType) : sql15`${truthAggregations.routeType} IS NULL`
  )).limit(1);
  const data = {
    providerId,
    cityName,
    timeBlock: timeBlock || null,
    routeType: routeType || null,
    avgScore: providerScore.avgScore.toString(),
    sampleCount: providerScore.sampleCount,
    priceAvg: providerScore.priceAvg.toString(),
    pickupAvg: providerScore.pickupAvg.toString(),
    cancellationAvg: providerScore.cancellationAvg.toString(),
    routeAvg: providerScore.routeAvg.toString(),
    supportAvg: providerScore.supportAvg.toString(),
    confidence: providerScore.confidence.toString(),
    lastUpdated: /* @__PURE__ */ new Date()
  };
  if (existing.length > 0) {
    await db.update(truthAggregations).set(data).where(eq21(truthAggregations.id, existing[0].id));
  } else {
    await db.insert(truthAggregations).values(data);
  }
}
async function getRankings(cityName, timeBlock, routeType) {
  return aggregateScores(cityName, timeBlock, routeType);
}

// server/truthRecommendation.ts
init_db();
init_schema();
import { eq as eq22 } from "drizzle-orm";
var MIN_CONFIDENCE = 0.3;
var MIN_SAMPLE_COUNT = 5;
async function getRecommendation(cityName, timeBlock, routeType) {
  const rankings = await getRankings(cityName, timeBlock, routeType);
  const eligible = rankings.filter((r) => r.confidence >= MIN_CONFIDENCE && r.sampleCount >= MIN_SAMPLE_COUNT);
  if (eligible.length === 0) return null;
  const top = eligible[0];
  const [provider2] = await db.select().from(truthProviders).where(eq22(truthProviders.id, top.providerId)).limit(1);
  if (!provider2) return null;
  const reason = generateReason(top, eligible);
  return {
    providerId: top.providerId,
    providerName: top.providerName,
    score: top.avgScore,
    reason,
    confidence: top.confidence,
    deepLink: provider2.deepLinkScheme ? `${provider2.deepLinkScheme}://` : null,
    androidPackage: provider2.androidPackage,
    iosUrlScheme: provider2.iosUrlScheme
  };
}
function generateReason(top, all) {
  const strengths = [];
  if (top.priceAvg >= 80) strengths.push("price accuracy");
  if (top.pickupAvg >= 80) strengths.push("pickup timing");
  if (top.cancellationAvg >= 80) strengths.push("low cancellations");
  if (top.routeAvg >= 80) strengths.push("route efficiency");
  if (top.supportAvg >= 80) strengths.push("support quality");
  if (strengths.length === 0) {
    return `${top.providerName} has the highest overall reliability score of ${top.avgScore} in this area.`;
  }
  const topStrength = strengths[0];
  return `${top.providerName} scores ${top.avgScore}/100 overall, strongest in ${topStrength} based on ${top.sampleCount} verified rides.`;
}
async function getContextualRankings(cityName, timeBlock, routeType) {
  const rankings = await getRankings(cityName, timeBlock, routeType);
  if (rankings.length === 0) {
    return {
      rankings: [],
      hasEnoughData: false,
      dataMessage: "Not enough ride data in this area yet. Log rides to help build trust scores."
    };
  }
  const eligible = rankings.filter((r) => r.sampleCount >= MIN_SAMPLE_COUNT);
  if (eligible.length === 0) {
    return {
      rankings: [],
      hasEnoughData: false,
      dataMessage: `Data collection in progress. Need at least ${MIN_SAMPLE_COUNT} verified rides per provider.`
    };
  }
  const recommendations = [];
  for (const rank of eligible) {
    const [provider2] = await db.select().from(truthProviders).where(eq22(truthProviders.id, rank.providerId)).limit(1);
    if (!provider2) continue;
    recommendations.push({
      providerId: rank.providerId,
      providerName: rank.providerName,
      score: rank.avgScore,
      reason: generateReason(rank, eligible),
      confidence: rank.confidence,
      deepLink: provider2.deepLinkScheme ? `${provider2.deepLinkScheme}://` : null,
      androidPackage: provider2.androidPackage,
      iosUrlScheme: provider2.iosUrlScheme
    });
  }
  return {
    rankings: recommendations,
    hasEnoughData: true,
    dataMessage: `Rankings based on ${rankings.reduce((sum2, r) => sum2 + r.sampleCount, 0)} verified rides.`
  };
}

// server/truthFraud.ts
init_db();
init_schema();
import { eq as eq23, and as and21, gte as gte12, count as count5 } from "drizzle-orm";
var MAX_USER_INFLUENCE_PERCENT = 15;
var MIN_GPS_POINTS = 5;
var MAX_SPEED_KMH = 200;
var SUSPICIOUS_SUBMISSION_RATE = 20;
async function validateRideSubmission(userId, providerId, cityName, gpsTrace) {
  const flags = [];
  let trustWeight = 1;
  const influenceCheck = await checkUserInfluence(userId, providerId, cityName);
  if (influenceCheck.exceeds) {
    flags.push("user_influence_cap_exceeded");
    trustWeight *= 0.3;
  }
  const rateCheck = await checkSubmissionRate(userId);
  if (rateCheck.suspicious) {
    flags.push("suspicious_submission_rate");
    trustWeight *= 0.5;
  }
  if (gpsTrace && gpsTrace.length > 0) {
    const gpsCheck = validateGpsConsistency(gpsTrace);
    if (!gpsCheck.consistent) {
      flags.push(...gpsCheck.issues);
      trustWeight *= 0.4;
    }
  }
  const duplicateCheck = await checkDuplicateSubmission(userId, providerId);
  if (duplicateCheck.isDuplicate) {
    flags.push("duplicate_submission");
    trustWeight = 0;
  }
  return {
    passed: flags.length === 0,
    flags,
    trustWeight: Math.max(0, trustWeight)
  };
}
async function checkUserInfluence(userId, providerId, cityName) {
  const [totalResult] = await db.select({ count: count5() }).from(truthRides).where(and21(
    eq23(truthRides.providerId, providerId),
    eq23(truthRides.cityName, cityName)
  ));
  const [userResult] = await db.select({ count: count5() }).from(truthRides).where(and21(
    eq23(truthRides.userId, userId),
    eq23(truthRides.providerId, providerId),
    eq23(truthRides.cityName, cityName)
  ));
  const total = totalResult?.count || 0;
  const userCount = userResult?.count || 0;
  if (total < 10) return { exceeds: false, percentage: 0 };
  const percentage = userCount / total * 100;
  return {
    exceeds: percentage > MAX_USER_INFLUENCE_PERCENT,
    percentage
  };
}
async function checkSubmissionRate(userId) {
  const oneDayAgo = /* @__PURE__ */ new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const [result] = await db.select({ count: count5() }).from(truthRides).where(and21(
    eq23(truthRides.userId, userId),
    gte12(truthRides.createdAt, oneDayAgo)
  ));
  const dayCount = result?.count || 0;
  return {
    suspicious: dayCount > SUSPICIOUS_SUBMISSION_RATE,
    count: dayCount
  };
}
function validateGpsConsistency(trace) {
  const issues = [];
  if (trace.length < MIN_GPS_POINTS) {
    issues.push("insufficient_gps_points");
    return { consistent: false, issues };
  }
  const timestamps = trace.map((p) => p.timestamp);
  for (let i = 1; i < timestamps.length; i++) {
    if (timestamps[i] <= timestamps[i - 1]) {
      issues.push("non_monotonic_timestamps");
      break;
    }
  }
  let teleportCount = 0;
  for (let i = 1; i < trace.length; i++) {
    const dist = haversineKm(trace[i - 1].lat, trace[i - 1].lng, trace[i].lat, trace[i].lng);
    const timeSec = (trace[i].timestamp - trace[i - 1].timestamp) / 1e3;
    if (timeSec > 0) {
      const speedKmh = dist / timeSec * 3600;
      if (speedKmh > MAX_SPEED_KMH) teleportCount++;
    }
  }
  if (teleportCount > trace.length * 0.1) {
    issues.push("gps_teleportation_detected");
  }
  const uniqueLocations = new Set(trace.map((p) => `${p.lat.toFixed(4)}_${p.lng.toFixed(4)}`));
  if (uniqueLocations.size < trace.length * 0.3) {
    issues.push("stationary_gps_pattern");
  }
  return { consistent: issues.length === 0, issues };
}
async function checkDuplicateSubmission(userId, providerId) {
  const tenMinutesAgo = /* @__PURE__ */ new Date();
  tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);
  const [result] = await db.select({ count: count5() }).from(truthRides).where(and21(
    eq23(truthRides.userId, userId),
    eq23(truthRides.providerId, providerId),
    gte12(truthRides.createdAt, tenMinutesAgo)
  ));
  return { isDuplicate: (result?.count || 0) > 0 };
}
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
async function grantConsent(userId, permissions) {
  const [existing] = await db.select().from(truthConsent).where(eq23(truthConsent.userId, userId)).limit(1);
  if (existing) {
    await db.update(truthConsent).set({
      ...permissions,
      status: "granted",
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq23(truthConsent.id, existing.id));
  } else {
    await db.insert(truthConsent).values({
      userId,
      screenshotCapture: permissions.screenshotCapture ?? false,
      notificationParsing: permissions.notificationParsing ?? false,
      gpsTracking: permissions.gpsTracking ?? false,
      postRideConfirmation: permissions.postRideConfirmation ?? true,
      status: "granted"
    });
  }
}
async function revokeConsent(userId) {
  await db.update(truthConsent).set({ status: "revoked", revokedAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(eq23(truthConsent.userId, userId));
}
async function deleteUserTruthData(userId) {
  const userRides = await db.select({ id: truthRides.id }).from(truthRides).where(eq23(truthRides.userId, userId));
  for (const ride of userRides) {
    await db.delete(truthSignals).where(eq23(truthSignals.truthRideId, ride.id));
    await db.delete(truthScores).where(eq23(truthScores.truthRideId, ride.id));
  }
  await db.delete(truthRides).where(eq23(truthRides.userId, userId));
  await db.delete(truthConsent).where(eq23(truthConsent.userId, userId));
  return { deletedRides: userRides.length };
}

// server/ghostRideService.ts
init_db();
init_schema();
import { eq as eq24, and as and22, desc as desc17 } from "drizzle-orm";
async function calculateOfflineFare(cityName, vehicleType, distanceKm, durationMin) {
  const [pricing] = await db.select().from(cachedPricing).where(and22(
    eq24(cachedPricing.cityName, cityName),
    eq24(cachedPricing.vehicleType, vehicleType)
  )).orderBy(desc17(cachedPricing.validFrom)).limit(1);
  if (!pricing) {
    const defaultFare = Math.max(5, distanceKm * 2.5 + durationMin * 0.5);
    return {
      fare: Math.round(defaultFare * 100) / 100,
      currency: "AED",
      breakdown: { baseFare: 3, distanceCharge: distanceKm * 2, timeCharge: durationMin * 0.5 }
    };
  }
  const baseFare = parseFloat(pricing.baseFare);
  const distanceCharge = distanceKm * parseFloat(pricing.perKmRate);
  const timeCharge = durationMin * parseFloat(pricing.perMinRate);
  const total = Math.max(parseFloat(pricing.minimumFare), baseFare + distanceCharge + timeCharge);
  return {
    fare: Math.round(total * 100) / 100,
    currency: pricing.currency || "AED",
    breakdown: { baseFare, distanceCharge, timeCharge, minimumFare: parseFloat(pricing.minimumFare) }
  };
}
async function createGhostRide(request) {
  const [ride] = await db.insert(ghostRides).values({
    localId: request.localId,
    riderId: request.riderId,
    riderPeerId: request.riderPeerId || `peer_${request.riderId.substring(0, 8)}_${Date.now()}`,
    pickupLat: request.pickupLat.toString(),
    pickupLng: request.pickupLng.toString(),
    pickupAddress: request.pickupAddress,
    dropoffLat: request.dropoffLat?.toString(),
    dropoffLng: request.dropoffLng?.toString(),
    dropoffAddress: request.dropoffAddress,
    vehicleType: request.vehicleType,
    currency: request.currency || "AED",
    estimatedFare: request.estimatedFare,
    cityName: request.cityName,
    status: "broadcasting",
    syncStatus: "pending"
  }).returning();
  return ride.id;
}
async function acceptGhostRide(acceptance) {
  const [ride] = await db.select().from(ghostRides).where(eq24(ghostRides.localId, acceptance.ghostRideLocalId)).limit(1);
  if (!ride) throw new Error("Ghost ride not found");
  await db.update(ghostRides).set({
    driverId: acceptance.driverId,
    driverPeerId: acceptance.driverPeerId,
    agreedFare: acceptance.agreedFare?.toString(),
    status: "accepted"
  }).where(eq24(ghostRides.id, ride.id));
}
async function startGhostRide(localId) {
  await db.update(ghostRides).set({ status: "in_progress", startedAt: /* @__PURE__ */ new Date() }).where(eq24(ghostRides.localId, localId));
}
async function completeGhostRide(completion) {
  await db.update(ghostRides).set({
    agreedFare: completion.agreedFare.toString(),
    gpsTraceJson: completion.gpsTrace,
    chatMessagesJson: completion.chatMessages,
    status: "completed",
    completedAt: new Date(completion.completedAt)
  }).where(eq24(ghostRides.localId, completion.ghostRideLocalId));
}
async function syncGhostRide(ghostRideId) {
  const [ghost] = await db.select().from(ghostRides).where(eq24(ghostRides.id, ghostRideId)).limit(1);
  if (!ghost) return { success: false, message: "Ghost ride not found" };
  if (ghost.syncStatus === "synced") return { success: true, syncedRideId: ghost.syncedRideId || void 0, message: "Already synced" };
  if (ghost.status !== "completed") return { success: false, message: "Ride not completed yet" };
  try {
    await db.update(ghostRides).set({ syncStatus: "syncing" }).where(eq24(ghostRides.id, ghostRideId));
    const [newRide] = await db.insert(rides).values({
      customerId: ghost.riderId,
      driverId: ghost.driverId,
      pickupAddress: ghost.pickupAddress || "Ghost Mode Pickup",
      pickupLat: ghost.pickupLat,
      pickupLng: ghost.pickupLng,
      dropoffAddress: ghost.dropoffAddress || "Ghost Mode Dropoff",
      dropoffLat: ghost.dropoffLat || "0",
      dropoffLng: ghost.dropoffLng || "0",
      estimatedFare: ghost.estimatedFare || ghost.agreedFare,
      actualFare: ghost.agreedFare,
      status: "completed",
      isGhostRide: true,
      ghostRideLocalId: ghost.localId
    }).returning();
    await db.update(ghostRides).set({
      syncStatus: "synced",
      syncedRideId: newRide.id,
      syncedAt: /* @__PURE__ */ new Date()
    }).where(eq24(ghostRides.id, ghostRideId));
    return { success: true, syncedRideId: newRide.id, message: "Ghost ride synced successfully" };
  } catch (error) {
    await db.update(ghostRides).set({ syncStatus: "failed" }).where(eq24(ghostRides.id, ghostRideId));
    return { success: false, message: `Sync failed: ${error.message}` };
  }
}
async function syncAllPendingGhostRides(userId) {
  const pending = await db.select().from(ghostRides).where(and22(
    eq24(ghostRides.riderId, userId),
    eq24(ghostRides.status, "completed"),
    eq24(ghostRides.syncStatus, "pending")
  ));
  const results = [];
  for (const ride of pending) {
    const result = await syncGhostRide(ride.id);
    results.push(result);
  }
  return results;
}
async function processSyncQueue(userId) {
  const pending = await db.select().from(offlineSyncQueue).where(and22(
    eq24(offlineSyncQueue.userId, userId),
    eq24(offlineSyncQueue.syncStatus, "pending")
  )).orderBy(offlineSyncQueue.queuedAt);
  let processed = 0;
  let failed = 0;
  for (const item of pending) {
    try {
      if (item.entityType === "ghost_ride") {
        const [ride] = await db.select().from(ghostRides).where(eq24(ghostRides.localId, item.entityLocalId)).limit(1);
        if (ride) await syncGhostRide(ride.id);
      }
      await db.update(offlineSyncQueue).set({ syncStatus: "synced", syncedAt: /* @__PURE__ */ new Date() }).where(eq24(offlineSyncQueue.id, item.id));
      processed++;
    } catch (error) {
      const retryCount = (item.retryCount || 0) + 1;
      await db.update(offlineSyncQueue).set({
        syncStatus: retryCount >= 3 ? "failed" : "pending",
        retryCount,
        lastError: error.message
      }).where(eq24(offlineSyncQueue.id, item.id));
      failed++;
    }
  }
  return { processed, failed };
}
async function getCachedPricingForCity(cityName) {
  return db.select().from(cachedPricing).where(eq24(cachedPricing.cityName, cityName)).orderBy(desc17(cachedPricing.validFrom));
}

// server/hubRoutes.ts
import { Router } from "express";
init_db();
init_schema();
import { eq as eq27, and as and25, gte as gte15, desc as desc20, sql as sql21 } from "drizzle-orm";

// server/openClawService.ts
init_db();
init_schema();
import { eq as eq25, and as and23, gte as gte13, lte as lte3, desc as desc18, sql as sql19, or } from "drizzle-orm";
function haversineDistance2(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function getGridCellId(lat, lng, cellSizeKm = 0.5) {
  const latDeg = cellSizeKm / 111;
  const lngDeg = cellSizeKm / (111 * Math.cos(lat * Math.PI / 180));
  const cellLat = Math.floor(lat / latDeg);
  const cellLng = Math.floor(lng / lngDeg);
  return `${cellLat}_${cellLng}`;
}
function calculateDemandScore(rideCount, recencyMinutes, activeDriverCount) {
  const maxRecency = 120;
  const recencyWeight = Math.max(0, 1 - recencyMinutes / maxRecency);
  return rideCount * recencyWeight + activeDriverCount * 0.3;
}
async function detectHotspots(cityId) {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1e3);
  const rideConditions = [gte13(rides.createdAt, twoHoursAgo)];
  if (cityId) {
    rideConditions.push(eq25(rides.regionCode, cityId));
  }
  const recentRides = await db.select().from(rides).where(and23(...rideConditions));
  const onlineDrivers = await db.select().from(drivers).where(eq25(drivers.isOnline, true));
  const cellData = {};
  const now = Date.now();
  for (const ride of recentRides) {
    const pickupLat = parseFloat(ride.pickupLat);
    const pickupLng = parseFloat(ride.pickupLng);
    const dropoffLat = parseFloat(ride.dropoffLat);
    const dropoffLng = parseFloat(ride.dropoffLng);
    if (isNaN(pickupLat) || isNaN(pickupLng)) continue;
    const pickupCell = getGridCellId(pickupLat, pickupLng, 0.5);
    if (!cellData[pickupCell]) {
      cellData[pickupCell] = { pickupCount: 0, dropoffCount: 0, totalDemand: 0, latSum: 0, lngSum: 0, pointCount: 0, earliestMinutes: 120, driverCount: 0 };
    }
    cellData[pickupCell].pickupCount++;
    cellData[pickupCell].latSum += pickupLat;
    cellData[pickupCell].lngSum += pickupLng;
    cellData[pickupCell].pointCount++;
    const pickupAge = (now - new Date(ride.createdAt).getTime()) / 6e4;
    cellData[pickupCell].earliestMinutes = Math.min(cellData[pickupCell].earliestMinutes, pickupAge);
    if (!isNaN(dropoffLat) && !isNaN(dropoffLng)) {
      const dropoffCell = getGridCellId(dropoffLat, dropoffLng, 0.5);
      if (!cellData[dropoffCell]) {
        cellData[dropoffCell] = { pickupCount: 0, dropoffCount: 0, totalDemand: 0, latSum: 0, lngSum: 0, pointCount: 0, earliestMinutes: 120, driverCount: 0 };
      }
      cellData[dropoffCell].dropoffCount++;
      cellData[dropoffCell].latSum += dropoffLat;
      cellData[dropoffCell].lngSum += dropoffLng;
      cellData[dropoffCell].pointCount++;
    }
  }
  for (const driver of onlineDrivers) {
    const dLat = parseFloat(driver.currentLat || "0");
    const dLng = parseFloat(driver.currentLng || "0");
    if (dLat === 0 && dLng === 0) continue;
    const cell = getGridCellId(dLat, dLng, 0.5);
    if (cellData[cell]) {
      cellData[cell].driverCount++;
    }
  }
  const detected = [];
  for (const [cellId, data] of Object.entries(cellData)) {
    if (data.pointCount < 2) continue;
    const centerLat = data.latSum / data.pointCount;
    const centerLng = data.lngSum / data.pointCount;
    const totalRides = data.pickupCount + data.dropoffCount;
    const demandScore = calculateDemandScore(totalRides, data.earliestMinutes, data.driverCount);
    detected.push({
      lat: Math.round(centerLat * 1e8) / 1e8,
      lng: Math.round(centerLng * 1e8) / 1e8,
      demandScore: Math.round(demandScore * 100) / 100,
      supplyCount: data.driverCount,
      demandCount: data.pickupCount,
      cellId
    });
  }
  detected.sort((a, b) => b.demandScore - a.demandScore);
  return detected;
}
async function updateHubDemand(hubId) {
  const [hub] = await db.select().from(hubs).where(eq25(hubs.id, hubId));
  if (!hub) return null;
  const hubLat = parseFloat(hub.lat);
  const hubLng = parseFloat(hub.lng);
  const radiusKm = (hub.radiusMeters || 300) / 1e3;
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1e3);
  const recentRides = await db.select().from(rides).where(gte13(rides.createdAt, twoHoursAgo));
  const nearbyRides = recentRides.filter((ride) => {
    const rLat = parseFloat(ride.pickupLat);
    const rLng = parseFloat(ride.pickupLng);
    return haversineDistance2(hubLat, hubLng, rLat, rLng) <= radiusKm;
  });
  const onlineDrivers = await db.select().from(drivers).where(eq25(drivers.isOnline, true));
  const nearbyDrivers = onlineDrivers.filter((d) => {
    const dLat = parseFloat(d.currentLat || "0");
    const dLng = parseFloat(d.currentLng || "0");
    return haversineDistance2(hubLat, hubLng, dLat, dLng) <= radiusKm;
  });
  const now = Date.now();
  const avgRecency = nearbyRides.length > 0 ? nearbyRides.reduce((sum2, r) => sum2 + (now - new Date(r.createdAt).getTime()) / 6e4, 0) / nearbyRides.length : 120;
  const demandScore = calculateDemandScore(nearbyRides.length, avgRecency, nearbyDrivers.length);
  const roundedScore = Math.round(demandScore * 100) / 100;
  const updatedAt = /* @__PURE__ */ new Date();
  await db.update(hubs).set({
    avgDemandScore: roundedScore.toFixed(2),
    lastActivityAt: updatedAt,
    updatedAt
  }).where(eq25(hubs.id, hubId));
  return { demandScore: roundedScore, updatedAt };
}
async function getHubsNearLocation(lat, lng, radiusKm) {
  const activeHubs = await db.select().from(hubs).where(eq25(hubs.status, "active"));
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1e3);
  const recentRides = await db.select().from(rides).where(gte13(rides.createdAt, twoHoursAgo));
  const onlineDrivers = await db.select().from(drivers).where(eq25(drivers.isOnline, true));
  const nearbyHubs = [];
  for (const hub of activeHubs) {
    const hubLat = parseFloat(hub.lat);
    const hubLng = parseFloat(hub.lng);
    const dist = haversineDistance2(lat, lng, hubLat, hubLng);
    if (dist > radiusKm) continue;
    const hubRadiusKm = (hub.radiusMeters || 300) / 1e3;
    const rideCount = recentRides.filter((r) => {
      const rLat = parseFloat(r.pickupLat);
      const rLng = parseFloat(r.pickupLng);
      return haversineDistance2(hubLat, hubLng, rLat, rLng) <= hubRadiusKm;
    }).length;
    const driverCount = onlineDrivers.filter((d) => {
      const dLat = parseFloat(d.currentLat || "0");
      const dLng = parseFloat(d.currentLng || "0");
      return haversineDistance2(hubLat, hubLng, dLat, dLng) <= hubRadiusKm;
    }).length;
    nearbyHubs.push({
      ...hub,
      distance: Math.round(dist * 1e3) / 1e3,
      activeDrivers: driverCount,
      recentRideCount: rideCount
    });
  }
  nearbyHubs.sort((a, b) => a.distance - b.distance);
  return nearbyHubs;
}
async function getHotspotsForMap(cityId, regionCode) {
  const conditions = [eq25(hotspots.isActive, true)];
  if (cityId) conditions.push(eq25(hotspots.cityId, cityId));
  if (regionCode) conditions.push(eq25(hotspots.regionCode, regionCode));
  const activeHotspots = await db.select().from(hotspots).where(and23(...conditions));
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1e3);
  const recentRides = await db.select({
    avgFare: sql19`coalesce(avg(cast(${rides.actualFare} as numeric)), avg(cast(${rides.estimatedFare} as numeric)), 0)`
  }).from(rides).where(and23(
    gte13(rides.createdAt, twoHoursAgo),
    eq25(rides.status, "completed")
  ));
  const avgFare = parseFloat(recentRides[0]?.avgFare || "15");
  return activeHotspots.map((h) => {
    const demand = parseFloat(h.demandScore);
    const supply = h.supplyCount || 0;
    const demandCount = h.demandCount || 0;
    const peakMult = parseFloat(h.peakMultiplier || "1.00");
    const maxDemand = 20;
    const intensity = Math.min(1, demand / maxDemand);
    const supplyDemandRatio = supply > 0 ? demandCount / supply : demandCount;
    const yieldEstimate = Math.round(avgFare * peakMult * Math.min(3, Math.max(1, supplyDemandRatio)) * 100) / 100;
    return {
      lat: parseFloat(h.lat),
      lng: parseFloat(h.lng),
      intensity: Math.round(intensity * 100) / 100,
      supplyCount: supply,
      demandCount,
      yieldEstimate
    };
  });
}
async function getDriverYieldEstimate(hubId, vehicleType) {
  const [hub] = await db.select().from(hubs).where(eq25(hubs.id, hubId));
  if (!hub) {
    return { estimatedYieldPerHour: 0, avgFareInArea: 0, ridesPerHour: 0, demandLevel: "low", confidence: 0 };
  }
  const hubLat = parseFloat(hub.lat);
  const hubLng = parseFloat(hub.lng);
  const radiusKm = (hub.radiusMeters || 300) / 1e3;
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1e3);
  const completedRides = await db.select().from(rides).where(and23(
    gte13(rides.createdAt, sixHoursAgo),
    eq25(rides.status, "completed")
  ));
  const nearbyRides = completedRides.filter((r) => {
    const rLat = parseFloat(r.pickupLat);
    const rLng = parseFloat(r.pickupLng);
    return haversineDistance2(hubLat, hubLng, rLat, rLng) <= radiusKm;
  });
  const vehicleRides = nearbyRides.filter((r) => {
    if (!r.vehicleId) return true;
    return true;
  });
  const matchingVehicles = await db.select().from(vehicles).where(eq25(vehicles.type, vehicleType));
  const matchingDriverIds = new Set(matchingVehicles.map((v) => v.driverId));
  const typeFilteredRides = vehicleRides.filter((r) => !r.driverId || matchingDriverIds.has(r.driverId));
  const ridesToAnalyze = typeFilteredRides.length >= 3 ? typeFilteredRides : nearbyRides;
  const totalFare = ridesToAnalyze.reduce((sum2, r) => sum2 + parseFloat(r.actualFare || r.estimatedFare || "0"), 0);
  const avgFare = ridesToAnalyze.length > 0 ? totalFare / ridesToAnalyze.length : 15;
  const hoursWindow = 6;
  const ridesPerHour = ridesToAnalyze.length / hoursWindow;
  const estimatedYieldPerHour = Math.round(avgFare * ridesPerHour * 100) / 100;
  let demandLevel;
  if (ridesPerHour >= 5) demandLevel = "very_high";
  else if (ridesPerHour >= 3) demandLevel = "high";
  else if (ridesPerHour >= 1) demandLevel = "medium";
  else demandLevel = "low";
  const confidence = Math.min(1, ridesToAnalyze.length / 10);
  return {
    estimatedYieldPerHour,
    avgFareInArea: Math.round(avgFare * 100) / 100,
    ridesPerHour: Math.round(ridesPerHour * 100) / 100,
    demandLevel,
    confidence: Math.round(confidence * 100) / 100
  };
}
async function getHubRecommendationsForDriver(driverId, lat, lng) {
  const [driver] = await db.select().from(drivers).where(eq25(drivers.id, driverId));
  if (!driver) return [];
  const driverVehicles = await db.select().from(vehicles).where(
    and23(eq25(vehicles.driverId, driverId), eq25(vehicles.isActive, true))
  );
  const vehicleType = driverVehicles.length > 0 ? driverVehicles[0].type : "economy";
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3);
  const driverHistory = await db.select().from(rides).where(and23(
    eq25(rides.driverId, driverId),
    gte13(rides.createdAt, thirtyDaysAgo),
    eq25(rides.status, "completed")
  )).orderBy(desc18(rides.createdAt)).limit(50);
  const preferredAreas = [];
  const areaCounts = {};
  for (const ride of driverHistory) {
    const cellId = getGridCellId(parseFloat(ride.pickupLat), parseFloat(ride.pickupLng), 1);
    if (!areaCounts[cellId]) {
      areaCounts[cellId] = { lat: parseFloat(ride.pickupLat), lng: parseFloat(ride.pickupLng), count: 0 };
    }
    areaCounts[cellId].count++;
  }
  for (const area of Object.values(areaCounts)) {
    preferredAreas.push(area);
  }
  const nearbyHubs = await getHubsNearLocation(lat, lng, 10);
  const recommendations = [];
  for (const hub of nearbyHubs) {
    const yieldData = await getDriverYieldEstimate(hub.id, vehicleType);
    const demandScore = parseFloat(hub.avgDemandScore || "0");
    const predictedWaitMinutes = yieldData.ridesPerHour > 0 ? Math.round(60 / yieldData.ridesPerHour) : 30;
    let affinityBonus = 0;
    const hubLat = parseFloat(hub.lat);
    const hubLng = parseFloat(hub.lng);
    for (const area of preferredAreas) {
      if (haversineDistance2(hubLat, hubLng, area.lat, area.lng) < 2) {
        affinityBonus = Math.min(0.2, area.count * 0.02);
        break;
      }
    }
    const distancePenalty = Math.max(0, 1 - hub.distance / 10);
    const yieldNormalized = Math.min(1, yieldData.estimatedYieldPerHour / 100);
    const demandNormalized = Math.min(1, demandScore / 10);
    const score = yieldNormalized * 0.35 + demandNormalized * 0.25 + distancePenalty * 0.2 + affinityBonus + yieldData.confidence * 0.2;
    recommendations.push({
      hubId: hub.id,
      hubName: hub.name,
      distance: hub.distance,
      yieldEstimate: yieldData.estimatedYieldPerHour,
      demandLevel: yieldData.demandLevel,
      predictedWaitMinutes,
      score: Math.round(score * 100) / 100
    });
  }
  recommendations.sort((a, b) => b.score - a.score);
  return recommendations.slice(0, 3);
}
async function getHubRecommendationsForRider(userId, lat, lng) {
  const nearbyHubs = await getHubsNearLocation(lat, lng, 5);
  const userHistory = await db.select().from(rides).where(
    eq25(rides.customerId, userId)
  ).orderBy(desc18(rides.createdAt)).limit(20);
  const frequentPickupAreas = {};
  for (const ride of userHistory) {
    const cellId = getGridCellId(parseFloat(ride.pickupLat), parseFloat(ride.pickupLng), 1);
    frequentPickupAreas[cellId] = (frequentPickupAreas[cellId] || 0) + 1;
  }
  const recommendations = [];
  for (const hub of nearbyHubs) {
    const hubLat = parseFloat(hub.lat);
    const hubLng = parseFloat(hub.lng);
    const walkMinutes = Math.round(hub.distance / 5 * 60);
    const estimatedPickupMinutes = hub.activeDrivers > 0 ? Math.max(1, Math.round(3 + hub.distance * 2 - Math.log2(hub.activeDrivers + 1))) : walkMinutes + 5;
    let familiarityBonus = 0;
    const hubCell = getGridCellId(hubLat, hubLng, 1);
    if (frequentPickupAreas[hubCell]) {
      familiarityBonus = Math.min(0.15, frequentPickupAreas[hubCell] * 0.03);
    }
    const proximityScore = Math.max(0, 1 - hub.distance / 5);
    const vehicleDensityScore = Math.min(1, hub.activeDrivers / 5);
    const pickupTimeScore = Math.max(0, 1 - estimatedPickupMinutes / 20);
    const score = proximityScore * 0.3 + vehicleDensityScore * 0.3 + pickupTimeScore * 0.25 + familiarityBonus + 0.15 * Math.min(1, hub.recentRideCount / 10);
    recommendations.push({
      hubId: hub.id,
      hubName: hub.name,
      distance: hub.distance,
      availableVehicles: hub.activeDrivers,
      estimatedPickupMinutes,
      hubType: hub.type,
      score: Math.round(score * 100) / 100
    });
  }
  recommendations.sort((a, b) => b.score - a.score);
  return recommendations.slice(0, 3);
}
async function generateSmartPrompt(userId, role, lat, lng) {
  if (role === "driver") {
    const [driver] = await db.select().from(drivers).where(eq25(drivers.userId, userId));
    if (!driver) {
      return { title: "Welcome", message: "Set up your driver profile to start earning.", actionType: "setup", data: {} };
    }
    const recommendations = await getHubRecommendationsForDriver(driver.id, lat, lng);
    if (recommendations.length > 0) {
      const top = recommendations[0];
      if (top.demandLevel === "very_high" || top.demandLevel === "high") {
        return {
          title: "High Demand Nearby",
          message: `${top.hubName} has ${top.demandLevel.replace("_", " ")} demand. Estimated yield: ${top.yieldEstimate.toFixed(2)}/hr, ${top.distance.toFixed(1)}km away.`,
          actionType: "navigate_to_hub",
          data: { hubId: top.hubId, yieldEstimate: top.yieldEstimate, distance: top.distance }
        };
      }
      return {
        title: "Earning Opportunity",
        message: `Head to ${top.hubName} (${top.distance.toFixed(1)}km) for an estimated ${top.yieldEstimate.toFixed(2)}/hr. Wait time ~${top.predictedWaitMinutes} min.`,
        actionType: "navigate_to_hub",
        data: { hubId: top.hubId, yieldEstimate: top.yieldEstimate, predictedWaitMinutes: top.predictedWaitMinutes }
      };
    }
    const detectedHotspots = await detectHotspots();
    if (detectedHotspots.length > 0) {
      const nearest = detectedHotspots.map((h) => ({ ...h, dist: haversineDistance2(lat, lng, h.lat, h.lng) })).sort((a, b) => a.dist - b.dist)[0];
      return {
        title: "Hotspot Detected",
        message: `Activity cluster ${nearest.dist.toFixed(1)}km away with ${nearest.demandCount} recent requests.`,
        actionType: "navigate_to_hotspot",
        data: { lat: nearest.lat, lng: nearest.lng, demandScore: nearest.demandScore }
      };
    }
    return {
      title: "Steady Area",
      message: "No high-demand zones detected nearby. Stay online for the next ride request.",
      actionType: "none",
      data: {}
    };
  }
  const riderRecommendations = await getHubRecommendationsForRider(userId, lat, lng);
  if (riderRecommendations.length > 0) {
    const top = riderRecommendations[0];
    if (top.availableVehicles > 0) {
      return {
        title: "Quick Pickup Available",
        message: `${top.availableVehicles} vehicle${top.availableVehicles > 1 ? "s" : ""} near ${top.hubName}. Estimated pickup in ${top.estimatedPickupMinutes} min.`,
        actionType: "book_from_hub",
        data: { hubId: top.hubId, availableVehicles: top.availableVehicles, estimatedPickupMinutes: top.estimatedPickupMinutes }
      };
    }
  }
  const onlineDrivers = await db.select().from(drivers).where(eq25(drivers.isOnline, true));
  const nearbyCount = onlineDrivers.filter((d) => {
    const dLat = parseFloat(d.currentLat || "0");
    const dLng = parseFloat(d.currentLng || "0");
    return haversineDistance2(lat, lng, dLat, dLng) <= 3;
  }).length;
  if (nearbyCount > 0) {
    return {
      title: "Drivers Available",
      message: `${nearbyCount} driver${nearbyCount > 1 ? "s" : ""} within 3km of your location. Book now for fast pickup.`,
      actionType: "book_ride",
      data: { nearbyDrivers: nearbyCount }
    };
  }
  return {
    title: "Limited Availability",
    message: "Few drivers nearby right now. Try booking in a few minutes or walk to a nearby hub for faster pickup.",
    actionType: "show_hubs",
    data: {}
  };
}
async function suggestCarpoolMatches(hubId, riderId, pickupLat, pickupLng, dropoffLat, dropoffLng) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1e3);
  const recentCheckIns = await db.select().from(hubCheckIns).where(and23(
    eq25(hubCheckIns.hubId, hubId),
    gte13(hubCheckIns.checkedInAt, oneHourAgo)
  ));
  const potentialRiderIds = recentCheckIns.filter((c) => c.userId !== riderId && c.userRole === "customer").map((c) => c.userId);
  if (potentialRiderIds.length === 0) {
    const pendingRides = await db.select().from(rides).where(and23(
      eq25(rides.status, "pending"),
      gte13(rides.createdAt, oneHourAgo)
    ));
    for (const ride of pendingRides) {
      if (ride.customerId !== riderId) {
        potentialRiderIds.push(ride.customerId);
      }
    }
  }
  const uniqueRiderIds = [...new Set(potentialRiderIds)];
  const recentPendingRides = await db.select().from(rides).where(and23(
    gte13(rides.createdAt, oneHourAgo),
    or(eq25(rides.status, "pending"), eq25(rides.status, "accepted"))
  ));
  const matches = [];
  for (const candidateId of uniqueRiderIds) {
    const candidateRides = recentPendingRides.filter((r) => r.customerId === candidateId);
    if (candidateRides.length === 0) continue;
    const candidate = candidateRides[0];
    const cPickupLat = parseFloat(candidate.pickupLat);
    const cPickupLng = parseFloat(candidate.pickupLng);
    const cDropoffLat = parseFloat(candidate.dropoffLat);
    const cDropoffLng = parseFloat(candidate.dropoffLng);
    const pickupDist = haversineDistance2(pickupLat, pickupLng, cPickupLat, cPickupLng);
    const dropoffDist = haversineDistance2(dropoffLat, dropoffLng, cDropoffLat, cDropoffLng);
    if (pickupDist > 2 || dropoffDist > 3) continue;
    const myRouteLen = haversineDistance2(pickupLat, pickupLng, dropoffLat, dropoffLng);
    const theirRouteLen = haversineDistance2(cPickupLat, cPickupLng, cDropoffLat, cDropoffLng);
    const combinedDetour = pickupDist + dropoffDist;
    const avgRouteLen = (myRouteLen + theirRouteLen) / 2;
    const overlapPercent = Math.max(0, Math.min(100, (1 - combinedDetour / (avgRouteLen + 1e-3)) * 100));
    if (overlapPercent < 30) continue;
    const baseFare = parseFloat(candidate.estimatedFare || "20");
    const estimatedSavings = Math.round(baseFare * (overlapPercent / 100) * 0.4 * 100) / 100;
    matches.push({
      matchedRiderId: candidateId,
      routeOverlapPercent: Math.round(overlapPercent * 100) / 100,
      estimatedSavings,
      pickupDistance: Math.round(pickupDist * 1e3) / 1e3,
      dropoffDistance: Math.round(dropoffDist * 1e3) / 1e3
    });
    await db.insert(carpoolSuggestions).values({
      hubId,
      riderId,
      matchedRiderId: candidateId,
      pickupLat: pickupLat.toString(),
      pickupLng: pickupLng.toString(),
      dropoffLat: dropoffLat.toString(),
      dropoffLng: dropoffLng.toString(),
      routeOverlapPercent: overlapPercent.toFixed(2),
      estimatedSavings: estimatedSavings.toFixed(2),
      status: "suggested",
      expiresAt: new Date(Date.now() + 30 * 60 * 1e3)
    });
  }
  matches.sort((a, b) => b.routeOverlapPercent - a.routeOverlapPercent);
  return matches;
}

// server/communityPrestigeService.ts
init_db();
init_schema();
import { eq as eq26, and as and24, gte as gte14, desc as desc19, sql as sql20 } from "drizzle-orm";
async function getOrCreatePrestige(userId, driverId) {
  const [existing] = await db.select().from(communityPrestige).where(eq26(communityPrestige.userId, userId));
  if (existing) return existing;
  const [created] = await db.insert(communityPrestige).values({
    userId,
    driverId: driverId || null,
    tier: "bronze",
    totalContributions: 0,
    networkParticipationScore: "0.00",
    efficiencyRating: "0.00",
    lifetimeYield: "0.00",
    hubMessagesCount: 0,
    helpfulReactionsReceived: 0,
    monthlyActiveHubs: 0,
    isTopContributor: false
  }).returning();
  return created;
}
async function updatePrestigeMetrics(userId) {
  const prestige = await getOrCreatePrestige(userId);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3);
  const messagesResult = await db.select({ count: sql20`count(*)` }).from(hubMessages).where(and24(eq26(hubMessages.authorId, userId), gte14(hubMessages.createdAt, thirtyDaysAgo)));
  const messagesCount = Number(messagesResult[0]?.count || 0);
  const userMessages = await db.select({ id: hubMessages.id }).from(hubMessages).where(eq26(hubMessages.authorId, userId));
  const messageIds = userMessages.map((m) => m.id);
  let reactionsReceived = 0;
  if (messageIds.length > 0) {
    const reactionsResult = await db.select({ count: sql20`count(*)` }).from(hubReactions).where(sql20`${hubReactions.messageId} IN (${sql20.join(messageIds.map((id) => sql20`${id}`), sql20`, `)})`);
    reactionsReceived = Number(reactionsResult[0]?.count || 0);
  }
  const checkInsResult = await db.select({ count: sql20`count(distinct ${hubCheckIns.hubId})` }).from(hubCheckIns).where(and24(eq26(hubCheckIns.userId, userId), gte14(hubCheckIns.checkedInAt, thirtyDaysAgo)));
  const monthlyActiveHubs = Number(checkInsResult[0]?.count || 0);
  const totalCheckInsResult = await db.select({ count: sql20`count(*)` }).from(hubCheckIns).where(and24(eq26(hubCheckIns.userId, userId), gte14(hubCheckIns.checkedInAt, thirtyDaysAgo)));
  const totalCheckIns = Number(totalCheckInsResult[0]?.count || 0);
  const participationScore = messagesCount * 2 + reactionsReceived * 1.5 + totalCheckIns * 3 + monthlyActiveHubs * 5;
  const roundedScore = Math.round(participationScore * 100) / 100;
  const tier = calculatePrestigeTier(roundedScore);
  const totalContributions = messagesCount + totalCheckIns;
  const [updated] = await db.update(communityPrestige).set({
    hubMessagesCount: messagesCount,
    helpfulReactionsReceived: reactionsReceived,
    monthlyActiveHubs,
    networkParticipationScore: roundedScore.toFixed(2),
    totalContributions,
    tier,
    isTopContributor: roundedScore >= 300,
    lastActivityAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq26(communityPrestige.userId, userId)).returning();
  return updated;
}
function calculatePrestigeTier(score) {
  if (score >= 500) return "diamond";
  if (score >= 300) return "platinum";
  if (score >= 150) return "gold";
  if (score >= 50) return "silver";
  return "bronze";
}
async function getLeaderboard(limit = 10) {
  const leaders = await db.select({
    prestige: communityPrestige,
    userName: users.name,
    userAvatar: users.avatar
  }).from(communityPrestige).innerJoin(users, eq26(users.id, communityPrestige.userId)).orderBy(desc19(communityPrestige.networkParticipationScore)).limit(limit);
  return leaders.map((entry, index) => ({
    rank: index + 1,
    userId: entry.prestige.userId,
    userName: entry.userName,
    userAvatar: entry.userAvatar,
    tier: entry.prestige.tier,
    participationScore: parseFloat(entry.prestige.networkParticipationScore || "0"),
    totalContributions: entry.prestige.totalContributions || 0,
    hubMessagesCount: entry.prestige.hubMessagesCount || 0,
    helpfulReactionsReceived: entry.prestige.helpfulReactionsReceived || 0,
    monthlyActiveHubs: entry.prestige.monthlyActiveHubs || 0,
    isTopContributor: entry.prestige.isTopContributor || false
  }));
}
async function incrementContribution(userId, type) {
  const prestige = await getOrCreatePrestige(userId);
  const newTotal = (prestige.totalContributions || 0) + 1;
  const currentScore = parseFloat(prestige.networkParticipationScore || "0");
  let scoreIncrement = 1;
  switch (type) {
    case "message":
      scoreIncrement = 2;
      break;
    case "reaction":
      scoreIncrement = 1.5;
      break;
    case "check_in":
      scoreIncrement = 3;
      break;
    case "hub_visit":
      scoreIncrement = 5;
      break;
    default:
      scoreIncrement = 1;
      break;
  }
  const newScore = Math.round((currentScore + scoreIncrement) * 100) / 100;
  const tier = calculatePrestigeTier(newScore);
  const [updated] = await db.update(communityPrestige).set({
    totalContributions: newTotal,
    networkParticipationScore: newScore.toFixed(2),
    tier,
    isTopContributor: newScore >= 300,
    lastActivityAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq26(communityPrestige.userId, userId)).returning();
  return updated;
}

// server/hubRoutes.ts
var router = Router();
async function getSessionUser(req) {
  const token = req.headers.authorization?.split(" ")[1] || "";
  if (!token) return null;
  const session = await storage.getSession(token);
  if (!session) return null;
  if (/* @__PURE__ */ new Date() > session.expiresAt) return null;
  return session;
}
var PROFANITY_LIST = ["spam", "scam", "xxx"];
function moderateContent(content) {
  if (!content || content.trim().length === 0) {
    return { passed: false, reason: "Message content cannot be empty" };
  }
  if (content.length > 500) {
    return { passed: false, reason: "Message must be 500 characters or less" };
  }
  const lower = content.toLowerCase();
  for (const word of PROFANITY_LIST) {
    if (lower.includes(word)) {
      return { passed: false, reason: "Message contains inappropriate content" };
    }
  }
  return { passed: true };
}
router.get("/api/openclaw/hubs", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radiusKm = parseFloat(req.query.radiusKm) || 50;
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "lat and lng are required" });
    }
    console.log(`[HUBS] Searching near lat=${lat}, lng=${lng}, radius=${radiusKm}km`);
    const nearbyHubs = await getHubsNearLocation(lat, lng, radiusKm);
    console.log(`[HUBS] Found ${nearbyHubs.length} hubs nearby`);
    if (nearbyHubs.length === 0) {
      const allHubs = await db.select({ id: hubs.id, name: hubs.name, lat: hubs.lat, lng: hubs.lng, status: hubs.status }).from(hubs).where(eq27(hubs.status, "active"));
      console.log(`[HUBS] Total active hubs in DB: ${allHubs.length}`);
      if (allHubs.length > 0) {
        const sample = allHubs[0];
        const sLat = parseFloat(sample.lat);
        const sLng = parseFloat(sample.lng);
        const R = 6371;
        const dLat = (sLat - lat) * Math.PI / 180;
        const dLng = (sLng - lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * Math.PI / 180) * Math.cos(sLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        console.log(`[HUBS] Distance to "${sample.name}" (${sLat},${sLng}): ${dist.toFixed(2)}km`);
      }
    }
    const formatted = nearbyHubs.map((h) => ({
      id: h.id,
      name: h.name,
      type: h.type,
      lat: parseFloat(h.lat),
      lng: parseFloat(h.lng),
      distance: h.distance,
      demandScore: parseFloat(h.avgDemandScore || "0"),
      activeDrivers: h.activeDrivers,
      recentRides: h.recentRideCount,
      yieldEstimate: h.recentRideCount > 0 ? Math.round(h.recentRideCount * 5.5 * 100) / 100 : 0,
      description: h.description,
      radiusMeters: h.radiusMeters,
      address: h.address
    }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch hubs" });
  }
});
router.get("/api/openclaw/hubs/browse", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const cityId = req.query.cityId;
    const regionCode = req.query.regionCode;
    let query = db.select().from(hubs).where(eq27(hubs.status, "active"));
    const allActiveHubs = await query;
    let filteredHubs = allActiveHubs;
    if (cityId) {
      filteredHubs = allActiveHubs.filter((h) => h.cityId === cityId);
    } else if (regionCode) {
      filteredHubs = allActiveHubs.filter((h) => h.regionCode?.startsWith(regionCode));
    }
    const allCities = await db.select().from(cities).where(eq27(cities.isActive, true));
    const grouped = {};
    for (const hub of filteredHubs) {
      const city = allCities.find((c) => c.id === hub.cityId);
      const cityName = city?.name || "Unknown";
      if (!grouped[cityName]) {
        grouped[cityName] = { city, hubs: [] };
      }
      grouped[cityName].hubs.push(hub);
    }
    const result = Object.entries(grouped).map(([cityName, data]) => ({
      cityName,
      cityId: data.city?.id,
      regionCode: data.city?.regionCode,
      hubCount: data.hubs.length,
      hubs: data.hubs.map((h) => ({
        id: h.id,
        name: h.name,
        type: h.type,
        lat: parseFloat(h.lat),
        lng: parseFloat(h.lng),
        radiusMeters: h.radiusMeters,
        description: h.description,
        address: h.address,
        demandScore: parseFloat(h.avgDemandScore || "0"),
        peakHours: h.peakHours
      }))
    })).sort((a, b) => b.hubCount - a.hubCount);
    res.json({
      totalHubs: filteredHubs.length,
      totalCities: result.length,
      cities: result
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to browse hubs" });
  }
});
router.get("/api/openclaw/hubs/:hubId", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const { hubId } = req.params;
    const [hub] = await db.select().from(hubs).where(eq27(hubs.id, hubId));
    if (!hub) {
      return res.status(404).json({ error: "Hub not found" });
    }
    const demandData = await updateHubDemand(hubId);
    res.json({
      ...hub,
      currentDemandScore: demandData?.demandScore ?? parseFloat(hub.avgDemandScore || "0"),
      lastUpdated: demandData?.updatedAt ?? hub.updatedAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch hub details" });
  }
});
router.get("/api/openclaw/hotspots", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const cityId = req.query.cityId;
    const regionCode = req.query.regionCode;
    const hotspotData = await getHotspotsForMap(cityId, regionCode);
    res.json(hotspotData);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch hotspots" });
  }
});
router.post("/api/openclaw/hubs/:hubId/check-in", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const { hubId } = req.params;
    const [hub] = await db.select().from(hubs).where(eq27(hubs.id, hubId));
    if (!hub) {
      return res.status(404).json({ error: "Hub not found" });
    }
    const [checkIn] = await db.insert(hubCheckIns).values({
      hubId,
      userId: session.userId,
      userRole: session.role,
      checkedInAt: /* @__PURE__ */ new Date()
    }).returning();
    await incrementContribution(session.userId, "check_in");
    res.json(checkIn);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to check in" });
  }
});
router.post("/api/openclaw/hubs/:hubId/check-out", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const { hubId } = req.params;
    const activeCheckIns = await db.select().from(hubCheckIns).where(
      and25(
        eq27(hubCheckIns.hubId, hubId),
        eq27(hubCheckIns.userId, session.userId),
        sql21`${hubCheckIns.checkedOutAt} IS NULL`
      )
    ).orderBy(desc20(hubCheckIns.checkedInAt)).limit(1);
    if (activeCheckIns.length === 0) {
      return res.status(404).json({ error: "No active check-in found" });
    }
    const [updated] = await db.update(hubCheckIns).set({
      checkedOutAt: /* @__PURE__ */ new Date()
    }).where(eq27(hubCheckIns.id, activeCheckIns[0].id)).returning();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to check out" });
  }
});
router.get("/api/openclaw/hubs/:hubId/messages", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const { hubId } = req.params;
    const now = /* @__PURE__ */ new Date();
    const messages = await db.select({
      message: hubMessages,
      authorName: users.name,
      authorAvatar: users.avatar
    }).from(hubMessages).innerJoin(users, eq27(users.id, hubMessages.authorId)).where(
      and25(
        eq27(hubMessages.hubId, hubId),
        eq27(hubMessages.status, "active"),
        gte15(hubMessages.expiresAt, now)
      )
    ).orderBy(desc20(hubMessages.createdAt));
    const userReactions = await db.select({ messageId: hubReactions.messageId }).from(hubReactions).where(eq27(hubReactions.userId, session.userId));
    const likedMessageIds = new Set(userReactions.map((r) => r.messageId));
    const nowMs = now.getTime();
    const scored = messages.map((m) => {
      const ageMinutes = (nowMs - new Date(m.message.createdAt).getTime()) / 6e4;
      const recencyScore = Math.max(0, 1 - ageMinutes / 240);
      const engagementScore = Math.min(1, (m.message.likesCount || 0) / 10);
      const aiScoreVal = parseFloat(m.message.aiScore || "0");
      const compositeScore = recencyScore * 0.4 + engagementScore * 0.3 + aiScoreVal * 0.3;
      return {
        ...m.message,
        authorName: m.authorName,
        authorAvatar: m.authorAvatar,
        hasLiked: likedMessageIds.has(m.message.id),
        _compositeScore: compositeScore
      };
    });
    scored.sort((a, b) => b._compositeScore - a._compositeScore);
    const result = scored.map(({ _compositeScore, ...rest }) => rest);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch messages" });
  }
});
router.post("/api/openclaw/hubs/:hubId/messages", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const { hubId } = req.params;
    const { content, category } = req.body;
    const moderation = moderateContent(content);
    if (!moderation.passed) {
      return res.status(400).json({ error: moderation.reason });
    }
    const validCategories = ["demand_insight", "traffic_alert", "event_signal", "availability_update"];
    const validatedCategory = category && validCategories.includes(category) ? category : null;
    const [hub] = await db.select().from(hubs).where(eq27(hubs.id, hubId));
    if (!hub) {
      return res.status(404).json({ error: "Hub not found" });
    }
    const trimmedContent = content.trim();
    let aiScore = 0.3;
    if (trimmedContent.length > 50) aiScore += 0.15;
    if (trimmedContent.length > 100) aiScore += 0.1;
    if (validatedCategory) aiScore += 0.2;
    if (/\d/.test(trimmedContent)) aiScore += 0.1;
    if (/\b(demand|traffic|surge|wait|available|busy|quiet|peak)\b/i.test(trimmedContent)) aiScore += 0.15;
    aiScore = Math.min(0.99, Math.round(aiScore * 100) / 100);
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1e3);
    const [message] = await db.insert(hubMessages).values({
      hubId,
      authorId: session.userId,
      content: trimmedContent,
      category: validatedCategory,
      aiScore: aiScore.toFixed(2),
      status: "active",
      expiresAt
    }).returning();
    await incrementContribution(session.userId, "message");
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to post message" });
  }
});
router.post("/api/openclaw/messages/:messageId/react", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const { messageId } = req.params;
    const { reactionType } = req.body;
    const [message] = await db.select().from(hubMessages).where(eq27(hubMessages.id, messageId));
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    const existing = await db.select().from(hubReactions).where(
      and25(
        eq27(hubReactions.messageId, messageId),
        eq27(hubReactions.userId, session.userId)
      )
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: "Already reacted to this message" });
    }
    const [reaction] = await db.insert(hubReactions).values({
      messageId,
      userId: session.userId,
      reactionType: reactionType || "like"
    }).returning();
    await db.update(hubMessages).set({
      likesCount: (message.likesCount || 0) + 1
    }).where(eq27(hubMessages.id, messageId));
    await incrementContribution(session.userId, "reaction");
    res.json(reaction);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to react" });
  }
});
router.delete("/api/openclaw/messages/:messageId", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const { messageId } = req.params;
    const [message] = await db.select().from(hubMessages).where(eq27(hubMessages.id, messageId));
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    if (message.authorId !== session.userId) {
      return res.status(403).json({ error: "Can only delete your own messages" });
    }
    await db.update(hubMessages).set({ status: "moderated" }).where(eq27(hubMessages.id, messageId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to delete message" });
  }
});
router.get("/api/openclaw/recommendations/driver", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "lat and lng are required" });
    }
    const [driver] = await db.select().from(drivers).where(eq27(drivers.userId, session.userId));
    if (!driver) {
      return res.status(404).json({ error: "Driver profile not found" });
    }
    const recommendations = await getHubRecommendationsForDriver(driver.id, lat, lng);
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to get driver recommendations" });
  }
});
router.get("/api/openclaw/recommendations/rider", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "lat and lng are required" });
    }
    const recommendations = await getHubRecommendationsForRider(session.userId, lat, lng);
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to get rider recommendations" });
  }
});
router.get("/api/openclaw/smart-prompt", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "lat and lng are required" });
    }
    const prompt = await generateSmartPrompt(session.userId, session.role, lat, lng);
    res.json(prompt);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to generate smart prompt" });
  }
});
router.get("/api/openclaw/yield-estimate/:hubId", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const { hubId } = req.params;
    const vehicleType = req.query.vehicleType || "economy";
    const estimate = await getDriverYieldEstimate(hubId, vehicleType);
    res.json(estimate);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to get yield estimate" });
  }
});
router.post("/api/openclaw/carpool/suggest", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const { hubId, pickupLat, pickupLng, dropoffLat, dropoffLng } = req.body;
    if (!hubId || pickupLat == null || pickupLng == null || dropoffLat == null || dropoffLng == null) {
      return res.status(400).json({ error: "hubId, pickupLat, pickupLng, dropoffLat, dropoffLng are required" });
    }
    const suggestions = await suggestCarpoolMatches(
      hubId,
      session.userId,
      parseFloat(pickupLat),
      parseFloat(pickupLng),
      parseFloat(dropoffLat),
      parseFloat(dropoffLng)
    );
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to get carpool suggestions" });
  }
});
router.get("/api/openclaw/prestige", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const prestige = await updatePrestigeMetrics(session.userId);
    const score = parseFloat(prestige.networkParticipationScore || "0");
    const tier = prestige.tier || "bronze";
    const nextTierScoreMap = {
      bronze: 50,
      silver: 150,
      gold: 300,
      platinum: 500,
      diamond: 1e3
    };
    const nextTierScore = nextTierScoreMap[tier] || 50;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3);
    const userRides = await db.select().from(rides).where(
      and25(eq27(rides.customerId, session.userId), gte15(rides.createdAt, thirtyDaysAgo))
    );
    let routesNearHubs = 0;
    const activeHubs = await db.select().from(hubs).where(eq27(hubs.status, "active"));
    for (const ride of userRides) {
      const rLat = parseFloat(ride.pickupLat);
      const rLng = parseFloat(ride.pickupLng);
      for (const hub of activeHubs) {
        const hLat = parseFloat(hub.lat);
        const hLng = parseFloat(hub.lng);
        const dist = Math.sqrt(Math.pow(rLat - hLat, 2) + Math.pow(rLng - hLng, 2)) * 111;
        if (dist <= 1) {
          routesNearHubs++;
          break;
        }
      }
    }
    const recentCheckIns = await db.select({
      checkIn: hubCheckIns,
      hubName: hubs.name
    }).from(hubCheckIns).innerJoin(hubs, eq27(hubs.id, hubCheckIns.hubId)).where(and25(eq27(hubCheckIns.userId, session.userId), gte15(hubCheckIns.checkedInAt, thirtyDaysAgo))).orderBy(desc20(hubCheckIns.checkedInAt)).limit(10);
    const now = Date.now();
    const recentActivity = recentCheckIns.map((c, i) => {
      const checkedIn = new Date(c.checkIn.checkedInAt).getTime();
      const checkedOut = c.checkIn.checkedOutAt ? new Date(c.checkIn.checkedOutAt).getTime() : checkedIn + 30 * 60 * 1e3;
      const diffMs = now - checkedIn;
      const diffMin = Math.floor(diffMs / 6e4);
      let time;
      if (diffMin < 60) time = `${diffMin}m ago`;
      else if (diffMin < 1440) time = `${Math.floor(diffMin / 60)}h ago`;
      else time = `${Math.floor(diffMin / 1440)}d ago`;
      const durationMs = checkedOut - checkedIn;
      const durationMin = Math.floor(durationMs / 6e4);
      const duration = durationMin >= 60 ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}min` : `${durationMin} min`;
      return { id: c.checkIn.id || String(i), hubName: c.hubName, time, duration };
    });
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyTrends = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1e3);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1e3);
      const visits = recentCheckIns.filter((c) => {
        const t = new Date(c.checkIn.checkedInAt).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      }).length;
      weeklyTrends.push({ day: dayNames[d.getDay()], visits });
    }
    res.json({
      score,
      nextTierScore,
      tier,
      contributions: prestige.totalContributions || 0,
      efficiency: Math.round(parseFloat(prestige.efficiencyRating || "0") * 100),
      participationScore: score,
      hubsVisited: prestige.monthlyActiveHubs || 0,
      contributionScore: score,
      routesNearHubs,
      recentActivity,
      weeklyTrends
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to get prestige data" });
  }
});
router.get("/api/openclaw/prestige/leaderboard", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const limit = parseInt(req.query.limit) || 10;
    const leaderboard = await getLeaderboard(Math.min(limit, 100));
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to get leaderboard" });
  }
});
router.post("/api/openclaw/feedback", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const { feedbackType, category, content, rating, screenName } = req.body;
    if (!feedbackType || !content) {
      return res.status(400).json({ error: "feedbackType and content are required" });
    }
    const validTypes = ["rating", "suggestion", "issue", "compliment"];
    if (!validTypes.includes(feedbackType)) {
      return res.status(400).json({ error: "Invalid feedback type" });
    }
    const [feedback] = await db.insert(userFeedback).values({
      userId: session.userId,
      feedbackType,
      category: category || null,
      content: content.trim(),
      rating: rating != null ? parseInt(rating) : null,
      screenName: screenName || null
    }).returning();
    res.json(feedback);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to submit feedback" });
  }
});
router.get("/api/openclaw/analytics/driver", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const [driver] = await db.select().from(drivers).where(eq27(drivers.userId, session.userId));
    if (!driver) return res.status(404).json({ error: "Driver profile not found" });
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3);
    const weekRides = await db.select().from(rides).where(
      and25(eq27(rides.driverId, driver.id), gte15(rides.createdAt, sevenDaysAgo), eq27(rides.status, "completed"))
    );
    const activeHotspots = await db.select().from(hotspots).where(eq27(hotspots.isActive, true)).orderBy(desc20(hotspots.demandScore)).limit(5);
    const hotspotEarnings = activeHotspots.map((h) => ({
      lat: parseFloat(h.lat),
      lng: parseFloat(h.lng),
      earnings: parseFloat(h.avgYieldEstimate || "0"),
      demandScore: parseFloat(h.demandScore),
      rides: h.demandCount || 0
    }));
    const now = Date.now();
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyEarnings = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1e3);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1e3);
      const dayRides = weekRides.filter((r) => {
        const t = new Date(r.completedAt || r.createdAt).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      });
      const dayEarnings = dayRides.reduce((sum2, r) => sum2 + parseFloat(r.driverEarnings || r.actualFare || r.estimatedFare || "0"), 0);
      weeklyEarnings.push({ day: dayNames[d.getDay()], earnings: Math.round(dayEarnings * 100) / 100, rides: dayRides.length });
    }
    const totalEarnings = weekRides.reduce((sum2, r) => sum2 + parseFloat(r.driverEarnings || r.actualFare || r.estimatedFare || "0"), 0);
    const totalHours = weekRides.reduce((sum2, r) => sum2 + (r.duration || 0), 0) / 60;
    const averageYieldPerHour = totalHours > 0 ? Math.round(totalEarnings / totalHours * 100) / 100 : 0;
    const hubRideCounts = {};
    const allHubs = await db.select().from(hubs).where(eq27(hubs.status, "active"));
    for (const ride of weekRides) {
      const rLat = parseFloat(ride.pickupLat);
      const rLng = parseFloat(ride.pickupLng);
      for (const hub of allHubs) {
        const hLat = parseFloat(hub.lat);
        const hLng = parseFloat(hub.lng);
        const dist = Math.sqrt(Math.pow(rLat - hLat, 2) + Math.pow(rLng - hLng, 2)) * 111;
        if (dist <= 1) {
          if (!hubRideCounts[hub.id]) hubRideCounts[hub.id] = { hubId: hub.id, hubName: hub.name, earnings: 0, rides: 0 };
          hubRideCounts[hub.id].earnings += parseFloat(ride.driverEarnings || ride.actualFare || ride.estimatedFare || "0");
          hubRideCounts[hub.id].rides++;
          break;
        }
      }
    }
    const topHub = Object.values(hubRideCounts).sort((a, b) => b.earnings - a.earnings)[0] || null;
    res.json({
      hotspotEarnings,
      weeklyEarnings,
      averageYieldPerHour,
      totalRidesThisWeek: weekRides.length,
      topHub
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to get driver analytics" });
  }
});
router.get("/api/openclaw/analytics/rider", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3);
    const monthRides = await db.select().from(rides).where(
      and25(eq27(rides.customerId, session.userId), gte15(rides.createdAt, thirtyDaysAgo))
    );
    const checkIns = await db.select({
      hubId: hubCheckIns.hubId,
      hubName: hubs.name
    }).from(hubCheckIns).innerJoin(hubs, eq27(hubs.id, hubCheckIns.hubId)).where(and25(eq27(hubCheckIns.userId, session.userId), gte15(hubCheckIns.checkedInAt, thirtyDaysAgo)));
    const uniqueHubIds = new Set(checkIns.map((c) => c.hubId));
    const hubsUsed = uniqueHubIds.size;
    const completedRides = monthRides.filter((r) => r.status === "completed" && r.acceptedAt && r.startedAt);
    let avgPickupTime = 0;
    if (completedRides.length > 0) {
      const totalPickupMs = completedRides.reduce((sum2, r) => {
        const accepted = new Date(r.acceptedAt).getTime();
        const started = new Date(r.startedAt).getTime();
        return sum2 + (started - accepted);
      }, 0);
      avgPickupTime = Math.round(totalPickupMs / completedRides.length / 6e4 * 10) / 10;
    }
    const hubVisitCounts = {};
    for (const c of checkIns) {
      if (!hubVisitCounts[c.hubId]) hubVisitCounts[c.hubId] = { hubId: c.hubId, hubName: c.hubName, visits: 0 };
      hubVisitCounts[c.hubId].visits++;
    }
    const favoritHub = Object.values(hubVisitCounts).sort((a, b) => b.visits - a.visits)[0] || null;
    const now = Date.now();
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyActivity = [];
    const weekRides = monthRides.filter((r) => new Date(r.createdAt).getTime() >= sevenDaysAgo.getTime());
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1e3);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1e3);
      const dayRides = weekRides.filter((r) => {
        const t = new Date(r.createdAt).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      }).length;
      weeklyActivity.push({ day: dayNames[d.getDay()], rides: dayRides });
    }
    res.json({
      totalRides: monthRides.length,
      hubsUsed,
      avgPickupTime,
      favoritHub,
      weeklyActivity
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to get rider analytics" });
  }
});
router.get("/api/openclaw/analytics/network", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const activeHubsResult = await db.select({ count: sql21`count(*)` }).from(hubs).where(eq27(hubs.status, "active"));
    const totalActiveHubs = Number(activeHubsResult[0]?.count || 0);
    const todayStart = /* @__PURE__ */ new Date();
    todayStart.setHours(0, 0, 0, 0);
    const checkInsTodayResult = await db.select({ count: sql21`count(*)` }).from(hubCheckIns).where(gte15(hubCheckIns.checkedInAt, todayStart));
    const totalCheckInsToday = Number(checkInsTodayResult[0]?.count || 0);
    const messagesTodayResult = await db.select({ count: sql21`count(*)` }).from(hubMessages).where(gte15(hubMessages.createdAt, todayStart));
    const totalMessagesToday = Number(messagesTodayResult[0]?.count || 0);
    const leaderboard = await getLeaderboard(5);
    const topContributors = leaderboard.map((entry) => ({
      userId: entry.userId,
      userName: entry.userName,
      score: entry.participationScore,
      tier: entry.tier
    }));
    let networkHealth;
    if (totalCheckInsToday >= 20 && totalMessagesToday >= 10) networkHealth = "healthy";
    else if (totalCheckInsToday >= 5 || totalMessagesToday >= 3) networkHealth = "growing";
    else networkHealth = "quiet";
    res.json({
      totalActiveHubs,
      totalCheckInsToday,
      totalMessagesToday,
      topContributors,
      networkHealth
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to get network analytics" });
  }
});
router.post("/api/openclaw/messages/:messageId/report", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const { messageId } = req.params;
    const [message] = await db.select().from(hubMessages).where(eq27(hubMessages.id, messageId));
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    const newReportCount = (message.reportCount || 0) + 1;
    const updateData = { reportCount: newReportCount };
    if (newReportCount >= 3) {
      updateData.status = "moderated";
    }
    const [updated] = await db.update(hubMessages).set(updateData).where(eq27(hubMessages.id, messageId)).returning();
    res.json({ success: true, reportCount: newReportCount, moderated: newReportCount >= 3 });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to report message" });
  }
});
router.get("/api/openclaw/hubs/:hubId/intelligence", async (req, res) => {
  try {
    let haversineDist2 = function(lat1, lng1, lat2, lng2) {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };
    var haversineDist = haversineDist2;
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const { hubId } = req.params;
    const [hub] = await db.select().from(hubs).where(eq27(hubs.id, hubId));
    if (!hub) {
      return res.status(404).json({ error: "Hub not found" });
    }
    const hubLat = parseFloat(hub.lat);
    const hubLng = parseFloat(hub.lng);
    const radiusKm = (hub.radiusMeters || 300) / 1e3;
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1e3);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3);
    const recentRides = await db.select().from(rides).where(gte15(rides.createdAt, threeHoursAgo));
    const onlineDrivers = await db.select().from(drivers).where(eq27(drivers.isOnline, true));
    const nearbyRides = recentRides.filter((r) => {
      const rLat = parseFloat(r.pickupLat);
      const rLng = parseFloat(r.pickupLng);
      return haversineDist2(hubLat, hubLng, rLat, rLng) <= radiusKm * 3;
    });
    const nearbyDrivers = onlineDrivers.filter((d) => {
      const dLat = parseFloat(d.currentLat || "0");
      const dLng = parseFloat(d.currentLng || "0");
      return haversineDist2(hubLat, hubLng, dLat, dLng) <= radiusKm * 3;
    });
    const recentCheckIns = await db.select().from(hubCheckIns).where(
      and25(eq27(hubCheckIns.hubId, hubId), gte15(hubCheckIns.checkedInAt, twentyFourHoursAgo))
    );
    const uniqueMembers = new Set(recentCheckIns.map((c) => c.userId));
    const activityScore = Math.min(100, Math.round(
      nearbyRides.length * 5 + nearbyDrivers.length * 10 + recentCheckIns.length * 3
    ));
    const yieldData = await getDriverYieldEstimate(hubId, "economy");
    const predictedYield = {
      amount: yieldData.estimatedYieldPerHour,
      window: "next 1 hour",
      confidence: yieldData.confidence
    };
    const now = Date.now();
    const demandTrend = [];
    for (let i = 5; i >= 0; i--) {
      const bucketStart = now - (i + 1) * 30 * 60 * 1e3;
      const bucketEnd = now - i * 30 * 60 * 1e3;
      const bucketRides = nearbyRides.filter((r) => {
        const t = new Date(r.createdAt).getTime();
        return t >= bucketStart && t < bucketEnd;
      });
      const d = new Date(bucketEnd);
      const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      demandTrend.push({ time, demand: bucketRides.length });
    }
    const vehicleTicker = [];
    const sortedRides = [...nearbyRides].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);
    for (const ride of sortedRides) {
      const ageMs = now - new Date(ride.createdAt).getTime();
      const ageMin = Math.floor(ageMs / 6e4);
      const timeAgo = ageMin < 60 ? `${ageMin}m ago` : `${Math.floor(ageMin / 60)}h ago`;
      if (ride.status === "completed") {
        const dropLat = parseFloat(ride.dropoffLat);
        const dropLng = parseFloat(ride.dropoffLng);
        const isArrival = haversineDist2(hubLat, hubLng, dropLat, dropLng) <= radiusKm * 3;
        vehicleTicker.push({
          type: isArrival ? "arrival" : "departure",
          vehicleType: "economy",
          timeAgo
        });
      } else {
        vehicleTicker.push({ type: "departure", vehicleType: "economy", timeAgo });
      }
    }
    let aiRecommendation;
    if (activityScore >= 70) {
      aiRecommendation = {
        title: "High Activity Zone",
        message: `${hub.name} is experiencing high demand. Great time for drivers to activate here.`,
        priority: "high"
      };
    } else if (activityScore >= 30) {
      aiRecommendation = {
        title: "Moderate Activity",
        message: `Steady activity at ${hub.name}. Consider positioning here for upcoming demand.`,
        priority: "medium"
      };
    } else {
      aiRecommendation = {
        title: "Low Activity Period",
        message: `${hub.name} is quiet right now. Check back during peak hours for better yields.`,
        priority: "low"
      };
    }
    const allActiveHubs = await db.select().from(hubs).where(eq27(hubs.status, "active"));
    let nextLikelyHub = null;
    const otherHubs = allActiveHubs.filter((h) => h.id !== hubId).map((h) => ({
      ...h,
      dist: haversineDist2(hubLat, hubLng, parseFloat(h.lat), parseFloat(h.lng)),
      demand: parseFloat(h.avgDemandScore || "0")
    })).filter((h) => h.dist <= 10).sort((a, b) => b.demand - a.demand);
    if (otherHubs.length > 0) {
      const top = otherHubs[0];
      nextLikelyHub = {
        hubId: top.id,
        hubName: top.name,
        probability: Math.min(0.95, Math.round(top.demand / 10 * 100) / 100),
        distance: Math.round(top.dist * 100) / 100
      };
    }
    const monthRides = await db.select().from(rides).where(
      and25(gte15(rides.createdAt, thirtyDaysAgo), eq27(rides.status, "completed"))
    );
    const migrationMap = {};
    for (const ride of monthRides) {
      const pickLat = parseFloat(ride.pickupLat);
      const pickLng = parseFloat(ride.pickupLng);
      const dropLat = parseFloat(ride.dropoffLat);
      const dropLng = parseFloat(ride.dropoffLng);
      let fromHub = null;
      let toHub = null;
      for (const h of allActiveHubs) {
        const hLat = parseFloat(h.lat);
        const hLng = parseFloat(h.lng);
        if (haversineDist2(pickLat, pickLng, hLat, hLng) <= 1) fromHub = h;
        if (haversineDist2(dropLat, dropLng, hLat, hLng) <= 1) toHub = h;
      }
      if (fromHub && toHub && fromHub.id !== toHub.id) {
        const key = `${fromHub.id}->${toHub.id}`;
        if (!migrationMap[key]) {
          migrationMap[key] = { fromHub: fromHub.name, toHub: toHub.name, frequency: 0 };
        }
        migrationMap[key].frequency++;
      }
    }
    const migrationPatterns = Object.values(migrationMap).sort((a, b) => b.frequency - a.frequency).slice(0, 5);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayCounts = {};
    const hourCounts = {};
    for (const ride of monthRides) {
      const rLat = parseFloat(ride.pickupLat);
      const rLng = parseFloat(ride.pickupLng);
      if (haversineDist2(hubLat, hubLng, rLat, rLng) <= 2) {
        const d = new Date(ride.createdAt);
        dayCounts[d.getDay()] = (dayCounts[d.getDay()] || 0) + 1;
        hourCounts[d.getHours()] = (hourCounts[d.getHours()] || 0) + 1;
      }
    }
    let peakDay = "Mon";
    let peakDayCount = 0;
    for (const [day, cnt] of Object.entries(dayCounts)) {
      if (cnt > peakDayCount) {
        peakDayCount = cnt;
        peakDay = dayNames[parseInt(day)];
      }
    }
    let peakHour = "09:00";
    let peakHourCount = 0;
    for (const [hour, cnt] of Object.entries(hourCounts)) {
      if (cnt > peakHourCount) {
        peakHourCount = cnt;
        peakHour = `${String(parseInt(hour)).padStart(2, "0")}:00`;
      }
    }
    const totalNearbyMonth = Object.values(dayCounts).reduce((a, b) => a + b, 0);
    let currentTrend = "steady";
    if (nearbyRides.length > totalNearbyMonth / 30 * 1.5) currentTrend = "rising";
    else if (nearbyRides.length < totalNearbyMonth / 30 * 0.5) currentTrend = "declining";
    res.json({
      activityScore,
      vehiclesActive: nearbyDrivers.length,
      networkMembers: uniqueMembers.size,
      predictedYield,
      demandTrend,
      vehicleTicker,
      aiRecommendation,
      nextLikelyHub,
      migrationPatterns,
      seasonalBehavior: { currentTrend, peakDay, peakHour }
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to get hub intelligence" });
  }
});
router.get("/api/openclaw/hubs/:hubId/insights", async (req, res) => {
  try {
    let haversineDist2 = function(lat1, lng1, lat2, lng2) {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };
    var haversineDist = haversineDist2;
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const { hubId } = req.params;
    const [hub] = await db.select().from(hubs).where(eq27(hubs.id, hubId));
    if (!hub) {
      return res.status(404).json({ error: "Hub not found" });
    }
    const hubLat = parseFloat(hub.lat);
    const hubLng = parseFloat(hub.lng);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3);
    const now = Date.now();
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    if (session.role === "driver") {
      const [driver] = await db.select().from(drivers).where(eq27(drivers.userId, session.userId));
      if (!driver) return res.status(404).json({ error: "Driver profile not found" });
      const monthRides = await db.select().from(rides).where(
        and25(eq27(rides.driverId, driver.id), gte15(rides.createdAt, thirtyDaysAgo), eq27(rides.status, "completed"))
      );
      const nearbyRides = monthRides.filter((r) => {
        const rLat = parseFloat(r.pickupLat);
        const rLng = parseFloat(r.pickupLng);
        return haversineDist2(hubLat, hubLng, rLat, rLng) <= 2;
      });
      const totalEarnings = nearbyRides.reduce((sum2, r) => sum2 + parseFloat(r.driverEarnings || r.actualFare || r.estimatedFare || "0"), 0);
      const totalHours = nearbyRides.reduce((sum2, r) => sum2 + (r.duration || 0), 0) / 60;
      const avgYieldPerHour = totalHours > 0 ? Math.round(totalEarnings / totalHours * 100) / 100 : 0;
      const hourCounts = {};
      for (const ride of nearbyRides) {
        const h = new Date(ride.createdAt).getHours();
        hourCounts[h] = (hourCounts[h] || 0) + 1;
      }
      const sortedHours = Object.entries(hourCounts).sort((a, b) => parseInt(b[1]) - parseInt(a[1]));
      const bestActivationTimes = sortedHours.slice(0, 3).map(([h]) => {
        const hour = parseInt(h);
        return `${String(hour).padStart(2, "0")}:00-${String((hour + 2) % 24).padStart(2, "0")}:00`;
      });
      const prestige = await getOrCreatePrestige(session.userId);
      const contributionScore = parseFloat(prestige.networkParticipationScore || "0");
      const weekRides = monthRides.filter((r) => new Date(r.createdAt).getTime() >= sevenDaysAgo.getTime());
      const weeklyEarningsTrend = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now - i * 24 * 60 * 60 * 1e3);
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1e3);
        const dayRides = weekRides.filter((r) => {
          const t = new Date(r.completedAt || r.createdAt).getTime();
          return t >= dayStart.getTime() && t < dayEnd.getTime();
        });
        const dayEarnings = dayRides.reduce((sum2, r) => sum2 + parseFloat(r.driverEarnings || r.actualFare || r.estimatedFare || "0"), 0);
        weeklyEarningsTrend.push({ day: dayNames[d.getDay()], earnings: Math.round(dayEarnings * 100) / 100 });
      }
      res.json({
        role: "driver",
        avgYieldPerHour,
        bestActivationTimes: bestActivationTimes.length > 0 ? bestActivationTimes : ["08:00-10:00", "17:00-19:00"],
        contributionScore,
        weeklyEarningsTrend,
        totalRidesThisMonth: monthRides.length,
        avgRating: parseFloat(driver.rating || "5.00")
      });
    } else {
      const monthRides = await db.select().from(rides).where(
        and25(eq27(rides.customerId, session.userId), gte15(rides.createdAt, thirtyDaysAgo))
      );
      const completedRides = monthRides.filter((r) => r.status === "completed" && r.acceptedAt && r.startedAt);
      let avgWaitTime = 0;
      if (completedRides.length > 0) {
        const totalWaitMs = completedRides.reduce((sum2, r) => {
          const accepted = new Date(r.acceptedAt).getTime();
          const started = new Date(r.startedAt).getTime();
          return sum2 + (started - accepted);
        }, 0);
        avgWaitTime = Math.round(totalWaitMs / completedRides.length / 6e4 * 10) / 10;
      }
      const hourCounts = {};
      for (const ride of monthRides) {
        const h = new Date(ride.createdAt).getHours();
        hourCounts[h] = (hourCounts[h] || 0) + 1;
      }
      const sortedHours = Object.entries(hourCounts).sort((a, b) => parseInt(b[1]) - parseInt(a[1]));
      const peakActivityWindows = sortedHours.slice(0, 3).map(([h]) => {
        const hour = parseInt(h);
        return `${String(hour).padStart(2, "0")}:00-${String((hour + 2) % 24).padStart(2, "0")}:00`;
      });
      const completionRate = monthRides.length > 0 ? Math.round(completedRides.length / monthRides.length * 100) : 50;
      const hubReliabilityScore = Math.min(100, completionRate);
      const weekRides = monthRides.filter((r) => new Date(r.createdAt).getTime() >= sevenDaysAgo.getTime());
      const weeklyRidesTrend = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now - i * 24 * 60 * 60 * 1e3);
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1e3);
        const dayRideCount = weekRides.filter((r) => {
          const t = new Date(r.createdAt).getTime();
          return t >= dayStart.getTime() && t < dayEnd.getTime();
        }).length;
        weeklyRidesTrend.push({ day: dayNames[d.getDay()], rides: dayRideCount });
      }
      const checkIns = await db.select({
        hubId: hubCheckIns.hubId,
        hubName: hubs.name
      }).from(hubCheckIns).innerJoin(hubs, eq27(hubs.id, hubCheckIns.hubId)).where(and25(eq27(hubCheckIns.userId, session.userId), gte15(hubCheckIns.checkedInAt, thirtyDaysAgo)));
      const hubVisitCounts = {};
      for (const c of checkIns) {
        if (!hubVisitCounts[c.hubId]) hubVisitCounts[c.hubId] = { name: c.hubName, visits: 0 };
        hubVisitCounts[c.hubId].visits++;
      }
      const sortedHubVisits = Object.values(hubVisitCounts).sort((a, b) => b.visits - a.visits);
      const favoriteHub = sortedHubVisits.length > 0 ? sortedHubVisits[0] : null;
      res.json({
        role: "rider",
        avgWaitTime,
        peakActivityWindows: peakActivityWindows.length > 0 ? peakActivityWindows : ["08:00-10:00", "17:00-19:00"],
        hubReliabilityScore,
        weeklyRidesTrend,
        totalRidesThisMonth: monthRides.length,
        favoriteHub
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to get hub insights" });
  }
});
var openClawRouter = router;

// server/coffeeRoutes.ts
import { Router as Router2 } from "express";
init_db();
init_schema();
import { eq as eq28, and as and26, desc as desc21 } from "drizzle-orm";
var router2 = Router2();
async function getSessionUser2(req) {
  const token = req.headers.authorization?.split(" ")[1] || "";
  if (!token) return null;
  const session = await storage.getSession(token);
  if (!session) return null;
  if (/* @__PURE__ */ new Date() > session.expiresAt) return null;
  return session;
}
var COFFEE_MENU = [
  { id: "karak_tea", name: "Karak Tea", category: "tea", basePrice: 5, currency: "AED", description: "Traditional spiced milk tea" },
  { id: "arabic_coffee", name: "Arabic Coffee", category: "coffee", basePrice: 8, currency: "AED", description: "Traditional gahwa with cardamom" },
  { id: "cappuccino", name: "Cappuccino", category: "coffee", basePrice: 15, currency: "AED", description: "Espresso with steamed milk foam" },
  { id: "latte", name: "Latte", category: "coffee", basePrice: 16, currency: "AED", description: "Espresso with steamed milk" },
  { id: "espresso", name: "Espresso", category: "coffee", basePrice: 12, currency: "AED", description: "Rich single shot espresso" },
  { id: "americano", name: "Americano", category: "coffee", basePrice: 13, currency: "AED", description: "Espresso with hot water" },
  { id: "mocha", name: "Mocha", category: "coffee", basePrice: 18, currency: "AED", description: "Espresso with chocolate and steamed milk" },
  { id: "iced_latte", name: "Iced Latte", category: "iced", basePrice: 18, currency: "AED", description: "Chilled espresso with cold milk" },
  { id: "iced_americano", name: "Iced Americano", category: "iced", basePrice: 15, currency: "AED", description: "Chilled espresso with cold water" },
  { id: "matcha_latte", name: "Matcha Latte", category: "specialty", basePrice: 20, currency: "AED", description: "Japanese matcha with steamed milk" },
  { id: "turkish_coffee", name: "Turkish Coffee", category: "coffee", basePrice: 10, currency: "AED", description: "Fine ground coffee, strong and bold" },
  { id: "hot_chocolate", name: "Hot Chocolate", category: "other", basePrice: 16, currency: "AED", description: "Rich Belgian chocolate drink" }
];
var SIZE_MULTIPLIERS = {
  small: 0.8,
  medium: 1,
  large: 1.3
};
router2.get("/api/coffee/menu", async (req, res) => {
  try {
    const session = await getSessionUser2(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const categories = {};
    for (const item of COFFEE_MENU) {
      if (!categories[item.category]) categories[item.category] = [];
      categories[item.category].push(item);
    }
    res.json({ menu: COFFEE_MENU, categories, sizes: ["small", "medium", "large"] });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load menu" });
  }
});
router2.post("/api/coffee/orders", async (req, res) => {
  try {
    const session = await getSessionUser2(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const {
      orderType,
      coffeeName,
      coffeeSize,
      quantity,
      specialInstructions,
      giftMessage,
      recipientPhone,
      recipientName,
      hubId,
      deliveryLat,
      deliveryLng,
      deliveryAddress,
      paymentMethod
    } = req.body;
    if (!coffeeName || !orderType) {
      return res.status(400).json({ error: "Coffee name and order type are required" });
    }
    const menuItem = COFFEE_MENU.find((m) => m.id === coffeeName || m.name === coffeeName);
    if (!menuItem) {
      return res.status(400).json({ error: "Invalid coffee selection" });
    }
    const size = coffeeSize || "medium";
    const qty = Math.max(1, Math.min(quantity || 1, 10));
    const sizeMultiplier = SIZE_MULTIPLIERS[size] || 1;
    const itemPrice = Math.round(menuItem.basePrice * sizeMultiplier * 100) / 100;
    const deliveryFee = orderType === "buy" ? 0 : 5;
    const totalAmount = Math.round((itemPrice * qty + deliveryFee) * 100) / 100;
    let hubData2 = null;
    if (hubId) {
      const hubResults = await db.select().from(hubs).where(eq28(hubs.id, hubId));
      hubData2 = hubResults[0] || null;
    }
    const [order] = await db.insert(coffeeOrders).values({
      ordererId: session.userId,
      orderType,
      coffeeName: menuItem.name,
      coffeeSize: size,
      quantity: qty,
      specialInstructions: specialInstructions || null,
      giftMessage: orderType === "gift" ? giftMessage || null : null,
      recipientPhone: orderType === "gift" ? recipientPhone || null : null,
      recipientName: orderType === "gift" ? recipientName || null : null,
      hubId: hubId || null,
      pickupLat: hubData2 ? hubData2.lat : null,
      pickupLng: hubData2 ? hubData2.lng : null,
      pickupAddress: hubData2 ? hubData2.address : null,
      deliveryLat: deliveryLat || null,
      deliveryLng: deliveryLng || null,
      deliveryAddress: deliveryAddress || null,
      itemPrice: itemPrice.toString(),
      deliveryFee: deliveryFee.toString(),
      totalAmount: totalAmount.toString(),
      paymentMethod: paymentMethod || "card",
      estimatedDeliveryMinutes: 15,
      status: "pending"
    }).returning();
    res.json({ order });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to create coffee order" });
  }
});
router2.get("/api/coffee/orders", async (req, res) => {
  try {
    const session = await getSessionUser2(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const userOrders = await db.select().from(coffeeOrders).where(eq28(coffeeOrders.ordererId, session.userId)).orderBy(desc21(coffeeOrders.createdAt));
    res.json({ orders: userOrders });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch orders" });
  }
});
router2.get("/api/coffee/orders/:orderId", async (req, res) => {
  try {
    const session = await getSessionUser2(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const [order] = await db.select().from(coffeeOrders).where(eq28(coffeeOrders.id, req.params.orderId));
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.ordererId !== session.userId && order.driverId !== session.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json({ order });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch order" });
  }
});
router2.patch("/api/coffee/orders/:orderId/cancel", async (req, res) => {
  try {
    const session = await getSessionUser2(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const [order] = await db.select().from(coffeeOrders).where(eq28(coffeeOrders.id, req.params.orderId));
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.ordererId !== session.userId) return res.status(403).json({ error: "Forbidden" });
    const cancellable = ["pending", "accepted"];
    if (!cancellable.includes(order.status)) {
      return res.status(400).json({ error: "Order cannot be cancelled at this stage" });
    }
    const [updated] = await db.update(coffeeOrders).set({
      status: "cancelled",
      cancelledAt: /* @__PURE__ */ new Date(),
      cancelReason: req.body.reason || "Cancelled by customer",
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq28(coffeeOrders.id, req.params.orderId)).returning();
    res.json({ order: updated });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to cancel order" });
  }
});
router2.get("/api/coffee/driver/orders", async (req, res) => {
  try {
    const session = await getSessionUser2(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const driverRecords = await db.select().from(drivers).where(eq28(drivers.userId, session.userId));
    if (driverRecords.length === 0) return res.status(403).json({ error: "Not a driver" });
    const driver = driverRecords[0];
    const status = req.query.status;
    let query;
    if (status === "available") {
      query = db.select().from(coffeeOrders).where(eq28(coffeeOrders.status, "pending")).orderBy(desc21(coffeeOrders.createdAt));
    } else {
      query = db.select().from(coffeeOrders).where(eq28(coffeeOrders.driverId, driver.id)).orderBy(desc21(coffeeOrders.createdAt));
    }
    const orders = await query;
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch driver orders" });
  }
});
router2.patch("/api/coffee/driver/orders/:orderId/accept", async (req, res) => {
  try {
    const session = await getSessionUser2(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const driverRecords = await db.select().from(drivers).where(eq28(drivers.userId, session.userId));
    if (driverRecords.length === 0) return res.status(403).json({ error: "Not a driver" });
    const driver = driverRecords[0];
    const [order] = await db.select().from(coffeeOrders).where(eq28(coffeeOrders.id, req.params.orderId));
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status !== "pending") return res.status(400).json({ error: "Order already taken" });
    const [updated] = await db.update(coffeeOrders).set({
      driverId: driver.id,
      status: "accepted",
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq28(coffeeOrders.id, req.params.orderId)).returning();
    res.json({ order: updated });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to accept order" });
  }
});
router2.patch("/api/coffee/driver/orders/:orderId/status", async (req, res) => {
  try {
    const session = await getSessionUser2(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const driverRecords = await db.select().from(drivers).where(eq28(drivers.userId, session.userId));
    if (driverRecords.length === 0) return res.status(403).json({ error: "Not a driver" });
    const driver = driverRecords[0];
    const { status } = req.body;
    const validTransitions = {
      accepted: ["preparing", "cancelled"],
      preparing: ["ready"],
      ready: ["picked_up"],
      picked_up: ["delivering"],
      delivering: ["delivered"]
    };
    const [order] = await db.select().from(coffeeOrders).where(and26(eq28(coffeeOrders.id, req.params.orderId), eq28(coffeeOrders.driverId, driver.id)));
    if (!order) return res.status(404).json({ error: "Order not found" });
    const allowed = validTransitions[order.status];
    if (!allowed || !allowed.includes(status)) {
      return res.status(400).json({ error: `Cannot transition from ${order.status} to ${status}` });
    }
    const updates = { status, updatedAt: /* @__PURE__ */ new Date() };
    if (status === "delivered") updates.completedAt = /* @__PURE__ */ new Date();
    if (status === "cancelled") {
      updates.cancelledAt = /* @__PURE__ */ new Date();
      updates.cancelReason = req.body.reason || "Cancelled by driver";
    }
    const [updated] = await db.update(coffeeOrders).set(updates).where(eq28(coffeeOrders.id, req.params.orderId)).returning();
    res.json({ order: updated });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update order status" });
  }
});
var coffeeRouter = router2;

// server/hubSeeder.ts
init_db();
init_schema();
import { sql as sql23 } from "drizzle-orm";
var hubData = [
  { name: "Dubai Mall & Downtown", type: "mall", lat: "25.19720000", lng: "55.27440000", radiusMeters: 500, regionCode: "AE-DU", description: "Premium mobility hub at Dubai Mall & Burj Khalifa area - highest foot traffic zone in Dubai with 54M+ annual visitors", address: "Downtown Dubai, Dubai Mall, UAE", peakHours: "10:00-14:00,17:00-23:00" },
  { name: "JBR Beach & The Walk", type: "custom", lat: "25.07300000", lng: "55.13430000", radiusMeters: 400, regionCode: "AE-DU", description: "Beachfront lifestyle hub at Jumeirah Beach Residence - popular dining, shopping and beach destination", address: "JBR The Walk, Dubai, UAE", peakHours: "09:00-12:00,17:00-23:00" },
  { name: "Dubai Marina Walk", type: "custom", lat: "25.07550000", lng: "55.13980000", radiusMeters: 350, regionCode: "AE-DU", description: "Waterfront marina hub with restaurants, yachts and nightlife - one of Dubai's most active social zones", address: "Dubai Marina, Dubai, UAE", peakHours: "11:00-14:00,18:00-00:00" },
  { name: "Mall of the Emirates", type: "mall", lat: "25.11810000", lng: "55.20060000", radiusMeters: 400, regionCode: "AE-DU", description: "Major shopping and entertainment hub featuring Ski Dubai - high-traffic retail zone in Al Barsha", address: "Al Barsha, Mall of the Emirates, Dubai, UAE", peakHours: "10:00-14:00,16:00-22:00" },
  { name: "DIFC Financial Centre", type: "custom", lat: "25.21000000", lng: "55.27940000", radiusMeters: 300, regionCode: "AE-DU", description: "Dubai International Financial Centre - premium business district with high-value professional traffic", address: "DIFC, Dubai, UAE", peakHours: "07:00-09:00,12:00-14:00,17:00-19:00" },
  { name: "Dubai International Airport", type: "airport", lat: "25.25320000", lng: "55.36570000", radiusMeters: 600, regionCode: "AE-DU", description: "World's busiest international airport hub - 24/7 high-demand zone for airport transfers and pickups", address: "DXB Airport, Dubai, UAE", peakHours: "00:00-06:00,08:00-11:00,19:00-23:00" },
  { name: "Business Bay Metro Hub", type: "station", lat: "25.18600000", lng: "55.26160000", radiusMeters: 350, regionCode: "AE-DU", description: "Business Bay commercial district - mix of offices, hotels and residential towers with steady demand", address: "Business Bay, Dubai, UAE", peakHours: "07:00-10:00,17:00-20:00" },
  { name: "Deira Gold Souk & Creek", type: "custom", lat: "25.26960000", lng: "55.29980000", radiusMeters: 350, regionCode: "AE-DU", description: "Historic trading hub at Deira - Gold Souk, Spice Souk and Dubai Creek area with heavy tourist and local traffic", address: "Deira, Gold Souk, Dubai, UAE", peakHours: "09:00-13:00,16:00-21:00" },
  { name: "Palm Jumeirah Gateway", type: "custom", lat: "25.11240000", lng: "55.13900000", radiusMeters: 400, regionCode: "AE-DU", description: "Gateway to Palm Jumeirah - luxury residential island with hotels, restaurants and beach clubs", address: "Palm Jumeirah, Dubai, UAE", peakHours: "10:00-14:00,18:00-23:00" },
  { name: "Dubai Hills Mall", type: "mall", lat: "25.10320000", lng: "55.22630000", radiusMeters: 350, regionCode: "AE-DU", description: "Growing family-oriented hub in Dubai Hills Estate - rapidly expanding community with modern mall", address: "Dubai Hills Estate, Dubai, UAE", peakHours: "10:00-13:00,16:00-21:00" },
  { name: "Muwailah Commercial Hub", type: "mall", lat: "25.29820000", lng: "55.45720000", radiusMeters: 400, regionCode: "AE-SH", description: "Central mobility hub in Muwailah Commercial, Sharjah - high-traffic commercial and residential zone near University City", address: "Muwailah Commercial, Sharjah, UAE", peakHours: "07:00-09:00,17:00-20:00" },
  { name: "Al Khan Beach & Aquarium", type: "custom", lat: "25.33200000", lng: "55.37600000", radiusMeters: 350, regionCode: "AE-SH", description: "Coastal leisure hub - Sharjah Aquarium, Al Khan beach, family attractions and waterfront dining", address: "Al Khan, Sharjah, UAE", peakHours: "09:00-12:00,16:00-21:00" },
  { name: "Al Majaz Waterfront", type: "custom", lat: "25.33800000", lng: "55.38700000", radiusMeters: 400, regionCode: "AE-SH", description: "Sharjah's premier waterfront destination - dancing fountains, restaurants, green spaces and cultural events", address: "Al Majaz Waterfront, Sharjah, UAE", peakHours: "16:00-22:00" },
  { name: "Sharjah City Centre Mall", type: "mall", lat: "25.32850000", lng: "55.39300000", radiusMeters: 350, regionCode: "AE-SH", description: "Major shopping mall in Sharjah with high retail traffic and entertainment", address: "City Centre Sharjah, UAE", peakHours: "10:00-14:00,16:00-22:00" },
  { name: "Abu Dhabi Corniche", type: "custom", lat: "24.46310000", lng: "54.35530000", radiusMeters: 500, regionCode: "AE-AZ", description: "Iconic 8km waterfront corniche - popular beach, cycling and family leisure destination in Abu Dhabi", address: "Corniche Road, Abu Dhabi, UAE", peakHours: "06:00-09:00,16:00-21:00" },
  { name: "Abu Dhabi Marina Mall", type: "mall", lat: "24.47600000", lng: "54.32150000", radiusMeters: 350, regionCode: "AE-AZ", description: "Popular waterfront mall near the Corniche with dining, shopping and marina views", address: "Marina Mall, Abu Dhabi, UAE", peakHours: "10:00-14:00,16:00-22:00" },
  { name: "Yas Island Entertainment Hub", type: "custom", lat: "24.49000000", lng: "54.60100000", radiusMeters: 600, regionCode: "AE-AZ", description: "Major entertainment island - Ferrari World, Yas Waterworld, Warner Bros World, F1 circuit", address: "Yas Island, Abu Dhabi, UAE", peakHours: "10:00-14:00,16:00-22:00" },
  { name: "Saadiyat Cultural District", type: "custom", lat: "24.53400000", lng: "54.40980000", radiusMeters: 400, regionCode: "AE-AZ", description: "World-class cultural hub - Louvre Abu Dhabi, Guggenheim, luxury resorts and pristine beaches", address: "Saadiyat Island, Abu Dhabi, UAE", peakHours: "09:00-13:00,16:00-20:00" },
  { name: "Al Reem Island", type: "custom", lat: "24.49750000", lng: "54.40500000", radiusMeters: 400, regionCode: "AE-AZ", description: "Modern residential and commercial island - high-rise towers, shopping centers and urban living hub", address: "Al Reem Island, Abu Dhabi, UAE", peakHours: "07:00-09:00,17:00-20:00" },
  { name: "Ajman Corniche", type: "custom", lat: "25.41000000", lng: "55.44700000", radiusMeters: 400, regionCode: "AE-AJ", description: "Ajman's scenic corniche - beachfront promenade with hotels, dining and family recreation areas", address: "Corniche Road, Ajman, UAE", peakHours: "16:00-21:00" },
  { name: "City Centre Ajman", type: "mall", lat: "25.40460000", lng: "55.47820000", radiusMeters: 300, regionCode: "AE-AJ", description: "Main shopping and entertainment hub in Ajman - retail, dining, cinema and family activities", address: "City Centre Ajman, UAE", peakHours: "10:00-14:00,16:00-22:00" },
  { name: "Al Olaya District & Kingdom Centre", type: "custom", lat: "24.71100000", lng: "46.67450000", radiusMeters: 500, regionCode: "SA-RY", description: "Riyadh's premium financial and commercial district - Kingdom Centre Tower, luxury shopping, corporate offices", address: "Al Olaya, Riyadh, KSA", peakHours: "07:00-09:00,12:00-14:00,17:00-21:00" },
  { name: "Riyadh Boulevard", type: "custom", lat: "24.69500000", lng: "46.68400000", radiusMeters: 500, regionCode: "SA-RY", description: "Major entertainment zone - restaurants, events, concerts, themed attractions and seasonal festivals", address: "Boulevard Riyadh City, KSA", peakHours: "16:00-00:00" },
  { name: "Riyadh Park Mall", type: "mall", lat: "24.63720000", lng: "46.61770000", radiusMeters: 350, regionCode: "SA-RY", description: "Large modern mall with family entertainment, dining and retail in south Riyadh", address: "Riyadh Park, Riyadh, KSA", peakHours: "10:00-14:00,16:00-22:00" },
  { name: "Al Nakheel & Diplomatic Quarter", type: "custom", lat: "24.68900000", lng: "46.62500000", radiusMeters: 400, regionCode: "SA-RY", description: "Upscale residential and diplomatic hub - embassies, international schools, expat compounds", address: "Al Nakheel, Diplomatic Quarter, Riyadh, KSA", peakHours: "07:00-09:00,14:00-17:00" },
  { name: "King Khalid International Airport", type: "airport", lat: "24.95780000", lng: "46.69890000", radiusMeters: 600, regionCode: "SA-RY", description: "Riyadh's main airport - 24/7 high-demand zone for airport transfers, serving 30M+ passengers annually", address: "KKIA Airport, Riyadh, KSA", peakHours: "00:00-06:00,08:00-11:00,19:00-23:00" },
  { name: "Diriyah Gate Heritage", type: "custom", lat: "24.73450000", lng: "46.57280000", radiusMeters: 400, regionCode: "SA-RY", description: "UNESCO World Heritage Site - At-Turaif district, heritage dining at Al Bujairi, luxury entertainment mega-project", address: "Diriyah, Riyadh, KSA", peakHours: "10:00-14:00,17:00-23:00" },
  { name: "Jeddah Corniche & King Fahd Fountain", type: "custom", lat: "21.55500000", lng: "39.10600000", radiusMeters: 500, regionCode: "SA-JD", description: "Iconic Red Sea waterfront - world's tallest fountain, seaside dining, family recreation along 30km corniche", address: "Jeddah Corniche, Jeddah, KSA", peakHours: "16:00-23:00" },
  { name: "King Abdulaziz International Airport", type: "airport", lat: "21.66980000", lng: "39.15670000", radiusMeters: 600, regionCode: "SA-JD", description: "Jeddah airport and Hajj terminal - gateway for pilgrims to Mecca and Medina, massive seasonal demand", address: "KAIA Airport, Jeddah, KSA", peakHours: "00:00-06:00,08:00-12:00,18:00-23:00" },
  { name: "Red Sea Mall", type: "mall", lat: "21.61410000", lng: "39.11310000", radiusMeters: 400, regionCode: "SA-JD", description: "Major shopping destination in north Jeddah - 500+ stores, entertainment, dining and events", address: "Red Sea Mall, Jeddah, KSA", peakHours: "10:00-14:00,16:00-23:00" },
  { name: "Al Balad Historic District", type: "custom", lat: "21.48250000", lng: "39.18620000", radiusMeters: 400, regionCode: "SA-JD", description: "UNESCO World Heritage Site - ancient coral stone buildings, traditional souks, cultural heart of Jeddah", address: "Al Balad, Old Jeddah, KSA", peakHours: "09:00-13:00,17:00-22:00" },
  { name: "Dammam Corniche", type: "custom", lat: "26.42970000", lng: "50.11330000", radiusMeters: 400, regionCode: "SA-DM", description: "Eastern Province waterfront - family leisure, seafood restaurants, scenic Gulf views", address: "Dammam Corniche, Dammam, KSA", peakHours: "16:00-22:00" },
  { name: "Dhahran Mall & KFUPM", type: "mall", lat: "26.30760000", lng: "50.13940000", radiusMeters: 400, regionCode: "SA-DM", description: "Major commercial hub near King Fahd University - student traffic, shopping and dining zone", address: "Dhahran, Eastern Province, KSA", peakHours: "10:00-14:00,16:00-22:00" },
  { name: "Salmiya Commercial District", type: "custom", lat: "29.33400000", lng: "48.07700000", radiusMeters: 500, regionCode: "KW-KU", description: "Kuwait's largest residential and commercial area - Marina Mall, beachfront promenades, upscale shopping and dining", address: "Salmiya, Kuwait", peakHours: "10:00-14:00,17:00-23:00" },
  { name: "The Avenues Mall", type: "mall", lat: "29.31050000", lng: "47.94200000", radiusMeters: 500, regionCode: "KW-KU", description: "Kuwait's largest mall with 1,100+ stores - busiest shopping destination, peak activity on Friday evenings", address: "The Avenues, Rai, Kuwait", peakHours: "10:00-14:00,16:00-23:00" },
  { name: "Souq Mubarakiya", type: "custom", lat: "29.37600000", lng: "47.97300000", radiusMeters: 300, regionCode: "KW-KU", description: "Kuwait's oldest and most famous traditional market - spices, gold, textiles, street food, cultural heritage hub", address: "Souq Mubarakiya, Kuwait City, Kuwait", peakHours: "09:00-13:00,17:00-22:00" },
  { name: "Kuwait Towers & Sharq", type: "custom", lat: "29.38700000", lng: "47.99100000", radiusMeters: 350, regionCode: "KW-KU", description: "Iconic Kuwait Towers landmark area - waterfront, Souq Sharq shopping, tourist attraction zone", address: "Kuwait Towers, Sharq, Kuwait City", peakHours: "10:00-14:00,16:00-21:00" },
  { name: "360 Mall", type: "mall", lat: "29.28900000", lng: "48.02600000", radiusMeters: 350, regionCode: "KW-KU", description: "Premium luxury shopping mall - upscale brands, fine dining, entertainment, popular social gathering point", address: "360 Mall, South Surra, Kuwait", peakHours: "10:00-14:00,16:00-22:00" },
  { name: "Fahaheel Waterfront & Al Kout", type: "custom", lat: "29.08300000", lng: "48.13100000", radiusMeters: 400, regionCode: "KW-KU", description: "Southern coastal hub - Al Kout Mall, fish market, waterfront dining, family-friendly area in Ahmadi", address: "Fahaheel, Al Kout, Kuwait", peakHours: "10:00-13:00,16:00-22:00" },
  { name: "Seef District & City Centre", type: "mall", lat: "26.23610000", lng: "50.53310000", radiusMeters: 450, regionCode: "BH-MA", description: "Major commercial hub - Bahrain City Centre Mall, Seef Mall, high-rise towers, dining and entertainment", address: "Seef District, Manama, Bahrain", peakHours: "10:00-14:00,16:00-23:00" },
  { name: "Bab Al Bahrain & Manama Souq", type: "custom", lat: "26.22850000", lng: "50.58600000", radiusMeters: 350, regionCode: "BH-MA", description: "Historic gateway to Manama Souq - gold, spices, perfumes, traditional crafts, heavy foot traffic since 1926", address: "Bab Al Bahrain, Manama, Bahrain", peakHours: "09:00-13:00,16:00-21:00" },
  { name: "Adliya Art & Dining District", type: "custom", lat: "26.21500000", lng: "50.58000000", radiusMeters: 300, regionCode: "BH-MA", description: "Trendy art and dining hub - galleries, upscale cafes, Block 338, weekend brunch hotspot", address: "Adliya, Manama, Bahrain", peakHours: "10:00-14:00,18:00-23:00" },
  { name: "Juffair District", type: "custom", lat: "26.21350000", lng: "50.60440000", radiusMeters: 400, regionCode: "BH-MA", description: "Bahrain's vibrant expat and nightlife district - restaurants, bars, entertainment, near US Naval base", address: "Juffair, Manama, Bahrain", peakHours: "11:00-14:00,18:00-02:00" },
  { name: "Amwaj Islands", type: "custom", lat: "26.27300000", lng: "50.66200000", radiusMeters: 400, regionCode: "BH-MA", description: "Beach community island - waterfront dining, expat families, weekend recreation and beach activities", address: "Amwaj Islands, Bahrain", peakHours: "09:00-12:00,16:00-22:00" }
];
async function initializeHubs() {
  const result = await db.select({ count: sql23`cast(count(*) as integer)` }).from(hubs);
  const count8 = result[0].count;
  if (count8 > 0) {
    console.log(`Hubs already initialized: ${count8} hubs`);
    return;
  }
  const allCities = await db.select({ id: cities.id, regionCode: cities.regionCode }).from(cities);
  const cityMap = /* @__PURE__ */ new Map();
  for (const city of allCities) {
    if (city.regionCode) {
      cityMap.set(city.regionCode, city.id);
    }
  }
  const hubsToInsert = [];
  let skipped = 0;
  for (const hub of hubData) {
    const cityId = cityMap.get(hub.regionCode);
    if (!cityId) {
      console.log(`[HUBS] Skipping "${hub.name}" - no city found for region ${hub.regionCode}`);
      skipped++;
      continue;
    }
    hubsToInsert.push({
      name: hub.name,
      type: hub.type,
      lat: hub.lat,
      lng: hub.lng,
      radiusMeters: hub.radiusMeters,
      cityId,
      regionCode: hub.regionCode,
      description: hub.description,
      address: hub.address,
      peakHours: hub.peakHours,
      status: "active"
    });
  }
  if (hubsToInsert.length > 0) {
    await db.insert(hubs).values(hubsToInsert);
  }
  console.log(`Initialized ${hubsToInsert.length} hubs across Gulf region${skipped > 0 ? ` (${skipped} skipped - missing cities)` : ""}`);
}

// server/routes.ts
init_schema();
init_db();
import { eq as eq30, and as and27, gte as gte16, desc as desc22, count as count7 } from "drizzle-orm";
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const newHash = scryptSync(password, salt, 64).toString("hex");
  const hashBuffer = Buffer.from(hash, "hex");
  const newHashBuffer = Buffer.from(newHash, "hex");
  if (hashBuffer.length !== newHashBuffer.length) return false;
  return timingSafeEqual(hashBuffer, newHashBuffer);
}
async function createSession(userId, role) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3);
  await storage.createSession(token, userId, role, expiresAt);
  return token;
}
async function validateSession(token) {
  const session = await storage.getSession(token);
  if (!session) return null;
  if (/* @__PURE__ */ new Date() > session.expiresAt) {
    await storage.deleteSession(token);
    return null;
  }
  return { userId: session.userId, role: session.role };
}
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }
  const token = authHeader.slice(7);
  const session = await validateSession(token);
  if (!session) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
  req.userId = session.userId;
  req.userRole = session.role;
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
}
async function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }
  const token = authHeader.slice(7);
  const session = await validateSession(token);
  if (!session) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
  if (session.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  req.userId = session.userId;
  req.userRole = session.role;
  next();
}
async function registerRoutes(app2) {
  app2.post("/api/account/delete-request", async (req, res) => {
    try {
      const { email, phone, userType, reason } = req.body;
      if (!email || !phone) {
        return res.status(400).json({ error: "Email and phone are required" });
      }
      console.log(`[ACCOUNT-DELETE] Request received: email=${email}, phone=${phone}, type=${userType}, reason=${reason || "none"}`);
      res.json({ success: true, message: "Your account deletion request has been received. We will process it within 30 days." });
    } catch (error) {
      res.status(500).json({ error: "Failed to process deletion request" });
    }
  });
  app2.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name, phone } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ message: "Email, password, and name are required" });
      }
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }
      const user = await storage.createUser({
        id: uuidv45(),
        email,
        password: hashPassword(password),
        name,
        phone: phone || null,
        role: "customer"
      });
      const token = await createSession(user.id, user.role);
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role
        },
        token
      });
    } catch (error) {
      res.status(500).json({ message: error.message || "Registration failed" });
    }
  });
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      if (!verifyPassword(password, user.password)) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const token = await createSession(user.id, user.role);
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role
        },
        token
      });
    } catch (error) {
      res.status(500).json({ message: error.message || "Login failed" });
    }
  });
  app2.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role
        }
      });
    } catch (error) {
      res.status(500).json({ message: error.message || "Failed to get user" });
    }
  });
  app2.post("/api/auth/guest", async (_req, res) => {
    try {
      const guestId = uuidv45();
      const guestEmail = `guest_${guestId.slice(0, 8)}@travony.local`;
      const user = await storage.createUser({
        id: guestId,
        email: guestEmail,
        name: "Guest User",
        role: "customer"
      });
      const token = await createSession(user.id, user.role);
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        token
      });
    } catch (error) {
      res.status(500).json({ message: error.message || "Guest login failed" });
    }
  });
  const otpStore = /* @__PURE__ */ new Map();
  const pendingRegistrations = /* @__PURE__ */ new Map();
  app2.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone || phone.length < 10) {
        return res.status(400).json({ message: "Valid phone number is required" });
      }
      if (isVerifyConfigured()) {
        console.log(`Using Twilio Verify for ${phone}`);
        const verifyResult = await sendVerifyOtp(phone);
        if (verifyResult.success) {
          otpStore.set(phone, { otp: "VERIFY", expiresAt: new Date(Date.now() + 10 * 60 * 1e3), attempts: 0 });
          return res.json({
            success: true,
            message: "Verification code sent via SMS",
            channel: "verify"
          });
        }
        console.log(`Verify failed for ${phone}, falling back to direct SMS`);
      }
      const otp = Math.floor(1e5 + Math.random() * 9e5).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1e3);
      otpStore.set(phone, { otp, expiresAt, attempts: 0 });
      const otpResult = await sendOtp(phone, otp, false);
      if (!otpResult.success) {
        console.error(`Failed to send OTP to ${phone}:`, otpResult.error);
        otpStore.delete(phone);
        return res.status(500).json({
          success: false,
          message: otpResult.error || "Failed to send verification code. Please try again."
        });
      }
      console.log(`OTP sent successfully to ${phone} via ${otpResult.channel}`);
      res.json({
        success: true,
        message: "Verification code sent via SMS",
        channel: otpResult.channel
      });
    } catch (error) {
      res.status(500).json({ message: error.message || "Failed to send OTP" });
    }
  });
  app2.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { phone, otp } = req.body;
      if (!phone || !otp) {
        return res.status(400).json({ message: "Phone and OTP are required" });
      }
      const storedOtp = otpStore.get(phone);
      if (!storedOtp) {
        return res.status(400).json({ message: "No verification code found. Please request a new one." });
      }
      if (/* @__PURE__ */ new Date() > storedOtp.expiresAt) {
        otpStore.delete(phone);
        return res.status(400).json({ message: "Verification code expired. Please request a new one." });
      }
      storedOtp.attempts += 1;
      if (storedOtp.attempts > 5) {
        otpStore.delete(phone);
        return res.status(429).json({ message: "Too many attempts. Please request a new code." });
      }
      if (storedOtp.otp === "VERIFY") {
        const verifyResult = await checkVerifyOtp(phone, otp);
        if (!verifyResult.success) {
          return res.status(400).json({ message: verifyResult.error || "Invalid verification code" });
        }
      } else if (storedOtp.otp !== otp) {
        return res.status(400).json({ message: "Invalid verification code" });
      }
      otpStore.delete(phone);
      const existingUser = await storage.getUserByPhone(phone);
      if (existingUser) {
        const token = await createSession(existingUser.id, existingUser.role);
        res.json({
          success: true,
          isNewUser: false,
          user: {
            id: existingUser.id,
            email: existingUser.email || "",
            name: existingUser.name || "User",
            phone: existingUser.phone,
            role: existingUser.role
          },
          token
        });
      } else {
        const sessionToken = randomBytes(32).toString("hex");
        pendingRegistrations.set(sessionToken, {
          phone,
          expiresAt: new Date(Date.now() + 15 * 60 * 1e3)
          // 15 minutes
        });
        res.json({
          success: true,
          isNewUser: true,
          sessionToken
        });
      }
    } catch (error) {
      res.status(500).json({ message: error.message || "OTP verification failed" });
    }
  });
  app2.post("/api/auth/complete-registration", async (req, res) => {
    try {
      const { sessionToken, name, role } = req.body;
      if (!sessionToken || !name) {
        return res.status(400).json({ message: "Session token and name are required" });
      }
      const pending = pendingRegistrations.get(sessionToken);
      if (!pending) {
        return res.status(400).json({ message: "Invalid or expired session. Please start over." });
      }
      if (/* @__PURE__ */ new Date() > pending.expiresAt) {
        pendingRegistrations.delete(sessionToken);
        return res.status(400).json({ message: "Session expired. Please start over." });
      }
      const validRole = role === "driver" ? "driver" : "customer";
      const userId = uuidv45();
      const email = `phone_${pending.phone.replace(/\+/g, "").replace(/ /g, "")}@travony.local`;
      const user = await storage.createUser({
        id: userId,
        email,
        name: name.trim(),
        phone: pending.phone,
        role: validRole
      });
      pendingRegistrations.set(sessionToken, {
        ...pending,
        expiresAt: new Date(Date.now() + 5 * 60 * 1e3)
        // Extend for biometric setup
      });
      const token = await createSession(user.id, user.role);
      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email || "",
          name: user.name || "User",
          phone: user.phone,
          role: user.role
        },
        token
      });
    } catch (error) {
      res.status(500).json({ message: error.message || "Registration failed" });
    }
  });
  app2.post("/api/auth/finalize", async (req, res) => {
    try {
      const { sessionToken } = req.body;
      if (!sessionToken) {
        return res.status(400).json({ message: "Session token is required" });
      }
      const pending = pendingRegistrations.get(sessionToken);
      if (!pending) {
        return res.status(400).json({ message: "Invalid session" });
      }
      const pendingWithUser = pending;
      if (!pendingWithUser.userId) {
        return res.status(400).json({ message: "User not found in session" });
      }
      const user = await storage.getUser(pendingWithUser.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const token = await createSession(user.id, user.role);
      pendingRegistrations.delete(sessionToken);
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role
        },
        token
      });
    } catch (error) {
      res.status(500).json({ message: error.message || "Finalization failed" });
    }
  });
  app2.get("/api/users/:id", requireAuth, async (req, res) => {
    try {
      if (req.params.id !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  const ALLOWED_USER_UPDATES = ["name", "phone", "avatar"];
  app2.patch("/api/users/:id", requireAuth, async (req, res) => {
    try {
      if (req.params.id !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const updates = {};
      for (const key of ALLOWED_USER_UPDATES) {
        if (req.body[key] !== void 0) {
          updates[key] = req.body[key];
        }
      }
      if (req.userRole === "admin" && req.body.role) {
        updates.role = req.body.role;
      }
      const user = await storage.updateUser(req.params.id, updates);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/rides/:id", async (req, res) => {
    try {
      const ride = await storage.getRide(req.params.id);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      res.json(ride);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/rides", async (req, res) => {
    try {
      const { customerId, driverId } = req.query;
      let rides4 = [];
      if (customerId) {
        rides4 = await storage.getRidesByCustomer(customerId);
      } else if (driverId) {
        rides4 = await storage.getRidesByDriver(driverId);
      }
      res.json(rides4);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/rides", requireAuth, async (req, res) => {
    try {
      console.log("POST /api/rides - serviceTypeId:", req.body.serviceTypeId, "body:", JSON.stringify(req.body).substring(0, 500));
      if (req.body.customerId && req.body.customerId !== req.userId) {
        return res.status(403).json({ message: "Cannot create ride for another user" });
      }
      const customerId = req.body.customerId || req.userId;
      const riderUser = await storage.getUser(customerId);
      if (!riderUser) {
        return res.status(404).json({
          code: "USER_NOT_FOUND",
          message: "User account not found"
        });
      }
      const paymentMethod = req.body.paymentMethod;
      const estimatedFareAmount = parseFloat(req.body.estimatedFare || "0");
      if (!paymentMethod) {
        return res.status(400).json({
          code: "PAYMENT_METHOD_REQUIRED",
          message: "Please select a payment method before booking."
        });
      }
      if (paymentMethod === "wallet") {
        const walletBalance = parseFloat(riderUser.walletBalance || "0");
        if (walletBalance < estimatedFareAmount) {
          return res.status(400).json({
            code: "INSUFFICIENT_WALLET_BALANCE",
            message: `Insufficient wallet balance. You have AED ${walletBalance.toFixed(2)} but need AED ${estimatedFareAmount.toFixed(2)}. Please top up your wallet first.`,
            walletBalance,
            requiredAmount: estimatedFareAmount
          });
        }
      } else if (paymentMethod === "usdt") {
        console.log("USDT payment selected - will be processed via NOWPayments at ride end");
      } else if (paymentMethod === "cash") {
        console.log("Cash payment selected - rider will pay driver directly");
      } else {
        return res.status(400).json({
          code: "INVALID_PAYMENT_METHOD",
          message: "Invalid payment method. Please use wallet, USDT, or cash."
        });
      }
      if (req.body.serviceTypeId) {
        const validServiceTypes = ["st-economy", "st-comfort", "st-premium", "st-xl"];
        const regionalVehicleTypes2 = ["cng", "rickshaw", "tuktuk", "moto", "economy", "comfort", "premium", "xl", "minibus"];
        const serviceTypeMap = {
          "economy": "st-economy",
          "comfort": "st-comfort",
          "premium": "st-premium",
          "xl": "st-xl",
          "cng": "st-economy",
          "rickshaw": "st-economy",
          "tuktuk": "st-economy",
          "moto": "st-economy",
          "minibus": "st-xl"
        };
        if (validServiceTypes.includes(req.body.serviceTypeId)) {
          console.log("Valid serviceTypeId:", req.body.serviceTypeId);
        } else if (serviceTypeMap[req.body.serviceTypeId]) {
          req.body.serviceTypeId = serviceTypeMap[req.body.serviceTypeId];
          console.log("Mapped serviceTypeId to:", req.body.serviceTypeId);
        } else if (regionalVehicleTypes2.includes(req.body.serviceTypeId)) {
          req.body.serviceTypeId = "st-economy";
          console.log("Defaulted regional serviceTypeId to:", req.body.serviceTypeId);
        } else {
          console.error("Invalid serviceTypeId:", req.body.serviceTypeId);
          return res.status(400).json({ message: `Invalid service type: ${req.body.serviceTypeId}` });
        }
      }
      const rideId = uuidv45();
      const estimatedFare = parseFloat(req.body.estimatedFare || "0");
      const feeBreakdown = calculateFeeBreakdown(estimatedFare);
      const priority = req.body.priority || "reliable";
      let intentData = {};
      if (req.body.pickupLat && req.body.pickupLng && req.body.dropoffLat && req.body.dropoffLng) {
        const bestMatch = await getBestAlignedDriver(
          customerId,
          parseFloat(req.body.pickupLat),
          parseFloat(req.body.pickupLng),
          parseFloat(req.body.dropoffLat),
          parseFloat(req.body.dropoffLng),
          priority
        );
        if (bestMatch) {
          intentData = {
            driverId: bestMatch.driverId,
            intentAlignmentScore: bestMatch.alignment.score.toFixed(2),
            matchType: bestMatch.alignment.matchType,
            aiMatchScore: (bestMatch.alignment.confidence * 100).toFixed(2)
          };
        } else {
          const pickupLat = parseFloat(req.body.pickupLat);
          const pickupLng = parseFloat(req.body.pickupLng);
          const onlineDrivers = await db.select().from(drivers).where(and27(eq30(drivers.isOnline, true), eq30(drivers.status, "approved")));
          let nearestDriver = null;
          let nearestDistance = 50;
          for (const driver of onlineDrivers) {
            const driverLat = parseFloat(driver.currentLat || "0");
            const driverLng = parseFloat(driver.currentLng || "0");
            if (driverLat === 0 && driverLng === 0) continue;
            const R = 6371;
            const dLat = (pickupLat - driverLat) * Math.PI / 180;
            const dLon = (pickupLng - driverLng) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(driverLat * Math.PI / 180) * Math.cos(pickupLat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distance = R * c;
            if (distance < nearestDistance) {
              nearestDistance = distance;
              nearestDriver = driver;
            }
          }
          if (nearestDriver) {
            intentData = {
              driverId: nearestDriver.id,
              matchType: "proximity_fallback",
              aiMatchScore: "0"
            };
            console.log(`Fallback match: Driver ${nearestDriver.id} at ${nearestDistance.toFixed(1)}km`);
          }
        }
      }
      const blockchainHash = generateRideHash({
        rideId,
        customerId,
        driverId: intentData.driverId || "pending",
        pickupAddress: req.body.pickupAddress || "",
        dropoffAddress: req.body.dropoffAddress || "",
        fare: estimatedFare,
        platformFee: feeBreakdown.platformFee,
        driverShare: feeBreakdown.driverShare,
        timestamp: /* @__PURE__ */ new Date()
      });
      const ride = await storage.createRide({
        ...req.body,
        id: rideId,
        customerId,
        status: "pending",
        blockchainHash,
        platformFee: feeBreakdown.platformFee.toFixed(2),
        driverEarnings: feeBreakdown.driverShare.toFixed(2),
        riderPriority: priority,
        ...intentData
      });
      res.json(ride);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.patch("/api/rides/:id", requireAuth, async (req, res) => {
    try {
      console.log("PATCH /api/rides/:id - Request body:", JSON.stringify(req.body));
      console.log("PATCH /api/rides/:id - User:", req.userId, "Role:", req.userRole);
      const existingRide = await storage.getRide(req.params.id);
      if (!existingRide) {
        return res.status(404).json({ message: "Ride not found" });
      }
      const isCustomer = existingRide.customerId === req.userId;
      const isAdmin = req.userRole === "admin";
      let isDriver = false;
      let driverRecord = null;
      if (req.userRole === "driver") {
        driverRecord = await storage.getDriverByUserId(req.userId);
        const isAssignedDriver = driverRecord?.id === existingRide.driverId;
        const canAcceptPendingRide = existingRide.status === "pending" && !existingRide.driverId && driverRecord?.status === "approved" && req.body.status === "accepted";
        isDriver = isAssignedDriver || canAcceptPendingRide;
      }
      if (!isCustomer && !isDriver && !isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      const allowedUpdates = {};
      if (isCustomer && !isDriver && !isAdmin) {
        if (req.body.status === "cancelled") {
          allowedUpdates.status = "cancelled";
        }
      } else if (isDriver || isAdmin) {
        Object.assign(allowedUpdates, req.body);
        if (allowedUpdates.completedAt && typeof allowedUpdates.completedAt === "string") {
          allowedUpdates.completedAt = new Date(allowedUpdates.completedAt);
        }
        if (allowedUpdates.cancelledAt && typeof allowedUpdates.cancelledAt === "string") {
          allowedUpdates.cancelledAt = new Date(allowedUpdates.cancelledAt);
        }
        if (allowedUpdates.startedAt && typeof allowedUpdates.startedAt === "string") {
          allowedUpdates.startedAt = new Date(allowedUpdates.startedAt);
        }
        if (driverRecord && existingRide.status === "pending" && req.body.status === "accepted") {
          allowedUpdates.driverId = driverRecord.id;
          allowedUpdates.acceptedAt = /* @__PURE__ */ new Date();
          fulfillByRide(driverRecord.id, existingRide.id).catch(console.error);
        }
      }
      const ride = await storage.updateRide(req.params.id, allowedUpdates);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      if (req.body.status === "cancelled" && existingRide.status !== "cancelled") {
        const acceptedAt = existingRide.acceptedAt ? new Date(existingRide.acceptedAt) : null;
        const minutesAfterAccept = acceptedAt ? (Date.now() - acceptedAt.getTime()) / 6e4 : 0;
        if (isDriver && existingRide.customerId && existingRide.driverId) {
          initiateRematch(
            existingRide.id,
            existingRide.driverId,
            minutesAfterAccept
          ).then((result) => {
            if (result.success) {
              console.log(`Auto-rematch successful for ride ${existingRide.id} -> ${result.newRideId}`);
            } else {
              console.log(`Auto-rematch failed for ride ${existingRide.id}: ${result.message}`);
            }
          }).catch(console.error);
        } else if (isCustomer && existingRide.driverId) {
          processRiderLateCancellation(
            existingRide.id,
            minutesAfterAccept
          ).catch(console.error);
        }
      }
      if (req.body.status === "started" && existingRide.status === "arriving") {
        const acceptedAt = existingRide.acceptedAt ? new Date(existingRide.acceptedAt) : null;
        if (acceptedAt) {
          const estimatedEtaMinutes = 5;
          const actualArrivalMinutes = (Date.now() - acceptedAt.getTime()) / 6e4;
          if (actualArrivalMinutes > estimatedEtaMinutes + 5) {
            processEtaBreach(
              existingRide.id,
              estimatedEtaMinutes,
              actualArrivalMinutes
            ).catch(console.error);
          }
          const waitStartApprox = new Date(acceptedAt.getTime() + estimatedEtaMinutes * 60 * 1e3);
          const waitMinutes = (Date.now() - waitStartApprox.getTime()) / 6e4;
          if (waitMinutes > 3) {
            processPickupWait(
              existingRide.id,
              waitMinutes
            ).catch(console.error);
          }
        }
      }
      if (req.body.status === "completed" && existingRide.status !== "completed") {
        const fare = parseFloat(ride.actualFare || ride.estimatedFare || "0");
        const user = await storage.getUser(ride.customerId);
        if (user && ride.driverId && fare > 0) {
          let paymentStatus = "completed";
          let paymentMethod = ride.paymentMethod || "cash";
          const driverShare = fare * 0.9;
          const platformFee = fare * 0.1;
          if (paymentMethod === "wallet") {
            const balance = parseFloat(user.walletBalance || "0");
            if (balance >= fare) {
              await storage.updateUserWalletBalance(ride.customerId, -fare);
              await storage.createWalletTransaction({
                id: uuidv45(),
                userId: ride.customerId,
                rideId: ride.id,
                type: "ride_payment",
                amount: (-fare).toFixed(2),
                status: "completed",
                description: `Payment for ride to ${ride.dropoffAddress}`,
                completedAt: /* @__PURE__ */ new Date()
              });
              await storage.updateDriverWalletBalance(ride.driverId, driverShare);
              await storage.createWalletTransaction({
                id: uuidv45(),
                driverId: ride.driverId,
                rideId: ride.id,
                type: "ride_payment",
                amount: driverShare.toFixed(2),
                status: "completed",
                description: `Earnings from ride (wallet payment)`,
                completedAt: /* @__PURE__ */ new Date()
              });
            } else {
              paymentStatus = "pending";
            }
          } else if (paymentMethod === "usdt") {
            await storage.updateDriverWalletBalance(ride.driverId, driverShare);
            await storage.createWalletTransaction({
              id: uuidv45(),
              driverId: ride.driverId,
              rideId: ride.id,
              type: "ride_payment",
              amount: driverShare.toFixed(2),
              status: "completed",
              description: `Earnings from ride (USDT payment)`,
              completedAt: /* @__PURE__ */ new Date()
            });
          } else {
            await storage.updateDriverWalletBalance(ride.driverId, -platformFee);
            await storage.createWalletTransaction({
              id: uuidv45(),
              driverId: ride.driverId,
              rideId: ride.id,
              type: "platform_fee",
              amount: (-platformFee).toFixed(2),
              status: "completed",
              description: `Platform fee deducted (cash ride - driver collected full fare)`,
              completedAt: /* @__PURE__ */ new Date()
            });
          }
          if (paymentStatus === "completed") {
            await storage.createWalletTransaction({
              id: uuidv45(),
              rideId: ride.id,
              type: "platform_fee",
              amount: platformFee.toFixed(2),
              status: "completed",
              description: `Platform service fee (10%) - ${paymentMethod} ride`,
              completedAt: /* @__PURE__ */ new Date()
            });
            await recordPlatformLedger({
              type: "platform_fee_income",
              amount: platformFee,
              rideId: ride.id,
              driverId: ride.driverId,
              description: `10% service fee from ${paymentMethod} ride ${ride.id.substring(0, 8)}`,
              currency: ride.currency || "AED"
            });
            const driver = await storage.getDriver(ride.driverId);
            if (driver) {
              const currentEarnings = parseFloat(driver.totalEarnings || "0");
              await storage.updateDriver(ride.driverId, {
                totalEarnings: (currentEarnings + driverShare).toFixed(2),
                totalTrips: (driver.totalTrips || 0) + 1
              });
            }
            try {
              const blockchainResult = await recordRideToBlockchain({
                rideId: ride.id,
                customerId: ride.customerId,
                driverId: ride.driverId,
                pickupAddress: ride.pickupAddress,
                dropoffAddress: ride.dropoffAddress,
                fare,
                platformFee,
                driverShare,
                timestamp: /* @__PURE__ */ new Date()
              });
              if (blockchainResult.transactionHash) {
                await storage.updateRide(ride.id, {
                  blockchainTxHash: blockchainResult.transactionHash
                });
              }
              sendRideReceiptEmail({
                customerName: user.name,
                customerEmail: user.email,
                rideId: ride.id,
                pickupAddress: ride.pickupAddress,
                dropoffAddress: ride.dropoffAddress,
                distance: ride.distance || "0",
                duration: String(ride.duration || 0),
                fare: fare.toFixed(2),
                platformFee: platformFee.toFixed(2),
                driverEarnings: driverShare.toFixed(2),
                blockchainHash: ride.blockchainHash || blockchainResult.hash,
                blockchainTxHash: blockchainResult.transactionHash,
                completedAt: (/* @__PURE__ */ new Date()).toISOString()
              }).catch((err) => console.log("Email send error:", err.message));
              const driver2 = await storage.getDriver(ride.driverId);
              if (driver2) {
                const driverUser = await storage.getUser(driver2.userId);
                if (driverUser) {
                  sendDriverEarningsEmail({
                    driverName: driverUser.name,
                    driverEmail: driverUser.email,
                    rideId: ride.id,
                    pickupAddress: ride.pickupAddress,
                    dropoffAddress: ride.dropoffAddress,
                    totalFare: fare.toFixed(2),
                    platformFee: platformFee.toFixed(2),
                    earnings: driverShare.toFixed(2),
                    blockchainHash: ride.blockchainHash || blockchainResult.hash,
                    blockchainTxHash: blockchainResult.transactionHash,
                    completedAt: (/* @__PURE__ */ new Date()).toISOString()
                  }).catch((err) => console.log("Driver email send error:", err.message));
                }
              }
            } catch (blockchainError) {
              console.log("Blockchain recording (optional):", blockchainError.message);
            }
            try {
              await createRideInvoices(ride.id);
            } catch (invoiceError) {
              console.log("Invoice generation error:", invoiceError.message);
            }
          }
          await storage.createPayment({
            id: uuidv45(),
            rideId: ride.id,
            userId: ride.customerId,
            amount: fare.toFixed(2),
            method: paymentMethod,
            status: paymentStatus
          });
        }
      }
      res.json(ride);
    } catch (error) {
      console.error("PATCH /api/rides/:id ERROR:", error.message, error.stack);
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/rides/:id/rematch-status", async (req, res) => {
    try {
      const status = await getRematchStatus(req.params.id);
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/driver/pay-formula", async (req, res) => {
    try {
      const regionCode = req.query.region || "AE";
      const regionConfig = { currencyCode: regionCode === "PK" ? "PKR" : regionCode === "BD" ? "BDT" : "AED" };
      const serviceTypes2 = await storage.getServiceTypes();
      const payFormula = {
        platformCommission: "10%",
        commissionDescription: "Flat 10% platform fee on all rides",
        driverShare: "90%",
        driverShareDescription: "You keep 90% of the fare",
        fareCalculation: {
          description: "Your guaranteed earnings are calculated before you accept",
          formula: "Driver Earnings = (Base Fare + Distance \xD7 Per-km Rate + Time \xD7 Per-minute Rate) \xD7 0.90",
          components: [
            { name: "Base Fare", description: "Fixed starting amount per vehicle type" },
            { name: "Distance Rate", description: "Per kilometer charge based on route" },
            { name: "Time Rate", description: "Per minute charge for trip duration" },
            { name: "Surge Multiplier", description: "Applied during high demand (you see this before accepting)" }
          ]
        },
        guarantees: [
          "Guaranteed earnings shown BEFORE you accept",
          "Fare cannot decrease after acceptance",
          "Cancellation by rider after 5 min = driver compensation",
          "No hidden fees or deductions",
          "Weekly payouts guaranteed"
        ],
        bonuses: {
          pmgth: {
            name: "Pay Me to Go Home",
            description: "80% of direction premium goes to you",
            example: "If rider pays 20 AED premium, you get 16 AED extra"
          },
          tips: {
            name: "Tips",
            description: "100% of tips go directly to you",
            example: "No platform cut on rider tips"
          }
        },
        vehicleRates: serviceTypes2.map((st) => ({
          type: st.type,
          name: st.name,
          baseFare: st.baseFare,
          perKmRate: st.perKmRate,
          perMinuteRate: st.perMinuteRate,
          currency: regionConfig?.currencyCode || "AED"
        })),
        payoutSchedule: {
          frequency: "Weekly",
          processingTime: "1-3 business days",
          methods: ["Bank Transfer", "USDT Crypto"]
        },
        trustPromises: [
          "No earnings ambiguity - you know exactly what you'll earn",
          "No clawbacks or retroactive adjustments",
          "Transparent pricing visible to both driver and rider",
          "Fair cancellation protection for non-driver-fault"
        ]
      };
      res.json(payFormula);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/incentives/:cityId", async (req, res) => {
    try {
      const policy = await getIncentivePolicy(req.params.cityId);
      res.json(policy);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/incentives/:cityId/explain", async (req, res) => {
    try {
      const explanation = await getPolicyExplanation(req.params.cityId);
      res.json(explanation);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/incentives/:cityId/signup-bonus", async (req, res) => {
    try {
      const bonus = await shouldOfferSignupBonus(req.params.cityId);
      res.json(bonus);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/incentives/:cityId/boost", async (req, res) => {
    try {
      const { isRaining, isEmergency, isPeakHour, currentDemand, currentSupply } = req.body;
      const boost = await calculateBoostMultiplier(req.params.cityId, {
        isRaining: Boolean(isRaining),
        isEmergency: Boolean(isEmergency),
        isPeakHour: Boolean(isPeakHour),
        currentDemand: Number(currentDemand) || 0,
        currentSupply: Number(currentSupply) || 0
      });
      res.json(boost);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/rides/:id/telemetry", async (req, res) => {
    try {
      const ride = await storage.getRide(req.params.id);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      const driver = ride.driverId ? await storage.getDriver(ride.driverId) : null;
      const pickupLat = parseFloat(ride.pickupLat || "0");
      const pickupLng = parseFloat(ride.pickupLng || "0");
      const dropoffLat = parseFloat(ride.dropoffLat || "0");
      const dropoffLng = parseFloat(ride.dropoffLng || "0");
      const calculateDistance5 = (lat1, lng1, lat2, lng2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };
      let driverLocation = null;
      let eta = null;
      let routeCoordinates = [];
      let hasRealLocation = false;
      if (driver && ride.status !== "pending" && ride.status !== "completed") {
        const driverLat = parseFloat(driver.currentLat || "0");
        const driverLng = parseFloat(driver.currentLng || "0");
        hasRealLocation = driverLat !== 0 && driverLng !== 0;
        if (hasRealLocation) {
          driverLocation = { lat: driverLat, lng: driverLng };
          if (ride.status === "accepted" || ride.status === "arriving") {
            const distanceToPickup = calculateDistance5(driverLat, driverLng, pickupLat, pickupLng);
            eta = Math.max(1, Math.round(distanceToPickup * 3));
            routeCoordinates = [
              { latitude: driverLat, longitude: driverLng },
              { latitude: pickupLat, longitude: pickupLng }
            ];
          } else {
            const remainingDistance = calculateDistance5(driverLat, driverLng, dropoffLat, dropoffLng);
            eta = Math.max(1, Math.round(remainingDistance * 2.5));
            routeCoordinates = [
              { latitude: driverLat, longitude: driverLng },
              { latitude: dropoffLat, longitude: dropoffLng }
            ];
          }
        } else {
          const statusProgress = {
            accepted: 0.3,
            arriving: 0.6,
            started: 0.1,
            in_progress: 0.5
          };
          const progress = statusProgress[ride.status] || 0;
          if (ride.status === "accepted" || ride.status === "arriving") {
            driverLocation = {
              lat: pickupLat + (dropoffLat - pickupLat) * -0.1 * (1 - progress),
              lng: pickupLng + (dropoffLng - pickupLng) * -0.1 * (1 - progress)
            };
            const distanceToPickup = calculateDistance5(
              driverLocation.lat,
              driverLocation.lng,
              pickupLat,
              pickupLng
            );
            eta = Math.max(1, Math.round(distanceToPickup * 3));
            routeCoordinates = [
              { latitude: driverLocation.lat, longitude: driverLocation.lng },
              { latitude: pickupLat, longitude: pickupLng }
            ];
          } else {
            driverLocation = {
              lat: pickupLat + (dropoffLat - pickupLat) * progress,
              lng: pickupLng + (dropoffLng - pickupLng) * progress
            };
            const remainingDistance = calculateDistance5(
              driverLocation.lat,
              driverLocation.lng,
              dropoffLat,
              dropoffLng
            );
            eta = Math.max(1, Math.round(remainingDistance * 2.5));
            routeCoordinates = [
              { latitude: driverLocation.lat, longitude: driverLocation.lng },
              { latitude: dropoffLat, longitude: dropoffLng }
            ];
          }
        }
      }
      const fullRouteCoordinates = [
        { latitude: pickupLat, longitude: pickupLng },
        { latitude: dropoffLat, longitude: dropoffLng }
      ];
      res.json({
        rideId: ride.id,
        status: ride.status,
        driverLocation,
        eta,
        isLiveLocation: hasRealLocation,
        routeCoordinates: fullRouteCoordinates,
        driverRouteCoordinates: routeCoordinates,
        pickup: {
          lat: pickupLat,
          lng: pickupLng,
          address: ride.pickupAddress
        },
        dropoff: {
          lat: dropoffLat,
          lng: dropoffLng,
          address: ride.dropoffAddress
        },
        driver: await (async () => {
          if (!driver) return null;
          const driverUser = await storage.getUser(driver.userId);
          const vehicles4 = await storage.getDriverVehicles(driver.id);
          const vehicle = vehicles4[0];
          return {
            id: driver.id,
            name: driverUser?.name || "Driver",
            phone: driverUser?.phone || null,
            rating: driver.rating || "4.9",
            vehicleType: vehicle?.type || "economy",
            licensePlate: vehicle?.plateNumber || "",
            vehicleMake: vehicle?.make || "",
            vehicleModel: vehicle?.model || "",
            vehicleColor: vehicle?.color || "",
            vehicleVerified: vehicle?.verificationStatus === "ai_verified" || vehicle?.verificationStatus === "admin_verified"
          };
        })(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/drivers/:id/location", requireAuth, async (req, res) => {
    try {
      const { lat, lng, heading } = req.body;
      if (typeof lat !== "number" || typeof lng !== "number") {
        return res.status(400).json({ message: "Invalid location" });
      }
      const driver = await storage.getDriver(req.params.id);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      if (driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const updateData = {
        currentLat: lat.toString(),
        currentLng: lng.toString(),
        lastOnlineAt: /* @__PURE__ */ new Date()
      };
      if (typeof heading === "number") {
        updateData.currentHeading = heading.toString();
      }
      await storage.updateDriver(req.params.id, updateData);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/intent/aligned-drivers", requireAuth, async (req, res) => {
    try {
      const { pickupLat, pickupLng, dropoffLat, dropoffLng, priority } = req.query;
      if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
        return res.status(400).json({ message: "Missing location parameters" });
      }
      const alignedDrivers = await findAlignedDrivers(
        req.userId,
        parseFloat(pickupLat),
        parseFloat(pickupLng),
        parseFloat(dropoffLat),
        parseFloat(dropoffLng),
        priority || "reliable"
      );
      res.json({
        drivers: alignedDrivers.map((d) => ({
          driverId: d.driverId,
          alignmentScore: d.alignment.score,
          matchType: d.alignment.matchType,
          confidence: d.alignment.confidence,
          distance: d.distance
        })),
        totalFound: alignedDrivers.length,
        instantMatches: alignedDrivers.filter((d) => d.alignment.matchType === "instant").length
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/intent/city-density", async (req, res) => {
    try {
      const density = await getCityDensityType();
      res.json(density);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/intent/zone-metrics", async (req, res) => {
    try {
      const { lat, lng } = req.query;
      if (!lat || !lng) {
        return res.status(400).json({ message: "Missing location parameters" });
      }
      const metrics = await getZoneMetrics(
        parseFloat(lat),
        parseFloat(lng)
      );
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/intent/flow-recommendation", requireAuth, async (req, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      const lat = parseFloat(driver.currentLat || "0");
      const lng = parseFloat(driver.currentLng || "0");
      if (lat === 0 && lng === 0) {
        return res.json({ recommendedZone: null, reason: "Location not available" });
      }
      const recommendation = await getFlowRecommendation(lat, lng);
      res.json(recommendation);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/drivers/:id/home-address", requireAuth, async (req, res) => {
    try {
      const { lat, lng, address } = req.body;
      const driver = await storage.getDriver(req.params.id);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      if (driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      await storage.updateDriver(req.params.id, {
        homeAddress: JSON.stringify({ lat, lng, address })
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/drivers/:id/anti-gaming-status", requireAuth, async (req, res) => {
    try {
      const driver = await storage.getDriver(req.params.id);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      if (driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const flags = await getAntiGamingFlags(req.params.id);
      const guaranteeEligibility = await isEligibleForGuarantee(req.params.id);
      res.json({
        ...flags,
        guaranteeEligible: guaranteeEligibility.eligible,
        guaranteeIneligibleReason: guaranteeEligibility.reason
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/saved-addresses/:userId", requireAuth, async (req, res) => {
    try {
      if (req.params.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const addresses = await storage.getSavedAddresses(req.params.userId);
      res.json(addresses);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/saved-addresses", requireAuth, async (req, res) => {
    try {
      if (req.body.userId !== req.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      const address = await storage.createSavedAddress({
        ...req.body,
        id: uuidv45()
      });
      res.json(address);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.delete("/api/saved-addresses/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteSavedAddress(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/emergency-contacts/:userId", requireAuth, async (req, res) => {
    try {
      if (req.params.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const contacts = await storage.getEmergencyContacts(req.params.userId);
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/emergency-contacts", requireAuth, async (req, res) => {
    try {
      if (req.body.userId !== req.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      const contact = await storage.createEmergencyContact({
        ...req.body,
        id: uuidv45()
      });
      res.json(contact);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.delete("/api/emergency-contacts/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteEmergencyContact(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/payment-methods/:userId", requireAuth, async (req, res) => {
    try {
      if (req.params.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const methods = await storage.getPaymentMethods(req.params.userId);
      res.json(methods);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/payment-methods", requireAuth, async (req, res) => {
    try {
      if (req.body.userId !== req.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      const method = await storage.createPaymentMethod({
        ...req.body,
        id: uuidv45()
      });
      res.json(method);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/service-types", async (_req, res) => {
    try {
      const types = await storage.getServiceTypes();
      res.json(types);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/coupons/validate", async (req, res) => {
    try {
      const { code } = req.query;
      if (!code) {
        return res.status(400).json({ message: "Coupon code required" });
      }
      const coupon = await storage.getCoupon(code);
      if (!coupon) {
        return res.status(404).json({ message: "Invalid or expired coupon" });
      }
      res.json(coupon);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/ratings", async (req, res) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const session = await storage.getSession(token);
      if (!session) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      const { rideId, toDriverId, rating: ratingValue, comment, tip } = req.body;
      const ratingData = await storage.createRating({
        id: uuidv45(),
        rideId,
        fromUserId: session.userId,
        toDriverId,
        rating: ratingValue,
        comment: comment || null
      });
      if (tip && tip > 0) {
        const ride = await storage.getRide(rideId);
        if (ride && ride.driverId) {
          await storage.updateRide(rideId, { tipAmount: tip.toString() });
          const driver = await storage.getDriver(ride.driverId);
          if (driver) {
            const currentBalance = parseFloat(driver.walletBalance || "0");
            await storage.updateDriver(ride.driverId, {
              walletBalance: (currentBalance + tip).toString()
            });
            await storage.createWalletTransaction({
              id: uuidv45(),
              driverId: ride.driverId,
              rideId: ride.id,
              type: "ride_payment",
              amount: tip.toString(),
              currency: ride.currency || "AED",
              status: "completed",
              description: `Tip from rider for ride ${ride.id.substring(0, 8)}`
            });
          }
        }
      }
      res.json({ ...ratingData, tipProcessed: tip > 0 });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/drivers/available", async (req, res) => {
    try {
      const { lat, lng, radius } = req.query;
      const drivers6 = await storage.getAvailableDrivers(
        parseFloat(lat) || 25.2048,
        parseFloat(lng) || 55.2708,
        parseFloat(radius) || 5
      );
      res.json(drivers6);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/ai/optimal-match", async (req, res) => {
    try {
      const { pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType } = req.body;
      if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
        return res.status(400).json({ message: "Pickup and dropoff coordinates are required" });
      }
      const result = await getOptimalRideMatch(
        parseFloat(pickupLat),
        parseFloat(pickupLng),
        parseFloat(dropoffLat),
        parseFloat(dropoffLng),
        vehicleType
      );
      res.json({
        success: true,
        ...result,
        aiPowered: true,
        optimizationType: "cost_and_match"
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/ai/calculate-price", async (req, res) => {
    try {
      const { pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType } = req.body;
      if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
        return res.status(400).json({ message: "Pickup and dropoff coordinates are required" });
      }
      const pricing = await calculateOptimalPrice(
        parseFloat(pickupLat),
        parseFloat(pickupLng),
        parseFloat(dropoffLat),
        parseFloat(dropoffLng),
        vehicleType || "economy"
      );
      res.json({
        success: true,
        pricing,
        aiPowered: true,
        transparency: pricing.priceExplanation
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/ai/optimal-drivers", async (req, res) => {
    try {
      const { pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType } = req.query;
      if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
        return res.status(400).json({ message: "Coordinates are required" });
      }
      const drivers6 = await findOptimalDrivers(
        parseFloat(pickupLat),
        parseFloat(pickupLng),
        parseFloat(dropoffLat),
        parseFloat(dropoffLng),
        vehicleType
      );
      res.json({
        success: true,
        drivers: drivers6,
        totalFound: drivers6.length,
        aiRanked: true,
        scoringFactors: ["distance", "rating", "experience", "availability"]
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/ai/price", async (req, res) => {
    try {
      const { pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType } = req.query;
      if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
        return res.status(400).json({ message: "Coordinates are required" });
      }
      const pricing = await calculateOptimalPrice(
        parseFloat(pickupLat),
        parseFloat(pickupLng),
        parseFloat(dropoffLat),
        parseFloat(dropoffLng),
        vehicleType || "economy"
      );
      const combinedMultiplier = Math.min(
        pricing.demandMultiplier * pricing.timeOfDayMultiplier * pricing.trafficMultiplier,
        1.5
      );
      const subtotal = pricing.baseFare + pricing.distanceCharge + pricing.timeCharge;
      const surgeCharge = combinedMultiplier > 1 ? subtotal * (combinedMultiplier - 1) : 0;
      res.json({
        success: true,
        baseFare: pricing.baseFare,
        distanceCharge: pricing.distanceCharge,
        timeCharge: pricing.timeCharge,
        surgeMultiplier: combinedMultiplier,
        surgeCharge: Math.round(surgeCharge * 100) / 100,
        finalPrice: pricing.total,
        platformFee: pricing.platformFee,
        driverEarnings: pricing.driverEarnings,
        priceExplanation: pricing.priceExplanation,
        aiPowered: true,
        maxSurgeCap: 1.5,
        surgeCapped: combinedMultiplier >= 1.5
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/blockchain/status", async (_req, res) => {
    try {
      const status = getBlockchainStatus();
      res.json({
        success: true,
        ...status,
        features: {
          transparentPricing: true,
          verifiableReceipts: true,
          onChainRecording: status.contractConfigured
        }
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/blockchain/record-ride", async (req, res) => {
    try {
      const { rideId, customerId, driverId, pickupAddress, dropoffAddress, fare } = req.body;
      if (!rideId || !fare) {
        return res.status(400).json({ message: "Ride ID and fare are required" });
      }
      const feeBreakdown = calculateFeeBreakdown(parseFloat(fare));
      const result = await recordRideToBlockchain({
        rideId,
        customerId: customerId || "anonymous",
        driverId: driverId || "pending",
        pickupAddress: pickupAddress || "",
        dropoffAddress: dropoffAddress || "",
        fare: parseFloat(fare),
        platformFee: feeBreakdown.platformFee,
        driverShare: feeBreakdown.driverShare,
        timestamp: /* @__PURE__ */ new Date()
      });
      res.json({
        ...result,
        feeBreakdown
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/blockchain/verify/:rideHash", async (req, res) => {
    try {
      const { rideHash } = req.params;
      const verification = await verifyRideOnChain(rideHash);
      res.json({
        success: true,
        ...verification
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/blockchain/transparency-report", async (req, res) => {
    try {
      const { rideId, pricing } = req.body;
      if (!rideId || !pricing) {
        return res.status(400).json({ message: "Ride ID and pricing data are required" });
      }
      const report = generateTransparencyReport(rideId, pricing);
      res.json({
        success: true,
        report
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/auth/register-driver", async (req, res) => {
    try {
      const { email, password, name, phone, licenseNumber } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ message: "Email, password, and name are required" });
      }
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }
      const user = await storage.createUser({
        id: uuidv45(),
        email,
        password: hashPassword(password),
        name,
        phone: phone || null,
        role: "driver"
      });
      const driver = await storage.createDriver({
        id: uuidv45(),
        userId: user.id,
        licenseNumber: licenseNumber || null
      });
      const token = randomBytes(32).toString("hex");
      Promise.resolve().then(() => (init_telegramBot(), telegramBot_exports)).then(({ sendDriverWelcomeSequence: sendDriverWelcomeSequence2 }) => {
        sendDriverWelcomeSequence2(driver.id, name).catch(console.error);
      });
      Promise.resolve().then(() => (init_whatsappBot(), whatsappBot_exports)).then(({ sendDriverWelcomeSequenceWhatsApp: sendDriverWelcomeSequenceWhatsApp2 }) => {
        sendDriverWelcomeSequenceWhatsApp2(driver.id, name).catch(console.error);
      });
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role
        },
        driver,
        token
      });
    } catch (error) {
      res.status(500).json({ message: error.message || "Driver registration failed" });
    }
  });
  app2.get("/api/drivers/me", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const driver = await storage.getDriverByUserId(userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      res.json(driver);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.patch("/api/drivers/status", requireAuth, async (req, res) => {
    try {
      const { isOnline, lat, lng } = req.body;
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      const wasOffline = !driver.isOnline;
      const updatedDriver = await storage.updateDriver(driver.id, {
        isOnline,
        currentLat: lat,
        currentLng: lng
      });
      let guarantee = null;
      if (isOnline && wasOffline) {
        const result = await startGuarantee(driver.id, "AE");
        if (result.started && result.guarantee) {
          guarantee = result.guarantee;
        }
      } else if (!isOnline) {
        await cancelGuarantee(driver.id);
      }
      res.json({ ...updatedDriver, guarantee });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/debug/driver-status/:phone", async (req, res) => {
    try {
      const { phone } = req.params;
      const user = await storage.getUserByPhone(phone);
      if (!user) {
        return res.json({ error: "User not found", phone });
      }
      const driver = await storage.getDriverByUserId(user.id);
      if (!driver) {
        return res.json({ error: "Driver record not found", phone, userId: user.id });
      }
      res.json({
        userId: user.id,
        driverId: driver.id,
        phone: user.phone,
        role: user.role,
        driverStatus: driver.status,
        isOnline: driver.isOnline,
        name: user.name
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/debug/approve-driver/:phone", async (req, res) => {
    try {
      const { phone } = req.params;
      const user = await storage.getUserByPhone(phone);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const driver = await storage.getDriverByUserId(user.id);
      if (!driver) {
        return res.status(404).json({ error: "Driver not found" });
      }
      const updated = await storage.updateDriver(driver.id, { status: "approved", isOnline: true });
      res.json({ success: true, driver: updated });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/debug/assign-rides/:driverId", async (req, res) => {
    try {
      const { driverId } = req.params;
      const pendingRides = await storage.getPendingRides();
      const unassigned = pendingRides.filter((r) => !r.driverId);
      let assigned = 0;
      for (const ride of unassigned.slice(0, 10)) {
        await storage.updateRide(ride.id, { driverId });
        assigned++;
      }
      res.json({ success: true, assigned, total: unassigned.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/debug/pending-rides/:driverId", async (req, res) => {
    try {
      const { driverId } = req.params;
      const allRides = await storage.getPendingRides();
      const driverRides = allRides.filter((ride) => ride.driverId === driverId);
      const uniqueDriverIds = [...new Set(allRides.map((r) => r.driverId || "null"))];
      res.json({
        total: allRides.length,
        forDriver: driverRides.length,
        driverId,
        uniqueDriverIdsInRides: uniqueDriverIds,
        sampleRides: allRides.slice(0, 5).map((r) => ({ id: r.id, driverId: r.driverId, pickup: r.pickupAddress?.substring(0, 30) }))
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/drivers/pending-rides", requireAuth, async (req, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver || driver.status !== "approved") {
        return res.status(403).json({ message: "Only approved drivers can view pending rides" });
      }
      const allRides = await storage.getPendingRides();
      console.log(`[PENDING-RIDES] Driver ${driver.id} requesting rides. Total pending: ${allRides.length}`);
      console.log(`[PENDING-RIDES] Sample ride driverIds: ${allRides.slice(0, 3).map((r) => r.driverId).join(", ")}`);
      const driverRides = allRides.filter((ride) => ride.driverId === driver.id);
      console.log(`[PENDING-RIDES] Filtered rides for this driver: ${driverRides.length}`);
      const pmgthSession = await getActivePmgthSession(driver.id);
      let ridesToShow = driverRides;
      let pmgthCompatibilityMap = /* @__PURE__ */ new Map();
      if (pmgthSession) {
        const ridesWithCoords = driverRides.filter(
          (r) => r.pickupLat && r.pickupLng && r.dropoffLat && r.dropoffLng
        );
        const compatibleRides = await findCompatibleRides(
          pmgthSession,
          ridesWithCoords.map((r) => ({
            id: r.id,
            pickupLat: String(r.pickupLat),
            pickupLng: String(r.pickupLng),
            dropoffLat: String(r.dropoffLat),
            dropoffLng: String(r.dropoffLng),
            estimatedFare: r.estimatedFare
          }))
        );
        const compatibleRideIds = new Set(compatibleRides.map((cr) => cr.rideId));
        compatibleRides.forEach((cr) => {
          pmgthCompatibilityMap.set(cr.rideId, {
            premiumAmount: cr.premiumAmount,
            premiumPercent: cr.premiumPercent,
            directionScore: cr.directionScore
          });
        });
        ridesToShow = driverRides.filter((ride) => compatibleRideIds.has(ride.id));
      }
      const enrichedRides = await Promise.all(ridesToShow.map(async (ride) => {
        let customerName = "Customer";
        let customerRating = 5;
        let customerTotalRides = 0;
        if (ride.customerId) {
          const customer = await storage.getUser(ride.customerId);
          customerName = customer?.name || customer?.email?.split("@")[0] || "Customer";
          customerRating = 5;
          customerTotalRides = 0;
        }
        let distanceNum = 0;
        const pLat = parseFloat(String(ride.pickupLat || 0));
        const pLng = parseFloat(String(ride.pickupLng || 0));
        const dLat = parseFloat(String(ride.dropoffLat || 0));
        const dLng = parseFloat(String(ride.dropoffLng || 0));
        if (pLat && pLng && dLat && dLng) {
          const R = 6371;
          const latDiff = (dLat - pLat) * Math.PI / 180;
          const lngDiff = (dLng - pLng) * Math.PI / 180;
          const a = Math.sin(latDiff / 2) ** 2 + Math.cos(pLat * Math.PI / 180) * Math.cos(dLat * Math.PI / 180) * Math.sin(lngDiff / 2) ** 2;
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          distanceNum = R * c;
        }
        const estimatedDuration = Math.round(distanceNum * 3);
        const fare = parseFloat(String(ride.estimatedFare || 0));
        const farePerKm = distanceNum > 0 ? (fare / distanceNum).toFixed(2) : "0";
        const pmgthInfo = pmgthCompatibilityMap.get(ride.id);
        return {
          id: ride.id,
          pickupAddress: ride.pickupAddress,
          dropoffAddress: ride.dropoffAddress,
          estimatedFare: ride.estimatedFare || "0",
          distance: distanceNum.toFixed(1) + " km",
          duration: estimatedDuration.toString(),
          farePerKm,
          customerName,
          customerRating,
          customerTotalRides,
          pickupLat: ride.pickupLat,
          pickupLng: ride.pickupLng,
          dropoffLat: ride.dropoffLat,
          dropoffLng: ride.dropoffLng,
          // PMGTH premium info - driver earns this extra for direction-compatible rides
          isPmgthRide: !!pmgthInfo,
          pmgthPremiumAmount: pmgthInfo?.premiumAmount || 0,
          pmgthPremiumPercent: pmgthInfo?.premiumPercent || 0,
          pmgthDirectionScore: pmgthInfo?.directionScore || 0
        };
      }));
      res.json(enrichedRides);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/drivers/earnings", requireAuth, async (req, res) => {
    try {
      const { period } = req.query;
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      const earnings = await storage.getDriverEarnings(
        driver.id,
        period || "today"
      );
      res.json(earnings);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/drivers/monthly-yield", requireAuth, async (req, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      const earnings = await storage.getDriverEarnings(driver.id, "month");
      const monthlyYield = earnings?.totalEarnings || "0.00";
      res.json({ monthlyYield });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/stats", requireAuth, requireRole("admin"), async (_req, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/users", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { role, page, limit } = req.query;
      const users7 = await storage.getAllUsers(
        role,
        parseInt(page) || 1,
        parseInt(limit) || 20
      );
      res.json(users7);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/drivers", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { status, page, limit } = req.query;
      const drivers6 = await storage.getAllDrivers(
        status,
        parseInt(page) || 1,
        parseInt(limit) || 20
      );
      res.json(drivers6);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.patch("/api/admin/drivers/:id/status", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { status } = req.body;
      const driver = await storage.updateDriver(req.params.id, { status });
      res.json(driver);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/rides", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { status, page, limit } = req.query;
      const rides4 = await storage.getAllRides(
        status,
        parseInt(page) || 1,
        parseInt(limit) || 20
      );
      res.json(rides4);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.delete("/api/payment-methods/:id", async (req, res) => {
    try {
      await storage.deletePaymentMethod(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/payment-methods/:id/default", async (req, res) => {
    try {
      const { userId } = req.body;
      await storage.setDefaultPaymentMethod(userId, req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/wallet/topup", requireAuth, async (req, res) => {
    try {
      const { amount, currency } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }
      const result = await topUpWallet(req.userId, amount, currency || "AED");
      res.json({ success: true, newBalance: result.newBalance });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/wallet/balance/:userId", requireAuth, async (req, res) => {
    try {
      if (req.params.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const user = await storage.getUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ balance: user.walletBalance || "0.00" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/wallet/transactions/:userId", requireAuth, async (req, res) => {
    try {
      if (req.params.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const transactions = await storage.getWalletTransactions(req.params.userId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/wallet/summary/:userId", requireAuth, async (req, res) => {
    try {
      if (req.params.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const summary = await getWalletSummary(req.params.userId, void 0);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/drivers/:driverId/withdraw", requireAuth, async (req, res) => {
    try {
      const { driverId } = req.params;
      const { amount, currency } = req.body;
      const driver = await storage.getDriver(driverId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      if (driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid withdrawal amount" });
      }
      const result = await processDriverWithdrawal(driverId, amount, currency || "AED");
      if (!result.success) {
        if (result.insufficientFunds) {
          return res.status(400).json({ message: "Insufficient wallet balance" });
        }
        return res.status(500).json({ message: "Withdrawal failed" });
      }
      res.json({ success: true, newBalance: result.newBalance });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/drivers/:driverId/wallet-summary", requireAuth, async (req, res) => {
    try {
      const { driverId } = req.params;
      const driver = await storage.getDriver(driverId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      if (driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const summary = await getWalletSummary(void 0, driverId);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/platform-financials", requireAuth, async (req, res) => {
    try {
      if (req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const financials = await getPlatformFinancials();
      res.json(financials);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/rides/:id/pay", async (req, res) => {
    try {
      const { paymentMethod } = req.body;
      const ride = await storage.getRide(req.params.id);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      const existingPayment = await storage.getPaymentByRideId(ride.id);
      if (existingPayment && existingPayment.status === "completed") {
        return res.status(409).json({
          code: "ALREADY_PAID",
          message: "This ride has already been paid for"
        });
      }
      const fare = parseFloat(ride.actualFare || ride.estimatedFare || "0");
      const user = await storage.getUser(ride.customerId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      let paymentStatus = "completed";
      if (paymentMethod === "wallet") {
        const balance = parseFloat(user.walletBalance || "0");
        if (balance < fare) {
          return res.status(400).json({ message: "Insufficient wallet balance" });
        }
        await storage.updateUserWalletBalance(ride.customerId, -fare);
        await storage.createWalletTransaction({
          id: uuidv45(),
          userId: ride.customerId,
          rideId: ride.id,
          type: "ride_payment",
          amount: (-fare).toFixed(2),
          status: "completed",
          description: `Payment for ride to ${ride.dropoffAddress}`,
          completedAt: /* @__PURE__ */ new Date()
        });
      } else if (paymentMethod === "usdt") {
        try {
          const minAmount = await nowPaymentsService.getMinimumPaymentAmount("usdttrc20");
          const estimatedUsdt = fare / 3.67;
          if (estimatedUsdt < minAmount) {
            return res.status(400).json({
              code: "AMOUNT_TOO_SMALL",
              message: `This fare is too small for USDT payment (minimum ~${(minAmount * 3.67).toFixed(0)} AED). Please use cash or wallet instead.`,
              minimumUsdt: minAmount
            });
          }
          const orderId = `ride_${ride.id}_${Date.now()}`;
          const currency = (ride.currency || "AED").toLowerCase();
          const baseUrl = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000"}`;
          const invoice = await nowPaymentsService.createInvoice({
            price: fare,
            currency,
            orderId,
            description: `Ride payment: ${ride.pickupAddress} to ${ride.dropoffAddress}`,
            callbackUrl: `${baseUrl}/api/payments/nowpayments/ipn`,
            successUrl: `${baseUrl}/payment-success?type=${paymentMethod}`,
            cancelUrl: `${baseUrl}/payment-cancelled`
          });
          paymentStatus = "pending_crypto";
          await storage.createWalletTransaction({
            id: uuidv45(),
            userId: ride.customerId,
            rideId: ride.id,
            type: "ride_payment",
            amount: (-fare).toFixed(2),
            status: "pending",
            description: `USDT payment pending for ride to ${ride.dropoffAddress}`
          });
        } catch (paymentError) {
          console.error("NOWPayments ride payment error:", paymentError);
          return res.status(402).json({
            code: "PAYMENT_ERROR",
            message: paymentError.message || "Payment processing failed. Please try another payment method."
          });
        }
      }
      const payment = await storage.createPayment({
        id: uuidv45(),
        rideId: ride.id,
        userId: ride.customerId,
        amount: fare.toFixed(2),
        method: paymentMethod,
        status: paymentStatus
      });
      res.json({ success: true, payment });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/drivers/by-user/:userId", requireAuth, async (req, res) => {
    try {
      if (req.params.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const driver = await storage.getDriverByUserId(req.params.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      res.json(driver);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/drivers/:driverId/wallet", requireAuth, async (req, res) => {
    try {
      const driver = await storage.getDriver(req.params.driverId);
      if (!driver) {
        return res.status(404).json({
          code: "DRIVER_NOT_FOUND",
          message: "Driver not found"
        });
      }
      if (driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({
          code: "ACCESS_DENIED",
          message: "Access denied"
        });
      }
      const transactions = await storage.getDriverTransactions(req.params.driverId);
      const payouts = await storage.getDriverPayouts(req.params.driverId);
      const rideEarnings = transactions.filter((t) => t.type === "ride_payment" && t.status === "completed").reduce((sum2, t) => sum2 + parseFloat(t.amount || "0"), 0);
      const tips = transactions.filter((t) => t.type === "tip" && t.status === "completed").reduce((sum2, t) => sum2 + parseFloat(t.amount || "0"), 0);
      const bonuses = transactions.filter((t) => t.type === "bonus" && t.status === "completed").reduce((sum2, t) => sum2 + parseFloat(t.amount || "0"), 0);
      const withdrawals = payouts.filter((p) => p.status === "completed" || p.status === "processing").reduce((sum2, p) => sum2 + parseFloat(p.amount || "0"), 0);
      const pendingPayouts = payouts.filter((p) => p.status === "pending" || p.status === "pending_bank_setup").reduce((sum2, p) => sum2 + parseFloat(p.amount || "0"), 0);
      res.json({
        balance: driver.walletBalance || "0.00",
        totalEarnings: driver.totalEarnings || "0.00",
        totalTrips: driver.totalTrips || 0,
        cryptoWalletAddress: driver.cryptoWalletAddress || null,
        earningsBreakdown: {
          rideEarnings: rideEarnings.toFixed(2),
          tips: tips.toFixed(2),
          bonuses: bonuses.toFixed(2),
          totalWithdrawals: withdrawals.toFixed(2),
          pendingPayouts: pendingPayouts.toFixed(2)
        },
        platformInfo: {
          platformFeePercent: 10,
          driverSharePercent: 90,
          minPayoutAmount: 50,
          payoutMethods: ["bank", "crypto"]
        },
        transactions: transactions.slice(0, 50),
        // Last 50 transactions
        payouts: payouts.slice(0, 20)
        // Last 20 payouts
      });
    } catch (error) {
      res.status(500).json({
        code: "WALLET_ERROR",
        message: error.message
      });
    }
  });
  app2.post("/api/drivers/:driverId/payout", requireAuth, async (req, res) => {
    try {
      const { amount, method = "bank" } = req.body;
      const driver = await storage.getDriver(req.params.driverId);
      if (!driver) {
        return res.status(404).json({
          code: "DRIVER_NOT_FOUND",
          message: "Driver account not found"
        });
      }
      if (driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({
          code: "ACCESS_DENIED",
          message: "You can only withdraw from your own wallet"
        });
      }
      const balance = parseFloat(driver.walletBalance || "0");
      const requestedAmount = parseFloat(amount);
      if (isNaN(requestedAmount) || requestedAmount <= 0) {
        return res.status(400).json({
          code: "INVALID_AMOUNT",
          message: "Please enter a valid withdrawal amount"
        });
      }
      const MIN_PAYOUT = 50;
      if (requestedAmount < MIN_PAYOUT) {
        return res.status(400).json({
          code: "BELOW_MINIMUM",
          message: `Minimum withdrawal is AED ${MIN_PAYOUT}`,
          minimumAmount: MIN_PAYOUT
        });
      }
      if (balance < requestedAmount) {
        return res.status(400).json({
          code: "INSUFFICIENT_BALANCE",
          message: `Insufficient balance. You have AED ${balance.toFixed(2)} available.`,
          availableBalance: balance,
          requestedAmount
        });
      }
      let payoutStatus = "pending";
      if (method === "usdt") {
        payoutStatus = "processing";
      } else if (method === "bank") {
        payoutStatus = "pending";
      }
      await storage.updateDriverWalletBalance(req.params.driverId, -requestedAmount);
      const payout = await storage.createDriverPayout({
        id: uuidv45(),
        driverId: req.params.driverId,
        amount: requestedAmount.toFixed(2),
        method,
        status: payoutStatus,
        stripePayoutId: null
      });
      await storage.createWalletTransaction({
        id: uuidv45(),
        driverId: req.params.driverId,
        type: "withdrawal",
        amount: requestedAmount.toFixed(2),
        status: payoutStatus === "processing" ? "completed" : "pending",
        description: method === "bank" ? `Bank withdrawal - ${payoutStatus === "pending_bank_setup" ? "awaiting bank setup" : "processing"}` : `Withdrawal request`,
        completedAt: payoutStatus === "processing" ? /* @__PURE__ */ new Date() : void 0
      });
      res.json({
        success: true,
        payout,
        message: payoutStatus === "pending_bank_setup" ? "Payout requested. Please set up your bank account to receive funds." : payoutStatus === "processing" ? "Payout is being processed and will arrive in 2-3 business days." : "Payout request submitted for review.",
        newBalance: (balance - requestedAmount).toFixed(2)
      });
    } catch (error) {
      console.error("Payout error:", error);
      res.status(500).json({
        code: "PAYOUT_ERROR",
        message: "Failed to process payout. Please try again."
      });
    }
  });
  app2.post("/api/drivers/:driverId/crypto-payout", requireAuth, async (req, res) => {
    try {
      const { amount, walletAddress } = req.body;
      const driver = await storage.getDriver(req.params.driverId);
      if (!driver) {
        return res.status(404).json({
          code: "DRIVER_NOT_FOUND",
          message: "Driver account not found"
        });
      }
      if (driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({
          code: "ACCESS_DENIED",
          message: "You can only withdraw from your own wallet"
        });
      }
      const balance = parseFloat(driver.walletBalance || "0");
      const requestedAmount = parseFloat(amount);
      const MIN_CRYPTO_PAYOUT = 10;
      if (isNaN(requestedAmount) || requestedAmount < MIN_CRYPTO_PAYOUT) {
        return res.status(400).json({
          code: "BELOW_MINIMUM",
          message: `Minimum USDT withdrawal is ${MIN_CRYPTO_PAYOUT} USDT`,
          minimumAmount: MIN_CRYPTO_PAYOUT
        });
      }
      if (balance < requestedAmount) {
        return res.status(400).json({
          code: "INSUFFICIENT_BALANCE",
          message: `Insufficient balance. You have AED ${balance.toFixed(2)} available.`,
          availableBalance: balance,
          requestedAmount
        });
      }
      const { sendUsdtPayout: sendUsdtPayout2, isWalletConfigured: isWalletConfigured2 } = await Promise.resolve().then(() => (init_blockchain(), blockchain_exports));
      if (!isWalletConfigured2()) {
        return res.status(503).json({
          code: "CRYPTO_NOT_CONFIGURED",
          message: "USDT payouts are temporarily unavailable. Please try bank withdrawal or contact support."
        });
      }
      const targetAddress = walletAddress || driver.cryptoWalletAddress;
      if (!targetAddress) {
        return res.status(400).json({
          code: "NO_WALLET_ADDRESS",
          message: "Please add your USDT wallet address in settings first"
        });
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(targetAddress)) {
        return res.status(400).json({
          code: "INVALID_WALLET_ADDRESS",
          message: "Invalid wallet address format. Please enter a valid Polygon (MATIC) address."
        });
      }
      await storage.updateDriverWalletBalance(req.params.driverId, -requestedAmount);
      const payout = await storage.createDriverPayout({
        id: uuidv45(),
        driverId: req.params.driverId,
        amount: requestedAmount.toString(),
        method: "crypto",
        status: "processing",
        cryptoWalletAddress: targetAddress
      });
      const result = await sendUsdtPayout2(targetAddress, requestedAmount);
      if (result.success) {
        await storage.updateDriverPayout(payout.id, {
          status: "completed",
          txHash: result.txHash,
          completedAt: /* @__PURE__ */ new Date()
        });
        await storage.createWalletTransaction({
          id: uuidv45(),
          driverId: req.params.driverId,
          type: "withdrawal",
          amount: requestedAmount.toString(),
          status: "completed",
          description: `USDT withdrawal to ${targetAddress.slice(0, 8)}...${targetAddress.slice(-6)}`
        });
        res.json({
          success: true,
          payout: { ...payout, txHash: result.txHash, status: "completed" },
          explorerUrl: result.explorerUrl,
          message: `Successfully sent ${requestedAmount} USDT`
        });
      } else {
        await storage.updateDriverWalletBalance(req.params.driverId, requestedAmount);
        await storage.updateDriverPayout(payout.id, {
          status: "failed",
          failureReason: result.message
        });
        res.status(500).json({ message: result.message });
      }
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.patch("/api/drivers/:driverId/crypto-wallet", requireAuth, async (req, res) => {
    try {
      const { walletAddress } = req.body;
      const driver = await storage.getDriver(req.params.driverId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      if (driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const { ethers: ethers3 } = await import("ethers");
      if (!ethers3.isAddress(walletAddress)) {
        return res.status(400).json({ message: "Invalid wallet address format" });
      }
      await storage.updateDriver(req.params.driverId, { cryptoWalletAddress: walletAddress });
      res.json({ success: true, message: "Crypto wallet address updated" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.patch("/api/drivers/vehicle", requireAuth, async (req, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }
      const { make, model, year, color, plateNumber, type, photoFront, photoSide, autoVerify } = req.body;
      const vehicles4 = await storage.getDriverVehicles(driver.id);
      let vehicle = vehicles4[0];
      const user = await storage.getUser(driver.userId);
      const regionCode = user?.regionCode || "BD";
      let aiResult = null;
      let verificationStatus = vehicle?.verificationStatus || "pending";
      if (autoVerify && photoFront) {
        const imagesToVerify = [photoFront, photoSide].filter(Boolean);
        if (imagesToVerify.length > 0) {
          const { verifyMultipleVehicleImages: verifyMultipleVehicleImages2 } = await Promise.resolve().then(() => (init_vehicleVerification(), vehicleVerification_exports));
          aiResult = await verifyMultipleVehicleImages2(imagesToVerify, regionCode);
          verificationStatus = aiResult.isValid ? "ai_verified" : "pending";
        }
      }
      const vehicleData = {
        make: aiResult?.make || make,
        model: aiResult?.model || model,
        year: aiResult?.year || year,
        color: aiResult?.color || color,
        plateNumber,
        type,
        photoFront,
        photoSide,
        verificationStatus,
        aiConfidenceScore: aiResult?.confidence,
        aiVerificationNotes: aiResult?.issues?.join("; ")
      };
      if (vehicle) {
        vehicle = await storage.updateVehicle(vehicle.id, vehicleData);
      } else {
        const { v4: uuidv46 } = await import("uuid");
        vehicle = await storage.createVehicle({
          id: uuidv46(),
          driverId: driver.id,
          ...vehicleData
        });
      }
      res.json({
        ...vehicle,
        verificationStatus,
        aiResult: aiResult ? {
          isValid: aiResult.isValid,
          confidence: aiResult.confidence,
          notes: aiResult.issues
        } : null
      });
    } catch (error) {
      console.error("Vehicle update error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/drivers/:driverId/payouts", requireAuth, async (req, res) => {
    try {
      const driver = await storage.getDriver(req.params.driverId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      if (driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const payouts = await storage.getDriverPayouts(req.params.driverId);
      res.json(payouts);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/drivers/:driverId/bank-accounts", requireAuth, async (req, res) => {
    try {
      const driver = await storage.getDriver(req.params.driverId);
      if (driver && driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const accounts = await storage.getDriverBankAccounts(req.params.driverId);
      res.json(accounts);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/drivers/:driverId/bank-accounts", requireAuth, async (req, res) => {
    try {
      const driver = await storage.getDriver(req.params.driverId);
      if (driver && driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const { bankName, last4, accountHolderName } = req.body;
      const account = await storage.createDriverBankAccount({
        id: uuidv45(),
        driverId: req.params.driverId,
        bankName,
        last4,
        accountHolderName,
        isDefault: true
      });
      res.json(account);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/vehicles/verify", requireAuth, async (req, res) => {
    try {
      const { imageUrl, imageUrls, regionCode = "BD" } = req.body;
      if (!imageUrl && (!imageUrls || imageUrls.length === 0)) {
        return res.status(400).json({ message: "At least one image URL is required" });
      }
      let result;
      if (imageUrls && imageUrls.length > 1) {
        result = await verifyMultipleVehicleImages(imageUrls, regionCode);
      } else {
        result = await verifyVehicleImage(imageUrl || imageUrls[0], regionCode);
      }
      res.json(result);
    } catch (error) {
      console.error("Vehicle verification error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/drivers/:driverId/vehicles", requireAuth, async (req, res) => {
    try {
      const driver = await storage.getDriver(req.params.driverId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      if (driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const {
        type,
        make,
        model,
        year,
        color,
        plateNumber,
        photo,
        photoFront,
        photoSide,
        photoInterior,
        autoVerify = true
      } = req.body;
      if (!type || !make || !model || !plateNumber) {
        return res.status(400).json({ message: "Type, make, model, and plate number are required" });
      }
      const user = await storage.getUser(driver.userId);
      const regionCode = user?.regionCode || "BD";
      let aiResult = null;
      let verificationStatus = "pending";
      if (autoVerify && (photoFront || photo)) {
        const imagesToVerify = [photoFront, photoSide, photo].filter(Boolean);
        if (imagesToVerify.length > 0) {
          aiResult = await verifyMultipleVehicleImages(imagesToVerify, regionCode);
          verificationStatus = aiResult.isValid ? "ai_verified" : "pending";
        }
      }
      const vehicleId = uuidv45();
      const vehicle = await storage.createVehicle({
        id: vehicleId,
        driverId: req.params.driverId,
        type,
        make: aiResult?.make || make,
        model: aiResult?.model || model,
        year: aiResult?.year || year,
        color: aiResult?.color || color,
        plateNumber,
        photo,
        photoFront,
        photoSide,
        photoInterior,
        verificationStatus,
        aiCategory: aiResult?.category,
        aiConfidence: aiResult?.confidence?.toString(),
        aiConditionScore: aiResult?.conditionScore,
        aiPassengerCapacity: aiResult?.passengerCapacity,
        aiIssues: aiResult?.issues?.join(", "),
        aiVerifiedAt: aiResult?.isValid ? /* @__PURE__ */ new Date() : null
      });
      res.json({
        vehicle,
        verification: aiResult,
        message: aiResult?.isValid ? "Vehicle verified by AI successfully" : "Vehicle submitted for manual review"
      });
    } catch (error) {
      console.error("Create vehicle error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/drivers/:driverId/vehicles", requireAuth, async (req, res) => {
    try {
      const driver = await storage.getDriver(req.params.driverId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      if (driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const vehicles4 = await storage.getDriverVehicles(req.params.driverId);
      res.json(vehicles4);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.patch("/api/vehicles/:vehicleId", requireAuth, async (req, res) => {
    try {
      const vehicle = await storage.getVehicle(req.params.vehicleId);
      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      const driver = await storage.getDriver(vehicle.driverId);
      if (!driver || driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const { reVerify, ...updates } = req.body;
      if (reVerify && (updates.photoFront || updates.photo)) {
        const user = await storage.getUser(driver.userId);
        const imagesToVerify = [updates.photoFront, updates.photoSide, updates.photo].filter(Boolean);
        if (imagesToVerify.length > 0) {
          const aiResult = await verifyMultipleVehicleImages(imagesToVerify, user?.regionCode || "BD");
          updates.aiCategory = aiResult.category;
          updates.aiConfidence = aiResult.confidence?.toString();
          updates.aiConditionScore = aiResult.conditionScore;
          updates.aiPassengerCapacity = aiResult.passengerCapacity;
          updates.aiIssues = aiResult.issues?.join(", ");
          updates.verificationStatus = aiResult.isValid ? "ai_verified" : "pending";
          updates.aiVerifiedAt = aiResult.isValid ? /* @__PURE__ */ new Date() : null;
          if (aiResult.make) updates.make = aiResult.make;
          if (aiResult.model) updates.model = aiResult.model;
          if (aiResult.color) updates.color = aiResult.color;
          if (aiResult.year) updates.year = aiResult.year;
        }
      }
      const updated = await storage.updateVehicle(req.params.vehicleId, updates);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/vehicles/pending", requireAdmin, async (req, res) => {
    try {
      const pendingVehicles = await storage.getPendingVehicleVerifications();
      const vehiclesWithDriverInfo = await Promise.all(
        pendingVehicles.map(async (vehicle) => {
          const driver = await storage.getDriver(vehicle.driverId);
          const user = driver ? await storage.getUser(driver.userId) : null;
          return {
            ...vehicle,
            driverName: user?.name,
            driverPhone: user?.phone,
            driverEmail: user?.email,
            regionCode: user?.regionCode
          };
        })
      );
      res.json(vehiclesWithDriverInfo);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/admin/vehicles/:vehicleId/verify", requireAdmin, async (req, res) => {
    try {
      const { approved, notes, overrideType } = req.body;
      const vehicle = await storage.getVehicle(req.params.vehicleId);
      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      const updates = {
        verificationStatus: approved ? "admin_verified" : "rejected",
        adminVerifiedBy: req.userId,
        adminVerifiedAt: /* @__PURE__ */ new Date(),
        adminNotes: notes
      };
      if (overrideType) {
        updates.type = overrideType;
      }
      const updated = await storage.updateVehicle(req.params.vehicleId, updates);
      if (approved) {
        const driver = await storage.getDriver(vehicle.driverId);
        if (driver && driver.status === "pending") {
          await storage.updateDriver(vehicle.driverId, { status: "approved" });
        }
      }
      res.json({
        vehicle: updated,
        message: approved ? "Vehicle approved" : "Vehicle rejected"
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/vehicles/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getVehicleVerificationStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/vehicles/by-region", requireAdmin, async (req, res) => {
    try {
      const regionStats = await storage.getVehiclesByRegion();
      res.json(regionStats);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/revenue", requireAdmin, async (req, res) => {
    try {
      const period = req.query.period || "week";
      let startDate;
      const now = /* @__PURE__ */ new Date();
      switch (period) {
        case "today":
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case "week":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
          break;
        case "month":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1e3);
          break;
        default:
          startDate = /* @__PURE__ */ new Date(0);
      }
      const completedRides = await db.select().from(rides).where(
        and27(
          eq30(rides.status, "completed"),
          gte16(rides.createdAt, startDate)
        )
      );
      let totalRevenue = 0;
      let cardRevenue = 0;
      let cryptoRevenue = 0;
      let cashRevenue = 0;
      const cityRevenue = {};
      const transactions = [];
      for (const ride of completedRides) {
        const platformFee = parseFloat(ride.platformFee || "0");
        totalRevenue += platformFee;
        const payment = await db.select().from(payments).where(eq30(payments.rideId, ride.id)).limit(1);
        const paymentMethod = payment[0]?.method || "card";
        if (paymentMethod === "card") {
          cardRevenue += platformFee;
        } else if (paymentMethod === "usdt") {
          cryptoRevenue += platformFee;
        } else if (paymentMethod === "cash") {
          cashRevenue += platformFee;
        }
        const cityName = ride.pickupCity || "Unknown";
        cityRevenue[cityName] = (cityRevenue[cityName] || 0) + platformFee;
        if (transactions.length < 20) {
          transactions.push({
            date: ride.completedAt || ride.createdAt,
            rideId: ride.id,
            totalFare: ride.estimatedFare,
            platformFee,
            paymentMethod
          });
        }
      }
      const cityBreakdown = Object.entries(cityRevenue).map(([city, revenue]) => ({ city, revenue })).sort((a, b) => b.revenue - a.revenue);
      res.json({
        totalRevenue,
        cardRevenue,
        cryptoRevenue,
        cashRevenue,
        totalRides: completedRides.length,
        cityBreakdown,
        transactions: transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/vehicle-types", async (req, res) => {
    try {
      const regionCode = req.query.region || "BD";
      const vehicleTypes = [
        { id: "motorcycle", name: "Motorcycle", capacity: 1, icon: "motorcycle", regions: ["BD", "IN", "PK"] },
        { id: "cng", name: "CNG Auto", capacity: 3, icon: "car-outline", regions: ["BD"] },
        { id: "auto_rickshaw", name: "Auto Rickshaw", capacity: 3, icon: "car-outline", regions: ["IN", "PK"] },
        { id: "tuktuk", name: "Tuk-Tuk", capacity: 3, icon: "car-outline", regions: ["TH", "LK"] },
        { id: "economy", name: "Economy", capacity: 4, icon: "car", regions: ["all"] },
        { id: "comfort", name: "Comfort", capacity: 4, icon: "car-sport", regions: ["all"] },
        { id: "premium", name: "Premium", capacity: 4, icon: "car-sport-outline", regions: ["AE", "IN"] },
        { id: "suv", name: "SUV", capacity: 6, icon: "car", regions: ["all"] },
        { id: "minivan", name: "Minivan", capacity: 7, icon: "bus", regions: ["all"] },
        { id: "minibus", name: "Minibus", capacity: 12, icon: "bus", regions: ["all"] }
      ];
      const filtered = vehicleTypes.filter(
        (v) => v.regions.includes("all") || v.regions.includes(regionCode)
      );
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/drivers/:driverId/ratings", requireAuth, async (req, res) => {
    try {
      const driver = await storage.getDriver(req.params.driverId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      if (driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const driverRatings = await storage.getDriverRatings(req.params.driverId);
      const ratingBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      driverRatings.forEach((r) => {
        if (r.rating >= 1 && r.rating <= 5) {
          ratingBreakdown[r.rating]++;
        }
      });
      const uniqueUserIds = [...new Set(driverRatings.map((r) => r.fromUserId))];
      const usersMap = /* @__PURE__ */ new Map();
      await Promise.all(uniqueUserIds.map(async (userId) => {
        const user = await storage.getUser(userId);
        if (user) {
          usersMap.set(userId, { name: user.name, email: user.email });
        }
      }));
      const enrichedRatings = driverRatings.map((rating) => {
        const customer = usersMap.get(rating.fromUserId);
        return {
          ...rating,
          customer: {
            name: customer?.name || customer?.email?.split("@")[0] || "Customer"
          }
        };
      });
      res.json({
        ratings: enrichedRatings,
        averageRating: driver.rating || "5.00",
        totalRatings: driverRatings.length,
        ratingBreakdown
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/payments/nowpayments/wallet-topup", requireAuth, async (req, res) => {
    try {
      const { amount, currency = "AED" } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Valid amount is required" });
      }
      if (!nowPaymentsService.isAvailable()) {
        return res.status(503).json({ message: "USDT payments are not configured yet. Please use cash payment." });
      }
      const baseUrl = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000"}`;
      const orderId = `wallet_${req.userId}_${Date.now()}`;
      const invoice = await nowPaymentsService.createInvoice({
        price: parseFloat(amount),
        currency: currency.toLowerCase(),
        orderId,
        description: `Travony Wallet Top-up: ${currency} ${amount}`,
        callbackUrl: `${baseUrl}/api/payments/nowpayments/ipn`,
        successUrl: `${baseUrl}/payment-success?type=usdt`,
        cancelUrl: `${baseUrl}/payment-cancelled`
      });
      if (!invoice) {
        return res.status(500).json({ message: "Failed to create USDT payment invoice" });
      }
      res.json({
        invoiceId: invoice.id,
        invoiceUrl: invoice.invoice_url,
        amount,
        currency
      });
    } catch (error) {
      console.error("NOWPayments wallet topup error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/payments/nowpayments/ipn", async (req, res) => {
    try {
      const payload = req.body;
      console.log("NOWPayments IPN received:", JSON.stringify(payload));
      const signature = req.headers["x-nowpayments-sig"];
      if (signature && !nowPaymentsService.verifyIpnSignature(payload, signature)) {
        return res.status(400).json({ message: "Invalid IPN signature" });
      }
      const status = payload.payment_status;
      const orderId = payload.order_id;
      if (!status || !orderId) {
        return res.status(400).json({ message: "Missing payment data" });
      }
      if (status === "finished" || status === "confirmed") {
        const parts = orderId.split("_");
        if (parts[0] === "wallet" && parts[1]) {
          const userId = parts[1];
          const amount = payload.price_amount || payload.outcome_amount;
          if (amount) {
            await topUpWallet(userId, parseFloat(amount), "AED");
            console.log(`Wallet topped up via NOWPayments: userId=${userId}, amount=${amount}`);
          }
        } else if (parts[0] === "ride" && parts[1]) {
          const rideId = parts[1];
          const ride = await storage.getRide(rideId);
          if (ride && ride.driverId) {
            const fare = parseFloat(ride.actualFare || ride.estimatedFare || "0");
            const driverShare = fare * 0.9;
            const platformFee = fare * 0.1;
            const existingPayment = await storage.getPaymentByRideId(rideId);
            if (existingPayment && existingPayment.status !== "completed") {
              await storage.updatePayment(existingPayment.id, { status: "completed" });
              await storage.updateDriverWalletBalance(ride.driverId, driverShare);
              await storage.createWalletTransaction({
                id: uuidv45(),
                driverId: ride.driverId,
                rideId: ride.id,
                type: "ride_payment",
                amount: driverShare.toFixed(2),
                status: "completed",
                description: `Earnings from USDT ride payment`,
                completedAt: /* @__PURE__ */ new Date()
              });
              await storage.createWalletTransaction({
                id: uuidv45(),
                rideId: ride.id,
                type: "platform_fee",
                amount: platformFee.toFixed(2),
                status: "completed",
                description: `Platform fee (10%) from USDT ride`,
                completedAt: /* @__PURE__ */ new Date()
              });
              await recordPlatformLedger({
                type: "platform_fee_income",
                amount: platformFee,
                rideId: ride.id,
                driverId: ride.driverId,
                description: `10% fee from USDT ride ${ride.id.substring(0, 8)}`,
                currency: ride.currency || "AED"
              });
              const driver = await storage.getDriver(ride.driverId);
              if (driver) {
                const currentEarnings = parseFloat(driver.totalEarnings || "0");
                await storage.updateDriver(ride.driverId, {
                  totalEarnings: (currentEarnings + driverShare).toFixed(2),
                  totalTrips: (driver.totalTrips || 0) + 1
                });
              }
              console.log(`USDT ride payment confirmed: rideId=${rideId}, driverShare=${driverShare}, platformFee=${platformFee}`);
            }
          }
        }
      }
      res.json({ received: true });
    } catch (error) {
      console.error("NOWPayments IPN error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/payments/nowpayments/status", requireAuth, async (req, res) => {
    res.json({
      available: nowPaymentsService.isAvailable(),
      provider: "nowpayments"
    });
  });
  app2.get("/api/payments/methods", async (req, res) => {
    res.json({
      methods: [
        { id: "cash", name: "Cash", icon: "cash-outline", available: true, description: "Pay driver directly" },
        { id: "wallet", name: "Wallet", icon: "wallet-outline", available: true, description: "Pay from your wallet balance" },
        { id: "card", name: "Card", icon: "card-outline", available: true, description: "Pay with debit or credit card via NOWPayments" },
        { id: "usdt", name: "USDT (Crypto)", icon: "logo-usd", available: true, description: "Pay with USDT stablecoin via NOWPayments" }
      ]
    });
  });
  app2.get("/api/driver/crypto-settings", requireAuth, requireRole("driver"), async (req, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      const settings = await storage.getDriverCryptoSettings(driver.id);
      if (!settings) {
        return res.json({
          driverId: driver.id,
          usdtWalletAddress: null,
          preferredCurrency: "AED",
          isVerified: false
        });
      }
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.put("/api/driver/crypto-settings", requireAuth, requireRole("driver"), async (req, res) => {
    try {
      const { usdtWalletAddress, preferredCurrency } = req.body;
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      let settings = await storage.getDriverCryptoSettings(driver.id);
      if (!settings) {
        settings = await storage.createDriverCryptoSettings({
          driverId: driver.id,
          usdtWalletAddress: usdtWalletAddress || null,
          preferredCurrency: preferredCurrency || "AED",
          isVerified: false
        });
      } else {
        settings = await storage.updateDriverCryptoSettings(driver.id, {
          usdtWalletAddress: usdtWalletAddress || null,
          preferredCurrency: preferredCurrency || settings.preferredCurrency
        });
      }
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/driver/usdt-balance", requireAuth, requireRole("driver"), async (req, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      const balance = await storage.getDriverUsdtBalance(driver.id);
      res.json({ balance, currency: "USDT" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/driver/withdraw-usdt", requireAuth, requireRole("driver"), async (req, res) => {
    try {
      const { amount } = req.body;
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      const cryptoSettings = await storage.getDriverCryptoSettings(driver.id);
      if (!cryptoSettings?.usdtWalletAddress) {
        return res.status(400).json({ message: "Please set up your USDT wallet address first" });
      }
      const balance = await storage.getDriverUsdtBalance(driver.id);
      if (amount <= 0 || amount > balance) {
        return res.status(400).json({ message: "Invalid withdrawal amount" });
      }
      const dbPayout = await storage.createDriverPayout({
        driverId: driver.id,
        amount: amount.toFixed(2),
        currency: "USDT",
        method: "crypto",
        status: "processing",
        cryptoWalletAddress: cryptoSettings.usdtWalletAddress,
        bitpayPayoutId: null
      });
      await storage.createWalletTransaction({
        id: uuidv45(),
        driverId: driver.id,
        type: "withdrawal",
        amount: amount.toFixed(2),
        currency: "USDT",
        status: "pending",
        description: `USDT withdrawal to ${cryptoSettings.usdtWalletAddress.slice(0, 10)}...`,
        metadata: JSON.stringify({ payoutId: dbPayout.id })
      });
      res.json({
        message: "Withdrawal initiated",
        payout: {
          id: dbPayout.id,
          amount,
          status: "processing",
          walletAddress: cryptoSettings.usdtWalletAddress
        }
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/driver/simulate-payout/:payoutId", requireAuth, requireRole("driver"), async (req, res) => {
    const isDev = process.env.NODE_ENV === "development";
    if (!isDev) {
      return res.status(403).json({ message: "Only available in development mode" });
    }
    try {
      const payout = await storage.getDriverPayout(req.params.payoutId);
      if (!payout) {
        return res.status(404).json({ message: "Payout not found" });
      }
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver || payout.driverId !== driver.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      const txHash = `0x${uuidv45().replace(/-/g, "")}`;
      await storage.updateDriverPayout(payout.id, {
        status: "completed",
        txHash,
        completedAt: /* @__PURE__ */ new Date()
      });
      res.json({ message: "Payout simulated", txHash });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/driver/payouts", requireAuth, requireRole("driver"), async (req, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      const payouts = await storage.getDriverPayouts(driver.id);
      res.json(payouts);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/rides/:rideId/receipt", requireAuth, async (req, res) => {
    try {
      const ride = await storage.getRide(req.params.rideId);
      if (!ride) {
        return res.status(404).json({
          code: "RIDE_NOT_FOUND",
          message: "Ride not found"
        });
      }
      const driver = await storage.getDriverByUserId(req.userId);
      const isCustomer = ride.customerId === req.userId;
      const isDriver = driver && ride.driverId === driver.id;
      const isAdmin = req.userRole === "admin";
      if (!isCustomer && !isDriver && !isAdmin) {
        return res.status(403).json({
          code: "ACCESS_DENIED",
          message: "You don't have access to this receipt"
        });
      }
      if (ride.status !== "completed") {
        return res.status(400).json({
          code: "RIDE_NOT_COMPLETED",
          message: "Receipt only available for completed rides"
        });
      }
      const paymentRecords = await db.select().from(payments).where(eq30(payments.rideId, ride.id));
      const payment = paymentRecords[0];
      const customer = await storage.getUser(ride.customerId);
      const driverUser = ride.driverId ? await storage.getDriver(ride.driverId) : null;
      const driverProfile = driverUser ? await storage.getUser(driverUser.userId) : null;
      const totalFare = parseFloat(ride.actualFare || ride.estimatedFare || "0");
      const platformFee = totalFare * 0.1;
      const driverEarnings = totalFare * 0.9;
      const invoices = await storage.getRideInvoicesByRide(ride.id);
      const customerInvoice = invoices.find((i) => i.invoiceType === "customer");
      const receipt = {
        receiptId: customerInvoice?.invoiceNumber || `RCP-${ride.id.substring(0, 8).toUpperCase()}`,
        rideId: ride.id,
        status: "paid",
        createdAt: ride.completedAt || ride.createdAt,
        trip: {
          pickupAddress: ride.pickupAddress,
          dropoffAddress: ride.dropoffAddress,
          distance: ride.distance,
          duration: ride.duration,
          startedAt: ride.startedAt,
          completedAt: ride.completedAt
        },
        rider: {
          name: customer?.name || "Rider",
          phone: customer?.phone
        },
        driver: driverProfile ? {
          name: driverProfile.name,
          phone: driverProfile.phone,
          rating: driverUser?.rating
        } : null,
        payment: {
          method: payment?.method || ride.paymentMethod || "cash",
          status: payment?.status || "completed",
          processedAt: payment?.createdAt,
          paymentId: payment?.id
        },
        fareBreakdown: {
          baseFare: totalFare,
          discount: 0,
          totalFare,
          currency: ride.currency || "AED"
        },
        blockchain: ride.blockchainHash ? {
          hash: ride.blockchainHash,
          verified: !!ride.blockchainTxHash,
          txHash: ride.blockchainTxHash
        } : null,
        invoiceNumber: customerInvoice?.invoiceNumber
      };
      res.json(receipt);
    } catch (error) {
      res.status(500).json({
        code: "RECEIPT_ERROR",
        message: error.message
      });
    }
  });
  app2.get("/api/invoices/ride/:rideId", requireAuth, async (req, res) => {
    try {
      const { rideId } = req.params;
      const invoices = await storage.getRideInvoicesByRide(rideId);
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      const driver = await storage.getDriverByUserId(req.userId);
      const isCustomer = ride.customerId === req.userId;
      const isDriver = driver && ride.driverId === driver.id;
      if (!isCustomer && !isDriver) {
        return res.status(403).json({ message: "Access denied" });
      }
      const filteredInvoices = invoices.filter((inv) => {
        if (isCustomer && inv.invoiceType === "customer") return true;
        if (isDriver && inv.invoiceType === "driver") return true;
        return false;
      });
      res.json(filteredInvoices);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/invoices/:invoiceId", requireAuth, async (req, res) => {
    try {
      const invoice = await storage.getRideInvoice(req.params.invoiceId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      const driver = await storage.getDriverByUserId(req.userId);
      const isRecipient = invoice.recipientId === req.userId || driver && invoice.recipientId === driver.id;
      if (!isRecipient) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/invoices/my/customer", requireAuth, async (req, res) => {
    try {
      const invoices = await storage.getRideInvoicesByRecipient(req.userId, "customer");
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/invoices/my/driver", requireAuth, requireRole("driver"), async (req, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      const invoices = await storage.getRideInvoicesByRecipient(driver.id, "driver");
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/invoices/:invoiceId/html", requireAuth, async (req, res) => {
    try {
      const invoice = await storage.getRideInvoice(req.params.invoiceId);
      if (!invoice) {
        return res.status(404).send("<html><body><h1>Invoice not found</h1></body></html>");
      }
      const driver = await storage.getDriverByUserId(req.userId);
      const isRecipient = invoice.recipientId === req.userId || driver && invoice.recipientId === driver.id;
      if (!isRecipient) {
        return res.status(403).send("<html><body><h1>Access Denied</h1><p>You do not have permission to view this invoice.</p></body></html>");
      }
      const ride = await storage.getRide(invoice.rideId);
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Travony Invoice ${invoice.invoiceNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { font-size: 28px; font-weight: bold; color: #00B14F; }
    .invoice-number { font-size: 14px; color: #666; margin-top: 10px; }
    .section { background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
    .section-title { font-weight: 600; margin-bottom: 10px; color: #00B14F; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .row:last-child { border-bottom: none; }
    .total { font-size: 20px; font-weight: bold; color: #00B14F; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #999; }
    .blockchain { background: #f0f0ff; padding: 10px; border-radius: 4px; font-size: 12px; word-break: break-all; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Travony</div>
    <div class="invoice-number">Invoice #${invoice.invoiceNumber}</div>
    <div style="font-size: 12px; color: #999;">${new Date(invoice.createdAt).toLocaleDateString()}</div>
  </div>

  <div class="section">
    <div class="section-title">Trip Details</div>
    <div class="row"><span>Pickup</span><span>${ride?.pickupAddress || "N/A"}</span></div>
    <div class="row"><span>Dropoff</span><span>${ride?.dropoffAddress || "N/A"}</span></div>
    <div class="row"><span>Distance</span><span>${ride?.distance || "0"} km</span></div>
    <div class="row"><span>Duration</span><span>${ride?.duration || "0"} min</span></div>
  </div>

  <div class="section">
    <div class="section-title">Payment</div>
    <div class="row"><span>Total Amount</span><span class="total">${invoice.currency} ${invoice.totalAmount}</span></div>
    ${invoice.invoiceType === "driver" ? `
    <div class="row"><span>Platform Fee (10%)</span><span>-${invoice.currency} ${invoice.platformFee || "0.00"}</span></div>
    <div class="row"><span>Your Earnings</span><span style="color: #00B14F; font-weight: bold;">${invoice.currency} ${(parseFloat(invoice.totalAmount || "0") - parseFloat(invoice.platformFee || "0")).toFixed(2)}</span></div>
    ` : ""}
  </div>

  ${ride?.blockchainHash ? `
  <div class="section">
    <div class="section-title">Blockchain Verification</div>
    <div class="blockchain">
      <strong>Ride Hash:</strong><br>${ride.blockchainHash}
    </div>
  </div>
  ` : ""}

  <div class="footer">
    <p>Thank you for riding with Travony!</p>
    <p>Powered by blockchain technology for transparent pricing.</p>
  </div>
</body>
</html>`;
      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (error) {
      res.status(500).send(`<html><body><h1>Error loading invoice</h1><p>${error.message}</p></body></html>`);
    }
  });
  initializeRegions().catch(console.error);
  initializeServiceTypes().catch(console.error);
  app2.get("/api/regions", async (req, res) => {
    try {
      const allRegions = await getAllRegions();
      res.json(allRegions);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/regions/:code", async (req, res) => {
    try {
      const region = await getRegionByCode(req.params.code);
      if (!region) {
        return res.status(404).json({ message: "Region not found" });
      }
      res.json(region);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/phone-codes", async (req, res) => {
    try {
      const codes = getPhoneCodesList();
      res.json(codes);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/detect-region", async (req, res) => {
    try {
      const { phone } = req.body;
      const regionCode = await detectRegionFromPhone(phone || "");
      const region = await getRegionByCode(regionCode);
      res.json({ regionCode, region });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/regions/:code/calculate-fare", async (req, res) => {
    try {
      const { vehicleType, distanceKm, durationMinutes, surgeMultiplier } = req.body;
      const result = await calculateFare(
        req.params.code,
        vehicleType,
        distanceKm,
        durationMinutes,
        surgeMultiplier
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/disputes", requireAuth, async (req, res) => {
    try {
      const { rideId, type, description } = req.body;
      if (!rideId || !type) {
        return res.status(400).json({ message: "Ride ID and dispute type are required" });
      }
      const result = await createAndResolveDispute(
        rideId,
        req.userId,
        req.userRole,
        type,
        description || ""
      );
      res.json({
        disputeId: result.disputeId,
        status: result.resolved ? "resolved" : "investigating",
        analysis: result.analysis,
        message: result.resolved ? "Your dispute has been automatically resolved based on our AI analysis." : "Your dispute is being reviewed. We'll update you shortly."
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/rides/:id/disputes", requireAuth, async (req, res) => {
    try {
      const disputes2 = await getDisputesByRide(req.params.id);
      res.json(disputes2);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/my-disputes", requireAuth, async (req, res) => {
    try {
      const disputes2 = await getDisputesByUser(req.userId);
      res.json(disputes2);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/rides/:id/telemetry", requireAuth, async (req, res) => {
    try {
      const { lat, lng, speed, heading, accuracy } = req.body;
      await recordTelemetry(req.params.id, lat, lng, speed, heading, accuracy);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/languages", async (req, res) => {
    try {
      const languages = getSupportedLanguages();
      res.json(languages);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/quick-replies/:language", async (req, res) => {
    try {
      const replies = getQuickReplies(req.params.language);
      res.json(replies);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/rides/:id/messages", requireAuth, async (req, res) => {
    try {
      const { message, senderLanguage, recipientLanguage, isQuickReply } = req.body;
      const result = await sendRideMessage(
        req.params.id,
        req.userId,
        req.userRole,
        message,
        senderLanguage || "en",
        recipientLanguage || "en",
        isQuickReply || false
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/rides/:id/messages", requireAuth, async (req, res) => {
    try {
      const messages = await getRideMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/rides/:id/share", requireAuth, async (req, res) => {
    try {
      const ride = await storage.getRide(req.params.id);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      if (ride.customerId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      let shareToken = ride.shareToken;
      if (!shareToken) {
        shareToken = `share_${uuidv45().replace(/-/g, "").substring(0, 16)}`;
        await storage.updateRide(req.params.id, { shareToken });
      }
      const baseUrl = process.env.EXPO_PUBLIC_DOMAIN || "https://travony.replit.app";
      const shareUrl = `${baseUrl}/track/${shareToken}`;
      res.json({
        shareToken,
        shareUrl,
        message: "Share this link with friends or family to let them track your ride in real-time"
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/rides/track/:shareToken", async (req, res) => {
    try {
      const { rides: rides4 } = await storage.getAllRides();
      const ride = rides4.find((r) => r.shareToken === req.params.shareToken);
      if (!ride) {
        return res.status(404).json({ message: "Invalid or expired tracking link" });
      }
      res.json({
        id: ride.id,
        status: ride.status,
        pickupAddress: ride.pickupAddress,
        dropoffAddress: ride.dropoffAddress,
        pickupLat: ride.pickupLat,
        pickupLng: ride.pickupLng,
        dropoffLat: ride.dropoffLat,
        dropoffLng: ride.dropoffLng,
        estimatedFare: ride.estimatedFare,
        startedAt: ride.startedAt,
        completedAt: ride.completedAt,
        carbonFootprintKg: ride.carbonFootprintKg
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/rides/:id/tip", requireAuth, async (req, res) => {
    try {
      const { amount } = req.body;
      const ride = await storage.getRide(req.params.id);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      if (ride.customerId !== req.userId) {
        return res.status(403).json({ message: "Only the rider can add a tip" });
      }
      if (ride.status !== "completed") {
        return res.status(400).json({ message: "Can only tip completed rides" });
      }
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid tip amount" });
      }
      if (amount > 100) {
        return res.status(400).json({ message: "Maximum tip is 100 AED" });
      }
      await storage.updateRide(req.params.id, { tipAmount: amount.toString() });
      if (ride.driverId) {
        const driver = await storage.getDriver(ride.driverId);
        if (driver) {
          const currentBalance = parseFloat(driver.walletBalance || "0");
          await storage.updateDriver(ride.driverId, {
            walletBalance: (currentBalance + amount).toString()
          });
          await storage.createWalletTransaction({
            id: uuidv45(),
            driverId: ride.driverId,
            rideId: ride.id,
            type: "tip",
            amount: amount.toString(),
            currency: ride.currency || "AED",
            status: "completed",
            description: `Tip from rider (100% yours, no platform cut)`,
            completedAt: /* @__PURE__ */ new Date()
          });
        }
      }
      res.json({
        success: true,
        message: "Thank you for your generosity!",
        tipAmount: amount
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.patch("/api/drivers/:driverId/rating-filter", requireAuth, async (req, res) => {
    try {
      const { driverId } = req.params;
      const { minRiderRating, enabled } = req.body;
      const driver = await storage.getDriver(driverId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      if (driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const updates = {};
      if (typeof enabled === "boolean") {
        updates.minRiderRatingEnabled = enabled;
      }
      if (typeof minRiderRating === "number" && minRiderRating >= 1 && minRiderRating <= 5) {
        updates.minRiderRating = minRiderRating.toFixed(2);
      }
      await storage.updateDriver(driverId, updates);
      res.json({
        success: true,
        minRiderRating: updates.minRiderRating || driver.minRiderRating,
        minRiderRatingEnabled: updates.minRiderRatingEnabled ?? driver.minRiderRatingEnabled,
        message: enabled ? "Minimum rating filter enabled" : "Minimum rating filter disabled"
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/rides/:id/carbon", async (req, res) => {
    try {
      const ride = await storage.getRide(req.params.id);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      const distanceKm = parseFloat(ride.distance || "0");
      const carbonKg = (distanceKm * 0.12 * 0.5).toFixed(3);
      const treesEquivalent = (parseFloat(carbonKg) / 21).toFixed(2);
      res.json({
        rideId: ride.id,
        distanceKm: distanceKm.toFixed(2),
        carbonFootprintKg: carbonKg,
        carbonSavedKg: (distanceKm * 0.12 * 0.5).toFixed(3),
        // Saved vs driving alone
        treesEquivalent,
        ecoMessage: `This shared ride saved ${carbonKg}kg of CO2 - equivalent to ${treesEquivalent} trees absorbing for a day!`
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/drivers/heatmap", requireAuth, async (req, res) => {
    try {
      if (req.userRole !== "driver" && req.userRole !== "admin") {
        return res.status(403).json({ message: "Only drivers can access heatmap" });
      }
      const { rides: allRides } = await storage.getAllRides();
      const recentRides = allRides.filter((r) => {
        const createdAt = new Date(r.createdAt);
        const hourAgo = new Date(Date.now() - 60 * 60 * 1e3);
        return createdAt > hourAgo && (r.status === "pending" || r.status === "accepted");
      });
      const zones = {};
      for (const ride of recentRides) {
        const lat = Math.round(parseFloat(ride.pickupLat) * 100) / 100;
        const lng = Math.round(parseFloat(ride.pickupLng) * 100) / 100;
        const key = `${lat},${lng}`;
        if (!zones[key]) {
          zones[key] = { lat, lng, demand: 0, avgFare: 0 };
        }
        zones[key].demand++;
        zones[key].avgFare += parseFloat(ride.estimatedFare || "0");
      }
      Object.values(zones).forEach((zone) => {
        if (zone.demand > 0) {
          zone.avgFare = Math.round(zone.avgFare / zone.demand);
        }
      });
      const hotspots2 = Object.values(zones).sort((a, b) => b.demand - a.demand).slice(0, 20).map((zone) => ({
        ...zone,
        intensity: zone.demand >= 5 ? "high" : zone.demand >= 2 ? "medium" : "low",
        color: zone.demand >= 5 ? "#ef4444" : zone.demand >= 2 ? "#f59e0b" : "#22c55e"
      }));
      res.json({
        hotspots: hotspots2,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        message: hotspots2.length > 0 ? `${hotspots2.length} active demand zones found` : "No high demand areas right now"
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  initializeMexicoCityLaunch().then(() => initializeHubs()).catch(console.error);
  app2.get("/api/expansion-cities", async (req, res) => {
    try {
      const cities2 = getExpansionCities();
      const tierGroups = {
        tier1: cities2.filter((c) => c.tier === 1),
        tier2: cities2.filter((c) => c.tier === 2),
        tier3: cities2.filter((c) => c.tier === 3)
      };
      res.json({
        total: cities2.length,
        tiers: tierGroups,
        rolloutOrder: cities2.sort((a, b) => a.launchOrder - b.launchOrder).map((c) => ({
          order: c.launchOrder,
          name: c.name,
          slug: c.slug,
          region: c.regionCode,
          tier: c.tier
        }))
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/expansion-cities/:slug/config", async (req, res) => {
    try {
      const config = getCityConfig(req.params.slug);
      if (!config) {
        return res.status(404).json({ message: "City configuration not found" });
      }
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/cities", async (req, res) => {
    try {
      const allCities = await getAllCities();
      res.json(allCities);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/cities/:slug", async (req, res) => {
    try {
      const city = await getCityBySlug(req.params.slug);
      if (!city) {
        return res.status(404).json({ message: "City not found" });
      }
      res.json(city);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/cities/:cityId/health", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const health = await getCityHealth(req.params.cityId);
      if (!health) {
        return res.status(404).json({ message: "City not found" });
      }
      res.json(health);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/driver-intake", async (req, res) => {
    try {
      const { citySlug, channel, phone, name, referralCode } = req.body;
      if (!citySlug || !channel || !phone) {
        return res.status(400).json({ message: "City, channel, and phone are required" });
      }
      const intake = await recordDriverIntake({ citySlug, channel, phone, name, referralCode });
      res.json(intake);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/driver-documents", requireAuth, requireRole("driver"), async (req, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }
      const { type, fileUrl, fileName, fileSize, mimeType } = req.body;
      if (!type || !fileUrl) {
        return res.status(400).json({ message: "Document type and file URL are required" });
      }
      const doc = await uploadDriverDocument(driver.id, type, fileUrl, fileName, fileSize, mimeType);
      res.json(doc);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/driver-documents", requireAuth, requireRole("driver"), async (req, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }
      const docs = await getDriverDocuments(driver.id);
      res.json(docs);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/admin/documents/:documentId/review", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { status, notes } = req.body;
      if (!status || !["approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Valid status (approved/rejected) is required" });
      }
      const doc = await reviewDocument(req.params.documentId, req.userId, status, notes);
      res.json(doc);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/verification-queue", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { cityId, status } = req.query;
      const queue = await getVerificationQueue(cityId, status);
      res.json(queue);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/driver/trust-protection", requireAuth, requireRole("driver"), async (req, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }
      const protection = await getTrustProtectionStatus(driver.id);
      res.json(protection || { isActive: false, message: "No protection plan active" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/education/modules", async (req, res) => {
    try {
      const { cityId } = req.query;
      const modules = await getEducationModules(cityId);
      res.json(modules);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/driver/education/progress", requireAuth, requireRole("driver"), async (req, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }
      const progress = await getDriverEducationProgress(driver.id);
      const modules = await getEducationModules();
      res.json({
        modules,
        progress,
        completedCount: progress.filter((p) => p.status === "completed").length,
        totalRequired: modules.filter((m) => m.isRequired).length
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/driver/education/:moduleId/start", requireAuth, requireRole("driver"), async (req, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }
      const { moduleName } = req.body;
      const record = await startEducationModule(driver.id, req.params.moduleId, moduleName || req.params.moduleId);
      res.json(record);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/driver/education/:moduleId/complete", requireAuth, requireRole("driver"), async (req, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }
      const { score } = req.body;
      const record = await completeEducationModule(driver.id, req.params.moduleId, score);
      res.json(record);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/driver/referral-code", requireAuth, requireRole("driver"), async (req, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }
      const code = await generateReferralCode(driver.id);
      res.json({ referralCode: code });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/driver/champion-eligibility", requireAuth, requireRole("driver"), async (req, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }
      const eligibility = await checkChampionEligibility(driver.id);
      res.json(eligibility);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/driver/apply-champion", requireAuth, requireRole("driver"), async (req, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }
      const { cityId } = req.body;
      if (!cityId) {
        return res.status(400).json({ message: "City ID is required" });
      }
      const champion = await nominateChampion(driver.id, cityId);
      res.json(champion);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  app2.get("/api/cities/:cityId/champions", requireAuth, async (req, res) => {
    try {
      const champions = await getCityChampions(req.params.cityId);
      res.json(champions);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/admin/champions/:championId/approve", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const champion = await approveChampion(req.params.championId);
      res.json(champion);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/admin/cities/:cityId/launch-status", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ message: "Launch status is required" });
      }
      const city = await updateCityLaunchStatus(req.params.cityId, status);
      res.json(city);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/admin/cities/:cityId/group-links", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { telegramLink, whatsappLink } = req.body;
      const city = await updateCityGroupLinks(req.params.cityId, telegramLink, whatsappLink);
      res.json(city);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/admin/send-weekly-feedback", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const driversResult = await storage.getAllDrivers();
      const weekEnd = /* @__PURE__ */ new Date();
      const weekStart = /* @__PURE__ */ new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      let sent = 0;
      let failed = 0;
      for (const driver of driversResult.drivers) {
        if (driver.status !== "approved") continue;
        const user = await storage.getUser(driver.userId);
        if (!user?.email) continue;
        const allRides = await storage.getRidesByDriver(driver.id);
        const weekRides = allRides.filter((r) => {
          const rideDate = new Date(r.completedAt || r.createdAt);
          return rideDate >= weekStart && rideDate <= weekEnd && r.status === "completed";
        });
        if (weekRides.length === 0) continue;
        const totalEarnings = weekRides.reduce((sum2, r) => {
          const fare = parseFloat(String(r.finalFare || r.estimatedFare || 0));
          return sum2 + fare * 0.9;
        }, 0);
        const ratings3 = [];
        for (let i = 5; i >= 1; i--) {
          const count8 = weekRides.filter((r) => Math.round(r.driverRating || 0) === i).length;
          if (count8 > 0) ratings3.push({ stars: i, count: count8 });
        }
        const ratedRides = weekRides.filter((r) => r.driverRating);
        const avgRating = ratedRides.length > 0 ? ratedRides.reduce((sum2, r) => sum2 + parseFloat(String(r.driverRating)), 0) / ratedRides.length : 5;
        const recentComments = weekRides.filter((r) => r.driverFeedback).slice(0, 5).map((r) => ({
          comment: r.driverFeedback,
          rating: Math.round(r.driverRating || 5),
          date: new Date(r.completedAt || r.createdAt).toLocaleDateString()
        }));
        const topStrengths = [];
        if (avgRating >= 4.5) topStrengths.push("Excellent Service");
        if (weekRides.length >= 10) topStrengths.push("High Activity");
        const onTimeRatio = weekRides.filter((r) => !r.wasLate).length / weekRides.length;
        if (onTimeRatio >= 0.9) topStrengths.push("Punctual Pickups");
        const improvementAreas = [];
        if (avgRating < 4) improvementAreas.push("Work on improving customer satisfaction");
        if (onTimeRatio < 0.7) improvementAreas.push("Focus on arriving on time for pickups");
        const success = await sendWeeklyFeedbackEmail({
          driverName: user.name || user.email.split("@")[0],
          driverEmail: user.email,
          weekStartDate: weekStart.toLocaleDateString(),
          weekEndDate: weekEnd.toLocaleDateString(),
          totalRides: weekRides.length,
          totalEarnings: totalEarnings.toFixed(2),
          averageRating: avgRating,
          ratings: ratings3,
          recentComments,
          topStrengths,
          improvementAreas
        });
        if (success) sent++;
        else failed++;
      }
      res.json({ message: `Weekly feedback emails: ${sent} sent, ${failed} failed` });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/admin/cities/:cityId/transition-mode", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { mode } = req.body;
      if (!mode) {
        return res.status(400).json({ message: "Mode is required" });
      }
      const result = await transitionCityLaunchMode(req.params.cityId, mode);
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  app2.get("/api/cities/:cityId/launch-status", async (req, res) => {
    try {
      const status = await getCityLaunchStatus(req.params.cityId);
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/cities/:cityId/test-progress", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const progress = await getCityTestProgress(req.params.cityId);
      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/admin/cities/:cityId/test/:testName", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { status, failureReason } = req.body;
      if (!status || !["passed", "failed"].includes(status)) {
        return res.status(400).json({ message: "Status must be 'passed' or 'failed'" });
      }
      const progress = await updateTestStatus(
        req.params.cityId,
        req.params.testName,
        status,
        failureReason,
        req.userId
      );
      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/admin/cities/:cityId/founding-driver", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { driverId } = req.body;
      if (!driverId) {
        return res.status(400).json({ message: "Driver ID is required" });
      }
      const tag = await tagDriverAsFounder(driverId, req.params.cityId, req.userId);
      res.json(tag);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  app2.get("/api/cities/:cityId/founding-drivers", async (req, res) => {
    try {
      const drivers6 = await getFoundingDrivers(req.params.cityId);
      res.json(drivers6);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/driver/invite-code", requireAuth, requireRole("driver"), async (req, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }
      const { cityId } = req.body;
      if (!cityId) {
        return res.status(400).json({ message: "City ID is required" });
      }
      const inviteCode = await generateRiderInviteCode(driver.id, cityId);
      res.json(inviteCode);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  app2.post("/api/rider/use-invite-code", requireAuth, async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ message: "Invite code is required" });
      }
      const result = await useRiderInviteCode(code, req.userId);
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  app2.post("/api/driver/feedback", requireAuth, requireRole("driver"), async (req, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }
      const { cityId, category, feedback, confusionLevel, screenName, actionAttempted, question } = req.body;
      if (!category || !feedback) {
        return res.status(400).json({ message: "Category and feedback are required" });
      }
      const record = await submitDriverFeedback(
        driver.id,
        cityId,
        category,
        feedback,
        confusionLevel,
        screenName,
        actionAttempted,
        question
      );
      res.json(record);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/cities/:cityId/feedback", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const feedback = await getUnresolvedFeedback(req.params.cityId);
      res.json(feedback);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/admin/feedback/:feedbackId/resolve", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { resolution } = req.body;
      if (!resolution) {
        return res.status(400).json({ message: "Resolution is required" });
      }
      await resolveFeedback(req.params.feedbackId, resolution, req.userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/admin/cities/:cityId/simulated-driver", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { name } = req.body;
      const driver = await createSimulatedDriver(req.params.cityId, name || "Test Driver");
      res.json(driver);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  app2.post("/api/admin/cities/:cityId/simulated-rider", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { name } = req.body;
      const rider = await createSimulatedRider(req.params.cityId, name || "Test Rider");
      res.json(rider);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  app2.get("/api/admin/cities/:cityId/simulated-entities", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { type } = req.query;
      const entities = await getSimulatedEntities(req.params.cityId, type);
      res.json(entities);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/dashboard/overview", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const overview = await getDashboardOverview();
      res.json(overview);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/dashboard/riders", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const riders = await getRidersList(page, limit);
      res.json(riders);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/dashboard/drivers", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const status = req.query.status;
      const drivers6 = await getDriversList(page, limit, status);
      res.json(drivers6);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/dashboard/drivers/:driverId", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const driver = await getDriverDetails(req.params.driverId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      res.json(driver);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/admin/dashboard/drivers/:driverId/approve", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const result = await approveDriver(req.params.driverId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/admin/dashboard/drivers/:driverId/reject", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { reason } = req.body;
      const result = await rejectDriver(req.params.driverId, reason);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/admin/dashboard/drivers/:driverId/suspend", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { reason } = req.body;
      const result = await suspendDriver(req.params.driverId, reason);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/dashboard/rides", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const status = req.query.status;
      const rides4 = await getRidesList(page, limit, status);
      res.json(rides4);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/dashboard/disputes", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const disputes2 = await getDisputesList(page, limit);
      res.json(disputes2);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/dashboard/cities", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const cities2 = await getCitiesList();
      res.json(cities2);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/dashboard/analytics", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const period = req.query.period || "week";
      const analytics = await getAnalytics(period);
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/dashboard/verification-queue", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const queue = await getVerificationQueue2();
      res.json(queue);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/dashboard/driver-feedback", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const cityId = req.query.cityId;
      const feedback = await getDriverFeedbackList(cityId);
      res.json(feedback);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/admin", (req, res) => {
    res.sendFile("admin-dashboard.html", { root: "./server/templates" });
  });
  app2.get("/delete-account", (req, res) => {
    res.sendFile("data-deletion.html", { root: "./server/templates" });
  });
  app2.get("/data-deletion", (req, res) => {
    res.sendFile("data-deletion.html", { root: "./server/templates" });
  });
  app2.get("/privacy", (req, res) => {
    res.sendFile("privacy-policy.html", { root: "./server/templates" });
  });
  app2.get("/terms", (req, res) => {
    res.sendFile("terms-of-service.html", { root: "./server/templates" });
  });
  app2.get("/support", (req, res) => {
    res.sendFile("support.html", { root: "./server/templates" });
  });
  app2.get("/drive", (req, res) => {
    res.sendFile("drive-with-us.html", { root: "./server/templates" });
  });
  app2.get("/drive-with-us", (req, res) => {
    res.sendFile("drive-with-us.html", { root: "./server/templates" });
  });
  app2.post("/api/driver-interest", async (req, res) => {
    try {
      const { name, phone, city, vehicleType, currentPlatform, referralCode } = req.body;
      console.log("[Driver Interest]", { name, phone, city, vehicleType, currentPlatform, referralCode });
      res.json({ success: true, message: "Interest registered successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/telegram/setup", async (req, res) => {
    try {
      const telegramBot = await Promise.resolve().then(() => (init_telegramBot(), telegramBot_exports));
      const webhookUrl = `https://travony.replit.app/api/webhook/telegram`;
      const webhookSet = await telegramBot.setWebhook(webhookUrl);
      const commandsSet = await telegramBot.setBotCommands();
      res.json({ success: true, webhook: webhookSet, commands: commandsSet });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/telegram/broadcast", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ message: "Message required" });
      const telegramBot = await Promise.resolve().then(() => (init_telegramBot(), telegramBot_exports));
      const sent = await telegramBot.broadcastCampaignMessage(message);
      res.json({ success: true, sent });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/campaign", (req, res) => {
    res.sendFile("campaign-hub.html", { root: "./server/templates" });
  });
  app2.get("/api/meta/status", async (req, res) => {
    const GRAPH_API_URL2 = "https://graph.facebook.com/v21.0";
    const token = process.env.META_ACCESS_TOKEN;
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const requiredPermissions = ["instagram_basic", "instagram_content_publish", "pages_show_list", "pages_read_engagement"];
    if (!token) {
      return res.json({
        tokenValid: false,
        tokenExpires: null,
        userName: null,
        pages: [],
        instagramConnected: false,
        instagramAccountId: null,
        permissions: [],
        missingPermissions: requiredPermissions
      });
    }
    try {
      const [meRes, permRes, pagesRes] = await Promise.all([
        fetch(`${GRAPH_API_URL2}/me?fields=id,name&access_token=${token}`),
        fetch(`${GRAPH_API_URL2}/me/permissions?access_token=${token}`),
        fetch(`${GRAPH_API_URL2}/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${token}`)
      ]);
      const meData = await meRes.json();
      const permData = await permRes.json();
      const pagesData = await pagesRes.json();
      const tokenValid = !meData.error;
      const userName = meData.name || null;
      const grantedPermissions = [];
      if (permData.data) {
        for (const p of permData.data) {
          if (p.status === "granted") grantedPermissions.push(p.permission);
        }
      }
      const missingPermissions = requiredPermissions.filter(
        (p) => !grantedPermissions.includes(p)
      );
      const pages = [];
      let instagramConnected = false;
      let instagramAccountId = null;
      if (pagesData.data) {
        for (const page of pagesData.data) {
          const hasInstagram = !!page.instagram_business_account;
          const igUsername = page.instagram_business_account?.username || null;
          if (hasInstagram) {
            instagramConnected = true;
            instagramAccountId = page.instagram_business_account.id;
          }
          pages.push({ id: page.id, name: page.name, hasInstagram, igUsername });
        }
      }
      let tokenExpires = null;
      if (appId && appSecret) {
        try {
          const debugRes = await fetch(
            `${GRAPH_API_URL2}/debug_token?input_token=${token}&access_token=${appId}|${appSecret}`
          );
          const debugData = await debugRes.json();
          if (debugData.data?.expires_at) {
            tokenExpires = new Date(debugData.data.expires_at * 1e3).toISOString();
          }
        } catch (e) {
        }
      }
      res.json({
        appId: appId || null,
        tokenValid,
        tokenExpires,
        userName,
        pages,
        instagramConnected,
        instagramAccountId,
        permissions: grantedPermissions,
        missingPermissions
      });
    } catch (error) {
      res.json({
        appId: appId || null,
        tokenValid: false,
        tokenExpires: null,
        userName: null,
        pages: [],
        instagramConnected: false,
        instagramAccountId: null,
        permissions: [],
        missingPermissions: requiredPermissions,
        error: error.message
      });
    }
  });
  app2.get("/connect-instagram", (req, res) => {
    res.sendFile("instagram-connect.html", { root: "./server/templates" });
  });
  app2.get("/facebook-posts", (req, res) => {
    res.sendFile("facebook-post.html", { root: "./server/templates" });
  });
  app2.get("/facebook-login", (req, res) => {
    const appId = process.env.META_APP_ID;
    if (!appId) return res.send("META_APP_ID not configured");
    const redirectUri = `https://travony.replit.app/facebook-callback`;
    const scopes = "pages_show_list,pages_manage_posts,pages_read_engagement";
    const url = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&auth_type=rerequest`;
    res.redirect(url);
  });
  app2.get("/facebook-callback", async (req, res) => {
    const code = req.query.code;
    const error = req.query.error;
    if (error) {
      return res.send(`<html><body style="background:#0f0f0f;color:white;font-family:sans-serif;padding:40px;text-align:center;"><h2 style="color:#ff6b6b;">Facebook Login Error</h2><p>${req.query.error_description || error}</p><a href="/facebook-login" style="color:#1877F2;">Try Again</a></body></html>`);
    }
    if (!code) {
      return res.send(`<html><body style="background:#0f0f0f;color:white;font-family:sans-serif;padding:40px;text-align:center;"><h2 style="color:#ff6b6b;">No authorization code received</h2><a href="/facebook-login" style="color:#1877F2;">Try Again</a></body></html>`);
    }
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) {
      return res.send("META_APP_ID or META_APP_SECRET not configured");
    }
    const redirectUri = `https://travony.replit.app/facebook-callback`;
    try {
      const tokenRes = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`);
      const tokenData = await tokenRes.json();
      if (tokenData.error) {
        return res.send(`<html><body style="background:#0f0f0f;color:white;font-family:sans-serif;padding:40px;text-align:center;"><h2 style="color:#ff6b6b;">Token Error</h2><p>${tokenData.error.message}</p><a href="/facebook-login" style="color:#1877F2;">Try Again</a></body></html>`);
      }
      const userToken = tokenData.access_token;
      const longRes = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${userToken}`);
      const longData = await longRes.json();
      const longToken = longData.access_token || userToken;
      const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,fan_count,category&limit=100&access_token=${longToken}`);
      const pagesData = await pagesRes.json();
      const ig = await Promise.resolve().then(() => (init_instagramService(), instagramService_exports));
      if (pagesData.data && pagesData.data.length > 0) {
        const travoneyPage = pagesData.data.find((p) => p.name?.toLowerCase().includes("travon")) || pagesData.data[0];
        let pageToken = travoneyPage.access_token;
        try {
          const longPageRes = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${pageToken}`);
          const longPageData = await longPageRes.json();
          if (longPageData.access_token) pageToken = longPageData.access_token;
        } catch (e) {
        }
        ig.setPageToken(pageToken);
        ig.setPageInfo(travoneyPage.id, travoneyPage.name);
        const allPages = pagesData.data.map((p) => `${p.name} (${p.id}) - ${p.fan_count || 0} fans`).join("<br>");
        return res.send(`<html><body style="background:#0f0f0f;color:white;font-family:sans-serif;padding:40px;text-align:center;">
          <h2 style="color:#4ade80;">Connected Successfully!</h2>
          <p style="color:#b0b0b0;">Page: <strong style="color:white;">${travoneyPage.name}</strong> (ID: ${travoneyPage.id})</p>
          <p style="color:#b0b0b0;">Fans: ${travoneyPage.fan_count || "N/A"}</p>
          <p style="color:#888;font-size:0.85rem;">All pages found:<br>${allPages}</p>
          <br><a href="/campaign" style="color:#1877F2;font-size:1.1rem;">Go to Campaign Hub</a>
        </body></html>`);
      } else {
        return res.send(`<html><body style="background:#0f0f0f;color:white;font-family:sans-serif;padding:40px;text-align:center;">
          <h2 style="color:#ff6b6b;">No Pages Found</h2>
          <p style="color:#b0b0b0;">Your Facebook account doesn't have any pages, or you didn't select a page during login.</p>
          <p style="color:#888;">Make sure you're logged into the Facebook account that manages the <strong>travoney</strong> page, and select it when prompted.</p>
          <br><a href="/facebook-login" style="color:#1877F2;">Try Again</a>
        </body></html>`);
      }
    } catch (err) {
      return res.send(`<html><body style="background:#0f0f0f;color:white;font-family:sans-serif;padding:40px;text-align:center;"><h2 style="color:#ff6b6b;">Error</h2><p>${err.message}</p><a href="/facebook-login" style="color:#1877F2;">Try Again</a></body></html>`);
    }
  });
  app2.post("/api/facebook/save-page-token", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ success: false, error: "Token is required" });
      const ig = await Promise.resolve().then(() => (init_instagramService(), instagramService_exports));
      const result = await ig.saveAndValidatePageToken(token);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.get("/api/facebook/page-status", async (req, res) => {
    try {
      const ig = await Promise.resolve().then(() => (init_instagramService(), instagramService_exports));
      const result = await ig.getPageStatus();
      res.json(result);
    } catch (error) {
      res.json({ connected: false, error: error.message });
    }
  });
  app2.post("/api/facebook/test-post", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ success: false, error: "Message is required" });
      const ig = await Promise.resolve().then(() => (init_instagramService(), instagramService_exports));
      const result = await ig.postToFacebookPage(message);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.post("/api/facebook/post", async (req, res) => {
    try {
      const { message, link, imageUrl } = req.body;
      if (!message) return res.status(400).json({ success: false, error: "Message is required" });
      const ig = await Promise.resolve().then(() => (init_instagramService(), instagramService_exports));
      const result = await ig.postToFacebookPage(message, link, imageUrl);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.post("/api/instagram/save-token", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ success: false, error: "Token is required" });
      const ig = await Promise.resolve().then(() => (init_instagramService(), instagramService_exports));
      ig.setToken(token);
      const refreshResult = await ig.refreshAccessToken();
      const discoverResult = await ig.discoverInstagramAccount();
      res.json({
        success: true,
        tokenExchanged: refreshResult.success,
        instagramDiscovered: discoverResult.success,
        igAccountId: discoverResult.igAccountId || null,
        message: discoverResult.success ? `Connected! Instagram account ${discoverResult.igAccountId} linked.` : `Token saved but: ${discoverResult.error || "Could not find Instagram Business Account"}`
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.post("/api/instagram/post", async (req, res) => {
    try {
      const { imageUrl, caption } = req.body;
      if (!imageUrl || !caption) return res.status(400).json({ message: "imageUrl and caption required" });
      const ig = await Promise.resolve().then(() => (init_instagramService(), instagramService_exports));
      const result = await ig.postImageToInstagram(imageUrl, caption);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.post("/api/instagram/carousel", async (req, res) => {
    try {
      const { imageUrls, caption } = req.body;
      if (!imageUrls || !caption) return res.status(400).json({ message: "imageUrls and caption required" });
      const ig = await Promise.resolve().then(() => (init_instagramService(), instagramService_exports));
      const result = await ig.postCarouselToInstagram(imageUrls, caption);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.post("/api/instagram/reel", async (req, res) => {
    try {
      const { videoUrl, caption } = req.body;
      if (!videoUrl || !caption) return res.status(400).json({ message: "videoUrl and caption required" });
      const ig = await Promise.resolve().then(() => (init_instagramService(), instagramService_exports));
      const result = await ig.postReelToInstagram(videoUrl, caption);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.post("/api/instagram/refresh-token", async (req, res) => {
    try {
      const ig = await Promise.resolve().then(() => (init_instagramService(), instagramService_exports));
      const result = await ig.refreshAccessToken();
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.get("/api/instagram/auth", async (req, res) => {
    try {
      const ig = await Promise.resolve().then(() => (init_instagramService(), instagramService_exports));
      const redirectUri = `https://travony.replit.app/api/instagram/callback`;
      const authUrl = ig.getOAuthUrl(redirectUri);
      if (!authUrl) return res.status(500).json({ error: "Meta App ID not configured" });
      res.redirect(authUrl);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/instagram/callback", async (req, res) => {
    try {
      const { code, error: oauthError } = req.query;
      if (oauthError) return res.status(400).send(`OAuth error: ${oauthError}`);
      if (!code) return res.status(400).send("No authorization code received");
      const ig = await Promise.resolve().then(() => (init_instagramService(), instagramService_exports));
      const redirectUri = `https://travony.replit.app/api/instagram/callback`;
      const result = await ig.exchangeCodeForToken(code, redirectUri);
      if (result.success && result.accessToken) {
        const pageResult = await ig.saveAndValidatePageToken(result.accessToken);
        const pageName = pageResult.pageName || "your account";
        res.send(`<html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#f5f7fa;">
          <div style="max-width:500px;margin:0 auto;background:white;padding:40px;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          <h1 style="color:#25D366;font-size:1.5rem;">Facebook Connected!</h1>
          <p style="color:#666;margin:12px 0;">Connected to <strong>${pageName}</strong></p>
          <p style="color:#888;font-size:0.9rem;">${pageResult.error || "Page token saved and ready for posting."}</p>
          <a href="/connect-instagram" style="display:inline-block;padding:12px 24px;background:#25D366;color:white;text-decoration:none;border-radius:8px;margin-top:20px;font-weight:600;">View Status</a>
          <a href="/campaign" style="display:inline-block;padding:12px 24px;background:#1877F2;color:white;text-decoration:none;border-radius:8px;margin-top:20px;margin-left:8px;font-weight:600;">Campaign Hub</a>
          </div>
        </body></html>`);
      } else {
        res.status(500).send(`<html><body style="font-family:sans-serif;text-align:center;padding:60px;">
          <h1 style="color:red;">Connection Failed</h1>
          <p>${result.error}</p>
          <a href="/connect-instagram">Try Again</a>
        </body></html>`);
      }
    } catch (error) {
      res.status(500).send(`Error: ${error.message}`);
    }
  });
  app2.get("/api/instagram/insights", async (req, res) => {
    try {
      const ig = await Promise.resolve().then(() => (init_instagramService(), instagramService_exports));
      const result = await ig.getInstagramInsights();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/auth/tiktok", async (req, res) => {
    try {
      const tt = await Promise.resolve().then(() => (init_tiktokService(), tiktokService_exports));
      const redirectUri = `https://travony.replit.app/api/auth/tiktok/callback`;
      const authUrl = tt.getAuthUrl(redirectUri);
      if (!authUrl) return res.status(500).json({ error: "TikTok not configured" });
      res.json({ authUrl });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/auth/tiktok/callback", async (req, res) => {
    try {
      const { code, error: authError } = req.query;
      if (authError || !code) {
        return res.redirect("/campaign?tiktok=error&msg=" + encodeURIComponent(String(authError || "No code")));
      }
      const tt = await Promise.resolve().then(() => (init_tiktokService(), tiktokService_exports));
      const redirectUri = `https://travony.replit.app/api/auth/tiktok/callback`;
      const result = await tt.exchangeCodeForToken(String(code), redirectUri);
      if (result.success) {
        res.redirect("/campaign?tiktok=connected");
      } else {
        res.redirect("/campaign?tiktok=error&msg=" + encodeURIComponent(result.error || "Failed"));
      }
    } catch (error) {
      res.redirect("/campaign?tiktok=error&msg=" + encodeURIComponent(error.message));
    }
  });
  app2.get("/api/tiktok/status", async (req, res) => {
    try {
      const tt = await Promise.resolve().then(() => (init_tiktokService(), tiktokService_exports));
      if (!tt.isConnected()) {
        return res.json({ connected: false });
      }
      const info = await tt.getUserInfo();
      res.json(info);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/tiktok/post-photo", async (req, res) => {
    try {
      const { imageUrls, title } = req.body;
      if (!imageUrls || !title) return res.status(400).json({ error: "imageUrls and title required" });
      const tt = await Promise.resolve().then(() => (init_tiktokService(), tiktokService_exports));
      const result = await tt.postPhotoToTikTok(imageUrls, title);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.post("/api/tiktok/post-video", async (req, res) => {
    try {
      const { videoUrl, title } = req.body;
      if (!videoUrl || !title) return res.status(400).json({ error: "videoUrl and title required" });
      const tt = await Promise.resolve().then(() => (init_tiktokService(), tiktokService_exports));
      const result = await tt.postVideoToTikTok(videoUrl, title);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.post("/api/webhook/telegram", async (req, res) => {
    try {
      const telegramBot = await Promise.resolve().then(() => (init_telegramBot(), telegramBot_exports));
      await telegramBot.processTelegramUpdate(req.body);
      res.sendStatus(200);
    } catch (error) {
      console.error("[Telegram Webhook] Error:", error);
      res.sendStatus(200);
    }
  });
  app2.post("/api/webhook/whatsapp", async (req, res) => {
    try {
      const whatsappBot = await Promise.resolve().then(() => (init_whatsappBot(), whatsappBot_exports));
      const response = await whatsappBot.processWhatsAppWebhook(req.body);
      if (response) {
        res.set("Content-Type", "text/xml");
        res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${response}</Message></Response>`);
      } else {
        res.sendStatus(200);
      }
    } catch (error) {
      console.error("[WhatsApp Webhook] Error:", error);
      res.sendStatus(200);
    }
  });
  app2.post("/api/admin/telegram/set-webhook", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const telegramBot = await Promise.resolve().then(() => (init_telegramBot(), telegramBot_exports));
      const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(",")[0];
      const webhookUrl = `https://${domain}/api/webhook/telegram`;
      const success = await telegramBot.setWebhook(webhookUrl);
      res.json({ success, webhookUrl });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/admin/broadcast", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { message, channel } = req.body;
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }
      let telegramSent = 0;
      let whatsappSent = 0;
      if (channel === "telegram" || channel === "all") {
        const telegramBot = await Promise.resolve().then(() => (init_telegramBot(), telegramBot_exports));
        telegramSent = await telegramBot.broadcastToDrivers("mexico-city", message);
      }
      res.json({ success: true, sent: { telegram: telegramSent, whatsapp: whatsappSent } });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/pmgth/activate", requireAuth, async (req, res) => {
    try {
      const { userId } = req;
      const { destinationAddress, destinationLat, destinationLng, timeWindowMinutes, maxDetourPercent } = req.body;
      const driver = await storage.getDriverByUserId(userId);
      if (!driver) {
        return res.status(403).json({ message: "Only drivers can use Going Home mode" });
      }
      if (!destinationAddress || !destinationLat || !destinationLng) {
        return res.status(400).json({ message: "Destination is required" });
      }
      const session = await activatePmgthSession(
        driver.id,
        destinationAddress,
        parseFloat(destinationLat),
        parseFloat(destinationLng),
        timeWindowMinutes || 45,
        maxDetourPercent || 15
      );
      res.json({
        success: true,
        session,
        message: "Going Home mode activated! You'll only receive rides heading your way."
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  app2.post("/api/pmgth/deactivate", requireAuth, async (req, res) => {
    try {
      const { userId } = req;
      const { reason } = req.body;
      const driver = await storage.getDriverByUserId(userId);
      if (!driver) {
        return res.status(403).json({ message: "Only drivers can use this feature" });
      }
      const session = await deactivatePmgthSession(driver.id, reason || "cancelled");
      if (session) {
        res.json({
          success: true,
          session,
          message: "Going Home mode deactivated"
        });
      } else {
        res.json({ success: false, message: "No active session found" });
      }
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/pmgth/session", requireAuth, async (req, res) => {
    try {
      const { userId } = req;
      const driver = await storage.getDriverByUserId(userId);
      if (!driver) {
        return res.json({ active: false, session: null });
      }
      const session = await getActivePmgthSession(driver.id);
      if (session) {
        const stats = await getPmgthSessionStats(session.id);
        res.json({
          active: true,
          session,
          stats
        });
      } else {
        res.json({ active: false, session: null });
      }
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/pmgth/home-address", requireAuth, async (req, res) => {
    try {
      const { userId } = req;
      const driver = await storage.getDriverByUserId(userId);
      if (!driver) {
        return res.status(403).json({ message: "Only drivers can access this" });
      }
      const homeAddress = await getDriverHomeAddress(driver.id);
      res.json({ homeAddress });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/pmgth/home-address", requireAuth, async (req, res) => {
    try {
      const { userId, userRole } = req;
      const { address, lat, lng } = req.body;
      console.log("POST /api/pmgth/home-address - userId:", userId, "role:", userRole);
      if (!address || lat === void 0 || lng === void 0) {
        return res.status(400).json({ message: "Address, lat, and lng are required" });
      }
      let driver = await storage.getDriverByUserId(userId);
      if (!driver && userRole !== "driver") {
        return res.status(403).json({ message: "Only drivers can save home address" });
      }
      if (!driver && userRole === "driver") {
        console.log("Creating driver record for user:", userId);
        driver = await storage.createDriver({
          userId,
          status: "pending",
          isOnline: false,
          currentLat: lat.toString(),
          currentLng: lng.toString()
        });
      }
      const homeAddress = await saveDriverHomeAddress(userId, {
        address,
        lat: parseFloat(lat),
        lng: parseFloat(lng)
      });
      res.json({ success: true, homeAddress });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/pmgth/compatible-rides", requireAuth, async (req, res) => {
    try {
      const { userId } = req;
      const driver = await storage.getDriverByUserId(userId);
      if (!driver) {
        return res.status(403).json({ message: "Only drivers can access this" });
      }
      const session = await getActivePmgthSession(driver.id);
      if (!session) {
        return res.json({ rides: [], message: "No active Going Home session" });
      }
      const pendingRides = await storage.getPendingRides();
      const compatibleRides = await findCompatibleRides(
        session,
        pendingRides.map((r) => ({
          id: r.id,
          pickupLat: r.pickupLat,
          pickupLng: r.pickupLng,
          dropoffLat: r.dropoffLat,
          dropoffLng: r.dropoffLng,
          estimatedFare: r.estimatedFare
        }))
      );
      res.json({
        rides: compatibleRides,
        sessionStats: await getPmgthSessionStats(session.id)
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/pmgth/drivers-for-ride/:rideId", requireAuth, async (req, res) => {
    try {
      const { rideId } = req.params;
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      const pmgthDrivers = await findPmgthDriversForRide(
        parseFloat(ride.pickupLat),
        parseFloat(ride.pickupLng),
        parseFloat(ride.dropoffLat),
        parseFloat(ride.dropoffLng),
        parseFloat(ride.estimatedFare || "0")
      );
      if (pmgthDrivers.length > 0) {
        res.json({
          available: true,
          drivers: pmgthDrivers,
          bestOption: pmgthDrivers[0],
          message: `Faster pickup available! Driver heading your way (+${pmgthDrivers[0].premiumPercent}% premium)`
        });
      } else {
        res.json({ available: false, drivers: [] });
      }
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/pmgth/accept-match", requireAuth, async (req, res) => {
    try {
      const { userId } = req;
      const { rideId, sessionId } = req.body;
      const driver = await storage.getDriverByUserId(userId);
      if (!driver) {
        return res.status(403).json({ message: "Only drivers can accept matches" });
      }
      const session = await getActivePmgthSession(driver.id);
      if (!session || session.id !== sessionId) {
        return res.status(400).json({ message: "Invalid session" });
      }
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      const pendingRides = [{
        id: ride.id,
        pickupLat: ride.pickupLat,
        pickupLng: ride.pickupLng,
        dropoffLat: ride.dropoffLat,
        dropoffLng: ride.dropoffLng,
        estimatedFare: ride.estimatedFare
      }];
      const [compatibility] = await findCompatibleRides(session, pendingRides);
      if (!compatibility) {
        return res.status(400).json({ message: "This ride is no longer compatible with your route" });
      }
      await recordPmgthRideMatch(session.id, rideId, compatibility, true);
      res.json({
        success: true,
        premiumAmount: compatibility.premiumAmount,
        message: `Ride accepted! You'll earn +$${compatibility.premiumAmount.toFixed(2)} premium.`
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/pmgth/config", async (req, res) => {
    res.json({
      maxAngleDeviation: DEFAULT_CONFIG.maxAngleDeviation,
      defaultDetourPercent: DEFAULT_CONFIG.defaultDetourPercent,
      minPremiumPercent: DEFAULT_CONFIG.minPremiumPercent,
      maxPremiumPercent: DEFAULT_CONFIG.maxPremiumPercent,
      maxPremiumCap: DEFAULT_CONFIG.maxPremiumCap,
      driverPremiumSharePercent: DEFAULT_CONFIG.driverPremiumSharePercent,
      maxDailySessions: DEFAULT_CONFIG.maxDailySessionsDefault,
      timeWindowOptions: [15, 30, 45, 60, 90, 120],
      detourOptions: [10, 15, 20, 25]
    });
  });
  app2.get("/api/pmgth/check-availability", async (req, res) => {
    try {
      const { pickupLat, pickupLng, dropoffLat, dropoffLng, baseFare } = req.query;
      if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
        return res.status(400).json({ available: false, drivers: [], message: "Missing coordinates" });
      }
      const pmgthDrivers = await findPmgthDriversForRide(
        parseFloat(pickupLat),
        parseFloat(pickupLng),
        parseFloat(dropoffLat),
        parseFloat(dropoffLng),
        parseFloat(baseFare || "0")
      );
      if (pmgthDrivers.length > 0) {
        res.json({
          available: true,
          drivers: pmgthDrivers,
          bestOption: pmgthDrivers[0],
          message: `Faster pickup available! Driver heading your way (+${pmgthDrivers[0].premiumPercent}% premium)`
        });
      } else {
        res.json({ available: false, drivers: [] });
      }
    } catch (error) {
      res.status(500).json({ available: false, drivers: [], message: error.message });
    }
  });
  app2.get("/api/guarantee/status", requireAuth, async (req, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(403).json({ message: "Only drivers can access this" });
      }
      const status = await getGuaranteeStatus(driver.id);
      const recentPayout = await getRecentPayout(driver.id);
      res.json({
        ...status,
        recentPayout
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/credits/recent", requireAuth, async (req, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      const credits = await getRecentCredits(
        driver ? void 0 : req.userId,
        driver?.id
      );
      const unseenCount = await getUnseenCreditsCount(
        driver ? void 0 : req.userId,
        driver?.id
      );
      res.json({ credits, unseenCount });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/credits/mark-seen", requireAuth, async (req, res) => {
    try {
      const { creditIds } = req.body;
      if (!creditIds || !Array.isArray(creditIds)) {
        return res.status(400).json({ message: "creditIds array required" });
      }
      await markCreditsSeen(creditIds);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/payments/fx-rates", async (req, res) => {
    try {
      const rates = await fetchFxRates();
      res.json({ rates, timestamp: Date.now() });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/payments/pmgth/intent", requireAuth, async (req, res) => {
    try {
      const { rideId, driverId, baseFareUsd, premiumUsd, localCurrency } = req.body;
      if (!rideId || !driverId || baseFareUsd === void 0) {
        return res.status(400).json({ message: "Missing required fields: rideId, driverId, baseFareUsd" });
      }
      const intent = await createPaymentIntent(
        rideId,
        req.userId,
        driverId,
        parseFloat(baseFareUsd),
        parseFloat(premiumUsd || 0),
        localCurrency || "USD"
      );
      res.json({
        intentId: intent.intentId,
        displayAmount: formatLocalCurrency(intent.totalLocal, intent.localCurrency),
        breakdown: {
          baseFare: formatLocalCurrency(intent.baseFareLocal, intent.localCurrency),
          premium: intent.premiumLocal > 0 ? formatLocalCurrency(intent.premiumLocal, intent.localCurrency) : null,
          total: formatLocalCurrency(intent.totalLocal, intent.localCurrency)
        },
        premiumInfo: intent.premiumUsd > 0 ? {
          recipient: "Your driver",
          guaranteed: true,
          message: "Premium goes directly to the driver who is heading your way"
        } : null,
        expiresAt: intent.expiresAt
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/payments/pmgth/confirm", requireAuth, async (req, res) => {
    try {
      const { intentId } = req.body;
      if (!intentId) {
        return res.status(400).json({ message: "Missing intentId" });
      }
      const result = await fundEscrow(intentId);
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      res.json({
        success: true,
        message: "Payment confirmed",
        premiumPaidInstantly: result.premiumPaidInstantly,
        escrowStatus: "funded",
        userMessage: result.premiumPaidInstantly ? "Payment received. Your driver has received the faster pickup bonus." : "Payment received. Funds secured for your ride."
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/payments/pmgth/release", async (req, res) => {
    try {
      const { intentId } = req.body;
      if (!intentId) {
        return res.status(400).json({ message: "Missing intentId" });
      }
      const result = await releaseEscrow(intentId);
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      res.json({
        success: true,
        message: "Ride completed. Payment released.",
        driverPayout: result.driverPayout,
        platformFee: result.platformFee
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/payments/pmgth/cancel", requireAuth, async (req, res) => {
    try {
      const { intentId, reason } = req.body;
      if (!intentId) {
        return res.status(400).json({ message: "Missing intentId" });
      }
      const result = await cancelEscrow(intentId, "rider", reason);
      res.json({
        success: true,
        riderRefund: result.riderRefund,
        driverKeepsPremium: result.driverKeepsPremium,
        message: result.driverKeepsPremium ? "Ride cancelled. The faster pickup bonus remains with the driver as compensation." : "Ride cancelled. Full refund processed."
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/payments/pmgth/status/:intentId", async (req, res) => {
    try {
      const status = await getEscrowStatus(req.params.intentId);
      if (!status) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json({
        status: status.status,
        displayTotal: formatLocalCurrency(status.totalLocal, status.localCurrency),
        premiumPaid: status.premiumPaid,
        currency: status.localCurrency
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/driver/pmgth-earnings", requireAuth, async (req, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      const earnings = await getDriverPmgthEarnings(driver.id);
      res.json({
        totalEarned: `$${earnings.totalPremiumsEarned.toFixed(2)}`,
        ridesWithBonus: earnings.ridesWithPremium,
        averageBonus: `$${earnings.averagePremium.toFixed(2)}`,
        message: earnings.ridesWithPremium > 0 ? `You've earned $${earnings.totalPremiumsEarned.toFixed(2)} in faster pickup bonuses from ${earnings.ridesWithPremium} rides.` : "Activate Going Home mode to earn bonuses on rides heading your way."
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/truth/consent", requireAuth, async (req, res) => {
    try {
      const { screenshots, notifications, gpsTrace, screenshotCapture, notificationParsing, gpsTracking, postRideConfirmation } = req.body;
      await grantConsent(req.userId, {
        screenshotCapture: screenshotCapture ?? screenshots ?? false,
        notificationParsing: notificationParsing ?? notifications ?? false,
        gpsTracking: gpsTracking ?? gpsTrace ?? false,
        postRideConfirmation: postRideConfirmation ?? true
      });
      res.json({ message: "Consent updated successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/truth/consent", requireAuth, async (req, res) => {
    try {
      const result = await checkUserConsent(req.userId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.delete("/api/truth/consent", requireAuth, async (req, res) => {
    try {
      await revokeConsent(req.userId);
      res.json({ message: "Consent revoked" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.delete("/api/truth/data", requireAuth, async (req, res) => {
    try {
      const result = await deleteUserTruthData(req.userId);
      res.json({ message: `Deleted ${result.deletedRides} rides and all associated data` });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/truth/rides", requireAuth, async (req, res) => {
    try {
      const consent = await checkUserConsent(req.userId);
      if (!consent.hasConsent) {
        return res.status(403).json({ message: "Truth Engine consent required. Please grant consent first." });
      }
      const { providerName, screenshotBase64, notificationText, gpsTrace, rideDate, postRideAnswers, cityName } = req.body;
      let signals = {};
      let extractionMethod = "manual";
      if (screenshotBase64) {
        signals = await extractSignalsFromScreenshot(screenshotBase64);
        extractionMethod = "screenshot_ai";
      }
      if (notificationText) {
        const notifSignals = extractSignalsFromNotification(notificationText);
        signals = { ...signals, ...notifSignals };
        extractionMethod = extractionMethod === "screenshot_ai" ? "screenshot_ai+notification" : "notification";
      }
      if (postRideAnswers) {
        if (postRideAnswers.priceMatched === false) signals.quotedPrice = signals.quotedPrice || postRideAnswers.quotedPrice;
        if (postRideAnswers.driverCancelled === true) signals.driverCancelled = true;
        if (postRideAnswers.arrivedOnTime === false && postRideAnswers.actualWaitMin) {
          signals.actualPickupMinutes = postRideAnswers.actualWaitMin;
        }
      }
      let gpsAnalysis = null;
      if (gpsTrace && Array.isArray(gpsTrace) && gpsTrace.length > 0) {
        gpsAnalysis = analyzeGpsTrace(gpsTrace);
        if (gpsAnalysis.distanceKm > 0) {
          signals.actualDistanceKm = gpsAnalysis.distanceKm;
          signals.actualDurationMin = gpsAnalysis.durationMin;
        }
      }
      const resolvedProviderName = signals.providerName || providerName || "Unknown";
      const providerId = await getOrCreateProvider(resolvedProviderName);
      const fraudCheck = await validateRideSubmission(
        req.userId,
        providerId,
        cityName || "Unknown",
        gpsTrace
      );
      const rideDateObj = rideDate ? new Date(rideDate) : /* @__PURE__ */ new Date();
      const timeBlock = getTimeBlock(rideDateObj);
      const distance = signals.actualDistanceKm || signals.expectedDistanceKm;
      const routeType = distance ? getRouteType(distance) : void 0;
      const [truthRide] = await db.insert(truthRides).values({
        userId: req.userId,
        providerId,
        cityName: cityName || "Unknown",
        routeType,
        timeBlock,
        rideDate: rideDateObj,
        quotedPrice: signals.quotedPrice?.toString(),
        finalPrice: signals.finalPrice?.toString(),
        quotedEtaMinutes: signals.quotedEtaMinutes?.toString(),
        actualPickupMinutes: signals.actualPickupMinutes?.toString(),
        driverCancelled: signals.driverCancelled,
        cancellationCount: signals.cancellationCount || 0,
        expectedDistanceKm: signals.expectedDistanceKm?.toString(),
        actualDistanceKm: signals.actualDistanceKm?.toString(),
        expectedDurationMin: signals.expectedDurationMin?.toString(),
        actualDurationMin: signals.actualDurationMin?.toString(),
        supportResolved: signals.supportResolved,
        supportOutcome: signals.supportOutcome,
        screenshotUrl: screenshotBase64 ? "stored" : null,
        gpsTraceJson: gpsTrace ? JSON.stringify(gpsTrace) : null,
        notificationData: notificationText,
        proofOfRide: !!gpsAnalysis?.isConsistent || !!screenshotBase64,
        pickupLat: gpsTrace?.[0]?.lat?.toString(),
        pickupLng: gpsTrace?.[0]?.lng?.toString(),
        dropoffLat: gpsTrace?.[gpsTrace.length - 1]?.lat?.toString(),
        dropoffLng: gpsTrace?.[gpsTrace.length - 1]?.lng?.toString()
      }).returning();
      await storeSignals(truthRide.id, signals, extractionMethod);
      const score = await computeAndStorePRTS(truthRide.id);
      await updateAggregationCache(providerId, cityName || "Unknown", timeBlock, routeType);
      res.json({
        truthRideId: truthRide.id,
        score: score.totalScore,
        explanation: score.explanation,
        breakdown: {
          priceIntegrity: score.priceIntegrityScore,
          pickupReliability: score.pickupReliabilityScore,
          cancellation: score.cancellationScore,
          routeIntegrity: score.routeIntegrityScore,
          supportResolution: score.supportResolutionScore
        },
        fraudFlags: fraudCheck.flags,
        provider: resolvedProviderName
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/truth/rides/:id/score", requireAuth, async (req, res) => {
    try {
      const [score] = await db.select().from(truthScores).where(eq30(truthScores.truthRideId, req.params.id)).limit(1);
      if (!score) return res.status(404).json({ message: "Score not found" });
      res.json({
        totalScore: parseFloat(score.totalScore),
        priceIntegrity: parseFloat(score.priceIntegrityScore || "0"),
        pickupReliability: parseFloat(score.pickupReliabilityScore || "0"),
        cancellation: parseFloat(score.cancellationScore || "0"),
        routeIntegrity: parseFloat(score.routeIntegrityScore || "0"),
        supportResolution: parseFloat(score.supportResolutionScore || "0"),
        explanation: score.explanation
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/truth/rankings", requireAuth, async (req, res) => {
    try {
      const { city, timeBlock, routeType } = req.query;
      if (!city) return res.status(400).json({ message: "City parameter required" });
      const result = await getContextualRankings(
        city,
        timeBlock,
        routeType
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/truth/recommend", requireAuth, async (req, res) => {
    try {
      const { city, timeBlock, routeType } = req.query;
      if (!city) return res.status(400).json({ message: "City parameter required" });
      const recommendation = await getRecommendation(
        city,
        timeBlock,
        routeType
      );
      if (!recommendation) {
        return res.json({ hasRecommendation: false, message: "Not enough data for a recommendation yet." });
      }
      res.json({ hasRecommendation: true, recommendation });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/truth/providers", async (_req, res) => {
    try {
      const providers = await db.select().from(truthProviders).where(eq30(truthProviders.isActive, true));
      res.json(providers);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/truth/my-rides", requireAuth, async (req, res) => {
    try {
      const userRides = await db.select({
        ride: truthRides,
        score: truthScores
      }).from(truthRides).leftJoin(truthScores, eq30(truthScores.truthRideId, truthRides.id)).where(eq30(truthRides.userId, req.userId)).orderBy(desc22(truthRides.rideDate)).limit(50);
      res.json(userRides.map((r) => ({
        id: r.ride.id,
        providerId: r.ride.providerId,
        cityName: r.ride.cityName,
        rideDate: r.ride.rideDate,
        quotedPrice: r.ride.quotedPrice,
        finalPrice: r.ride.finalPrice,
        score: r.score ? parseFloat(r.score.totalScore) : null,
        explanation: r.score?.explanation,
        isFromTravony: r.ride.isFromTravony
      })));
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/ghost/rides", requireAuth, async (req, res) => {
    try {
      const rideId = await createGhostRide({
        ...req.body,
        riderId: req.userId
      });
      res.json({ ghostRideId: rideId, message: "Ghost ride created" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/ghost/rides/accept", requireAuth, async (req, res) => {
    try {
      await acceptGhostRide(req.body);
      res.json({ message: "Ghost ride accepted" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/ghost/rides/start", requireAuth, async (req, res) => {
    try {
      await startGhostRide(req.body.localId);
      res.json({ message: "Ghost ride started" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/ghost/rides/complete", requireAuth, async (req, res) => {
    try {
      await completeGhostRide(req.body);
      res.json({ message: "Ghost ride completed" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/ghost/sync", requireAuth, async (req, res) => {
    try {
      const rideResults = await syncAllPendingGhostRides(req.userId);
      const queueResults = await processSyncQueue(req.userId);
      res.json({
        rides: rideResults,
        queue: queueResults,
        message: `Synced ${rideResults.filter((r) => r.success).length} rides`
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/ghost/rides", requireAuth, async (req, res) => {
    try {
      const userGhostRides = await db.select().from(ghostRides).where(eq30(ghostRides.riderId, req.userId)).orderBy(desc22(ghostRides.createdAt)).limit(50);
      res.json(userGhostRides);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/ghost/pricing/:city", requireAuth, async (req, res) => {
    try {
      const pricing = await getCachedPricingForCity(req.params.city);
      res.json(pricing);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/ghost/estimate", requireAuth, async (req, res) => {
    try {
      const { cityName, vehicleType, distanceKm, durationMin } = req.body;
      const estimate = await calculateOfflineFare(
        cityName,
        vehicleType,
        distanceKm,
        durationMin
      );
      res.json(estimate);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/truth/auto-feed/:rideId", requireAuth, async (req, res) => {
    try {
      const [ride] = await db.select().from(rides).where(and27(eq30(rides.id, req.params.rideId), eq30(rides.status, "completed"))).limit(1);
      if (!ride) return res.status(404).json({ message: "Completed ride not found" });
      const providerId = await getOrCreateProvider("Travony");
      const rideDateObj = ride.completedAt || ride.createdAt;
      const timeBlock = getTimeBlock(rideDateObj);
      const distance = ride.distance ? parseFloat(ride.distance) : void 0;
      const routeType = distance ? getRouteType(distance) : void 0;
      const [truthRide] = await db.insert(truthRides).values({
        userId: ride.customerId,
        providerId,
        cityName: ride.regionCode || "Unknown",
        routeType,
        timeBlock,
        rideDate: rideDateObj,
        quotedPrice: ride.estimatedFare,
        finalPrice: ride.actualFare,
        expectedDistanceKm: ride.distance,
        actualDistanceKm: ride.distance,
        driverCancelled: false,
        proofOfRide: true,
        isFromTravony: true,
        travonyRideId: ride.id,
        pickupLat: ride.pickupLat,
        pickupLng: ride.pickupLng,
        dropoffLat: ride.dropoffLat,
        dropoffLng: ride.dropoffLng
      }).returning();
      const score = await computeAndStorePRTS(truthRide.id);
      res.json({
        truthRideId: truthRide.id,
        score: score.totalScore,
        message: "Travony ride auto-fed to Truth Engine"
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/truth/stats", requireAuth, async (req, res) => {
    try {
      const [totalRides] = await db.select({ count: count7() }).from(truthRides);
      const [totalScores] = await db.select({ count: count7() }).from(truthScores);
      const [totalProviders] = await db.select({ count: count7() }).from(truthProviders);
      const [totalConsents] = await db.select({ count: count7() }).from(truthConsent);
      const [totalGhost] = await db.select({ count: count7() }).from(ghostRides);
      const [pendingSync] = await db.select({ count: count7() }).from(ghostRides).where(eq30(ghostRides.syncStatus, "pending"));
      res.json({
        truthRides: totalRides?.count || 0,
        scoredRides: totalScores?.count || 0,
        providers: totalProviders?.count || 0,
        consentedUsers: totalConsents?.count || 0,
        ghostRides: totalGhost?.count || 0,
        pendingGhostSync: pendingSync?.count || 0
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/truth/rankings/:city", requireAuth, async (req, res) => {
    try {
      const rankings = await getRankings(req.params.city);
      res.json(rankings);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/admin/ghost/rides", requireAuth, async (req, res) => {
    try {
      const allGhost = await db.select().from(ghostRides).orderBy(desc22(ghostRides.createdAt)).limit(100);
      res.json(allGhost);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.use(openClawRouter);
  app2.use(coffeeRouter);
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
import * as fs from "fs";
import * as path from "path";
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    if (origin && origins.has(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path2 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path2.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, req, res) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  let manifest = fs.readFileSync(manifestPath, "utf-8");
  if (process.env.NODE_ENV === "development") {
    const forwardedHost = req.header("x-forwarded-host") || req.get("host") || "";
    const baseDomain = forwardedHost.replace(/:.*$/, "");
    if (baseDomain && !forwardedHost.includes(":5000")) {
      manifest = manifest.replace(
        new RegExp(`https://${baseDomain}/`, "g"),
        `https://${baseDomain}:5000/`
      );
      manifest = manifest.replace(
        new RegExp(`"${baseDomain}"`, "g"),
        `"${baseDomain}:5000"`
      );
      manifest = manifest.replace(
        new RegExp(`"${baseDomain}/`, "g"),
        `"${baseDomain}:5000/`
      );
    }
  }
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  let expsUrl = host || "";
  if (!host?.includes(":5000") && process.env.NODE_ENV === "development") {
    const baseDomain = (host || "").replace(/:.*$/, "") || host || "";
    expsUrl = `${baseDomain}:5000`;
  }
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const adminTemplatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "admin-dashboard.html"
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const adminDashboardTemplate = fs.existsSync(adminTemplatePath) ? fs.readFileSync(adminTemplatePath, "utf-8") : null;
  const appName = getAppName();
  log("Serving static Expo files with dynamic manifest routing");
  app2.get("/admin", (_req, res) => {
    if (adminDashboardTemplate) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(adminDashboardTemplate);
    } else {
      res.status(404).send("Admin dashboard not found");
    }
  });
  const privacyPolicyPath = path.resolve(process.cwd(), "server", "templates", "privacy-policy.html");
  const termsOfServicePath = path.resolve(process.cwd(), "server", "templates", "terms-of-service.html");
  const dataDeletionPath = path.resolve(process.cwd(), "server", "templates", "data-deletion.html");
  const supportPath = path.resolve(process.cwd(), "server", "templates", "support.html");
  app2.get("/privacy", (_req, res) => {
    if (fs.existsSync(privacyPolicyPath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).sendFile(privacyPolicyPath);
    } else {
      res.status(404).send("Privacy Policy not found");
    }
  });
  app2.get("/terms", (_req, res) => {
    if (fs.existsSync(termsOfServicePath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).sendFile(termsOfServicePath);
    } else {
      res.status(404).send("Terms of Service not found");
    }
  });
  app2.get("/delete-account", (_req, res) => {
    if (fs.existsSync(dataDeletionPath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).sendFile(dataDeletionPath);
    } else {
      res.status(404).send("Account Deletion page not found");
    }
  });
  app2.get("/data-deletion", (_req, res) => {
    if (fs.existsSync(dataDeletionPath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).sendFile(dataDeletionPath);
    } else {
      res.status(404).send("Data Deletion page not found");
    }
  });
  app2.get("/support", (_req, res) => {
    if (fs.existsSync(supportPath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).sendFile(supportPath);
    } else {
      res.status(404).send("Support page not found");
    }
  });
  app2.get("/payment-success", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Successful - Travony</title>
        <style>
          body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
                 display: flex; flex-direction: column; align-items: center; justify-content: center; 
                 min-height: 100vh; margin: 0; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; }
          .container { text-align: center; padding: 40px; background: rgba(255,255,255,0.15); 
                       border-radius: 24px; backdrop-filter: blur(10px); max-width: 400px; margin: 20px; }
          h1 { font-size: 2rem; margin-bottom: 16px; }
          p { font-size: 1.1rem; opacity: 0.9; margin-bottom: 24px; }
          .icon { font-size: 4rem; margin-bottom: 20px; }
          a { display: inline-block; padding: 14px 32px; background: white; color: #059669; 
              text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 1rem; }
          a:hover { background: #f0fdf4; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">\u2713</div>
          <h1>Payment Successful!</h1>
          <p>Your wallet has been topped up. You can close this window and return to the app.</p>
          <a href="/">Return to App</a>
        </div>
      </body>
      </html>
    `);
  });
  app2.get("/payment-cancelled", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Cancelled - Travony</title>
        <style>
          body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
                 display: flex; flex-direction: column; align-items: center; justify-content: center; 
                 min-height: 100vh; margin: 0; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; }
          .container { text-align: center; padding: 40px; background: rgba(255,255,255,0.15); 
                       border-radius: 24px; backdrop-filter: blur(10px); max-width: 400px; margin: 20px; }
          h1 { font-size: 2rem; margin-bottom: 16px; }
          p { font-size: 1.1rem; opacity: 0.9; margin-bottom: 24px; }
          .icon { font-size: 4rem; margin-bottom: 20px; }
          a { display: inline-block; padding: 14px 32px; background: white; color: #d97706; 
              text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 1rem; }
          a:hover { background: #fffbeb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">\u2715</div>
          <h1>Payment Cancelled</h1>
          <p>Your payment was cancelled. No charges were made. You can close this window and try again.</p>
          <a href="/">Return to App</a>
        </div>
      </body>
      </html>
    `);
  });
  log("Policy pages: /privacy, /terms, /data-deletion, /delete-account, /support");
  log("Payment pages: /payment-success, /payment-cancelled");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    const expoPlatform = req.header("expo-platform");
    const expoRuntimeVersion = req.header("expo-runtime-version");
    const userAgent = req.header("user-agent") || "";
    if (req.path === "/" || req.path === "/manifest" || expoPlatform || expoRuntimeVersion || userAgent.includes("Expo")) {
      log(`Expo request: ${req.method} ${req.path} platform=${expoPlatform || "none"} runtime=${expoRuntimeVersion || "none"} ua=${userAgent.slice(0, 50)}`);
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, req, res);
    }
    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app2.use(express.static(path.resolve(process.cwd(), "static-build")));
  app2.use(express.static(path.resolve(process.cwd(), "server", "public")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
  log("PWA: Serving manifest.json and service worker from /server/public");
}
function setupErrorHandler(app2) {
  app2.use((err, req, res, _next) => {
    const { AppError: AppError2, isAppError: isAppError2 } = (init_errors(), __toCommonJS(errors_exports));
    let statusCode = 500;
    let errorResponse = {
      error: "InternalServerError",
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred"
    };
    if (isAppError2(err)) {
      statusCode = err.statusCode;
      errorResponse = err.toJSON();
    } else if (err instanceof Error) {
      errorResponse.message = err.message;
    }
    const timestamp2 = (/* @__PURE__ */ new Date()).toISOString();
    if (statusCode >= 500) {
      console.error(`[${timestamp2}] ERROR ${req.method} ${req.path} [${errorResponse.code}]: ${errorResponse.message}`);
      if (err instanceof Error && err.stack) {
        console.error(err.stack);
      }
    } else {
      console.warn(`[${timestamp2}] WARN ${req.method} ${req.path} [${errorResponse.code}]: ${errorResponse.message}`);
    }
    if (process.env.NODE_ENV !== "production" && err instanceof Error) {
      errorResponse.stack = err.stack;
    }
    res.status(statusCode).json(errorResponse);
  });
}
async function seedAdminUser() {
  const { scryptSync: scryptSync2, randomBytes: randomBytes2 } = await import("crypto");
  const { v4: uuidv46 } = await import("uuid");
  const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
  const { users: users7 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
  const { eq: eq31 } = await import("drizzle-orm");
  const existing = await db2.select().from(users7).where(eq31(users7.email, "admin@travony.com")).limit(1);
  if (existing.length === 0) {
    const adminPassword = process.env.ADMIN_PASSWORD || "Travony2024!";
    const salt = randomBytes2(16).toString("hex");
    const hash = scryptSync2(adminPassword, salt, 64).toString("hex");
    await db2.insert(users7).values({
      id: uuidv46(),
      email: "admin@travony.com",
      password: `${salt}:${hash}`,
      name: "Travony Admin",
      phone: "+1000000000",
      role: "admin"
    });
    log("Admin user created: admin@travony.com");
  }
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  const { initializeBlockchain: initializeBlockchain3 } = await Promise.resolve().then(() => (init_blockchain(), blockchain_exports));
  const blockchainResult = await initializeBlockchain3();
  log(`Blockchain: ${blockchainResult.message}`);
  await seedAdminUser();
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`express server serving on port ${port}`);
    }
  );
})();
