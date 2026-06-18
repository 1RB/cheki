/**
 * M-Pesa parser — Safaricom Ethiopia mobile wallet.
 *
 * Endpoint: https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo={ref}
 * Response: JSON
 * Geo-blocked from non-Kenyan/Ethiopian IPs.
 */
import { BaseParser } from "./base";
import type { ParsedReceipt } from "../core/types";

export class MpesaParser extends BaseParser {
  readonly bankId = "mpesa";
  readonly bankName = "M-Pesa Ethiopia";
  readonly responseType = "json" as const;
  readonly requiresAccount = false;
  readonly accountDigits?: number = undefined;
  readonly requiresPhone = false;
  readonly geoBlocked = true;

  buildUrl(ref: string): string {
    return `https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo=${ref}`;
  }

  parse(data: string | Buffer, _contentType: string): ParsedReceipt {
    try {
      const payload = JSON.parse(data.toString());
      if (payload.responseCode && String(payload.responseCode) !== "0") {
        return { verified: false, raw: data.toString().slice(0, 500) };
      }

      return {
        verified: true,
        senderName: payload.senderName || payload.payerName,
        receiverName: payload.receiverName || payload.creditPartyName,
        amount: payload.amount ? parseFloat(payload.amount) : undefined,
        currency: payload.currency || "ETB",
        date: payload.transactionDate || payload.date,
        reference: payload.transactionId || payload.trxNo,
        raw: data.toString().slice(0, 1000),
      };
    } catch {
      return { verified: false, raw: data.toString().slice(0, 500) };
    }
  }
}
