const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const CHROME_PATH =
  "/nix/store/0n9rl5l9syy808xi9bk4f6dhnfrvhkww-playwright-browsers-chromium/chromium-1080/chrome-linux/chrome";

const OUT_DIR = path.resolve(__dirname, "../attached_assets/real_frames");
fs.mkdirSync(OUT_DIR, { recursive: true });

const MOBILE = { width: 402, height: 874 };
const DESKTOP = { width: 1440, height: 900 };

let frameIdx = 0;
function framePath(name) {
  frameIdx++;
  const num = String(frameIdx).padStart(2, "0");
  return path.join(OUT_DIR, `${num}_${name}.png`);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeScreenshot(page, name, opts = {}) {
  const fp = framePath(name);
  try {
    await page.screenshot({ path: fp, fullPage: false, ...opts });
    console.log(`  [OK] ${path.basename(fp)}`);
  } catch (e) {
    console.log(`  [FAIL] ${name}: ${e.message}`);
  }
  return fp;
}

async function waitAndClick(page, selector, timeout = 3000) {
  try {
    await page.waitForSelector(selector, { timeout });
    await page.click(selector);
    return true;
  } catch {
    return false;
  }
}

(async () => {
  console.log("Launching Chrome...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-web-security",
      "--font-render-hinting=none",
    ],
  });

  // ═══════════════════════════════════════════════════
  // SECTION 1: LANDING PAGE (port 5000)
  // ═══════════════════════════════════════════════════
  console.log("\n--- LANDING PAGE ---");
  const landingPage = await browser.newPage();
  await landingPage.setViewport(DESKTOP);
  await landingPage.goto("http://localhost:5000", {
    waitUntil: "networkidle2",
    timeout: 20000,
  });
  await sleep(2000);
  await safeScreenshot(landingPage, "landing_top");

  await landingPage.evaluate(() => window.scrollBy(0, 800));
  await sleep(1000);
  await safeScreenshot(landingPage, "landing_features");

  await landingPage.evaluate(() => window.scrollBy(0, 800));
  await sleep(1000);
  await safeScreenshot(landingPage, "landing_bottom");
  await landingPage.close();

  // ═══════════════════════════════════════════════════
  // SECTION 2: FLEET DASHBOARD (port 5000)
  // ═══════════════════════════════════════════════════
  console.log("\n--- FLEET DASHBOARD ---");
  const fleetPage = await browser.newPage();
  await fleetPage.setViewport(DESKTOP);

  await fleetPage.goto("http://localhost:5000/dashboard/fleet/login", {
    waitUntil: "networkidle2",
    timeout: 20000,
  });
  await sleep(2000);
  await safeScreenshot(fleetPage, "fleet_login");

  const emailInput = await fleetPage.$('input[type="email"], input[name="email"], input[placeholder*="mail"]');
  const passwordInput = await fleetPage.$('input[type="password"], input[name="password"]');
  if (emailInput && passwordInput) {
    await emailInput.type("fleet@travony.com", { delay: 30 });
    await passwordInput.type("Fleet2024!", { delay: 30 });
    await sleep(500);
    await safeScreenshot(fleetPage, "fleet_login_filled");
    const submitBtn = await fleetPage.$('button[type="submit"], button');
    if (submitBtn) {
      await submitBtn.click();
      await sleep(4000);
      await safeScreenshot(fleetPage, "fleet_dashboard_main");

      await fleetPage.evaluate(() => window.scrollBy(0, 600));
      await sleep(1500);
      await safeScreenshot(fleetPage, "fleet_dashboard_scroll");

      await fleetPage.evaluate(() => window.scrollBy(0, 600));
      await sleep(1500);
      await safeScreenshot(fleetPage, "fleet_dashboard_more");
    }
  } else {
    console.log("  Could not find fleet login inputs — capturing what's there");
    await safeScreenshot(fleetPage, "fleet_page");
  }
  await fleetPage.close();

  // ═══════════════════════════════════════════════════
  // SECTION 3: ADMIN DASHBOARD (port 5000)
  // ═══════════════════════════════════════════════════
  console.log("\n--- ADMIN DASHBOARD ---");
  const adminPage = await browser.newPage();
  await adminPage.setViewport(DESKTOP);
  await adminPage.goto("http://localhost:5000/admin", {
    waitUntil: "networkidle2",
    timeout: 20000,
  });
  await sleep(2000);
  await safeScreenshot(adminPage, "admin_dashboard");

  await adminPage.evaluate(() => window.scrollBy(0, 800));
  await sleep(1500);
  await safeScreenshot(adminPage, "admin_dashboard_scroll");
  await adminPage.close();

  // ═══════════════════════════════════════════════════
  // SECTION 4: MOBILE APP — RIDER (port 8081)
  // ═══════════════════════════════════════════════════
  console.log("\n--- MOBILE APP (Rider) ---");
  const mobileRider = await browser.newPage();
  await mobileRider.setViewport(MOBILE);
  await mobileRider.goto("http://localhost:8081", {
    waitUntil: "networkidle2",
    timeout: 30000,
  });
  await sleep(4000);
  await safeScreenshot(mobileRider, "rider_home");

  await mobileRider.evaluate(() => window.scrollBy(0, 400));
  await sleep(1500);
  await safeScreenshot(mobileRider, "rider_home_scroll");

  const tabTexts = ["Bookings", "Wallet", "Profile"];
  for (const tabName of tabTexts) {
    const clicked = await mobileRider.evaluate((name) => {
      const els = document.querySelectorAll("[role='tab'], [data-testid], button, [role='button'], a");
      for (const el of els) {
        if (el.textContent && el.textContent.trim().includes(name)) {
          el.click();
          return true;
        }
      }
      return false;
    }, tabName);
    if (clicked) {
      await sleep(2500);
      await safeScreenshot(mobileRider, `rider_${tabName.toLowerCase()}`);

      if (tabName === "Wallet") {
        await mobileRider.evaluate(() => window.scrollBy(0, 400));
        await sleep(1000);
        await safeScreenshot(mobileRider, "rider_wallet_scroll");
      }
      if (tabName === "Profile") {
        await mobileRider.evaluate(() => window.scrollBy(0, 400));
        await sleep(1000);
        await safeScreenshot(mobileRider, "rider_profile_scroll");
      }
    } else {
      console.log(`  Could not click ${tabName} tab`);
    }
  }

  const homeClicked = await mobileRider.evaluate(() => {
    const els = document.querySelectorAll("[role='tab'], [data-testid], button, [role='button'], a");
    for (const el of els) {
      if (el.textContent && (el.textContent.trim().includes("Home") || el.textContent.trim().includes("home"))) {
        el.click();
        return true;
      }
    }
    return false;
  });
  if (homeClicked) {
    await sleep(2000);
    await safeScreenshot(mobileRider, "rider_home_return");
  }
  await mobileRider.close();

  // ═══════════════════════════════════════════════════
  // SECTION 5: MOBILE APP — ONBOARDING (port 8081)
  // ═══════════════════════════════════════════════════
  console.log("\n--- ONBOARDING ---");
  const onboarding = await browser.newPage();
  await onboarding.setViewport(MOBILE);
  await onboarding.goto("http://localhost:8081", {
    waitUntil: "networkidle2",
    timeout: 20000,
  });
  await sleep(3000);
  await safeScreenshot(onboarding, "onboarding_screen");
  await onboarding.close();

  // ═══════════════════════════════════════════════════
  // SECTION 6: SUPPORT / LEGAL PAGES (port 5000)
  // ═══════════════════════════════════════════════════
  console.log("\n--- SUPPORT & LEGAL ---");
  const supportPages = [
    { url: "/privacy", name: "privacy_policy" },
    { url: "/terms", name: "terms_of_service" },
    { url: "/support", name: "support_page" },
  ];
  for (const pg of supportPages) {
    const p = await browser.newPage();
    await p.setViewport(DESKTOP);
    await p.goto(`http://localhost:5000${pg.url}`, {
      waitUntil: "networkidle2",
      timeout: 15000,
    });
    await sleep(1500);
    await safeScreenshot(p, pg.name);
    await p.close();
  }

  await browser.close();

  const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".png")).sort();
  console.log(`\n=== CAPTURED ${files.length} FRAMES ===`);
  files.forEach((f) => {
    const stat = fs.statSync(path.join(OUT_DIR, f));
    console.log(`  ${f} (${Math.round(stat.size / 1024)}KB)`);
  });
})();
