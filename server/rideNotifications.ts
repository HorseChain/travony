import { db } from "./db";
import { vehicles, drivers } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { storage } from "./storage";
import { calculateFeeBreakdown } from "./blockchain";
import { getRegionByCode } from "./regionService";
import { sendRideReceiptEmail, sendDriverEarningsEmail, sendDriverRideRequestEmail, sendStatusUpdateEmail } from "./email";
import { sendDriverNotification, sendTelegramMessage } from "./telegramBot";
import { sendSmsMessage } from "./twilioService";
import { sendWhatsAppMessage } from "./whatsappBot";
import { getDriverPrayerPauseState, getMosqueHubZones, isMosqueDestination, rideDistanceKm, LONG_TRIP_KM } from "./prayerRides";

// Region-aware platform fee percent for a ride (falls back to 10%). Keeps driver
// pay/receipt figures consistent with the ride's market (e.g. 5% budget markets).
async function regionFeePercent(ride: any): Promise<number> {
  const region = await getRegionByCode(ride?.regionCode || "AE").catch(() => null);
  return region ? region.platformFeePercent : 10;
}

// Real, dialable phone numbers only (skip empty/synthetic).
function isSendablePhone(phone?: string | null): boolean {
  if (!phone) return false;
  return /^\+?\d{7,15}$/.test(phone.trim().replace(/[\s-]/g, ""));
}

// Phone/Telegram signups are auto-provisioned with synthetic, non-deliverable
// addresses (e.g. phone_...@travony.local, ...@telegram.travony). Never email those.
function isSendableEmail(email?: string | null): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  if (lower.endsWith("@telegram.travony")) return false;
  if (lower.endsWith("@travony.local")) return false;
  if (lower.endsWith(".local")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Escape user-controlled text before it is interpolated into outbound email HTML
// (addresses, names, vehicle info, OTP) to prevent HTML/content injection.
function escapeHtml(value?: string | null): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function getDriverDescriptors(driverId: string | null | undefined): Promise<{
  driverName?: string;
  vehicleInfo?: string;
}> {
  if (!driverId) return {};
  const driver = await storage.getDriver(driverId);
  if (!driver) return {};
  const driverUser = await storage.getUser(driver.userId);
  const [veh] = await db.select().from(vehicles).where(eq(vehicles.driverId, driver.id)).limit(1);
  let vehicleInfo: string | undefined;
  if (veh) {
    const desc = `${veh.color ? veh.color + " " : ""}${veh.make || ""} ${veh.model || ""}`.trim();
    vehicleInfo = (desc + (veh.plateNumber ? ` · ${veh.plateNumber}` : "")).trim() || undefined;
  }
  return { driverName: driverUser?.name || undefined, vehicleInfo };
}

// Canonical rider-receipt builder. Shared by the Telegram "email me this receipt"
// button and the automatic completion email, so the receipt format stays identical.
export async function buildAndSendRiderReceipt(
  rideId: string,
  toEmail: string,
  fallbackName: string,
): Promise<boolean> {
  try {
    const ride = await storage.getRide(rideId);
    if (!ride) return false;
    const total = parseFloat(ride.actualFare || ride.estimatedFare || "0");
    const feePct = await regionFeePercent(ride);
    const fees = calculateFeeBreakdown(total, feePct);
    const { driverName, vehicleInfo } = await getDriverDescriptors(ride.driverId);

    return await sendRideReceiptEmail({
      customerName: fallbackName || "there",
      customerEmail: toEmail,
      rideId: ride.id,
      pickupAddress: ride.pickupAddress,
      dropoffAddress: ride.dropoffAddress,
      distance: ride.distance ? parseFloat(ride.distance).toFixed(1) : "0",
      duration: ride.duration ? String(ride.duration) : "0",
      fare: total.toFixed(2),
      platformFee: fees.platformFee.toFixed(2),
      driverEarnings: fees.driverShare.toFixed(2),
      blockchainHash: ride.blockchainHash || "",
      blockchainTxHash: (ride as any).blockchainTxHash || undefined,
      completedAt: new Date(ride.completedAt || new Date()).toISOString(),
      driverName,
      vehicleInfo,
      currency: ride.currency || "AED",
      feePercent: feePct,
    });
  } catch (error) {
    console.error("[RideNotifications] buildAndSendRiderReceipt error:", error);
    return false;
  }
}

// Fire-and-forget: on completion, email the receipt to the rider and an earnings
// summary to the driver. Placeholder/synthetic emails are skipped silently.
export async function sendRideCompletionEmails(rideId: string): Promise<void> {
  try {
    const ride = await storage.getRide(rideId);
    if (!ride) return;
    const total = parseFloat(ride.actualFare || ride.estimatedFare || "0");
    const feePct = await regionFeePercent(ride);
    const fees = calculateFeeBreakdown(total, feePct);
    const completedAt = new Date(ride.completedAt || new Date()).toISOString();

    // Rider receipt
    const rider = await storage.getUser(ride.customerId);
    if (rider && isSendableEmail(rider.email)) {
      await buildAndSendRiderReceipt(rideId, rider.email!, rider.name || "there");
    }

    // Driver earnings summary
    if (ride.driverId) {
      const driver = await storage.getDriver(ride.driverId);
      const driverUser = driver ? await storage.getUser(driver.userId) : undefined;
      if (driverUser && isSendableEmail(driverUser.email)) {
        await sendDriverEarningsEmail({
          driverName: driverUser.name || "Driver",
          driverEmail: driverUser.email!,
          rideId: ride.id,
          pickupAddress: ride.pickupAddress,
          dropoffAddress: ride.dropoffAddress,
          totalFare: total.toFixed(2),
          platformFee: fees.platformFee.toFixed(2),
          earnings: fees.driverShare.toFixed(2),
          blockchainHash: ride.blockchainHash || "",
          blockchainTxHash: (ride as any).blockchainTxHash || undefined,
          completedAt,
          currency: ride.currency || "AED",
          feePercent: feePct,
        });
      }
    }
  } catch (error) {
    console.error("[RideNotifications] sendRideCompletionEmails error:", error);
  }
}

// Fire-and-forget: email BOTH the rider and (if assigned) the driver on every ride
// lifecycle change so nobody relies on Telegram/SMS alone. Completion is handled by
// sendRideCompletionEmails (full receipt/earnings), so it is skipped here. Synthetic
// placeholder addresses are filtered out by isSendableEmail.
export async function sendRideStatusEmails(rideId: string): Promise<void> {
  try {
    const ride = await storage.getRide(rideId);
    if (!ride) return;
    const status = ride.status;
    if (status === "completed") return; // receipt/earnings emails cover this

    const rider = await storage.getUser(ride.customerId);
    const { driverName, vehicleInfo } = await getDriverDescriptors(ride.driverId);
    const pickupSafe = escapeHtml(ride.pickupAddress);
    const dropoffSafe = escapeHtml(ride.dropoffAddress);
    const routeHtml = `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7f2;border-radius:12px;padding:16px;margin:16px 0;">
<tr><td style="color:#666;font-size:13px;">From</td></tr>
<tr><td style="color:#333;font-size:14px;font-weight:600;padding-bottom:8px;">${pickupSafe}</td></tr>
<tr><td style="color:#666;font-size:13px;">To</td></tr>
<tr><td style="color:#333;font-size:14px;font-weight:600;">${dropoffSafe}</td></tr></table>`;

    // What the rider should be told for each status.
    let riderSubject = "";
    let riderSubtitle = "";
    let riderHeading = "";
    let riderBody = "";
    switch (status) {
      case "accepted": {
        let driverLine = "";
        if (driverName) driverLine += `<p style="margin:0 0 4px;color:#333;font-size:14px;">Driver: <strong>${escapeHtml(driverName)}</strong></p>`;
        if (vehicleInfo) driverLine += `<p style="margin:0 0 4px;color:#333;font-size:14px;">Car: ${escapeHtml(vehicleInfo)}</p>`;
        const otpLine = ride.otp ? `<p style="margin:16px 0 0;color:#333;font-size:14px;">Pickup code: <strong style="font-size:20px;letter-spacing:2px;">${escapeHtml(ride.otp)}</strong></p>` : "";
        riderSubject = "Your driver is confirmed — Travony";
        riderSubtitle = "Driver Confirmed";
        riderHeading = "A driver is on the way";
        riderBody = `${driverLine}${routeHtml}${otpLine}<p style="margin:16px 0 0;color:#999;font-size:12px;">Show your pickup code to the driver when you board.</p>`;
        break;
      }
      case "arriving":
        riderSubject = "Your driver is arriving — Travony";
        riderSubtitle = "Driver Arriving";
        riderHeading = "Your driver is almost there";
        riderBody = `${routeHtml}<p style="margin:16px 0 0;color:#666;font-size:14px;">Please start making your way to the pickup point.</p>`;
        break;
      case "started":
      case "in_progress":
        riderSubject = "Your trip has started — Travony";
        riderSubtitle = "Trip Started";
        riderHeading = "Trip started";
        riderBody = `${routeHtml}<p style="margin:16px 0 0;color:#666;font-size:14px;">Sit back and enjoy the ride. Your receipt will arrive by email when you reach your destination.</p>`;
        break;
      case "cancelled":
        riderSubject = "Your ride was cancelled — Travony";
        riderSubtitle = "Ride Cancelled";
        riderHeading = "Ride cancelled";
        riderBody = `${routeHtml}<p style="margin:16px 0 0;color:#666;font-size:14px;">No in-app charge was processed. If your trip had already started, please settle any cash owed directly with your driver.</p>`;
        break;
      default:
        return; // unknown/intermediate status — nothing to email
    }

    if (rider && isSendableEmail(rider.email) && riderSubject) {
      sendStatusUpdateEmail({
        to: rider.email!,
        subject: riderSubject,
        headerSubtitle: riderSubtitle,
        heading: `${riderHeading}${rider.name ? `, ${escapeHtml(rider.name)}` : ""}`,
        bodyHtml: riderBody,
      });
    }

    // Driver-side confirmations for the events that concern them.
    if (ride.driverId) {
      const driver = await storage.getDriver(ride.driverId);
      const driverUser = driver ? await storage.getUser(driver.userId) : undefined;
      if (driverUser && isSendableEmail(driverUser.email)) {
        let dSubject = "";
        let dSubtitle = "";
        let dHeading = "";
        let dBody = "";
        switch (status) {
          case "accepted":
            dSubject = "Ride accepted — Travony";
            dSubtitle = "Ride Accepted";
            dHeading = "You accepted a ride";
            dBody = `${routeHtml}<p style="margin:16px 0 0;color:#666;font-size:14px;">Head to the pickup point. The rider has been notified you're on the way.</p>`;
            break;
          case "arriving":
            dSubject = "Marked as arriving — Travony";
            dSubtitle = "Arriving";
            dHeading = "You're marked as arriving";
            dBody = `${routeHtml}<p style="margin:16px 0 0;color:#666;font-size:14px;">The rider has been told you're almost at the pickup point.</p>`;
            break;
          case "started":
          case "in_progress":
            dSubject = "Trip started — Travony";
            dSubtitle = "Trip Started";
            dHeading = "Trip started";
            dBody = `${routeHtml}<p style="margin:16px 0 0;color:#666;font-size:14px;">Drive safely. Your earnings summary will be emailed when the trip completes.</p>`;
            break;
          case "cancelled":
            dSubject = "Ride cancelled — Travony";
            dSubtitle = "Ride Cancelled";
            dHeading = "This ride was cancelled";
            dBody = `${routeHtml}<p style="margin:16px 0 0;color:#666;font-size:14px;">You're free to go back online and accept new rides.</p>`;
            break;
        }
        if (dSubject) {
          sendStatusUpdateEmail({
            to: driverUser.email!,
            subject: dSubject,
            headerSubtitle: dSubtitle,
            heading: `${dHeading}${driverUser.name ? `, ${escapeHtml(driverUser.name)}` : ""}`,
            bodyHtml: dBody,
          });
        }
      }
    }
  } catch (error) {
    console.error("[RideNotifications] sendRideStatusEmails error:", error);
  }
}

// Fire-and-forget: instantly ping the matched driver on Telegram about a new ride,
// instead of waiting for the T Driver app's 5s poll to surface it.
export async function notifyDriverOfNewRide(rideId: string): Promise<void> {
  try {
    const ride = await storage.getRide(rideId);
    if (!ride || !ride.driverId || ride.driverId === "pending") return;

    const fare = parseFloat(ride.estimatedFare || ride.actualFare || "0");
    const dist = ride.distance ? `${parseFloat(ride.distance).toFixed(1)} km` : null;
    const currency = ride.currency || "AED";
    const drvPct = 100 - (await regionFeePercent(ride));

    const lines = [
      "<b>New ride request</b>",
      `<b>From</b>  ${ride.pickupAddress}`,
      `<b>To</b>  ${ride.dropoffAddress}`,
      `Fare: ${currency} ${fare.toFixed(2)} (you keep ${drvPct}%)`,
      ...(dist ? [`Distance: ~${dist}`] : []),
      "",
      "Open your T Driver app to accept.",
    ];
    await sendDriverNotification(ride.driverId, lines.join("\n"));
  } catch (error) {
    console.error("[RideNotifications] notifyDriverOfNewRide error:", error);
  }
  // Email + SMS + WhatsApp the matched driver too (in addition to Telegram + app poll).
  await messageDriverOfNewRide(rideId);
}

// Fire-and-forget: notify the matched driver about a new ride request across
// email, SMS, and WhatsApp. Each channel is independent and best-effort: a
// synthetic email or missing phone simply skips that channel. Safe to call from
// any ride-creation path.
export async function messageDriverOfNewRide(rideId: string): Promise<void> {
  try {
    const ride = await storage.getRide(rideId);
    if (!ride || !ride.driverId || ride.driverId === "pending") return;

    const driver = await storage.getDriver(ride.driverId);
    const driverUser = driver ? await storage.getUser(driver.userId) : undefined;
    if (!driverUser) return;

    const fare = parseFloat(ride.estimatedFare || ride.actualFare || "0");
    const feePct = await regionFeePercent(ride);
    const fees = calculateFeeBreakdown(fare, feePct);
    const currency = ride.currency || "AED";
    const driverName = driverUser.name || "Driver";

    // Email (skips synthetic/placeholder addresses).
    if (isSendableEmail(driverUser.email)) {
      await sendDriverRideRequestEmail({
        driverName,
        driverEmail: driverUser.email!,
        rideId: ride.id,
        pickupAddress: ride.pickupAddress,
        dropoffAddress: ride.dropoffAddress,
        fare: fare.toFixed(2),
        earnings: fees.driverShare.toFixed(2),
        currency,
        distance: ride.distance ? `${parseFloat(ride.distance).toFixed(1)} km` : undefined,
        paymentMethod: ride.paymentMethod || undefined,
        feePercent: feePct,
      }).catch((e) => console.error("[RideNotifications] driver request email error:", e));
    }

    // SMS + WhatsApp (skips missing/synthetic phone numbers).
    if (isSendablePhone(driverUser.phone)) {
      const smsBody =
        `Travony: New ride request\n` +
        `From: ${ride.pickupAddress}\n` +
        `To: ${ride.dropoffAddress}\n` +
        `Fare ${currency} ${fare.toFixed(2)} · you earn ${currency} ${fees.driverShare.toFixed(2)}\n` +
        `Open your T Driver app to accept.`;

      await sendSmsMessage(driverUser.phone!, smsBody).catch((e) =>
        console.error("[RideNotifications] driver request SMS error:", e),
      );
      await sendWhatsAppMessage(driverUser.phone!, smsBody).catch((e) =>
        console.error("[RideNotifications] driver request WhatsApp error:", e),
      );
    }
  } catch (error) {
    console.error("[RideNotifications] messageDriverOfNewRide error:", error);
  }
}

/**
 * Broadcast a new pending ride to EVERY approved + online driver. The
 * pending-rides model is a broadcast — any approved, online driver can claim the
 * ride from their T Driver app — so a new request must ping them all, not only a
 * single proximity-matched driver. Channels: Telegram, SMS, WhatsApp, email
 * (each best-effort). The rider is never notified about their own ride (a driver
 * can also book as a rider).
 */
export async function notifyOnlineDriversOfNewRide(rideId: string): Promise<void> {
  try {
    const ride = await storage.getRide(rideId);
    if (!ride) return;

    const onlineDrivers = await db
      .select()
      .from(drivers)
      .where(and(eq(drivers.isOnline, true), eq(drivers.status, "approved")));
    if (onlineDrivers.length === 0) return;

    const fare = parseFloat(ride.estimatedFare || ride.actualFare || "0");
    const feePct = await regionFeePercent(ride);
    const fees = calculateFeeBreakdown(fare, feePct);
    const currency = ride.currency || "AED";

    const smsBody =
      `Travony: New ride request\n` +
      `From: ${ride.pickupAddress}\n` +
      `To: ${ride.dropoffAddress}\n` +
      `Fare ${currency} ${fare.toFixed(2)} · you earn ${currency} ${fees.driverShare.toFixed(2)}\n` +
      `Open your T Driver app to accept.`;
    const tgBody =
      `<b>New ride request</b>\n\n` +
      `Pickup: ${ride.pickupAddress}\n` +
      `Drop-off: ${ride.dropoffAddress}\n` +
      `Fare: ${currency} ${fare.toFixed(2)}  ·  your share ${currency} ${fees.driverShare.toFixed(2)}\n\n` +
      `Open your T Driver app to accept.`;

    // Prayer-Pause: drivers within 30 min of a prayer they opted into are not
    // pinged about long trips (mosque-bound rides still go through).
    const rideKm = rideDistanceKm(ride);
    let rideIsLongNonMosque = false;
    if (rideKm > LONG_TRIP_KM) {
      const mosqueZones = await getMosqueHubZones().catch(() => []);
      rideIsLongNonMosque = !isMosqueDestination(ride.dropoffLat, ride.dropoffLng, mosqueZones);
    }

    for (const driver of onlineDrivers) {
      if (rideIsLongNonMosque && driver.prayerPauseEnabled) {
        const pause = await getDriverPrayerPauseState(driver).catch(() => ({ active: false }));
        if (pause.active) continue;
      }
      const driverUser = await storage.getUser(driver.userId);
      if (!driverUser) continue;
      // Don't notify the rider about their own ride request.
      if (driverUser.id === ride.customerId) continue;

      if (driverUser.telegramChatId) {
        let tgText = tgBody;
        try {
          const { buildRideAcceptUrl } = await import("./onboardingAgent");
          tgText =
            tgBody.replace(/\n\nOpen your T Driver app to accept\.$/, "") +
            `\n\nAccept now (no app needed): ${buildRideAcceptUrl(ride.id, driver.id)}\n` +
            `Or open your T Driver app.`;
        } catch (e) {
          console.error("[RideNotifications] accept link build error:", e);
        }
        await sendTelegramMessage(driverUser.telegramChatId, tgText).catch((e) =>
          console.error("[RideNotifications] broadcast Telegram error:", e),
        );
      }
      if (isSendablePhone(driverUser.phone)) {
        await sendSmsMessage(driverUser.phone!, smsBody).catch((e) =>
          console.error("[RideNotifications] broadcast SMS error:", e),
        );
        // WhatsApp gets a per-driver secure Accept link so a chat-onboarded
        // driver can take the job with no app installed. The link only proves
        // identity — the accept itself goes through the normal PATCH route
        // (atomic claim + approved/vehicle/offer gates).
        let waBody = smsBody;
        try {
          const { buildRideAcceptUrl } = await import("./onboardingAgent");
          waBody =
            smsBody.replace(/\nOpen your T Driver app to accept\.$/, "") +
            `\nAccept now (no app needed): ${buildRideAcceptUrl(ride.id, driver.id)}\n` +
            `Or open your T Driver app.`;
        } catch (e) {
          console.error("[RideNotifications] accept link build error:", e);
        }
        await sendWhatsAppMessage(driverUser.phone!, waBody).catch((e) =>
          console.error("[RideNotifications] broadcast WhatsApp error:", e),
        );
      }
      if (isSendableEmail(driverUser.email)) {
        await sendDriverRideRequestEmail({
          driverName: driverUser.name || "Driver",
          driverEmail: driverUser.email!,
          rideId: ride.id,
          pickupAddress: ride.pickupAddress,
          dropoffAddress: ride.dropoffAddress,
          fare: fare.toFixed(2),
          earnings: fees.driverShare.toFixed(2),
          currency,
          distance: ride.distance ? `${parseFloat(ride.distance).toFixed(1)} km` : undefined,
          paymentMethod: ride.paymentMethod || undefined,
          feePercent: feePct,
        }).catch((e) => console.error("[RideNotifications] broadcast email error:", e));
      }
    }
  } catch (error) {
    console.error("[RideNotifications] notifyOnlineDriversOfNewRide error:", error);
  }
}
