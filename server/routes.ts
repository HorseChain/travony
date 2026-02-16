import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { findOptimalDrivers, calculateOptimalPrice, getOptimalRideMatch } from "./aiEngine";
import { 
  initializeBlockchain, 
  recordRideToBlockchain, 
  verifyRideOnChain, 
  generateTransparencyReport, 
  getBlockchainStatus,
  calculateFeeBreakdown,
  generateRideHash,
  createRideReceipt
} from "./blockchain";
import { sendRideReceiptEmail, sendDriverEarningsEmail, sendWeeklyFeedbackEmail } from "./email";
import { nowPaymentsService } from "./nowpayments";
import { createRideInvoices } from "./invoiceService";
import { 
  initializeRegions,
  initializeServiceTypes,
  getRegionByCode, 
  getAllRegions, 
  calculateFare, 
  getPhoneCodesList,
  detectRegionFromPhone
} from "./regionService";
import { 
  createAndResolveDispute, 
  recordTelemetry, 
  getDisputesByRide, 
  getDisputesByUser 
} from "./disputeResolver";
import { 
  getQuickReplies, 
  sendRideMessage, 
  getRideMessages, 
  getSupportedLanguages 
} from "./translationService";
import { sendOtp, sendOtpSms, sendVerifyOtp, checkVerifyOtp, isVerifyConfigured, isTwilioConfigured, isWhatsAppConfigured } from "./twilioService";
import {
  initializeMexicoCityLaunch,
  getCityBySlug,
  getAllCities,
  recordDriverIntake,
  uploadDriverDocument,
  getDriverDocuments,
  reviewDocument,
  getVerificationQueue,
  getTrustProtectionStatus,
  getEducationModules,
  getDriverEducationProgress,
  startEducationModule,
  completeEducationModule,
  generateReferralCode,
  createReferral,
  getCityHealth,
  checkChampionEligibility,
  nominateChampion,
  approveChampion,
  getCityChampions,
  updateCityLaunchStatus,
  updateCityGroupLinks,
  getExpansionCities,
  getCityConfig,
} from "./cityOnboardingService";
import * as cityTestService from "./cityTestService";
import * as adminDashboard from "./adminDashboard";
import * as pmgthService from "./pmgthService";
import * as pmgthPayment from "./pmgthPaymentService";
import * as guaranteeService from "./guaranteeService";
import * as accountabilityService from "./accountabilityService";
import * as rematchService from "./rematchService";
import * as incentivePolicy from "./incentivePolicy";
import * as walletService from "./walletService";
import * as intentEngine from "./intentEngine";
import * as cityBrain from "./cityBrain";
import * as antiGamingService from "./antiGamingService";
import { verifyVehicleImage, verifyMultipleVehicleImages, getVehicleCategoryInfo } from "./vehicleVerification";
import * as truthEngine from "./truthEngine";
import * as truthScoring from "./truthScoring";
import * as truthAggregation from "./truthAggregation";
import * as truthRecommendation from "./truthRecommendation";
import * as truthFraud from "./truthFraud";
import * as ghostRideService from "./ghostRideService";
import { openClawRouter } from "./hubRoutes";
import type { Ride } from "@shared/schema";
import { rides, payments, drivers, truthRides, truthScores, truthConsent, truthProviders, ghostRides, ghostMessages, offlineSyncQueue } from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, desc, count } from "drizzle-orm";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const newHash = scryptSync(password, salt, 64).toString("hex");
  // Use timing-safe comparison to prevent timing attacks
  const hashBuffer = Buffer.from(hash, "hex");
  const newHashBuffer = Buffer.from(newHash, "hex");
  if (hashBuffer.length !== newHashBuffer.length) return false;
  return timingSafeEqual(hashBuffer, newHashBuffer);
}

function getDeclineMessage(declineCode: string): string {
  const declineMessages: Record<string, string> = {
    "insufficient_funds": "Your card has insufficient funds. Please use another payment method.",
    "lost_card": "This card has been reported lost. Please use another card.",
    "stolen_card": "This card has been reported stolen. Please use another card.",
    "expired_card": "Your card has expired. Please update your card details.",
    "incorrect_cvc": "The security code (CVC) is incorrect. Please try again.",
    "processing_error": "Payment processing error. Please try again.",
    "incorrect_number": "The card number is incorrect. Please check and try again.",
    "card_velocity_exceeded": "You've exceeded the daily transaction limit on your card.",
    "do_not_honor": "Your bank declined the transaction. Please contact your bank.",
    "generic_decline": "Your card was declined. Please try another payment method.",
    "fraudulent": "This transaction was flagged as suspicious. Please contact your bank.",
    "card_not_supported": "This card type is not supported. Please use a different card.",
    "currency_not_supported": "Your card does not support this currency.",
    "duplicate_transaction": "This looks like a duplicate transaction. Please wait a moment.",
    "try_again_later": "Temporary error. Please try again in a few minutes.",
  };
  return declineMessages[declineCode] || `Payment declined (${declineCode}). Please try another method.`;
}

async function createSession(userId: string, role: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await storage.createSession(token, userId, role, expiresAt);
  return token;
}

async function validateSession(token: string): Promise<{ userId: string; role: string } | null> {
  const session = await storage.getSession(token);
  if (!session) return null;
  if (new Date() > session.expiresAt) {
    await storage.deleteSession(token);
    return null;
  }
  return { userId: session.userId, role: session.role };
}

// Auth middleware
async function requireAuth(req: any, res: any, next: any) {
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

function requireRole(...roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
}

async function requireAdmin(req: any, res: any, next: any) {
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

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/auth/register", async (req, res) => {
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
        id: uuidv4(),
        email,
        password: hashPassword(password),
        name,
        phone: phone || null,
        role: "customer",
      });

      const token = await createSession(user.id, user.role);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
        },
        token,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
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
          role: user.role,
        },
        token,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Login failed" });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req: any, res) => {
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
          role: user.role,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to get user" });
    }
  });

  app.post("/api/auth/guest", async (_req, res) => {
    try {
      const guestId = uuidv4();
      const guestEmail = `guest_${guestId.slice(0, 8)}@travony.local`;

      const user = await storage.createUser({
        id: guestId,
        email: guestEmail,
        name: "Guest User",
        role: "customer",
      });

      const token = await createSession(user.id, user.role);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Guest login failed" });
    }
  });

  // Phone-based OTP authentication (Yango-style quick signup)
  const otpStore = new Map<string, { otp: string; expiresAt: Date; attempts: number }>();
  const pendingRegistrations = new Map<string, { phone: string; expiresAt: Date }>();

  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { phone } = req.body;
      
      if (!phone || phone.length < 10) {
        return res.status(400).json({ message: "Valid phone number is required" });
      }

      // Try Twilio Verify first (works globally, best for production)
      if (isVerifyConfigured()) {
        console.log(`Using Twilio Verify for ${phone}`);
        const verifyResult = await sendVerifyOtp(phone);
        
        if (verifyResult.success) {
          // Store a flag that this phone is using Verify (for verification step)
          otpStore.set(phone, { otp: 'VERIFY', expiresAt: new Date(Date.now() + 10 * 60 * 1000), attempts: 0 });
          
          return res.json({ 
            success: true, 
            message: "Verification code sent via SMS",
            channel: 'verify'
          });
        }
        console.log(`Verify failed for ${phone}, falling back to direct SMS`);
      }

      // Fallback: Generate our own OTP and send via SMS
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      otpStore.set(phone, { otp, expiresAt, attempts: 0 });

      const otpResult = await sendOtp(phone, otp, false); // SMS only, no WhatsApp sandbox
      
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
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to send OTP" });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { phone, otp } = req.body;
      
      if (!phone || !otp) {
        return res.status(400).json({ message: "Phone and OTP are required" });
      }

      // Verify OTP from store
      const storedOtp = otpStore.get(phone);
      
      if (!storedOtp) {
        return res.status(400).json({ message: "No verification code found. Please request a new one." });
      }

      if (new Date() > storedOtp.expiresAt) {
        otpStore.delete(phone);
        return res.status(400).json({ message: "Verification code expired. Please request a new one." });
      }

      storedOtp.attempts += 1;
      if (storedOtp.attempts > 5) {
        otpStore.delete(phone);
        return res.status(429).json({ message: "Too many attempts. Please request a new code." });
      }

      // Check if using Twilio Verify or local OTP
      if (storedOtp.otp === 'VERIFY') {
        // Use Twilio Verify API to check
        const verifyResult = await checkVerifyOtp(phone, otp);
        if (!verifyResult.success) {
          return res.status(400).json({ message: verifyResult.error || "Invalid verification code" });
        }
      } else if (storedOtp.otp !== otp) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      // OTP verified - clean up
      otpStore.delete(phone);

      // Check if user exists with this phone
      const existingUser = await storage.getUserByPhone(phone);
      
      if (existingUser) {
        // Existing user - create session and log them in
        const token = await createSession(existingUser.id, existingUser.role);
        
        res.json({
          success: true,
          isNewUser: false,
          user: {
            id: existingUser.id,
            email: existingUser.email || "",
            name: existingUser.name || "User",
            phone: existingUser.phone,
            role: existingUser.role,
          },
          token,
        });
      } else {
        // New user - create pending registration
        const sessionToken = randomBytes(32).toString("hex");
        pendingRegistrations.set(sessionToken, {
          phone,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        });

        res.json({
          success: true,
          isNewUser: true,
          sessionToken,
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message || "OTP verification failed" });
    }
  });

  app.post("/api/auth/complete-registration", async (req, res) => {
    try {
      const { sessionToken, name, role } = req.body;
      
      if (!sessionToken || !name) {
        return res.status(400).json({ message: "Session token and name are required" });
      }

      const pending = pendingRegistrations.get(sessionToken);
      
      if (!pending) {
        return res.status(400).json({ message: "Invalid or expired session. Please start over." });
      }

      if (new Date() > pending.expiresAt) {
        pendingRegistrations.delete(sessionToken);
        return res.status(400).json({ message: "Session expired. Please start over." });
      }

      // Validate role (only allow customer or driver)
      const validRole = role === "driver" ? "driver" : "customer";

      // Create the user
      const userId = uuidv4();
      const email = `phone_${pending.phone.replace(/\+/g, "").replace(/ /g, "")}@travony.local`;

      const user = await storage.createUser({
        id: userId,
        email,
        name: name.trim(),
        phone: pending.phone,
        role: validRole,
      });

      // Clean up pending registration but keep session token for biometric step
      // Include userId and userRole in the stored object for finalize step
      pendingRegistrations.set(sessionToken, {
        ...pending,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // Extend for biometric setup
      } as any);

      const token = await createSession(user.id, user.role);

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email || "",
          name: user.name || "User",
          phone: user.phone,
          role: user.role,
        },
        token,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Registration failed" });
    }
  });

  app.post("/api/auth/finalize", async (req, res) => {
    try {
      const { sessionToken } = req.body;
      
      if (!sessionToken) {
        return res.status(400).json({ message: "Session token is required" });
      }

      const pending = pendingRegistrations.get(sessionToken);
      
      if (!pending) {
        return res.status(400).json({ message: "Invalid session" });
      }

      const pendingWithUser = pending as any;
      
      if (!pendingWithUser.userId) {
        return res.status(400).json({ message: "User not found in session" });
      }

      // Get user and create session
      const user = await storage.getUser(pendingWithUser.userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const token = await createSession(user.id, user.role);
      
      // Clean up pending registration
      pendingRegistrations.delete(sessionToken);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
        },
        token,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Finalization failed" });
    }
  });

  // Protected route - users can only access their own data
  app.get("/api/users/:id", requireAuth, async (req: any, res) => {
    try {
      // Users can only access their own profile unless admin
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
        role: user.role,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Allowed fields users can update on their own profile
  const ALLOWED_USER_UPDATES = ["name", "phone", "avatar"];
  
  app.patch("/api/users/:id", requireAuth, async (req: any, res) => {
    try {
      // Users can only update their own profile
      if (req.params.id !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Filter allowed fields only (prevent role/wallet manipulation)
      const updates: Record<string, any> = {};
      for (const key of ALLOWED_USER_UPDATES) {
        if (req.body[key] !== undefined) {
          updates[key] = req.body[key];
        }
      }
      
      // Admins can update role
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
        role: user.role,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/rides/:id", async (req, res) => {
    try {
      const ride = await storage.getRide(req.params.id);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      res.json(ride);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/rides", async (req, res) => {
    try {
      const { customerId, driverId } = req.query;
      let rides: Ride[] = [];
      if (customerId) {
        rides = await storage.getRidesByCustomer(customerId as string);
      } else if (driverId) {
        rides = await storage.getRidesByDriver(driverId as string);
      }
      res.json(rides);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/rides", requireAuth, async (req: any, res) => {
    try {
      // Log the incoming ride request for debugging
      console.log("POST /api/rides - serviceTypeId:", req.body.serviceTypeId, "body:", JSON.stringify(req.body).substring(0, 500));
      
      // Users can only create rides for themselves
      if (req.body.customerId && req.body.customerId !== req.userId) {
        return res.status(403).json({ message: "Cannot create ride for another user" });
      }
      
      // Payment validation - ensure rider can pay for the ride
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
      
      // LIVE MODE: Require valid payment method (no free rides)
      if (!paymentMethod) {
        return res.status(400).json({
          code: "PAYMENT_METHOD_REQUIRED",
          message: "Please select a payment method before booking.",
        });
      }
      
      if (paymentMethod === "wallet") {
        const walletBalance = parseFloat(riderUser.walletBalance || "0");
        if (walletBalance < estimatedFareAmount) {
          return res.status(400).json({ 
            code: "INSUFFICIENT_WALLET_BALANCE",
            message: `Insufficient wallet balance. You have AED ${walletBalance.toFixed(2)} but need AED ${estimatedFareAmount.toFixed(2)}. Please top up your wallet first.`,
            walletBalance,
            requiredAmount: estimatedFareAmount,
          });
        }
      } else if (paymentMethod === "usdt") {
        console.log("USDT payment selected - will be processed via NOWPayments at ride end");
      } else if (paymentMethod === "cash") {
        console.log("Cash payment selected - rider will pay driver directly");
      } else {
        return res.status(400).json({
          code: "INVALID_PAYMENT_METHOD",
          message: "Invalid payment method. Please use wallet, USDT, or cash.",
        });
      }
      
      // Validate and normalize serviceTypeId
      if (req.body.serviceTypeId) {
        const validServiceTypes = ["st-economy", "st-comfort", "st-premium", "st-xl"];
        const regionalVehicleTypes = ["cng", "rickshaw", "tuktuk", "moto", "economy", "comfort", "premium", "xl", "minibus"];
        const serviceTypeMap: Record<string, string> = {
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
        
        // If it's already a valid st- format, use it directly
        if (validServiceTypes.includes(req.body.serviceTypeId)) {
          console.log("Valid serviceTypeId:", req.body.serviceTypeId);
        } else if (serviceTypeMap[req.body.serviceTypeId]) {
          // Map regional vehicle types to standard service types
          req.body.serviceTypeId = serviceTypeMap[req.body.serviceTypeId];
          console.log("Mapped serviceTypeId to:", req.body.serviceTypeId);
        } else if (regionalVehicleTypes.includes(req.body.serviceTypeId)) {
          // Default mapping for unknown regional types
          req.body.serviceTypeId = "st-economy";
          console.log("Defaulted regional serviceTypeId to:", req.body.serviceTypeId);
        } else {
          console.error("Invalid serviceTypeId:", req.body.serviceTypeId);
          return res.status(400).json({ message: `Invalid service type: ${req.body.serviceTypeId}` });
        }
      }
      
      const rideId = uuidv4();
      // customerId already declared above for payment validation
      const estimatedFare = parseFloat(req.body.estimatedFare || "0");
      const feeBreakdown = calculateFeeBreakdown(estimatedFare);
      
      // Intent-based matching
      const priority = req.body.priority || "reliable";
      let intentData: any = {};
      
      if (req.body.pickupLat && req.body.pickupLng && req.body.dropoffLat && req.body.dropoffLng) {
        const bestMatch = await intentEngine.getBestAlignedDriver(
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
            aiMatchScore: (bestMatch.alignment.confidence * 100).toFixed(2),
          };
        } else {
          // Fallback: Find nearest online approved driver within 50km (for early launch)
          const pickupLat = parseFloat(req.body.pickupLat);
          const pickupLng = parseFloat(req.body.pickupLng);
          const onlineDrivers = await db.select().from(drivers)
            .where(and(eq(drivers.isOnline, true), eq(drivers.status, 'approved')));
          
          let nearestDriver: any = null;
          let nearestDistance = 50; // Max 50km
          
          for (const driver of onlineDrivers) {
            const driverLat = parseFloat(driver.currentLat || "0");
            const driverLng = parseFloat(driver.currentLng || "0");
            if (driverLat === 0 && driverLng === 0) continue;
            
            // Haversine distance calculation
            const R = 6371;
            const dLat = (pickupLat - driverLat) * Math.PI / 180;
            const dLon = (pickupLng - driverLng) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(driverLat * Math.PI / 180) * Math.cos(pickupLat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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
              aiMatchScore: "0",
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
        timestamp: new Date(),
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
        ...intentData,
      });
      res.json(ride);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Ride updates - require auth with role-based access
  app.patch("/api/rides/:id", requireAuth, async (req: any, res) => {
    try {
      console.log("PATCH /api/rides/:id - Request body:", JSON.stringify(req.body));
      console.log("PATCH /api/rides/:id - User:", req.userId, "Role:", req.userRole);
      const existingRide = await storage.getRide(req.params.id);
      if (!existingRide) {
        return res.status(404).json({ message: "Ride not found" });
      }
      
      // Verify user is customer, assigned driver, or admin
      const isCustomer = existingRide.customerId === req.userId;
      const isAdmin = req.userRole === "admin";
      
      // Check if user is the assigned driver or an approved driver accepting a pending ride
      let isDriver = false;
      let driverRecord: any = null;
      if (req.userRole === "driver") {
        driverRecord = await storage.getDriverByUserId(req.userId);
        // Driver is either assigned to this ride OR accepting a pending ride
        const isAssignedDriver = driverRecord?.id === existingRide.driverId;
        const canAcceptPendingRide = existingRide.status === "pending" && 
                                     !existingRide.driverId && 
                                     driverRecord?.status === "approved" &&
                                     req.body.status === "accepted";
        isDriver = isAssignedDriver || canAcceptPendingRide;
      }
      
      if (!isCustomer && !isDriver && !isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Restrict what fields customers can update vs drivers
      const allowedUpdates: Record<string, any> = {};
      if (isCustomer && !isDriver && !isAdmin) {
        // Customers can only cancel their ride
        if (req.body.status === "cancelled") {
          allowedUpdates.status = "cancelled";
        }
      } else if (isDriver || isAdmin) {
        // Drivers and admins can update more fields
        Object.assign(allowedUpdates, req.body);
        
        // Convert date strings to Date objects for Drizzle timestamp columns
        if (allowedUpdates.completedAt && typeof allowedUpdates.completedAt === 'string') {
          allowedUpdates.completedAt = new Date(allowedUpdates.completedAt);
        }
        if (allowedUpdates.cancelledAt && typeof allowedUpdates.cancelledAt === 'string') {
          allowedUpdates.cancelledAt = new Date(allowedUpdates.cancelledAt);
        }
        if (allowedUpdates.startedAt && typeof allowedUpdates.startedAt === 'string') {
          allowedUpdates.startedAt = new Date(allowedUpdates.startedAt);
        }
        
        // If driver is accepting a pending ride, assign themselves to it
        if (driverRecord && existingRide.status === "pending" && req.body.status === "accepted") {
          allowedUpdates.driverId = driverRecord.id;
          allowedUpdates.acceptedAt = new Date();
          
          guaranteeService.fulfillByRide(driverRecord.id, existingRide.id).catch(console.error);
        }
      }
      
      const ride = await storage.updateRide(req.params.id, allowedUpdates);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }

      if (req.body.status === "cancelled" && existingRide.status !== "cancelled") {
        const acceptedAt = existingRide.acceptedAt ? new Date(existingRide.acceptedAt) : null;
        const minutesAfterAccept = acceptedAt 
          ? (Date.now() - acceptedAt.getTime()) / 60000 
          : 0;

        if (isDriver && existingRide.customerId && existingRide.driverId) {
          // Auto-rematch: find new driver for rider at same guaranteed price
          rematchService.initiateRematch(
            existingRide.id,
            existingRide.driverId,
            minutesAfterAccept
          ).then(result => {
            if (result.success) {
              console.log(`Auto-rematch successful for ride ${existingRide.id} -> ${result.newRideId}`);
            } else {
              console.log(`Auto-rematch failed for ride ${existingRide.id}: ${result.message}`);
              // Credit already issued by rematch service if it failed
            }
          }).catch(console.error);
        } else if (isCustomer && existingRide.driverId) {
          accountabilityService.processRiderLateCancellation(
            existingRide.id,
            minutesAfterAccept
          ).catch(console.error);
        }
      }

      if (req.body.status === "started" && existingRide.status === "arriving") {
        const acceptedAt = existingRide.acceptedAt ? new Date(existingRide.acceptedAt) : null;
        
        if (acceptedAt) {
          const estimatedEtaMinutes = 5;
          const actualArrivalMinutes = (Date.now() - acceptedAt.getTime()) / 60000;
          
          if (actualArrivalMinutes > estimatedEtaMinutes + 5) {
            accountabilityService.processEtaBreach(
              existingRide.id,
              estimatedEtaMinutes,
              actualArrivalMinutes
            ).catch(console.error);
          }
          
          const waitStartApprox = new Date(acceptedAt.getTime() + estimatedEtaMinutes * 60 * 1000);
          const waitMinutes = (Date.now() - waitStartApprox.getTime()) / 60000;
          if (waitMinutes > 3) {
            accountabilityService.processPickupWait(
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
          let paymentMethod = (ride as any).paymentMethod || "cash";
          
          const driverShare = fare * 0.90;
          const platformFee = fare * 0.10;
          
          if (paymentMethod === "wallet") {
            const balance = parseFloat(user.walletBalance || "0");
            if (balance >= fare) {
              await storage.updateUserWalletBalance(ride.customerId, -fare);
              await storage.createWalletTransaction({
                id: uuidv4(),
                userId: ride.customerId,
                rideId: ride.id,
                type: "ride_payment",
                amount: (-fare).toFixed(2),
                status: "completed",
                description: `Payment for ride to ${ride.dropoffAddress}`,
                completedAt: new Date(),
              });
              
              await storage.updateDriverWalletBalance(ride.driverId, driverShare);
              await storage.createWalletTransaction({
                id: uuidv4(),
                driverId: ride.driverId,
                rideId: ride.id,
                type: "ride_payment",
                amount: driverShare.toFixed(2),
                status: "completed",
                description: `Earnings from ride (wallet payment)`,
                completedAt: new Date(),
              });
            } else {
              paymentStatus = "pending";
            }
          } else if (paymentMethod === "usdt") {
            await storage.updateDriverWalletBalance(ride.driverId, driverShare);
            await storage.createWalletTransaction({
              id: uuidv4(),
              driverId: ride.driverId,
              rideId: ride.id,
              type: "ride_payment",
              amount: driverShare.toFixed(2),
              status: "completed",
              description: `Earnings from ride (USDT payment)`,
              completedAt: new Date(),
            });
          } else {
            await storage.updateDriverWalletBalance(ride.driverId, -platformFee);
            await storage.createWalletTransaction({
              id: uuidv4(),
              driverId: ride.driverId,
              rideId: ride.id,
              type: "platform_fee",
              amount: (-platformFee).toFixed(2),
              status: "completed",
              description: `Platform fee deducted (cash ride - driver collected full fare)`,
              completedAt: new Date(),
            });
          }

          if (paymentStatus === "completed") {
            await storage.createWalletTransaction({
              id: uuidv4(),
              rideId: ride.id,
              type: "platform_fee",
              amount: platformFee.toFixed(2),
              status: "completed",
              description: `Platform service fee (10%) - ${paymentMethod} ride`,
              completedAt: new Date(),
            });

            await walletService.recordPlatformLedger({
              type: "platform_fee_income",
              amount: platformFee,
              rideId: ride.id,
              driverId: ride.driverId,
              description: `10% service fee from ${paymentMethod} ride ${ride.id.substring(0, 8)}`,
              currency: ride.currency || "AED",
            });

            const driver = await storage.getDriver(ride.driverId);
            if (driver) {
              const currentEarnings = parseFloat(driver.totalEarnings || "0");
              await storage.updateDriver(ride.driverId, {
                totalEarnings: (currentEarnings + driverShare).toFixed(2),
                totalTrips: (driver.totalTrips || 0) + 1,
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
                timestamp: new Date(),
              });

              if (blockchainResult.transactionHash) {
                await storage.updateRide(ride.id, {
                  blockchainTxHash: blockchainResult.transactionHash,
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
                completedAt: new Date().toISOString(),
              }).catch(err => console.log("Email send error:", err.message));

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
                    completedAt: new Date().toISOString(),
                  }).catch(err => console.log("Driver email send error:", err.message));
                }
              }
            } catch (blockchainError: any) {
              console.log("Blockchain recording (optional):", blockchainError.message);
            }

            try {
              await createRideInvoices(ride.id);
            } catch (invoiceError: any) {
              console.log("Invoice generation error:", invoiceError.message);
            }
          }

          await storage.createPayment({
            id: uuidv4(),
            rideId: ride.id,
            userId: ride.customerId,
            amount: fare.toFixed(2),
            method: paymentMethod,
            status: paymentStatus,
          });
        }
      }

      res.json(ride);
    } catch (error: any) {
      console.error("PATCH /api/rides/:id ERROR:", error.message, error.stack);
      res.status(500).json({ message: error.message });
    }
  });

  // Get rematch status for a ride
  app.get("/api/rides/:id/rematch-status", async (req, res) => {
    try {
      const status = await rematchService.getRematchStatus(req.params.id);
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Driver pay formula transparency endpoint
  app.get("/api/driver/pay-formula", async (req, res) => {
    try {
      const regionCode = (req.query.region as string) || "AE";
      
      // Get regional pricing config - use default if not available
      const regionConfig = { currencyCode: regionCode === "PK" ? "PKR" : regionCode === "BD" ? "BDT" : "AED" };
      const serviceTypes = await storage.getServiceTypes();
      
      const payFormula = {
        platformCommission: "10%",
        commissionDescription: "Flat 10% platform fee on all rides",
        driverShare: "90%",
        driverShareDescription: "You keep 90% of the fare",
        
        fareCalculation: {
          description: "Your guaranteed earnings are calculated before you accept",
          formula: "Driver Earnings = (Base Fare + Distance × Per-km Rate + Time × Per-minute Rate) × 0.90",
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
        
        vehicleRates: serviceTypes.map(st => ({
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
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Incentive policy for a city
  app.get("/api/incentives/:cityId", async (req, res) => {
    try {
      const policy = await incentivePolicy.getIncentivePolicy(req.params.cityId);
      res.json(policy);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Incentive policy explanation (human-readable)
  app.get("/api/incentives/:cityId/explain", async (req, res) => {
    try {
      const explanation = await incentivePolicy.getPolicyExplanation(req.params.cityId);
      res.json(explanation);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Check signup bonus eligibility
  app.get("/api/incentives/:cityId/signup-bonus", async (req, res) => {
    try {
      const bonus = await incentivePolicy.shouldOfferSignupBonus(req.params.cityId);
      res.json(bonus);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Calculate boost multiplier for current conditions
  app.post("/api/incentives/:cityId/boost", async (req, res) => {
    try {
      const { isRaining, isEmergency, isPeakHour, currentDemand, currentSupply } = req.body;
      const boost = await incentivePolicy.calculateBoostMultiplier(req.params.cityId, {
        isRaining: Boolean(isRaining),
        isEmergency: Boolean(isEmergency),
        isPeakHour: Boolean(isPeakHour),
        currentDemand: Number(currentDemand) || 0,
        currentSupply: Number(currentSupply) || 0
      });
      res.json(boost);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/rides/:id/telemetry", async (req, res) => {
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

      const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      };

      let driverLocation = null;
      let eta = null;
      let routeCoordinates: Array<{ latitude: number; longitude: number }> = [];
      let hasRealLocation = false;

      if (driver && ride.status !== "pending" && ride.status !== "completed") {
        const driverLat = parseFloat(driver.currentLat || "0");
        const driverLng = parseFloat(driver.currentLng || "0");
        hasRealLocation = driverLat !== 0 && driverLng !== 0;

        if (hasRealLocation) {
          driverLocation = { lat: driverLat, lng: driverLng };
          
          if (ride.status === "accepted" || ride.status === "arriving") {
            const distanceToPickup = calculateDistance(driverLat, driverLng, pickupLat, pickupLng);
            eta = Math.max(1, Math.round(distanceToPickup * 3));
            routeCoordinates = [
              { latitude: driverLat, longitude: driverLng },
              { latitude: pickupLat, longitude: pickupLng },
            ];
          } else {
            const remainingDistance = calculateDistance(driverLat, driverLng, dropoffLat, dropoffLng);
            eta = Math.max(1, Math.round(remainingDistance * 2.5));
            routeCoordinates = [
              { latitude: driverLat, longitude: driverLng },
              { latitude: dropoffLat, longitude: dropoffLng },
            ];
          }
        } else {
          const statusProgress: Record<string, number> = {
            accepted: 0.3,
            arriving: 0.6,
            started: 0.1,
            in_progress: 0.5,
          };
          const progress = statusProgress[ride.status] || 0;

          if (ride.status === "accepted" || ride.status === "arriving") {
            driverLocation = {
              lat: pickupLat + (dropoffLat - pickupLat) * -0.1 * (1 - progress),
              lng: pickupLng + (dropoffLng - pickupLng) * -0.1 * (1 - progress),
            };
            const distanceToPickup = calculateDistance(
              driverLocation.lat, driverLocation.lng, pickupLat, pickupLng
            );
            eta = Math.max(1, Math.round(distanceToPickup * 3));
            routeCoordinates = [
              { latitude: driverLocation.lat, longitude: driverLocation.lng },
              { latitude: pickupLat, longitude: pickupLng },
            ];
          } else {
            driverLocation = {
              lat: pickupLat + (dropoffLat - pickupLat) * progress,
              lng: pickupLng + (dropoffLng - pickupLng) * progress,
            };
            const remainingDistance = calculateDistance(
              driverLocation.lat, driverLocation.lng, dropoffLat, dropoffLng
            );
            eta = Math.max(1, Math.round(remainingDistance * 2.5));
            routeCoordinates = [
              { latitude: driverLocation.lat, longitude: driverLocation.lng },
              { latitude: dropoffLat, longitude: dropoffLng },
            ];
          }
        }
      }

      const fullRouteCoordinates = [
        { latitude: pickupLat, longitude: pickupLng },
        { latitude: dropoffLat, longitude: dropoffLng },
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
          address: ride.pickupAddress,
        },
        dropoff: {
          lat: dropoffLat,
          lng: dropoffLng,
          address: ride.dropoffAddress,
        },
        driver: await (async () => {
          if (!driver) return null;
          const driverUser = await storage.getUser(driver.userId);
          const vehicles = await storage.getDriverVehicles(driver.id);
          const vehicle = vehicles[0];
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
            vehicleVerified: vehicle?.verificationStatus === "ai_verified" || vehicle?.verificationStatus === "admin_verified",
          };
        })(),
        updatedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Driver location updates - require auth, drivers can only update their own location
  app.post("/api/drivers/:id/location", requireAuth, async (req: any, res) => {
    try {
      const { lat, lng, heading } = req.body;
      if (typeof lat !== "number" || typeof lng !== "number") {
        return res.status(400).json({ message: "Invalid location" });
      }

      const driver = await storage.getDriver(req.params.id);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      // Verify user owns this driver profile
      if (driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const updateData: any = {
        currentLat: lat.toString(),
        currentLng: lng.toString(),
        lastOnlineAt: new Date(),
      };
      
      if (typeof heading === "number") {
        updateData.currentHeading = heading.toString();
      }

      await storage.updateDriver(req.params.id, updateData);

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Intent-based matching endpoints
  app.get("/api/intent/aligned-drivers", requireAuth, async (req: any, res) => {
    try {
      const { pickupLat, pickupLng, dropoffLat, dropoffLng, priority } = req.query;
      
      if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
        return res.status(400).json({ message: "Missing location parameters" });
      }
      
      const alignedDrivers = await intentEngine.findAlignedDrivers(
        req.userId,
        parseFloat(pickupLat as string),
        parseFloat(pickupLng as string),
        parseFloat(dropoffLat as string),
        parseFloat(dropoffLng as string),
        (priority as "fastest" | "cheapest" | "reliable") || "reliable"
      );
      
      res.json({
        drivers: alignedDrivers.map(d => ({
          driverId: d.driverId,
          alignmentScore: d.alignment.score,
          matchType: d.alignment.matchType,
          confidence: d.alignment.confidence,
          distance: d.distance,
        })),
        totalFound: alignedDrivers.length,
        instantMatches: alignedDrivers.filter(d => d.alignment.matchType === "instant").length,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/intent/city-density", async (req, res) => {
    try {
      const density = await cityBrain.getCityDensityType();
      res.json(density);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/intent/zone-metrics", async (req, res) => {
    try {
      const { lat, lng } = req.query;
      
      if (!lat || !lng) {
        return res.status(400).json({ message: "Missing location parameters" });
      }
      
      const metrics = await cityBrain.getZoneMetrics(
        parseFloat(lat as string),
        parseFloat(lng as string)
      );
      
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/intent/flow-recommendation", requireAuth, async (req: any, res) => {
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
      
      const recommendation = await cityBrain.getFlowRecommendation(lat, lng);
      res.json(recommendation);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/drivers/:id/home-address", requireAuth, async (req: any, res) => {
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
        homeAddress: JSON.stringify({ lat, lng, address }),
      });
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Anti-gaming status for drivers
  app.get("/api/drivers/:id/anti-gaming-status", requireAuth, async (req: any, res) => {
    try {
      const driver = await storage.getDriver(req.params.id);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      if (driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const flags = await antiGamingService.getAntiGamingFlags(req.params.id);
      const guaranteeEligibility = await antiGamingService.isEligibleForGuarantee(req.params.id);
      
      res.json({
        ...flags,
        guaranteeEligible: guaranteeEligibility.eligible,
        guaranteeIneligibleReason: guaranteeEligibility.reason,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Saved addresses - require auth, users can only access their own
  app.get("/api/saved-addresses/:userId", requireAuth, async (req: any, res) => {
    try {
      if (req.params.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const addresses = await storage.getSavedAddresses(req.params.userId);
      res.json(addresses);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/saved-addresses", requireAuth, async (req: any, res) => {
    try {
      if (req.body.userId !== req.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      const address = await storage.createSavedAddress({
        ...req.body,
        id: uuidv4(),
      });
      res.json(address);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/saved-addresses/:id", requireAuth, async (req: any, res) => {
    try {
      // In production, should verify ownership before deletion
      await storage.deleteSavedAddress(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Emergency contacts - require auth, users can only access their own
  app.get("/api/emergency-contacts/:userId", requireAuth, async (req: any, res) => {
    try {
      if (req.params.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const contacts = await storage.getEmergencyContacts(req.params.userId);
      res.json(contacts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/emergency-contacts", requireAuth, async (req: any, res) => {
    try {
      if (req.body.userId !== req.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      const contact = await storage.createEmergencyContact({
        ...req.body,
        id: uuidv4(),
      });
      res.json(contact);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/emergency-contacts/:id", requireAuth, async (req: any, res) => {
    try {
      // In production, should verify ownership before deletion
      await storage.deleteEmergencyContact(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Payment methods - require auth, users can only access their own
  app.get("/api/payment-methods/:userId", requireAuth, async (req: any, res) => {
    try {
      if (req.params.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const methods = await storage.getPaymentMethods(req.params.userId);
      res.json(methods);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/payment-methods", requireAuth, async (req: any, res) => {
    try {
      if (req.body.userId !== req.userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      const method = await storage.createPaymentMethod({
        ...req.body,
        id: uuidv4(),
      });
      res.json(method);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/service-types", async (_req, res) => {
    try {
      const types = await storage.getServiceTypes();
      res.json(types);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/coupons/validate", async (req, res) => {
    try {
      const { code } = req.query;
      if (!code) {
        return res.status(400).json({ message: "Coupon code required" });
      }
      const coupon = await storage.getCoupon(code as string);
      if (!coupon) {
        return res.status(404).json({ message: "Invalid or expired coupon" });
      }
      res.json(coupon);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ratings", async (req, res) => {
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
        id: uuidv4(),
        rideId,
        fromUserId: session.userId,
        toDriverId,
        rating: ratingValue,
        comment: comment || null,
      });
      
      // Process tip if provided
      if (tip && tip > 0) {
        const ride = await storage.getRide(rideId);
        if (ride && ride.driverId) {
          // Update ride with tip
          await storage.updateRide(rideId, { tipAmount: tip.toString() });
          
          // Credit driver wallet
          const driver = await storage.getDriver(ride.driverId);
          if (driver) {
            const currentBalance = parseFloat(driver.walletBalance || "0");
            await storage.updateDriver(ride.driverId, {
              walletBalance: (currentBalance + tip).toString(),
            });
            
            // Record transaction
            await storage.createWalletTransaction({
              id: uuidv4(),
              driverId: ride.driverId,
              rideId: ride.id,
              type: "ride_payment",
              amount: tip.toString(),
              currency: ride.currency || "AED",
              status: "completed",
              description: `Tip from rider for ride ${ride.id.substring(0, 8)}`,
            });
          }
        }
      }
      
      res.json({ ...ratingData, tipProcessed: tip > 0 });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/drivers/available", async (req, res) => {
    try {
      const { lat, lng, radius } = req.query;
      const drivers = await storage.getAvailableDrivers(
        parseFloat(lat as string) || 25.2048,
        parseFloat(lng as string) || 55.2708,
        parseFloat(radius as string) || 5
      );
      res.json(drivers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ai/optimal-match", async (req, res) => {
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
        optimizationType: "cost_and_match",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ai/calculate-price", async (req, res) => {
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
        transparency: pricing.priceExplanation,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/ai/optimal-drivers", async (req, res) => {
    try {
      const { pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType } = req.query;
      
      if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
        return res.status(400).json({ message: "Coordinates are required" });
      }

      const drivers = await findOptimalDrivers(
        parseFloat(pickupLat as string),
        parseFloat(pickupLng as string),
        parseFloat(dropoffLat as string),
        parseFloat(dropoffLng as string),
        vehicleType as string | undefined
      );

      res.json({
        success: true,
        drivers,
        totalFound: drivers.length,
        aiRanked: true,
        scoringFactors: ["distance", "rating", "experience", "availability"],
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/ai/price", async (req, res) => {
    try {
      const { pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType } = req.query;
      
      if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
        return res.status(400).json({ message: "Coordinates are required" });
      }

      const pricing = await calculateOptimalPrice(
        parseFloat(pickupLat as string),
        parseFloat(pickupLng as string),
        parseFloat(dropoffLat as string),
        parseFloat(dropoffLng as string),
        (vehicleType as string) || "economy"
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
        surgeCapped: combinedMultiplier >= 1.5,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/blockchain/status", async (_req, res) => {
    try {
      const status = getBlockchainStatus();
      res.json({
        success: true,
        ...status,
        features: {
          transparentPricing: true,
          verifiableReceipts: true,
          onChainRecording: status.contractConfigured,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/blockchain/record-ride", async (req, res) => {
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
        timestamp: new Date(),
      });

      res.json({
        ...result,
        feeBreakdown,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/blockchain/verify/:rideHash", async (req, res) => {
    try {
      const { rideHash } = req.params;
      const verification = await verifyRideOnChain(rideHash);
      res.json({
        success: true,
        ...verification,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/blockchain/transparency-report", async (req, res) => {
    try {
      const { rideId, pricing } = req.body;
      
      if (!rideId || !pricing) {
        return res.status(400).json({ message: "Ride ID and pricing data are required" });
      }

      const report = generateTransparencyReport(rideId, pricing);
      res.json({
        success: true,
        report,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/register-driver", async (req, res) => {
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
        id: uuidv4(),
        email,
        password: hashPassword(password),
        name,
        phone: phone || null,
        role: "driver",
      });

      const driver = await storage.createDriver({
        id: uuidv4(),
        userId: user.id,
        licenseNumber: licenseNumber || null,
      });

      const token = randomBytes(32).toString("hex");
      
      import("./telegramBot").then(({ sendDriverWelcomeSequence }) => {
        sendDriverWelcomeSequence(driver.id, name).catch(console.error);
      });
      import("./whatsappBot").then(({ sendDriverWelcomeSequenceWhatsApp }) => {
        sendDriverWelcomeSequenceWhatsApp(driver.id, name).catch(console.error);
      });

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
        },
        driver,
        token,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Driver registration failed" });
    }
  });

  app.get("/api/drivers/me", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const driver = await storage.getDriverByUserId(userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      res.json(driver);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/drivers/status", requireAuth, async (req: any, res) => {
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
        currentLng: lng,
      });

      let guarantee = null;
      if (isOnline && wasOffline) {
        const result = await guaranteeService.startGuarantee(driver.id, "AE");
        if (result.started && result.guarantee) {
          guarantee = result.guarantee;
        }
      } else if (!isOnline) {
        await guaranteeService.cancelGuarantee(driver.id);
      }

      res.json({ ...updatedDriver, guarantee });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Temporary debug endpoint to check and approve driver
  app.get("/api/debug/driver-status/:phone", async (req, res) => {
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
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Approve a driver by phone number (DEBUG ONLY)
  app.post("/api/debug/approve-driver/:phone", async (req, res) => {
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
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Assign pending rides to a driver (DEBUG ONLY)
  app.post("/api/debug/assign-rides/:driverId", async (req, res) => {
    try {
      const { driverId } = req.params;
      const pendingRides = await storage.getPendingRides();
      const unassigned = pendingRides.filter(r => !r.driverId);
      let assigned = 0;
      for (const ride of unassigned.slice(0, 10)) {
        await storage.updateRide(ride.id, { driverId });
        assigned++;
      }
      res.json({ success: true, assigned, total: unassigned.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Temporary debug endpoint to test pending rides
  app.get("/api/debug/pending-rides/:driverId", async (req, res) => {
    try {
      const { driverId } = req.params;
      const allRides = await storage.getPendingRides();
      const driverRides = allRides.filter(ride => ride.driverId === driverId);
      // Show unique driver IDs in all pending rides
      const uniqueDriverIds = [...new Set(allRides.map(r => r.driverId || 'null'))];
      res.json({
        total: allRides.length,
        forDriver: driverRides.length,
        driverId,
        uniqueDriverIdsInRides: uniqueDriverIds,
        sampleRides: allRides.slice(0, 5).map(r => ({ id: r.id, driverId: r.driverId, pickup: r.pickupAddress?.substring(0, 30) }))
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/drivers/pending-rides", requireAuth, async (req: any, res) => {
    try {
      // Verify user is an approved driver
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver || driver.status !== "approved") {
        return res.status(403).json({ message: "Only approved drivers can view pending rides" });
      }

      const allRides = await storage.getPendingRides();
      
      console.log(`[PENDING-RIDES] Driver ${driver.id} requesting rides. Total pending: ${allRides.length}`);
      console.log(`[PENDING-RIDES] Sample ride driverIds: ${allRides.slice(0,3).map(r => r.driverId).join(', ')}`);
      
      // Filter to only show rides assigned to this driver
      // When a ride is matched to a driver, the driver_id is set
      const driverRides = allRides.filter(ride => ride.driverId === driver.id);
      
      console.log(`[PENDING-RIDES] Filtered rides for this driver: ${driverRides.length}`);
      
      // Check if driver has an active PMGTH (Going Home) session
      const pmgthSession = await pmgthService.getActivePmgthSession(driver.id);
      
      let ridesToShow = driverRides;
      let pmgthCompatibilityMap: Map<string, { premiumAmount: number; premiumPercent: number; directionScore: number }> = new Map();
      
      // If driver has active PMGTH session, ONLY show direction-compatible rides
      if (pmgthSession) {
        // Only include rides that have valid coordinates for compatibility checking
        const ridesWithCoords = driverRides.filter(r => 
          r.pickupLat && r.pickupLng && r.dropoffLat && r.dropoffLng
        );
        
        const compatibleRides = await pmgthService.findCompatibleRides(
          pmgthSession,
          ridesWithCoords.map(r => ({
            id: r.id,
            pickupLat: String(r.pickupLat),
            pickupLng: String(r.pickupLng),
            dropoffLat: String(r.dropoffLat),
            dropoffLng: String(r.dropoffLng),
            estimatedFare: r.estimatedFare,
          }))
        );
        
        // Build a map of compatible ride IDs with their premium info
        const compatibleRideIds = new Set(compatibleRides.map(cr => cr.rideId));
        compatibleRides.forEach(cr => {
          pmgthCompatibilityMap.set(cr.rideId, {
            premiumAmount: cr.premiumAmount,
            premiumPercent: cr.premiumPercent,
            directionScore: cr.directionScore,
          });
        });
        
        // Filter to only show compatible rides from driver's assigned rides
        ridesToShow = driverRides.filter(ride => compatibleRideIds.has(ride.id));
      }
      
      // Enrich rides with customer info and PMGTH premium
      const enrichedRides = await Promise.all(ridesToShow.map(async (ride) => {
        let customerName = "Customer";
        let customerRating = 5.0;
        let customerTotalRides = 0;
        if (ride.customerId) {
          const customer = await storage.getUser(ride.customerId);
          customerName = customer?.name || customer?.email?.split("@")[0] || "Customer";
          // Rating from completed rides (default 5.0 for new customers)
          customerRating = 5.0;
          customerTotalRides = 0;
        }
        
        // Calculate distance if coordinates are available
        let distanceNum = 0;
        const pLat = parseFloat(String(ride.pickupLat || 0));
        const pLng = parseFloat(String(ride.pickupLng || 0));
        const dLat = parseFloat(String(ride.dropoffLat || 0));
        const dLng = parseFloat(String(ride.dropoffLng || 0));
        if (pLat && pLng && dLat && dLng) {
          const R = 6371;
          const latDiff = ((dLat - pLat) * Math.PI) / 180;
          const lngDiff = ((dLng - pLng) * Math.PI) / 180;
          const a = Math.sin(latDiff / 2) ** 2 + Math.cos((pLat * Math.PI) / 180) * Math.cos((dLat * Math.PI) / 180) * Math.sin(lngDiff / 2) ** 2;
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          distanceNum = R * c;
        }
        
        // Calculate estimated duration (3 min/km average)
        const estimatedDuration = Math.round(distanceNum * 3);
        
        // Calculate fare per km
        const fare = parseFloat(String(ride.estimatedFare || 0));
        const farePerKm = distanceNum > 0 ? (fare / distanceNum).toFixed(2) : "0";
        
        // Get PMGTH premium info if applicable
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
          pmgthDirectionScore: pmgthInfo?.directionScore || 0,
        };
      }));
      
      res.json(enrichedRides);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/drivers/earnings", requireAuth, async (req: any, res) => {
    try {
      const { period } = req.query;
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      const earnings = await storage.getDriverEarnings(
        driver.id,
        period as string || "today"
      );
      res.json(earnings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/drivers/monthly-yield", requireAuth, async (req: any, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      const earnings = await storage.getDriverEarnings(driver.id, "month");
      const monthlyYield = earnings?.totalEarnings || "0.00";
      res.json({ monthlyYield });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin routes - require admin role
  app.get("/api/admin/stats", requireAuth, requireRole("admin"), async (_req: any, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/users", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const { role, page, limit } = req.query;
      const users = await storage.getAllUsers(
        role as string,
        parseInt(page as string) || 1,
        parseInt(limit as string) || 20
      );
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/drivers", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const { status, page, limit } = req.query;
      const drivers = await storage.getAllDrivers(
        status as string,
        parseInt(page as string) || 1,
        parseInt(limit as string) || 20
      );
      res.json(drivers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/drivers/:id/status", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const { status } = req.body;
      const driver = await storage.updateDriver(req.params.id, { status });
      res.json(driver);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/rides", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const { status, page, limit } = req.query;
      const rides = await storage.getAllRides(
        status as string,
        parseInt(page as string) || 1,
        parseInt(limit as string) || 20
      );
      res.json(rides);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/payment-methods/:id", async (req, res) => {
    try {
      await storage.deletePaymentMethod(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/payment-methods/:id/default", async (req, res) => {
    try {
      const { userId } = req.body;
      await storage.setDefaultPaymentMethod(userId, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Wallet routes - require auth and only allow access to own wallet
  app.post("/api/wallet/topup", requireAuth, async (req: any, res) => {
    try {
      const { amount, currency } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }
      const result = await walletService.topUpWallet(req.userId, amount, currency || "AED");
      res.json({ success: true, newBalance: result.newBalance });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/wallet/balance/:userId", requireAuth, async (req: any, res) => {
    try {
      if (req.params.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const user = await storage.getUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ balance: user.walletBalance || "0.00" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/wallet/transactions/:userId", requireAuth, async (req: any, res) => {
    try {
      if (req.params.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const transactions = await storage.getWalletTransactions(req.params.userId);
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/wallet/summary/:userId", requireAuth, async (req: any, res) => {
    try {
      if (req.params.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const summary = await walletService.getWalletSummary(req.params.userId, undefined);
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/drivers/:driverId/withdraw", requireAuth, async (req: any, res) => {
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

      const result = await walletService.processDriverWithdrawal(driverId, amount, currency || "AED");
      
      if (!result.success) {
        if (result.insufficientFunds) {
          return res.status(400).json({ message: "Insufficient wallet balance" });
        }
        return res.status(500).json({ message: "Withdrawal failed" });
      }

      res.json({ success: true, newBalance: result.newBalance });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/drivers/:driverId/wallet-summary", requireAuth, async (req: any, res) => {
    try {
      const { driverId } = req.params;
      const driver = await storage.getDriver(driverId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      if (driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const summary = await walletService.getWalletSummary(undefined, driverId);
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/platform-financials", requireAuth, async (req: any, res) => {
    try {
      if (req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const financials = await walletService.getPlatformFinancials();
      res.json(financials);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/rides/:id/pay", async (req, res) => {
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

      let paymentStatus = 'completed';

      if (paymentMethod === 'wallet') {
        const balance = parseFloat(user.walletBalance || "0");
        if (balance < fare) {
          return res.status(400).json({ message: "Insufficient wallet balance" });
        }
        await storage.updateUserWalletBalance(ride.customerId, -fare);

        await storage.createWalletTransaction({
          id: uuidv4(),
          userId: ride.customerId,
          rideId: ride.id,
          type: 'ride_payment',
          amount: (-fare).toFixed(2),
          status: 'completed',
          description: `Payment for ride to ${ride.dropoffAddress}`,
          completedAt: new Date(),
        });
      } else if (paymentMethod === 'usdt') {
        try {
          const minAmount = await nowPaymentsService.getMinimumPaymentAmount("usdttrc20");
          const estimatedUsdt = fare / 3.67;
          if (estimatedUsdt < minAmount) {
            return res.status(400).json({
              code: "AMOUNT_TOO_SMALL",
              message: `This fare is too small for USDT payment (minimum ~${(minAmount * 3.67).toFixed(0)} AED). Please use cash or wallet instead.`,
              minimumUsdt: minAmount,
            });
          }

          const orderId = `ride_${ride.id}_${Date.now()}`;
          const currency = (ride.currency || "AED").toLowerCase();
          
          const baseUrl = process.env.REPLIT_DEV_DOMAIN 
            ? `https://${process.env.REPLIT_DEV_DOMAIN}`
            : `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000"}`;

          const invoice = await nowPaymentsService.createInvoice({
            price: fare,
            currency: currency,
            orderId: orderId,
            description: `Ride payment: ${ride.pickupAddress} to ${ride.dropoffAddress}`,
            callbackUrl: `${baseUrl}/api/payments/nowpayments/ipn`,
            successUrl: `${baseUrl}/payment-success?type=${paymentMethod}`,
            cancelUrl: `${baseUrl}/payment-cancelled`,
          });

          paymentStatus = 'pending_crypto';

          await storage.createWalletTransaction({
            id: uuidv4(),
            userId: ride.customerId,
            rideId: ride.id,
            type: 'ride_payment',
            amount: (-fare).toFixed(2),
            status: 'pending',
            description: `USDT payment pending for ride to ${ride.dropoffAddress}`,
          });
        } catch (paymentError: any) {
          console.error("NOWPayments ride payment error:", paymentError);
          
          return res.status(402).json({ 
            code: "PAYMENT_ERROR",
            message: paymentError.message || "Payment processing failed. Please try another payment method.",
          });
        }
      }

      const payment = await storage.createPayment({
        id: uuidv4(),
        rideId: ride.id,
        userId: ride.customerId,
        amount: fare.toFixed(2),
        method: paymentMethod,
        status: paymentStatus,
      });

      res.json({ success: true, payment });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Driver routes - require auth
  app.get("/api/drivers/by-user/:userId", requireAuth, async (req: any, res) => {
    try {
      // Users can only access their own driver info
      if (req.params.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const driver = await storage.getDriverByUserId(req.params.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      res.json(driver);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/drivers/:driverId/wallet", requireAuth, async (req: any, res) => {
    try {
      const driver = await storage.getDriver(req.params.driverId);
      if (!driver) {
        return res.status(404).json({ 
          code: "DRIVER_NOT_FOUND",
          message: "Driver not found" 
        });
      }
      // Verify driver owns this wallet
      if (driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ 
          code: "ACCESS_DENIED",
          message: "Access denied" 
        });
      }
      const transactions = await storage.getDriverTransactions(req.params.driverId);
      const payouts = await storage.getDriverPayouts(req.params.driverId);
      
      // Calculate earnings breakdown
      const rideEarnings = transactions
        .filter(t => t.type === "ride_payment" && t.status === "completed")
        .reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);
      
      const tips = transactions
        .filter(t => t.type === "tip" && t.status === "completed")
        .reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);
      
      const bonuses = transactions
        .filter(t => (t.type as string) === "bonus" && t.status === "completed")
        .reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);
      
      const withdrawals = payouts
        .filter(p => p.status === "completed" || p.status === "processing")
        .reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
      
      const pendingPayouts = payouts
        .filter(p => p.status === "pending" || (p.status as string) === "pending_bank_setup")
        .reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
      
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
          pendingPayouts: pendingPayouts.toFixed(2),
        },
        
        platformInfo: {
          platformFeePercent: 10,
          driverSharePercent: 90,
          minPayoutAmount: 50,
          payoutMethods: ["bank", "crypto"],
        },
        
        transactions: transactions.slice(0, 50), // Last 50 transactions
        payouts: payouts.slice(0, 20), // Last 20 payouts
      });
    } catch (error: any) {
      res.status(500).json({ 
        code: "WALLET_ERROR",
        message: error.message 
      });
    }
  });

  app.post("/api/drivers/:driverId/payout", requireAuth, async (req: any, res) => {
    try {
      const { amount, method = "bank" } = req.body;
      const driver = await storage.getDriver(req.params.driverId);
      
      if (!driver) {
        return res.status(404).json({ 
          code: "DRIVER_NOT_FOUND",
          message: "Driver account not found" 
        });
      }
      
      // Verify driver owns this wallet
      if (driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ 
          code: "ACCESS_DENIED",
          message: "You can only withdraw from your own wallet" 
        });
      }

      const balance = parseFloat(driver.walletBalance || "0");
      const requestedAmount = parseFloat(amount);

      // Validation with comprehensive error codes
      if (isNaN(requestedAmount) || requestedAmount <= 0) {
        return res.status(400).json({ 
          code: "INVALID_AMOUNT",
          message: "Please enter a valid withdrawal amount" 
        });
      }

      const MIN_PAYOUT = 50; // Minimum 50 AED
      if (requestedAmount < MIN_PAYOUT) {
        return res.status(400).json({ 
          code: "BELOW_MINIMUM",
          message: `Minimum withdrawal is AED ${MIN_PAYOUT}`,
          minimumAmount: MIN_PAYOUT,
        });
      }

      if (balance < requestedAmount) {
        return res.status(400).json({ 
          code: "INSUFFICIENT_BALANCE",
          message: `Insufficient balance. You have AED ${balance.toFixed(2)} available.`,
          availableBalance: balance,
          requestedAmount,
        });
      }

      let payoutStatus: "pending" | "completed" | "failed" | "processing" = "pending";

      if (method === "usdt") {
        payoutStatus = "processing";
      } else if (method === "bank") {
        payoutStatus = "pending";
      }

      // Deduct from driver's wallet
      await storage.updateDriverWalletBalance(req.params.driverId, -requestedAmount);

      const payout = await storage.createDriverPayout({
        id: uuidv4(),
        driverId: req.params.driverId,
        amount: requestedAmount.toFixed(2),
        method: method,
        status: payoutStatus,
        stripePayoutId: null,
      });

      await storage.createWalletTransaction({
        id: uuidv4(),
        driverId: req.params.driverId,
        type: 'withdrawal',
        amount: requestedAmount.toFixed(2),
        status: payoutStatus === "processing" ? "completed" : "pending",
        description: method === "bank" 
          ? `Bank withdrawal - ${payoutStatus === "pending_bank_setup" ? "awaiting bank setup" : "processing"}`
          : `Withdrawal request`,
        completedAt: payoutStatus === "processing" ? new Date() : undefined,
      });

      res.json({ 
        success: true, 
        payout,
        message: payoutStatus === "pending_bank_setup" 
          ? "Payout requested. Please set up your bank account to receive funds."
          : payoutStatus === "processing"
          ? "Payout is being processed and will arrive in 2-3 business days."
          : "Payout request submitted for review.",
        newBalance: (balance - requestedAmount).toFixed(2),
      });
    } catch (error: any) {
      console.error("Payout error:", error);
      res.status(500).json({ 
        code: "PAYOUT_ERROR",
        message: "Failed to process payout. Please try again." 
      });
    }
  });

  // USDT Crypto Payout for Drivers
  app.post("/api/drivers/:driverId/crypto-payout", requireAuth, async (req: any, res) => {
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
          minimumAmount: MIN_CRYPTO_PAYOUT,
        });
      }

      if (balance < requestedAmount) {
        return res.status(400).json({ 
          code: "INSUFFICIENT_BALANCE",
          message: `Insufficient balance. You have AED ${balance.toFixed(2)} available.`,
          availableBalance: balance,
          requestedAmount,
        });
      }

      const { sendUsdtPayout, isWalletConfigured } = await import("./blockchain");
      
      if (!isWalletConfigured()) {
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

      // Validate wallet address format (basic Ethereum/Polygon address check)
      if (!/^0x[a-fA-F0-9]{40}$/.test(targetAddress)) {
        return res.status(400).json({ 
          code: "INVALID_WALLET_ADDRESS",
          message: "Invalid wallet address format. Please enter a valid Polygon (MATIC) address." 
        });
      }

      await storage.updateDriverWalletBalance(req.params.driverId, -requestedAmount);

      const payout = await storage.createDriverPayout({
        id: uuidv4(),
        driverId: req.params.driverId,
        amount: requestedAmount.toString(),
        method: 'crypto',
        status: 'processing',
        cryptoWalletAddress: targetAddress,
      });

      const result = await sendUsdtPayout(targetAddress, requestedAmount);

      if (result.success) {
        await storage.updateDriverPayout(payout.id, {
          status: 'completed',
          txHash: result.txHash,
          completedAt: new Date(),
        });

        await storage.createWalletTransaction({
          id: uuidv4(),
          driverId: req.params.driverId,
          type: 'withdrawal',
          amount: requestedAmount.toString(),
          status: 'completed',
          description: `USDT withdrawal to ${targetAddress.slice(0, 8)}...${targetAddress.slice(-6)}`,
        });

        res.json({ 
          success: true, 
          payout: { ...payout, txHash: result.txHash, status: 'completed' },
          explorerUrl: result.explorerUrl,
          message: `Successfully sent ${requestedAmount} USDT`,
        });
      } else {
        await storage.updateDriverWalletBalance(req.params.driverId, requestedAmount);
        await storage.updateDriverPayout(payout.id, {
          status: 'failed',
          failureReason: result.message,
        });

        res.status(500).json({ message: result.message });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/drivers/:driverId/crypto-wallet", requireAuth, async (req: any, res) => {
    try {
      const { walletAddress } = req.body;
      const driver = await storage.getDriver(req.params.driverId);
      
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      if (driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const { ethers } = await import("ethers");
      if (!ethers.isAddress(walletAddress)) {
        return res.status(400).json({ message: "Invalid wallet address format" });
      }

      await storage.updateDriver(req.params.driverId, { cryptoWalletAddress: walletAddress });
      res.json({ success: true, message: "Crypto wallet address updated" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/drivers/vehicle", requireAuth, async (req: any, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }

      const { make, model, year, color, plateNumber, type, photoFront, photoSide, autoVerify } = req.body;
      
      const vehicles = await storage.getDriverVehicles(driver.id);
      let vehicle = vehicles[0];

      const user = await storage.getUser(driver.userId);
      const regionCode = user?.regionCode || "BD";

      let aiResult = null;
      let verificationStatus: "pending" | "ai_verified" | "admin_verified" | "rejected" = vehicle?.verificationStatus as any || "pending";

      if (autoVerify && photoFront) {
        const imagesToVerify = [photoFront, photoSide].filter(Boolean) as string[];
        if (imagesToVerify.length > 0) {
          const { verifyMultipleVehicleImages } = await import("./vehicleVerification");
          aiResult = await verifyMultipleVehicleImages(imagesToVerify, regionCode);
          verificationStatus = aiResult.isValid ? "ai_verified" : "pending";
        }
      }

      const vehicleData: any = {
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
        aiVerificationNotes: aiResult?.issues?.join("; "),
      };

      if (vehicle) {
        vehicle = await storage.updateVehicle(vehicle.id!, vehicleData);
      } else {
        const { v4: uuidv4 } = await import("uuid");
        vehicle = await storage.createVehicle({
          id: uuidv4(),
          driverId: driver.id,
          ...vehicleData,
        });
      }

      res.json({ 
        ...vehicle, 
        verificationStatus,
        aiResult: aiResult ? {
          isValid: aiResult.isValid,
          confidence: aiResult.confidence,
          notes: aiResult.issues,
        } : null,
      });
    } catch (error: any) {
      console.error("Vehicle update error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/drivers/:driverId/payouts", requireAuth, async (req: any, res) => {
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
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/drivers/:driverId/bank-accounts", requireAuth, async (req: any, res) => {
    try {
      const driver = await storage.getDriver(req.params.driverId);
      if (driver && driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const accounts = await storage.getDriverBankAccounts(req.params.driverId);
      res.json(accounts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/drivers/:driverId/bank-accounts", requireAuth, async (req: any, res) => {
    try {
      const driver = await storage.getDriver(req.params.driverId);
      if (driver && driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const { bankName, last4, accountHolderName } = req.body;
      const account = await storage.createDriverBankAccount({
        id: uuidv4(),
        driverId: req.params.driverId,
        bankName,
        last4,
        accountHolderName,
        isDefault: true,
      });
      res.json(account);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Vehicle Verification AI Endpoints
  app.post("/api/vehicles/verify", requireAuth, async (req: any, res) => {
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
    } catch (error: any) {
      console.error("Vehicle verification error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/drivers/:driverId/vehicles", requireAuth, async (req: any, res) => {
    try {
      const driver = await storage.getDriver(req.params.driverId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      if (driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const { 
        type, make, model, year, color, plateNumber, 
        photo, photoFront, photoSide, photoInterior,
        autoVerify = true
      } = req.body;

      if (!type || !make || !model || !plateNumber) {
        return res.status(400).json({ message: "Type, make, model, and plate number are required" });
      }

      const user = await storage.getUser(driver.userId);
      const regionCode = user?.regionCode || "BD";

      let aiResult = null;
      let verificationStatus: "pending" | "ai_verified" | "admin_verified" | "rejected" = "pending";
      
      if (autoVerify && (photoFront || photo)) {
        const imagesToVerify = [photoFront, photoSide, photo].filter(Boolean) as string[];
        if (imagesToVerify.length > 0) {
          aiResult = await verifyMultipleVehicleImages(imagesToVerify, regionCode);
          verificationStatus = aiResult.isValid ? "ai_verified" : "pending";
        }
      }

      const vehicleId = uuidv4();
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
        aiVerifiedAt: aiResult?.isValid ? new Date() : null,
      });

      res.json({ 
        vehicle, 
        verification: aiResult,
        message: aiResult?.isValid 
          ? "Vehicle verified by AI successfully" 
          : "Vehicle submitted for manual review"
      });
    } catch (error: any) {
      console.error("Create vehicle error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/drivers/:driverId/vehicles", requireAuth, async (req: any, res) => {
    try {
      const driver = await storage.getDriver(req.params.driverId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      if (driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const vehicles = await storage.getDriverVehicles(req.params.driverId);
      res.json(vehicles);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/vehicles/:vehicleId", requireAuth, async (req: any, res) => {
    try {
      const vehicle = await storage.getVehicle(req.params.vehicleId);
      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }

      const driver = await storage.getDriver(vehicle.driverId);
      if (!driver || (driver.userId !== req.userId && req.userRole !== "admin")) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { reVerify, ...updates } = req.body;

      if (reVerify && (updates.photoFront || updates.photo)) {
        const user = await storage.getUser(driver.userId);
        const imagesToVerify = [updates.photoFront, updates.photoSide, updates.photo].filter(Boolean) as string[];
        if (imagesToVerify.length > 0) {
          const aiResult = await verifyMultipleVehicleImages(imagesToVerify, user?.regionCode || "BD");
          updates.aiCategory = aiResult.category;
          updates.aiConfidence = aiResult.confidence?.toString();
          updates.aiConditionScore = aiResult.conditionScore;
          updates.aiPassengerCapacity = aiResult.passengerCapacity;
          updates.aiIssues = aiResult.issues?.join(", ");
          updates.verificationStatus = aiResult.isValid ? "ai_verified" : "pending";
          updates.aiVerifiedAt = aiResult.isValid ? new Date() : null;
          if (aiResult.make) updates.make = aiResult.make;
          if (aiResult.model) updates.model = aiResult.model;
          if (aiResult.color) updates.color = aiResult.color;
          if (aiResult.year) updates.year = aiResult.year;
        }
      }

      const updated = await storage.updateVehicle(req.params.vehicleId, updates);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin vehicle verification queue
  app.get("/api/admin/vehicles/pending", requireAdmin, async (req: any, res) => {
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
            regionCode: user?.regionCode,
          };
        })
      );

      res.json(vehiclesWithDriverInfo);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/vehicles/:vehicleId/verify", requireAdmin, async (req: any, res) => {
    try {
      const { approved, notes, overrideType } = req.body;
      
      const vehicle = await storage.getVehicle(req.params.vehicleId);
      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }

      const updates: any = {
        verificationStatus: approved ? "admin_verified" : "rejected",
        adminVerifiedBy: req.userId,
        adminVerifiedAt: new Date(),
        adminNotes: notes,
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
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/vehicles/stats", requireAdmin, async (req: any, res) => {
    try {
      const stats = await storage.getVehicleVerificationStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/vehicles/by-region", requireAdmin, async (req: any, res) => {
    try {
      const regionStats = await storage.getVehiclesByRegion();
      res.json(regionStats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/revenue", requireAdmin, async (req: any, res) => {
    try {
      const period = req.query.period as string || "week";
      
      let startDate: Date;
      const now = new Date();
      
      switch (period) {
        case "today":
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case "week":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "month":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(0);
      }

      const completedRides = await db.select()
        .from(rides)
        .where(
          and(
            eq(rides.status, "completed"),
            gte(rides.createdAt, startDate)
          )
        );

      let totalRevenue = 0;
      let cardRevenue = 0;
      let cryptoRevenue = 0;
      let cashRevenue = 0;
      const cityRevenue: Record<string, number> = {};

      const transactions: any[] = [];

      for (const ride of completedRides) {
        const platformFee = parseFloat(ride.platformFee || "0");
        totalRevenue += platformFee;

        const payment = await db.select().from(payments).where(eq(payments.rideId, ride.id)).limit(1);
        const paymentMethod = payment[0]?.method || "card";

        if (paymentMethod === "card") {
          cardRevenue += platformFee;
        } else if (paymentMethod === "usdt") {
          cryptoRevenue += platformFee;
        } else if (paymentMethod === "cash") {
          cashRevenue += platformFee;
        }

        const cityName = (ride as any).pickupCity || "Unknown";
        cityRevenue[cityName] = (cityRevenue[cityName] || 0) + platformFee;

        if (transactions.length < 20) {
          transactions.push({
            date: ride.completedAt || ride.createdAt,
            rideId: ride.id,
            totalFare: ride.estimatedFare,
            platformFee: platformFee,
            paymentMethod: paymentMethod
          });
        }
      }

      const cityBreakdown = Object.entries(cityRevenue)
        .map(([city, revenue]) => ({ city, revenue }))
        .sort((a, b) => b.revenue - a.revenue);

      res.json({
        totalRevenue,
        cardRevenue,
        cryptoRevenue,
        cashRevenue,
        totalRides: completedRides.length,
        cityBreakdown,
        transactions: transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/vehicle-types", async (req, res) => {
    try {
      const regionCode = req.query.region as string || "BD";
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
        { id: "minibus", name: "Minibus", capacity: 12, icon: "bus", regions: ["all"] },
      ];

      const filtered = vehicleTypes.filter(
        v => v.regions.includes("all") || v.regions.includes(regionCode)
      );

      res.json(filtered);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/drivers/:driverId/ratings", requireAuth, async (req: any, res) => {
    try {
      const driver = await storage.getDriver(req.params.driverId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      if (driver.userId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const driverRatings = await storage.getDriverRatings(req.params.driverId);
      
      const ratingBreakdown: { [key: number]: number } = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      driverRatings.forEach((r) => {
        if (r.rating >= 1 && r.rating <= 5) {
          ratingBreakdown[r.rating]++;
        }
      });
      
      // Batch fetch all unique customer IDs
      const uniqueUserIds = [...new Set(driverRatings.map(r => r.fromUserId))];
      const usersMap = new Map<string, { name?: string; email?: string }>();
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
            name: customer?.name || customer?.email?.split("@")[0] || "Customer",
          },
        };
      });
      
      res.json({
        ratings: enrichedRatings,
        averageRating: driver.rating || "5.00",
        totalRatings: driverRatings.length,
        ratingBreakdown,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // NOWPayments Wallet Top-up (Card & USDT)
  app.post("/api/payments/nowpayments/wallet-topup", requireAuth, async (req: any, res) => {
    try {
      const { amount, currency = "AED" } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Valid amount is required" });
      }

      if (!nowPaymentsService.isAvailable()) {
        return res.status(503).json({ message: "USDT payments are not configured yet. Please use cash payment." });
      }

      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000"}`;

      const orderId = `wallet_${req.userId}_${Date.now()}`;
      
      const invoice = await nowPaymentsService.createInvoice({
        price: parseFloat(amount),
        currency: currency.toLowerCase(),
        orderId: orderId,
        description: `Travony Wallet Top-up: ${currency} ${amount}`,
        callbackUrl: `${baseUrl}/api/payments/nowpayments/ipn`,
        successUrl: `${baseUrl}/payment-success?type=usdt`,
        cancelUrl: `${baseUrl}/payment-cancelled`,
      });

      if (!invoice) {
        return res.status(500).json({ message: "Failed to create USDT payment invoice" });
      }

      res.json({
        invoiceId: invoice.id,
        invoiceUrl: invoice.invoice_url,
        amount: amount,
        currency: currency,
      });
    } catch (error: any) {
      console.error("NOWPayments wallet topup error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // NOWPayments IPN (Instant Payment Notification) Webhook
  app.post("/api/payments/nowpayments/ipn", async (req, res) => {
    try {
      const payload = req.body;
      console.log("NOWPayments IPN received:", JSON.stringify(payload));

      const signature = req.headers["x-nowpayments-sig"] as string;
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
            await walletService.topUpWallet(userId, parseFloat(amount), "AED");
            console.log(`Wallet topped up via NOWPayments: userId=${userId}, amount=${amount}`);
          }
        } else if (parts[0] === "ride" && parts[1]) {
          const rideId = parts[1];
          const ride = await storage.getRide(rideId);
          if (ride && ride.driverId) {
            const fare = parseFloat(ride.actualFare || ride.estimatedFare || "0");
            const driverShare = fare * 0.90;
            const platformFee = fare * 0.10;

            const existingPayment = await storage.getPaymentByRideId(rideId);
            if (existingPayment && existingPayment.status !== "completed") {
              await storage.updatePayment(existingPayment.id, { status: "completed" });

              await storage.updateDriverWalletBalance(ride.driverId, driverShare);
              await storage.createWalletTransaction({
                id: uuidv4(),
                driverId: ride.driverId,
                rideId: ride.id,
                type: "ride_payment",
                amount: driverShare.toFixed(2),
                status: "completed",
                description: `Earnings from USDT ride payment`,
                completedAt: new Date(),
              });

              await storage.createWalletTransaction({
                id: uuidv4(),
                rideId: ride.id,
                type: "platform_fee",
                amount: platformFee.toFixed(2),
                status: "completed",
                description: `Platform fee (10%) from USDT ride`,
                completedAt: new Date(),
              });

              await walletService.recordPlatformLedger({
                type: "platform_fee_income",
                amount: platformFee,
                rideId: ride.id,
                driverId: ride.driverId,
                description: `10% fee from USDT ride ${ride.id.substring(0, 8)}`,
                currency: ride.currency || "AED",
              });

              const driver = await storage.getDriver(ride.driverId);
              if (driver) {
                const currentEarnings = parseFloat(driver.totalEarnings || "0");
                await storage.updateDriver(ride.driverId, {
                  totalEarnings: (currentEarnings + driverShare).toFixed(2),
                  totalTrips: (driver.totalTrips || 0) + 1,
                });
              }

              console.log(`USDT ride payment confirmed: rideId=${rideId}, driverShare=${driverShare}, platformFee=${platformFee}`);
            }
          }
        }
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("NOWPayments IPN error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // NOWPayments status check
  app.get("/api/payments/nowpayments/status", requireAuth, async (req: any, res) => {
    res.json({ 
      available: nowPaymentsService.isAvailable(),
      provider: "nowpayments",
    });
  });


  app.get("/api/payments/methods", async (req, res) => {
    res.json({
      methods: [
        { id: "cash", name: "Cash", icon: "cash-outline", available: true, description: "Pay driver directly" },
        { id: "wallet", name: "Wallet", icon: "wallet-outline", available: true, description: "Pay from your wallet balance" },
        { id: "card", name: "Card", icon: "card-outline", available: true, description: "Pay with debit or credit card via NOWPayments" },
        { id: "usdt", name: "USDT (Crypto)", icon: "logo-usd", available: true, description: "Pay with USDT stablecoin via NOWPayments" },
      ],
    });
  });

  // Driver crypto settings
  app.get("/api/driver/crypto-settings", requireAuth, requireRole("driver"), async (req: any, res) => {
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
          isVerified: false,
        });
      }

      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/driver/crypto-settings", requireAuth, requireRole("driver"), async (req: any, res) => {
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
          isVerified: false,
        });
      } else {
        settings = await storage.updateDriverCryptoSettings(driver.id, {
          usdtWalletAddress: usdtWalletAddress || null,
          preferredCurrency: preferredCurrency || settings.preferredCurrency,
        });
      }

      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Driver USDT balance
  app.get("/api/driver/usdt-balance", requireAuth, requireRole("driver"), async (req: any, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }

      const balance = await storage.getDriverUsdtBalance(driver.id);
      res.json({ balance, currency: "USDT" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Driver USDT withdrawal
  app.post("/api/driver/withdraw-usdt", requireAuth, requireRole("driver"), async (req: any, res) => {
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
        bitpayPayoutId: null,
      });

      await storage.createWalletTransaction({
        id: uuidv4(),
        driverId: driver.id,
        type: "withdrawal",
        amount: amount.toFixed(2),
        currency: "USDT",
        status: "pending",
        description: `USDT withdrawal to ${cryptoSettings.usdtWalletAddress.slice(0, 10)}...`,
        metadata: JSON.stringify({ payoutId: dbPayout.id }),
      });

      res.json({
        message: "Withdrawal initiated",
        payout: {
          id: dbPayout.id,
          amount,
          status: "processing",
          walletAddress: cryptoSettings.usdtWalletAddress,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Simulate payout complete (dev only)
  app.post("/api/driver/simulate-payout/:payoutId", requireAuth, requireRole("driver"), async (req: any, res) => {
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

      const txHash = `0x${uuidv4().replace(/-/g, "")}`;
      await storage.updateDriverPayout(payout.id, {
        status: "completed",
        txHash,
        completedAt: new Date(),
      });

      res.json({ message: "Payout simulated", txHash });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Driver payouts history
  app.get("/api/driver/payouts", requireAuth, requireRole("driver"), async (req: any, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }

      const payouts = await storage.getDriverPayouts(driver.id);
      res.json(payouts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Comprehensive ride receipt endpoint
  app.get("/api/rides/:rideId/receipt", requireAuth, async (req: any, res) => {
    try {
      const ride = await storage.getRide(req.params.rideId);
      if (!ride) {
        return res.status(404).json({ 
          code: "RIDE_NOT_FOUND",
          message: "Ride not found" 
        });
      }

      // Access control
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

      // Get payment record
      const paymentRecords = await db.select().from(payments).where(eq(payments.rideId, ride.id));
      const payment = paymentRecords[0];

      // Get user and driver info
      const customer = await storage.getUser(ride.customerId);
      const driverUser = ride.driverId ? await storage.getDriver(ride.driverId) : null;
      const driverProfile = driverUser ? await storage.getUser(driverUser.userId) : null;

      // Calculate fare breakdown
      const totalFare = parseFloat(ride.actualFare || ride.estimatedFare || "0");
      const platformFee = totalFare * 0.10;
      const driverEarnings = totalFare * 0.90;
      
      // Get invoices
      const invoices = await storage.getRideInvoicesByRide(ride.id);
      const customerInvoice = invoices.find(i => i.invoiceType === "customer");

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
          completedAt: ride.completedAt,
        },
        
        rider: {
          name: customer?.name || "Rider",
          phone: customer?.phone,
        },
        
        driver: driverProfile ? {
          name: driverProfile.name,
          phone: driverProfile.phone,
          rating: driverUser?.rating,
        } : null,
        
        payment: {
          method: payment?.method || ride.paymentMethod || "cash",
          status: payment?.status || "completed",
          processedAt: payment?.createdAt,
          paymentId: payment?.id,
        },
        
        fareBreakdown: {
          baseFare: totalFare,
          discount: 0,
          totalFare: totalFare,
          currency: ride.currency || "AED",
        },
        
        blockchain: ride.blockchainHash ? {
          hash: ride.blockchainHash,
          verified: !!ride.blockchainTxHash,
          txHash: ride.blockchainTxHash,
        } : null,
        
        invoiceNumber: customerInvoice?.invoiceNumber,
      };

      res.json(receipt);
    } catch (error: any) {
      res.status(500).json({ 
        code: "RECEIPT_ERROR",
        message: error.message 
      });
    }
  });

  // Invoice endpoints
  app.get("/api/invoices/ride/:rideId", requireAuth, async (req: any, res) => {
    try {
      const { rideId } = req.params;
      const invoices = await storage.getRideInvoicesByRide(rideId);
      
      // Filter based on user role
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

      const filteredInvoices = invoices.filter(inv => {
        if (isCustomer && inv.invoiceType === "customer") return true;
        if (isDriver && inv.invoiceType === "driver") return true;
        return false;
      });

      res.json(filteredInvoices);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/invoices/:invoiceId", requireAuth, async (req: any, res) => {
    try {
      const invoice = await storage.getRideInvoice(req.params.invoiceId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Verify access
      const driver = await storage.getDriverByUserId(req.userId);
      const isRecipient = invoice.recipientId === req.userId || 
                          (driver && invoice.recipientId === driver.id);

      if (!isRecipient) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(invoice);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/invoices/my/customer", requireAuth, async (req: any, res) => {
    try {
      const invoices = await storage.getRideInvoicesByRecipient(req.userId, "customer");
      res.json(invoices);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/invoices/my/driver", requireAuth, requireRole("driver"), async (req: any, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }

      const invoices = await storage.getRideInvoicesByRecipient(driver.id, "driver");
      res.json(invoices);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // HTML Invoice endpoint
  app.get("/api/invoices/:invoiceId/html", requireAuth, async (req: any, res) => {
    try {
      const invoice = await storage.getRideInvoice(req.params.invoiceId);
      if (!invoice) {
        return res.status(404).send("<html><body><h1>Invoice not found</h1></body></html>");
      }

      // Verify access - same validation as JSON endpoint
      const driver = await storage.getDriverByUserId(req.userId);
      const isRecipient = invoice.recipientId === req.userId || 
                          (driver && invoice.recipientId === driver.id);

      if (!isRecipient) {
        return res.status(403).send("<html><body><h1>Access Denied</h1><p>You do not have permission to view this invoice.</p></body></html>");
      }

      // Generate HTML invoice
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
    <div class="row"><span>Pickup</span><span>${ride?.pickupAddress || 'N/A'}</span></div>
    <div class="row"><span>Dropoff</span><span>${ride?.dropoffAddress || 'N/A'}</span></div>
    <div class="row"><span>Distance</span><span>${ride?.distance || '0'} km</span></div>
    <div class="row"><span>Duration</span><span>${ride?.duration || '0'} min</span></div>
  </div>

  <div class="section">
    <div class="section-title">Payment</div>
    <div class="row"><span>Total Amount</span><span class="total">${invoice.currency} ${invoice.totalAmount}</span></div>
    ${invoice.invoiceType === 'driver' ? `
    <div class="row"><span>Platform Fee (10%)</span><span>-${invoice.currency} ${invoice.platformFee || '0.00'}</span></div>
    <div class="row"><span>Your Earnings</span><span style="color: #00B14F; font-weight: bold;">${invoice.currency} ${(parseFloat(invoice.totalAmount || '0') - parseFloat(invoice.platformFee || '0')).toFixed(2)}</span></div>
    ` : ''}
  </div>

  ${ride?.blockchainHash ? `
  <div class="section">
    <div class="section-title">Blockchain Verification</div>
    <div class="blockchain">
      <strong>Ride Hash:</strong><br>${ride.blockchainHash}
    </div>
  </div>
  ` : ''}

  <div class="footer">
    <p>Thank you for riding with Travony!</p>
    <p>Powered by blockchain technology for transparent pricing.</p>
  </div>
</body>
</html>`;
      
      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (error: any) {
      res.status(500).send(`<html><body><h1>Error loading invoice</h1><p>${error.message}</p></body></html>`);
    }
  });

  // ============ INTERNATIONAL REGION ROUTES ============

  // Initialize regions and service types on startup
  initializeRegions().catch(console.error);
  initializeServiceTypes().catch(console.error);

  // Get all available regions
  app.get("/api/regions", async (req, res) => {
    try {
      const allRegions = await getAllRegions();
      res.json(allRegions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get region by code
  app.get("/api/regions/:code", async (req, res) => {
    try {
      const region = await getRegionByCode(req.params.code);
      if (!region) {
        return res.status(404).json({ message: "Region not found" });
      }
      res.json(region);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all phone codes for international numbers
  app.get("/api/phone-codes", async (req, res) => {
    try {
      const codes = getPhoneCodesList();
      res.json(codes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Detect region from phone number
  app.post("/api/detect-region", async (req, res) => {
    try {
      const { phone } = req.body;
      const regionCode = await detectRegionFromPhone(phone || "");
      const region = await getRegionByCode(regionCode);
      res.json({ regionCode, region });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Calculate fare for a region
  app.post("/api/regions/:code/calculate-fare", async (req, res) => {
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
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ DISPUTE ROUTES ============

  // Create a dispute
  app.post("/api/disputes", requireAuth, async (req: any, res) => {
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
        message: result.resolved 
          ? "Your dispute has been automatically resolved based on our AI analysis." 
          : "Your dispute is being reviewed. We'll update you shortly.",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get disputes for a ride
  app.get("/api/rides/:id/disputes", requireAuth, async (req: any, res) => {
    try {
      const disputes = await getDisputesByRide(req.params.id);
      res.json(disputes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get user's disputes
  app.get("/api/my-disputes", requireAuth, async (req: any, res) => {
    try {
      const disputes = await getDisputesByUser(req.userId);
      res.json(disputes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Record telemetry for a ride (for GPS tracking)
  app.post("/api/rides/:id/telemetry", requireAuth, async (req: any, res) => {
    try {
      const { lat, lng, speed, heading, accuracy } = req.body;
      await recordTelemetry(req.params.id, lat, lng, speed, heading, accuracy);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ TRANSLATION & MESSAGING ROUTES ============

  // Get supported languages
  app.get("/api/languages", async (req, res) => {
    try {
      const languages = getSupportedLanguages();
      res.json(languages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get quick replies for a language
  app.get("/api/quick-replies/:language", async (req, res) => {
    try {
      const replies = getQuickReplies(req.params.language);
      res.json(replies);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Send a message in a ride
  app.post("/api/rides/:id/messages", requireAuth, async (req: any, res) => {
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
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get messages for a ride
  app.get("/api/rides/:id/messages", requireAuth, async (req: any, res) => {
    try {
      const messages = await getRideMessages(req.params.id);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ QUICK WIN FEATURES ============

  // Trip Sharing - Generate shareable link for ride tracking
  app.post("/api/rides/:id/share", requireAuth, async (req: any, res) => {
    try {
      const ride = await storage.getRide(req.params.id);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      if (ride.customerId !== req.userId && req.userRole !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      // Generate or return existing share token
      let shareToken = ride.shareToken;
      if (!shareToken) {
        shareToken = `share_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
        await storage.updateRide(req.params.id, { shareToken });
      }

      const baseUrl = process.env.EXPO_PUBLIC_DOMAIN || 'https://travony.replit.app';
      const shareUrl = `${baseUrl}/track/${shareToken}`;

      res.json({
        shareToken,
        shareUrl,
        message: "Share this link with friends or family to let them track your ride in real-time",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public ride tracking via share token (no auth required)
  app.get("/api/rides/track/:shareToken", async (req, res) => {
    try {
      const { rides } = await storage.getAllRides();
      const ride = rides.find((r: any) => r.shareToken === req.params.shareToken);
      
      if (!ride) {
        return res.status(404).json({ message: "Invalid or expired tracking link" });
      }

      // Return limited ride info for safety
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
        carbonFootprintKg: ride.carbonFootprintKg,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Add tip to completed ride
  app.post("/api/rides/:id/tip", requireAuth, async (req: any, res) => {
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

      // Update ride with tip
      await storage.updateRide(req.params.id, { tipAmount: amount.toString() });

      // Credit driver wallet with tip
      if (ride.driverId) {
        const driver = await storage.getDriver(ride.driverId);
        if (driver) {
          const currentBalance = parseFloat(driver.walletBalance || "0");
          await storage.updateDriver(ride.driverId, {
            walletBalance: (currentBalance + amount).toString(),
          });

          await storage.createWalletTransaction({
            id: uuidv4(),
            driverId: ride.driverId,
            rideId: ride.id,
            type: "tip",
            amount: amount.toString(),
            currency: ride.currency || "AED",
            status: "completed",
            description: `Tip from rider (100% yours, no platform cut)`,
            completedAt: new Date(),
          });
        }
      }

      res.json({ 
        success: true, 
        message: "Thank you for your generosity!",
        tipAmount: amount 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update driver minimum rider rating preference
  app.patch("/api/drivers/:driverId/rating-filter", requireAuth, async (req: any, res) => {
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

      const updates: any = {};
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
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get carbon footprint for a ride (calculated based on distance)
  app.get("/api/rides/:id/carbon", async (req, res) => {
    try {
      const ride = await storage.getRide(req.params.id);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }

      const distanceKm = parseFloat(ride.distance || "0");
      // Average car emits ~120g CO2 per km
      // Ridesharing reduces per-person emissions by ~50%
      const carbonKg = (distanceKm * 0.12 * 0.5).toFixed(3);
      const treesEquivalent = (parseFloat(carbonKg) / 21).toFixed(2); // 21kg CO2 per tree per year

      res.json({
        rideId: ride.id,
        distanceKm: distanceKm.toFixed(2),
        carbonFootprintKg: carbonKg,
        carbonSavedKg: (distanceKm * 0.12 * 0.5).toFixed(3), // Saved vs driving alone
        treesEquivalent,
        ecoMessage: `This shared ride saved ${carbonKg}kg of CO2 - equivalent to ${treesEquivalent} trees absorbing for a day!`
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Driver demand heatmap - shows high demand zones
  app.get("/api/drivers/heatmap", requireAuth, async (req: any, res) => {
    try {
      if (req.userRole !== "driver" && req.userRole !== "admin") {
        return res.status(403).json({ message: "Only drivers can access heatmap" });
      }

      // Get recent pending rides to calculate demand
      const { rides: allRides } = await storage.getAllRides();
      const recentRides = allRides.filter((r: any) => {
        const createdAt = new Date(r.createdAt);
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return createdAt > hourAgo && (r.status === "pending" || r.status === "accepted");
      });

      // Group by approximate zones (0.01 degree ~= 1km)
      const zones: Record<string, { lat: number; lng: number; demand: number; avgFare: number }> = {};
      
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

      // Calculate average fares
      Object.values(zones).forEach(zone => {
        if (zone.demand > 0) {
          zone.avgFare = Math.round(zone.avgFare / zone.demand);
        }
      });

      // Sort by demand and return top zones
      const hotspots = Object.values(zones)
        .sort((a, b) => b.demand - a.demand)
        .slice(0, 20)
        .map(zone => ({
          ...zone,
          intensity: zone.demand >= 5 ? "high" : zone.demand >= 2 ? "medium" : "low",
          color: zone.demand >= 5 ? "#ef4444" : zone.demand >= 2 ? "#f59e0b" : "#22c55e"
        }));

      res.json({
        hotspots,
        updatedAt: new Date().toISOString(),
        message: hotspots.length > 0 
          ? `${hotspots.length} active demand zones found` 
          : "No high demand areas right now"
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ CITY LAUNCH & ONBOARDING ROUTES ============

  initializeMexicoCityLaunch().catch(console.error);

  app.get("/api/expansion-cities", async (req, res) => {
    try {
      const cities = getExpansionCities();
      const tierGroups = {
        tier1: cities.filter(c => c.tier === 1),
        tier2: cities.filter(c => c.tier === 2),
        tier3: cities.filter(c => c.tier === 3),
      };
      res.json({
        total: cities.length,
        tiers: tierGroups,
        rolloutOrder: cities.sort((a, b) => a.launchOrder - b.launchOrder).map(c => ({
          order: c.launchOrder,
          name: c.name,
          slug: c.slug,
          region: c.regionCode,
          tier: c.tier,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/expansion-cities/:slug/config", async (req, res) => {
    try {
      const config = getCityConfig(req.params.slug);
      if (!config) {
        return res.status(404).json({ message: "City configuration not found" });
      }
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/cities", async (req, res) => {
    try {
      const allCities = await getAllCities();
      res.json(allCities);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/cities/:slug", async (req, res) => {
    try {
      const city = await getCityBySlug(req.params.slug);
      if (!city) {
        return res.status(404).json({ message: "City not found" });
      }
      res.json(city);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/cities/:cityId/health", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const health = await getCityHealth(req.params.cityId);
      if (!health) {
        return res.status(404).json({ message: "City not found" });
      }
      res.json(health);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/driver-intake", async (req, res) => {
    try {
      const { citySlug, channel, phone, name, referralCode } = req.body;
      if (!citySlug || !channel || !phone) {
        return res.status(400).json({ message: "City, channel, and phone are required" });
      }
      const intake = await recordDriverIntake({ citySlug, channel, phone, name, referralCode });
      res.json(intake);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/driver-documents", requireAuth, requireRole("driver"), async (req: any, res) => {
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
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/driver-documents", requireAuth, requireRole("driver"), async (req: any, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }
      const docs = await getDriverDocuments(driver.id);
      res.json(docs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/documents/:documentId/review", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const { status, notes } = req.body;
      if (!status || !["approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Valid status (approved/rejected) is required" });
      }
      const doc = await reviewDocument(req.params.documentId, req.userId, status, notes);
      res.json(doc);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/verification-queue", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const { cityId, status } = req.query;
      const queue = await getVerificationQueue(cityId as string, status as string);
      res.json(queue);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/driver/trust-protection", requireAuth, requireRole("driver"), async (req: any, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }
      const protection = await getTrustProtectionStatus(driver.id);
      res.json(protection || { isActive: false, message: "No protection plan active" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/education/modules", async (req, res) => {
    try {
      const { cityId } = req.query;
      const modules = await getEducationModules(cityId as string);
      res.json(modules);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/driver/education/progress", requireAuth, requireRole("driver"), async (req: any, res) => {
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
        completedCount: progress.filter(p => p.status === "completed").length,
        totalRequired: modules.filter(m => m.isRequired).length,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/driver/education/:moduleId/start", requireAuth, requireRole("driver"), async (req: any, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }
      const { moduleName } = req.body;
      const record = await startEducationModule(driver.id, req.params.moduleId, moduleName || req.params.moduleId);
      res.json(record);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/driver/education/:moduleId/complete", requireAuth, requireRole("driver"), async (req: any, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }
      const { score } = req.body;
      const record = await completeEducationModule(driver.id, req.params.moduleId, score);
      res.json(record);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/driver/referral-code", requireAuth, requireRole("driver"), async (req: any, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }
      const code = await generateReferralCode(driver.id);
      res.json({ referralCode: code });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/driver/champion-eligibility", requireAuth, requireRole("driver"), async (req: any, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }
      const eligibility = await checkChampionEligibility(driver.id);
      res.json(eligibility);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/driver/apply-champion", requireAuth, requireRole("driver"), async (req: any, res) => {
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
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/cities/:cityId/champions", requireAuth, async (req: any, res) => {
    try {
      const champions = await getCityChampions(req.params.cityId);
      res.json(champions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/champions/:championId/approve", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const champion = await approveChampion(req.params.championId);
      res.json(champion);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/cities/:cityId/launch-status", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ message: "Launch status is required" });
      }
      const city = await updateCityLaunchStatus(req.params.cityId, status);
      res.json(city);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/cities/:cityId/group-links", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const { telegramLink, whatsappLink } = req.body;
      const city = await updateCityGroupLinks(req.params.cityId, telegramLink, whatsappLink);
      res.json(city);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Weekly feedback emails for drivers
  app.post("/api/admin/send-weekly-feedback", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const driversResult = await storage.getAllDrivers();
      const weekEnd = new Date();
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      
      let sent = 0;
      let failed = 0;
      
      for (const driver of driversResult.drivers) {
        if (driver.status !== "approved") continue;
        
        const user = await storage.getUser(driver.userId);
        if (!user?.email) continue;
        
        // Get driver's rides from the past week
        const allRides = await storage.getRidesByDriver(driver.id);
        const weekRides = allRides.filter((r: any) => {
          const rideDate = new Date(r.completedAt || r.createdAt);
          return rideDate >= weekStart && rideDate <= weekEnd && r.status === "completed";
        });
        
        if (weekRides.length === 0) continue;
        
        // Calculate stats
        const totalEarnings = weekRides.reduce((sum: number, r: any) => {
          const fare = parseFloat(String(r.finalFare || r.estimatedFare || 0));
          return sum + (fare * 0.9);
        }, 0);
        
        // Get ratings for this week
        const ratings: { count: number; stars: number }[] = [];
        for (let i = 5; i >= 1; i--) {
          const count = weekRides.filter((r: any) => Math.round(r.driverRating || 0) === i).length;
          if (count > 0) ratings.push({ stars: i, count });
        }
        
        const ratedRides = weekRides.filter((r: any) => r.driverRating);
        const avgRating = ratedRides.length > 0
          ? ratedRides.reduce((sum: number, r: any) => sum + parseFloat(String(r.driverRating)), 0) / ratedRides.length
          : 5.0;
        
        // Get comments
        const recentComments = weekRides
          .filter((r: any) => r.driverFeedback)
          .slice(0, 5)
          .map((r: any) => ({
            comment: r.driverFeedback,
            rating: Math.round(r.driverRating || 5),
            date: new Date(r.completedAt || r.createdAt).toLocaleDateString()
          }));
        
        // Analyze strengths
        const topStrengths: string[] = [];
        if (avgRating >= 4.5) topStrengths.push("Excellent Service");
        if (weekRides.length >= 10) topStrengths.push("High Activity");
        const onTimeRatio = weekRides.filter((r: any) => !r.wasLate).length / weekRides.length;
        if (onTimeRatio >= 0.9) topStrengths.push("Punctual Pickups");
        
        const improvementAreas: string[] = [];
        if (avgRating < 4.0) improvementAreas.push("Work on improving customer satisfaction");
        if (onTimeRatio < 0.7) improvementAreas.push("Focus on arriving on time for pickups");
        
        const success = await sendWeeklyFeedbackEmail({
          driverName: user.name || user.email.split("@")[0],
          driverEmail: user.email,
          weekStartDate: weekStart.toLocaleDateString(),
          weekEndDate: weekEnd.toLocaleDateString(),
          totalRides: weekRides.length,
          totalEarnings: totalEarnings.toFixed(2),
          averageRating: avgRating,
          ratings,
          recentComments,
          topStrengths,
          improvementAreas
        });
        
        if (success) sent++;
        else failed++;
      }
      
      res.json({ message: `Weekly feedback emails: ${sent} sent, ${failed} failed` });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ CITY TEST & LAUNCH MODE ROUTES ============

  app.post("/api/admin/cities/:cityId/transition-mode", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const { mode } = req.body;
      if (!mode) {
        return res.status(400).json({ message: "Mode is required" });
      }
      const result = await cityTestService.transitionCityLaunchMode(req.params.cityId, mode);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/cities/:cityId/launch-status", async (req, res) => {
    try {
      const status = await cityTestService.getCityLaunchStatus(req.params.cityId);
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/cities/:cityId/test-progress", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const progress = await cityTestService.getCityTestProgress(req.params.cityId);
      res.json(progress);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/cities/:cityId/test/:testName", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const { status, failureReason } = req.body;
      if (!status || !["passed", "failed"].includes(status)) {
        return res.status(400).json({ message: "Status must be 'passed' or 'failed'" });
      }
      const progress = await cityTestService.updateTestStatus(
        req.params.cityId,
        req.params.testName,
        status,
        failureReason,
        req.userId
      );
      res.json(progress);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/cities/:cityId/founding-driver", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const { driverId } = req.body;
      if (!driverId) {
        return res.status(400).json({ message: "Driver ID is required" });
      }
      const tag = await cityTestService.tagDriverAsFounder(driverId, req.params.cityId, req.userId);
      res.json(tag);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/cities/:cityId/founding-drivers", async (req, res) => {
    try {
      const drivers = await cityTestService.getFoundingDrivers(req.params.cityId);
      res.json(drivers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/driver/invite-code", requireAuth, requireRole("driver"), async (req: any, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }
      const { cityId } = req.body;
      if (!cityId) {
        return res.status(400).json({ message: "City ID is required" });
      }
      const inviteCode = await cityTestService.generateRiderInviteCode(driver.id, cityId);
      res.json(inviteCode);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/rider/use-invite-code", requireAuth, async (req: any, res) => {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ message: "Invite code is required" });
      }
      const result = await cityTestService.useRiderInviteCode(code, req.userId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/driver/feedback", requireAuth, requireRole("driver"), async (req: any, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }
      const { cityId, category, feedback, confusionLevel, screenName, actionAttempted, question } = req.body;
      if (!category || !feedback) {
        return res.status(400).json({ message: "Category and feedback are required" });
      }
      const record = await cityTestService.submitDriverFeedback(
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
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/cities/:cityId/feedback", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const feedback = await cityTestService.getUnresolvedFeedback(req.params.cityId);
      res.json(feedback);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/feedback/:feedbackId/resolve", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const { resolution } = req.body;
      if (!resolution) {
        return res.status(400).json({ message: "Resolution is required" });
      }
      await cityTestService.resolveFeedback(req.params.feedbackId, resolution, req.userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/cities/:cityId/simulated-driver", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const { name } = req.body;
      const driver = await cityTestService.createSimulatedDriver(req.params.cityId, name || "Test Driver");
      res.json(driver);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/admin/cities/:cityId/simulated-rider", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const { name } = req.body;
      const rider = await cityTestService.createSimulatedRider(req.params.cityId, name || "Test Rider");
      res.json(rider);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/cities/:cityId/simulated-entities", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const { type } = req.query;
      const entities = await cityTestService.getSimulatedEntities(req.params.cityId, type as string | undefined);
      res.json(entities);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ ADMIN DASHBOARD API ROUTES ============

  app.get("/api/admin/dashboard/overview", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const overview = await adminDashboard.getDashboardOverview();
      res.json(overview);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/dashboard/riders", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const riders = await adminDashboard.getRidersList(page, limit);
      res.json(riders);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/dashboard/drivers", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;
      const drivers = await adminDashboard.getDriversList(page, limit, status);
      res.json(drivers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/dashboard/drivers/:driverId", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const driver = await adminDashboard.getDriverDetails(req.params.driverId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      res.json(driver);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/dashboard/drivers/:driverId/approve", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const result = await adminDashboard.approveDriver(req.params.driverId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/dashboard/drivers/:driverId/reject", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const { reason } = req.body;
      const result = await adminDashboard.rejectDriver(req.params.driverId, reason);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/dashboard/drivers/:driverId/suspend", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const { reason } = req.body;
      const result = await adminDashboard.suspendDriver(req.params.driverId, reason);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/dashboard/rides", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;
      const rides = await adminDashboard.getRidesList(page, limit, status);
      res.json(rides);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/dashboard/disputes", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const disputes = await adminDashboard.getDisputesList(page, limit);
      res.json(disputes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/dashboard/cities", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const cities = await adminDashboard.getCitiesList();
      res.json(cities);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/dashboard/analytics", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const period = (req.query.period as "day" | "week" | "month") || "week";
      const analytics = await adminDashboard.getAnalytics(period);
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/dashboard/verification-queue", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const queue = await adminDashboard.getVerificationQueue();
      res.json(queue);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/dashboard/driver-feedback", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const cityId = req.query.cityId as string | undefined;
      const feedback = await adminDashboard.getDriverFeedbackList(cityId);
      res.json(feedback);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/admin", (req, res) => {
    res.sendFile("admin-dashboard.html", { root: "./server/templates" });
  });

  app.get("/delete-account", (req, res) => {
    res.sendFile("data-deletion.html", { root: "./server/templates" });
  });

  app.get("/data-deletion", (req, res) => {
    res.sendFile("data-deletion.html", { root: "./server/templates" });
  });

  app.get("/privacy", (req, res) => {
    res.sendFile("privacy-policy.html", { root: "./server/templates" });
  });

  app.get("/terms", (req, res) => {
    res.sendFile("terms-of-service.html", { root: "./server/templates" });
  });

  app.get("/support", (req, res) => {
    res.sendFile("support.html", { root: "./server/templates" });
  });

  app.get("/drive", (req, res) => {
    res.sendFile("drive-with-us.html", { root: "./server/templates" });
  });

  app.get("/drive-with-us", (req, res) => {
    res.sendFile("drive-with-us.html", { root: "./server/templates" });
  });

  app.post("/api/driver-interest", async (req, res) => {
    try {
      const { name, phone, city, vehicleType, currentPlatform, referralCode } = req.body;
      console.log("[Driver Interest]", { name, phone, city, vehicleType, currentPlatform, referralCode });
      res.json({ success: true, message: "Interest registered successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/telegram/setup", async (req, res) => {
    try {
      const telegramBot = await import("./telegramBot");
      const webhookUrl = `https://travony.replit.app/api/webhook/telegram`;
      const webhookSet = await telegramBot.setWebhook(webhookUrl);
      const commandsSet = await telegramBot.setBotCommands();
      res.json({ success: true, webhook: webhookSet, commands: commandsSet });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/telegram/broadcast", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ message: "Message required" });
      const telegramBot = await import("./telegramBot");
      const sent = await telegramBot.broadcastCampaignMessage(message);
      res.json({ success: true, sent });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/campaign", (req, res) => {
    res.sendFile("campaign-hub.html", { root: "./server/templates" });
  });

  app.get("/api/meta/status", async (req, res) => {
    const GRAPH_API_URL = "https://graph.facebook.com/v21.0";
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
        missingPermissions: requiredPermissions,
      });
    }

    try {
      const [meRes, permRes, pagesRes] = await Promise.all([
        fetch(`${GRAPH_API_URL}/me?fields=id,name&access_token=${token}`),
        fetch(`${GRAPH_API_URL}/me/permissions?access_token=${token}`),
        fetch(`${GRAPH_API_URL}/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${token}`),
      ]);

      const meData = await meRes.json();
      const permData = await permRes.json();
      const pagesData = await pagesRes.json();

      const tokenValid = !meData.error;
      const userName = meData.name || null;

      const grantedPermissions: string[] = [];
      if (permData.data) {
        for (const p of permData.data) {
          if (p.status === "granted") grantedPermissions.push(p.permission);
        }
      }
      const missingPermissions = requiredPermissions.filter(
        (p) => !grantedPermissions.includes(p)
      );

      const pages: any[] = [];
      let instagramConnected = false;
      let instagramAccountId: string | null = null;

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

      let tokenExpires: string | null = null;
      if (appId && appSecret) {
        try {
          const debugRes = await fetch(
            `${GRAPH_API_URL}/debug_token?input_token=${token}&access_token=${appId}|${appSecret}`
          );
          const debugData = await debugRes.json();
          if (debugData.data?.expires_at) {
            tokenExpires = new Date(debugData.data.expires_at * 1000).toISOString();
          }
        } catch (e) {}
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
        missingPermissions,
      });
    } catch (error: any) {
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
        error: error.message,
      });
    }
  });

  app.get("/connect-instagram", (req, res) => {
    res.sendFile("instagram-connect.html", { root: "./server/templates" });
  });

  app.get("/facebook-posts", (req, res) => {
    res.sendFile("facebook-post.html", { root: "./server/templates" });
  });

  app.get("/facebook-login", (req, res) => {
    const appId = process.env.META_APP_ID;
    if (!appId) return res.send("META_APP_ID not configured");
    const redirectUri = `https://travony.replit.app/facebook-callback`;
    const scopes = "pages_show_list,pages_manage_posts,pages_read_engagement";
    const url = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&auth_type=rerequest`;
    res.redirect(url);
  });

  app.get("/facebook-callback", async (req, res) => {
    const code = req.query.code as string;
    const error = req.query.error as string;
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
      const tokenData = await tokenRes.json() as any;
      if (tokenData.error) {
        return res.send(`<html><body style="background:#0f0f0f;color:white;font-family:sans-serif;padding:40px;text-align:center;"><h2 style="color:#ff6b6b;">Token Error</h2><p>${tokenData.error.message}</p><a href="/facebook-login" style="color:#1877F2;">Try Again</a></body></html>`);
      }
      const userToken = tokenData.access_token;
      const longRes = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${userToken}`);
      const longData = await longRes.json() as any;
      const longToken = longData.access_token || userToken;
      const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,fan_count,category&limit=100&access_token=${longToken}`);
      const pagesData = await pagesRes.json() as any;
      const ig = await import("./instagramService");
      if (pagesData.data && pagesData.data.length > 0) {
        const travoneyPage = pagesData.data.find((p: any) => p.name?.toLowerCase().includes("travon")) || pagesData.data[0];
        let pageToken = travoneyPage.access_token;
        try {
          const longPageRes = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${pageToken}`);
          const longPageData = await longPageRes.json() as any;
          if (longPageData.access_token) pageToken = longPageData.access_token;
        } catch (e) {}
        ig.setPageToken(pageToken);
        ig.setPageInfo(travoneyPage.id, travoneyPage.name);
        const allPages = pagesData.data.map((p: any) => `${p.name} (${p.id}) - ${p.fan_count || 0} fans`).join("<br>");
        return res.send(`<html><body style="background:#0f0f0f;color:white;font-family:sans-serif;padding:40px;text-align:center;">
          <h2 style="color:#4ade80;">Connected Successfully!</h2>
          <p style="color:#b0b0b0;">Page: <strong style="color:white;">${travoneyPage.name}</strong> (ID: ${travoneyPage.id})</p>
          <p style="color:#b0b0b0;">Fans: ${travoneyPage.fan_count || 'N/A'}</p>
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
    } catch (err: any) {
      return res.send(`<html><body style="background:#0f0f0f;color:white;font-family:sans-serif;padding:40px;text-align:center;"><h2 style="color:#ff6b6b;">Error</h2><p>${err.message}</p><a href="/facebook-login" style="color:#1877F2;">Try Again</a></body></html>`);
    }
  });

  app.post("/api/facebook/save-page-token", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ success: false, error: "Token is required" });
      const ig = await import("./instagramService");
      const result = await ig.saveAndValidatePageToken(token);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/facebook/page-status", async (req, res) => {
    try {
      const ig = await import("./instagramService");
      const result = await ig.getPageStatus();
      res.json(result);
    } catch (error: any) {
      res.json({ connected: false, error: error.message });
    }
  });

  app.post("/api/facebook/test-post", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ success: false, error: "Message is required" });
      const ig = await import("./instagramService");
      const result = await ig.postToFacebookPage(message);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/facebook/post", async (req, res) => {
    try {
      const { message, link, imageUrl } = req.body;
      if (!message) return res.status(400).json({ success: false, error: "Message is required" });
      const ig = await import("./instagramService");
      const result = await ig.postToFacebookPage(message, link, imageUrl);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/instagram/save-token", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ success: false, error: "Token is required" });
      const ig = await import("./instagramService");
      ig.setToken(token);

      const refreshResult = await ig.refreshAccessToken();
      const discoverResult = await ig.discoverInstagramAccount();

      res.json({
        success: true,
        tokenExchanged: refreshResult.success,
        instagramDiscovered: discoverResult.success,
        igAccountId: discoverResult.igAccountId || null,
        message: discoverResult.success
          ? `Connected! Instagram account ${discoverResult.igAccountId} linked.`
          : `Token saved but: ${discoverResult.error || "Could not find Instagram Business Account"}`
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/instagram/post", async (req, res) => {
    try {
      const { imageUrl, caption } = req.body;
      if (!imageUrl || !caption) return res.status(400).json({ message: "imageUrl and caption required" });
      const ig = await import("./instagramService");
      const result = await ig.postImageToInstagram(imageUrl, caption);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/instagram/carousel", async (req, res) => {
    try {
      const { imageUrls, caption } = req.body;
      if (!imageUrls || !caption) return res.status(400).json({ message: "imageUrls and caption required" });
      const ig = await import("./instagramService");
      const result = await ig.postCarouselToInstagram(imageUrls, caption);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/instagram/reel", async (req, res) => {
    try {
      const { videoUrl, caption } = req.body;
      if (!videoUrl || !caption) return res.status(400).json({ message: "videoUrl and caption required" });
      const ig = await import("./instagramService");
      const result = await ig.postReelToInstagram(videoUrl, caption);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/instagram/refresh-token", async (req, res) => {
    try {
      const ig = await import("./instagramService");
      const result = await ig.refreshAccessToken();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/instagram/auth", async (req, res) => {
    try {
      const ig = await import("./instagramService");
      const redirectUri = `https://travony.replit.app/api/instagram/callback`;
      const authUrl = ig.getOAuthUrl(redirectUri);
      if (!authUrl) return res.status(500).json({ error: "Meta App ID not configured" });
      res.redirect(authUrl);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/instagram/callback", async (req, res) => {
    try {
      const { code, error: oauthError } = req.query;
      if (oauthError) return res.status(400).send(`OAuth error: ${oauthError}`);
      if (!code) return res.status(400).send("No authorization code received");

      const ig = await import("./instagramService");
      const redirectUri = `https://travony.replit.app/api/instagram/callback`;
      const result = await ig.exchangeCodeForToken(code as string, redirectUri);

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
    } catch (error: any) {
      res.status(500).send(`Error: ${error.message}`);
    }
  });

  app.get("/api/instagram/insights", async (req, res) => {
    try {
      const ig = await import("./instagramService");
      const result = await ig.getInstagramInsights();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/auth/tiktok", async (req, res) => {
    try {
      const tt = await import("./tiktokService");
      const redirectUri = `https://travony.replit.app/api/auth/tiktok/callback`;
      const authUrl = tt.getAuthUrl(redirectUri);
      if (!authUrl) return res.status(500).json({ error: "TikTok not configured" });
      res.json({ authUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/auth/tiktok/callback", async (req, res) => {
    try {
      const { code, error: authError } = req.query;
      if (authError || !code) {
        return res.redirect("/campaign?tiktok=error&msg=" + encodeURIComponent(String(authError || "No code")));
      }
      const tt = await import("./tiktokService");
      const redirectUri = `https://travony.replit.app/api/auth/tiktok/callback`;
      const result = await tt.exchangeCodeForToken(String(code), redirectUri);
      if (result.success) {
        res.redirect("/campaign?tiktok=connected");
      } else {
        res.redirect("/campaign?tiktok=error&msg=" + encodeURIComponent(result.error || "Failed"));
      }
    } catch (error: any) {
      res.redirect("/campaign?tiktok=error&msg=" + encodeURIComponent(error.message));
    }
  });

  app.get("/api/tiktok/status", async (req, res) => {
    try {
      const tt = await import("./tiktokService");
      if (!tt.isConnected()) {
        return res.json({ connected: false });
      }
      const info = await tt.getUserInfo();
      res.json(info);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tiktok/post-photo", async (req, res) => {
    try {
      const { imageUrls, title } = req.body;
      if (!imageUrls || !title) return res.status(400).json({ error: "imageUrls and title required" });
      const tt = await import("./tiktokService");
      const result = await tt.postPhotoToTikTok(imageUrls, title);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tiktok/post-video", async (req, res) => {
    try {
      const { videoUrl, title } = req.body;
      if (!videoUrl || !title) return res.status(400).json({ error: "videoUrl and title required" });
      const tt = await import("./tiktokService");
      const result = await tt.postVideoToTikTok(videoUrl, title);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Telegram Bot Webhook
  app.post("/api/webhook/telegram", async (req, res) => {
    try {
      const telegramBot = await import("./telegramBot");
      await telegramBot.processTelegramUpdate(req.body);
      res.sendStatus(200);
    } catch (error: any) {
      console.error("[Telegram Webhook] Error:", error);
      res.sendStatus(200);
    }
  });

  // WhatsApp Bot Webhook (Twilio)
  app.post("/api/webhook/whatsapp", async (req, res) => {
    try {
      const whatsappBot = await import("./whatsappBot");
      const response = await whatsappBot.processWhatsAppWebhook(req.body);
      if (response) {
        res.set("Content-Type", "text/xml");
        res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${response}</Message></Response>`);
      } else {
        res.sendStatus(200);
      }
    } catch (error: any) {
      console.error("[WhatsApp Webhook] Error:", error);
      res.sendStatus(200);
    }
  });

  // Bot Admin Endpoints
  app.post("/api/admin/telegram/set-webhook", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const telegramBot = await import("./telegramBot");
      const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(",")[0];
      const webhookUrl = `https://${domain}/api/webhook/telegram`;
      const success = await telegramBot.setWebhook(webhookUrl);
      res.json({ success, webhookUrl });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/broadcast", requireAuth, requireRole("admin"), async (req: any, res) => {
    try {
      const { message, channel } = req.body;
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }
      
      let telegramSent = 0;
      let whatsappSent = 0;
      
      if (channel === "telegram" || channel === "all") {
        const telegramBot = await import("./telegramBot");
        telegramSent = await telegramBot.broadcastToDrivers("mexico-city", message);
      }
      
      res.json({ success: true, sent: { telegram: telegramSent, whatsapp: whatsappSent } });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== PMGTH (Pay Me to Go Home) ROUTES ====================

  app.post("/api/pmgth/activate", requireAuth, async (req: any, res) => {
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

      const session = await pmgthService.activatePmgthSession(
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
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/pmgth/deactivate", requireAuth, async (req: any, res) => {
    try {
      const { userId } = req;
      const { reason } = req.body;

      const driver = await storage.getDriverByUserId(userId);
      if (!driver) {
        return res.status(403).json({ message: "Only drivers can use this feature" });
      }

      const session = await pmgthService.deactivatePmgthSession(driver.id, reason || "cancelled");

      if (session) {
        res.json({ 
          success: true, 
          session,
          message: "Going Home mode deactivated"
        });
      } else {
        res.json({ success: false, message: "No active session found" });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/pmgth/session", requireAuth, async (req: any, res) => {
    try {
      const { userId } = req;

      const driver = await storage.getDriverByUserId(userId);
      if (!driver) {
        return res.json({ active: false, session: null });
      }

      const session = await pmgthService.getActivePmgthSession(driver.id);

      if (session) {
        const stats = await pmgthService.getPmgthSessionStats(session.id);
        res.json({ 
          active: true, 
          session,
          stats
        });
      } else {
        res.json({ active: false, session: null });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/pmgth/home-address", requireAuth, async (req: any, res) => {
    try {
      const { userId } = req;

      const driver = await storage.getDriverByUserId(userId);
      if (!driver) {
        return res.status(403).json({ message: "Only drivers can access this" });
      }

      const homeAddress = await pmgthService.getDriverHomeAddress(driver.id);
      res.json({ homeAddress });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/pmgth/home-address", requireAuth, async (req: any, res) => {
    try {
      const { userId, userRole } = req;
      const { address, lat, lng } = req.body;

      console.log("POST /api/pmgth/home-address - userId:", userId, "role:", userRole);

      if (!address || lat === undefined || lng === undefined) {
        return res.status(400).json({ message: "Address, lat, and lng are required" });
      }

      // Check if user is a driver by role OR has a driver record
      let driver = await storage.getDriverByUserId(userId);
      if (!driver && userRole !== 'driver') {
        return res.status(403).json({ message: "Only drivers can save home address" });
      }
      
      // If user has driver role but no driver record, create one
      if (!driver && userRole === 'driver') {
        console.log("Creating driver record for user:", userId);
        driver = await storage.createDriver({
          userId,
          status: 'pending',
          isOnline: false,
          currentLat: lat.toString(),
          currentLng: lng.toString(),
        });
      }

      const homeAddress = await pmgthService.saveDriverHomeAddress(userId, {
        address,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      });
      
      res.json({ success: true, homeAddress });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/pmgth/compatible-rides", requireAuth, async (req: any, res) => {
    try {
      const { userId } = req;

      const driver = await storage.getDriverByUserId(userId);
      if (!driver) {
        return res.status(403).json({ message: "Only drivers can access this" });
      }

      const session = await pmgthService.getActivePmgthSession(driver.id);
      if (!session) {
        return res.json({ rides: [], message: "No active Going Home session" });
      }

      const pendingRides = await storage.getPendingRides();
      const compatibleRides = await pmgthService.findCompatibleRides(
        session,
        pendingRides.map(r => ({
          id: r.id,
          pickupLat: r.pickupLat,
          pickupLng: r.pickupLng,
          dropoffLat: r.dropoffLat,
          dropoffLng: r.dropoffLng,
          estimatedFare: r.estimatedFare,
        }))
      );

      res.json({ 
        rides: compatibleRides,
        sessionStats: await pmgthService.getPmgthSessionStats(session.id)
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/pmgth/drivers-for-ride/:rideId", requireAuth, async (req: any, res) => {
    try {
      const { rideId } = req.params;
      
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }

      const pmgthDrivers = await pmgthService.findPmgthDriversForRide(
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
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/pmgth/accept-match", requireAuth, async (req: any, res) => {
    try {
      const { userId } = req;
      const { rideId, sessionId } = req.body;

      const driver = await storage.getDriverByUserId(userId);
      if (!driver) {
        return res.status(403).json({ message: "Only drivers can accept matches" });
      }

      const session = await pmgthService.getActivePmgthSession(driver.id);
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
        estimatedFare: ride.estimatedFare,
      }];

      const [compatibility] = await pmgthService.findCompatibleRides(session, pendingRides);
      
      if (!compatibility) {
        return res.status(400).json({ message: "This ride is no longer compatible with your route" });
      }

      await pmgthService.recordPmgthRideMatch(session.id, rideId, compatibility, true);

      res.json({ 
        success: true,
        premiumAmount: compatibility.premiumAmount,
        message: `Ride accepted! You'll earn +$${compatibility.premiumAmount.toFixed(2)} premium.`
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/pmgth/config", async (req, res) => {
    res.json({
      maxAngleDeviation: pmgthService.DEFAULT_CONFIG.maxAngleDeviation,
      defaultDetourPercent: pmgthService.DEFAULT_CONFIG.defaultDetourPercent,
      minPremiumPercent: pmgthService.DEFAULT_CONFIG.minPremiumPercent,
      maxPremiumPercent: pmgthService.DEFAULT_CONFIG.maxPremiumPercent,
      maxPremiumCap: pmgthService.DEFAULT_CONFIG.maxPremiumCap,
      driverPremiumSharePercent: pmgthService.DEFAULT_CONFIG.driverPremiumSharePercent,
      maxDailySessions: pmgthService.DEFAULT_CONFIG.maxDailySessionsDefault,
      timeWindowOptions: [15, 30, 45, 60, 90, 120],
      detourOptions: [10, 15, 20, 25],
    });
  });

  app.get("/api/pmgth/check-availability", async (req, res) => {
    try {
      const { pickupLat, pickupLng, dropoffLat, dropoffLng, baseFare } = req.query;
      
      if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
        return res.status(400).json({ available: false, drivers: [], message: "Missing coordinates" });
      }

      const pmgthDrivers = await pmgthService.findPmgthDriversForRide(
        parseFloat(pickupLat as string),
        parseFloat(pickupLng as string),
        parseFloat(dropoffLat as string),
        parseFloat(dropoffLng as string),
        parseFloat(baseFare as string || "0")
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
    } catch (error: any) {
      res.status(500).json({ available: false, drivers: [], message: error.message });
    }
  });

  app.get("/api/guarantee/status", requireAuth, async (req: any, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(403).json({ message: "Only drivers can access this" });
      }

      const status = await guaranteeService.getGuaranteeStatus(driver.id);
      const recentPayout = await guaranteeService.getRecentPayout(driver.id);

      res.json({
        ...status,
        recentPayout,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/credits/recent", requireAuth, async (req: any, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      
      const credits = await accountabilityService.getRecentCredits(
        driver ? undefined : req.userId,
        driver?.id
      );
      
      const unseenCount = await accountabilityService.getUnseenCreditsCount(
        driver ? undefined : req.userId,
        driver?.id
      );

      res.json({ credits, unseenCount });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/credits/mark-seen", requireAuth, async (req: any, res) => {
    try {
      const { creditIds } = req.body;
      if (!creditIds || !Array.isArray(creditIds)) {
        return res.status(400).json({ message: "creditIds array required" });
      }
      
      await accountabilityService.markCreditsSeen(creditIds);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/payments/fx-rates", async (req, res) => {
    try {
      const rates = await pmgthPayment.fetchFxRates();
      res.json({ rates, timestamp: Date.now() });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/payments/pmgth/intent", requireAuth, async (req: any, res) => {
    try {
      const { rideId, driverId, baseFareUsd, premiumUsd, localCurrency } = req.body;
      
      if (!rideId || !driverId || baseFareUsd === undefined) {
        return res.status(400).json({ message: "Missing required fields: rideId, driverId, baseFareUsd" });
      }

      const intent = await pmgthPayment.createPaymentIntent(
        rideId,
        req.userId,
        driverId,
        parseFloat(baseFareUsd),
        parseFloat(premiumUsd || 0),
        localCurrency || "USD"
      );

      res.json({
        intentId: intent.intentId,
        displayAmount: pmgthPayment.formatLocalCurrency(intent.totalLocal, intent.localCurrency),
        breakdown: {
          baseFare: pmgthPayment.formatLocalCurrency(intent.baseFareLocal, intent.localCurrency),
          premium: intent.premiumLocal > 0 
            ? pmgthPayment.formatLocalCurrency(intent.premiumLocal, intent.localCurrency)
            : null,
          total: pmgthPayment.formatLocalCurrency(intent.totalLocal, intent.localCurrency),
        },
        premiumInfo: intent.premiumUsd > 0 ? {
          recipient: "Your driver",
          guaranteed: true,
          message: "Premium goes directly to the driver who is heading your way"
        } : null,
        expiresAt: intent.expiresAt,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/payments/pmgth/confirm", requireAuth, async (req: any, res) => {
    try {
      const { intentId } = req.body;
      
      if (!intentId) {
        return res.status(400).json({ message: "Missing intentId" });
      }

      const result = await pmgthPayment.fundEscrow(intentId);

      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }

      res.json({
        success: true,
        message: "Payment confirmed",
        premiumPaidInstantly: result.premiumPaidInstantly,
        escrowStatus: "funded",
        userMessage: result.premiumPaidInstantly 
          ? "Payment received. Your driver has received the faster pickup bonus."
          : "Payment received. Funds secured for your ride.",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/payments/pmgth/release", async (req, res) => {
    try {
      const { intentId } = req.body;
      
      if (!intentId) {
        return res.status(400).json({ message: "Missing intentId" });
      }

      const result = await pmgthPayment.releaseEscrow(intentId);

      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }

      res.json({
        success: true,
        message: "Ride completed. Payment released.",
        driverPayout: result.driverPayout,
        platformFee: result.platformFee,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/payments/pmgth/cancel", requireAuth, async (req: any, res) => {
    try {
      const { intentId, reason } = req.body;
      
      if (!intentId) {
        return res.status(400).json({ message: "Missing intentId" });
      }

      const result = await pmgthPayment.cancelEscrow(intentId, "rider", reason);

      res.json({
        success: true,
        riderRefund: result.riderRefund,
        driverKeepsPremium: result.driverKeepsPremium,
        message: result.driverKeepsPremium 
          ? "Ride cancelled. The faster pickup bonus remains with the driver as compensation."
          : "Ride cancelled. Full refund processed.",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/payments/pmgth/status/:intentId", async (req, res) => {
    try {
      const status = await pmgthPayment.getEscrowStatus(req.params.intentId);
      
      if (!status) {
        return res.status(404).json({ message: "Payment not found" });
      }

      res.json({
        status: status.status,
        displayTotal: pmgthPayment.formatLocalCurrency(status.totalLocal, status.localCurrency),
        premiumPaid: status.premiumPaid,
        currency: status.localCurrency,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/driver/pmgth-earnings", requireAuth, async (req: any, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.userId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }

      const earnings = await pmgthPayment.getDriverPmgthEarnings(driver.id);
      
      res.json({
        totalEarned: `$${earnings.totalPremiumsEarned.toFixed(2)}`,
        ridesWithBonus: earnings.ridesWithPremium,
        averageBonus: `$${earnings.averagePremium.toFixed(2)}`,
        message: earnings.ridesWithPremium > 0 
          ? `You've earned $${earnings.totalPremiumsEarned.toFixed(2)} in faster pickup bonuses from ${earnings.ridesWithPremium} rides.`
          : "Activate Going Home mode to earn bonuses on rides heading your way.",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== RIDE TRUTH ENGINE API =====

  app.post("/api/truth/consent", requireAuth, async (req: any, res) => {
    try {
      const { screenshots, notifications, gpsTrace, screenshotCapture, notificationParsing, gpsTracking, postRideConfirmation } = req.body;
      await truthFraud.grantConsent(req.userId, {
        screenshotCapture: screenshotCapture ?? screenshots ?? false,
        notificationParsing: notificationParsing ?? notifications ?? false,
        gpsTracking: gpsTracking ?? gpsTrace ?? false,
        postRideConfirmation: postRideConfirmation ?? true,
      });
      res.json({ message: "Consent updated successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/truth/consent", requireAuth, async (req: any, res) => {
    try {
      const result = await truthEngine.checkUserConsent(req.userId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/truth/consent", requireAuth, async (req: any, res) => {
    try {
      await truthFraud.revokeConsent(req.userId);
      res.json({ message: "Consent revoked" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/truth/data", requireAuth, async (req: any, res) => {
    try {
      const result = await truthFraud.deleteUserTruthData(req.userId);
      res.json({ message: `Deleted ${result.deletedRides} rides and all associated data` });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/truth/rides", requireAuth, async (req: any, res) => {
    try {
      const consent = await truthEngine.checkUserConsent(req.userId);
      if (!consent.hasConsent) {
        return res.status(403).json({ message: "Truth Engine consent required. Please grant consent first." });
      }

      const { providerName, screenshotBase64, notificationText, gpsTrace, rideDate, postRideAnswers, cityName } = req.body;

      let signals: any = {};
      let extractionMethod = "manual";

      if (screenshotBase64) {
        signals = await truthEngine.extractSignalsFromScreenshot(screenshotBase64);
        extractionMethod = "screenshot_ai";
      }

      if (notificationText) {
        const notifSignals = truthEngine.extractSignalsFromNotification(notificationText);
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
        gpsAnalysis = truthEngine.analyzeGpsTrace(gpsTrace);
        if (gpsAnalysis.distanceKm > 0) {
          signals.actualDistanceKm = gpsAnalysis.distanceKm;
          signals.actualDurationMin = gpsAnalysis.durationMin;
        }
      }

      const resolvedProviderName = signals.providerName || providerName || "Unknown";
      const providerId = await truthEngine.getOrCreateProvider(resolvedProviderName);

      const fraudCheck = await truthFraud.validateRideSubmission(
        req.userId, providerId, cityName || "Unknown", gpsTrace
      );

      const rideDateObj = rideDate ? new Date(rideDate) : new Date();
      const timeBlock = truthEngine.getTimeBlock(rideDateObj);
      const distance = signals.actualDistanceKm || signals.expectedDistanceKm;
      const routeType = distance ? truthEngine.getRouteType(distance) : undefined;

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
        proofOfRide: !!(gpsAnalysis?.isConsistent) || !!screenshotBase64,
        pickupLat: gpsTrace?.[0]?.lat?.toString(),
        pickupLng: gpsTrace?.[0]?.lng?.toString(),
        dropoffLat: gpsTrace?.[gpsTrace.length - 1]?.lat?.toString(),
        dropoffLng: gpsTrace?.[gpsTrace.length - 1]?.lng?.toString(),
      }).returning();

      await truthEngine.storeSignals(truthRide.id, signals, extractionMethod);

      const score = await truthScoring.computeAndStorePRTS(truthRide.id);

      await truthAggregation.updateAggregationCache(providerId, cityName || "Unknown", timeBlock, routeType);

      res.json({
        truthRideId: truthRide.id,
        score: score.totalScore,
        explanation: score.explanation,
        breakdown: {
          priceIntegrity: score.priceIntegrityScore,
          pickupReliability: score.pickupReliabilityScore,
          cancellation: score.cancellationScore,
          routeIntegrity: score.routeIntegrityScore,
          supportResolution: score.supportResolutionScore,
        },
        fraudFlags: fraudCheck.flags,
        provider: resolvedProviderName,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/truth/rides/:id/score", requireAuth, async (req: any, res) => {
    try {
      const [score] = await db.select().from(truthScores)
        .where(eq(truthScores.truthRideId, req.params.id))
        .limit(1);

      if (!score) return res.status(404).json({ message: "Score not found" });

      res.json({
        totalScore: parseFloat(score.totalScore),
        priceIntegrity: parseFloat(score.priceIntegrityScore || "0"),
        pickupReliability: parseFloat(score.pickupReliabilityScore || "0"),
        cancellation: parseFloat(score.cancellationScore || "0"),
        routeIntegrity: parseFloat(score.routeIntegrityScore || "0"),
        supportResolution: parseFloat(score.supportResolutionScore || "0"),
        explanation: score.explanation,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/truth/rankings", requireAuth, async (req: any, res) => {
    try {
      const { city, timeBlock, routeType } = req.query;
      if (!city) return res.status(400).json({ message: "City parameter required" });

      const result = await truthRecommendation.getContextualRankings(
        city as string,
        timeBlock as string | undefined,
        routeType as string | undefined
      );

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/truth/recommend", requireAuth, async (req: any, res) => {
    try {
      const { city, timeBlock, routeType } = req.query;
      if (!city) return res.status(400).json({ message: "City parameter required" });

      const recommendation = await truthRecommendation.getRecommendation(
        city as string,
        timeBlock as string | undefined,
        routeType as string | undefined
      );

      if (!recommendation) {
        return res.json({ hasRecommendation: false, message: "Not enough data for a recommendation yet." });
      }

      res.json({ hasRecommendation: true, recommendation });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/truth/providers", async (_req, res) => {
    try {
      const providers = await db.select().from(truthProviders).where(eq(truthProviders.isActive, true));
      res.json(providers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/truth/my-rides", requireAuth, async (req: any, res) => {
    try {
      const userRides = await db.select({
        ride: truthRides,
        score: truthScores,
      })
        .from(truthRides)
        .leftJoin(truthScores, eq(truthScores.truthRideId, truthRides.id))
        .where(eq(truthRides.userId, req.userId))
        .orderBy(desc(truthRides.rideDate))
        .limit(50);

      res.json(userRides.map(r => ({
        id: r.ride.id,
        providerId: r.ride.providerId,
        cityName: r.ride.cityName,
        rideDate: r.ride.rideDate,
        quotedPrice: r.ride.quotedPrice,
        finalPrice: r.ride.finalPrice,
        score: r.score ? parseFloat(r.score.totalScore) : null,
        explanation: r.score?.explanation,
        isFromTravony: r.ride.isFromTravony,
      })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== GHOST MODE API =====

  app.post("/api/ghost/rides", requireAuth, async (req: any, res) => {
    try {
      const rideId = await ghostRideService.createGhostRide({
        ...req.body,
        riderId: req.userId,
      });
      res.json({ ghostRideId: rideId, message: "Ghost ride created" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ghost/rides/accept", requireAuth, async (req: any, res) => {
    try {
      await ghostRideService.acceptGhostRide(req.body);
      res.json({ message: "Ghost ride accepted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ghost/rides/start", requireAuth, async (req: any, res) => {
    try {
      await ghostRideService.startGhostRide(req.body.localId);
      res.json({ message: "Ghost ride started" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ghost/rides/complete", requireAuth, async (req: any, res) => {
    try {
      await ghostRideService.completeGhostRide(req.body);
      res.json({ message: "Ghost ride completed" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ghost/sync", requireAuth, async (req: any, res) => {
    try {
      const rideResults = await ghostRideService.syncAllPendingGhostRides(req.userId);
      const queueResults = await ghostRideService.processSyncQueue(req.userId);

      res.json({
        rides: rideResults,
        queue: queueResults,
        message: `Synced ${rideResults.filter(r => r.success).length} rides`,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/ghost/rides", requireAuth, async (req: any, res) => {
    try {
      const userGhostRides = await db.select()
        .from(ghostRides)
        .where(eq(ghostRides.riderId, req.userId))
        .orderBy(desc(ghostRides.createdAt))
        .limit(50);

      res.json(userGhostRides);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/ghost/pricing/:city", requireAuth, async (req: any, res) => {
    try {
      const pricing = await ghostRideService.getCachedPricingForCity(req.params.city);
      res.json(pricing);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ghost/estimate", requireAuth, async (req: any, res) => {
    try {
      const { cityName, vehicleType, distanceKm, durationMin } = req.body;
      const estimate = await ghostRideService.calculateOfflineFare(
        cityName, vehicleType, distanceKm, durationMin
      );
      res.json(estimate);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== AUTO-FEED TRAVONY RIDES TO TRUTH ENGINE =====

  app.post("/api/truth/auto-feed/:rideId", requireAuth, async (req: any, res) => {
    try {
      const [ride] = await db.select().from(rides)
        .where(and(eq(rides.id, req.params.rideId), eq(rides.status, "completed")))
        .limit(1);

      if (!ride) return res.status(404).json({ message: "Completed ride not found" });

      const providerId = await truthEngine.getOrCreateProvider("Travony");
      const rideDateObj = ride.completedAt || ride.createdAt;
      const timeBlock = truthEngine.getTimeBlock(rideDateObj);
      const distance = ride.distance ? parseFloat(ride.distance) : undefined;
      const routeType = distance ? truthEngine.getRouteType(distance) : undefined;

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
        dropoffLng: ride.dropoffLng,
      }).returning();

      const score = await truthScoring.computeAndStorePRTS(truthRide.id);

      res.json({
        truthRideId: truthRide.id,
        score: score.totalScore,
        message: "Travony ride auto-fed to Truth Engine",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== ADMIN: TRUTH ENGINE & GHOST MODE DASHBOARD =====

  app.get("/api/admin/truth/stats", requireAuth, async (req: any, res) => {
    try {
      const [totalRides] = await db.select({ count: count() }).from(truthRides);
      const [totalScores] = await db.select({ count: count() }).from(truthScores);
      const [totalProviders] = await db.select({ count: count() }).from(truthProviders);
      const [totalConsents] = await db.select({ count: count() }).from(truthConsent);
      const [totalGhost] = await db.select({ count: count() }).from(ghostRides);
      const [pendingSync] = await db.select({ count: count() })
        .from(ghostRides)
        .where(eq(ghostRides.syncStatus, "pending"));

      res.json({
        truthRides: totalRides?.count || 0,
        scoredRides: totalScores?.count || 0,
        providers: totalProviders?.count || 0,
        consentedUsers: totalConsents?.count || 0,
        ghostRides: totalGhost?.count || 0,
        pendingGhostSync: pendingSync?.count || 0,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/truth/rankings/:city", requireAuth, async (req: any, res) => {
    try {
      const rankings = await truthAggregation.getRankings(req.params.city);
      res.json(rankings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/ghost/rides", requireAuth, async (req: any, res) => {
    try {
      const allGhost = await db.select()
        .from(ghostRides)
        .orderBy(desc(ghostRides.createdAt))
        .limit(100);

      res.json(allGhost);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.use(openClawRouter);

  const httpServer = createServer(app);

  return httpServer;
}
