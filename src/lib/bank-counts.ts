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

/**
 * Live providers the hosted server can reach and confirm with the bank. The
 * others (geoBlocked: Telebirr, M-Pesa) block cloud servers, so cheki.et sends
 * the user to the official receipt page instead. `status` stays "live" in
 * /api/banks: a self-hosted server on an Ethiopian network checks them directly.
 */
export const directProviders = liveProviders.filter((b) => !b.geoBlocked);
export const linkOutProviders = liveProviders.filter((b) => b.geoBlocked);
export const DIRECT_BANK_COUNT = directProviders.length;
export const LINK_OUT_BANK_COUNT = linkOutProviders.length;

type Provider = (typeof providers)[number];

function nameList(list: Provider[], style: "short" | "long"): string {
  const names = list.map((b) =>
    COPY_NAMES[b.id] ?? (style === "short" ? b.shortName ?? b.name : b.id === "cbe" ? "CBE" : b.name)
  );
  if (names.length <= 1) return names.join("");
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/** "CBE, Telebirr, Bank of Abyssinia, ... and eBirr" for the live providers. */
export function liveBankList(style: "short" | "long" = "long"): string {
  return nameList(liveProviders, style);
}

/** The live providers cheki.et checks with the bank itself. */
export function directBankList(style: "short" | "long" = "long"): string {
  return nameList(directProviders, style);
}

/** "Telebirr and M-Pesa": live providers cheki.et links out to. */
export function linkOutBankList(): string {
  return nameList(linkOutProviders, "short");
}

/** "8 banks and wallets checked directly, plus Telebirr and M-Pesa through their official receipt pages" */
export function coverageSentence(): string {
  const direct = `${DIRECT_BANK_COUNT} banks and wallets checked directly`;
  return LINK_OUT_BANK_COUNT ? `${direct}, plus ${linkOutBankList()} through their official receipt pages` : direct;
}

/** Why the link-out providers are not checked from cheki.et, and what the user does instead. */
export function linkOutNote(): string {
  if (!LINK_OUT_BANK_COUNT) return "";
  return `${linkOutBankList()} block cloud servers, so cheki opens the official receipt page for you to check the amount and receiver yourself. Direct checks return once a local relay is live.`;
}
