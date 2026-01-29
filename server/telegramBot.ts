import { db } from "./db";
import { users, drivers, rides } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    date: number;
  };
}

interface TelegramMessage {
  chat_id: number | string;
  text: string;
  parse_mode?: "HTML" | "Markdown";
  reply_markup?: any;
}

export async function sendTelegramMessage(chatId: number | string, text: string, options?: Partial<TelegramMessage>): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log("[Telegram] Bot token not configured. Message:", text);
    return false;
  }

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        ...options,
      }),
    });
    const result = await response.json();
    return result.ok;
  } catch (error) {
    console.error("[Telegram] Error sending message:", error);
    return false;
  }
}

async function getDriverByChatId(chatId: number): Promise<any> {
  const [driver] = await db.select()
    .from(drivers)
    .innerJoin(users, eq(drivers.userId, users.id))
    .where(eq(users.telegramChatId, chatId.toString()))
    .limit(1);
  return driver;
}

async function linkTelegramAccount(chatId: number, phone: string): Promise<{ success: boolean; message: string }> {
  const [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  if (!user) {
    return { success: false, message: "No account found with this phone number. Please register in the app first." };
  }

  await db.update(users).set({ telegramChatId: chatId.toString() }).where(eq(users.id, user.id));
  return { success: true, message: `Account linked successfully! Welcome, ${user.name}` };
}

async function handleCommand(chatId: number, command: string, args: string[]): Promise<string> {
  const driver = await getDriverByChatId(chatId);

  switch (command) {
    case "/start":
      return `Welcome to Travony Driver Support Bot!

Commands:
/link [phone] - Link your account
/status - Check your driver status
/earnings - View your earnings
/rides - View recent rides
/support - Get help
/feedback [message] - Send feedback

Need help? Type /support`;

    case "/link":
      if (args.length === 0) {
        return "Please provide your phone number. Example: /link +525512345678";
      }
      const linkResult = await linkTelegramAccount(chatId, args[0]);
      return linkResult.message;

    case "/status":
      if (!driver) {
        return "Account not linked. Use /link [phone] to connect your account.";
      }
      const driverData = driver.drivers;
      return `<b>Driver Status</b>
Status: ${driverData.status}
Online: ${driverData.isOnline ? "Yes" : "No"}
Rating: ${driverData.rating || "5.00"}
Total Trips: ${driverData.totalTrips || 0}`;

    case "/earnings":
      if (!driver) {
        return "Account not linked. Use /link [phone] to connect your account.";
      }
      return `<b>Your Earnings</b>
Total Earnings: $${driver.drivers.totalEarnings || "0.00"}
Wallet Balance: $${driver.drivers.walletBalance || "0.00"}

10% platform fee applied to each ride.`;

    case "/rides":
      if (!driver) {
        return "Account not linked. Use /link [phone] to connect your account.";
      }
      const recentRides = await db.select()
        .from(rides)
        .where(eq(rides.driverId, driver.drivers.id))
        .orderBy(desc(rides.createdAt))
        .limit(5);
      
      if (recentRides.length === 0) {
        return "No rides found. Go online in the app to receive ride requests!";
      }

      let ridesText = "<b>Recent Rides</b>\n\n";
      for (const ride of recentRides) {
        ridesText += `${ride.status.toUpperCase()} - $${ride.actualFare || "0.00"}\n`;
        ridesText += `${ride.pickupAddress} → ${ride.dropoffAddress}\n\n`;
      }
      return ridesText;

    case "/support":
      return `<b>Travony Driver Support</b>

For urgent issues:
- Emergency: Use the emergency button in the app
- Fare disputes: Report in app after ride completion

Common questions:
- Payments: Processed daily at midnight
- Ratings: Protected for first 20 rides
- Commission: 10% platform fee on all rides

Need more help? Send feedback with /feedback [your message]`;

    case "/feedback":
      if (args.length === 0) {
        return "Please include your feedback. Example: /feedback The app is working great!";
      }
      console.log(`[Telegram Feedback] From ${chatId}: ${args.join(" ")}`);
      return "Thank you for your feedback! Our team will review it.";

    case "/online":
      if (!driver) {
        return "Account not linked. Use /link [phone] to connect your account.";
      }
      await db.update(drivers).set({ isOnline: true }).where(eq(drivers.id, driver.drivers.id));
      return "You are now ONLINE and can receive ride requests!";

    case "/offline":
      if (!driver) {
        return "Account not linked. Use /link [phone] to connect your account.";
      }
      await db.update(drivers).set({ isOnline: false }).where(eq(drivers.id, driver.drivers.id));
      return "You are now OFFLINE. Go online to receive ride requests.";

    default:
      return "Unknown command. Type /start to see available commands.";
  }
}

export async function processTelegramUpdate(update: TelegramUpdate): Promise<void> {
  if (!update.message?.text) return;

  const chatId = update.message.chat.id;
  const text = update.message.text.trim();

  if (text.startsWith("/")) {
    const parts = text.split(" ");
    const command = parts[0].toLowerCase().split("@")[0];
    const args = parts.slice(1);
    const response = await handleCommand(chatId, command, args);
    await sendTelegramMessage(chatId, response);
  } else {
    await sendTelegramMessage(chatId, "I didn't understand that. Type /start to see available commands.");
  }
}

export async function sendDriverNotification(driverId: string, message: string): Promise<boolean> {
  const [driver] = await db.select()
    .from(drivers)
    .innerJoin(users, eq(drivers.userId, users.id))
    .where(eq(drivers.id, driverId))
    .limit(1);

  if (!driver || !driver.users.telegramChatId) {
    console.log(`[Telegram] No Telegram chat ID for driver ${driverId}`);
    return false;
  }

  return sendTelegramMessage(driver.users.telegramChatId, message);
}

export async function broadcastToDrivers(citySlug: string, message: string): Promise<number> {
  const allDrivers = await db.select()
    .from(drivers)
    .innerJoin(users, eq(drivers.userId, users.id))
    .where(eq(drivers.status, "approved"));

  let sent = 0;
  for (const driver of allDrivers) {
    if (driver.users.telegramChatId) {
      const success = await sendTelegramMessage(driver.users.telegramChatId, message);
      if (success) sent++;
    }
  }
  return sent;
}

export async function sendDriverWelcomeSequence(driverId: string, driverName: string): Promise<boolean> {
  const [driver] = await db.select()
    .from(drivers)
    .innerJoin(users, eq(drivers.userId, users.id))
    .where(eq(drivers.id, driverId))
    .limit(1);

  if (!driver || !driver.users.telegramChatId) {
    console.log(`[Telegram] No chat ID for driver ${driverId}`);
    return false;
  }

  const chatId = driver.users.telegramChatId;

  const welcomeMessage = `<b>Bienvenido a Travony, Conductor Fundador de CDMX</b>

Eres uno de los primeros 10 conductores en probar nuestra plataforma. Tu feedback es muy importante para nosotros.

<b>Comandos disponibles:</b>
/status - Ver tu estado
/earnings - Ver ganancias
/rides - Viajes recientes
/online - Conectarse
/offline - Desconectarse
/feedback [mensaje] - Enviar comentarios

Siguiente paso: Abre la app para completar tu perfil.`;

  await sendTelegramMessage(chatId, welcomeMessage);

  setTimeout(async () => {
    const guideMessage = `<b>Guía de inicio rápido</b>

1. Abre la app e inicia sesión con tu número de teléfono
2. Completa tu perfil (foto, licencia, vehículo)
3. Espera la verificación (máximo 24 horas)
4. Una vez aprobado, toca "Conectarse" para recibir viajes

¿Problemas? Escribe /feedback seguido de tu problema.`;
    await sendTelegramMessage(chatId, guideMessage);
  }, 3600000);

  return true;
}

export async function sendDriverApprovalNotification(driverId: string): Promise<boolean> {
  const [driver] = await db.select()
    .from(drivers)
    .innerJoin(users, eq(drivers.userId, users.id))
    .where(eq(drivers.id, driverId))
    .limit(1);

  if (!driver || !driver.users.telegramChatId) {
    return false;
  }

  const message = `<b>Tu cuenta está aprobada</b>

Estás listo para recibir viajes.

<b>Consejos para tu primer viaje:</b>
- Mantén la app abierta y en primer plano
- Acepta el viaje en los primeros 30 segundos
- Usa la navegación integrada
- Al terminar, confirma el pago antes de cerrar

<b>Comisión: Solo 10%</b> - El 90% de cada viaje es tuyo.

¡Buena suerte!`;

  return sendTelegramMessage(driver.users.telegramChatId, message);
}

export async function setWebhook(webhookUrl: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log("[Telegram] Bot token not configured");
    return false;
  }

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const result = await response.json();
    console.log("[Telegram] Webhook set:", result);
    return result.ok;
  } catch (error) {
    console.error("[Telegram] Error setting webhook:", error);
    return false;
  }
}
