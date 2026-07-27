/**
 * Self-running test for nextMovingState using a tiny inline assert helper.
 * Run with:  npx tsx client/hooks/__tests__/useVehicleSpeed.run.ts
 *
 * No Jest / Expo / React Native required — the function under test is pure.
 */

// Inline stubs so the module-level imports in useVehicleSpeed.ts resolve.
// tsx/ESM will hoist these if we use a mock; instead we re-export only the
// pure function by importing via a direct path and relying on the fact that
// expo-location / react-native are never CALLED in nextMovingState itself.
// We mock the modules by patching Node's module cache before the import.
const Module = require("module");
const _originalLoad = Module._load;
Module._load = function (id: string, ...rest: any[]) {
  if (id === "expo-location") {
    return {
      Accuracy: { Balanced: 3 },
      requestForegroundPermissionsAsync: async () => ({ status: "granted" }),
      watchPositionAsync: async () => ({ remove() {} }),
    };
  }
  if (id === "react-native") {
    return { Platform: { OS: "ios" } };
  }
  if (id === "react") {
    return { useEffect: () => {}, useRef: () => ({ current: null }), useState: (v: any) => [v, () => {}] };
  }
  return _originalLoad(id, ...rest);
};

// Now safe to import the pure function
const {
  nextMovingState,
  MOVING_KMH,
  STOPPED_KMH,
  DEBOUNCE_MS,
} = require("../useVehicleSpeed");

// ---------------------------------------------------------------------------
// Minimal test harness
// ---------------------------------------------------------------------------
let passed = 0, failed = 0;

function expect(label: string, actual: any, expected: any) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
    console.error(`      expected: ${JSON.stringify(expected)}`);
    console.error(`      actual  : ${JSON.stringify(actual)}`);
  }
}

const T = 1_000_000;

// Helper: run a series of readings through the state machine
function simulate(
  steps: Array<{ speedKmh: number; dtMs: number }>,
  initial = "unknown",
) {
  let state = initial;
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

// ---------------------------------------------------------------------------
console.log("\nuseVehicleSpeed — nextMovingState state-machine tests\n");

// Above threshold
console.log("Above threshold:");
{
  const r = nextMovingState("unknown", MOVING_KMH + 1, null, T);
  expect("locks immediately from unknown", r.nextState, "moving");
  expect("resets belowSince", r.nextBelowSince, null);

  const r2 = nextMovingState("stopped", MOVING_KMH + 5, null, T);
  expect("locks immediately from stopped", r2.nextState, "moving");
}

// Hysteresis band (10–15 km/h)
console.log("\nHysteresis band (10–15 km/h):");
{
  const r = nextMovingState("unknown", 12, null, T);
  expect("unknown → moving conservatively", r.nextState, "moving");
  expect("belowSince is null in band", r.nextBelowSince, null);

  const r2 = nextMovingState("moving", 12, null, T);
  expect("moving stays moving in band", r2.nextState, "moving");

  // Partial low-speed timer then enters band — timer must reset
  const r3a = nextMovingState("moving", 8, null, T);
  const r3b = nextMovingState(r3a.nextState, 12, r3a.nextBelowSince, T + 2000);
  expect("entering band resets belowSince", r3b.nextBelowSince, null);
}

// Stopped debounce
console.log("\nStopped debounce:");
{
  // belowSince is set on the FIRST reading below STOPPED_KMH.
  // elapsed = now - belowSince, measured from that first qualifying reading.
  // Step 1: speed=30 → moving.  Step 2: belowSince=T+1000, elapsed=0.
  // Step 3: now=T+1000+(DEBOUNCE_MS-1), elapsed=DEBOUNCE_MS-1 < 3000 → not stopped.
  const almostStopped = simulate([
    { speedKmh: 30, dtMs: 0 },
    { speedKmh: 8,  dtMs: 1000 },           // belowSince = T+1000, elapsed = 0
    { speedKmh: 8,  dtMs: DEBOUNCE_MS - 1 }, // elapsed = 2999 ms → still locked
  ]);
  expect("not stopped before DEBOUNCE_MS", almostStopped === "stopped", false);

  // Step 3: elapsed = DEBOUNCE_MS exactly → stopped.
  const justStopped = simulate([
    { speedKmh: 30, dtMs: 0 },
    { speedKmh: 8,  dtMs: 1000 },      // belowSince = T+1000
    { speedKmh: 8,  dtMs: DEBOUNCE_MS }, // elapsed = 3000 ms → stopped
  ]);
  expect("unlocks after DEBOUNCE_MS continuous <10", justStopped, "stopped");
}

// KEY scenario from code review: partial low-speed → band → dip → must NOT unlock
console.log("\nCode-review scenario: <10 for 2s → band → <10 must not unlock early:");
{
  const state = simulate([
    { speedKmh: 30, dtMs: 0 },    // start moving
    { speedKmh: 8,  dtMs: 2000 }, // 2 s below 10 (timer starts)
    { speedKmh: 12, dtMs: 5000 }, // enter band — timer RESETS
    { speedKmh: 8,  dtMs: 100 },  // back below 10, only 100ms elapsed
  ]);
  expect("controls stay locked (moving not stopped)", state, "moving");
}

// Hysteresis band → then debounce full window
// The band resets belowSince to null. The next <10 reading starts a fresh timer.
// A second reading DEBOUNCE_MS later confirms "stopped".
console.log("\nBand entry resets timer; fresh window still unlocks:");
{
  const state = simulate([
    { speedKmh: 30, dtMs: 0 },
    { speedKmh: 8,  dtMs: 2000 },       // 2 s below 10 (timer starts at T+2000)
    { speedKmh: 12, dtMs: 5000 },       // band → belowSince=null (timer RESET, now=T+7000)
    { speedKmh: 8,  dtMs: 100 },        // fresh timer starts: belowSince=T+7100
    { speedKmh: 8,  dtMs: DEBOUNCE_MS }, // elapsed=3000ms → stopped
  ]);
  expect("unlocks after fresh window post-band", state, "stopped");
}

// Speed jumps above MOVING_KMH — also resets debounce
console.log("\nSpeed spike above MOVING_KMH resets debounce:");
{
  const state = simulate([
    { speedKmh: 8,  dtMs: 2000 }, // 2 s below 10
    { speedKmh: 20, dtMs: 100 },  // spike → moving + reset
    { speedKmh: 8,  dtMs: 100 },  // only 100 ms → not stopped
  ]);
  expect("spike then dip does not unlock", state, "moving");
}

// Boundary values
console.log("\nBoundary values:");
{
  const r = nextMovingState("stopped", MOVING_KMH, null, T);
  expect("exactly MOVING_KMH is in band (not moving)", r.nextState, "stopped");
  expect("belowSince reset at boundary", r.nextBelowSince, null);

  const r2 = nextMovingState("moving", STOPPED_KMH, null, T);
  expect("exactly STOPPED_KMH is in band (not debounced)", r2.nextState, "moving");
  expect("belowSince reset at STOPPED_KMH boundary", r2.nextBelowSince, null);
}

// ---------------------------------------------------------------------------
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
