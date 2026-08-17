// Shared rider-side ride cancellation — the single authorized path for any
// channel acting on the rider's behalf (Agent Gateway today; other headless
// channels can adopt it). Mirrors the customer-cancel branch of
// PATCH /api/rides/:id: atomic status transition + the same side effects
// (stream teardown, pool reconciliation, late-cancel accountability, and the
// full rider notification fan-out).
//
// The transition is ATOMIC: the UPDATE is conditioned on the current status
// still being cancellable, so a driver flipping the ride to started/completed
// concurrently can never be overwritten — a zero-row update means "no longer
// cancellable" and the caller is told the real current status.

import { db } from "./db";
import { rides } from "@shared/schema";
import { eq, sql, inArray, and } from "drizzle-orm";
import * as accountabilityService from "./accountabilityService";
import { reconcilePoolOnCancel } from "./sharedRideService";
import { sendRideStatusEmails } from "./rideNotifications";
import { endStreamsForRide } from "./agoraStreaming";

/** Statuses a rider (or an agent acting for the rider) may cancel from. */
export const RIDER_CANCELLABLE_STATUSES = ["pending", "accepted", "arriving"] as const;

export type CancelRideResult =
  | { ok: true; ride: typeof rides.$inferSelect }
  | { ok: false; reason: "not_found" | "already_cancelled" | "not_cancellable"; status?: string };

export async function cancelRideAsRider(rideId: string): Promise<CancelRideResult> {
  // Atomic compare-and-set: only transitions FROM a cancellable status win.
  const [cancelled] = await db
    .update(rides)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() } as any)
    .where(and(
      eq(rides.id, rideId),
      inArray(rides.status, [...RIDER_CANCELLABLE_STATUSES]),
    ))
    .returning();

  if (!cancelled) {
    const [current] = await db.select().from(rides).where(eq(rides.id, rideId)).limit(1);
    if (!current) return { ok: false, reason: "not_found" };
    if (current.status === "cancelled") return { ok: false, reason: "already_cancelled", status: current.status };
    return { ok: false, reason: "not_cancellable", status: current.status };
  }

  // --- Side effects (same set as the app's rider-cancel path) --------------

  // End any live in-app streams attached to the ride (fire-and-forget).
  endStreamsForRide(cancelled.id).catch((err) =>
    console.error("[rideLifecycle] end streams on cancel failed:", (err as Error)?.message || err),
  );

  // Keep a shared pool consistent when a pooled leg is cancelled. Awaited so
  // a co-rider's immediate status read sees the reconciled pool.
  if ((cancelled as any).isShared && (cancelled as any).poolGroupId) {
    await reconcilePoolOnCancel(cancelled as any).catch(console.error);
  }

  // Rider late-cancel accountability when a driver was already assigned.
  if (cancelled.driverId) {
    const acceptedAt = cancelled.acceptedAt ? new Date(cancelled.acceptedAt) : null;
    const minutesAfterAccept = acceptedAt ? (Date.now() - acceptedAt.getTime()) / 60000 : 0;
    accountabilityService
      .processRiderLateCancellation(cancelled.id, minutesAfterAccept)
      .catch(console.error);
  }

  // Status-change notification fan-out (identical to PATCH /api/rides/:id).
  import("./telegramRiderBot")
    .then((m) => m.notifyRiderRideUpdate(cancelled.id))
    .catch((err) => console.error("[Telegram] rider notify error:", err));
  import("./whatsappRiderBot")
    .then((m) => m.notifyWhatsAppRiderRideUpdate(cancelled.id))
    .catch((err) => console.error("[WhatsApp] rider notify error:", err));
  sendRideStatusEmails(cancelled.id).catch((err) =>
    console.error("[Email] ride status notify error:", err),
  );
  import("./agentGateway")
    .then((m) => m.notifyAgentRideUpdate(cancelled.id))
    .catch((err) => console.error("[AgentGateway] notify error:", err));

  return { ok: true, ride: cancelled };
}
