/**
 * Parser registry - plugin system for bank parsers.
 *
 * Each parser registers itself. The verifier looks up the parser by bank ID.
 * To add a new bank: create a parser file, register it, add to banks.json.
 */
import type { BankManifestEntry } from "../core/types";

export interface RegisteredParser {
  bankId: string;
  bankName: string;
  responseType: "pdf" | "html" | "json";
  requiresAccount: boolean;
  accountDigits?: number;
  requiresPhone: boolean;
  buildUrl(ref: string, account?: string, phone?: string): string;
  parse(data: string | Buffer, contentType: string): import("../core/types").ParsedReceipt;
  fetchReceipt(
    ref: string,
    account?: string,
    phone?: string,
    options?: { fallbackUrl?: string }
  ): Promise<import("../core/types").Result<import("../core/types").HttpResult>>;
}

const registry = new Map<string, RegisteredParser>();

export function registerParser(parser: RegisteredParser): void {
  if (registry.has(parser.bankId)) {
    throw new Error(`Parser already registered for bank: ${parser.bankId}`);
  }
  registry.set(parser.bankId, parser);
}

export function getParser(bankId: string): RegisteredParser | undefined {
  return registry.get(bankId);
}

export function getRegisteredBankIds(): string[] {
  return Array.from(registry.keys());
}

export function isBankSupported(bankId: string): boolean {
  return registry.has(bankId);
}
