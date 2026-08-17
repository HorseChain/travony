/**
 * useVehicleSpeed — subscribes to device GPS at Balanced accuracy to detect
 * whether the vehicle is moving above the distraction-prevention threshold.
 *
 * Returns a three-value `movingState`:
 *   "unknown"  — initial state, location permission denied, or GPS unavailable.
 *                Controls MUST be locked in this state (fail-safe / conservative).
 *   "moving"   — speed > MOVING_KMH (15 km/h) on a valid GPS reading.
 *   "stopped"  — speed < STOPPED_KMH (10 km/h) on valid readings continuously
 *                for at least DEBOUNCE_MS.
 *
 * Hysteresis / debounce rules (strictly enforced):
 *   - Any state → "moving"   immediately when valid speed > 15 km/h.
 *   - Any state → "stopped"  only after valid readings ALL below 10 km/h for 3 s.
 *   - 10–15 km/h band:       current state maintained BUT the stopped-debounce
 *                            timer is RESET — the vehicle must be continuously
 *                            below 10 km/h to accumulate unlock time.
 *   - null / negative speed: reading skipped entirely (no state or timer change)
 *                            so GPS dropouts (tunnels, urban canyons) do not
 *                            advance the unlock debounce.
 *
 * The pure state-machine logic is in `nextMovingState` (exported for tests).
 */

import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";

export type MovingState = "unknown" | "moving" | "stopped";

export const MOVING_KMH  = 15;   // above this → "moving"
export const STOPPED_KMH = 10;   // below this  → start debounce toward "stopped"
export const DEBOUNCE_MS = 3000; // must stay below STOPPED_KMH for this long

/**
 * Pure state-transition function.
 * Exported so it can be unit-tested without mocking React or expo-location.
 *
 * @param current    Current MovingState
 * @param speedKmh   Validated speed in km/h (must be ≥ 0; skip invalid readings before calling)
 * @param belowSince Timestamp (ms) when speed first dropped below STOPPED_KMH, or null
 * @param now        Current timestamp in ms
 * @returns          Next state and updated belowSince value
 */
export function nextMovingState(
  current: MovingState,
  speedKmh: number,
  belowSince: number | null,
  now: number,
): { nextState: MovingState; nextBelowSince: number | null } {
  if (speedKmh > MOVING_KMH) {
    // Above 15 km/h: lock immediately, reset debounce timer.
    return { nextState: "moving", nextBelowSince: null };
  }

  if (speedKmh >= STOPPED_KMH) {
    // 10–15 km/h hysteresis band: maintain current lock state (or conservatively
    // promote "unknown" to "moving"), but RESET the debounce timer so the vehicle
    // must be continuously below 10 km/h to earn an unlock.
    return {
      nextState: current === "unknown" ? "moving" : current,
      nextBelowSince: null, // ← reset: partial time below 10 does not carry over
    };
  }

  // Below 10 km/h — valid low-speed reading: advance the debounce window.
  const since = belowSince ?? now; // start the timer on the first qualifying reading
  if (now - since >= DEBOUNCE_MS) {
    // Continuously below 10 km/h for 3 s → unlock.
    return { nextState: "stopped", nextBelowSince: since };
  }
  // Timer not yet expired — hold current state (controls stay locked).
  return { nextState: current, nextBelowSince: since };
}

// ---------------------------------------------------------------------------

export function useVehicleSpeed(): {
  movingState: MovingState;
  /** Latest valid GPS speed in km/h (null until the first valid reading).
   * A ref, not state — reading it never causes re-renders; consumers sample
   * it on their own cadence (e.g. the broadcast heartbeat). */
  speedKmhRef: React.MutableRefObject<number | null>;
} {
  // Start in "unknown" — controls are locked until the first valid GPS reading.
  const [movingState, setMovingState] = useState<MovingState>("unknown");
  const speedKmhRef = useRef<number | null>(null);
  const belowSinceRef = useRef<number | null>(null);
  // Keep a ref-copy of movingState for use inside the watchPosition callback
  // without re-subscribing on every state change.
  const movingStateRef = useRef<MovingState>("unknown");

  useEffect(() => {
    if (Platform.OS === "web") return;

    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;

        if (status !== "granted") {
          // Permission denied — remain "unknown" (safe locked state).
          return;
        }

        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 1500,  // ms
            distanceInterval: 5, // m
          },
          (location) => {
            if (cancelled) return;

            // Null or negative speed = GPS chip has no reliable Doppler fix.
            // Skip entirely — do not advance debounce, do not change state.
            const rawSpeed = location.coords.speed;
            if (rawSpeed === null || rawSpeed === undefined || rawSpeed < 0) return;

            const speedKmh = rawSpeed * 3.6;
            speedKmhRef.current = speedKmh;
            const { nextState, nextBelowSince } = nextMovingState(
              movingStateRef.current,
              speedKmh,
              belowSinceRef.current,
              Date.now(),
            );

            belowSinceRef.current = nextBelowSince;
            if (nextState !== movingStateRef.current) {
              movingStateRef.current = nextState;
              setMovingState(nextState);
            }
          },
        );
      } catch (err) {
        // Location service unavailable — remain "unknown" (safe locked state).
        console.log("[useVehicleSpeed] location unavailable:", (err as any)?.message || err);
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  return { movingState, speedKmhRef };
}
