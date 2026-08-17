import { db } from "./db";
import { users, drivers, rides } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";
import { getDemandTipsText } from "./channelFeatures";

// Read env vars dynamically so secret hot-reload works, and trim stray whitespace
function getAccountSid() { return (process.env.TWILIO_ACCOUNT_SID || "").trim(); }
function getAuthToken() { return (process.env.TWILIO_AUTH_TOKEN || "").trim(); }
function getWhatsappNumber() {
  return (process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER || "").trim().replace(/\s+/g, "");
}

interface WhatsAppMessage {
  to: string;
  body: string;
}

export async function sendWhatsAppMessage(to: string, body: string): Promise<boolean> {
  const TWILIO_ACCOUNT_SID = getAccountSid();
  const TWILIO_AUTH_TOKEN = getAuthToken();
  const TWILIO_WHATSAPP_NUMBER = getWhatsappNumber();

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_NUMBER) {
    console.log("[WhatsApp] Twilio not configured. Message:", body);
    return false;
  }

  const fromNumber = TWILIO_WHATSAPP_NUMBER.startsWith("whatsapp:") 
    ? TWILIO_WHATSAPP_NUMBER 
    : `whatsapp:${TWILIO_WHATSAPP_NUMBER}`;
  
  const cleanTo = to.trim().replace(/\s+/g, "");
  const toNumber = cleanTo.startsWith("whatsapp:") ? cleanTo : `whatsapp:${cleanTo}`;

  try {
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: fromNumber,
          To: toNumber,
          Body: body,
        }),
      }
    );
    const result = await response.json();
    if (result.sid) {
      console.log(`[WhatsApp] Message sent: ${result.sid}`);
      return true;
    }
    console.error("[WhatsApp] Error:", result);
    return false;
  } catch (error) {
    console.error("[WhatsApp] Error sending message:", error);
    return false;
  }
}

/**
 * Verify Twilio's X-Twilio-Signature on an incoming webhook so forged POSTs
 * can't spoof a phone number and drive the booking state machine. Twilio signs
 * HMAC-SHA1(webhookUrl + sortedParamsConcat, authToken), base64. We try the
 * proxy-forwarded https/http URL variants since the app sits behind a proxy.
 * When Twilio isn't configured at all (local dev without secrets), requests
 * are allowed so the console-fallback flow still works.
 */
export function validateTwilioSignature(req: any): boolean {
  const authToken = getAuthToken();
  if (!authToken) return true;
  const signature = req.headers?.["x-twilio-signature"];
  if (!signature || typeof signature !== "string") return false;

  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const params = req.body && typeof req.body === "object" ? req.body : {};
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + String(params[key]), "");

  const urls = new Set<string>([
    `${proto}://${host}${req.originalUrl}`,
    `https://${host}${req.originalUrl}`,
    `http://${host}${req.originalUrl}`,
  ]);
  const sigBuf = Buffer.from(signature);
  for (const url of urls) {
    const expected = Buffer.from(
      crypto.createHmac("sha1", authToken).update(url + data).digest("base64"),
    );
    if (expected.length === sigBuf.length && crypto.timingSafeEqual(expected, sigBuf)) {
      return true;
    }
  }
  return false;
}

/** Send a WhatsApp message with an attached media file (e.g. a TTS voice note). */
export async function sendWhatsAppMedia(to: string, body: string, mediaUrl: string): Promise<boolean> {
  const TWILIO_ACCOUNT_SID = getAccountSid();
  const TWILIO_AUTH_TOKEN = getAuthToken();
  const TWILIO_WHATSAPP_NUMBER = getWhatsappNumber();

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_NUMBER) {
    console.log("[WhatsApp] Twilio not configured. Media message:", body);
    return false;
  }

  const fromNumber = TWILIO_WHATSAPP_NUMBER.startsWith("whatsapp:")
    ? TWILIO_WHATSAPP_NUMBER
    : `whatsapp:${TWILIO_WHATSAPP_NUMBER}`;
  const cleanTo = to.trim().replace(/\s+/g, "");
  const toNumber = cleanTo.startsWith("whatsapp:") ? cleanTo : `whatsapp:${cleanTo}`;

  try {
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: fromNumber,
          To: toNumber,
          Body: body,
          MediaUrl: mediaUrl,
        }),
      }
    );
    const result = await response.json();
    if (result.sid) {
      console.log(`[WhatsApp] Media message sent: ${result.sid}`);
      return true;
    }
    console.error("[WhatsApp] Media error:", result);
    return false;
  } catch (error) {
    console.error("[WhatsApp] Error sending media message:", error);
    return false;
  }
}

async function getDriverByPhone(phone: string): Promise<any> {
  const normalizedPhone = phone.replace("whatsapp:", "").replace(/\s/g, "");
  const [driver] = await db.select()
    .from(drivers)
    .innerJoin(users, eq(drivers.userId, users.id))
    .where(eq(users.phone, normalizedPhone))
    .limit(1);
  return driver;
}

async function handleWhatsAppCommand(from: string, body: string): Promise<string> {
  const text = body.trim().toLowerCase();
  const phone = from.replace("whatsapp:", "");
  const driver = await getDriverByPhone(phone);

  if (text === "hola" || text === "hi" || text === "hello" || text === "start") {
    return `Bienvenido a Travony! / Welcome to Travony!

Comandos / Commands:
- "status" - Ver tu estado / Check your status
- "earnings" - Ver ganancias / View earnings
- "rides" - Viajes recientes / Recent rides
- "online" - Conectarse / Go online
- "offline" - Desconectarse / Go offline
- "demand" - Dónde hay demanda / Where the demand is
- "help" - Ayuda / Help

Responde con un comando / Reply with a command`;
  }

  if (text === "status" || text === "estado") {
    if (!driver) {
      return "Cuenta no encontrada. Regístrate en la app con este número de teléfono.\n\nAccount not found. Register in the app with this phone number.";
    }
    const d = driver.drivers;
    return `*Estado del Conductor / Driver Status*

Estado: ${d.status === "approved" ? "Aprobado" : d.status}
En línea: ${d.isOnline ? "Sí" : "No"}
Calificación: ${d.rating || "5.00"}
Viajes totales: ${d.totalTrips || 0}`;
  }

  if (text === "earnings" || text === "ganancias") {
    if (!driver) {
      return "Cuenta no encontrada / Account not found";
    }
    return `*Tus Ganancias / Your Earnings*

Total: $${driver.drivers.totalEarnings || "0.00"}
Saldo: $${driver.drivers.walletBalance || "0.00"}

Comisión de plataforma: 10%
Platform fee: 10%`;
  }

  if (text === "rides" || text === "viajes") {
    if (!driver) {
      return "Cuenta no encontrada / Account not found";
    }
    const recentRides = await db.select()
      .from(rides)
      .where(eq(rides.driverId, driver.drivers.id))
      .orderBy(desc(rides.createdAt))
      .limit(5);

    if (recentRides.length === 0) {
      return "Sin viajes recientes. ¡Conéctate para recibir solicitudes!\n\nNo recent rides. Go online to receive requests!";
    }

    let msg = "*Viajes Recientes / Recent Rides*\n\n";
    for (const ride of recentRides) {
      msg += `${ride.status.toUpperCase()} - $${ride.actualFare || "0.00"}\n`;
    }
    return msg;
  }

  if (text === "online" || text === "conectar") {
    if (!driver) {
      return "Cuenta no encontrada / Account not found";
    }
    await db.update(drivers).set({ isOnline: true }).where(eq(drivers.id, driver.drivers.id));
    return "¡Estás EN LÍNEA! Recibirás solicitudes de viaje.\n\nYou are ONLINE! You will receive ride requests.";
  }

  if (text === "offline" || text === "desconectar") {
    if (!driver) {
      return "Cuenta no encontrada / Account not found";
    }
    await db.update(drivers).set({ isOnline: false }).where(eq(drivers.id, driver.drivers.id));
    return "Estás DESCONECTADO.\n\nYou are OFFLINE.";
  }

  if (text === "demand" || text === "demanda") {
    if (!driver) {
      return "Cuenta no encontrada / Account not found";
    }
    const d = driver.drivers;
    const lat = d.currentLat != null ? parseFloat(d.currentLat) : NaN;
    const lng = d.currentLng != null ? parseFloat(d.currentLng) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return "Abre la app una vez para que sepamos dónde estás, luego escribe DEMANDA.\n\nOpen the app once so we know where you are, then reply DEMAND.";
    }
    const tips = await getDemandTipsText(lat, lng);
    if (!tips) {
      return "Aún no hay suficiente historial de viajes cerca de ti.\n\nNot enough ride history near you yet — check back soon.";
    }
    return tips;
  }

  if (text === "help" || text === "ayuda") {
    return `*Ayuda de Travony / Travony Help*

Para problemas urgentes:
- Emergencia: Usa el botón en la app
- Disputas de tarifa: Reporta después del viaje

Preguntas comunes:
- Pagos: Procesados diariamente
- Calificaciones: Protegidas en primeros 20 viajes
- Comisión: 10% por viaje

For urgent issues:
- Emergency: Use button in app
- Fare disputes: Report after ride

Common questions:
- Payments: Processed daily
- Ratings: Protected for first 20 rides
- Commission: 10% per ride

Escribe "demanda"/"demand" para ver dónde hay más viajes cerca de ti.
Type "demand" to see where the rides are near you.`;
  }

  return `No entendí tu mensaje. Escribe "hola" para ver los comandos.\n\nI didn't understand. Type "hello" to see commands.`;
}

// Exact driver command vocabulary (kept small on purpose): when the sender is
// a registered driver AND the text is one of these, the legacy driver handler
// answers. Everything else — location pins, voice notes, free text — goes to
// the rider booking flow.
const DRIVER_COMMANDS = new Set([
  "hola", "hi", "hello", "start",
  "status", "estado", "earnings", "ganancias", "rides", "viajes",
  "online", "conectar", "offline", "desconectar", "demand", "demanda", "help", "ayuda",
]);

export async function processWhatsAppWebhook(body: any): Promise<string | null> {
  const from = body.From;
  const messageBody = typeof body.Body === "string" ? body.Body : "";
  if (!from) return null;

  const latitude = body.Latitude !== undefined ? parseFloat(body.Latitude) : undefined;
  const longitude = body.Longitude !== undefined ? parseFloat(body.Longitude) : undefined;
  const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude);
  const mediaUrl = body.MediaUrl0 as string | undefined;
  const mediaContentType = body.MediaContentType0 as string | undefined;

  // Driver keeps their existing command UX for the exact command words.
  const text = messageBody.trim().toLowerCase();
  if (text && DRIVER_COMMANDS.has(text) && !hasLocation && !mediaUrl) {
    const phone = from.replace("whatsapp:", "");
    const driver = await getDriverByPhone(phone);
    if (driver) {
      return handleWhatsAppCommand(from, messageBody);
    }
  }

  // Driver chat onboarding: an active interview consumes the message (photos
  // included); "I want to drive" starts one. Runs before the rider flow so a
  // mid-interview photo or answer is never misread as a booking — but never
  // while the rider is mid-booking, where free text is a booking answer, not
  // drive intent. (An active interview and an active booking step can't
  // coexist: the interview consumes every message first.)
  try {
    const { hasActiveWaBookingStep } = await import("./whatsappRiderBot");
    const midBooking = await hasActiveWaBookingStep(from.replace("whatsapp:", ""));
    if (!midBooking) {
      const { tryHandleWhatsAppOnboarding } = await import("./onboardingAgent");
      const onboarded = await tryHandleWhatsAppOnboarding({
        from,
        body: messageBody,
        mediaUrl,
        mediaContentType,
        profileName: typeof body.ProfileName === "string" ? body.ProfileName : undefined,
      });
      if (onboarded) return null;
    }
  } catch (error) {
    console.error("[WhatsApp] onboarding handler error:", error);
  }

  // Rider booking flow (sends its own messages via the REST API).
  try {
    const { tryHandleWhatsAppRider } = await import("./whatsappRiderBot");
    const handled = await tryHandleWhatsAppRider({
      from,
      body: messageBody,
      latitude: hasLocation ? (latitude as number) : undefined,
      longitude: hasLocation ? (longitude as number) : undefined,
      mediaUrl,
      mediaContentType,
      profileName: typeof body.ProfileName === "string" ? body.ProfileName : undefined,
    });
    if (handled) return null;
  } catch (error) {
    console.error("[WhatsApp] rider handler error:", error);
  }

  if (!messageBody) return null;
  const response = await handleWhatsAppCommand(from, messageBody);
  return response;
}

export async function sendDriverWhatsAppNotification(driverId: string, message: string): Promise<boolean> {
  const [driver] = await db.select()
    .from(drivers)
    .innerJoin(users, eq(drivers.userId, users.id))
    .where(eq(drivers.id, driverId))
    .limit(1);

  if (!driver || !driver.users.phone) {
    console.log(`[WhatsApp] No phone for driver ${driverId}`);
    return false;
  }

  return sendWhatsAppMessage(driver.users.phone, message);
}

export async function notifyDriverOfRideRequest(driverId: string, rideDetails: {
  pickupAddress: string;
  dropoffAddress: string;
  estimatedFare?: string;
}): Promise<boolean> {
  const message = `🚗 *Nueva Solicitud de Viaje / New Ride Request*

Recoger: ${rideDetails.pickupAddress}
Destino: ${rideDetails.dropoffAddress}
${rideDetails.estimatedFare ? `Tarifa estimada: $${rideDetails.estimatedFare}` : ""}

Abre la app para aceptar.
Open the app to accept.`;

  return sendDriverWhatsAppNotification(driverId, message);
}

export async function notifyDriverOfRideAccepted(driverId: string, rideId: string): Promise<boolean> {
  const message = `✅ *Viaje Aceptado / Ride Accepted*

Tu viaje ha sido confirmado.
Your ride has been confirmed.

ID: ${rideId.substring(0, 8)}`;

  return sendDriverWhatsAppNotification(driverId, message);
}

export async function notifyDriverOfEarnings(driverId: string, amount: string): Promise<boolean> {
  const message = `*Ganancias del Dia / Today's Earnings*

Has ganado: $${amount}
You earned: $${amount}

Buen trabajo! / Great work!`;

  return sendDriverWhatsAppNotification(driverId, message);
}

export async function sendDriverWelcomeSequenceWhatsApp(driverId: string, driverName: string): Promise<boolean> {
  const [driver] = await db.select()
    .from(drivers)
    .innerJoin(users, eq(drivers.userId, users.id))
    .where(eq(drivers.id, driverId))
    .limit(1);

  if (!driver || !driver.users.phone) {
    console.log(`[WhatsApp] No phone for driver ${driverId}`);
    return false;
  }

  const phone = driver.users.phone;

  const welcomeMessage = `*Bienvenido a Travony*

Eres conductor fundador de CDMX. Gracias por ser parte del inicio.

Escribe cualquiera de estos comandos:
- "estado" - Ver tu estado
- "ganancias" - Ver tus ganancias
- "viajes" - Ver viajes recientes
- "demanda" - Ver dónde hay más viajes
- "ayuda" - Obtener ayuda

Siguiente: Abre la app para completar tu registro.`;

  await sendWhatsAppMessage(phone, welcomeMessage);

  setTimeout(async () => {
    const reminderMessage = `*Recordatorio de Registro*

Pasos para empezar:
1. Abre la app Travony
2. Inicia sesion con este numero
3. Sube tu licencia y foto del vehiculo
4. Espera aprobacion (menos de 24 hrs)

Dudas? Responde a este mensaje.`;
    await sendWhatsAppMessage(phone, reminderMessage);
  }, 86400000);

  return true;
}

export function getApprovalSmsMessage(phone: string): string {
  const clean = phone.trim().replace(/\s+/g, "");
  if (clean.startsWith("+971") || clean.startsWith("971")) {
    return "Travony: تمت الموافقة على حسابك. افتح تطبيق T Driver وابدأ العمل الآن.";
  }
  if (clean.startsWith("+62") || clean.startsWith("62")) {
    return "Travony: Akun driver Anda disetujui! Buka T Driver dan mulai terima penumpang sekarang.";
  }
  if (clean.startsWith("+52") || clean.startsWith("52")) {
    return "Travony: Tu cuenta de conductor fue aprobada. Abre T Driver y empieza a recibir viajes.";
  }
  return "Travony: Your driver account is approved! Open the T Driver app and start accepting rides now.";
}

function getApprovalMessage(phone: string): string {
  const clean = phone.trim().replace(/\s+/g, "");
  if (clean.startsWith("+971") || clean.startsWith("971")) {
    return `*تمت الموافقة على حسابك في Travony*\n\nيمكنك الآن الاتصال وقبول الرحلات.\n\n- العمولة: 10% فقط\n- الأرباح: إيداع يومي\n- الدعم: 24/7\n\nافتح تطبيق T Driver وابدأ.`;
  }
  if (clean.startsWith("+62") || clean.startsWith("62")) {
    return `*Akun Travony Anda DISETUJUI*\n\nAnda sekarang bisa online dan menerima penumpang.\n\n- Komisi: Hanya 10%\n- Penghasilan: Transfer harian\n- Dukungan: 24/7\n\nBuka aplikasi T Driver dan mulai.`;
  }
  if (clean.startsWith("+52") || clean.startsWith("52")) {
    return `*Tu cuenta fue APROBADA en Travony*\n\nYa puedes conectarte y recibir viajes.\n\n- Comision: Solo 10%\n- Ganancias: Deposito diario\n- Soporte: 24/7\n\nAbre la app T Driver y empieza.`;
  }
  return `*Your Travony driver account is APPROVED*\n\nYou can now go online and start accepting rides.\n\n- Commission: Only 10%\n- Earnings: Daily transfer\n- Support: 24/7\n\nOpen the T Driver app and get started.`;
}

export async function sendDriverApprovalWhatsApp(driverId: string): Promise<boolean> {
  const [driver] = await db.select()
    .from(drivers)
    .innerJoin(users, eq(drivers.userId, users.id))
    .where(eq(drivers.id, driverId))
    .limit(1);

  if (!driver || !driver.users.phone) {
    return false;
  }

  const message = getApprovalMessage(driver.users.phone);
  return sendWhatsAppMessage(driver.users.phone, message);
}
