import { db } from "./db";
import { users, drivers, rides } from "@shared/schema";
import { eq, and, desc, sql, count } from "drizzle-orm";

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
  callback_query?: {
    id: string;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    message?: {
      chat: { id: number };
      message_id: number;
    };
    data?: string;
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

async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`${TELEGRAM_API_URL}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  } catch (error) {
    console.error("[Telegram] Error answering callback:", error);
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
    return { success: false, message: "No account found with this phone number. Please register in the T Driver app first." };
  }

  await db.update(users).set({ telegramChatId: chatId.toString() }).where(eq(users.id, user.id));
  return { success: true, message: `Account linked successfully! Welcome, ${user.name}` };
}

function getCommunityWelcome(firstName: string): string {
  return `<b>Welcome to the Travony Network</b>

${firstName}, you've joined a mobility infrastructure built for vehicle operators.

<b>What This Network Offers:</b>
- Real-time platform updates and announcements
- Route optimization and yield strategies
- Direct connection to the Travony team
- Operator community and peer support
- Referral programme tracking

<b>Get Started:</b>
1. Download <b>T Driver</b> from Google Play
2. Register as a vehicle operator
3. Link your account here with /link [your phone number]

<b>Commands:</b>
/link [phone] - Link your operator account
/earnings - Check your vehicle yield
/status - Your operator status
/rides - Recent route history
/referral - Get your referral code
/tips - Route optimization strategies
/calculator - Yield calculator
/faq - Common questions answered
/support - Get help from our team
/community - Network stats

<b>Get the app:</b> https://play.google.com/store/apps/details?id=com.travony.driver

Questions? Just type /support`;
}

function getDrivingTips(): string {
  const tips = [
    {
      title: "Peak Demand Windows",
      tip: "Activate your vehicle during morning (7-9 AM) and evening (5-8 PM) demand windows for 40-60% more route requests. Weekends peak from 10 PM-2 AM."
    },
    {
      title: "High-Yield Zones",
      tip: "Position near airports, transit stations, and metro exits. These zones have consistent demand throughout the day, maximizing your vehicle utilization."
    },
    {
      title: "Direction-Aligned Routes",
      tip: "Activate Going Home mode when heading home. The network matches you with riders going your direction - earn a premium while commuting."
    },
    {
      title: "Acceptance Rate Matters",
      tip: "Keep your acceptance rate above 85% for priority matching. Founding Operators who maintain high rates get matched first."
    },
    {
      title: "The 90% Model",
      tip: "On Travony you retain 90% of every fare. On a 1,000 AED day, that's 900 AED vs 750-800 AED on other platforms. Every route counts more here."
    },
    {
      title: "Weather Demand Boost",
      tip: "During rain or extreme weather, the network activates a 20-30% boost automatically. Stay active during adverse conditions for higher yield."
    },
    {
      title: "New Operator Protection",
      tip: "Your first 20 routes have rating protection. Focus on learning the platform and optimizing your routes without pressure."
    },
    {
      title: "Referral Programme",
      tip: "Use /referral to get your code. Each operator you refer earns you a bonus after they complete their first 10 routes."
    }
  ];
  const tip = tips[Math.floor(Math.random() * tips.length)];
  return `<b>${tip.title}</b>\n\n${tip.tip}\n\nWant another strategy? Type /tips again`;
}

function getFAQ(): string {
  return `<b>Frequently Asked Questions</b>

<b>Q: What is Travony's platform fee?</b>
A: 10% flat. You retain 90% of every fare. No hidden fees, no surprises.

<b>Q: When are payouts processed?</b>
A: Weekly via bank transfer, or instant USDT crypto payouts on demand.

<b>Q: Can I see the yield before accepting a route?</b>
A: Yes. Full earnings breakdown is shown before you accept any route request.

<b>Q: What is a Founding Operator?</b>
A: Early operators who join before public launch. You receive a permanent badge, priority matching, signup bonus, and referral yield.

<b>Q: How does direction-aligned routing work?</b>
A: Set your destination, and the network matches you with riders going your direction. You earn a premium while heading home.

<b>Q: What about tips?</b>
A: 100% of tips go to you. The platform takes zero cut on tips.

<b>Q: Is crypto payout mandatory?</b>
A: No. Choose bank transfer or USDT - whatever suits your operation.

<b>Q: How do I report an issue?</b>
A: Use /support or /feedback [your message]

More questions? Type /support to contact our team.`;
}

function getEarningsCalculator(ridesPerDay: number = 12, avgFare: number = 35, daysPerWeek: number = 6): string {
  const weeklyGross = ridesPerDay * avgFare * daysPerWeek;
  const travonyEarnings = Math.round(weeklyGross * 0.90);
  const otherEarnings = Math.round(weeklyGross * 0.75);
  const difference = travonyEarnings - otherEarnings;
  const monthlyExtra = difference * 4;
  const yearlyExtra = difference * 52;

  return `<b>Yield Calculator</b>

<b>Your inputs:</b>
Routes/day: ${ridesPerDay}
Average fare: ${avgFare} AED
Days/week: ${daysPerWeek}

<b>Weekly Yield Comparison:</b>

Travony (90%): <b>${travonyEarnings.toLocaleString()} AED</b>
Other platforms (75%): ${otherEarnings.toLocaleString()} AED

<b>You retain ${difference.toLocaleString()} AED MORE per week</b>

Monthly advantage: +${monthlyExtra.toLocaleString()} AED
Annual advantage: +${yearlyExtra.toLocaleString()} AED

Try different numbers:
/calculator [routes/day] [avg fare] [days/week]
Example: /calculator 15 40 6`;
}

async function handleCommand(chatId: number, command: string, args: string[], firstName: string): Promise<string> {
  const driver = await getDriverByChatId(chatId);

  switch (command) {
    case "/start":
      return getCommunityWelcome(firstName);

    case "/link":
      if (args.length === 0) {
        return "Please provide your phone number.\nExample: /link +971501234567";
      }
      const linkResult = await linkTelegramAccount(chatId, args[0]);
      return linkResult.message;

    case "/status":
      if (!driver) {
        return "Account not linked yet.\n\n1. Download T Driver: https://play.google.com/store/apps/details?id=com.travony.driver\n2. Create your account\n3. Link here: /link [your phone]";
      }
      const driverData = driver.drivers;
      return `<b>Operator Status</b>

Status: ${driverData.status}
Vehicle Active: ${driverData.isOnline ? "Yes" : "No"}
Rating: ${driverData.rating || "5.00"}
Routes Completed: ${driverData.totalTrips || 0}
Classification: Founding Operator`;

    case "/earnings":
      if (!driver) {
        return "Account not linked. Use /link [phone] to connect your account.";
      }
      return `<b>Vehicle Yield</b>

Total Yield: $${driver.drivers.totalEarnings || "0.00"}
Asset Balance: $${driver.drivers.walletBalance || "0.00"}

Platform fee: 10% flat
Your retention: 90% of every fare
Tips: 100% yours

Use /calculator to project future yield`;

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
        return "No routes yet. Activate your vehicle in the T Driver app to start receiving route requests.";
      }

      let ridesText = "<b>Recent Routes</b>\n\n";
      for (const ride of recentRides) {
        ridesText += `${ride.status.toUpperCase()} - $${ride.actualFare || "0.00"}\n`;
        ridesText += `${ride.pickupAddress} to ${ride.dropoffAddress}\n\n`;
      }
      return ridesText;

    case "/referral":
      if (!driver) {
        return `<b>Referral Program</b>

Link your account first to get your personal referral code.

/link [your phone number]

Once linked, share your code with other drivers. You both earn a bonus after they complete 10 rides!`;
      }
      const refCode = `TRAV${driver.users.id.toString().slice(-6).toUpperCase()}`;
      return `<b>Your Referral Code</b>

Code: <code>${refCode}</code>

Share this with other operators. When they register using your code and complete 10 routes, you both receive a bonus.

<b>Share this message:</b>
"Your vehicle is an asset. Retain 90% of every fare on Travony. Use my code ${refCode} when registering. Download: https://play.google.com/store/apps/details?id=com.travony.driver"`;

    case "/tips":
      return getDrivingTips();

    case "/calculator":
      const calcRides = parseInt(args[0]) || 12;
      const calcFare = parseInt(args[1]) || 35;
      const calcDays = parseInt(args[2]) || 6;
      return getEarningsCalculator(calcRides, calcFare, calcDays);

    case "/faq":
      return getFAQ();

    case "/community":
      try {
        const [driverCount] = await db.select({ count: count() }).from(drivers);
        const [onlineCount] = await db.select({ count: count() }).from(drivers).where(eq(drivers.isOnline, true));
        return `<b>Travony Driver Community</b>

Total Drivers: ${driverCount?.count || 0}
Currently Online: ${onlineCount?.count || 0}

Join us: https://play.google.com/store/apps/details?id=com.travony.driver
Recruit page: https://travony.replit.app/drive

Every driver you bring makes the network stronger for everyone.`;
      } catch {
        return `<b>Travony Driver Community</b>\n\nJoin us: https://play.google.com/store/apps/details?id=com.travony.driver\nRecruit page: https://travony.replit.app/drive`;
      }

    case "/support":
      return `<b>Travony Driver Support</b>

For urgent issues:
- Emergency: Use the emergency button in the app
- Fare disputes: Report in app after ride completion

Common issues:
- Payments: Processed weekly
- Ratings: Protected for first 20 rides
- Commission: Only 10% platform fee

Send feedback: /feedback [your message]
Visit: https://travony.replit.app/support`;

    case "/feedback":
      if (args.length === 0) {
        return "Please include your feedback.\nExample: /feedback The app is working great!";
      }
      console.log(`[Telegram Feedback] From ${chatId} (${firstName}): ${args.join(" ")}`);
      return "Thank you for your feedback! Our team will review it shortly.";

    case "/online":
      if (!driver) {
        return "Account not linked. Use /link [phone] to connect your account.";
      }
      await db.update(drivers).set({ isOnline: true }).where(eq(drivers.id, driver.drivers.id));
      return "Vehicle activated. You are now receiving route requests.";

    case "/offline":
      if (!driver) {
        return "Account not linked. Use /link [phone] to connect your account.";
      }
      await db.update(drivers).set({ isOnline: false }).where(eq(drivers.id, driver.drivers.id));
      return "Vehicle deactivated. Activate again to receive route requests.";

    case "/invite":
      return `<b>Invite Operators to Travony</b>

Share this with vehicle operators you know:

"Your vehicle is an asset. On Travony, you retain 90% of every fare with full transparency - see your exact yield before accepting any route. No hidden fees. 100% of tips are yours.

Download T Driver: https://play.google.com/store/apps/details?id=com.travony.driver
Learn more: https://travony.replit.app/drive"

Every operator who joins strengthens the network for everyone.`;

    case "/whytravony":
      return `<b>Why Operate on Travony?</b>

<b>90% retention.</b> Other platforms take 20-25%. Travony: 10% flat.

<b>Yield visibility.</b> Full breakdown before you accept any route. No surprises.

<b>100% tips.</b> The platform never touches your tips.

<b>Direction-aligned routing.</b> Earn while commuting. Get matched with riders going your direction.

<b>Fair protection.</b> Rider cancels? You're compensated. Not your fault? Record stays clean.

<b>Instant crypto payouts.</b> Receive USDT directly. No bank delays.

<b>AI dispute resolution.</b> Fair, transparent - not a random support agent.

Join the network: https://play.google.com/store/apps/details?id=com.travony.driver`;

    default:
      return `I didn't understand that command.

<b>Available Commands:</b>
/start - Welcome & overview
/link [phone] - Link your account
/status - Operator status
/earnings - Vehicle yield
/rides - Recent routes
/referral - Referral code
/tips - Optimization strategies
/calculator - Yield calculator
/faq - Common questions
/community - Network stats
/invite - Share invite message
/whytravony - Why operate on Travony
/support - Get help`;
  }
}

export async function processTelegramUpdate(update: TelegramUpdate): Promise<void> {
  if (update.callback_query) {
    const cbQuery = update.callback_query;
    const chatId = cbQuery.message?.chat.id;
    if (chatId && cbQuery.data) {
      await answerCallbackQuery(cbQuery.id);
      const parts = cbQuery.data.split(" ");
      const command = parts[0];
      const args = parts.slice(1);
      const response = await handleCommand(chatId, command, args, cbQuery.from.first_name);
      await sendTelegramMessage(chatId, response);
    }
    return;
  }

  if (!update.message?.text) return;

  const chatId = update.message.chat.id;
  const text = update.message.text.trim();
  const firstName = update.message.from.first_name;

  if (text.startsWith("/")) {
    const parts = text.split(" ");
    const command = parts[0].toLowerCase().split("@")[0];
    const args = parts.slice(1);
    const response = await handleCommand(chatId, command, args, firstName);
    await sendTelegramMessage(chatId, response);
  } else {
    const lowerText = text.toLowerCase();
    if (lowerText.includes("earn") || lowerText.includes("money") || lowerText.includes("pay")) {
      await sendTelegramMessage(chatId, "Interested in vehicle yield? Try /calculator or /earnings\n\nOn Travony, you retain 90% of every fare.");
    } else if (lowerText.includes("join") || lowerText.includes("sign up") || lowerText.includes("register")) {
      await sendTelegramMessage(chatId, "Ready to join the network? Download T Driver from Google Play:\nhttps://play.google.com/store/apps/details?id=com.travony.driver\n\nThen link your account here with /link [phone]");
    } else if (lowerText.includes("help") || lowerText.includes("problem") || lowerText.includes("issue")) {
      await sendTelegramMessage(chatId, "Need help? Try /support or /faq\n\nFor specific feedback: /feedback [your message]");
    } else {
      await sendTelegramMessage(chatId, "Type /start to see all available commands, or try:\n/tips - Route optimization strategies\n/calculator - Project your vehicle yield\n/faq - Common questions");
    }
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

export async function broadcastCampaignMessage(message: string): Promise<number> {
  const allDrivers = await db.select()
    .from(drivers)
    .innerJoin(users, eq(drivers.userId, users.id));

  let sent = 0;
  for (const driver of allDrivers) {
    if (driver.users.telegramChatId) {
      const success = await sendTelegramMessage(driver.users.telegramChatId, message);
      if (success) sent++;
      await new Promise(resolve => setTimeout(resolve, 50));
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

  const welcomeMessage = `<b>Welcome to Travony, ${driverName}!</b>

You're now part of the Travony driver community. Here's what makes us different:

- <b>90% is yours</b> - We only take 10%
- <b>Full transparency</b> - See earnings before accepting
- <b>100% tips</b> - We never touch them
- <b>Going Home mode</b> - Earn while commuting

<b>Commands:</b>
/status - Your driver status
/earnings - View earnings
/rides - Recent rides
/tips - Earning strategies
/referral - Get your referral code
/calculator - Earnings calculator
/online - Go online
/offline - Go offline
/feedback [message] - Send feedback

Next step: Open the app to complete your profile.`;

  await sendTelegramMessage(chatId, welcomeMessage);

  setTimeout(async () => {
    const guideMessage = `<b>Quick Start Guide</b>

1. Open the T Driver app and sign in
2. Complete your profile (photo, license, vehicle)
3. Wait for verification (max 24 hours)
4. Once approved, tap "Go Online" to receive rides

<b>Pro tip:</b> Use /tips to learn strategies that top drivers use to maximize earnings.

Questions? Type /faq or /support`;
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

  const message = `<b>Your Account is Approved!</b>

You're ready to receive rides.

<b>Tips for your first ride:</b>
- Keep the app open and in the foreground
- Accept within 30 seconds
- Use the built-in navigation
- Confirm payment before ending the ride

<b>Remember: Only 10% fee</b> - 90% of every fare is yours.

Use /referral to invite other drivers and earn bonuses!

Good luck!`;

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

export async function setBotCommands(): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) return false;

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commands: [
          { command: "start", description: "Welcome & overview" },
          { command: "link", description: "Link your driver account" },
          { command: "status", description: "Check your driver status" },
          { command: "earnings", description: "View your earnings" },
          { command: "rides", description: "Recent ride history" },
          { command: "referral", description: "Get your referral code" },
          { command: "tips", description: "Driving tips to earn more" },
          { command: "calculator", description: "Earnings calculator" },
          { command: "faq", description: "Frequently asked questions" },
          { command: "community", description: "Community stats" },
          { command: "invite", description: "Share invite message" },
          { command: "whytravony", description: "Why choose Travony" },
          { command: "support", description: "Get help" },
          { command: "feedback", description: "Send feedback" },
        ],
      }),
    });
    const result = await response.json();
    console.log("[Telegram] Bot commands set:", result);
    return result.ok;
  } catch (error) {
    console.error("[Telegram] Error setting commands:", error);
    return false;
  }
}
