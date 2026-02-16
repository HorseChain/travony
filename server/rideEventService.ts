import { db } from "./db";
import { rideEventLog } from "@shared/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export type RideEventType = 
  | "requested" | "matched" | "accepted" | "driver_arriving" | "driver_arrived"
  | "started" | "in_progress" | "completed" | "cancelled_rider" | "cancelled_driver"
  | "cancelled_system" | "fare_updated" | "route_deviated" | "payment_initiated"
  | "payment_completed" | "payment_failed" | "dispute_opened" | "dispute_resolved"
  | "tip_added" | "rating_submitted" | "rematch_initiated" | "rematch_completed"
  | "blockchain_recorded" | "eta_updated";

interface RecordEventParams {
  rideId: string;
  eventType: RideEventType;
  actorId?: string;
  actorRole?: "rider" | "driver" | "system" | "admin";
  payload?: Record<string, any>;
  previousState?: string;
  newState?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export async function recordRideEvent(params: RecordEventParams): Promise<string> {
  const eventId = uuidv4();
  try {
    await db.insert(rideEventLog).values({
      id: eventId,
      rideId: params.rideId,
      eventType: params.eventType,
      actorId: params.actorId || null,
      actorRole: params.actorRole || null,
      payload: params.payload ? JSON.stringify(params.payload) : null,
      previousState: params.previousState || null,
      newState: params.newState || null,
      correlationId: params.correlationId || null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    });
    return eventId;
  } catch (error) {
    console.error(`Failed to record ride event [${params.eventType}] for ride ${params.rideId}:`, error);
    return eventId;
  }
}

export async function getRideEventHistory(rideId: string) {
  return db.select().from(rideEventLog)
    .where(eq(rideEventLog.rideId, rideId))
    .orderBy(rideEventLog.createdAt);
}

export async function getRideEventsByType(rideId: string, eventType: RideEventType) {
  return db.select().from(rideEventLog)
    .where(and(
      eq(rideEventLog.rideId, rideId),
      eq(rideEventLog.eventType, eventType)
    ))
    .orderBy(rideEventLog.createdAt);
}

export async function getRideStateAtTime(rideId: string, timestamp: Date) {
  const events = await db.select().from(rideEventLog)
    .where(and(
      eq(rideEventLog.rideId, rideId),
      lte(rideEventLog.createdAt, timestamp)
    ))
    .orderBy(desc(rideEventLog.createdAt))
    .limit(1);
  
  return events[0] || null;
}

export async function getEventsByCorrelation(correlationId: string) {
  return db.select().from(rideEventLog)
    .where(eq(rideEventLog.correlationId, correlationId))
    .orderBy(rideEventLog.createdAt);
}

export async function getRecentEvents(limit: number = 50) {
  return db.select().from(rideEventLog)
    .orderBy(desc(rideEventLog.createdAt))
    .limit(limit);
}
