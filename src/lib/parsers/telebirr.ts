/**
 * Telebirr parser — Ethio Telecom mobile wallet.
 *
 * Endpoint: https://transactioninfo.ethiotelecom.et/receipt/{ref}
 * Response: HTML receipt page
 * Geo-blocked from non-Ethiopian IPs.
 */
import { BaseParser } from "./base";
import type { ParsedReceipt } from "../core/types";

export class TelebirrParser extends BaseParser {
  readonly bankId = "telebirr";
  readonly bankName = "Telebirr";
  readonly responseType = "html" as const;
  readonly requiresAccount = false;
  readonly accountDigits?: number = undefined;
  readonly requiresPhone = false;
  readonly geoBlocked = true;

  buildUrl(ref: string): string {
    return `https://transactioninfo.ethiotelecom.et/receipt/${ref}`;
  }

  parse(data: string | Buffer, _contentType: string): ParsedReceipt {
    const html = data.toString();
    if (
      html.includes("This request is not correct") ||
      !html.toLowerCase().includes("telebirr receipt")
    ) {
      return { verified: false, raw: html.slice(0, 500) };
    }

    // Parse HTML with regex (avoid cheerio dependency in parser)
    const text = html
      .replace(/<[^>]+>/g, "\n")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l);

    function nextValueAfter(en: string, am?: string): string | undefined {
      for (let i = 0; i < text.length; i++) {
        if (text[i].includes(en) || (am && text[i].includes(am))) {
          if (i + 1 < text.length) return text[i + 1];
        }
      }
      return undefined;
    }

    let amount: number | undefined;
    let date: string | undefined;

    for (const line of text) {
      if (amount === undefined) {
        const m = line.match(/([0-9,]+\.?\d*)\s*(Birr|ETB)/i);
        if (m) amount = parseFloat(m[1].replace(/,/g, ""));
      }
      if (date === undefined) {
        const m = line.match(/(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2})/);
        if (m) date = m[1];
      }
    }

    return {
      verified: true,
      senderName: nextValueAfter("Payer Name", "\u12E8\u12A8\u12CD\u12FA\u12ED \u1235\u121B"),
      senderAccount: nextValueAfter("Payer telebirr no", "\u12E8\u12A8\u12CD\u12FA\u12ED \u124C\u12EC\u12A5\u1228\u1201 \u1230\u1201"),
      receiverName: nextValueAfter("Credited Party name", "\u12E8\u1300\u12AD\u12F0\u12E5 \u1320\u1241\u124B\u12ED \u1235\u121B"),
      receiverAccount: nextValueAfter("Credited party account no", "\u12E8\u1300\u12AD\u12F0\u12E5 \u1320\u1241\u124B\u12ED \u124C\u12EC\u12A5\u1228\u1201 \u1230\u1201"),
      amount,
      currency: "ETB",
      date,
      raw: text.join("\n").slice(0, 1000),
    };
  }
}
