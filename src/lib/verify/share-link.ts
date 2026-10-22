/**
 * Re-check links. A shared result is only as good as its source: text that
 * says "verified by cheki" can be typed by anyone, exactly like an edited
 * screenshot. So the share carries a link instead, holding only what was
 * entered (the receipt link or reference, the bank, and the account digits or
 * phone the bank asks for). Opening it runs the check again with the bank, in
 * the recipient's browser. Nothing is stored anywhere, and there is no result
 * in the link to forge.
 *
 * The values ride in the URL fragment (#), which browsers never send to a
 * server: they stay out of server logs, analytics and Referer headers, and
 * search engines do not index fragments, so shared links cannot create
 * duplicate pages.
 */
import { liveBanks } from "./detect";

export interface ShareInput {
  /** What the user entered: a receipt link, a reference or a BOA QR payload. */
  input: string;
  /** Bank code; omitted when the input names its bank (a receipt link). */
  bank?: string;
  /** Account digits or phone number the bank needs, if any. */
  extra?: string;
}

/** Long enough for every receipt link and BOA QR payload we accept. */
const MAX_INPUT = 1024;
const MAX_EXTRA = 32;

const LIVE_CODES = new Set(liveBanks.map((b) => b.code));

export function buildShareLink(s: ShareInput, origin = "https://cheki.et"): string {
  const params = new URLSearchParams();
  params.set("r", s.input.trim());
  if (s.bank && LIVE_CODES.has(s.bank)) params.set("b", s.bank);
  const extra = s.extra?.trim();
  if (extra) params.set("x", extra);
  return `${origin.replace(/\/$/, "")}/#${params.toString()}`;
}

/** Read a re-check link's fragment. Anything malformed is ignored (null). */
export function parseShareHash(hash: string): ShareInput | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw.includes("r=")) return null;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return null;
  }
  const input = params.get("r")?.trim() ?? "";
  if (!input || input.length > MAX_INPUT) return null;
  const bank = params.get("b")?.trim() || undefined;
  if (bank && !LIVE_CODES.has(bank)) return null;
  const extra = params.get("x")?.trim() || undefined;
  if (extra && (extra.length > MAX_EXTRA || !/^[\d+\s-]+$/.test(extra))) return null;
  return { input, ...(bank ? { bank } : {}), ...(extra ? { extra } : {}) };
}
