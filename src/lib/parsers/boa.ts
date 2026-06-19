/**
 * BOA parser — Bank of Abyssinia.
 *
 * Endpoint: https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id={ref}{account}
 * Response: JSON with receipt fields
 * Requires: reference + last 5 digits of account
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
 */
import { createDecipheriv, pbkdf2Sync } from "node:crypto";
import { BaseParser } from "./base";
import type { ParsedReceipt } from "../core/types";

const QR_PASSWORD = "ELqVy2g4pGWLUIKSa+1ijwpPy6eDxBFBLBPrJ24v/IA=";
const QR_SALT = "salt";
const QR_IV = "1234567890123456";
const QR_ITERATIONS = 10000;
const QR_KEYLEN = 32;
const QR_HASH = "sha1";

export class BOAParser extends BaseParser {
  readonly bankId = "boa";
  readonly bankName = "Bank of Abyssinia";
  readonly responseType = "json" as const;
  readonly requiresAccount = true;
  readonly accountDigits = 5;
  readonly requiresPhone = false;

  buildUrl(ref: string, account?: string): string {
    const suffix = (account || "").slice(-5);
    return `https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=${ref}${suffix}`;
  }

  /**
   * Decrypt a BOA receipt QR code payload and parse the embedded CSV.
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
    const amount = amountStr ? parseFloat(amountStr) : NaN;

    return {
      verified: true,
      senderName,
      senderAccount,
      receiverName,
      receiverAccount,
      amount: Number.isFinite(amount) ? amount : undefined,
      currency: "ETB",
      date,
      reference,
      raw: csv.slice(0, 1000),
    };
  }

  parse(data: string | Buffer, _contentType: string): ParsedReceipt {
    try {
      const payload = JSON.parse(data.toString());
      const body = payload.body;
      if (!body || !body[0] || body[0]["Payer's Name"] === "Invalid reference number") {
        return { verified: false, raw: data.toString().slice(0, 500) };
      }

      const row = body[0];
      let amount: number | undefined;
      const amtRaw = row["Transferred Amount"];
      if (amtRaw) {
        const m = amtRaw.toString().replace(/[^0-9.]/g, "");
        if (m) amount = parseFloat(m);
      }

      return {
        verified: true,
        senderName: row["Source Account Name"],
        senderAccount: row["Source Account"],
        receiverName: row["Receiver's Name"],
        receiverAccount: row["Receiver's Account"],
        amount,
        currency: row.currency || "ETB",
        date: row["Transaction Date"],
        reference: row["Transaction Reference"],
        raw: data.toString().slice(0, 1000),
      };
    } catch {
      return { verified: false, raw: data.toString().slice(0, 500) };
    }
  }
}
