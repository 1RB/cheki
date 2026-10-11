/**
 * "Recent checks": receipts this device has seen confirmed by a bank.
 *
 * - Only verificationState() === "verified" results are saved. An unconfirmed
 *   result saved here would read later as a past successful check.
 * - No names are stored: shop devices are shared. An entry is the bank, the
 *   reference, the amount and when it was checked.
 * - Everything read back is re-validated, so a hand-edited or old-format entry
 *   cannot inject names or odd values into the page.
 *
 * The old `cheki_history` key held sender and receiver names. It is migrated
 * once (names dropped) and removed.
 */
import { verificationState, type VerifyResult } from "@/lib/banks";

export interface RecentCheck {
  bank: string;
  ref: string;
  amount?: number;
  currency?: string;
  /** ISO timestamp of the check. */
  checkedAt: string;
}

export const HISTORY_KEY = "cheki_recent_v2";
export const LEGACY_HISTORY_KEY = "cheki_history";
export const HISTORY_LIMIT = 8;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function store(): Store | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function clean(raw: unknown): RecentCheck | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const ref = typeof r.ref === "string" ? r.ref.trim().slice(0, 200) : "";
  const bank = typeof r.bank === "string" ? r.bank.trim().slice(0, 40) : "";
  const when = typeof r.checkedAt === "string" ? r.checkedAt : typeof r.date === "string" ? r.date : "";
  if (!ref || !bank || Number.isNaN(Date.parse(when))) return null;
  const out: RecentCheck = { bank, ref, checkedAt: new Date(when).toISOString() };
  if (typeof r.amount === "number" && Number.isFinite(r.amount)) out.amount = r.amount;
  if (typeof r.currency === "string" && /^[A-Z]{3}$/.test(r.currency)) out.currency = r.currency;
  return out;
}

function parse(json: string | null): RecentCheck[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.map(clean).filter((x): x is RecentCheck => x !== null).slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

function write(list: RecentCheck[], s: Store | null = store()): RecentCheck[] {
  try {
    s?.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked: the list still works for this page view */
  }
  return list;
}

export function loadRecent(s: Store | null = store()): RecentCheck[] {
  if (!s) return [];
  try {
    const legacy = s.getItem(LEGACY_HISTORY_KEY);
    if (legacy !== null) {
      // clean() keeps only bank/ref/amount/currency/date: names are dropped.
      const merged = dedupe([...parse(s.getItem(HISTORY_KEY)), ...parse(legacy)]);
      s.removeItem(LEGACY_HISTORY_KEY);
      return write(merged, s);
    }
    return parse(s.getItem(HISTORY_KEY));
  } catch {
    return [];
  }
}

function key(c: Pick<RecentCheck, "bank" | "ref">): string {
  return `${c.bank}:${c.ref.toUpperCase()}`;
}

function dedupe(list: RecentCheck[]): RecentCheck[] {
  const seen = new Set<string>();
  return list.filter((c) => (seen.has(key(c)) ? false : (seen.add(key(c)), true))).slice(0, HISTORY_LIMIT);
}

/** The earlier check of the same receipt on this device, if any. */
export function findPrevious(list: RecentCheck[], bank: string, ref: string): RecentCheck | undefined {
  return list.find((c) => key(c) === key({ bank, ref }));
}

/**
 * Save a result. Anything but a bank-confirmed result leaves the list as it
 * was. `ref` is what the user entered (the link or reference they will paste
 * again); the bank's own reference is used when the input was empty.
 */
export function addVerified(
  list: RecentCheck[],
  result: VerifyResult,
  input: { bank: string; ref: string },
  now: Date = new Date(),
  s: Store | null = store()
): RecentCheck[] {
  if (verificationState(result) !== "verified") return list;
  const ref = (input.ref || result.reference || "").trim();
  if (!ref) return list;
  const entry: RecentCheck = { bank: input.bank, ref: ref.slice(0, 200), checkedAt: now.toISOString() };
  if (typeof result.amount === "number" && Number.isFinite(result.amount)) entry.amount = result.amount;
  if (typeof result.currency === "string" && /^[A-Z]{3}$/.test(result.currency)) entry.currency = result.currency;
  return write(dedupe([entry, ...list.filter((c) => key(c) !== key(entry))]), s);
}

export function removeRecent(list: RecentCheck[], target: Pick<RecentCheck, "bank" | "ref">, s: Store | null = store()): RecentCheck[] {
  return write(list.filter((c) => key(c) !== key(target)), s);
}

export function clearRecent(s: Store | null = store()): RecentCheck[] {
  try {
    s?.removeItem(HISTORY_KEY);
    s?.removeItem(LEGACY_HISTORY_KEY);
  } catch {
    /* ignore */
  }
  return [];
}
