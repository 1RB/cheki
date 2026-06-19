/**
 * Siinqee Bank parser — routes through eBirr platform.
 *
 * Siinqee (Cooperative Bank of Oromia) doesn't have a standalone
 * public receipt endpoint. Receipts are served through the eBirr
 * platform at receipt.ebirr.com/siinqee/{token}.
 *
 * This parser delegates parsing to EBirrParser with the tenant set to "siinqee".
 */
import { BaseParser } from "./base";
import { EBirrParser } from "./ebirr";
import type { ParsedReceipt } from "../core/types";

export class SiinqeeParser extends BaseParser {
  readonly bankId = "siinqee";
  readonly bankName = "Siinqee Bank";
  readonly responseType = "html" as const;
  readonly requiresAccount = false;
  readonly accountDigits?: number = undefined;
  readonly requiresPhone = false;

  private ebirrParser = new EBirrParser();

  buildUrl(ref: string): string {
    const cleaned = ref.trim();

    // If it's already a full URL, use it directly
    if (cleaned.startsWith("http")) {
      return cleaned;
    }

    // If it already has a tenant prefix (e.g., "siinqee/abc123"), use as-is
    if (cleaned.includes("/")) {
      return `https://receipt.ebirr.com/${cleaned}`;
    }

    // Otherwise, prepend the siinqee tenant
    return `https://receipt.ebirr.com/siinqee/${cleaned}`;
  }

  parse(data: string | Buffer, contentType: string): ParsedReceipt {
    // Delegate to EBirrParser's parse logic
    return this.ebirrParser.parse(data, contentType);
  }
}
