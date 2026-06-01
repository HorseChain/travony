const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const CHROME_PATH =
  "/nix/store/0n9rl5l9syy808xi9bk4f6dhnfrvhkww-playwright-browsers-chromium/chromium-1080/chrome-linux/chrome";
const OUT_DIR = path.resolve(__dirname, "../attached_assets/hub_frames");
fs.mkdirSync(OUT_DIR, { recursive: true });

let idx = 0;
function fp(name) { idx++; return path.join(OUT_DIR, `${String(idx).padStart(2,"0")}_${name}.png`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function shot(page, name) {
  const p = fp(name);
  try { await page.screenshot({ path: p }); console.log(`  [OK] ${path.basename(p)}`); }
  catch (e) { console.log(`  [FAIL] ${name}: ${e.message}`); }
}

async function clickText(page, text) {
  return page.evaluate((t) => {
    const els = document.querySelectorAll("a, button, [role='tab'], [role='button'], span, div, td, th");
    for (const el of els) {
      if (el.textContent && el.textContent.trim() === t) { el.click(); return true; }
    }
    for (const el of els) {
      if (el.textContent && el.textContent.trim().includes(t)) { el.click(); return true; }
    }
    return false;
  }, text);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // ═══ LOGIN ═══
  console.log("--- LOGIN ---");
  await page.goto("http://localhost:5000/dashboard/fleet/login", { waitUntil: "networkidle2", timeout: 20000 });
  await sleep(2000);
  const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="mail"]');
  const pwdInput = await page.$('input[type="password"]');
  if (emailInput && pwdInput) {
    await emailInput.type("fleet@travony.com", { delay: 15 });
    await pwdInput.type("Fleet2024!", { delay: 15 });
    const btn = await page.$('button[type="submit"], button');
    if (btn) await btn.click();
    await sleep(4000);
  }

  // ═══ DISPATCH TAB ═══
  console.log("--- DISPATCH ---");
  await shot(page, "dispatch_overview");
  await page.evaluate(() => window.scrollBy(0, 500));
  await sleep(1500);
  await shot(page, "dispatch_hubs");

  // ═══ HUB STATUS TAB ═══
  console.log("--- HUB STATUS ---");
  await clickText(page, "Hub Status");
  await sleep(3000);
  await shot(page, "hub_status_top");

  await page.evaluate(() => window.scrollBy(0, 400));
  await sleep(1000);
  await shot(page, "hub_status_ev_hubs");

  await page.evaluate(() => window.scrollBy(0, 400));
  await sleep(1000);
  await shot(page, "hub_status_custom");

  await page.evaluate(() => window.scrollBy(0, 400));
  await sleep(1000);
  await shot(page, "hub_status_more");

  await page.evaluate(() => window.scrollBy(0, 400));
  await sleep(1000);
  await shot(page, "hub_status_even_more");

  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);

  // Try clicking on a specific hub row for detail
  const clickedHub = await page.evaluate(() => {
    const rows = document.querySelectorAll("tr, [role='row']");
    for (const row of rows) {
      if (row.textContent && row.textContent.includes("Dubai Mall")) {
        row.click();
        return true;
      }
    }
    const links = document.querySelectorAll("a, button, [role='button']");
    for (const l of links) {
      if (l.textContent && l.textContent.includes("Dubai Mall")) {
        l.click();
        return true;
      }
    }
    return false;
  });
  if (clickedHub) {
    await sleep(2000);
    await shot(page, "hub_detail_dubai_mall");
  }

  // ═══ DEMAND MAP TAB ═══
  console.log("--- DEMAND MAP ---");
  await clickText(page, "Demand Map");
  await sleep(3000);
  await shot(page, "demand_map");

  // Try clicking 24h toggle
  const clicked24h = await clickText(page, "24h");
  if (clicked24h) {
    await sleep(2000);
    await shot(page, "demand_map_24h");
  }

  await page.evaluate(() => window.scrollBy(0, 400));
  await sleep(1000);
  await shot(page, "demand_map_stats");

  // ═══ FLEET VEHICLES TAB ═══
  console.log("--- FLEET VEHICLES ---");
  await clickText(page, "Fleet Vehicles");
  await sleep(3000);
  await shot(page, "fleet_vehicles");
  await page.evaluate(() => window.scrollBy(0, 400));
  await sleep(1000);
  await shot(page, "fleet_vehicles_scroll");

  // ═══ BACK TO DISPATCH ═══
  console.log("--- DISPATCH AGAIN ---");
  await clickText(page, "Dispatch");
  await sleep(2500);
  await page.evaluate(() => window.scrollBy(0, 800));
  await sleep(1000);
  await shot(page, "dispatch_bottom");

  await page.close();

  // ═══ MOBILE APP ═══
  console.log("--- MOBILE APP ---");
  const mobile = await browser.newPage();
  await mobile.setViewport({ width: 402, height: 874 });
  await mobile.goto("http://localhost:8081", { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(5000);
  await shot(mobile, "app_onboarding");

  // Try clicking ACCESS THE NETWORK
  const clickedAccess = await clickText(mobile, "ACCESS THE NETWORK");
  if (clickedAccess) {
    await sleep(3000);
    await shot(mobile, "app_login_screen");
  }

  // Try clicking back or ACTIVATE YOUR VEHICLE
  const clickedActivate = await clickText(mobile, "ACTIVATE YOUR VEHICLE");
  if (clickedActivate) {
    await sleep(3000);
    await shot(mobile, "app_activate_vehicle");
  }
  await mobile.close();

  // ═══ SUPPORT PAGE ═══
  console.log("--- SUPPORT ---");
  const sp = await browser.newPage();
  await sp.setViewport({ width: 1440, height: 900 });
  await sp.goto("http://localhost:5000/support", { waitUntil: "networkidle2", timeout: 15000 });
  await sleep(2000);
  await shot(sp, "support");
  await sp.close();

  await browser.close();

  const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith(".png")).sort();
  console.log(`\n=== ${files.length} FRAMES CAPTURED ===`);
  files.forEach(f => {
    const s = fs.statSync(path.join(OUT_DIR, f));
    console.log(`  ${f} (${Math.round(s.size/1024)}KB)`);
  });
})();
