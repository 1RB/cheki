/**
 * The /guides index: articles grouped by the job the reader came to do, not
 * by date. Pure data so the page, the JSON-LD and the tests share one order.
 */
import { articles, type Article } from "./guides";
import { getAllBanks } from "./manifest/loader";

export type GuideSectionId = "verify" | "fraud" | "developers" | "open-source" | "comparisons";

export interface GuideSection {
  id: GuideSectionId;
  /** English heading, server-rendered; the i18n key is guides.sections.<id>.title. */
  title: string;
  /** English one-liner under the heading; i18n key guides.sections.<id>.blurb. */
  blurb: string;
  guides: Article[];
}

/** Section order is the page order: the most common job first. */
const SECTIONS: ReadonlyArray<Omit<GuideSection, "guides">> = [
  { id: "verify", title: "Verify a receipt", blurb: "Step by step, bank by bank." },
  { id: "fraud", title: "Spot fraud", blurb: "For merchants: the tricks, and what to check before you hand over the goods." },
  { id: "developers", title: "For developers", blurb: "The API, self-hosting, receipt formats and QR internals." },
  { id: "open-source", title: "Open source", blurb: "How cheki is built, and how to add a bank or a language." },
  { id: "comparisons", title: "Comparisons", blurb: "cheki next to the paid services." },
];

/** Which job an article serves. Exhaustive over Article["category"]. */
export function sectionOf(a: Article): GuideSectionId {
  switch (a.category) {
    case "bank":
      return "verify";
    case "fraud":
    case "business":
      return "fraud";
    case "api":
    case "technical":
      return "developers";
    case "open-source":
      return "open-source";
    case "comparison":
      return "comparisons";
    default: {
      const unhandled: never = a.category;
      throw new Error(`No guides section for category ${String(unhandled)}`);
    }
  }
}

/**
 * Hand-picked order inside a section, most useful first. Articles not listed
 * follow, newest update first. The "verify" section is ordered by bank instead.
 */
const PINNED: Partial<Record<GuideSectionId, readonly string[]>> = {
  developers: ["payment-verification-api-guide", "self-hosting-docker-guide", "ethiopian-bank-receipt-formats", "boa-qr-code-receipts", "telebirr-receipt-qr-code"],
  "open-source": ["contribute-new-bank", "contribute-translations", "open-source-ethiopian-fintech"],
  comparisons: ["free-receipt-verification-no-api-key"],
};

const bankOrder = new Map(getAllBanks().map((b, i) => [b.id, i]));
const bankName = new Map(getAllBanks().map((b) => [b.id, b.name]));

function byUpdatedThenTitle(a: Article, b: Article): number {
  return b.updated.localeCompare(a.updated) || a.title.localeCompare(b.title);
}

/** Bank guides in manifest (bank) order. The step-by-step how-to for each bank is its /banks page. */
function byBank(a: Article, b: Article): number {
  const ba = bankOrder.get(a.bankCode ?? "") ?? Number.MAX_SAFE_INTEGER;
  const bb = bankOrder.get(b.bankCode ?? "") ?? Number.MAX_SAFE_INTEGER;
  return ba - bb || byUpdatedThenTitle(a, b);
}

function sortSection(id: GuideSectionId, list: Article[]): Article[] {
  if (id === "verify") return [...list].sort(byBank);
  const pinned = PINNED[id] ?? [];
  const rank = (a: Article) => {
    const i = pinned.indexOf(a.slug);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...list].sort((a, b) => rank(a) - rank(b) || byUpdatedThenTitle(a, b));
}

/** Every article in exactly one section; empty sections are dropped. */
export function guideSections(list: readonly Article[] = articles): GuideSection[] {
  return SECTIONS.map((s) => ({ ...s, guides: sortSection(s.id, list.filter((a) => sectionOf(a) === s.id)) })).filter(
    (s) => s.guides.length > 0
  );
}

/** The articles in page order (what the ItemList JSON-LD lists). */
export function orderedGuides(list: readonly Article[] = articles): Article[] {
  return guideSections(list).flatMap((s) => s.guides);
}

/**
 * The excerpt's first sentence, for a one-line row. A sentence ends at . ! or ?
 * followed by a space and a capital or digit, so "check.et" or "1.5" never cut it.
 */
export function oneLine(excerpt: string): string {
  const m = /^(.+?[.!?])\s+(?=[A-Z0-9"'])/.exec(excerpt.trim());
  return m ? m[1] : excerpt.trim();
}

/** "Oct 12, 2026" for a YYYY-MM-DD date, read as a calendar date (no timezone shift). */
export function formatGuideDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error(`Not a YYYY-MM-DD date: ${iso}`);
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Lower-cased text the index search matches against: title, excerpt, section and bank. */
export function guideSearchText(a: Article): string {
  const section = SECTIONS.find((s) => s.id === sectionOf(a))?.title ?? "";
  const bank = a.bankCode ? bankName.get(a.bankCode) ?? a.bankCode : "";
  return [a.title, a.excerpt, section, bank, a.seo.keywords.join(" ")].join(" ").toLowerCase().replace(/\s+/g, " ");
}

/** The newest `updated` across the corpus (the index page's own last change). */
export function latestGuideUpdate(list: readonly Article[] = articles): string {
  return list.reduce((max, a) => (a.updated > max ? a.updated : max), "0000-00-00");
}
