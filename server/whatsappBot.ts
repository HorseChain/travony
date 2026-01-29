import { db } from "./db";
import { users, drivers, rides } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER;

interface WhatsAppMessage {
  to: string;
  body: string;
}

export async function sendWhatsAppMessage(to: string, body: string): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_NUMBER) {
    console.log("[WhatsApp] Twilio not configured. Message:", body);
    return false;
  }

  const fromNumber = TWILIO_WHATSAPP_NUMBER.startsWith("whatsapp:") 
    ? TWILIO_WHATSAPP_NUMBER 
    : `whatsapp:${TWILIO_WHATSAPP_NUMBER}`;
  
  const toNumber = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

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
- Commission: 10% per ride`;
  }

  return `No entendí tu mensaje. Escribe "hola" para ver los comandos.\n\nI didn't understand. Type "hello" to see commands.`;
}

export async function processWhatsAppWebhook(body: any): Promise<string | null> {
  const from = body.From;
  const messageBody = body.Body;

  if (!from || !messageBody) {
    return null;
  }

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

export async function sendDriverApprovalWhatsApp(driverId: string): Promise<boolean> {
  const [driver] = await db.select()
    .from(drivers)
    .innerJoin(users, eq(drivers.userId, users.id))
    .where(eq(drivers.id, driverId))
    .limit(1);

  if (!driver || !driver.users.phone) {
    return false;
  }

  const message = `*Tu cuenta fue APROBADA*

Ya puedes conectarte y recibir viajes.

Recuerda:
- Comision: Solo 10%
- Ganancias: Deposito diario
- Soporte: Este chat 24/7

Escribe "conectar" para activarte.`;

  return sendWhatsAppMessage(driver.users.phone, message);
}
