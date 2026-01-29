import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import * as fs from "fs";
import * as path from "path";

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
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const adminDashboardTemplate = fs.existsSync(adminTemplatePath) 
    ? fs.readFileSync(adminTemplatePath, "utf-8") 
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

  log("Policy pages: /privacy, /terms, /data-deletion, /support");
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
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };

    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";

    res.status(status).json({ message });

    throw err;
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

(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);

  const { initializeBlockchain } = await import("./blockchain");
  const blockchainResult = await initializeBlockchain();
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
      reusePort: true,
    },
    () => {
      log(`express server serving on port ${port}`);
    },
  );
})();
