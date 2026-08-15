/**
 * Feature flags — the single switchboard for optional product surfaces.
 *
 * Product direction (owner decision): live entertainment first. Go Live and
 * the discovery feed are the stars; booking a ride is the one obvious action;
 * everything else is long tail. The long tail is HIDDEN by default — flipped
 * off here, not deleted. Backend routes, screens, and data all remain intact,
 * so re-enabling a feature is a one-line change.
 *
 * Rules:
 * - Every optional feature surface must check its flag at the ENTRY POINT
 *   (tab, card, button, menu row, banner) — screens stay registered in the
 *   navigators so old deep links and in-flight flows never crash.
 * - New optional features must add a flag here and default to `false` until
 *   the owner promotes them.
 */
export const FEATURES = {
  // ── Core (always on — listed for documentation, do not turn off) ─────────
  /** TikTok-style discovery feed, Agora live streaming, social layer. */
  live: true,
  /** Ride booking (assistant + map flows) and active-ride tracking. */
  rides: true,

  // ── Long tail (hidden by default) ────────────────────────────────────────
  /** Rider coffee ordering + driver coffee order queue. */
  coffee: false,
  /** Network hubs discovery (OpenClaw), hub detail, proximity check-ins. */
  networkHubs: false,
  /** EV surfaces: rider EV banner, EV mode in booking, driver "My EV". */
  ev: false,
  /** Free prayer rides subscription surfaces. */
  prayerRides: false,
  /** On-Time Arrivals (deadline ride scheduling). */
  onTimeArrivals: false,
  /** Shared/pooled tuk-tuk rides ("Share & save" in the booking sheet). */
  pooling: false,
  /** Name Your Fare rider bidding. */
  namedFare: false,
  /** Crypto/USDT surfaces: crypto payment option, crypto yield cards. */
  crypto: false,
  /** Car Ladder savings program card in the assistant. */
  carLadder: false,
} as const;

export type FeatureKey = keyof typeof FEATURES;

/** Entry-point guard. Usage: `if (!featureEnabled("coffee")) return null;` */
export function featureEnabled(key: FeatureKey): boolean {
  return FEATURES[key];
}
