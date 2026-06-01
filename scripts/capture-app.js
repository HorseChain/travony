const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const CHROME_PATH =
  "/nix/store/0n9rl5l9syy808xi9bk4f6dhnfrvhkww-playwright-browsers-chromium/chromium-1080/chrome-linux/chrome";
const OUT_DIR = path.resolve(__dirname, "../attached_assets/app_frames");
fs.mkdirSync(OUT_DIR, { recursive: true });

const TOKEN = "852d5b0b047b523a7d7bfbcdd04ea8d1afb37e77886155751938980cfd964064";
const USER = JSON.stringify({
  id: "c5607019-ce0c-46fb-ada6-62c6a305ea04",
  name: "Khalid Al Marzooqi",
  phone: "+971501234567",
  role: "customer",
});

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
    const all = document.querySelectorAll("*");
    for (const el of all) {
      if (el.children.length === 0 && el.textContent && el.textContent.trim() === t) {
        el.click();
        return true;
      }
    }
    return false;
  }, text);
}

async function clickContains(page, text) {
  return page.evaluate((t) => {
    const all = document.querySelectorAll("[role='button'], button, a, div[tabindex]");
    for (const el of all) {
      if (el.textContent && el.textContent.includes(t)) {
        el.click();
        return true;
      }
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
  await page.setViewport({ width: 402, height: 874 });

  console.log("--- INJECTING AUTH ---");
  await page.goto("http://localhost:8081", { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(2000);

  await page.evaluate((token, user) => {
    localStorage.setItem("@travony_auth", token);
    localStorage.setItem("@travony_user", user);
  }, TOKEN, USER);

  await page.reload({ waitUntil: "networkidle2", timeout: 30000 });
  await sleep(5000);
  await shot(page, "home_screen");

  // Scroll down on home
  await page.evaluate(() => {
    const sv = document.querySelector("[data-testid='home-scroll']") || document.querySelector("[role='none']");
    if (sv) sv.scrollTop = 400;
    else window.scrollBy(0, 400);
  });
  await sleep(1500);
  await shot(page, "home_scroll");

  // Click on Network Hubs card
  console.log("--- NETWORK HUBS ---");
  let clicked = await clickContains(page, "Network Hubs");
  if (clicked) {
    await sleep(3000);
    await shot(page, "network_hubs");
  }

  // Go back to Home tab
  await clickText(page, "Home");
  await sleep(2000);

  // Click Coffee
  console.log("--- COFFEE ---");
  clicked = await clickContains(page, "Coffee");
  if (clicked) {
    await sleep(3000);
    await shot(page, "coffee");
    await page.evaluate(() => {
      const sv = document.querySelectorAll("[class*='scroll'], [role='none']");
      sv.forEach(s => s.scrollTop = 400);
      window.scrollBy(0, 400);
    });
    await sleep(1500);
    await shot(page, "coffee_scroll");
  }

  // Go back to Home
  await clickText(page, "Home");
  await sleep(2000);

  // Click Where are you heading (booking)
  console.log("--- BOOKING ---");
  clicked = await clickContains(page, "Where are you heading");
  if (clicked) {
    await sleep(3000);
    await shot(page, "booking_search");
  }

  // Go back to Home
  await clickText(page, "Home");
  await sleep(2000);

  // Try Movements tab
  console.log("--- MOVEMENTS ---");
  clicked = await clickText(page, "Movements");
  if (clicked) {
    await sleep(3000);
    await shot(page, "movements");
  }

  // Try Wallet tab
  console.log("--- WALLET ---");
  clicked = await clickText(page, "Wallet");
  if (clicked) {
    await sleep(3000);
    await shot(page, "wallet");
    await page.evaluate(() => window.scrollBy(0, 400));
    await sleep(1500);
    await shot(page, "wallet_scroll");
  }

  // Try Profile tab
  console.log("--- PROFILE ---");
  clicked = await clickText(page, "Profile");
  if (clicked) {
    await sleep(3000);
    await shot(page, "profile");
  }

  await browser.close();

  const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith(".png")).sort();
  console.log(`\n=== ${files.length} APP FRAMES ===`);
  files.forEach(f => {
    const s = fs.statSync(path.join(OUT_DIR, f));
    console.log(`  ${f} (${Math.round(s.size/1024)}KB)`);
  });
})();
