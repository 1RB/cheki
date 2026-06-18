/**
 * BOA parser — Bank of Abyssinia.
 *
 * Endpoint: https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id={ref}{account}
 * Response: JSON with receipt fields
 * Requires: reference + last 5 digits of account
 */
import { BaseParser } from "./base";
import type { ParsedReceipt } from "../core/types";

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
