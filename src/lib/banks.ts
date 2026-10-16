/**
 * cheki banks - UI-facing bank data derived from the manifest.
 *
 * The canonical source of truth is `src/lib/manifest/banks.json`.
 * This file is a thin compatibility layer that:
 *   - loads the manifest
 *   - maps manifest fields (`id`, `initials`, `in-development`) to the legacy
 *     UI shape (`code`, `shortName`, `soon`)
 *   - compiles the string-based `refPattern` into a RegExp
 *   - filters out parser-only aliases (e.g. `cbe-new`) so they do not get pages
 */
import manifestData from "./manifest/banks.json";
import type { BankManifestEntry, BankRefPattern, BankSwift, ManifestResponseType, ReceiptFormat } from "./core/types";

export interface Bank {
  code: string;
  name: string;
  shortName: string;
  type: "bank" | "wallet" | "mobile";
  /** Head-office SWIFT/BIC with its sources; reference info only. */
  swift?: BankSwift;
  requiresAccount: boolean;
  accountLabel?: string;
  accountDigits?: number;
  requiresPhone?: boolean;
  status: "live" | "soon";
  /** Live, but only partly confirmed (see BankManifestEntry.beta). */
  beta?: boolean;
  betaNote?: string;
  refPattern?: RegExp;
  refPrefixes?: string[];
  color: string;
  geoBlocked?: boolean;
  endpoint: string;
  endpointFormat: string;
  /** How the endpoint authenticates (a public credential cheki sends); absent: none. */
  endpointAuth?: string;
  responseType: ManifestResponseType;
  description: string;
  referenceFormat: string;
  referenceExample: string;
  howToVerify: string[];
  useCases: string[];
  faq: { q: string; a: string }[];
  seo: { title: string; description: string; keywords: string[] };
  /** Receipt formats, current first (see src/lib/manifest/formats.ts). */
  formats: ReceiptFormat[];
}

const PARSER_ONLY_IDS = new Set(["cbe-new"]);

function compileRefPattern(input: BankRefPattern | string | undefined): RegExp | undefined {
  if (!input) return undefined;
  if (typeof input === "string") {
    try {
      return new RegExp(input);
    } catch {
      return undefined;
    }
  }
  try {
    return new RegExp(input.source, input.flags);
  } catch {
    return undefined;
  }
}

function manifestToBank(entry: BankManifestEntry): Bank {
  return {
    code: entry.id,
    name: entry.name,
    shortName: entry.shortName ?? entry.initials ?? entry.id,
    type: entry.type,
    swift: entry.swift,
    requiresAccount: entry.requiresAccount,
    accountLabel: entry.accountLabel,
    accountDigits: entry.accountDigits,
    requiresPhone: entry.requiresPhone,
    status: entry.status === "live" ? "live" : "soon",
    beta: entry.beta,
    betaNote: entry.betaNote,
    refPattern: compileRefPattern(entry.refPattern),
    refPrefixes: entry.refPrefixes,
    color: entry.color,
    geoBlocked: entry.geoBlocked,
    endpoint: entry.endpoint,
    endpointFormat: entry.endpointFormat ?? entry.endpoint,
    endpointAuth: entry.endpointAuth,
    responseType: entry.responseType,
    description: entry.description ?? "",
    referenceFormat: entry.referenceFormat ?? "",
    referenceExample: entry.referenceExample ?? "",
    howToVerify: entry.howToVerify ?? [],
    useCases: entry.useCases ?? [],
    faq: entry.faq ?? [],
    seo: entry.seo ?? { title: entry.name, description: "", keywords: [] },
    formats: entry.formats ?? [],
  };
}

export const banks: Bank[] = (manifestData as BankManifestEntry[])
  .filter((b) => !PARSER_ONLY_IDS.has(b.id))
  .map(manifestToBank);

export type BankCode = (typeof banks)[number]["code"];

export function getBank(code: string): Bank | undefined {
  return banks.find((b) => b.code === code);
}

export function detectBank(reference: string): string | null {
  const upper = reference.toUpperCase().trim();
  for (const b of banks) {
    if (b.refPattern) {
      try {
        if (b.refPattern.test(upper)) return b.code;
      } catch {}
    }
  }
  // Fallback: check prefixes manually
  if (upper.startsWith("FT")) return "cbe";
  if (/^(DET|CHQ|DAB|DJA|DEL|ADQ|DEP|CHG|DF|DEV)/i.test(upper)) return "telebirr";
  // eBirr receipt URL or tenant/token
  if (/receipt\.ebirr\.com/i.test(upper)) return "ebirr";
  if (/^(nib|wegagen|ahadu|kaafimf)\//i.test(upper)) return "ebirr";
  return null;
}

/**
 * The one way the UI decides how to present an API result. Only a bank
 * confirmation (`verified: true`) is "verified"; `success` only means the
 * request was handled. A BOA QR the bank could not confirm is "decodedOnly"
 * and pasted content is "parsed": both are shown amber, never green, and
 * never saved as checked. Strict `=== true` so a stringly "true" or a stray
 * truthy value can't turn anything green.
 */
export type VerificationState = "verified" | "decodedOnly" | "parsed" | "none";

export function verificationState(
  r: Pick<VerifyResult, "success" | "verified" | "decodedOnly" | "parsed"> | null | undefined
): VerificationState {
  if (!r || r.success !== true) return "none";
  if (r.verified === true && r.decodedOnly !== true && r.parsed !== true) return "verified";
  if (r.decodedOnly === true) return "decodedOnly";
  if (r.parsed === true) return "parsed";
  return "none";
}

export interface VerifyResult {
  success: boolean;
  error?: string;
  fallbackUrl?: string;
  /** True when the API served this from the in-memory receipt cache. */
  cached?: boolean;
  bank?: string;
  /** Manifest id of the bank that answered (the API sends it with every receipt). */
  bankCode?: string;
  /** Set by readVerifyResponse on a failed request: the HTTP status (0 = no response). */
  httpStatus?: number;
  /** Seconds to wait, from Retry-After, when httpStatus is 429. */
  retryAfter?: number;
  reference?: string;
  sourceUrl?: string;
  verified?: boolean;
  senderName?: string;
  senderAccount?: string;
  receiverName?: string;
  receiverAccount?: string;
  amount?: number;
  currency?: string;
  date?: string;
  branch?: string;
  reason?: string;
  transactionType?: string;
  raw?: string;
  // Telebirr / wallet-specific
  invoiceNumber?: string;
  transactionStatus?: string;
  settledAmount?: number;
  stampDuty?: number;
  discountAmount?: number;
  serviceFee?: number;
  serviceFeeVat?: number;
  totalPaid?: number;
  amountInWords?: string;
  paymentMode?: string;
  paymentChannel?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  /** BOA QR decoded but not confirmed with the bank (verified is false). */
  decodedOnly?: boolean;
  /** Read from content the user pasted (/api/parse); never bank-confirmed. */
  parsed?: boolean;
  source?: string;
}
