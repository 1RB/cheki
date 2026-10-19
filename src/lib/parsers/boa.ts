/**
 * BOA parser - Bank of Abyssinia.
 *
 * Endpoint: https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id={ref}{account}
 * Response: JSON with receipt fields
 * Requires: reference + last 5 digits of an account on the receipt. Not
 *   always the receiver's: a fee receipt with no receiver uses the source
 *   account. (A QR lookup tries the receiver account the QR names, then
 *   the QR's source account if BOA has no record under the receiver.) A slip
 *   link (/slip/?trx=) can carry these 5 digits after the reference.
 *
 * QR decryption:
 *   BOA receipt QR codes are AES-256-CBC encrypted payloads. The key is hardcoded
 *   in the BOA receipt web app (cs.bankofabyssinia.com/slip/assets/index-*.js):
 *     password = "ELqVy2g4pGWLUIKSa+1ijwpPy6eDxBFBLBPrJ24v/IA="
 *     salt     = "salt"
 *     iv       = "1234567890123456"
 *     iterations = 10000
 *     hasher   = SHA1
 *   Decrypted format: CSV-like string
 *     sourceAccount,sourceName,amount,reference,date,receiverAccount,receiverName
 *
 *   The key is public, so anyone can mint a QR payload. A decrypted QR is
 *   therefore only a way to FIND the receipt (reference + an account
 *   suffix from the QR); it never proves anything on its own. decryptQr always returns
 *   verified: false, and the verifier looks the receipt up at BOA.
 */
import { createDecipheriv, pbkdf2Sync } from "node:crypto";
import { BaseParser } from "./base";
import type { ParsedReceipt } from "../core/types";
import { parseMoney } from "../core/money";

const QR_PASSWORD = "ELqVy2g4pGWLUIKSa+1ijwpPy6eDxBFBLBPrJ24v/IA=";
const QR_SALT = "salt";
const QR_IV = "1234567890123456";
const QR_ITERATIONS = 10000;
const QR_KEYLEN = 32;
const QR_HASH = "sha1";

/** A non-blank string field, trimmed; anything else is undefined. */
function text(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** A money field ("1,234.50", "5,000.00 ETB" or a number), or undefined. */
function money(v: unknown): number | undefined {
  const s = text(v);
  return s === undefined ? undefined : parseMoney(s);
}

export class BOAParser extends BaseParser {
  readonly bankId = "boa";
  readonly bankName = "Bank of Abyssinia";
  readonly responseType = "json" as const;
  readonly requiresAccount = true;
  readonly accountDigits = 5;
  readonly requiresPhone = false;

  buildUrl(ref: string, account?: string): string {
    const suffix = (account || "").replace(/\D/g, "").slice(-5);
    return `https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=${encodeURIComponent(ref)}${suffix}`;
  }

  /**
   * Decrypt a BOA receipt QR code payload and parse the embedded CSV.
   * The result is never verified: it is what the QR claims, not what BOA says.
   */
  decryptQr(qrData: string): ParsedReceipt {
    try {
      const ciphertext = Buffer.from(qrData, "base64");
      const key = pbkdf2Sync(QR_PASSWORD, QR_SALT, QR_ITERATIONS, QR_KEYLEN, QR_HASH);
      const decipher = createDecipheriv("aes-256-cbc", key, Buffer.from(QR_IV, "utf8"));
      let plaintext = decipher.update(ciphertext, undefined, "utf8");
      plaintext += decipher.final("utf8");
      return this.parseQrCsv(plaintext);
    } catch {
      return { verified: false };
    }
  }

  private parseQrCsv(csv: string): ParsedReceipt {
    const parts = csv.split(",").map((s) => s.trim());
    if (parts.length < 7) {
      return { verified: false, raw: csv.slice(0, 500) };
    }

    const [senderAccount, senderName, amountStr, reference, date, receiverAccount, receiverName] = parts;
    const amount = parseMoney(amountStr);

    return {
      verified: false,
      senderName,
      senderAccount,
      receiverName,
      receiverAccount,
      amount,
      currency: "ETB",
      date,
      reference,
    };
  }

  parse(data: string | Buffer, _contentType: string): ParsedReceipt {
    try {
      const payload = JSON.parse(data.toString());
      const body = payload?.body;
      const row = Array.isArray(body) ? body[0] : undefined;
      if (!row || typeof row !== "object" || row["Payer's Name"] === "Invalid reference number") {
        return { verified: false, raw: data.toString().slice(0, 500) };
      }

      // Every field is optional: a fee or charge receipt ("Account Transfer
      // MB Maintenance") has no Receiver's Name or Receiver's Account, and the
      // amount rows vary by transaction type. Missing or blank fields stay
      // undefined so no empty rows reach the UI or the API response.
      return {
        verified: true,
        senderName: text(row["Source Account Name"]) ?? text(row["Payer's Name"]),
        senderAccount: text(row["Source Account"]),
        receiverName: text(row["Receiver's Name"]),
        receiverAccount: text(row["Receiver's Account"]),
        amount: money(row["Transferred Amount"]),
        currency: text(row.currency) ?? "ETB",
        date: text(row["Transaction Date"]),
        reference: text(row["Transaction Reference"]),
        transactionType: text(row["Transaction Type"]),
        amountInWords: text(row["Transferred Amount in word"]),
        serviceFee: money(row["Service Charge"]),
        // "VAT (15%)" is deliberately not mapped. On the one fee receipt
        // observed (2026-10-12) it was 15% of the Transferred Amount, not of
        // the Service Charge, so serviceFeeVat ("VAT on the service fee")
        // would mislabel it. totalPaid already includes it.
        totalPaid: money(row["Total Amount including VAT"]),
        // The payer's own note. BOA prints it as "Payment Reference" and may
        // add a "Narrative". ParsedReceipt has one free-text field for this,
        // so the Payment Reference wins and the Narrative is the fallback.
        reason: text(row["Payment Reference"]) ?? text(row["Narrative"]),
        raw: data.toString().slice(0, 1000),
      };
    } catch {
      return { verified: false, raw: data.toString().slice(0, 500) };
    }
  }
}
