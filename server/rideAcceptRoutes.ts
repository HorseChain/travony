/**
 * Ride-accept links — "earn before installing anything".
 *
 * The WhatsApp new-ride broadcast includes a per-driver HMAC-signed link.
 * Opening it shows the job; tapping Accept mints a short-lived REAL session
 * for that driver and calls the normal PATCH /api/rides/:id — so the atomic
 * claim, approved-status re-check, vehicle requirement, named-fare expiry and
 * target-driver reservation gates are exactly the ones the app uses. This
 * file never transitions a ride itself.
 *
 * GET renders only (WhatsApp link previews prefetch GETs — no side effects);
 * the session is minted by an explicit POST from the page.
 */
import type { Express } from "express";
import { randomBytes } from "crypto";
import { storage } from "./storage";
import { verifyRideAcceptToken } from "./onboardingAgent";

function esc(s: string): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function page(title: string, bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${esc(title)} · Travony</title>
<style>
:root{--bg:#0b0f14;--card:#141b23;--txt:#eef3f8;--dim:#8fa1b3;--amber:#f5a623;--green:#2ecc71;--red:#e74c3c}
*{box-sizing:border-box;margin:0;padding:0}body{background:var(--bg);color:var(--txt);font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}
.card{background:var(--card);border-radius:16px;padding:24px;max-width:420px;width:100%}
h1{font-size:20px;margin-bottom:4px}.dim{color:var(--dim);font-size:13px;margin-bottom:16px}
.row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:14px}
.row b{text-align:right}.fare{font-size:22px;color:var(--amber);font-weight:700;margin:14px 0}
.btn{display:block;width:100%;border:0;border-radius:12px;padding:15px;font-size:16px;font-weight:700;cursor:pointer;margin-top:10px}
.btn-green{background:var(--green);color:#05130a}.btn-dark{background:#1f2a36;color:var(--txt)}
.msg{margin-top:12px;font-size:14px;color:var(--dim)}.err{color:var(--red)}.ok{color:var(--green)}
.hidden{display:none}.badge{display:inline-block;background:rgba(245,166,35,.15);color:var(--amber);border-radius:8px;padding:3px 8px;font-size:12px;margin-bottom:12px}
</style></head><body><div class="card">${bodyHtml}</div></body></html>`;
}

export function registerRideAcceptRoutes(app: Express): void {
  // Job page — render only, zero side effects (link-preview crawlers hit this).
  app.get("/go/a/:token", async (req, res) => {
    try {
      const parsed = verifyRideAcceptToken(req.params.token);
      if (!parsed) {
        return res
          .status(410)
          .send(page("Link expired", `<h1>This link has expired</h1><div class="dim">Ride links are only valid for a short time. Fresh jobs keep arriving in your chat while you're online.</div>`));
      }
      const [ride, driver] = await Promise.all([
        storage.getRide(parsed.rideId),
        storage.getDriver(parsed.driverId),
      ]);
      if (!ride || !driver) {
        return res.status(404).send(page("Not found", `<h1>Ride not found</h1><div class="dim">This job is no longer available.</div>`));
      }
      const fare = parseFloat(ride.estimatedFare || ride.actualFare || "0");
      const currency = ride.currency || "AED";
      const taken = ride.status !== "pending";
      const body = `
<span class="badge">Travony job</span>
<h1>New ride request</h1>
<div class="dim">Accept it here — no app needed.</div>
<div class="row"><span>Pickup</span><b>${esc(ride.pickupAddress || "")}</b></div>
<div class="row"><span>Drop-off</span><b>${esc(ride.dropoffAddress || "")}</b></div>
${ride.distance ? `<div class="row"><span>Distance</span><b>${esc(parseFloat(ride.distance).toFixed(1))} km</b></div>` : ""}
<div class="fare">${esc(currency)} ${esc(fare.toFixed(2))}</div>
${taken
        ? `<div class="msg err">This ride was already taken by another driver. Stay online — the next one is coming.</div>`
        : `<button class="btn btn-green" id="btn-accept">Accept this ride</button>
<div class="msg hidden" id="msg"></div>
<div id="actions" class="hidden">
  <button class="btn btn-dark" id="btn-arriving">I've arrived at pickup</button>
  <button class="btn btn-dark" id="btn-start">Start trip</button>
  <button class="btn btn-green" id="btn-complete">Complete trip</button>
</div>
<script>
(function(){
var TOKEN=${JSON.stringify(req.params.token)},RIDE=${JSON.stringify(ride.id)},SESSION=null;
function $(i){return document.getElementById(i)}
function msg(t,cls){var m=$("msg");m.textContent=t;m.className="msg "+(cls||"");}
function patch(status,extra,done){
  var body=Object.assign({status:status},extra||{});
  fetch("/api/rides/"+RIDE,{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:"Bearer "+SESSION},body:JSON.stringify(body)})
    .then(function(r){return r.json().then(function(j){return{ok:r.ok,body:j}})})
    .then(done)
    .catch(function(){msg("Network error — try again.","err")});
}
$("btn-accept").onclick=function(){
  var b=$("btn-accept");b.disabled=true;b.textContent="Accepting…";
  fetch("/api/ride-accept/"+encodeURIComponent(TOKEN)+"/session",{method:"POST"})
    .then(function(r){return r.json().then(function(j){return{ok:r.ok,body:j}})})
    .then(function(r){
      if(!r.ok){b.disabled=false;b.textContent="Accept this ride";msg(r.body.message||"Couldn't verify this link.","err");return}
      SESSION=r.body.token;
      patch("accepted",{},function(p){
        if(!p.ok){b.disabled=false;b.textContent="Accept this ride";msg(p.body.message||"Couldn't accept this ride.","err");return}
        b.classList.add("hidden");$("actions").classList.remove("hidden");
        msg("Ride is yours! Head to the pickup. The rider sees you're on the way.","ok");
      });
    })
    .catch(function(){b.disabled=false;b.textContent="Accept this ride";msg("Network error — try again.","err")});
};
$("btn-arriving").onclick=function(){patch("arriving",{},function(p){msg(p.ok?"Rider notified — you're at pickup. Ask for the pickup code.":(p.body.message||"Update failed."),p.ok?"ok":"err")})};
$("btn-start").onclick=function(){patch("in_progress",{startedAt:new Date().toISOString()},function(p){msg(p.ok?"Trip started. Drive safe!":(p.body.message||"Update failed."),p.ok?"ok":"err")})};
$("btn-complete").onclick=function(){patch("completed",{completedAt:new Date().toISOString()},function(p){
  if(p.ok){$("actions").classList.add("hidden");msg("Trip completed — collect the cash fare. Your earnings are recorded. Stay online for the next job!","ok")}
  else msg(p.body.message||"Update failed.","err")})};
})();
</script>`}`;
      res.send(page("New ride", body));
    } catch (error) {
      console.error("[RideAccept] page error:", error);
      res.status(500).send(page("Error", `<h1>Something went wrong</h1><div class="dim">Please try the link again.</div>`));
    }
  });

  // Mint a short-lived real session for the driver the token names. The ride
  // transition itself still goes through PATCH /api/rides/:id with all gates.
  app.post("/api/ride-accept/:token/session", async (req, res) => {
    try {
      const parsed = verifyRideAcceptToken(req.params.token);
      if (!parsed) {
        return res.status(410).json({ message: "This link has expired. Fresh jobs keep arriving in your chat." });
      }
      const driver = await storage.getDriver(parsed.driverId);
      if (!driver) return res.status(404).json({ message: "Driver account not found." });
      if (driver.status !== "approved") {
        return res.status(403).json({ message: "Your driver account isn't approved yet." });
      }
      const user = await storage.getUser(driver.userId);
      if (!user) return res.status(404).json({ message: "Account not found." });
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12h — enough to finish the trip
      await storage.createSession(token, user.id, user.role === "admin" ? "driver" : user.role, expiresAt);
      res.json({ token, rideId: parsed.rideId });
    } catch (error) {
      console.error("[RideAccept] session error:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });
}
