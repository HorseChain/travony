// ADNOC EV OS — Premium Investor Pitch Deck Generator
// Uses pptxgenjs to produce a polished 15-slide PPTX
// Post-processes PPTX ZIP to inject slide transitions & entrance animations

const PptxGenJS = require("pptxgenjs");
const JSZip = require("jszip");
const fs = require("fs");
const path = require("path");

// ─── Design System ────────────────────────────────────────────────────────────
const C = {
  navyBg: "0A0E1A",
  surface: "131929",
  divider: "1E2D45",
  green: "00B14F",
  white: "F8F9FC",
  muted: "8892A4",
  lightBg: "F0F4F8",
  lightSurface: "FFFFFF",
  lightText: "0A0E1A",
  lightMuted: "4A5568",
};

const W = 13.33;
const H = 7.5;
const OUT = "attached_assets/ADNOC_EV_OS_Presentation.pptx";

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";
pptx.title = "ADNOC EV OS — Investor Pitch Deck";
pptx.subject = "The Operating System for EV Fleets";
pptx.author = "ADNOC EV OS";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function darkBg(slide) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: W, h: H,
    fill: { color: C.navyBg }, line: { color: C.navyBg, width: 0 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: -3, y: 4.5, w: 9, h: 5,
    fill: { color: "060C14" }, line: { color: "060C14", width: 0 }, rotate: -18,
  });
}

function lightBg(slide) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: W, h: H,
    fill: { color: C.lightBg }, line: { color: C.lightBg, width: 0 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: W, h: 0.12,
    fill: { color: C.green }, line: { color: C.green, width: 0 },
  });
}

function accentDot(slide) {
  slide.addShape(pptx.ShapeType.ellipse, {
    x: 0.32, y: 0.28, w: 0.14, h: 0.14,
    fill: { color: C.green }, line: { color: C.green, width: 0 },
  });
}

function sectionLabel(slide, text) {
  slide.addText(text, {
    x: 0.55, y: 0.2, w: 8, h: 0.25,
    fontSize: 10, color: C.green, bold: true, charSpacing: 2.5, fontFace: "Calibri",
  });
}

function slideTitle(slide, text, isDark = true, y = 0.52) {
  slide.addText(text, {
    x: 0.55, y, w: W - 1.1, h: 0.78,
    fontSize: 40, color: isDark ? C.white : C.lightText, bold: true, fontFace: "Calibri",
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.55, y: y + 0.82, w: W - 1.1, h: 0.04,
    fill: { color: C.green }, line: { color: C.green, width: 0 },
  });
}

function surfaceCard(slide, x, y, w, h, greenBorder = false) {
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w, h,
    fill: { color: C.surface },
    line: greenBorder ? { color: C.green, width: 1.5 } : { color: C.divider, width: 0.8 },
  });
  if (greenBorder) {
    slide.addShape(pptx.ShapeType.rect, {
      x, y, w: 0.07, h, fill: { color: C.green }, line: { color: C.green, width: 0 },
    });
  }
}

function statColumn(slide, x, y, number, label, desc) {
  slide.addText(number, {
    x, y, w: 3.8, h: 1.15, fontSize: 68, color: C.white,
    bold: true, fontFace: "Calibri", align: "center",
  });
  slide.addText(label, {
    x, y: y + 1.12, w: 3.8, h: 0.38, fontSize: 15, color: C.green,
    bold: true, fontFace: "Calibri", align: "center",
  });
  slide.addText(desc, {
    x, y: y + 1.52, w: 3.8, h: 0.45, fontSize: 12, color: C.muted,
    fontFace: "Calibri", align: "center", wrap: true,
  });
}

function checkChip(slide, x, y, label, desc) {
  surfaceCard(slide, x, y, 5.8, 0.82, false);
  slide.addShape(pptx.ShapeType.ellipse, {
    x: x + 0.15, y: y + 0.24, w: 0.35, h: 0.35,
    fill: { color: C.green }, line: { color: C.green, width: 0 },
  });
  slide.addText("✓", {
    x: x + 0.15, y: y + 0.2, w: 0.35, h: 0.42,
    fontSize: 12, color: C.white, bold: true, fontFace: "Calibri", align: "center",
  });
  slide.addText(label, {
    x: x + 0.62, y: y + 0.1, w: 2.4, h: 0.28,
    fontSize: 13, color: C.white, bold: true, fontFace: "Calibri",
  });
  slide.addText(desc, {
    x: x + 0.62, y: y + 0.4, w: 5.0, h: 0.28,
    fontSize: 11, color: C.muted, fontFace: "Calibri",
  });
}

function stackBand(slide, y, bandColor, label, items) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.55, y, w: W - 1.1, h: 0.88,
    fill: { color: bandColor }, line: { color: C.divider, width: 0.5 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.55, y, w: 0.1, h: 0.88, fill: { color: C.green }, line: { color: C.green, width: 0 },
  });
  slide.addText(label, {
    x: 0.82, y: y + 0.1, w: 3.0, h: 0.32,
    fontSize: 15, color: C.green, bold: true, fontFace: "Calibri",
  });
  slide.addText(items, {
    x: 0.82, y: y + 0.46, w: W - 1.8, h: 0.3,
    fontSize: 12, color: C.muted, fontFace: "Calibri",
  });
}

function bulletList(slide, items, x, y) {
  items.slice(0, 5).forEach((item, i) => {
    slide.addShape(pptx.ShapeType.ellipse, {
      x, y: y + i * 0.72, w: 0.2, h: 0.2,
      fill: { color: C.green }, line: { color: C.green, width: 0 },
    });
    slide.addText(item, {
      x: x + 0.35, y: y + i * 0.72 - 0.02, w: 5.9, h: 0.28,
      fontSize: 14, color: C.muted, fontFace: "Calibri",
    });
  });
}

function phaseBox(slide, x, y, num, title, bullets) {
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w: 3.6, h: 3.5, fill: { color: C.surface }, line: { color: C.divider, width: 0.8 },
  });
  slide.addShape(pptx.ShapeType.ellipse, {
    x: x + 1.5, y: y + 0.2, w: 0.6, h: 0.6, fill: { color: C.green }, line: { color: C.green, width: 0 },
  });
  slide.addText(num, {
    x: x + 1.5, y: y + 0.16, w: 0.6, h: 0.68,
    fontSize: 18, color: C.white, bold: true, fontFace: "Calibri", align: "center",
  });
  slide.addText(title, {
    x: x + 0.18, y: y + 0.92, w: 3.24, h: 0.45,
    fontSize: 16, color: C.white, bold: true, fontFace: "Calibri", align: "center",
  });
  bullets.slice(0, 4).forEach((b, i) => {
    slide.addText(`• ${b}`, {
      x: x + 0.25, y: y + 1.52 + i * 0.46, w: 3.1, h: 0.38,
      fontSize: 12, color: C.muted, fontFace: "Calibri", wrap: true,
    });
  });
}

// Copyright footer — on every slide
function copyright(slide) {
  slide.addText("© 2026–2027 ADNOC Distribution Retail. Confidential.", {
    x: 0.55, y: H - 0.28, w: W - 1.1, h: 0.22,
    fontSize: 8, color: "3A4A60", fontFace: "Calibri", align: "center",
  });
}

function compTable(slide) {
  const cols = ["Capability", "ADNOC EV OS", "Careem", "Uber", "Fleet SaaS"];
  const rows = [
    ["EV-native dispatch intelligence", true, false, false, false],
    ["Blockchain fare verification", true, false, false, false],
    ["Crypto payment rails", true, false, false, false],
    ["B2B fleet operator dashboard", true, false, false, true],
    ["Real-time charging hub integration", true, false, false, false],
    ["UAE multi-city expansion ready", true, true, true, false],
    ["ADNOC network distribution", true, false, false, false],
  ];
  const startX = 0.4, startY = 1.62;
  const colWidths = [3.9, 2.1, 2.1, 2.0, 2.2];
  const rowH = 0.55;
  cols.forEach((col, ci) => {
    const x = startX + colWidths.slice(0, ci).reduce((a, b) => a + b, 0);
    slide.addShape(pptx.ShapeType.rect, {
      x, y: startY, w: colWidths[ci], h: 0.5,
      fill: { color: ci === 1 ? C.green : "1A2436" }, line: { color: C.divider, width: 0.5 },
    });
    slide.addText(col, {
      x, y: startY, w: colWidths[ci], h: 0.5,
      fontSize: 11, color: C.white, bold: true, fontFace: "Calibri", align: "center", valign: "middle",
    });
  });
  rows.forEach((row, ri) => {
    const y = startY + 0.5 + ri * rowH;
    row.forEach((cell, ci) => {
      const x = startX + colWidths.slice(0, ci).reduce((a, b) => a + b, 0);
      const bg = ri % 2 === 0 ? C.surface : "0F1826";
      slide.addShape(pptx.ShapeType.rect, {
        x, y, w: colWidths[ci], h: rowH,
        fill: { color: ci === 1 ? "0D2419" : bg }, line: { color: C.divider, width: 0.3 },
      });
      if (ci === 0) {
        slide.addText(cell, {
          x: x + 0.1, y, w: colWidths[ci] - 0.1, h: rowH,
          fontSize: 11, color: C.muted, fontFace: "Calibri", valign: "middle",
        });
      } else {
        slide.addText(cell === true ? "✓" : "—", {
          x, y, w: colWidths[ci], h: rowH,
          fontSize: 16, color: cell === true ? C.green : "2D3A50",
          bold: cell === true, fontFace: "Calibri", align: "center", valign: "middle",
        });
      }
    });
  });
}

// ─── App Journey Flow (used on rider/driver slides) ──────────────────────────
function journeyFlow(slide, x, y, steps, activeIdx = 0) {
  const stepW = (W - x - 0.55) / steps.length;
  steps.forEach((step, i) => {
    const sx = x + i * stepW;
    const isActive = i === activeIdx;
    // Step circle
    slide.addShape(pptx.ShapeType.ellipse, {
      x: sx + stepW / 2 - 0.28, y,
      w: 0.56, h: 0.56,
      fill: { color: isActive ? C.green : C.surface },
      line: { color: isActive ? C.green : C.divider, width: isActive ? 2 : 0.8 },
    });
    slide.addText(`${i + 1}`, {
      x: sx + stepW / 2 - 0.28, y,
      w: 0.56, h: 0.56,
      fontSize: 14, color: C.white, bold: true, fontFace: "Calibri",
      align: "center", valign: "middle",
    });
    // Connector
    if (i < steps.length - 1) {
      slide.addShape(pptx.ShapeType.rect, {
        x: sx + stepW / 2 + 0.28, y: y + 0.25,
        w: stepW - 0.56, h: 0.06,
        fill: { color: isActive ? C.green : C.divider },
        line: { color: isActive ? C.green : C.divider, width: 0 },
      });
    }
    // Label
    slide.addText(step, {
      x: sx, y: y + 0.64,
      w: stepW, h: 0.3,
      fontSize: 10, color: isActive ? C.white : C.muted,
      fontFace: "Calibri", align: "center", bold: isActive, wrap: true,
    });
  });
}

// ─── Phone frame mockup ───────────────────────────────────────────────────────
function phoneFrame(slide, x, y, w, h) {
  // Outer frame
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: "1A1A2E" },
    line: { color: "3A4A60", width: 1.5 },
    rectRadius: 0.18,
  });
  // Screen inset
  slide.addShape(pptx.ShapeType.rect, {
    x: x + 0.08, y: y + 0.28, w: w - 0.16, h: h - 0.52,
    fill: { color: C.navyBg }, line: { color: "0F1826", width: 0.3 },
  });
  // Home bar
  slide.addShape(pptx.ShapeType.roundRect, {
    x: x + w / 2 - 0.35, y: y + h - 0.18, w: 0.7, h: 0.1,
    fill: { color: "3A4A60" }, line: { color: "3A4A60", width: 0 }, rectRadius: 0.05,
  });
  // Camera notch
  slide.addShape(pptx.ShapeType.ellipse, {
    x: x + w / 2 - 0.1, y: y + 0.1, w: 0.2, h: 0.12,
    fill: { color: "0F1826" }, line: { color: "0F1826", width: 0 },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── SLIDE 1: Cover ──────────────────────────────────────────────────────────
(function slide1() {
  const s = pptx.addSlide();
  darkBg(s);
  accentDot(s);

  s.addText("POWERED BY ADNOC DISTRIBUTION RETAIL", {
    x: 0, y: 1.92, w: W, h: 0.35,
    fontSize: 11, color: C.green, bold: true, charSpacing: 3, fontFace: "Calibri", align: "center",
  });
  s.addText("ADNOC EV OS", {
    x: 0, y: 2.35, w: W, h: 1.3,
    fontSize: 72, color: C.white, bold: true, fontFace: "Calibri", align: "center",
  });
  s.addShape(pptx.ShapeType.rect, {
    x: 3.5, y: 3.68, w: 6.33, h: 0.05,
    fill: { color: C.green }, line: { color: C.green, width: 0 },
  });
  s.addText("The Operating System for EV Fleets", {
    x: 0, y: 3.82, w: W, h: 0.52,
    fontSize: 22, color: C.green, fontFace: "Calibri", align: "center",
  });
  s.addText("From a single vehicle to a national fleet — one intelligent platform", {
    x: 1.5, y: 4.48, w: W - 3, h: 0.4,
    fontSize: 14, color: C.muted, fontFace: "Calibri", align: "center",
  });
  // Live app badge
  surfaceCard(s, W / 2 - 1.5, 5.1, 3.0, 0.58, true);
  s.addText("App live on iOS & Android", {
    x: W / 2 - 1.3, y: 5.22, w: 2.7, h: 0.32,
    fontSize: 12, color: C.white, fontFace: "Calibri", align: "center",
  });
  copyright(s);
})();

// ─── SLIDE 2: Why Now ─────────────────────────────────────────────────────────
(function slide2() {
  const s = pptx.addSlide();
  darkBg(s);
  accentDot(s);
  sectionLabel(s, "THE TIMING");
  slideTitle(s, "The UAE EV Revolution Is Happening Now");

  // 3 UAE-focused stats — no Saudi/Vision 2030
  statColumn(s, 0.55, 1.72, "$8B", "UAE + GCC EV Market",
    "Projected market value across the region by 2028");
  statColumn(s, 4.72, 1.72, "47%", "Annual Fleet Growth — UAE",
    "Year-over-year growth in UAE commercial EV registrations");
  statColumn(s, 8.88, 1.72, "2050", "UAE Net Zero Target",
    "UAE national clean energy commitment — driving EV adoption now");

  [4.5, 8.65].forEach(x => {
    s.addShape(pptx.ShapeType.rect, {
      x, y: 1.78, w: 0.03, h: 2.65, fill: { color: C.divider }, line: { color: C.divider, width: 0 },
    });
  });

  surfaceCard(s, 0.55, 5.28, W - 1.1, 1.4, true);
  s.addText(
    "Fleet operators in the UAE are buying EVs. The software to run them intelligently does not exist yet. That window is open — and closing.",
    {
      x: 0.88, y: 5.42, w: W - 1.65, h: 1.05,
      fontSize: 17, color: C.white, fontFace: "Calibri", align: "center", valign: "middle", wrap: true,
    }
  );
  copyright(s);
})();

// ─── SLIDE 3: The Problem ─────────────────────────────────────────────────────
(function slide3() {
  const s = pptx.addSlide();
  darkBg(s);
  accentDot(s);
  sectionLabel(s, "THE PROBLEM");
  slideTitle(s, "EV Fleets Are Powerful. The Software Running Them Is Not.");

  const painCards = [
    { title: "Fragmented tools", desc: "Operators juggle 5+ disconnected apps every shift" },
    { title: "No intelligence layer", desc: "Charging, dispatch, pricing operate in silos" },
    { title: "Rider experience ignores EVs", desc: "No EV availability, no range visibility, no trust signal" },
    { title: "No trust infrastructure", desc: "Fares disputed, no audit trail, no accountability" },
  ];
  painCards.forEach((card, i) => {
    const x = 0.55 + (i % 2) * 6.25;
    const y = 1.72 + Math.floor(i / 2) * 1.78;
    surfaceCard(s, x, y, 5.95, 1.52, true);
    s.addText(card.title, {
      x: x + 0.32, y: y + 0.16, w: 5.45, h: 0.38,
      fontSize: 16, color: C.white, bold: true, fontFace: "Calibri",
    });
    s.addText(card.desc, {
      x: x + 0.32, y: y + 0.6, w: 5.45, h: 0.65,
      fontSize: 14, color: C.muted, fontFace: "Calibri", wrap: true,
    });
  });
  s.addText("The industry needs an OS — not another app.", {
    x: 0, y: H - 0.62, w: W, h: 0.38,
    fontSize: 16, color: C.green, bold: true, fontFace: "Calibri", align: "center",
  });
  copyright(s);
})();

// ─── SLIDE 4: The Solution ────────────────────────────────────────────────────
(function slide4() {
  const s = pptx.addSlide();
  darkBg(s);
  accentDot(s);
  sectionLabel(s, "THE SOLUTION");
  slideTitle(s, "ADNOC EV OS: Four Layers. One Platform.");

  const bands = [
    { color: "102030", label: "Intelligence Layer", items: "AI Dispatch  ·  Blockchain Fare Lock  ·  Dynamic Pricing  ·  Demand Forecasting" },
    { color: "0B1A2C", label: "Fleet Operator Layer", items: "B2B Dashboard  ·  Hub Management  ·  Role-Gated Access  ·  Dispatch Suggestions" },
    { color: "081422", label: "Driver Layer", items: "Driver App  ·  Proactive Hub Routing  ·  Earnings Engine  ·  PMGTH Mode" },
    { color: "060F1A", label: "Rider Layer", items: "Rider App  ·  EV Booking  ·  Crypto + Card Payments  ·  Blockchain Receipt" },
  ];
  bands.forEach((band, i) => stackBand(s, 1.68 + i * 1.05, band.color, band.label, band.items));

  s.addText("No other platform in the UAE connects all four layers.", {
    x: 0, y: H - 0.54, w: W, h: 0.38,
    fontSize: 15, color: C.green, bold: true, fontFace: "Calibri", align: "center",
  });
  copyright(s);
})();

// ─── SLIDE 5: Market Opportunity (TAM + SAM only — SOM removed) ──────────────
(function slide5() {
  const s = pptx.addSlide();
  lightBg(s);
  accentDot(s);

  s.addText("THE MARKET", {
    x: 0.55, y: 0.2, w: 8, h: 0.25,
    fontSize: 10, color: C.green, bold: true, charSpacing: 2.5, fontFace: "Calibri",
  });
  s.addText("A UAE Market With No Dominant EV Fleet OS", {
    x: 0.55, y: 0.52, w: W - 1.1, h: 0.78,
    fontSize: 40, color: C.lightText, bold: true, fontFace: "Calibri",
  });
  s.addShape(pptx.ShapeType.rect, {
    x: 0.55, y: 1.34, w: W - 1.1, h: 0.04,
    fill: { color: C.green }, line: { color: C.green, width: 0 },
  });

  // Two concentric rings only — TAM outer, SAM inner (SOM removed)
  const cx = 3.2, cy = 4.2;
  [
    { w: 4.4, h: 4.4, color: "E2EEE8", label: "TAM" },
    { w: 2.6, h: 2.6, color: C.green, label: "SAM" },
  ].forEach((ring, ri) => {
    s.addShape(pptx.ShapeType.ellipse, {
      x: cx - ring.w / 2, y: cy - ring.h / 2, w: ring.w, h: ring.h,
      fill: { color: ring.color }, line: { color: "A8CCB4", width: 0.5 },
    });
  });
  s.addText("TAM", { x: 0.85, y: 2.05, w: 0.9, h: 0.3, fontSize: 11, color: C.lightMuted, bold: true, fontFace: "Calibri" });
  s.addText("SAM", { x: cx - 0.3, y: cy - 0.2, w: 0.6, h: 0.4, fontSize: 11, color: C.white, bold: true, fontFace: "Calibri", align: "center" });

  // Two stats — TAM and SAM only
  const stats = [
    { val: "$38B", label: "TAM", sub: "UAE mobility + fleet SaaS market by 2028" },
    { val: "$6.2B", label: "SAM", sub: "EV fleet management, dispatch + payments — UAE focus" },
  ];
  stats.forEach((st, i) => {
    const x = 7.0, y = 1.72 + i * 2.1;
    s.addText(st.val, { x, y, w: 2.4, h: 0.95, fontSize: 52, color: C.lightText, bold: true, fontFace: "Calibri" });
    s.addText(st.label, { x: x + 2.42, y: y + 0.3, w: 1.0, h: 0.35, fontSize: 12, color: C.green, bold: true, fontFace: "Calibri" });
    s.addText(st.sub, { x, y: y + 0.98, w: 5.8, h: 0.55, fontSize: 13, color: C.lightMuted, fontFace: "Calibri", wrap: true });
  });

  s.addShape(pptx.ShapeType.rect, { x: 7.0, y: 6.05, w: 5.88, h: 1.15, fill: { color: "E8F3EC" }, line: { color: "B8D8C2", width: 0.5 } });
  const diffs = [
    "ADNOC Distribution Retail — unmatched UAE network access",
    "First EV-native fleet OS built for the UAE market",
    "Network effect: hubs → AI → operators → drivers → riders",
  ];
  diffs.forEach((d, i) => {
    s.addText(`→  ${d}`, { x: 7.18, y: 6.16 + i * 0.3, w: 5.6, h: 0.28, fontSize: 11, color: C.lightMuted, fontFace: "Calibri" });
  });
  copyright(s);
})();

// ─── SLIDE 6: Proof — What's Built ───────────────────────────────────────────
(function slide6() {
  const s = pptx.addSlide();
  darkBg(s);
  accentDot(s);
  sectionLabel(s, "TRACTION");
  slideTitle(s, "Full Stack. Live. No Vaporware.");

  const chips = [
    { label: "Rider App", desc: "EV booking, blockchain fare, crypto payments, journey sharing" },
    { label: "Driver App", desc: "Live dispatch, earnings widget, proactive hub routing" },
    { label: "B2B Fleet Dashboard", desc: "Fleet ops, hub status, AI dispatch suggestions" },
    { label: "Blockchain Fare Lock", desc: "Polygon-verified per ride — immutable audit trail" },
    { label: "44 UAE Network Hubs", desc: "Live across Dubai, Abu Dhabi, Sharjah and more" },
    { label: "8 EV Charging Hubs", desc: "Real-time port tracking, atomic availability counts" },
    { label: "UAE City Network", desc: "Multi-city rollout ready — 48-hour city activation" },
    { label: "Multi-Payment Rails", desc: "Stripe + USDT crypto + in-app wallet, all live" },
  ];
  chips.forEach((chip, i) => {
    checkChip(s, 0.55 + (i % 2) * 6.25, 1.72 + Math.floor(i / 2) * 1.25, chip.label, chip.desc);
  });
  copyright(s);
})();

// ─── SLIDE 7: EV Fleet Intelligence ──────────────────────────────────────────
(function slide7() {
  const s = pptx.addSlide();
  darkBg(s);
  accentDot(s);
  sectionLabel(s, "FLEET INTELLIGENCE");
  slideTitle(s, "Real-Time Intelligence Across Every UAE Hub");

  const dotColors = [C.green, "00913E", "006D2E", C.muted, C.green, "00913E", C.muted, C.green, "006D2E", C.muted, C.green, C.green];
  dotColors.forEach((col, i) => {
    s.addShape(pptx.ShapeType.ellipse, {
      x: 8.9 + (i % 4) * 0.92, y: 1.65 + Math.floor(i / 4) * 0.92, w: 0.48, h: 0.48,
      fill: { color: col }, line: { color: col, width: 0 },
    });
  });
  s.addText("UAE Hub Network", { x: 8.4, y: 4.58, w: 4.4, h: 0.32, fontSize: 11, color: C.muted, fontFace: "Calibri", align: "center" });

  const stats = [
    { num: "44", label: "Network Hubs", sub: "Across the UAE" },
    { num: "8", label: "EV Charging Hubs", sub: "Real-time port tracking" },
    { num: "30s", label: "Refresh Cycle", sub: "Live demand signals" },
    { num: "11", label: "Cities Active", sub: "Multi-city UAE coverage" },
  ];
  stats.forEach((st, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.55 + col * 3.9, y = 1.62 + row * 1.95;
    s.addText(st.num, { x, y, w: 3.6, h: 1.05, fontSize: 68, color: C.white, bold: true, fontFace: "Calibri", align: "center" });
    s.addText(st.label, { x, y: y + 1.02, w: 3.6, h: 0.32, fontSize: 13, color: C.green, bold: true, fontFace: "Calibri", align: "center" });
    s.addText(st.sub, { x, y: y + 1.36, w: 3.6, h: 0.28, fontSize: 11, color: C.muted, fontFace: "Calibri", align: "center" });
  });

  surfaceCard(s, 0.55, 5.55, W - 1.1, 1.68, false);
  const caps = [
    { title: "Atomic Port Tracking", body: "No double-booking — every port state is transactional" },
    { title: "EV Staging States", body: "Charging → Ready → Departing → On Trip" },
    { title: "Live Demand Signal", body: "GPS + zone + match status every 30 seconds" },
  ];
  caps.forEach((cap, i) => {
    s.addText(cap.title, { x: 0.9 + i * 4.1, y: 5.72, w: 3.7, h: 0.32, fontSize: 14, color: C.white, bold: true, fontFace: "Calibri" });
    s.addText(cap.body, { x: 0.9 + i * 4.1, y: 6.08, w: 3.7, h: 0.82, fontSize: 12, color: C.muted, fontFace: "Calibri", wrap: true });
  });
  copyright(s);
})();

// ─── SLIDE 8: Revenue Model ───────────────────────────────────────────────────
(function slide8() {
  const s = pptx.addSlide();
  lightBg(s);
  accentDot(s);

  s.addText("BUSINESS MODEL", {
    x: 0.55, y: 0.2, w: 8, h: 0.25,
    fontSize: 10, color: C.green, bold: true, charSpacing: 2.5, fontFace: "Calibri",
  });
  s.addText("Multiple Revenue Streams, All Compounding", {
    x: 0.55, y: 0.52, w: W - 1.1, h: 0.78,
    fontSize: 40, color: C.lightText, bold: true, fontFace: "Calibri",
  });
  s.addShape(pptx.ShapeType.rect, {
    x: 0.55, y: 1.34, w: W - 1.1, h: 0.04,
    fill: { color: C.green }, line: { color: C.green, width: 0 },
  });

  const streams = [
    { title: "B2B SaaS", bullets: ["Monthly per-fleet subscription", "Dashboard + AI dispatch access", "Tiered: Starter / Growth / Enterprise", "Target: AED 3K–12K / month"] },
    { title: "Per-Ride Take Rate", bullets: ["10% platform fee per completed ride", "Volume scales with driver count", "Instant payout to drivers", "Compounding with network growth"] },
    { title: "Charging Revenue", bullets: ["Revenue share on EV sessions per hub", "ADNOC infrastructure synergy", "Premium hub access tiers", "Demand data monetisation"] },
    { title: "City Licensing", bullets: ["One-time city setup fee", "Recurring annual licence", "Founding Driver Programme fee", "White-label enterprise packages"] },
  ];
  streams.forEach((st, i) => {
    const x = 0.55 + i * 3.1;
    s.addShape(pptx.ShapeType.rect, {
      x, y: 1.52, w: 2.9, h: 4.68, fill: { color: C.lightSurface }, line: { color: "D1D9E6", width: 0.8 },
    });
    s.addShape(pptx.ShapeType.rect, {
      x, y: 1.52, w: 2.9, h: 0.12, fill: { color: C.green }, line: { color: C.green, width: 0 },
    });
    s.addText(st.title, {
      x: x + 0.12, y: 1.82, w: 2.66, h: 0.58,
      fontSize: 16, color: C.lightText, bold: true, fontFace: "Calibri", align: "center", wrap: true,
    });
    st.bullets.forEach((b, j) => {
      s.addText(`• ${b}`, {
        x: x + 0.18, y: 2.6 + j * 0.58, w: 2.58, h: 0.46,
        fontSize: 12, color: C.lightMuted, fontFace: "Calibri", wrap: true,
      });
    });
  });
  s.addShape(pptx.ShapeType.rect, { x: 0.55, y: 6.35, w: W - 1.1, h: 0.82, fill: { color: "E8F3EC" }, line: { color: "B8D8C2", width: 0.5 } });
  s.addText("Target: >60% gross margin on SaaS  ·  >25% on per-ride  ·  >40% on city licensing", {
    x: 0.8, y: 6.52, w: W - 1.5, h: 0.45, fontSize: 13, color: C.lightText, fontFace: "Calibri", align: "center",
  });
  copyright(s);
})();

// ─── SLIDE 9: Operator Dashboard ─────────────────────────────────────────────
(function slide9() {
  const s = pptx.addSlide();
  darkBg(s);
  accentDot(s);
  sectionLabel(s, "THE PLATFORM — OPERATORS");
  slideTitle(s, "Fleet Operators Get a Mission Control Center");

  bulletList(s, [
    "Role-gated access — fleet_owner and admin roles",
    "Hub Status: ports, EV staging, check-in counts — live",
    "Demand Heatmap: 1h / 24h / 7d view, Leaflet clustering",
    "AI Dispatch: top-3 hubs by demand-supply gap",
    "Auto-refreshes every 30 seconds — always current",
  ], 0.55, 1.88);

  surfaceCard(s, 7.05, 1.62, 5.9, 5.2, true);

  // Dashboard platform flow
  journeyFlow(s, 7.3, 2.0,
    ["Login", "Hub Status", "Demand Map", "Dispatch"], 2);

  const panels = [
    { label: "Hub Status Panel", y: 2.72, color: "0D2419" },
    { label: "Fleet Vehicles Panel", y: 3.72, color: "0A1A2E" },
    { label: "Demand Heatmap", y: 4.72, color: "0D2419" },
    { label: "Dispatch Suggestions", y: 5.72, color: "0A1A2E" },
  ];
  panels.forEach(p => {
    s.addShape(pptx.ShapeType.rect, { x: 7.18, y: p.y, w: 5.65, h: 0.78, fill: { color: p.color }, line: { color: C.divider, width: 0.3 } });
    s.addText(p.label, { x: 7.32, y: p.y + 0.1, w: 3.5, h: 0.28, fontSize: 11, color: C.green, bold: true, fontFace: "Calibri" });
    s.addText("Live  ·  Auto-refresh 30s", { x: 7.32, y: p.y + 0.42, w: 5.3, h: 0.24, fontSize: 10, color: C.muted, fontFace: "Calibri" });
  });

  s.addText("Browser-based  ·  No app install  ·  Secure token auth", {
    x: 0, y: H - 0.5, w: W, h: 0.32, fontSize: 13, color: C.green, fontFace: "Calibri", align: "center",
  });
  copyright(s);
})();

// ─── SLIDE 10: Driver Experience ──────────────────────────────────────────────
(function slide10() {
  const s = pptx.addSlide();
  darkBg(s);
  accentDot(s);
  sectionLabel(s, "THE PLATFORM — DRIVERS");
  slideTitle(s, "Drivers Are Guided, Not Just Dispatched");

  bulletList(s, [
    "Animated live toggle with today's earnings always visible",
    "Hub recommendation cards within 8 km of demand zones",
    "Ride card: rating, fare/km, EV badge, PMGTH match",
    "15-second countdown ring — full context, clear decision",
    "Hub check-in at 300 m earns community prestige",
  ], 0.55, 1.88);

  // Driver app journey flow
  journeyFlow(s, 7.1, 1.75,
    ["Go Online", "Hub Rec", "Ride Request", "Active Ride", "Earnings"], 2);

  // Phone frame mockup
  phoneFrame(s, 7.55, 2.35, 2.4, 4.62);

  // Screen content inside phone
  // Earnings bar
  s.addShape(pptx.ShapeType.rect, { x: 7.65, y: 2.65, w: 2.2, h: 0.82, fill: { color: "0D2419" }, line: { color: C.divider, width: 0.3 } });
  s.addText("Earnings", { x: 7.72, y: 2.72, w: 1.2, h: 0.22, fontSize: 8, color: C.muted, fontFace: "Calibri" });
  s.addText("AED 284", { x: 7.72, y: 2.94, w: 1.4, h: 0.4, fontSize: 22, color: C.white, bold: true, fontFace: "Calibri" });
  s.addShape(pptx.ShapeType.ellipse, { x: 9.4, y: 2.8, w: 0.32, h: 0.32, fill: { color: C.green }, line: { color: C.green, width: 0 } });
  s.addText("ON", { x: 9.4, y: 2.8, w: 0.32, h: 0.32, fontSize: 7, color: C.white, bold: true, fontFace: "Calibri", align: "center", valign: "middle" });

  // Hub card
  s.addShape(pptx.ShapeType.rect, { x: 7.65, y: 3.62, w: 2.2, h: 0.72, fill: { color: "0A1A2E" }, line: { color: C.divider, width: 0.3 } });
  s.addText("Dubai Mall Hub  ·  2.1km", { x: 7.72, y: 3.72, w: 2.05, h: 0.24, fontSize: 9, color: C.white, fontFace: "Calibri" });
  s.addText("High demand  →  Navigate", { x: 7.72, y: 3.98, w: 2.05, h: 0.24, fontSize: 9, color: C.green, fontFace: "Calibri" });

  // Ride request card
  s.addShape(pptx.ShapeType.rect, { x: 7.65, y: 4.48, w: 2.2, h: 1.35, fill: { color: "0D2419" }, line: { color: C.green, width: 0.8 } });
  s.addText("Ride Request", { x: 7.72, y: 4.56, w: 1.5, h: 0.22, fontSize: 8, color: C.green, bold: true, fontFace: "Calibri" });
  s.addText("Ahmed  ·  ★4.9  ·  EV", { x: 7.72, y: 4.8, w: 2.0, h: 0.22, fontSize: 9, color: C.white, fontFace: "Calibri" });
  s.addText("AED 2.8/km  ·  PMGTH match", { x: 7.72, y: 5.04, w: 2.0, h: 0.22, fontSize: 8, color: C.muted, fontFace: "Calibri" });
  s.addShape(pptx.ShapeType.ellipse, { x: 9.42, y: 4.56, w: 0.38, h: 0.38, fill: { color: "0D2419" }, line: { color: C.green, width: 1.2 } });
  s.addText("15", { x: 9.42, y: 4.56, w: 0.38, h: 0.38, fontSize: 11, color: C.white, bold: true, fontFace: "Calibri", align: "center", valign: "middle" });
  s.addText("Accept", { x: 7.72, y: 5.42, w: 1.0, h: 0.24, fontSize: 10, color: C.green, bold: true, fontFace: "Calibri" });
  s.addText("Decline", { x: 9.06, y: 5.42, w: 0.72, h: 0.24, fontSize: 10, color: C.muted, fontFace: "Calibri", align: "right" });

  // Second phone: post-ride earnings flash
  phoneFrame(s, 10.3, 2.35, 2.4, 4.62);
  s.addShape(pptx.ShapeType.rect, { x: 10.4, y: 2.65, w: 2.2, h: 4.02, fill: { color: "061A0F" }, line: { color: C.divider, width: 0 } });
  s.addShape(pptx.ShapeType.ellipse, { x: 11.18, y: 3.1, w: 0.64, h: 0.64, fill: { color: C.green }, line: { color: C.green, width: 0 } });
  s.addText("✓", { x: 11.18, y: 3.1, w: 0.64, h: 0.64, fontSize: 22, color: C.white, bold: true, fontFace: "Calibri", align: "center", valign: "middle" });
  s.addText("Ride complete!", { x: 10.4, y: 3.88, w: 2.2, h: 0.28, fontSize: 11, color: C.white, bold: true, fontFace: "Calibri", align: "center" });
  s.addText("+AED 38.50", { x: 10.4, y: 4.2, w: 2.2, h: 0.48, fontSize: 22, color: C.green, bold: true, fontFace: "Calibri", align: "center" });
  s.addText("AED 322 today", { x: 10.4, y: 4.72, w: 2.2, h: 0.28, fontSize: 10, color: C.muted, fontFace: "Calibri", align: "center" });

  copyright(s);
})();

// ─── SLIDE 11: Rider Experience ───────────────────────────────────────────────
(function slide11() {
  const s = pptx.addSlide();
  darkBg(s);
  accentDot(s);
  sectionLabel(s, "THE PLATFORM — RIDERS");
  slideTitle(s, "A Premium EV Experience From First Tap to Arrival");

  bulletList(s, [
    "Smart destination chips — Home, Work, Recent, one tap",
    "EV availability shown live during vehicle selection",
    "Fare locked on blockchain before ride starts",
    "OTP boarding code — your driver is verified",
    "Blockchain-verified receipt delivered on arrival",
  ], 0.55, 1.88);

  // Rider journey flow
  journeyFlow(s, 7.1, 1.75,
    ["Open App", "Book EV", "Wait", "Ride", "Arrive"], 3);

  // Two phones showing different states
  phoneFrame(s, 7.55, 2.35, 2.4, 4.62);

  // Phone 1: Booking screen
  s.addShape(pptx.ShapeType.rect, { x: 7.65, y: 2.65, w: 2.2, h: 0.75, fill: { color: "0A1828" }, line: { color: C.divider, width: 0.3 } });
  s.addText("Good morning, Ahmed", { x: 7.72, y: 2.72, w: 2.05, h: 0.24, fontSize: 9, color: C.white, bold: true, fontFace: "Calibri" });
  s.addText("Where are you heading?", { x: 7.72, y: 2.98, w: 2.05, h: 0.22, fontSize: 8, color: C.muted, fontFace: "Calibri" });
  // Chips
  ["Home", "Office", "DIFC"].forEach((chip, i) => {
    s.addShape(pptx.ShapeType.roundRect, { x: 7.65 + i * 0.72, y: 3.55, w: 0.65, h: 0.28, fill: { color: C.surface }, line: { color: C.divider, width: 0.4 }, rectRadius: 0.12 });
    s.addText(chip, { x: 7.65 + i * 0.72, y: 3.55, w: 0.65, h: 0.28, fontSize: 7, color: C.muted, fontFace: "Calibri", align: "center", valign: "middle" });
  });
  // EV selection
  s.addShape(pptx.ShapeType.rect, { x: 7.65, y: 3.95, w: 2.2, h: 0.88, fill: { color: "0D2419" }, line: { color: C.green, width: 0.6 } });
  s.addText("EV Premium", { x: 7.72, y: 4.02, w: 2.0, h: 0.24, fontSize: 9, color: C.white, bold: true, fontFace: "Calibri" });
  s.addText("3 EVs nearby  ·  AED 24.00", { x: 7.72, y: 4.28, w: 2.0, h: 0.24, fontSize: 8, color: C.green, fontFace: "Calibri" });
  s.addText("Fare locked at booking", { x: 7.72, y: 4.54, w: 2.0, h: 0.22, fontSize: 7, color: C.muted, fontFace: "Calibri" });
  s.addText("Book EV Ride", { x: 7.72, y: 5.02, w: 2.0, h: 0.3, fontSize: 10, color: C.green, bold: true, fontFace: "Calibri", align: "center" });
  s.addShape(pptx.ShapeType.rect, { x: 7.65, y: 5.0, w: 2.2, h: 0.34, fill: { color: C.green }, line: { color: C.green, width: 0 } });
  s.addText("Book EV Ride", { x: 7.65, y: 5.0, w: 2.2, h: 0.34, fontSize: 10, color: C.white, bold: true, fontFace: "Calibri", align: "center", valign: "middle" });
  s.addShape(pptx.ShapeType.rect, { x: 7.65, y: 5.48, w: 2.2, h: 1.22, fill: { color: "0A1828" }, line: { color: C.divider, width: 0.3 } });
  s.addText("Driver on the way", { x: 7.72, y: 5.58, w: 2.0, h: 0.22, fontSize: 9, color: C.white, bold: true, fontFace: "Calibri" });
  s.addText("Khalid  ·  ★4.97  ·  OTP: 8421", { x: 7.72, y: 5.82, w: 2.0, h: 0.22, fontSize: 8, color: C.muted, fontFace: "Calibri" });
  s.addText("Share journey  ·  Coffee", { x: 7.72, y: 6.05, w: 2.0, h: 0.22, fontSize: 8, color: C.green, fontFace: "Calibri" });

  // Phone 2: Arrival + receipt
  phoneFrame(s, 10.3, 2.35, 2.4, 4.62);
  s.addShape(pptx.ShapeType.rect, { x: 10.4, y: 2.65, w: 2.2, h: 4.02, fill: { color: "06180D" }, line: { color: C.divider, width: 0 } });
  s.addText("You've arrived", { x: 10.4, y: 3.0, w: 2.2, h: 0.35, fontSize: 13, color: C.white, bold: true, fontFace: "Calibri", align: "center" });
  s.addShape(pptx.ShapeType.ellipse, { x: 11.18, y: 3.4, w: 0.64, h: 0.64, fill: { color: C.green }, line: { color: C.green, width: 0 } });
  s.addText("✓", { x: 11.18, y: 3.4, w: 0.64, h: 0.64, fontSize: 22, color: C.white, bold: true, fontFace: "Calibri", align: "center", valign: "middle" });
  // Receipt
  s.addShape(pptx.ShapeType.rect, { x: 10.45, y: 4.12, w: 2.1, h: 2.12, fill: { color: C.surface }, line: { color: C.divider, width: 0.4 } });
  s.addText("Receipt", { x: 10.5, y: 4.2, w: 1.6, h: 0.22, fontSize: 9, color: C.muted, bold: true, fontFace: "Calibri" });
  s.addText("AED 24.00", { x: 10.5, y: 4.44, w: 1.6, h: 0.32, fontSize: 15, color: C.white, bold: true, fontFace: "Calibri" });
  s.addText("Blockchain Verified", { x: 10.5, y: 4.78, w: 1.9, h: 0.22, fontSize: 8, color: C.green, fontFace: "Calibri" });
  s.addText("★★★★★", { x: 10.5, y: 5.42, w: 2.0, h: 0.28, fontSize: 13, color: C.green, fontFace: "Calibri", align: "center" });
  s.addText("Rate your driver", { x: 10.5, y: 5.7, w: 2.0, h: 0.22, fontSize: 8, color: C.muted, fontFace: "Calibri", align: "center" });

  copyright(s);
})();

// ─── SLIDE 12: Payments & Trust ───────────────────────────────────────────────
(function slide12() {
  const s = pptx.addSlide();
  darkBg(s);
  accentDot(s);
  sectionLabel(s, "PAYMENTS & TRUST");
  slideTitle(s, "The Only UAE EV Platform With Blockchain-Verified Payments");

  const cols = [
    { sym: "$", title: "Card Payments", label: "Powered by Stripe", items: ["Saved payment methods", "Real-time balance check", "Instant driver payouts", "Itemised AED receipt per ride"] },
    { sym: "T", title: "Crypto Wallet", label: "USDT on Polygon", items: ["In-app crypto wallet", "USDT deposits and spending", "On-chain settlement", "No FX exposure — stable"] },
    { sym: "#", title: "Blockchain Fare Lock", label: "Polygon Network", items: ["Fare hashed before ride starts", "Immutable per-ride audit trail", "Fare Guardian AI disputes", "RideTruth transparency score"] },
  ];
  cols.forEach((col, i) => {
    const x = 0.55 + i * 4.22;
    surfaceCard(s, x, 1.72, 3.92, 4.9, true);
    s.addShape(pptx.ShapeType.ellipse, { x: x + 1.6, y: 1.94, w: 0.72, h: 0.72, fill: { color: C.green }, line: { color: C.green, width: 0 } });
    s.addText(col.sym, { x: x + 1.6, y: 1.9, w: 0.72, h: 0.8, fontSize: 22, color: C.white, bold: true, fontFace: "Calibri", align: "center" });
    s.addText(col.title, { x: x + 0.25, y: 2.82, w: 3.42, h: 0.42, fontSize: 17, color: C.white, bold: true, fontFace: "Calibri", align: "center" });
    s.addText(col.label, { x: x + 0.25, y: 3.24, w: 3.42, h: 0.28, fontSize: 12, color: C.green, fontFace: "Calibri", align: "center" });
    col.items.forEach((item, j) => {
      s.addText(`• ${item}`, { x: x + 0.38, y: 3.65 + j * 0.52, w: 3.35, h: 0.42, fontSize: 13, color: C.muted, fontFace: "Calibri", wrap: true });
    });
  });
  s.addShape(pptx.ShapeType.rect, { x: 0.55, y: 6.78, w: W - 1.1, h: 0.48, fill: { color: C.surface }, line: { color: C.divider, width: 0.5 } });
  s.addText("Every ride is auditable. Every fare is defensible.", {
    x: 0.55, y: 6.86, w: W - 1.1, h: 0.34,
    fontSize: 16, color: C.green, bold: true, fontFace: "Calibri", align: "center",
  });
  copyright(s);
})();

// ─── SLIDE 13: City Expansion ─────────────────────────────────────────────────
(function slide13() {
  const s = pptx.addSlide();
  lightBg(s);
  accentDot(s);

  s.addText("EXPANSION", { x: 0.55, y: 0.2, w: 8, h: 0.25, fontSize: 10, color: C.green, bold: true, charSpacing: 2.5, fontFace: "Calibri" });
  s.addText("A Repeatable Playbook for Every UAE City", { x: 0.55, y: 0.52, w: W - 1.1, h: 0.78, fontSize: 40, color: C.lightText, bold: true, fontFace: "Calibri" });
  s.addShape(pptx.ShapeType.rect, { x: 0.55, y: 1.34, w: W - 1.1, h: 0.04, fill: { color: C.green }, line: { color: C.green, width: 0 } });

  s.addShape(pptx.ShapeType.rect, { x: 2.42, y: 2.48, w: 8.5, h: 0.06, fill: { color: "C0D8CA" }, line: { color: "C0D8CA", width: 0 } });

  phaseBox(s, 0.55, 1.58, "1", "Testing",
    ["Map UAE hubs and demand zones", "Seed founding driver cohort", "AI pricing calibration per city", "End-to-end launch checklist"]);
  phaseBox(s, 4.87, 1.58, "2", "Soft Launch",
    ["Activate Founding Driver Programme", "City Champion onboarding", "Limited rider beta access", "Demand heatmap validation"]);
  phaseBox(s, 9.18, 1.58, "3", "Live",
    ["Full public launch in city", "City Brain demand modelling", "Multi-currency + AED active", "Community Prestige scoring live"]);

  s.addShape(pptx.ShapeType.rect, { x: 0.55, y: 6.22, w: W - 1.1, h: 1.02, fill: { color: "E8F3EC" }, line: { color: "B8D8C2", width: 0.5 } });
  const cstats = ["UAE City Network", "Multi-City Ready", "3-Phase Rollout", "48-Hour Activation"];
  cstats.forEach((st, i) => {
    s.addText(st, { x: 0.85 + i * 3.0, y: 6.56, w: 2.7, h: 0.42, fontSize: 13, color: C.lightText, bold: true, fontFace: "Calibri", align: "center" });
    if (i < 3) s.addShape(pptx.ShapeType.rect, { x: 3.82 + i * 3.0, y: 6.42, w: 0.02, h: 0.65, fill: { color: "C0D8CA" }, line: { color: "C0D8CA", width: 0 } });
  });
  copyright(s);
})();

// ─── SLIDE 14: Competitive Positioning ───────────────────────────────────────
(function slide14() {
  const s = pptx.addSlide();
  darkBg(s);
  accentDot(s);
  sectionLabel(s, "COMPETITIVE MOAT");
  slideTitle(s, "Built for EVs. Built for UAE. Built to Last.");
  compTable(s);
  s.addShape(pptx.ShapeType.rect, { x: 0.4, y: 6.68, w: W - 0.8, h: 0.58, fill: { color: C.surface }, line: { color: C.divider, width: 0.5 } });
  s.addText("This is not a feature advantage. It is an architectural one.", {
    x: 0.4, y: 6.76, w: W - 0.8, h: 0.38,
    fontSize: 15, color: C.green, bold: true, fontFace: "Calibri", align: "center",
  });
  copyright(s);
})();

// ─── SLIDE 15: The Ask & Vision ───────────────────────────────────────────────
(function slide15() {
  const s = pptx.addSlide();
  darkBg(s);
  accentDot(s);

  s.addText("THE OPPORTUNITY", { x: 0.55, y: 0.2, w: 8, h: 0.25, fontSize: 10, color: C.green, bold: true, charSpacing: 2.5, fontFace: "Calibri" });
  s.addText("Ready to Deploy. Ready to Scale.", { x: 0.55, y: 0.52, w: W - 1.1, h: 0.78, fontSize: 42, color: C.white, bold: true, fontFace: "Calibri" });
  s.addShape(pptx.ShapeType.rect, { x: 0.55, y: 1.34, w: W - 1.1, h: 0.04, fill: { color: C.green }, line: { color: C.green, width: 0 } });

  const askStats = [
    { num: "44", label: "UAE Hubs Live" },
    { num: "8", label: "EV Charging Hubs" },
    { num: "100%", label: "Full Stack Shipped" },
    { num: "48h", label: "City Activation Time" },
  ];
  askStats.forEach((st, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.55 + col * 4.45, y = 1.52 + row * 1.78;
    surfaceCard(s, x, y, 3.85, 1.55, false);
    s.addText(st.num, { x, y: y + 0.1, w: 3.85, h: 0.95, fontSize: 58, color: C.white, bold: true, fontFace: "Calibri", align: "center" });
    s.addText(st.label, { x, y: y + 1.08, w: 3.85, h: 0.32, fontSize: 13, color: C.green, bold: true, fontFace: "Calibri", align: "center" });
  });

  surfaceCard(s, 9.42, 1.52, 3.58, 3.1, true);
  s.addText("Investment", { x: 9.62, y: 1.72, w: 3.1, h: 0.28, fontSize: 11, color: C.green, bold: true, fontFace: "Calibri", align: "center" });
  s.addText("[AMOUNT]", { x: 9.42, y: 2.1, w: 3.58, h: 0.88, fontSize: 40, color: C.white, bold: true, fontFace: "Calibri", align: "center" });
  s.addText("UAE city rollout · Fleet partnerships · Intelligence depth", {
    x: 9.62, y: 3.08, w: 3.18, h: 0.42, fontSize: 10.5, color: C.muted, fontFace: "Calibri", align: "center", wrap: true,
  });

  s.addText("Let's build the OS the UAE's EV future runs on.", {
    x: 0, y: 5.28, w: W, h: 0.72, fontSize: 26, color: C.green, bold: true, fontFace: "Calibri", align: "center",
  });
  s.addShape(pptx.ShapeType.rect, { x: 0.55, y: 6.18, w: W - 1.1, h: 0.72, fill: { color: C.surface }, line: { color: C.divider, width: 0.5 } });
  s.addText("Contact:  [Email]  ·  [Phone]  ·  adnoc-evos.com", {
    x: 0.55, y: 6.35, w: W - 1.1, h: 0.32, fontSize: 12, color: C.muted, fontFace: "Calibri", align: "center",
  });
  // Presenter name
  s.addShape(pptx.ShapeType.rect, {
    x: 0.55, y: 6.88, w: W - 1.1, h: 0.38,
    fill: { color: "0A1828" }, line: { color: C.divider, width: 0.5 },
  });
  s.addText("Khalid Al Marzooqi  ·  180880", {
    x: 0.55, y: 6.9, w: W - 1.1, h: 0.34,
    fontSize: 13, color: C.green, bold: true, fontFace: "Calibri", align: "center", valign: "middle",
  });
  // copyright is rendered over the bottom of slide — adjust y slightly
  s.addText("© 2026–2027 ADNOC Distribution Retail. Confidential.", {
    x: 0.55, y: H - 0.17, w: W - 1.1, h: 0.16,
    fontSize: 7, color: "3A4A60", fontFace: "Calibri", align: "center",
  });
})();

// ═══════════════════════════════════════════════════════════════════════════════
// POST-PROCESS: Inject slide transitions + entrance animations via JSZip
// ═══════════════════════════════════════════════════════════════════════════════

// Per-slide transition config
const TRANSITIONS = [
  { type: "fade",  dur: 500  },  // 1 Cover
  { type: "push",  dur: 400, dir: "l" }, // 2 Why Now
  { type: "fade",  dur: 400  },  // 3 Problem
  { type: "push",  dur: 400, dir: "l" }, // 4 Solution
  { type: "fade",  dur: 400  },  // 5 Market
  { type: "push",  dur: 400, dir: "l" }, // 6 Traction
  { type: "fade",  dur: 400  },  // 7 Intelligence
  { type: "push",  dur: 400, dir: "l" }, // 8 Revenue
  { type: "fade",  dur: 400  },  // 9 Operator
  { type: "push",  dur: 400, dir: "l" }, // 10 Driver
  { type: "fade",  dur: 400  },  // 11 Rider
  { type: "push",  dur: 400, dir: "l" }, // 12 Payments
  { type: "fade",  dur: 400  },  // 13 Expansion
  { type: "push",  dur: 400, dir: "l" }, // 14 Competitive
  { type: "fade",  dur: 600  },  // 15 Ask
];

function buildTransitionXml(t) {
  const durAttr = `dur="${t.dur}"`;
  if (t.type === "fade") {
    return `<p:transition spd="med" ${durAttr}><p:fade/></p:transition>`;
  }
  if (t.type === "push") {
    return `<p:transition spd="med" ${durAttr}><p:push dir="${t.dir || "l"}"/></p:transition>`;
  }
  return `<p:transition spd="med" ${durAttr}><p:fade/></p:transition>`;
}

// Simple entrance animation — fade in for a given shape spid list
function buildFadeInAnim(spids) {
  if (!spids || spids.length === 0) return "";
  let seqId = 10;
  const parNodes = spids.map((spid, idx) => {
    const ctnId = seqId++;
    const setId = seqId++;
    const animId = seqId++;
    return `
    <p:par>
      <p:cTn id="${ctnId}" fill="hold">
        <p:stCondLst><p:cond delay="${idx * 150}"/></p:stCondLst>
        <p:childTnLst>
          <p:set>
            <p:cBhvr>
              <p:cTn id="${setId}" dur="1" fill="hold"/>
              <p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>
              <p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst>
            </p:cBhvr>
            <p:to><p:strVal val="visible"/></p:to>
          </p:set>
          <p:animEffect transition="in" filter="fade">
            <p:cBhvr>
              <p:cTn id="${animId}" dur="500"/>
              <p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>
            </p:cBhvr>
          </p:animEffect>
        </p:childTnLst>
      </p:cTn>
    </p:par>`;
  }).join("\n");

  return `
  <p:timing>
    <p:tnLst>
      <p:par>
        <p:cTn id="1" dur="indefinite" restart="whenNotActive" nodeType="tmRoot">
          <p:childTnLst>
            <p:seq concurrent="1" nextAc="seek">
              <p:cTn id="2" dur="indefinite" nodeType="mainSeq">
                <p:childTnLst>
                  <p:par>
                    <p:cTn id="3" fill="hold">
                      <p:stCondLst><p:cond delay="indefinite"/></p:stCondLst>
                      <p:childTnLst>${parNodes}</p:childTnLst>
                    </p:cTn>
                  </p:par>
                </p:childTnLst>
              </p:cTn>
            </p:seq>
          </p:childTnLst>
        </p:cTn>
      </p:par>
    </p:tnLst>
    <p:bldLst>
      ${spids.map(id => `<p:bldP spid="${id}" grpId="0"/>`).join("\n      ")}
    </p:bldLst>
  </p:timing>`;
}

async function postProcess(filePath) {
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);

  for (let i = 0; i < TRANSITIONS.length; i++) {
    const slideFile = `ppt/slides/slide${i + 1}.xml`;
    const slideEntry = zip.file(slideFile);
    if (!slideEntry) continue;

    let xml = await slideEntry.async("string");
    const transXml = buildTransitionXml(TRANSITIONS[i]);

    // Collect shape spids for first few shapes to animate (spids 2, 3, 4, 5)
    // We animate the title shapes by finding spid values via regex
    const spidMatches = [...xml.matchAll(/spid="(\d+)"/g)].map(m => m[1]);
    // Animate the first 3 unique spids (title + 2 content blocks)
    const animSpids = [...new Set(spidMatches)].slice(0, 3);

    // Inject transition before </p:sld>
    if (!xml.includes("<p:transition")) {
      xml = xml.replace("</p:sld>", `${transXml}\n</p:sld>`);
    }

    // Inject timing/animation (only if no timing block already present)
    if (!xml.includes("<p:timing>") && animSpids.length > 0) {
      const animXml = buildFadeInAnim(animSpids);
      xml = xml.replace("</p:sld>", `${animXml}\n</p:sld>`);
    }

    zip.file(slideFile, xml);
  }

  const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  fs.writeFileSync(filePath, out);
  console.log(`Animations + transitions injected into ${path.basename(filePath)}`);
}

// ─── Generate & post-process ──────────────────────────────────────────────────
pptx.writeFile({ fileName: OUT })
  .then(() => postProcess(OUT))
  .then(() => {
    console.log("ADNOC_EV_OS_Presentation.pptx complete.");
    process.exit(0);
  })
  .catch(err => {
    console.error("Error:", err);
    process.exit(1);
  });
