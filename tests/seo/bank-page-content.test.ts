/**
 * The merged content on /banks/[code] (src/lib/bank-page-content.ts): what the
 * folded /verify pages and how-to guides brought, without repeats, and without
 * ever implying that a QR code or a pasted receipt verifies a payment.
 */
import { describe, it, expect } from "vitest";
import { banks, getBank } from "@/lib/banks";
import { bankPageContent, builtInHeadings, receiptTypeLabel } from "@/lib/bank-page-content";
import { BANKS_WITH_TOPIC_PAGES } from "@/lib/seo-redirects";

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
});
