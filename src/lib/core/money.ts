/**
 * Shared money parsing.
 *
 * Banks print amounts as "1,250.00", "ETB 1,200.00", "500ETB" or a bare JSON
 * number. Taking every digit in the cell (the old `replace(/[^0-9.]/g, "")`)
 * merges unrelated numbers ("1,200.00 + 2.50 fee" became 1200.002), and a bare
 * `parseFloat("1,250.00")` stops at the comma and returns 1.
 *
 * The pattern is bounded on purpose: an unbounded `[\d,]+\.?\d*` backtracks
 * cubically on long digit runs (ReDoS). 30 digits/commas is far beyond any real
 * receipt amount.
 */
const MONEY_RE = /\d[\d,]{0,30}(?:\.\d{1,2})?/;

/** First money-looking number in `raw`, or undefined when there is none. */
export function parseMoney(raw: unknown): number | undefined {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw !== "string") return undefined;
  const m = raw.slice(0, 200).match(MONEY_RE);
  if (!m) return undefined;
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Bounded "<amount> Birr|ETB" matcher used by the Telebirr parser and anything
 * else that reads an amount next to its currency word.
 */
export const BIRR_AMOUNT_RE = /(\d[\d,]{0,30}(?:\.\d{1,2})?)\s*(?:Birr|ETB)/i;

export function birrAmountIn(line: string): number | undefined {
  const m = line.match(BIRR_AMOUNT_RE);
  if (!m) return undefined;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}
