// ---------------------------------------------------------------------------
// Unified notification service — ONE entry point for notifying any user.
//
// Delivery ladder:
//   1. In-app inbox row (always written unless deduped/capped)
//   2. Telegram (free, instant) when the user has a linked chat and pref on
//   3. High urgency only: SMS escalation, and email fallback when Telegram
//      didn't deliver.
//
// Guardrails handled here so callers never think about them:
//   - dedupe (same dedupeKey within a window is dropped)
//   - daily cap for autopilot-originated notifications (max/user/day)
//   - quiet hours (external channels held during user's local night,
//     except high urgency; the in-app row is still written)
//   - per-user channel preferences + mute-all
// ---------------------------------------------------------------------------

import { db } from "./db";
import { and, eq, gte, inArray, isNull, sql as dsql } from "drizzle-orm";
import {
  users,
  notifications,
  notificationPrefs,
  type Notification,
  type NotificationPrefs,
} from "@shared/schema";
import { sendTelegramMessage } from "./telegramBot";
import { sendSmsMessage } from "./twilioService";
import { queueEmail } from "./email";

export type Urgency = "low" | "normal" | "high";

export interface NotifyOptions {
  userId: string;
  kind: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  urgency?: Urgency;
  dedupeKey?: string;
  dedupeWindowHours?: number;
}

export interface NotifyResult {
  delivered: boolean;
  skipped?: string;
  notificationId?: string;
  channels?: Record<string, string>;
}

const AUTOPILOT_DAILY_CAP = 3; // max autopilot notifications per user per day

// Country-level fallback UTC offsets (minutes) for quiet-hours math.
const REGION_TZ_OFFSET_MIN: Record<string, number> = {
  AE: 240, SA: 180, QA: 180, KW: 180, BH: 180, OM: 240,
  BD: 360, IN: 330, PK: 300, LK: 330, NP: 345,
  EG: 120, TR: 180, NG: 60, KE: 180, ZA: 120,
  GB: 0, US: -300,
};

function localHour(offsetMinutes: number): number {
  const utcMs = Date.now();
  const local = new Date(utcMs + offsetMinutes * 60_000);
  return local.getUTCHours();
}

function inQuietHours(prefs: PrefsShape, regionCode: string | null): boolean {
  const offset =
    prefs.timezoneOffsetMinutes ?? REGION_TZ_OFFSET_MIN[regionCode || "AE"] ?? 240;
  const hour = localHour(offset);
  const start = prefs.quietHoursStart;
  const end = prefs.quietHoursEnd;
  if (start === end) return false; // disabled
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end; // wraps midnight (e.g. 22 -> 8)
}

type PrefsShape = Pick<
  NotificationPrefs,
  | "muteAll"
  | "telegramEnabled"
  | "smsEnabled"
  | "emailEnabled"
  | "quietHoursStart"
  | "quietHoursEnd"
  | "timezoneOffsetMinutes"
>;

const DEFAULT_PREFS: PrefsShape = {
  muteAll: false,
  telegramEnabled: true,
  smsEnabled: true,
  emailEnabled: true,
  quietHoursStart: 22,
  quietHoursEnd: 8,
  timezoneOffsetMinutes: null,
};

export async function getPrefs(userId: string): Promise<PrefsShape> {
  const [row] = await db
    .select()
    .from(notificationPrefs)
    .where(eq(notificationPrefs.userId, userId));
  return row ?? DEFAULT_PREFS;
}

export async function upsertPrefs(
  userId: string,
  patch: Partial<PrefsShape>,
): Promise<NotificationPrefs> {
  const clamp = (h: unknown, fallback: number) => {
    const n = Number(h);
    return Number.isInteger(n) && n >= 0 && n <= 23 ? n : fallback;
  };
  const safe: Partial<PrefsShape> = {};
  if (typeof patch.muteAll === "boolean") safe.muteAll = patch.muteAll;
  if (typeof patch.telegramEnabled === "boolean") safe.telegramEnabled = patch.telegramEnabled;
  if (typeof patch.smsEnabled === "boolean") safe.smsEnabled = patch.smsEnabled;
  if (typeof patch.emailEnabled === "boolean") safe.emailEnabled = patch.emailEnabled;
  if (patch.quietHoursStart !== undefined) safe.quietHoursStart = clamp(patch.quietHoursStart, 22);
  if (patch.quietHoursEnd !== undefined) safe.quietHoursEnd = clamp(patch.quietHoursEnd, 8);
  if (patch.timezoneOffsetMinutes !== undefined) {
    const n = Number(patch.timezoneOffsetMinutes);
    safe.timezoneOffsetMinutes =
      Number.isInteger(n) && n >= -720 && n <= 840 ? n : null;
  }
  const [row] = await db
    .insert(notificationPrefs)
    .values({ userId, ...safe })
    .onConflictDoUpdate({
      target: notificationPrefs.userId,
      set: { ...safe, updatedAt: new Date() },
    })
    .returning();
  return row;
}

export async function notifyUser(opts: NotifyOptions): Promise<NotifyResult> {
  const urgency: Urgency = opts.urgency ?? "normal";

  const [user] = await db.select().from(users).where(eq(users.id, opts.userId));
  if (!user) return { delivered: false, skipped: "no-such-user" };

  const prefs = await getPrefs(opts.userId);

  // Dedupe: identical dedupeKey within the window -> drop entirely.
  if (opts.dedupeKey) {
    const windowMs = (opts.dedupeWindowHours ?? 6) * 3_600_000;
    const [dup] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, opts.userId),
          eq(notifications.dedupeKey, opts.dedupeKey),
          gte(notifications.createdAt, new Date(Date.now() - windowMs)),
        ),
      )
      .limit(1);
    if (dup) return { delivered: false, skipped: "dedupe" };
  }

  // Daily cap for autopilot notifications (high urgency exempt).
  if (opts.kind.startsWith("autopilot") && urgency !== "high") {
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const [{ count }] = await db
      .select({ count: dsql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, opts.userId),
          gte(notifications.createdAt, dayStart),
          dsql`${notifications.kind} like 'autopilot%'`,
        ),
      );
    if (count >= AUTOPILOT_DAILY_CAP) return { delivered: false, skipped: "daily-cap" };
  }

  const quiet = inQuietHours(prefs, user.regionCode);
  const externalAllowed = !prefs.muteAll && (urgency === "high" || !quiet);
  const channels: Record<string, string> = {};

  // 1. In-app inbox row — the system of record.
  const [row] = await db
    .insert(notifications)
    .values({
      userId: opts.userId,
      kind: opts.kind,
      title: opts.title,
      body: opts.body,
      data: opts.data ?? null,
      urgency,
      dedupeKey: opts.dedupeKey ?? null,
      channels: {},
    })
    .returning();
  channels.inApp = "sent";

  // 2. Telegram — primary external channel.
  let telegramSent = false;
  if (externalAllowed && prefs.telegramEnabled && user.telegramChatId) {
    try {
      telegramSent = await sendTelegramMessage(
        user.telegramChatId,
        `<b>${escapeHtml(opts.title)}</b>\n${escapeHtml(opts.body)}`,
      );
      channels.telegram = telegramSent ? "sent" : "failed";
    } catch (err: any) {
      channels.telegram = "failed";
      console.error(`[notify] telegram failed for ${opts.userId}: ${err.message}`);
    }
  } else {
    channels.telegram = !user.telegramChatId
      ? "skipped:not-linked"
      : !externalAllowed
        ? quiet
          ? "skipped:quiet-hours"
          : "skipped:muted"
        : "skipped:pref";
  }

  // 3. High-urgency escalation: SMS, and email as Telegram fallback.
  if (urgency === "high" && externalAllowed) {
    if (prefs.smsEnabled && user.phone) {
      try {
        const sms = await sendSmsMessage(user.phone, `${opts.title} — ${opts.body}`);
        channels.sms = sms.success ? "sent" : `failed:${sms.error ?? "unknown"}`;
      } catch (err: any) {
        channels.sms = "failed";
        console.error(`[notify] sms failed for ${opts.userId}: ${err.message}`);
      }
    } else {
      channels.sms = user.phone ? "skipped:pref" : "skipped:no-phone";
    }
    if (!telegramSent && prefs.emailEnabled && user.email && user.email.includes("@")) {
      const html = `<div style="font-family:sans-serif"><h3>${escapeHtml(opts.title)}</h3><p>${escapeHtml(opts.body)}</p><p style="color:#888;font-size:12px">Travony</p></div>`;
      queueEmail(user.email, opts.title, html, `${opts.title}\n\n${opts.body}`);
      channels.email = "queued";
    }
  }

  await db
    .update(notifications)
    .set({ channels })
    .where(eq(notifications.id, row.id));

  return { delivered: true, notificationId: row.id, channels };
}

export async function listNotifications(
  userId: string,
  limit = 50,
): Promise<{ notifications: Notification[]; unreadCount: number }> {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(dsql`${notifications.createdAt} desc`)
    .limit(Math.min(Math.max(limit, 1), 100));
  const [{ count }] = await db
    .select({ count: dsql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return { notifications: rows, unreadCount: count };
}

export async function markRead(userId: string, ids?: string[]): Promise<number> {
  const base = and(eq(notifications.userId, userId), isNull(notifications.readAt));
  const where =
    ids && ids.length > 0 ? and(base, inArray(notifications.id, ids)) : base;
  const rows = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(where)
    .returning({ id: notifications.id });
  return rows.length;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
