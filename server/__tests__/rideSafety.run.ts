/**
 * Ride safety layer tests.
 * Run: AI_INTEGRATIONS_OPENAI_API_KEY= npx tsx server/__tests__/rideSafety.run.ts
 * (blank AI key so report generation uses the template path, no network)
 *
 * Covers the three correctness-critical pieces:
 * 1. LLM honesty guard — quantity-free contract: ANY digit or spelled-out
 *    quantity rejects (no attribution puzzles), ungrounded event-category
 *    claims reject, money/duration vocab rejects.
 * 2. Pending-write drain primitive.
 * 3. DB concurrency: an event insert racing report finalization must either
 *    be included in the report's facts or refused entirely — never a row in
 *    the events table missing from the immutable report. (Needs DATABASE_URL;
 *    skipped otherwise.)
 */
import {
  safetySummaryPassesGuard,
  trackSafetyWrite,
  drainSafetyWrites,
  insertSafetyEvent,
  generateSafetyReport,
  reconcileSafetyReports,
  fleetSafetyReports,
} from "../rideSafety";

let pass = 0;
let fail = 0;
function check(name: string, got: boolean, want: boolean) {
  if (got === want) {
    pass++;
  } else {
    fail++;
    console.error(`  FAIL: ${name} (got ${got}, want ${want})`);
  }
}

console.log("\nrideSafety — honesty guard (quantity-free contract)\n");

const flaggedFacts = {
  harshBrakes: 1,
  harshAccels: 0,
  streamDrops: 0,
  lockouts: 1,
  bookmarks: 2,
  streamedMinutes: 6,
};
const calmFacts = {
  harshBrakes: 0,
  harshAccels: 0,
  streamDrops: 0,
  lockouts: 0,
  bookmarks: 0,
  streamedMinutes: 5,
};

// Grounded, quantity-free summaries pass.
check(
  "grounded flagged summary passes",
  safetySummaryPassesGuard(
    "Flagged for review: sharp braking was detected while streaming, and controls auto-locked while the vehicle was moving. Moments were bookmarked for the fleet owner.",
    flaggedFacts,
  ),
  true,
);
check(
  "grounded calm summary passes",
  safetySummaryPassesGuard("The streamed ride completed calmly with no safety concerns detected.", calmFacts),
  true,
);

// ANY digit rejects — even one matching a real fact count.
check(
  "digit matching a real count still rejected",
  safetySummaryPassesGuard("There was 1 sharp braking moment during the ride.", flaggedFacts),
  false,
);
check(
  "invented digit count rejected",
  safetySummaryPassesGuard("There were 3 sharp braking moments during the ride.", flaggedFacts),
  false,
);
// Spelled-out quantities reject regardless of position or attribution.
check(
  "prefix number word rejected ('two sharp braking moments')",
  safetySummaryPassesGuard("There were two sharp braking moments during the ride.", flaggedFacts),
  false,
);
check(
  "postfix quantity rejected ('braking occurred twice')",
  safetySummaryPassesGuard("Sharp braking occurred twice during the ride.", flaggedFacts),
  false,
);
check(
  "multi-mention with fabricated second quantity rejected",
  safetySummaryPassesGuard(
    "Sharp braking was flagged early on, and braking was later observed a couple more times.",
    flaggedFacts,
  ),
  false,
);
check(
  "number word grounded by ANOTHER fact still rejected",
  // "two" equals bookmarks=2 but is attached to braking — quantity-free
  // contract rejects it without needing attribution.
  safetySummaryPassesGuard("Two braking events were recorded alongside bookmarked moments.", flaggedFacts),
  false,
);
check(
  "'several' rejected",
  safetySummaryPassesGuard("Several sharp braking moments were detected.", flaggedFacts),
  false,
);
check(
  "'repeatedly' rejected",
  safetySummaryPassesGuard("The vehicle braked repeatedly during the trip.", flaggedFacts),
  false,
);
check(
  "'single' rejected",
  safetySummaryPassesGuard("A single sharp braking moment was flagged.", flaggedFacts),
  false,
);
// Ungrounded category claims (event never happened).
check(
  "braking claim with zero brakes rejected",
  safetySummaryPassesGuard("Some sharp braking was observed during the ride.", calmFacts),
  false,
);
check(
  "acceleration claim with zero accels rejected",
  safetySummaryPassesGuard("A sharp acceleration was flagged for review.", flaggedFacts),
  false,
);
check(
  "stream-drop claim with zero drops rejected",
  safetySummaryPassesGuard("The stream dropped while the vehicle was moving.", flaggedFacts),
  false,
);
check(
  "bookmark claim with zero bookmarks rejected",
  safetySummaryPassesGuard("A moment was bookmarked by the rider.", calmFacts),
  false,
);
// Money vocabulary.
check(
  "money vocab rejected",
  safetySummaryPassesGuard("Calm ride; the driver earned a smooth trip.", calmFacts),
  false,
);
// Durations are template-only.
check("minutes rejected", safetySummaryPassesGuard("A calm ride across minutes of streaming.", calmFacts), false);
check("hours rejected", safetySummaryPassesGuard("A calm ride over an hour of streaming.", calmFacts), false);
// Length cap.
check("overlong summary rejected", safetySummaryPassesGuard("x".repeat(241), calmFacts), false);
check("empty summary rejected", safetySummaryPassesGuard("", calmFacts), false);

console.log("\nrideSafety — pending-write drain\n");

async function drainTests() {
  const rideId = "test-ride-drain";
  let settled = false;
  const slowWrite = new Promise<void>((resolve) =>
    setTimeout(() => {
      settled = true;
      resolve();
    }, 150),
  );
  trackSafetyWrite(rideId, slowWrite);
  check("write not settled before drain", settled, false);
  await drainSafetyWrites(rideId);
  check("drain waits for in-flight write", settled, true);

  const badWrite = new Promise<void>((_, reject) => setTimeout(() => reject(new Error("boom")), 50));
  trackSafetyWrite(rideId, badWrite).catch(() => {});
  await drainSafetyWrites(rideId);
  check("drain survives a rejected write", true, true);

  await drainSafetyWrites("ride-with-no-writes");
  check("drain no-ops when nothing pending", true, true);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Race an event insert against report finalization, repeatedly, and assert
 * the invariant: events table contents === report facts, always. */
async function concurrencyTests() {
  if (!process.env.DATABASE_URL) {
    console.log("\nrideSafety — DB concurrency: SKIPPED (no DATABASE_URL)\n");
    return null;
  }
  console.log("\nrideSafety — DB concurrency (insert vs finalization race)\n");
  const { db, pool } = await import("../db");
  const { sql } = await import("drizzle-orm");

  const [user] = (await db.execute(sql`SELECT id FROM users LIMIT 1`)).rows as Array<{ id: string }>;
  if (!user) {
    console.log("  SKIPPED (no users in DB)");
    return pool;
  }
  const rideId = ((await db.execute(sql`SELECT gen_random_uuid() AS id`)).rows[0] as { id: string }).id;
  const postId = ((await db.execute(sql`SELECT gen_random_uuid() AS id`)).rows[0] as { id: string }).id;
  await db.execute(sql`
    INSERT INTO rides (id, customer_id, status, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, started_at, completed_at)
    VALUES (${rideId}, ${user.id}, 'completed', 'Safety race test', 25.2, 55.27, 'Test dropoff', 25.25, 55.36, now() - interval '10 min', now())
  `);
  await db.execute(sql`
    INSERT INTO ride_posts (id, user_id, ride_id, type, stream_provider, is_live, ended_at, created_at)
    VALUES (${postId}, ${user.id}, ${rideId}, 'stream', 'agora', false, now(), now() - interval '5 min')
  `);

  try {
    const ROUNDS = 10;
    for (let i = 0; i < ROUNDS; i++) {
      await db.execute(sql`DELETE FROM ride_safety_events WHERE ride_id = ${rideId}`);
      await db.execute(sql`DELETE FROM ride_safety_reports WHERE ride_id = ${rideId}`);

      const [insertedRes] = await Promise.all([
        (async () => {
          await sleep(Math.floor(Math.random() * 25));
          return insertSafetyEvent({
            rideId,
            postId,
            kind: "bookmark",
            severity: "notice",
            streamOffsetSec: 60,
            createdBy: user.id,
          } as any);
        })(),
        (async () => {
          await sleep(Math.floor(Math.random() * 25));
          return generateSafetyReport(rideId);
        })(),
      ]);

      const evCount = Number(
        ((await db.execute(sql`SELECT count(*)::int AS n FROM ride_safety_events WHERE ride_id = ${rideId}`)).rows[0] as any).n,
      );
      const report = (await db.execute(sql`SELECT bookmark_count FROM ride_safety_reports WHERE ride_id = ${rideId}`))
        .rows[0] as any;

      check(`round ${i}: report exists`, !!report, true);
      // THE invariant: a row in the events table is in the report, a refused
      // insert leaves no row. Never a row the immutable report missed.
      check(
        `round ${i}: report facts match events table (inserted=${insertedRes}, rows=${evCount})`,
        report ? Number(report.bookmark_count) === evCount : false,
        true,
      );
      check(`round ${i}: insert result matches row presence`, insertedRes === (evCount === 1), true);
    }
    // --- Restart-loss reconciliation: the completed streamed ride above has
    // no report and NOTHING scheduled (simulating a process restart that
    // killed the setTimeout retry chain). Durable reconciliation must create
    // the report and the fleet listing must expose it.
    await db.execute(sql`DELETE FROM ride_safety_events WHERE ride_id = ${rideId}`);
    await db.execute(sql`DELETE FROM ride_safety_reports WHERE ride_id = ${rideId}`);
    const createdCount = await reconcileSafetyReports();
    const recRep = (await db.execute(sql`SELECT status, summary_source FROM ride_safety_reports WHERE ride_id = ${rideId}`))
      .rows[0] as any;
    check("reconcile creates report for orphaned completed streamed ride", !!recRep, true);
    check("reconcile counted the creation", createdCount >= 1, true);
    check("reconciled report is calm + template", recRep?.status === "calm" && recRep?.summary_source === "template", true);
    const fleetRows = await fleetSafetyReports(null, 200);
    check(
      "fleet listing exposes reconciled report (admin scope)",
      fleetRows.some((r: any) => (r.rideId ?? r.ride_id) === rideId),
      true,
    );
    // Idempotent: a second sweep creates nothing for this ride.
    const again = await reconcileSafetyReports();
    const repCount = Number(
      ((await db.execute(sql`SELECT count(*)::int AS n FROM ride_safety_reports WHERE ride_id = ${rideId}`)).rows[0] as any).n,
    );
    check(`reconcile is idempotent (second sweep, report rows=${repCount})`, repCount === 1 && again >= 0, true);

    // --- Lost teardown: stream row still open. Recently-completed → decline.
    // Old completion → durably CLOSE the stale post first, then finalize
    // (never snapshot while a stream row is open).
    await db.execute(sql`DELETE FROM ride_safety_reports WHERE ride_id = ${rideId}`);
    await db.execute(sql`UPDATE ride_posts SET is_live = true, ended_at = NULL WHERE id = ${postId}`);
    await db.execute(sql`UPDATE rides SET completed_at = now() WHERE id = ${rideId}`);
    const early = await generateSafetyReport(rideId);
    check("no finalization while stream open and completion recent", early === null, true);
    await db.execute(sql`UPDATE rides SET completed_at = now() - interval '5 min' WHERE id = ${rideId}`);
    const late = await generateSafetyReport(rideId);
    const closedPost = (await db.execute(sql`SELECT is_live, ended_at FROM ride_posts WHERE id = ${postId}`)).rows[0] as any;
    check("stale stream durably closed before finalization", !!late && closedPost.is_live === false && closedPost.ended_at !== null, true);
  } finally {
    await db.execute(sql`DELETE FROM ride_safety_events WHERE ride_id = ${rideId}`);
    await db.execute(sql`DELETE FROM ride_safety_reports WHERE ride_id = ${rideId}`);
    await db.execute(sql`DELETE FROM ride_posts WHERE id = ${postId}`);
    await db.execute(sql`DELETE FROM rides WHERE id = ${rideId}`);
  }
  return pool;
}

drainTests()
  .then(() => concurrencyTests())
  .then(async (pool) => {
    console.log(`\n${pass} passed, ${fail} failed\n`);
    if (pool) await (pool as any).end().catch(() => {});
    process.exit(fail > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error("test run crashed:", err);
    process.exit(1);
  });
