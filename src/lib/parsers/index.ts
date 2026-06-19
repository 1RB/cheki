/**
 * Parser index — auto-registers all bank parsers.
 *
 * Import this module to make all parsers available.
 * To add a new bank parser: create a file, extend BaseParser,
 * register it here, and add the bank to banks.json.
 */
import { registerParser } from "./registry";
import { CBEParser, CBENewParser } from "./cbe";
import { TelebirrParser } from "./telebirr";
import { BOAParser } from "./boa";
import { MpesaParser } from "./mpesa";
import { DashenParser } from "./dashen";
import { EBirrParser } from "./ebirr";

// Register all parsers
registerParser(new CBEParser());
registerParser(new CBENewParser());
registerParser(new TelebirrParser());
registerParser(new BOAParser());
registerParser(new MpesaParser());
registerParser(new DashenParser());
registerParser(new EBirrParser());

// Re-export for convenience
export { CBEParser, CBENewParser } from "./cbe";
export { TelebirrParser } from "./telebirr";
export { BOAParser } from "./boa";
export { MpesaParser } from "./mpesa";
export { DashenParser } from "./dashen";
export { EBirrParser } from "./ebirr";
export { BaseParser } from "./base";
export {
  registerParser,
  getParser,
  getRegisteredBankIds,
  isBankSupported,
} from "./registry";
export type { RegisteredParser } from "./registry";
