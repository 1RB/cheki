/**
 * The merged content on /banks/[code] (src/lib/bank-page-content.ts): what the
 * folded /verify pages and how-to guides brought, without repeats, and without
 * ever implying that a QR code or a pasted receipt verifies a payment.
 */
import { describe, it, expect } from "vitest";
import { banks, getBank } from "@/lib/banks";
import { bankPageContent, builtInHeadings, faqTopic, hasGeoSection, receiptTypeLabel, requiredInfoIntro } from "@/lib/bank-page-content";
import { aOrAn } from "@/lib/indefinite-article";
import { BANK_HEADING, BANKS_WITH_TOPIC_PAGES } from "@/lib/seo-redirects";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const live = banks.filter((b) => b.status === "live");
const text = (code: string) => {
  const c = bankPageContent(getBank(code)!);
  return [
    ...c.sections.flatMap((s) => [s.heading, s.body ?? "", ...(s.bullets ?? []), ...(s.steps ?? [])]),
    ...c.faq.flatMap((f) => [f.q, f.a]),
  ].join("\n");
};

describe("bank page content", () => {
  it("never repeats a heading the page renders itself, or a section", () => {
    for (const b of live) {
      const headings = bankPageContent(b).sections.map((s) => s.heading.toLowerCase());
      expect(new Set(headings).size, b.code).toBe(headings.length);
      for (const h of builtInHeadings(b)) expect(headings, b.code).not.toContain(h.toLowerCase());
    }
  });

  it("de-duplicates FAQs, so the visible list and the FAQPage JSON-LD match one to one", () => {
    for (const b of live) {
      const keys = bankPageContent(b).faq.map((f) => f.q.toLowerCase().replace(/[^a-z0-9]/g, ""));
      expect(new Set(keys).size, b.code).toBe(keys.length);
      // The manifest FAQ always leads.
      expect(bankPageContent(b).faq.slice(0, b.faq.length)).toEqual(b.faq);
    }
  });

  it("gives banks still in development only their manifest FAQ", () => {
    for (const b of banks.filter((x) => x.status !== "live")) {
      expect(bankPageContent(b)).toEqual({ sections: [], faq: b.faq });
    }
  });

  it("carries a fake-receipt and a receipt-format section for each bank that had those pages", () => {
    for (const code of BANKS_WITH_TOPIC_PAGES) {
      const ids = bankPageContent(getBank(code)!).sections.map((s) => s.id);
      expect(ids, code).toContain("fake-receipt");
      expect(ids, code).toContain("receipt-format");
    }
  });

  it("says a receipt is verified only when the bank confirms it", () => {
    for (const code of BANKS_WITH_TOPIC_PAGES) {
      const fake = bankPageContent(getBank(code)!).sections.find((s) => s.id === "fake-receipt")!;
      expect(fake.body, code).toMatch(/verified only when .* confirms it/);
    }
  });

  it("Telebirr: the receipt QR is read, then checked with Telebirr, never trusted alone", () => {
    const t = text("telebirr");
    expect(t).toContain("Payment QR Code");
    expect(t).toMatch(/verified only when Telebirr's own receipt page confirms it/);
    expect(t).toMatch(/Verify Payment/);
    expect(t).toMatch(/DET: person-to-person transfer/);
  });

  it("BOA: a decoded QR without BOA's answer is not verified", () => {
    expect(text("boa")).toMatch(/decoded only, not verified/);
  });

  it("names M-Pesa's PDF-in-JSON receipts correctly", () => {
    expect(receiptTypeLabel(getBank("mpesa")!)).toBe("PDF document inside a JSON response (base64)");
    expect(receiptTypeLabel(getBank("telebirr")!)).toBe("HTML page");
  });

  it("does not promise a sender and receiver for ZamZam", () => {
    expect(text("zamzam")).not.toMatch(/sender name, receiver name/);
  });

  it("asks each question once, however the folded pages worded it", () => {
    for (const b of live) {
      const topics = bankPageContent(b).faq.map((f) => faqTopic(f.q));
      expect(new Set(topics).size, b.code).toBe(topics.length);
    }
    expect(faqTopic("Does CBE charge for receipt verification?")).toBe(faqTopic("Is checking CBE payments free?"));
    expect(faqTopic("Does Dashen verification require an account number?")).toBe(faqTopic("Do I need an account number to verify Dashen?"));
    expect(faqTopic("Why does Telebirr verification sometimes fail?")).toBe(faqTopic("Why does Telebirr verification fail from outside Ethiopia?"));
  });

  it("does not repeat the use-case list under the payment scenarios", () => {
    for (const b of live) {
      const bullets = bankPageContent(b).sections.flatMap((s) => s.bullets ?? []);
      for (const u of b.useCases) expect(bullets, b.code).not.toContain(u);
    }
  });

  it("uses an before a vowel sound", () => {
    expect(aOrAn("M-Pesa")).toBe("an");
    expect(aOrAn("Awash")).toBe("an");
    expect(aOrAn("eBirr")).toBe("an");
    expect(aOrAn("HTML page")).toBe("an");
    expect(aOrAn("CBE")).toBe("a");
    expect(aOrAn("BOA")).toBe("a");
    expect(aOrAn("Telebirr")).toBe("a");
    expect(aOrAn("Siinqee")).toBe("a");
    for (const b of live) expect(text(b.code), b.code).not.toMatch(/\ba (?:M-Pesa|Awash|eBirr|HTML)\b/);
  });

  it("lists what you need once: no second inputs section under the check-payment content", () => {
    for (const b of live) {
      const headings = bankPageContent(b).sections.map((s) => s.heading.toLowerCase());
      expect(headings.some((h) => /what (?:information|you need)|required information/.test(h)), b.code).toBe(false);
      expect(builtInHeadings(b)[0]).toBe(`What you need to verify ${aOrAn(b.shortName)} ${b.shortName} receipt`);
      // The one fact the removed section added: where the inputs come from, and whether an account is needed.
      expect(requiredInfoIntro(b), b.code).toMatch(/^Ask the sender for the /);
    }
    expect(requiredInfoIntro(getBank("boa")!)).toMatch(/needs both/);
    expect(requiredInfoIntro(getBank("cbe")!)).toMatch(/No account number is needed/);
    for (const b of banks.filter((x) => x.status !== "live")) expect(requiredInfoIntro(b)).toBeNull();
  });

  it("explains geo-blocking once on Telebirr and M-Pesa, and the page drops its own note there", () => {
    for (const code of ["telebirr", "mpesa"]) {
      const c = bankPageContent(getBank(code)!);
      expect(hasGeoSection(c), code).toBe(true);
      expect(c.sections.filter((s) => /geo-block/i.test(s.heading)).length, code).toBe(1);
      expect(c.sections.find((s) => s.id === BANK_HEADING.geoBlocking.id)!.heading).toBe(`${getBank(code)!.shortName} geo-blocking`);
    }
    const tb = bankPageContent(getBank("telebirr")!).sections.find((s) => s.id === "geo-blocking")!;
    expect(tb.body).toMatch(/fallback/);
    expect(tb.body).toMatch(/self-host/);
    for (const code of ["cbe", "boa", "dashen"]) expect(hasGeoSection(bankPageContent(getBank(code)!)), code).toBe(false);
    // The page wires the note to hasGeoSection, so it never renders beside the section.
    const page = readFileSync(join(__dirname, "../../src/app/banks/[code]/page.tsx"), "utf8");
    expect(page).toMatch(/const geoNote = bank\.geoBlocked && !hasGeoSection\(content\)/);
    expect(page).toMatch(/\{geoNote && \(/);
    expect(page).not.toMatch(/<h2>Required information<\/h2>/);
  });
});
