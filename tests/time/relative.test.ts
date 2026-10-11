/**
 * Relative and absolute time: the formatter behind the verdict date, "Checked
 * 2 min ago", recent checks, /status and the /endpoints changelog.
 */
import { describe, it, expect } from "vitest";
import {
  formatAbsolute, formatAgeDays, formatFull, formatRelative, isoValue, parseTimestamp, RELATIVE_LIMIT_MS,
} from "@/lib/time/relative";
import { receiptAgeCheck } from "@/lib/verify/verdict";

const iso = (s: string) => parseTimestamp(s)!.date.toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("parseTimestamp: every shape the parsers return", () => {
  it.each([
    ["2026-10-11T14:32:00+03:00", "2026-10-11T11:32:00.000Z"],
    ["2026-10-11T11:32:00Z", "2026-10-11T11:32:00.000Z"],
    // No offset: the bank's clock, Addis Ababa (UTC+3).
    ["2026-06-07 11:22:03", "2026-06-07T08:22:03.000Z"],
    ["2026-10-01 14:05", "2026-10-01T11:05:00.000Z"],
    // Telebirr: day-first with dashes.
    ["11-10-2026 14:32:05", "2026-10-11T11:32:05.000Z"],
    // BOA: day-first with slashes (and a double space).
    ["16/06/2026  20:29:42", "2026-06-16T17:29:42.000Z"],
    // CBE PDF: month-first with AM/PM.
    ["5/20/2026 7:29:00 PM", "2026-05-20T16:29:00.000Z"],
    ["5/6/2026, 7:29:00 AM", "2026-05-06T04:29:00.000Z"],
    // Dashen: month name.
    ["Jun 11, 2026, 08:45:50 am", "2026-06-11T05:45:50.000Z"],
    ["Jul 9, 2026, 10:25:33 pm", "2026-07-09T19:25:33.000Z"],
    ["Jul 9, 2026, 12:05:00 am", "2026-07-08T21:05:00.000Z"],
  ])("%s", (raw, expected) => {
    expect(iso(raw)).toBe(expected);
  });

  it("a bare date is date-only, on the Addis calendar", () => {
    const p = parseTimestamp("2026-06-22")!;
    expect(p.dateOnly).toBe(true);
    expect(isoValue(p)).toBe("2026-06-22");
  });

  it.each(["", "yesterday", "32/01/2026", "2026-02-30", "13/13/2026 10:00", "x".repeat(80), "Foo 1, 2026"])("%j is not a timestamp", (raw) => {
    expect(parseTimestamp(raw)).toBeNull();
  });

  it("accepts Dates and epoch ms, rejects invalid ones", () => {
    expect(parseTimestamp(new Date(0))?.date.getTime()).toBe(0);
    expect(parseTimestamp(5)?.date.getTime()).toBe(5);
    expect(parseTimestamp(new Date("nope"))).toBeNull();
    expect(parseTimestamp(null)).toBeNull();
  });
});

describe("formatAbsolute / formatFull: always the Addis Ababa clock", () => {
  const p = parseTimestamp("2026-10-11T11:32:00Z")!;
  it("reads day-first with a 24-hour time", () => {
    expect(formatAbsolute(p)).toBe("11 Oct 2026, 14:32");
  });
  it("the title names the zone", () => {
    expect(formatFull(p)).toMatch(/^Sunday,? 11 October 2026/);
    expect(formatFull(p)).toMatch(/14:32 \(Addis Ababa time\)$/);
  });
  it("is Amharic-ready", () => {
    const am = formatAbsolute(p, "am");
    expect(am).toMatch(/2026/);
    expect(am).not.toBe(formatAbsolute(p, "en"));
  });
  it("a date-only value has no time", () => {
    expect(formatAbsolute(parseTimestamp("2026-06-22")!)).toBe("22 Jun 2026");
  });
});

describe("formatRelative", () => {
  const t = parseTimestamp("2026-10-11T11:32:00Z")!;
  const at = (ms: number) => formatRelative(t, t.date.getTime() + ms);

  it.each([
    [0, "just now"],
    [59_000, "just now"],
    [MIN, "1 minute ago"],
    [2 * MIN + 30_000, "2 minutes ago"],
    [3 * HOUR, "3 hours ago"],
    [DAY + HOUR, "yesterday"],
    [3 * DAY, "3 days ago"],
    [29 * DAY, "29 days ago"],
  ])("%d ms later reads %s", (ms, text) => {
    expect(at(ms)).toBe(text);
  });

  it("clock skew of a few minutes is still just now", () => {
    expect(at(-2 * MIN)).toBe("just now");
  });

  it("a time well in the future gets no relative part (the date stands alone)", () => {
    expect(at(-2 * HOUR)).toBeNull();
  });

  it("past 30 days it switches to the date", () => {
    expect(at(RELATIVE_LIMIT_MS + MIN)).toBeNull();
  });

  it("date-only values count calendar days on the Addis clock", () => {
    const d = parseTimestamp("2026-10-10")!;
    // 23:00 Addis on the 10th is still "today"; 01:00 Addis on the 11th is "yesterday".
    expect(formatRelative(d, Date.parse("2026-10-10T20:00:00Z"))).toBe("today");
    expect(formatRelative(d, Date.parse("2026-10-10T22:00:00Z"))).toBe("yesterday");
  });

  it("uses the locale's own words and a translated just now", () => {
    expect(formatRelative(t, t.date.getTime() + 3 * HOUR, { locale: "am" })).not.toBe("3 hours ago");
    expect(formatRelative(t, t.date.getTime(), { locale: "am", justNow: "አሁን" })).toBe("አሁን");
  });
});

describe("receipt age: a soft, neutral signal", () => {
  const checked = new Date("2026-10-11T11:32:00Z");

  it("under a day says nothing", () => {
    expect(formatAgeDays(parseTimestamp("2026-10-10T12:00:00Z")!, checked.getTime())).toBeNull();
    expect(receiptAgeCheck("2026-10-11T08:00:00Z", checked)).toBeNull();
  });

  it("older than a day is a neutral note, never a mismatch", () => {
    const c = receiptAgeCheck("08-10-2026 09:00:00", checked)!;
    expect(c.state).toBe("info");
    expect(c.label).toBe("Receipt is 3 days old");
  });

  it("a bare date needs two calendar days (it could be 23:59 yesterday)", () => {
    expect(receiptAgeCheck("2026-10-10", checked)).toBeNull();
    expect(receiptAgeCheck("2026-10-09", checked)?.label).toBe("Receipt is 2 days old");
  });

  it("an unreadable date is not guessed at", () => {
    expect(receiptAgeCheck("sometime last week", checked)).toBeNull();
    expect(receiptAgeCheck(undefined, checked)).toBeNull();
  });
});
