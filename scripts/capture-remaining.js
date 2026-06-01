const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const CHROME_PATH =
  "/nix/store/0n9rl5l9syy808xi9bk4f6dhnfrvhkww-playwright-browsers-chromium/chromium-1080/chrome-linux/chrome";
const OUT_DIR = path.resolve(__dirname, "../attached_assets/real_frames");
fs.mkdirSync(OUT_DIR, { recursive: true });

let frameIdx = 6;
function framePath(name) {
  frameIdx++;
  return path.join(OUT_DIR, `${String(frameIdx).padStart(2, "0")}_${name}.png`);
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function shot(page, name) {
  const fp = framePath(name);
  try {
    await page.screenshot({ path: fp, fullPage: false });
    console.log(`  [OK] ${path.basename(fp)}`);
  } catch (e) { console.log(`  [FAIL] ${name}: ${e.message}`); }
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });

  // ═══ Fleet Dashboard Tabs ═══
  console.log("--- FLEET DASHBOARD TABS ---");
  const fleet = await browser.newPage();
  await fleet.setViewport({ width: 1440, height: 900 });
  await fleet.goto("http://localhost:5000/dashboard/fleet/login", { waitUntil: "networkidle2", timeout: 20000 });
  await sleep(2000);

  const emailInput = await fleet.$('input[type="email"], input[name="email"], input[placeholder*="mail"]');
  const pwdInput = await fleet.$('input[type="password"]');
  if (emailInput && pwdInput) {
    await emailInput.type("fleet@travony.com", { delay: 20 });
    await pwdInput.type("Fleet2024!", { delay: 20 });
    const btn = await fleet.$('button[type="submit"], button');
    if (btn) await btn.click();
    await sleep(4000);

    // Hub Status tab
    const clickTab = async (name) => {
      return fleet.evaluate((n) => {
        const tabs = document.querySelectorAll("a, button, [role='tab']");
        for (const t of tabs) {
          if (t.textContent && t.textContent.trim().includes(n)) { t.click(); return true; }
        }
        return false;
      }, name);
    };

    if (await clickTab("Hub Status")) {
      await sleep(3000);
      await shot(fleet, "fleet_hub_status");
      await fleet.evaluate(() => window.scrollBy(0, 600));
      await sleep(1500);
      await shot(fleet, "fleet_hub_status_scroll");
    }

    if (await clickTab("Demand Map")) {
      await sleep(3000);
      await shot(fleet, "fleet_demand_map");
    }

    if (await clickTab("Fleet Vehicles")) {
      await sleep(3000);
      await shot(fleet, "fleet_vehicles");
    }

    if (await clickTab("Dispatch")) {
      await sleep(2000);
      await shot(fleet, "fleet_dispatch");
    }
  }
  await fleet.close();

  // ═══ Admin Dashboard ═══
  console.log("--- ADMIN DASHBOARD ---");
  const admin = await browser.newPage();
  await admin.setViewport({ width: 1440, height: 900 });
  await admin.goto("http://localhost:5000/admin", { waitUntil: "networkidle2", timeout: 20000 });
  await sleep(2500);
  await shot(admin, "admin_dashboard");
  await admin.evaluate(() => window.scrollBy(0, 800));
  await sleep(1500);
  await shot(admin, "admin_dashboard_scroll");
  await admin.close();

  // ═══ Mobile App ═══
  console.log("--- MOBILE APP ---");
  const mobile = await browser.newPage();
  await mobile.setViewport({ width: 402, height: 874 });
  await mobile.goto("http://localhost:8081", { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(5000);
  await shot(mobile, "mobile_main");

  await mobile.evaluate(() => window.scrollBy(0, 300));
  await sleep(1500);
  await shot(mobile, "mobile_scroll");

  // Try clicking bottom tabs
  const clickMobileTab = async (tabName) => {
    return mobile.evaluate((name) => {
      const all = document.querySelectorAll("*");
      for (const el of all) {
        const text = el.textContent?.trim();
        if (text === name && el.offsetParent !== null) {
          el.click();
          return true;
        }
      }
      return false;
    }, tabName);
  };

  for (const tab of ["Bookings", "Wallet", "Profile"]) {
    if (await clickMobileTab(tab)) {
      await sleep(2500);
      await shot(mobile, `mobile_${tab.toLowerCase()}`);
    }
  }

  if (await clickMobileTab("Home")) {
    await sleep(2000);
    await shot(mobile, "mobile_home_final");
  }
  await mobile.close();

  // ═══ Support Page ═══
  console.log("--- SUPPORT ---");
  const support = await browser.newPage();
  await support.setViewport({ width: 1440, height: 900 });
  await support.goto("http://localhost:5000/support", { waitUntil: "networkidle2", timeout: 15000 });
  await sleep(2000);
  await shot(support, "support");
  await support.close();

  await browser.close();

  const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith(".png")).sort();
  console.log(`\n=== TOTAL FRAMES: ${files.length} ===`);
  files.forEach(f => {
    const stat = fs.statSync(path.join(OUT_DIR, f));
    console.log(`  ${f} (${Math.round(stat.size / 1024)}KB)`);
  });
})();
