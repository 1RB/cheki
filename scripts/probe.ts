/**
 * Test a receipt on your own machine, without sending it to anyone.
 *
 *   npm run probe -- <receipt-url>
 *   npm run probe -- <bank> <reference> [account-or-phone]
 *   npm run probe -- <bank> <reference> --account 12345678
 *   npm run probe -- <bank> <reference> --phone 2519XXXXXXXX
 *
 * Flags:
 *   --redact     mask names, accounts and phones so the output is safe to share
 *   --raw        print the first 2,000 characters of the response body
 *   --no-verify  skip the full Verifier run (one request to the bank instead of two)
 *
 * It runs the same URL detector, parsers and Verifier as cheki.et and prints
 * the raw response metadata plus the parsed result.
 */
import { detectBankFromUrl, isUrl } from "../src/lib/adapters/url-detector";
import { getBank } from "../src/lib/manifest/loader";
import { getParser } from "../src/lib/parsers";
import { Verifier } from "../src/lib/core/verifier";
import { CBEParser } from "../src/lib/parsers/cbe";
import { DashenParser } from "../src/lib/parsers/dashen";
import { ZemenParser } from "../src/lib/parsers/zemen";
import { CBEBirrParser } from "../src/lib/parsers/cbebirr";
import type { ParsedReceipt } from "../src/lib/core/types";

function usage(): never {
  console.log(`Usage:
  npm run probe -- <receipt-url>
  npm run probe -- <bank> <reference> [account-or-phone]
Flags: --redact  --raw  --no-verify  --account <n>  --phone <n>`);
  process.exit(1);
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
}

const NAME_KEYS = new Set(["senderName", "receiverName", "bankAccountName"]);
const NUMBER_KEYS = new Set(["senderAccount", "receiverAccount", "bankAccountNumber", "phone", "account", "phoneNumber", "accountNumber"]);

function maskNumber(v: string): string {
  return v.replace(/\d(?=(?:\D*\d){4})/g, "X");
}
function maskName(v: string): string {
  return v
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w[0]}.`)
    .join(" ");
}
export function redact<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v !== "string") out[k] = v;
    else if (NAME_KEYS.has(k)) out[k] = maskName(v);
    else if (NUMBER_KEYS.has(k)) out[k] = maskNumber(v);
    else if (k === "sourceUrl" || k === "url") out[k] = v.replace(/([?&/=-])([A-Za-z0-9]{6,})/g, (_m, p: string, s: string) => p + s.slice(0, 3) + "X".repeat(s.length - 3));
    else if (k === "raw") out[k] = "[redacted]";
    else out[k] = v;
  }
  return out as T;
}

async function parseLikeVerifier(bankId: string, data: string | Buffer, contentType: string): Promise<{ text?: string; parsed: ParsedReceipt }> {
  const parser = getParser(bankId)!;
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const isPdf = buf.toString("ascii", 0, 5).includes("%PDF");
  switch (bankId) {
    case "cbe": {
      const text = isPdf ? await CBEParser.extractPdfText(buf) : "";
      return { text, parsed: CBEParser.parsePdfText(text) };
    }
    case "dashen": {
      const text = isPdf ? await DashenParser.extractPdfText(buf) : DashenParser.htmlToText(buf.toString("utf8"));
      return { text, parsed: DashenParser.parsePdfText(text) };
    }
    case "zemen": {
      const text = isPdf ? await ZemenParser.extractPdfText(buf) : "";
      return { text, parsed: ZemenParser.parsePdfText(text) };
    }
    case "cbebirr": {
      const text = isPdf ? await CBEBirrParser.extractPdfText(buf) : CBEBirrParser.htmlToText(buf.toString("utf8"));
      return { text, parsed: CBEBirrParser.parseText(text) };
    }
    default:
      return { parsed: parser.parse(data, contentType) };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const doRedact = args.includes("--redact");
  const showRaw = args.includes("--raw");
  const skipVerify = args.includes("--no-verify");
  let account = flag(args, "--account");
  let phone = flag(args, "--phone");
  const pos = args.filter((a) => !a.startsWith("--"));
  if (pos.length === 0) usage();

  let bankId: string;
  let reference: string;
  if (isUrl(pos[0])) {
    const detected = detectBankFromUrl(pos[0]);
    if (!detected) {
      console.log("URL detector: no bank matched this host. Open a bank request with the host and a redacted pattern.");
      process.exit(2);
    }
    bankId = detected.bank;
    reference = detected.reference;
    account = account ?? detected.accountNumber;
    phone = phone ?? detected.phoneNumber;
    console.log("URL detector:", doRedact ? redact({ ...detected }) : detected);
  } else {
    if (pos.length < 2) usage();
    bankId = pos[0].toLowerCase();
    reference = pos[1];
    if (pos[2]) {
      const entry = getBank(bankId);
      if (entry?.requiresPhone) phone = phone ?? pos[2];
      else account = account ?? pos[2];
    }
  }

  const entry = getBank(bankId);
  const parser = getParser(bankId);
  if (!entry) {
    console.log(`Unknown bank "${bankId}".`);
    process.exit(2);
  }
  console.log(`Bank: ${entry.name} (${entry.id}), manifest status: ${entry.status}`);
  if (!parser) {
    console.log("No parser is registered for this bank yet. See CONTRIBUTING.md, Adding or fixing a bank.");
    process.exit(2);
  }

  const url = parser.buildUrl(reference, account, phone);
  console.log("Request URL:", doRedact ? redact({ url }).url : url);

  const started = Date.now();
  const fetched = await parser.fetchReceipt(reference, account, phone, { fallbackUrl: url });
  if (!fetched.ok) {
    console.log("Fetch failed:", fetched.error);
    process.exit(3);
  }
  const { status, data, contentType } = fetched.value;
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  console.log("Response:", {
    status,
    contentType,
    bytes: buf.length,
    pdf: buf.toString("ascii", 0, 5).includes("%PDF"),
    ms: Date.now() - started,
  });
  if (showRaw) {
    const body = buf.toString("utf8", 0, Math.min(buf.length, 2000));
    console.log("\nRaw body (first 2,000 chars):\n" + (doRedact ? body.replace(/\d{5,}/g, (d) => maskNumber(d)) : body) + "\n");
  }

  const { text, parsed } = await parseLikeVerifier(bankId, data, contentType);
  if (text !== undefined) console.log(`Extracted text: ${text.length} characters${showRaw && !doRedact ? `\n${text.slice(0, 2000)}` : ""}`);
  console.log("Parser result:", doRedact ? redact({ ...parsed }) : parsed);

  if (skipVerify) return;
  if (entry.status !== "live") {
    console.log("Verifier: skipped. The Verifier refuses banks that are still in development, so the parser result above is what matters.");
    return;
  }
  const result = await new Verifier().verify({ bank: bankId, reference, accountNumber: account, phoneNumber: phone });
  console.log("Verifier:", result.ok ? (doRedact ? redact({ ...result.value }) : result.value) : result.error);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
