/**
 * Unit tests for the pure nextMovingState state-machine in useVehicleSpeed.
 * These run without any React or expo-location dependencies.
 */
import {
  nextMovingState,
  MOVING_KMH,
  STOPPED_KMH,
  DEBOUNCE_MS,
  type MovingState,
} from "../useVehicleSpeed";

const T = 1000000; // arbitrary base timestamp

// Helper: run a series of speed readings through the state machine
function simulate(
  steps: Array<{ speedKmh: number; dtMs: number }>,
  initial: MovingState = "unknown",
): MovingState {
  let state: MovingState = initial;
  let belowSince: number | null = null;
  let now = T;
  for (const { speedKmh, dtMs } of steps) {
    now += dtMs;
    const r = nextMovingState(state, speedKmh, belowSince, now);
    state = r.nextState;
    belowSince = r.nextBelowSince;
  }
  return state;
}

describe("nextMovingState — above threshold", () => {
  it("locks immediately when speed > MOVING_KMH", () => {
    const r = nextMovingState("unknown", MOVING_KMH + 1, null, T);
    expect(r.nextState).toBe("moving");
    expect(r.nextBelowSince).toBeNull();
  });

  it("locks immediately even when already stopped", () => {
    const r = nextMovingState("stopped", MOVING_KMH + 5, null, T);
    expect(r.nextState).toBe("moving");
    expect(r.nextBelowSince).toBeNull();
  });
});

describe("nextMovingState — hysteresis band (10–15 km/h)", () => {
  it("promotes unknown → moving conservatively", () => {
    const r = nextMovingState("unknown", 12, null, T);
    expect(r.nextState).toBe("moving");
    expect(r.nextBelowSince).toBeNull();
  });

  it("does not unlock a moving state inside the band", () => {
    const r = nextMovingState("moving", 12, null, T);
    expect(r.nextState).toBe("moving");
  });

  it("resets belowSince timer to null inside the band", () => {
    // Simulate: 2 s below 10, then speed rises into band
    const r1 = nextMovingState("moving", 8, null, T);
    expect(r1.nextBelowSince).toBe(T); // timer started
    const r2 = nextMovingState(r1.nextState, 12, r1.nextBelowSince, T + 2000);
    expect(r2.nextBelowSince).toBeNull(); // timer RESET — critical fix
  });
});

describe("nextMovingState — stopped debounce", () => {
  it("does not unlock until DEBOUNCE_MS of valid <10 readings", () => {
    // Just under 3 s below 10
    const state = simulate([
      { speedKmh: 8, dtMs: 1000 },
      { speedKmh: 8, dtMs: 1000 },
      { speedKmh: 8, dtMs: DEBOUNCE_MS - 1 },
    ]);
    expect(state).not.toBe("stopped");
  });

  it("unlocks after DEBOUNCE_MS of continuous <10 readings", () => {
    const state = simulate([
      { speedKmh: 30, dtMs: 0 },        // start moving
      { speedKmh: 8, dtMs: 1000 },
      { speedKmh: 8, dtMs: 1000 },
      { speedKmh: 8, dtMs: DEBOUNCE_MS }, // 3 s elapsed
    ]);
    expect(state).toBe("stopped");
  });

  it("resets debounce when speed enters hysteresis band mid-window", () => {
    // Scenario from code review: <10 for 2s → 12 for 5s → <10 must NOT unlock immediately
    const state = simulate([
      { speedKmh: 30, dtMs: 0 },         // start moving
      { speedKmh: 8,  dtMs: 2000 },      // 2 s below 10 (timer starts at T+2000)
      { speedKmh: 12, dtMs: 5000 },      // back in band → timer RESET
      { speedKmh: 8,  dtMs: 100 },       // back below 10, only 100ms elapsed → locked
    ]);
    expect(state).toBe("moving"); // must still be locked, not "stopped"
  });

  it("also resets debounce when speed jumps above MOVING_KMH", () => {
    const state = simulate([
      { speedKmh: 8,  dtMs: 2000 }, // 2 s below 10
      { speedKmh: 20, dtMs: 100 },  // jumps to moving → reset
      { speedKmh: 8,  dtMs: 100 },  // only 100 ms below 10 → still locked
    ]);
    expect(state).toBe("moving");
  });
});

describe("nextMovingState — boundary values", () => {
  it("exactly at MOVING_KMH falls into hysteresis, not moving", () => {
    const r = nextMovingState("stopped", MOVING_KMH, null, T);
    // MOVING_KMH is NOT > MOVING_KMH, so it should stay in hysteresis
    expect(r.nextState).toBe("stopped"); // stopped maintained in band
    expect(r.nextBelowSince).toBeNull();
  });

  it("exactly at STOPPED_KMH falls into hysteresis, not debounced", () => {
    const r = nextMovingState("moving", STOPPED_KMH, null, T);
    // STOPPED_KMH is NOT < STOPPED_KMH, so it's in the hysteresis band
    expect(r.nextState).toBe("moving");
    expect(r.nextBelowSince).toBeNull();
  });
});
