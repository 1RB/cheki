/**
 * M-Pesa parser - Safaricom Ethiopia mobile wallet.
 *
 * Endpoint: https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo={ref}
 * Response: JSON
 * Geo-blocked from non-Kenyan/Ethiopian IPs.
 */
import { BaseParser } from "./base";
import type { ParsedReceipt } from "../core/types";
import { parseMoney } from "../core/money";

function str(v: unknown): string | undefined {
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

export class MpesaParser extends BaseParser {
  readonly bankId = "mpesa";
  readonly bankName = "M-Pesa Ethiopia";
  readonly responseType = "json" as const;
  readonly requiresAccount = false;
  readonly accountDigits?: number = undefined;
  readonly requiresPhone = false;
  readonly geoBlocked = true;

  buildUrl(ref: string): string {
    return `https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo=${encodeURIComponent(ref)}`;
  }

  parse(data: string | Buffer, _contentType: string): ParsedReceipt {
    try {
      const payload = JSON.parse(data.toString());
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { verified: false, raw: data.toString().slice(0, 500) };
      }
      // A non-zero responseCode is an error. So is a body without a
      // transaction id: an empty object or a gateway error such as
      // {"message":"Forbidden","status":403} used to pass as "verified".
      if (payload.responseCode !== undefined && String(payload.responseCode) !== "0") {
        return { verified: false, raw: data.toString().slice(0, 500) };
      }
      const reference = str(payload.transactionId) ?? str(payload.trxNo);
      const amount = parseMoney(payload.amount);
      const senderName = str(payload.senderName) ?? str(payload.payerName);
      const receiverName = str(payload.receiverName) ?? str(payload.creditPartyName);

      return {
        verified: !!(reference && amount !== undefined && (senderName || receiverName)),
        senderName,
        receiverName,
        amount,
        currency: str(payload.currency) ?? "ETB",
        date: str(payload.transactionDate) ?? str(payload.date),
        reference,
        raw: data.toString().slice(0, 1000),
      };
    } catch {
      return { verified: false, raw: data.toString().slice(0, 500) };
    }
  }
}
