import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import * as fs from "fs";
import * as path from "path";
import swaggerUi from "swagger-ui-express";
import { apiSpec } from "./apiSpec";
import { apiKeyMiddleware } from "./apiKeyMiddleware";
import { setupTaxiModeRoutes } from "./taxiModeRoutes";

const app = express();
const log = console.log;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

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
        "GET, POST, PUT, PATCH, DELETE, OPTIONS",
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

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;

      const duration = Date.now() - start;

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    });

    next();
  });
}

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, req: Request, res: Response) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
  }

  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");

  let manifest = fs.readFileSync(manifestPath, "utf-8");
  
  // In development, rewrite URLs to include port 5000 so Expo Go fetches from Express server
  if (process.env.NODE_ENV === "development") {
    const forwardedHost = req.header("x-forwarded-host") || req.get("host") || "";
    const baseDomain = forwardedHost.replace(/:.*$/, "");
    
    if (baseDomain && !forwardedHost.includes(":5000")) {
      // Replace domain without port to domain:5000
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
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  
  // For Expo Go deep links, we need to ensure it points to port 5000 (Express server)
  // which serves the static builds, not port 80 which goes to Metro
  let expsUrl = host || "";
  // If host doesn't include port 5000, add it for exps:// protocol
  if (!host?.includes(":5000") && process.env.NODE_ENV === "development") {
    // In development, the host may not include the port, so we need to use the base domain with port 5000
    const baseDomain = (host || "").replace(/:.*$/, "") || host || "";
    expsUrl = `${baseDomain}:5000`;
  }

  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function configureExpoAndLanding(app: express.Application) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html",
  );
  const adminTemplatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "admin-dashboard.html",
  );
  const fleetDashboardTemplatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "fleet-dashboard.html",
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const adminDashboardTemplate = fs.existsSync(adminTemplatePath) 
    ? fs.readFileSync(adminTemplatePath, "utf-8") 
    : null;
  const fleetDashboardTemplate = fs.existsSync(fleetDashboardTemplatePath)
    ? fs.readFileSync(fleetDashboardTemplatePath, "utf-8")
    : null;
  const fleetLoginTemplatePath = path.resolve(
    process.cwd(), "server", "templates", "fleet-login.html",
  );
  const fleetLoginTemplate = fs.existsSync(fleetLoginTemplatePath)
    ? fs.readFileSync(fleetLoginTemplatePath, "utf-8")
    : null;
  const healthTemplatePath = path.resolve(
    process.cwd(), "server", "templates", "system-health.html",
  );
  const healthTemplate = fs.existsSync(healthTemplatePath)
    ? fs.readFileSync(healthTemplatePath, "utf-8")
    : null;
  const appName = getAppName();

  log("Serving static Expo files with dynamic manifest routing");

  app.get("/admin", (_req: Request, res: Response) => {
    if (adminDashboardTemplate) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(adminDashboardTemplate);
    } else {
      res.status(404).send("Admin dashboard not found");
    }
  });

  // Internal "system wiring" health page. Auth happens client-side against the
  // admin-only /api/admin/health endpoint (same Bearer-token pattern as /admin).
  app.get("/admin/health", (_req: Request, res: Response) => {
    if (healthTemplate) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(healthTemplate);
    } else {
      res.status(404).send("System health page not found");
    }
  });

  // /dashboard/fleet — server-side protected: verify HttpOnly fleet_token cookie
  app.get("/dashboard/fleet", async (req: Request, res: Response) => {
    if (!fleetDashboardTemplate) {
      return res.status(404).send("Fleet dashboard not found");
    }
    const cookieHeader = req.headers.cookie || "";
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)fleet_token=([^;]+)/);
    const cookieToken = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
    if (cookieToken) {
      try {
        const { db: dbModule } = await import("./db");
        const { sessions } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");
        const [session] = await dbModule.select().from(sessions).where(eq(sessions.token, cookieToken)).limit(1);
        if (session && new Date() <= session.expiresAt && ["fleet_owner", "admin"].includes(session.role)) {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          return res.status(200).send(fleetDashboardTemplate);
        }
      } catch {
        // Invalid/expired cookie — fall through to 401
      }
    }
    // Not authenticated: return 401 with redirect instruction
    res.status(401).send(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta http-equiv="refresh" content="0;url=/dashboard/fleet/login">
<title>Redirecting...</title></head><body>
<p>Authentication required. <a href="/dashboard/fleet/login">Sign in</a></p>
</body></html>`);
  });

  // /dashboard/fleet/login — public login page
  app.get("/dashboard/fleet/login", (_req: Request, res: Response) => {
    const tpl = fleetLoginTemplate || fleetDashboardTemplate;
    if (!tpl) return res.status(404).send("Fleet login page not found");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(tpl);
  });

  // /api/fleet/auth/login — sets HttpOnly cookie for dashboard session
  app.post("/api/fleet/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      const { storage: storageModule } = await import("./storage");
      const user = await storageModule.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const { scryptSync, timingSafeEqual } = await import("crypto");
      const [salt, stored] = user.password.split(":");
      const newHash = scryptSync(password, salt, 64).toString("hex");
      const storedBuf = Buffer.from(stored, "hex");
      const newBuf = Buffer.from(newHash, "hex");
      if (storedBuf.length !== newBuf.length || !timingSafeEqual(storedBuf, newBuf)) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      if (!["fleet_owner", "admin"].includes(user.role)) {
        return res.status(403).json({ error: "Access restricted to fleet owners and administrators" });
      }
      const { randomBytes } = await import("crypto");
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await storageModule.createSession(token, user.id, user.role, expiresAt);
      // Set HttpOnly cookie for server-side auth on /dashboard/fleet
      res.cookie("fleet_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: expiresAt,
        path: "/",
      });
      // Return token in body for localStorage (API Bearer auth) + set HttpOnly cookie for page auth
      res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed";
      res.status(500).json({ error: message });
    }
  });

  // /api/fleet/auth/logout — clears HttpOnly cookie AND invalidates DB session token
  app.post("/api/fleet/auth/logout", async (req: Request, res: Response) => {
    try {
      // Invalidate cookie-based token
      const cookieHeader = req.headers.cookie || "";
      const cookieMatch = cookieHeader.match(/(?:^|;\s*)fleet_token=([^;]+)/);
      if (cookieMatch?.[1]) {
        const { storage: storageModule } = await import("./storage");
        await storageModule.deleteSession(cookieMatch[1]).catch(() => null);
      }
      // Also invalidate Bearer token if provided (belt-and-suspenders)
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const bearerToken = authHeader.slice(7);
        const { storage: storageModule } = await import("./storage");
        await storageModule.deleteSession(bearerToken).catch(() => null);
      }
    } catch {
      // Best-effort: always clear cookie and return success
    }
    res.clearCookie("fleet_token", { path: "/" });
    res.json({ success: true });
  });

  // Policy pages for Google Play Store compliance
  const privacyPolicyPath = path.resolve(process.cwd(), "server", "templates", "privacy-policy.html");
  const termsOfServicePath = path.resolve(process.cwd(), "server", "templates", "terms-of-service.html");
  const dataDeletionPath = path.resolve(process.cwd(), "server", "templates", "data-deletion.html");
  const supportPath = path.resolve(process.cwd(), "server", "templates", "support.html");

  app.get("/privacy", (_req: Request, res: Response) => {
    if (fs.existsSync(privacyPolicyPath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).sendFile(privacyPolicyPath);
    } else {
      res.status(404).send("Privacy Policy not found");
    }
  });

  app.get("/terms", (_req: Request, res: Response) => {
    if (fs.existsSync(termsOfServicePath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).sendFile(termsOfServicePath);
    } else {
      res.status(404).send("Terms of Service not found");
    }
  });

  app.get("/delete-account", (_req: Request, res: Response) => {
    if (fs.existsSync(dataDeletionPath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).sendFile(dataDeletionPath);
    } else {
      res.status(404).send("Account Deletion page not found");
    }
  });

  app.get("/data-deletion", (_req: Request, res: Response) => {
    if (fs.existsSync(dataDeletionPath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).sendFile(dataDeletionPath);
    } else {
      res.status(404).send("Data Deletion page not found");
    }
  });

  app.get("/support", (_req: Request, res: Response) => {
    if (fs.existsSync(supportPath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).sendFile(supportPath);
    } else {
      res.status(404).send("Support page not found");
    }
  });

  app.get("/payment-success", (_req: Request, res: Response) => {
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
          <div class="icon">✓</div>
          <h1>Payment Successful!</h1>
          <p>Your wallet has been topped up. You can close this window and return to the app.</p>
          <a href="/">Return to App</a>
        </div>
      </body>
      </html>
    `);
  });

  app.get("/payment-cancelled", (_req: Request, res: Response) => {
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
          <div class="icon">✕</div>
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

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    // Log all non-API requests to debug Expo Go connectivity
    const expoPlatform = req.header("expo-platform");
    const expoRuntimeVersion = req.header("expo-runtime-version");
    const userAgent = req.header("user-agent") || "";
    
    if (req.path === "/" || req.path === "/manifest" || expoPlatform || expoRuntimeVersion || userAgent.includes("Expo")) {
      log(`Expo request: ${req.method} ${req.path} platform=${expoPlatform || 'none'} runtime=${expoRuntimeVersion || 'none'} ua=${userAgent.slice(0, 50)}`);
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
        appName,
      });
    }

    next();
  });

  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app.use(express.static(path.resolve(process.cwd(), "static-build")));
  
  // Serve PWA files (manifest.json, service worker, icons)
  app.use(express.static(path.resolve(process.cwd(), "server", "public")));

  log("Expo routing: Checking expo-platform header on / and /manifest");
  log("PWA: Serving manifest.json and service worker from /server/public");
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const { AppError, isAppError } = require("./errors");
    
    let statusCode = 500;
    let errorResponse: Record<string, any> = {
      error: "InternalServerError",
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    };

    if (isAppError(err)) {
      statusCode = err.statusCode;
      errorResponse = err.toJSON();
    } else if (err instanceof Error) {
      errorResponse.message = err.message;
    }

    const timestamp = new Date().toISOString();
    if (statusCode >= 500) {
      console.error(`[${timestamp}] ERROR ${req.method} ${req.path} [${errorResponse.code}]: ${errorResponse.message}`);
      if (err instanceof Error && err.stack) {
        console.error(err.stack);
      }
    } else {
      console.warn(`[${timestamp}] WARN ${req.method} ${req.path} [${errorResponse.code}]: ${errorResponse.message}`);
    }

    if (process.env.NODE_ENV !== "production" && err instanceof Error) {
      errorResponse.stack = err.stack;
    }

    res.status(statusCode).json(errorResponse);
  });
}

async function seedAdminUser(): Promise<void> {
  const { scryptSync, randomBytes } = await import("crypto");
  const { v4: uuidv4 } = await import("uuid");
  const { db } = await import("./db");
  const { users } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  
  const existing = await db.select().from(users).where(eq(users.email, "admin@travony.com")).limit(1);
  
  if (existing.length === 0) {
    const adminPassword = process.env.ADMIN_PASSWORD || "Travony2024!";
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(adminPassword, salt, 64).toString("hex");
    
    await db.insert(users).values({
      id: uuidv4(),
      email: "admin@travony.com",
      password: `${salt}:${hash}`,
      name: "Travony Admin",
      phone: "+1000000000",
      role: "admin",
    });
    log("Admin user created: admin@travony.com");
  }
}

function setupDeveloperPortal(app: express.Application) {
  const developerPortalPath = path.resolve(
    process.cwd(), "server", "templates", "developer-portal.html"
  );

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(apiSpec, {
    customSiteTitle: "Travony API Docs",
    customCss: `
      .swagger-ui .topbar { background: #0a0d12; border-bottom: 1px solid #1e2740; }
      .swagger-ui .topbar-wrapper img { display: none; }
      .swagger-ui .topbar-wrapper::before { content: 'Travony API'; color: #3b82f6; font-weight: 800; font-size: 18px; }
      .swagger-ui { background: #0a0d12; }
      .swagger-ui .info .title { color: #e2e8f0; }
    `,
    swaggerOptions: { persistAuthorization: true },
  }));

  app.get("/developer", (_req: Request, res: Response) => {
    if (fs.existsSync(developerPortalPath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(fs.readFileSync(developerPortalPath, "utf-8"));
    } else {
      res.redirect("/api/docs");
    }
  });

  log("Developer portal: /developer");
  log("Swagger UI: /api/docs");
}

async function resolveSessionUser(req: Request) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const { db } = await import("./db");
  const { sessions, users } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  const [session] = await db.select().from(sessions).where(eq(sessions.token, token)).limit(1);
  if (!session || new Date() > session.expiresAt) return null;
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  return user || null;
}

async function setupApiKeyRoutes(app: express.Application) {
  app.use(apiKeyMiddleware);

  // Self-serve: any authenticated user can create and manage their own partner
  // keys. This is what makes the Partner API a self-serve product rather than an
  // admin-gated one.
  app.get("/api/api-keys", async (req: Request, res: Response) => {
    try {
      const user = await resolveSessionUser(req);
      if (!user) {
        return res.status(401).json({ error: "Sign in to manage API keys" });
      }
      const { db } = await import("./db");
      const { apiKeys } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const keys = await db.select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        planTier: apiKeys.planTier,
        isActive: apiKeys.isActive,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
      }).from(apiKeys).where(eq(apiKeys.ownerId, user.id));
      res.json(keys);
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to list keys" });
    }
  });

  app.post("/api/api-keys", async (req: Request, res: Response) => {
    try {
      const user = await resolveSessionUser(req);
      if (!user) {
        return res.status(401).json({ error: "Sign in to create an API key" });
      }
      const { name, scopes } = req.body;
      if (!name || !Array.isArray(scopes) || scopes.length === 0) {
        return res.status(400).json({ error: "name and a non-empty scopes array are required" });
      }
      const { isValidScope, canonicalScope } = await import("./partnerApi");
      const invalid = scopes.filter((s: unknown) => typeof s !== "string" || !isValidScope(s));
      if (invalid.length) {
        return res.status(400).json({
          error: "Invalid scopes",
          code: "INVALID_SCOPE",
          invalid,
          message: "One or more requested scopes are not part of the partner scope catalog.",
        });
      }
      // Store canonical scope names so aliases never end up persisted.
      const normalizedScopes = Array.from(new Set(scopes.map((s: string) => canonicalScope(s))));
      const { generateApiKey } = await import("./apiKeyMiddleware");
      const { key, prefix, hash } = generateApiKey();
      const { db } = await import("./db");
      const { apiKeys } = await import("@shared/schema");
      const { v4: uuidv4 } = await import("uuid");
      const [created] = await db.insert(apiKeys).values({
        id: uuidv4(),
        ownerId: user.id,
        name,
        keyPrefix: prefix,
        keyHash: hash,
        scopes: normalizedScopes,
        planTier: "free",
        isActive: true,
      }).returning();
      res.status(201).json({
        key,
        id: created.id,
        name: created.name,
        scopes: created.scopes,
        planTier: created.planTier,
        warning: "Store this key securely — it will not be shown again.",
      });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to create key" });
    }
  });

  // Per-key usage for the owner's dashboard (session-authenticated).
  app.get("/api/api-keys/:id/usage", async (req: Request, res: Response) => {
    try {
      const user = await resolveSessionUser(req);
      if (!user) {
        return res.status(401).json({ error: "Sign in to view usage" });
      }
      const { db } = await import("./db");
      const { apiKeys } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      const [keyRow] = await db.select().from(apiKeys)
        .where(and(eq(apiKeys.id, req.params.id), eq(apiKeys.ownerId, user.id)))
        .limit(1);
      if (!keyRow) return res.status(404).json({ error: "API key not found" });
      const { getUsageSummary } = await import("./partnerApi");
      const summary = await getUsageSummary(keyRow.id, keyRow.planTier);
      res.json({ keyId: keyRow.id, name: keyRow.name, ...summary });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load usage" });
    }
  });

  app.delete("/api/api-keys/:id", async (req: Request, res: Response) => {
    try {
      const user = await resolveSessionUser(req);
      if (!user) {
        return res.status(401).json({ error: "Sign in to revoke API keys" });
      }
      const { db } = await import("./db");
      const { apiKeys } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      await db.update(apiKeys)
        .set({ isActive: false })
        .where(and(eq(apiKeys.id, req.params.id), eq(apiKeys.ownerId, user.id)));
      res.json({ success: true, message: "API key revoked" });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to revoke key" });
    }
  });

  // Partner data + billing surface (api-key metered data routes, session billing).
  const { partnerRouter } = await import("./partnerRoutes");
  app.use(partnerRouter);

  log("API key routes: GET/POST /api/api-keys, GET /api/api-keys/:id/usage, DELETE /api/api-keys/:id");
  log("Partner API: /api/partner/v1/* (metered), /api/partner/usage, /api/partner/billing/*");
}

(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);

  const { initializeBlockchain } = await import("./blockchain");
  const blockchainResult = await initializeBlockchain();
  log(`Blockchain: ${blockchainResult.message}`);

  await seedAdminUser();

  setupDeveloperPortal(app);
  await setupApiKeyRoutes(app);
  setupTaxiModeRoutes(app);

  configureExpoAndLanding(app);

  const server = await registerRoutes(app);

  setupErrorHandler(app);

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`express server serving on port ${port}`);
    },
  );
})();
