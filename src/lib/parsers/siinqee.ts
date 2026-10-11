/**
 * Siinqee Bank parser - routes through eBirr platform.
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
import { parseEbirrReference, buildEbirrUrl, type Checked } from "../security/reference";

/** Tenants on receipt.ebirr.com that belong to Siinqee (Cooperative Bank of Oromia). */
const SIINQEE_TENANTS = new Set(["siinqee", "coop"]);

function parseSiinqee(ref: string): Checked<{ tenant: string; token: string }> {
  const parsed = parseEbirrReference(ref, "siinqee");
  if (!parsed.ok) return parsed;
  if (!SIINQEE_TENANTS.has(parsed.value.tenant)) {
    return { ok: false, message: "That eBirr receipt was not issued by Siinqee Bank." };
  }
  return parsed;
}

export class SiinqeeParser extends BaseParser {
  readonly bankId = "siinqee";
  readonly bankName = "Siinqee Bank";
  readonly responseType = "html" as const;
  readonly requiresAccount = false;
  readonly accountDigits?: number = undefined;
  readonly requiresPhone = false;

  private ebirrParser = new EBirrParser();

  normalizeReference(ref: string): Checked<string> {
    const parsed = parseSiinqee(ref);
    if (!parsed.ok) return parsed;
    return { ok: true, value: `${parsed.value.tenant}/${parsed.value.token}` };
  }

  buildUrl(ref: string): string {
    // Rebuilt from the fixed eBirr host; a user-supplied URL is never fetched as is.
    const parsed = parseSiinqee(ref);
    if (!parsed.ok) throw new Error(parsed.message);
    return buildEbirrUrl(parsed.value.tenant, parsed.value.token);
  }

  parse(data: string | Buffer, contentType: string): ParsedReceipt {
    // Delegate to EBirrParser's parse logic
    return this.ebirrParser.parse(data, contentType);
  }
}
