/**
 * cheki — verify ethiopian receipts for free.
 *
 * Public API. Import from here:
 *   import { Verifier, Receipt, ChekiError } from "@/lib";
 *
 * Architecture:
 *   lib/core/      → domain types, Result, errors, Verifier (pure, no I/O deps)
 *   lib/manifest/  → banks.json (single source of truth) + loader
 *   lib/parsers/   → BaseParser, registry, one file per bank
 *   lib/adapters/  → URL detector, HTTP client, input normalization
 */

// ─── Core ───────────────────────────────────────────────────────────
export { Verifier } from "./core/verifier";
export type {
  Result,
  Receipt,
  ChekiError,
  VerifyRequest,
  ParserPort,
  ParsedReceipt,
  HttpPort,
  HttpResult,
  HttpFetchOptions,
  BankManifestEntry,
  BankId,
  Reference,
} from "./core/types";
export { ok, err, errorToHttpStatus, errorToMessage } from "./core/types";

// ─── Manifest ───────────────────────────────────────────────────────
export { getBank, getAllBanks, getLiveBanks, suggestBank } from "./manifest/loader";

// ─── Parsers ────────────────────────────────────────────────────────
export {
  BaseParser,
  registerParser,
  getParser,
  isBankSupported,
  getRegisteredBankIds,
} from "./parsers/index";
export type { RegisteredParser } from "./parsers/index";

// ─── Adapters ───────────────────────────────────────────────────────
export { detectBankFromUrl, isUrl } from "./adapters/url-detector";
export type { DetectedReceipt } from "./adapters/url-detector";

// ─── Auto-register all parsers (side effect of importing) ──────────
import "./parsers/index";
