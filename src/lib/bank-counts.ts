/**
 * Live/in-development provider counts for copy and metadata, derived from the
 * manifest so the text can't drift from what the checker actually supports.
 *
 * `cbe-new` is a second parser for CBE (the newer receipt system), not a
 * separate provider, so it is not counted.
 */
import { getAllBanks } from "./manifest/loader";

const PARSER_ONLY_IDS = new Set(["cbe-new"]);

const providers = getAllBanks().filter((b) => !PARSER_ONLY_IDS.has(b.id));

/** Display names used in copy, in manifest order. */
const COPY_NAMES: Record<string, string> = { mpesa: "M-Pesa" };

export const liveProviders = providers.filter((b) => b.status === "live");
export const LIVE_BANK_COUNT = liveProviders.length;
export const TOTAL_BANK_COUNT = providers.length;
export const IN_DEVELOPMENT_BANK_COUNT = TOTAL_BANK_COUNT - LIVE_BANK_COUNT;

/** "CBE, Telebirr, Bank of Abyssinia, ... and eBirr" for the live providers. */
export function liveBankList(style: "short" | "long" = "long"): string {
  const names = liveProviders.map((b) =>
    COPY_NAMES[b.id] ?? (style === "short" ? b.shortName ?? b.name : b.id === "cbe" ? "CBE" : b.name)
  );
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}
