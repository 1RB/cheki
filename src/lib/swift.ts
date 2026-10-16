/**
 * Display helpers for a bank's SWIFT/BIC reference block. Kept free of React
 * so the page, the FAQ copy and the tests share one wording.
 */
import type { BankSwift } from "./core/types";

/** Head-office BIC: 4 bank letters, ET, a 2-character location, optional 3-character branch. */
export const ETHIOPIAN_BIC = /^[A-Z]{4}ET[A-Z0-9]{2}([A-Z0-9]{3})?$/;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-10-16" → "16 October 2026", without Intl so server and client agree. */
export function formatCheckedAt(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** Directory sites used only as an independent cross-check, by hostname. */
const CROSS_CHECK_SITES: Record<string, string> = {
  "wise.com": "Wise SWIFT directory",
};

/** Who a source page belongs to, in words: SWIFT, the regulator, a directory, or the bank itself. */
export function swiftSourceLabel(url: string, bankShortName: string): string {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
  if (host === "swiftref.com" || host === "swift.com" || host.endsWith(".swift.com")) return "SWIFT BIC search";
  if (host === "nbe.gov.et") return "National Bank of Ethiopia";
  if (CROSS_CHECK_SITES[host]) return CROSS_CHECK_SITES[host];
  return `${bankShortName} website`;
}

/** One plain line on how far the code was checked; never claims a registry match it did not get. */
export function swiftRegistryNote(swift: BankSwift): string {
  return swift.registry === "confirmed" ? "Matches SWIFT's BIC search" : "SWIFT registry not checked";
}

export function swiftFaq(bankName: string, bankShortName: string, swift: BankSwift): { q: string; a: string } {
  return {
    q: `What is the SWIFT code for ${bankName}?`,
    a: `The head-office SWIFT (BIC) code for ${bankName} is ${swift.bic}, sometimes written ${swift.bic}XXX. It is used together with the account number for transfers from abroad. cheki lists it for reference only, last checked ${formatCheckedAt(swift.checkedAt)}${swift.registry === "confirmed" ? ", matching SWIFT's BIC search" : "; the SWIFT registry itself was not checked"}. Confirm transfer details with ${bankShortName} before sending.`,
  };
}
