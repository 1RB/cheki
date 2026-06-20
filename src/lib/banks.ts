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
import type { BankManifestEntry, BankRefPattern } from "./core/types";

export interface Bank {
  code: string;
  name: string;
  shortName: string;
  type: "bank" | "wallet" | "mobile";
  requiresAccount: boolean;
  accountLabel?: string;
  accountDigits?: number;
  requiresPhone?: boolean;
  status: "live" | "soon";
  refPattern?: RegExp;
  refPrefixes?: string[];
  color: string;
  geoBlocked?: boolean;
  endpoint: string;
  endpointFormat: string;
  responseType: "pdf" | "html" | "json";
  description: string;
  referenceFormat: string;
  referenceExample: string;
  howToVerify: string[];
  useCases: string[];
  faq: { q: string; a: string }[];
  seo: { title: string; description: string; keywords: string[] };
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
    requiresAccount: entry.requiresAccount,
    accountLabel: entry.accountLabel,
    accountDigits: entry.accountDigits,
    requiresPhone: entry.requiresPhone,
    status: entry.status === "live" ? "live" : "soon",
    refPattern: compileRefPattern(entry.refPattern),
    refPrefixes: entry.refPrefixes,
    color: entry.color,
    geoBlocked: entry.geoBlocked,
    endpoint: entry.endpoint,
    endpointFormat: entry.endpointFormat ?? entry.endpoint,
    responseType: entry.responseType,
    description: entry.description ?? "",
    referenceFormat: entry.referenceFormat ?? "",
    referenceExample: entry.referenceExample ?? "",
    howToVerify: entry.howToVerify ?? [],
    useCases: entry.useCases ?? [],
    faq: entry.faq ?? [],
    seo: entry.seo ?? { title: entry.name, description: "", keywords: [] },
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
  if (/^(DET|CHQ|DAB|DEL|ADQ|DEP|CHG|DF|DEV)/i.test(upper)) return "telebirr";
  // eBirr receipt URL or tenant/token
  if (/receipt\.ebirr\.com/i.test(upper)) return "ebirr";
  if (/^(nib|wegagen|ahadu|kaafimf)\//i.test(upper)) return "ebirr";
  return null;
}

export interface VerifyResult {
  success: boolean;
  error?: string;
  fallbackUrl?: string;
  bank?: string;
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
}
