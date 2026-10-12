/**
 * Input validation for references, account numbers and phone numbers before
 * they are placed into a bank URL.
 *
 * Every bank URL builder also runs `encodeURIComponent`, but rejecting path
 * and query characters up front gives a clear error and stops tricks such as
 * `../../admin` (path traversal on the bank host) or `REF#` / `REF&x=` (which
 * drop the account suffix that BOA and CBE use as proof of account).
 */

export type Checked<T> = { ok: true; value: T } | { ok: false; message: string };

const MAX_REF_LENGTH = 64;
const SAFE_REF_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

/** Generic reference check used by every bank except eBirr-style tokens. */
export function checkReference(input: unknown): Checked<string> {
  if (typeof input !== "string") {
    return { ok: false, message: "Reference must be text." };
  }
  const ref = input.trim();
  if (!ref) return { ok: false, message: "Reference number is required." };
  if (ref.length > MAX_REF_LENGTH) {
    return { ok: false, message: "That reference is too long to be a receipt number." };
  }
  if (/[/\\?#%&\s]/.test(ref) || ref.includes("..")) {
    return {
      ok: false,
      message: "A reference can't contain /, ?, #, &, % or \"..\". Paste only the reference number, or the full receipt link.",
    };
  }
  if (!SAFE_REF_RE.test(ref)) {
    return { ok: false, message: "A reference can only contain letters, digits, dots, dashes and underscores." };
  }
  return { ok: true, value: ref };
}

/**
 * Account suffix check. Users may type the full account number with spaces or
 * dashes; the bank only needs the last `digits` digits, which must all be
 * digits.
 */
export function checkAccountSuffix(input: unknown, digits: number): Checked<string> {
  if (typeof input !== "string") {
    return { ok: false, message: "Account number must be text." };
  }
  const cleaned = input.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(cleaned) || cleaned.length > 32) {
    return { ok: false, message: "The account number can only contain digits." };
  }
  if (cleaned.length < digits) {
    // Which account depends on the bank and format (see each format's
    // missingHint), so this message does not name one.
    return { ok: false, message: `Enter at least the last ${digits} digits of the account number.` };
  }
  return { ok: true, value: cleaned.slice(-digits) };
}

/** Phone number check (CBE Birr payer phone). */
export function checkPhone(input: unknown): Checked<string> {
  if (typeof input !== "string") {
    return { ok: false, message: "Phone number must be text." };
  }
  const cleaned = input.replace(/[\s()-]/g, "");
  if (!/^\+?\d{9,15}$/.test(cleaned)) {
    return { ok: false, message: "Enter the payer's phone number using digits only." };
  }
  return { ok: true, value: cleaned };
}

// ─── eBirr white-label receipts ─────────────────────────────────────

export const EBIRR_HOST = "receipt.ebirr.com";

/** Tenants cheki knows on receipt.ebirr.com. Anything else is rejected. */
export const EBIRR_TENANTS = new Set(["nib", "wegagen", "ahadu", "kaafimf", "coop", "siinqee"]);

const EBIRR_TOKEN_RE = /^[A-Za-z0-9_-]{4,128}$/;

/**
 * Parse an eBirr input ("tenant/token", a bare token with a default tenant,
 * or a full https://receipt.ebirr.com/tenant/token link) into its parts.
 *
 * The URL is never used as given: callers rebuild it from EBIRR_HOST, so a
 * look-alike or attacker host can't be fetched.
 */
export function parseEbirrReference(
  input: unknown,
  defaultTenant?: string
): Checked<{ tenant: string; token: string }> {
  const bad = (message = "That is not a valid eBirr receipt reference. Paste the full receipt.ebirr.com link."): Checked<never> =>
    ({ ok: false, message });
  if (typeof input !== "string") return bad();
  const raw = input.trim();
  if (!raw || raw.length > 300) return bad();

  let path = raw;
  // Anything with a scheme, a leading "//" or a backslash must be a proper
  // https?:// link to the exact eBirr host. This rejects "http:/x",
  // "http:evil.com", "http:\\evil.com", "//evil.com" and look-alike hosts.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("//") || raw.includes("\\")) {
    if (!/^https?:\/\/[^/\\]/i.test(raw) || raw.includes("\\")) return bad();
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return bad();
    }
    if (url.username || url.password || url.port) return bad();
    if (url.hostname.toLowerCase() !== EBIRR_HOST) return bad();
    path = url.pathname;
  } else if (/[?#%\s]/.test(raw)) {
    return bad();
  }

  const parts = path.split("/").filter(Boolean);
  let tenant: string | undefined;
  let token: string | undefined;
  if (parts.length === 2) {
    [tenant, token] = parts;
  } else if (parts.length === 1 && defaultTenant) {
    tenant = defaultTenant;
    token = parts[0];
  } else {
    return bad();
  }
  tenant = tenant.toLowerCase();
  if (!EBIRR_TENANTS.has(tenant)) {
    return bad("cheki does not know that eBirr issuer yet.");
  }
  if (!EBIRR_TOKEN_RE.test(token)) return bad();
  return { ok: true, value: { tenant, token } };
}

export function buildEbirrUrl(tenant: string, token: string): string {
  return `https://${EBIRR_HOST}/${encodeURIComponent(tenant)}/${encodeURIComponent(token)}`;
}
