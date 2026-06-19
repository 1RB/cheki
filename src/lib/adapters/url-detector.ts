/**
 * URL detector - parses receipt URLs and detects the bank + reference.
 *
 * Supports all known bank receipt URL formats:
 *   - mbreciept.cbe.com.et/{id}           → CBE new API
 *   - apps.cbe.com.et:100/?id={ref}{acct}  → CBE legacy
 *   - transactioninfo.ethiotelecom.et/...  → Telebirr
 *   - cs.bankofabyssinia.com/...            → BOA
 *   - receipt.dashensuperapp.com/...        → Dashen
 *   - awashpay.awashbank.com:8225/-{ref}   → Awash
 *   - share.zemenbank.com/rt/{ref}/pdf      → Zemen
 *   - m-pesabusiness.safaricom.et/...       → M-Pesa
 */
export interface DetectedReceipt {
  bank: string;
  reference: string;
  accountNumber?: string;
}

export function detectBankFromUrl(input: string): DetectedReceipt | null {
  try {
    const url = new URL(input.trim());
    const host = url.hostname.toLowerCase();

    // CBE new: https://mbreciept.cbe.com.et/{shortId}
    if (host.includes("mbreciept.cbe.com.et") || host.includes("mb.cbe.com.et")) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length > 0) {
        return { bank: "cbe-new", reference: parts[parts.length - 1] };
      }
    }

    // CBE legacy: https://apps.cbe.com.et:100/?id=FT26140P01YB60536171
    if (host.includes("apps.cbe.com.et")) {
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
    if (host.includes("transactioninfo.ethiotelecom.et")) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length > 0) {
        return { bank: "telebirr", reference: parts[parts.length - 1] };
      }
    }

    // BOA: https://cs.bankofabyssinia.com/slip/?trx={REFERENCE} or /api/onlineSlip/getDetails/?id={REFERENCE}{SUFFIX}
    if (host.includes("bankofabyssinia.com")) {
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
    //          https://receipt.dashensuperapp.com/receipt/{REFERENCE}
    if (host.includes("dashensuperapp.com")) {
      const parts = url.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1] || "";
      // PDF filename: Within-Dashen-Transfer-{REF}.pdf
      const pdfMatch = last.match(/Within-Dashen-Transfer-(.+?)\.pdf$/i);
      if (pdfMatch) return { bank: "dashen", reference: pdfMatch[1] };
      if (last) return { bank: "dashen", reference: last };
    }

    // Awash: https://awashpay.awashbank.com:8225/-{REFERENCE}
    if (host.includes("awashbank.com")) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length > 0) {
        const ref = parts[parts.length - 1].replace(/^-/, "");
        return { bank: "awash", reference: ref };
      }
    }

    // Zemen: https://share.zemenbank.com/rt/{REFERENCE}/pdf
    if (host.includes("zemenbank.com")) {
      const parts = url.pathname.split("/").filter(Boolean);
      // parts = ["rt", "REFERENCE", "pdf"] - take the middle part
      if (parts.length >= 2) return { bank: "zemen", reference: parts[1] };
      if (parts.length === 1) return { bank: "zemen", reference: parts[0] };
    }

    // M-Pesa: https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo={REFERENCE}
    if (host.includes("safaricom.et")) {
      const trx = url.searchParams.get("trxNo");
      if (trx) return { bank: "mpesa", reference: trx };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Check if a string looks like a URL (http/https).
 */
export function isUrl(input: string): boolean {
  const trimmed = input.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}
