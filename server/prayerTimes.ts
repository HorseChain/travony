// Prayer times via the free Aladhan public API (no key required).
// Timings are requested with iso8601=true so every prayer comes back as an
// absolute timestamp with the location's own UTC offset — no timezone math on
// our side. Responses are cached per rounded-coordinate cell per day so a whole
// city shares one fetch a day.

export type PrayerName = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

export const PRAYER_NAMES: PrayerName[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

export interface DayPrayerTimes {
  dayKey: string; // YYYY-MM-DD (local date at the location)
  times: Record<PrayerName, Date>;
  isFriday: boolean;
  tzOffsetMinutes: number; // location's UTC offset, from the API's ISO timings
}

interface CacheEntry {
  value: DayPrayerTimes;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cellKey(lat: number, lng: number, dayOffset: number): string {
  // ~11km cells — one fetch per city per day.
  return `${lat.toFixed(1)},${lng.toFixed(1)}:${dayOffset}:${new Date().toISOString().slice(0, 10)}`;
}

const API_TIMINGS: Record<PrayerName, string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

async function fetchDay(lat: number, lng: number, when: Date): Promise<DayPrayerTimes> {
  const ts = Math.floor(when.getTime() / 1000);
  const url = `https://api.aladhan.com/v1/timings/${ts}?latitude=${lat}&longitude=${lng}&method=4&iso8601=true`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Aladhan API error: ${res.status}`);
  const json: any = await res.json();
  const timings = json?.data?.timings;
  if (!timings) throw new Error("Aladhan API returned no timings");

  const times = {} as Record<PrayerName, Date>;
  let tzOffsetMinutes = 0;
  for (const p of PRAYER_NAMES) {
    const iso = timings[API_TIMINGS[p]];
    const d = new Date(iso);
    if (isNaN(d.getTime())) throw new Error(`Aladhan API bad timing for ${p}: ${iso}`);
    times[p] = d;
    const m = String(iso).match(/([+-])(\d{2}):(\d{2})$/);
    if (m) {
      const sign = m[1] === "-" ? -1 : 1;
      tzOffsetMinutes = sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
    }
  }

  // Local date + weekday at the mosque, from the API's own response.
  const greg = json?.data?.date?.gregorian;
  const dmy = String(greg?.date || ""); // DD-MM-YYYY
  const [dd, mm, yyyy] = dmy.split("-");
  const dayKey = yyyy && mm && dd ? `${yyyy}-${mm}-${dd}` : times.fajr.toISOString().slice(0, 10);
  const isFriday = String(greg?.weekday?.en || "").toLowerCase() === "friday";

  return { dayKey, times, isFriday, tzOffsetMinutes };
}

/**
 * Prayer times for the day containing `now` plus the following day at the
 * given coordinates. Cached per ~city per day.
 */
export async function getPrayerTimesAround(lat: number, lng: number, now = new Date()): Promise<DayPrayerTimes[]> {
  const days: DayPrayerTimes[] = [];
  for (const offset of [0, 1]) {
    const key = cellKey(lat, lng, offset);
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      days.push(hit.value);
      continue;
    }
    const when = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    const value = await fetchDay(lat, lng, when);
    cache.set(key, { value, expiresAt: Date.now() + 6 * 60 * 60 * 1000 });
    // Opportunistic cleanup so the map never grows unbounded.
    if (cache.size > 500) {
      for (const [k, v] of cache) {
        if (v.expiresAt <= Date.now()) cache.delete(k);
      }
    }
    days.push(value);
  }
  return days;
}
