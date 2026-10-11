/**
 * URL detector - parses receipt URLs and detects the bank + reference.
 *
 * Supports all known bank receipt URL formats:
 *   - mbreciept.cbe.com.et/{id}           → CBE new API
 *   - apps.cbe.com.et:100/?id={ref}{acct}  → CBE legacy
 *   - transactioninfo.ethiotelecom.et/...  → Telebirr
 *   - cs.bankofabyssinia.com/...            → BOA
 *   - receipts.dashenbanksc.com/receipt/... → Dashen
 *   - receipt.dashensuperapp.com/...        → Dashen (legacy)
 *   - awashpay.awashbank.com:8225/-{ref}   → Awash
 *   - share.zemenbank.com/rt/{ref}/pdf      → Zemen
 *   - m-pesabusiness.safaricom.et/...       → M-Pesa
 *   - cbepay1.cbe.com.et/aureceipt?TID=     → CBE Birr
 *   - receipt.ebirr.com/{tenant}/{token}    → eBirr white-label (Siinqee, …)
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

export function detectBankFromUrl(input: string): DetectedReceipt | null {
  try {
    const trimmed = input.trim();
    // Only real http(s):// links. "http:/x", "http:evil.com" and "//x" are not.
    if (!isUrl(trimmed) || trimmed.includes("\\")) return null;
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    const host = url.hostname.toLowerCase();

    // CBE new: https://mbreciept.cbe.com.et/{shortId}
    if (hostIs(host, "mbreciept.cbe.com.et", "mb.cbe.com.et")) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length > 0) {
        return { bank: "cbe-new", reference: parts[parts.length - 1] };
      }
    }

    // CBE legacy: https://apps.cbe.com.et:100/?id=FT26140P01YB60536171
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

    // BOA: https://cs.bankofabyssinia.com/slip/?trx={REFERENCE} or /api/onlineSlip/getDetails/?id={REFERENCE}{SUFFIX}
    if (hostIs(host, "bankofabyssinia.com")) {
      const trx = url.searchParams.get("trx");
      const id = url.searchParams.get("id");
      if (trx) return { bank: "boa", reference: trx };
      if (id) {
        // id = reference + last 5 digits of account
        const accountSuffix = id.slice(-5);
        const ref = id.slice(0, -5);
        if (ref.length > 0) {
          return { bank: "boa", reference: ref, accountNumber: accountSuffix };
        }
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
