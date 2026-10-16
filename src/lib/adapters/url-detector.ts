/**
 * URL detector - parses receipt URLs and detects the bank + reference.
 *
 * Supports all known bank receipt URL formats:
 *   - mbreciept.cbe.com.et/{receiptId}     → CBE, current format (Receipt ID)
 *   - mbreciept.cbe.com.et/FT...-12345678  → CBE, legacy FT format (dashed)
 *   - apps.cbe.com.et:100/?id={ref}{acct}  → CBE, legacy FT format
 *   - transactioninfo.ethiotelecom.et/...  → Telebirr
 *   - cs.bankofabyssinia.com/slip/?trx=     → BOA (reference + 5-digit suffix)
 *   - receipts.dashenbanksc.com/receipt/... → Dashen
 *   - receipt.dashensuperapp.com/...        → Dashen (legacy)
 *   - awashpay.awashbank.com:8225/-{ref}   → Awash
 *   - share.zemenbank.com/rt/{ref}/pdf      → Zemen
 *   - m-pesabusiness.safaricom.et/...       → M-Pesa
 *   - cbepay1.cbe.com.et/aureceipt?TID=     → CBE Birr
 *   - receipt.ebirr.com/{tenant}/{token}    → eBirr white-label (Siinqee, …)
 *   - receipt.zamzambank.com.et/receipt/{id} → ZamZam (numeric receipt id)
 */
export interface DetectedReceipt {
  bank: string;
  reference: string;
  accountNumber?: string;
  phoneNumber?: string;
}

/** eBirr white-label tenants that cheki recognises by name. */
const EBIRR_TENANTS: Record<string, string> = {
  siinqee: "siinqee",
  nib: "nib",
  wegagen: "wegagen",
  ahadu: "ahadu",
  kaafimf: "kaafi",
  kaafi: "kaafi",
  coop: "siinqee",
};

/**
 * Exact host match: the host itself or a subdomain of it, never a substring.
 * `includes("ethiotelecom.et")` used to accept
 * `transactioninfo.ethiotelecom.et.evil.example`.
 */
function hostIs(host: string, ...allowed: string[]): boolean {
  return allowed.some((h) => host === h || host.endsWith("." + h));
}

/** A BOA FT transaction reference: "FT" + 10 letters or digits (FT26999ABCD1). */
const BOA_FT_REF = /^FT[A-Z0-9]{10}$/i;
/** A BOA slip id: an FT reference followed by the 5-digit account suffix. */
const BOA_SLIP_ID = /^(FT[A-Z0-9]{10})(\d{5})$/i;

/**
 * Split a BOA slip id ({reference}{last 5 digits of an account}) into its
 * parts. BOA's slip links (`/slip/?trx=`) and its API (`getDetails/?id=`)
 * use the same id, e.g. FT26999ABCD112345 → FT26999ABCD1 + 12345.
 *
 * The suffix is the last 5 digits of an account on the receipt, which BOA
 * looks the receipt up by. It is not always the receiver's: a fee receipt
 * has no receiver and is looked up by the source account. So it is returned as `accountNumber`,
 * never labelled as the receiving account.
 *
 * Only the unambiguous FT shape (exactly 17 characters) is split; anything
 * else returns null and the caller keeps its own behaviour.
 */
export function splitBoaSlipId(value: string): { reference: string; accountNumber: string } | null {
  const m = value.trim().match(BOA_SLIP_ID);
  if (!m) return null;
  return { reference: m[1].toUpperCase(), accountNumber: m[2] };
}

export function detectBankFromUrl(input: string): DetectedReceipt | null {
  try {
    const trimmed = input.trim();
    // Only real http(s):// links. "http:/x", "http:evil.com" and "//x" are not.
    if (!isUrl(trimmed) || trimmed.includes("\\")) return null;
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    const host = url.hostname.toLowerCase();

    // CBE share links: https://mbreciept.cbe.com.et/{receiptId} (current,
    // read through the mb.cbe.com.et JSON API). A dashed id such as
    // FT26SAMPLE01-00006171 carries an older FT reference and the receiving
    // account's last 8 digits, so it is the legacy format. The bank stays
    // "cbe"; the verifier picks the format from the reference's shape.
    if (hostIs(host, "mbreciept.cbe.com.et", "mb.cbe.com.et")) {
      const parts = url.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      if (last) {
        const dashed = last.match(/^(FT[A-Z0-9]{8,12})-(\d{8})$/i);
        if (dashed) return { bank: "cbe", reference: dashed[1].toUpperCase(), accountNumber: dashed[2] };
        return { bank: "cbe", reference: last };
      }
    }

    // CBE legacy: https://apps.cbe.com.et:100/?id=FT26SAMPLE0100006171
    if (hostIs(host, "apps.cbe.com.et")) {
      const id = url.searchParams.get("id");
      if (id && id.startsWith("FT")) {
        // id = FT reference + last 8 digits of account
        const accountSuffix = id.slice(-8);
        const ref = id.slice(0, -8);
        if (ref.length > 2) {
          return { bank: "cbe", reference: ref, accountNumber: accountSuffix };
        }
      }
    }

    // Telebirr: https://transactioninfo.ethiotelecom.et/receipt/{REFERENCE}
    if (hostIs(host, "transactioninfo.ethiotelecom.et")) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length > 0) {
        return { bank: "telebirr", reference: parts[parts.length - 1] };
      }
    }

    // BOA: https://cs.bankofabyssinia.com/slip/?trx={REFERENCE}{SUFFIX}
    //      https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id={REFERENCE}{SUFFIX}
    // Both carry the same lookup id; see splitBoaSlipId.
    if (hostIs(host, "bankofabyssinia.com")) {
      const trx = url.searchParams.get("trx")?.trim();
      const id = url.searchParams.get("id")?.trim();
      if (trx) {
        const split = splitBoaSlipId(trx);
        // A bare reference (no suffix) is passed through as before.
        return split ? { bank: "boa", ...split } : { bank: "boa", reference: trx };
      }
      if (id) {
        const split = splitBoaSlipId(id);
        if (split) return { bank: "boa", ...split };
        // A bare FT reference: there is no suffix to take.
        if (BOA_FT_REF.test(id)) return { bank: "boa", reference: id.toUpperCase() };
        // Other reference shapes: the API id is always {reference}{last 5
        // digits}, so take the trailing 5 digits when they are digits.
        const legacy = id.match(/^(.+)(\d{5})$/);
        if (legacy) return { bank: "boa", reference: legacy[1], accountNumber: legacy[2] };
        return { bank: "boa", reference: id };
      }
    }

    // Dashen: https://api.dashensuperapp.com/receipts/Within-Dashen-Transfer-{REF}.pdf
    //          https://receipt.dashensuperapp.com/receipt/{REFERENCE}  (legacy)
    //          https://receipts.dashenbanksc.com/receipt/{FT_REF}         (current)
    // Only the reference is taken; the verifier rebuilds the URL on the
    // manifest host, so the pasted host is never fetched.
    if (hostIs(host, "dashensuperapp.com", "dashenbanksc.com")) {
      const parts = url.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1] || "";
      // PDF filename: Within-Dashen-Transfer-{REF}.pdf
      const pdfMatch = last.match(/Within-Dashen-Transfer-(.+?)\.pdf$/i);
      if (pdfMatch) return { bank: "dashen", reference: pdfMatch[1] };
      if (last) return { bank: "dashen", reference: last };
    }

    // Awash: https://awashpay.awashbank.com:8225/-{REFERENCE}
    if (hostIs(host, "awashbank.com")) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length > 0) {
        const ref = parts[parts.length - 1].replace(/^-/, "").replace(/[.,;:!?]+$/, "");
        return { bank: "awash", reference: ref };
      }
    }

    // Zemen: https://share.zemenbank.com/rt/{REFERENCE}/pdf
    if (hostIs(host, "zemenbank.com")) {
      const parts = url.pathname.split("/").filter(Boolean);
      // parts = ["rt", "REFERENCE", "pdf"] - take the middle part
      if (parts.length >= 2) return { bank: "zemen", reference: parts[1] };
      if (parts.length === 1) return { bank: "zemen", reference: parts[0] };
    }

    // M-Pesa: https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo={REFERENCE}
    if (hostIs(host, "safaricom.et")) {
      const trx = url.searchParams.get("trxNo");
      if (trx) return { bank: "mpesa", reference: trx };
    }

    // CBE Birr: https://cbepay1.cbe.com.et/aureceipt?TID={REFERENCE}&PH={PAYER_PHONE}
    if (hostIs(host, "cbepay1.cbe.com.et", "cbepay2.cbe.com.et")) {
      const tid = url.searchParams.get("TID");
      if (tid) {
        const phone = url.searchParams.get("PH");
        return { bank: "cbebirr", reference: tid, ...(phone ? { phoneNumber: phone } : {}) };
      }
    }

    // eBirr white-label: https://receipt.ebirr.com/{tenant}/{token}
    // The tenant names the issuing bank. Only exactly receipt.ebirr.com and a
    // known tenant are accepted; an unknown tenant is not guessed at.
    if (host === "receipt.ebirr.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length === 2) {
        const tenant = parts[0].toLowerCase();
        if (!Object.hasOwn(EBIRR_TENANTS, tenant)) return null;
        const bank = EBIRR_TENANTS[tenant];
        // Keep tenant/token: the eBirr parsers rebuild the URL from it.
        return { bank, reference: `${tenant}/${parts[1]}` };
      }
    }

    // ZamZam: https://receipt.zamzambank.com.et/receipt/{id}
    // Exactly that host (no subdomains, no other ZamZam host). Only the id is
    // taken; the parser validates it (digits only) and fetches the JSON from
    // its own fixed host, so the pasted link is never fetched. A trailing
    // slash, a query or a fragment is ignored.
    if (host === "receipt.zamzambank.com.et") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length === 2 && parts[0].toLowerCase() === "receipt" && parts[1]) {
        return { bank: "zamzam", reference: parts[1] };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Check if a string is an http(s):// URL (exactly two slashes after the scheme).
 */
export function isUrl(input: string): boolean {
  return /^https?:\/\/[^/\\]/i.test(input.trim());
}

/**
 * True for anything that carries a scheme or URL syntax, including the tricks
 * WHATWG URL parsing quietly repairs: "http:/host", "http:host",
 * "http:\\host", "//host", "javascript:...". Such input must either be a
 * proper link that detectBankFromUrl recognises, or be rejected. It must never
 * be treated as a plain reference.
 */
export function looksLikeUrl(input: string): boolean {
  const t = input.trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(t) || t.startsWith("//") || t.includes("\\");
}
