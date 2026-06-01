const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const HUB_DIR = path.resolve(__dirname, "../attached_assets/hub_frames");
const APP_DIR = path.resolve(__dirname, "../attached_assets/app_frames");
const WORK = path.resolve(__dirname, "../attached_assets/video_work");
const OUT = path.resolve(__dirname, "../attached_assets/generated_videos");
fs.mkdirSync(WORK, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
const FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";

const W = 1920, H = 1080;

const FRAMES = [
  { src: `${HUB_DIR}/01_dispatch_overview.png`, label: "AI DISPATCH ENGINE", sub: "Real-time fleet coordination across 44 hubs", dur: 4 },
  { src: `${HUB_DIR}/02_dispatch_hubs.png`, label: "DISPATCH INTELLIGENCE", sub: "Automated driver-hub matching & routing", dur: 3 },
  { src: `${HUB_DIR}/03_hub_status_top.png`, label: "HUB STATUS MONITOR", sub: "44 network hubs | 8 EV charging stations", dur: 4 },
  { src: `${HUB_DIR}/04_hub_status_ev_hubs.png`, label: "EV CHARGING HUBS", sub: "King Khalid Airport | Mall of Emirates | Dubai Marina", dur: 4 },
  { src: `${HUB_DIR}/05_hub_status_custom.png`, label: "CUSTOM & PARTNER HUBS", sub: "JBR Beach | Abu Dhabi Corniche | Salmiya", dur: 3 },
  { src: `${HUB_DIR}/06_hub_status_more.png`, label: "EXTENDED HUB NETWORK", sub: "GCC-wide coverage across UAE, Kuwait, Bahrain", dur: 3 },
  { src: `${HUB_DIR}/08_hub_detail_dubai_mall.png`, label: "HUB DETAIL VIEW", sub: "Dubai Mall EV Hub | 8/12 ports active", dur: 4 },
  { src: `${HUB_DIR}/09_demand_map.png`, label: "EV DEMAND HEATMAP", sub: "Real-time demand visualization across Dubai", dur: 4 },
  { src: `${HUB_DIR}/10_demand_map_24h.png`, label: "24H DEMAND ANALYTICS", sub: "Demand Events | Match Rate | Unmatched Rate", dur: 3 },
  { src: `${HUB_DIR}/12_fleet_vehicles.png`, label: "FLEET VEHICLE MANAGEMENT", sub: "Vehicle status, battery levels & assignments", dur: 3 },
  { src: `${APP_DIR}/01_home_screen.png`, label: "RIDER APP", sub: "Book rides to Dubai Mall, Airport & hubs", dur: 4, mobile: true },
  { src: `${APP_DIR}/03_network_hubs.png`, label: "NETWORK HUBS", sub: "Active hubs | Demand levels | Nearby vehicles", dur: 3, mobile: true },
  { src: `${APP_DIR}/04_coffee.png`, label: "COFFEE SERVICE", sub: "Order | Buy at Hub | Gift to someone", dur: 3, mobile: true },
  { src: `${APP_DIR}/07_wallet.png`, label: "PAYMENTS & WALLET", sub: "Cash | USDT Crypto | Card | AED wallet", dur: 4, mobile: true },
  { src: `${APP_DIR}/09_profile.png`, label: "RIDER PROFILE", sub: "Ride Truth Engine | Ghost Mode | Analytics", dur: 3, mobile: true },
  { src: `${HUB_DIR}/16_support.png`, label: "SUPPORT CENTER", sub: "24/7 rider & driver support system", dur: 3 },
];

let frameIdx = 0;

for (const frame of FRAMES) {
  if (!fs.existsSync(frame.src)) {
    console.log(`SKIP: ${frame.src}`);
    continue;
  }

  const outFile = path.join(WORK, `frame_${String(frameIdx).padStart(3, "0")}.png`);

  if (frame.mobile) {
    const cmd = [
      `ffmpeg -y -f lavfi -i color=c=0x1a1a2e:s=${W}x${H} -i "${frame.src}"`,
      `-filter_complex "`,
      `[1:v]scale=-1:${H - 120}[phone];`,
      `[0:v][phone]overlay=(W-w)/2:60[bg];`,
      `[bg]drawtext=fontfile='${FONT}':text='ADNOC EV OS':fontsize=28:fontcolor=white:x=40:y=25,`,
      `drawtext=fontfile='${FONT}':text='${frame.label}':fontsize=36:fontcolor=0x00d4aa:x=40:y=${H - 80},`,
      `drawtext=fontfile='${FONT_REG}':text='${frame.sub}':fontsize=22:fontcolor=0xcccccc:x=40:y=${H - 45},`,
      `drawtext=fontfile='${FONT_REG}':text='Khalid Al Marzooqi':fontsize=16:fontcolor=0x666666:x=W-tw-40:y=${H - 30}"`,
      `-frames:v 1 "${outFile}"`,
    ].join(" ");
    try { execSync(cmd, { stdio: "pipe" }); } catch (e) { console.log(`ERR frame ${frameIdx}: ${e.stderr?.toString().slice(0,200)}`); }
  } else {
    const cmd = [
      `ffmpeg -y -i "${frame.src}"`,
      `-vf "scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x1a1a2e,`,
      `drawtext=fontfile='${FONT}':text='ADNOC EV OS':fontsize=28:fontcolor=white:x=40:y=25,`,
      `drawtext=fontfile='${FONT}':text='${frame.label}':fontsize=36:fontcolor=0x00d4aa:x=40:y=${H - 80},`,
      `drawtext=fontfile='${FONT_REG}':text='${frame.sub}':fontsize=22:fontcolor=0xcccccc:x=40:y=${H - 45},`,
      `drawtext=fontfile='${FONT_REG}':text='Khalid Al Marzooqi':fontsize=16:fontcolor=0x666666:x=W-tw-40:y=${H - 30}"`,
      `-frames:v 1 "${outFile}"`,
    ].join(" ");
    try { execSync(cmd, { stdio: "pipe" }); } catch (e) { console.log(`ERR frame ${frameIdx}: ${e.stderr?.toString().slice(0,200)}`); }
  }

  if (fs.existsSync(outFile)) {
    console.log(`[OK] frame_${String(frameIdx).padStart(3, "0")} ${frame.label} (${frame.dur}s)`);
  }
  frameIdx++;
}

console.log(`\n=== Building video from ${frameIdx} frames ===`);

let concatContent = "";
for (let i = 0; i < frameIdx; i++) {
  const f = path.join(WORK, `frame_${String(i).padStart(3, "0")}.png`);
  if (!fs.existsSync(f)) continue;
  concatContent += `file '${f}'\nduration ${FRAMES[i].dur}\n`;
}
concatContent += `file '${path.join(WORK, `frame_${String(frameIdx - 1).padStart(3, "0")}.png`)}'\n`;

const concatFile = path.join(WORK, "concat.txt");
fs.writeFileSync(concatFile, concatContent);

const videoOut = path.join(OUT, "adnoc_ev_os_real_platform.mp4");
const cmd = `ffmpeg -y -f concat -safe 0 -i "${concatFile}" -vf "format=yuv420p" -c:v libx264 -preset medium -crf 20 -r 30 "${videoOut}"`;
try {
  execSync(cmd, { stdio: "pipe", timeout: 120000 });
  const stat = fs.statSync(videoOut);
  console.log(`\n[DONE] ${path.basename(videoOut)} (${Math.round(stat.size / 1024 / 1024)}MB)`);
} catch (e) {
  console.log(`VIDEO BUILD ERROR: ${e.stderr?.toString().slice(0, 500)}`);
}

// Also check if we have AI intro to combine
const aiIntro = path.join(OUT, "adnoc_ev_os_platform_tour.mp4");
if (fs.existsSync(aiIntro)) {
  const fullOut = path.join(OUT, "adnoc_ev_os_full_demo.mp4");
  const listFile = path.join(WORK, "full_concat.txt");
  fs.writeFileSync(listFile, `file '${aiIntro}'\nfile '${videoOut}'\n`);

  // First re-encode AI intro to match dimensions
  const aiReencoded = path.join(WORK, "ai_intro_reencoded.mp4");
  try {
    execSync(`ffmpeg -y -i "${aiIntro}" -vf "scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p" -c:v libx264 -preset medium -crf 20 -r 30 -an "${aiReencoded}"`, { stdio: "pipe", timeout: 60000 });
  } catch (e) { console.log("AI re-encode error"); }

  if (fs.existsSync(aiReencoded)) {
    const listFile2 = path.join(WORK, "full_concat2.txt");
    fs.writeFileSync(listFile2, `file '${aiReencoded}'\nfile '${videoOut}'\n`);
    try {
      execSync(`ffmpeg -y -f concat -safe 0 -i "${listFile2}" -c copy "${fullOut}"`, { stdio: "pipe", timeout: 60000 });
      const stat2 = fs.statSync(fullOut);
      console.log(`[DONE] ${path.basename(fullOut)} (${Math.round(stat2.size / 1024 / 1024)}MB)`);
    } catch (e) {
      console.log(`FULL CONCAT ERROR: ${e.stderr?.toString().slice(0, 300)}`);
    }
  }
}
