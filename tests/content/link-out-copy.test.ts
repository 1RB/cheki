/**
 * Telebirr and M-Pesa block cloud servers, so cheki.et cannot check them: the
 * API answers 502 with a fallbackUrl (the official receipt page) and the site
 * opens that page for the merchant. Until a local relay exists, no copy may
 * say cheki.et checks or confirms them, and counts must say how many banks are
 * checked directly. /api/banks keeps status "live" for both (a self-hosted
 * server on an Ethiopian network does check them).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { getBank } from "@/lib/banks";
import { getAllBanks } from "@/lib/manifest/loader";
import {
  DIRECT_BANK_COUNT,
  LINK_OUT_BANK_COUNT,
  LIVE_BANK_COUNT,
  coverageSentence,
  directBankList,
  linkOutBankList,
  linkOutNote,
  linkOutProviders,
} from "@/lib/bank-counts";
import { bankPageContent, linkOutLine } from "@/lib/bank-page-content";
import { presentVerdict, cleanError } from "@/lib/verify/verdict";
import { ogBank } from "@/lib/og/render";
import { metadata as rootMetadata } from "@/app/layout";
import { metadata as banksMetadata } from "@/app/banks/layout";
import manifest from "@/app/manifest";

const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");
const LINK_OUT = ["telebirr", "mpesa"];

describe("link-out banks: counts", () => {
  it("splits the live providers by geoBlocked", () => {
    const live = getAllBanks().filter((b) => b.status === "live" && b.id !== "cbe-new");
    expect(linkOutProviders.map((b) => b.id).sort()).toEqual(live.filter((b) => b.geoBlocked).map((b) => b.id).sort());
    expect(linkOutProviders.map((b) => b.id).sort()).toEqual([...LINK_OUT].sort());
    expect(DIRECT_BANK_COUNT + LINK_OUT_BANK_COUNT).toBe(LIVE_BANK_COUNT);
    expect(linkOutBankList()).toBe("Telebirr and M-Pesa");
    expect(directBankList()).not.toMatch(/Telebirr|M-Pesa/);
    expect(coverageSentence()).toBe(`${DIRECT_BANK_COUNT} banks and wallets checked directly, plus Telebirr and M-Pesa through their official receipt pages`);
    expect(linkOutNote()).toMatch(/block cloud servers/);
    expect(linkOutNote()).toMatch(/local relay/);
  });

  it("README and llms.txt state the direct count", () => {
    expect(read("README.md")).toContain(`From cheki.et, ${DIRECT_BANK_COUNT} are checked directly with the bank`);
    expect(read("public/llms.txt")).toContain(`The hosted API checks ${DIRECT_BANK_COUNT} directly`);
  });
});

describe("link-out banks: no copy says cheki.et checks them", () => {
  it("metadata only names direct banks as checked against the bank's record", () => {
    const desc = String(rootMetadata.description);
    const checked = desc.split("against each bank's own record")[0];
    expect(checked).toContain("CBE Birr");
    expect(checked).not.toMatch(/Telebirr|M-Pesa/);
    expect(desc).toMatch(/Telebirr and M-Pesa open on their official receipt pages/);
    expect(String(banksMetadata.description)).toMatch(/Telebirr and M-Pesa open on their official receipt pages/);
    expect(String(manifest().description)).not.toMatch(/Verify CBE, Telebirr/);
  });

  it("their bank pages say the receipt opens on the official page, never that cheki fetches or confirms it", () => {
    for (const code of LINK_OUT) {
      const b = getBank(code)!;
      const c = bankPageContent(b);
      const text = [
        b.description,
        b.seo.description,
        ...b.howToVerify,
        ...c.sections.flatMap((s) => [s.heading, s.body ?? "", ...(s.steps ?? []), ...(s.bullets ?? [])]),
        ...c.faq.flatMap((f) => [f.q, f.a]),
      ].join("\n");
      expect(text, code).toMatch(/official receipt (page|link)/);
      expect(text, code).toMatch(/local relay/);
      expect(text, code).not.toMatch(/cheki (fetches|calls|checks that number with)/i);
      expect(text, code).not.toMatch(/sometimes fail/i);
      expect(text, code).not.toMatch(/against [^.]*'s record/);
    }
    expect(linkOutLine("Telebirr")).toMatch(/^Telebirr blocks cloud servers/);
  });

  it("the home page and /banks label them by what happens, not as live everywhere", () => {
    const home = read("src/components/HomePage.tsx");
    expect(home).not.toMatch(/ET networks/);
    expect(home).toContain("banks and wallets checked directly");
    const page = read("src/app/banks/[code]/page.tsx");
    expect(page).not.toMatch(/Live on Ethiopian networks/);
  });

  it("the Open Graph card shows no verified result for them", () => {
    for (const code of LINK_OUT) {
      const html = renderToStaticMarkup(ogBank(code, "current"));
      expect(html, code).not.toMatch(/Verified with/);
      expect(html, code).toMatch(/official receipt page/);
    }
    for (const variant of ["stamp", "chat", "light"] as const) {
      expect(renderToStaticMarkup(ogBank("telebirr", variant))).not.toMatch(/Verified with/);
    }
    expect(renderToStaticMarkup(ogBank("cbe", "current"))).toMatch(/Verified with CBE/);
  });
});

describe("link-out banks: the checker's result", () => {
  // The shape cheki.et returns today (synthetic reference).
  const prod = {
    success: false,
    httpStatus: 502,
    error: "[Telebirr] Our server can't reach this bank (it blocks cloud IPs). Open the receipt directly: https://transactioninfo.ethiotelecom.et/receipt/DET0SAMPLE",
    fallbackUrl: "https://transactioninfo.ethiotelecom.et/receipt/DET0SAMPLE",
  };

  it("is neutral, says it was not checked, links the official page and says what to check", () => {
    const v = presentVerdict(prod, { bankCode: "telebirr" });
    expect(v.kind).toBe("geoBlocked");
    expect(v.tone).toBe("neutral");
    expect(v.title).toMatch(/^Not checked/);
    expect(v.fallbackUrl).toBe(prod.fallbackUrl);
    expect(v.nextStep).toMatch(/amount/);
    expect(v.nextStep).toMatch(/receiver/);
    expect(v.nextStep).toMatch(/date/);
    expect(v.showDetails).toBe(false);
    expect(v.detail).toBe("Our server can't reach this bank (it blocks cloud IPs).");
    expect(presentVerdict({ ...prod, error: prod.error.replace("Telebirr", "M-Pesa Ethiopia") }, { bankCode: "mpesa" }).tone).toBe("neutral");
  });

  it("strips the link from the server's message in both wordings", () => {
    expect(cleanError(prod.error)).toBe("Our server can't reach this bank (it blocks cloud IPs).");
  });

  it("the shared API fixture carries the link once, without the old 'new receipt format' wording", () => {
    const fx = read("sdks/fixtures/api-contract.json");
    expect(fx).not.toMatch(/Try the new receipt format/);
    expect(fx).toMatch(/Open the receipt directly: https:\/\/transactioninfo\.ethiotelecom\.et\/receipt\/CHQ0SAMPLE"/);
  });
});
