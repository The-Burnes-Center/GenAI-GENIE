export const DEFAULT_TIMEZONE = "America/New_York";

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Calendar date (yyyy-mm-dd) of an instant in a time zone. */
export function localDate(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const SEARCH_WINDOW_MS = 49 * 3_600_000; // longer than any local day, DST included

/** The next instant at which the local date changes (the next local midnight), rounded up to the second. */
export function nextMidnight(now: Date, tz: string): Date {
  const today = localDate(now, tz);
  let lo = now.getTime();
  let hi = lo + SEARCH_WINDOW_MS;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (localDate(new Date(mid), tz) === today) lo = mid;
    else hi = mid;
  }
  return new Date(Math.ceil(hi / 1000) * 1000);
}
