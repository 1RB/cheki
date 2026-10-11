/**
 * Time formatting shared by the verdict, recent checks, /status and
 * /endpoints. Pure: no React, no DOM, so it is unit tested directly and runs
 * the same on the server and in the browser.
 *
 * - Receipt times are Ethiopian bank times. A timestamp without an offset is
 *   read as Africa/Addis_Ababa (UTC+3 all year, no daylight saving), and the
 *   absolute form is always shown on that clock, wherever the reader is.
 * - The relative form uses Intl.RelativeTimeFormat, so a new locale only needs
 *   its "just now" string; units and plurals come from the platform.
 */

export const ADDIS_TZ = "Africa/Addis_Ababa";
const ADDIS_OFFSET_MS = 3 * 60 * 60 * 1000;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Past this age the relative form gives way to the date. */
export const RELATIVE_LIMIT_MS = 30 * DAY;
/** A time up to this far in the future (clock skew) still reads "just now". */
export const SKEW_MS = 5 * MINUTE;

export interface ParsedTime {
  date: Date;
  /** The source carried a date but no time of day. */
  dateOnly: boolean;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Wall-clock fields on the Addis clock to a Date. */
function addis(y: number, mo: number, d: number, h = 0, mi = 0, s = 0): Date | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, s) - ADDIS_OFFSET_MS);
  // Reject 31 Feb and friends: the fields must survive the round trip.
  const back = new Date(date.getTime() + ADDIS_OFFSET_MS);
  if (back.getUTCDate() !== d || back.getUTCMonth() !== mo - 1) return null;
  return date;
}

function hour12(h: number, ampm: string | undefined): number {
  if (!ampm) return h;
  const pm = /p/i.test(ampm);
  if (h === 12) return pm ? 12 : 0;
  return pm ? h + 12 : h;
}

/**
 * Reads the timestamp shapes cheki's parsers return:
 *   ISO 8601 (with or without an offset)        2026-10-11T14:32:00+03:00
 *   date and time                               2026-06-07 11:22:03
 *   day-first, dashes (Telebirr)                11-10-2026 14:32:05
 *   slashes, day- or month-first (BOA, CBE PDF) 16/06/2026 20:29:42, 5/20/2026 7:29:00 PM
 *   month name (Dashen)                         Jun 11, 2026, 08:45:50 am
 *   a bare date                                 2026-06-22
 * Anything else returns null and is shown as the bank wrote it.
 */
export function parseTimestamp(raw: string | Date | number | null | undefined): ParsedTime | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : { date: raw, dateOnly: false };
  if (typeof raw === "number") return Number.isFinite(raw) ? { date: new Date(raw), dateOnly: false } : null;
  const s = String(raw).trim().replace(/\s+/g, " ");
  if (s.length > 64) return null;

  // ISO with an explicit zone: the platform parser is exact.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : { date: d, dateOnly: false };
  }
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?$/.exec(s);
  if (m) {
    const d = addis(+m[1], +m[2], +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0, m[6] ? +m[6] : 0);
    return d ? { date: d, dateOnly: !m[4] } : null;
  }
  m = /^(\d{1,2})([/-])(\d{1,2})\2(\d{4}),? ?(?:(\d{1,2}):(\d{2})(?::(\d{2}))? ?([ap]\.?m\.?)?)?$/i.exec(s);
  if (m) {
    let a = +m[1];
    let b = +m[3];
    // Ethiopian banks write day-first, except CBE's PDF (month-first, with
    // AM/PM). A part above 12 settles it; otherwise AM/PM means month-first.
    let day: number;
    let month: number;
    if (a > 12) [day, month] = [a, b];
    else if (b > 12) [month, day] = [a, b];
    else if (m[8] && m[2] === "/") [month, day] = [a, b];
    else [day, month] = [a, b];
    a = day;
    b = month;
    const h = m[5] ? hour12(+m[5], m[8]) : 0;
    const d = addis(+m[4], b, a, h, m[6] ? +m[6] : 0, m[7] ? +m[7] : 0);
    return d ? { date: d, dateOnly: !m[5] } : null;
  }
  m = /^([a-z]{3})[a-z]* (\d{1,2}),? (\d{4})(?:,? (\d{1,2}):(\d{2})(?::(\d{2}))? ?([ap]\.?m\.?)?)?$/i.exec(s);
  if (m) {
    const mo = MONTHS.indexOf(m[1].toLowerCase()) + 1;
    if (mo === 0) return null;
    const h = m[4] ? hour12(+m[4], m[7]) : 0;
    const d = addis(+m[3], mo, +m[2], h, m[5] ? +m[5] : 0, m[6] ? +m[6] : 0);
    return d ? { date: d, dateOnly: !m[4] } : null;
  }
  return null;
}

/** BCP 47 tag for a cheki locale ("en" reads day-first, like the banks). */
export function intlLocale(locale: string): string {
  return locale === "am" ? "am-ET" : "en-GB";
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(locale: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = locale + JSON.stringify(opts);
  let f = dtfCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: ADDIS_TZ, ...opts });
    dtfCache.set(key, f);
  }
  return f;
}

/** "11 Oct 2026, 14:32" on the Addis clock (the date alone for a date-only value). */
export function formatAbsolute(t: ParsedTime, locale = "en"): string {
  return t.dateOnly
    ? dtf(locale, { day: "numeric", month: "short", year: "numeric" }).format(t.date)
    : dtf(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(t.date);
}

/** The full timestamp for a title tooltip: "Sunday, 11 October 2026 at 14:32 (Addis Ababa time)". */
export function formatFull(t: ParsedTime, locale = "en", zoneLabel = "Addis Ababa time"): string {
  const s = t.dateOnly
    ? dtf(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(t.date)
    : dtf(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(t.date);
  return t.dateOnly ? s : `${s} (${zoneLabel})`;
}

/** Machine-readable value for <time datetime>. */
export function isoValue(t: ParsedTime): string {
  if (!t.dateOnly) return t.date.toISOString();
  const local = new Date(t.date.getTime() + ADDIS_OFFSET_MS);
  return local.toISOString().slice(0, 10);
}

const rtfCache = new Map<string, Intl.RelativeTimeFormat>();
function rtf(locale: string): Intl.RelativeTimeFormat {
  let f = rtfCache.get(locale);
  if (!f) {
    f = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto", style: "long" });
    rtfCache.set(locale, f);
  }
  return f;
}

/** Calendar-day index on the Addis clock, for "today" / "yesterday". */
function addisDay(ms: number): number {
  return Math.floor((ms + ADDIS_OFFSET_MS) / DAY);
}

export interface RelativeOptions {
  locale?: string;
  /** The translated "just now". */
  justNow?: string;
  /** Past this age, return null so the caller shows the date instead. */
  limitMs?: number;
}

/**
 * "just now", "3 min ago", "3 hours ago", "yesterday", "12 days ago", or
 * null when the time is older than the limit (show the date instead) or more
 * than a few minutes in the future (a receipt dated ahead is not "just now").
 */
export function formatRelative(t: ParsedTime, now: number, opts: RelativeOptions = {}): string | null {
  const locale = opts.locale ?? "en";
  const justNow = opts.justNow ?? "just now";
  const limit = opts.limitMs ?? RELATIVE_LIMIT_MS;
  const diff = now - t.date.getTime();
  if (diff < -SKEW_MS) return null;
  if (diff > limit) return null;
  const f = rtf(locale);
  if (t.dateOnly) {
    const days = addisDay(now) - addisDay(t.date.getTime());
    return f.format(-Math.max(0, days), "day");
  }
  if (diff < MINUTE) return justNow;
  if (diff < HOUR) return f.format(-Math.floor(diff / MINUTE), "minute");
  if (diff < DAY) return f.format(-Math.floor(diff / HOUR), "hour");
  return f.format(-Math.floor(diff / DAY), "day");
}

/** Whole days, for "Receipt is 3 days old" (Intl unit formatting: "3 days", "1 day"). */
export function formatAgeDays(t: ParsedTime, now: number, locale = "en"): string | null {
  let days: number;
  if (t.dateOnly) {
    // A bare date could be 23:59 yesterday: only a two-day gap is certain.
    days = addisDay(now) - addisDay(t.date.getTime());
    if (days < 2) return null;
  } else {
    const diff = now - t.date.getTime();
    if (diff < DAY) return null;
    days = Math.floor(diff / DAY);
  }
  return new Intl.NumberFormat(intlLocale(locale), { style: "unit", unit: "day", unitDisplay: "long" }).format(days);
}

export function ageMs(t: ParsedTime, now: number): number {
  return now - t.date.getTime();
}
