import { db } from "./db";
import { sql } from "drizzle-orm";
import { getEmailQueueStatus } from "./email";

export type HealthStatus = "ok" | "warn" | "down";

export interface HealthCheck {
  name: string;
  category: string;
  status: HealthStatus;
  detail: string;
}

export interface SystemHealth {
  generatedAt: string;
  overall: HealthStatus;
  checks: HealthCheck[];
}

function envSet(...names: string[]): boolean {
  return names.every((n) => !!process.env[n]);
}

async function checkDatabase(): Promise<HealthCheck> {
  try {
    await db.execute(sql`SELECT 1`);
    return { name: "Database", category: "Core", status: "ok", detail: "PostgreSQL connection healthy." };
  } catch (error: any) {
    return { name: "Database", category: "Core", status: "down", detail: `Connection failed: ${error?.message || error}` };
  }
}

async function checkTelegram(): Promise<HealthCheck> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { name: "Telegram bot", category: "Messaging", status: "down", detail: "TELEGRAM_BOT_TOKEN is not set." };
  }
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const data = await resp.json();
    if (data.ok && data.result?.url) {
      const pending = data.result.pending_update_count ?? 0;
      const lastErr = data.result.last_error_message;
      if (lastErr) {
        return { name: "Telegram bot", category: "Messaging", status: "warn", detail: `Webhook set but last error: ${lastErr}` };
      }
      return { name: "Telegram bot", category: "Messaging", status: "ok", detail: `Webhook live (${pending} pending updates).` };
    }
    return { name: "Telegram bot", category: "Messaging", status: "warn", detail: "Bot token valid but no webhook is set." };
  } catch (error: any) {
    return { name: "Telegram bot", category: "Messaging", status: "down", detail: `Telegram API unreachable: ${error?.message || error}` };
  }
}

function checkEmail(): HealthCheck {
  if (!envSet("SMTP_USER", "SMTP_PASS")) {
    return { name: "Email (SMTP)", category: "Messaging", status: "warn", detail: "SMTP_USER / SMTP_PASS not set — receipts will not send." };
  }
  try {
    const q = getEmailQueueStatus();
    return { name: "Email (SMTP)", category: "Messaging", status: "ok", detail: `Configured. ${q.pending?.length ?? 0} email(s) queued.` };
  } catch {
    return { name: "Email (SMTP)", category: "Messaging", status: "ok", detail: "Configured." };
  }
}

function checkAI(): HealthCheck {
  if (!envSet("AI_INTEGRATIONS_OPENAI_API_KEY")) {
    return { name: "AI (OpenAI)", category: "Intelligence", status: "warn", detail: "OpenAI key not set — matching/translation fall back to defaults." };
  }
  return { name: "AI (OpenAI)", category: "Intelligence", status: "ok", detail: "Configured for matching, pricing and translation." };
}

function checkStripe(): HealthCheck {
  if (!envSet("STRIPE_SECRET_KEY")) {
    return { name: "Stripe", category: "Payments", status: "warn", detail: "STRIPE_SECRET_KEY not set." };
  }
  return { name: "Stripe", category: "Payments", status: "ok", detail: "Configured." };
}

function checkNowPayments(): HealthCheck {
  if (!envSet("NOWPAYMENTS_API_KEY")) {
    return { name: "NOWPayments (crypto)", category: "Payments", status: "warn", detail: "NOWPAYMENTS_API_KEY not set." };
  }
  return { name: "NOWPayments (crypto)", category: "Payments", status: "ok", detail: "Configured for card and USDT." };
}

function checkTwilio(): HealthCheck {
  if (!envSet("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN")) {
    return { name: "Twilio (SMS/OTP)", category: "Messaging", status: "warn", detail: "Twilio credentials not set — OTP SMS disabled." };
  }
  return { name: "Twilio (SMS/OTP)", category: "Messaging", status: "ok", detail: "Configured." };
}

function checkBlockchain(): HealthCheck {
  if (!envSet("BLOCKCHAIN_PRIVATE_KEY")) {
    return { name: "Blockchain (Polygon)", category: "Verification", status: "warn", detail: "Signing key not set — ride records won't be anchored on-chain." };
  }
  return { name: "Blockchain (Polygon)", category: "Verification", status: "ok", detail: "Configured on Polygon Amoy testnet." };
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const checks: HealthCheck[] = [];
  const [dbCheck, tgCheck] = await Promise.all([checkDatabase(), checkTelegram()]);
  checks.push(dbCheck, tgCheck, checkEmail(), checkAI(), checkStripe(), checkNowPayments(), checkTwilio(), checkBlockchain());

  const overall: HealthStatus = checks.some((c) => c.status === "down")
    ? "down"
    : checks.some((c) => c.status === "warn")
      ? "warn"
      : "ok";

  return { generatedAt: new Date().toISOString(), overall, checks };
}
