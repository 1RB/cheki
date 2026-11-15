/**
 * `linkHosts` is documentation shown on /endpoints, not a recognition rule:
 * whether a pasted URL counts as a receipt lives in
 * src/lib/adapters/url-detector.ts. This pins the two together so neither
 * drifts into claiming what the other does.
 *
 * - Every host the detector recognises must have a sample link that detects
 *   to a bank that documents that host (the row is not stale or misfiled).
 * - The reported-only hosts must stay unrecognised: they are evidence rows
 *   with no share link and no parser, and pretending otherwise would send a
 *   pasted URL down a path nothing can verify.
 * - Every `linkHosts` host must be classified exactly once, so a host added
 *   to the manifest fails here until someone states what it does.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { detectBankFromUrl } from "@/lib/adapters/url-detector";
import { getAllBanks } from "@/lib/manifest/loader";

/** A sample receipt link for every `linkHosts` host the detector recognises. */
const SAMPLE: Record<string, string> = {
  "mbreciept.cbe.com.et": "https://mbreciept.cbe.com.et/RCPT1SAMPLE0001",
  "mb.cbe.com.et": "https://mb.cbe.com.et/RCPT1SAMPLE0002",
  "apps.cbe.com.et": "https://apps.cbe.com.et:100/?id=FT26SAMPLE0100006171",
  "transactioninfo.ethiotelecom.et": "https://transactioninfo.ethiotelecom.et/receipt/CHQ0SAMPLE",
  "cs.bankofabyssinia.com": "https://cs.bankofabyssinia.com/slip/?trx=FT26999ABCD112345",
  "m-pesabusiness.safaricom.et": "https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo=WSAMPLE1234",
  "receipts.dashenbanksc.com": "https://receipts.dashenbanksc.com/receipt/FT26SAMPLE01",
  "receipt.dashensuperapp.com": "https://receipt.dashensuperapp.com/receipt/FT26SAMPLE02",
  "api.dashensuperapp.com": "https://api.dashensuperapp.com/receipts/Within-Dashen-Transfer-FT26SAMPLE03.pdf",
  "awashpay.awashbank.com": "https://awashpay.awashbank.com:8225/-AWSSAMPLE01",
  "share.zemenbank.com": "https://share.zemenbank.com/rt/ZMNSAMPLE01/pdf",
  "cbepay1.cbe.com.et": "https://cbepay1.cbe.com.et/aureceipt?TID=CBRSAMPLE01&PH=251911000001",
  "cbepay2.cbe.com.et": "https://cbepay2.cbe.com.et/aureceipt?TID=CBRSAMPLE02",
  "receipt.ebirr.com": "https://receipt.ebirr.com/siinqee/TOKSAMPLE01",
  "transinfo.wegagenbanksc.com.et:8183": "https://transinfo.wegagenbanksc.com.et:8183/?id=ABC123DEF456GHI789JKL012",
  "online.bunnabanksc.com": "https://online.bunnabanksc.com/receipt/#/SAMPLETOKEN01",
  "receipt.zamzambank.com.et": "https://receipt.zamzambank.com.et/receipt/9876543210",
};

/**
 * `linkHosts` hosts the detector deliberately does not recognise: reported
 * evidence rows and parser-less formats with no share link.
 */
const UNRECOGNISED = [
  "receipts.siinqeebank.com",
  "receipt.ahadubank.com",
  "abaymobile.com.et",
  "receipt.amharabank.com.et",
  "transaction.amharabank.com.et",
  "transactioninfo.berhanonline.et",
  "obinfo.oromiabank.com",
];

/** host (exactly as the manifest lists it) -> banks whose formats list it. */
const documentedBy = new Map<string, Set<string>>();
for (const bank of getAllBanks()) {
  for (const format of bank.formats ?? []) {
    for (const host of format.linkHosts ?? []) {
      const banks = documentedBy.get(host) ?? new Set<string>();
      banks.add(bank.id);
      documentedBy.set(host, banks);
    }
  }
}

describe("linkHosts", () => {
  it("recognises a sample link to a bank that documents every host it claims", () => {
    expect(Object.keys(SAMPLE).length).toBe(17);
    for (const [host, url] of Object.entries(SAMPLE)) {
      const hit = detectBankFromUrl(url);
      expect(hit, `${host}: ${url}`).not.toBeNull();
      expect([...(documentedBy.get(host) ?? [])], `${host} -> ${hit!.bank}`).toContain(hit!.bank);
    }
  });

  it("stays unrecognised on the reported-only hosts", () => {
    expect(UNRECOGNISED.length).toBe(7);
    for (const host of UNRECOGNISED) {
      expect(detectBankFromUrl(`https://${host}/receipt/SAMPLE`), host).toBeNull();
    }
  });

  it("classifies every manifest host exactly once (no stale rows either way)", () => {
    expect([...documentedBy.keys()].sort()).toEqual([...Object.keys(SAMPLE), ...UNRECOGNISED].sort());
  });

  it("is read only where it is shown, and its comment points at the detector", () => {
    const root = resolve(__dirname, "../../src");
    const readers: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.[cm]?[jt]sx?$/.test(entry.name) && readFileSync(path, "utf8").includes("linkHosts")) {
          readers.push(path.slice(root.length + 1));
        }
      }
    };
    walk(root);
    expect(readers.sort()).toEqual(["app/endpoints/page.tsx", "lib/core/types.ts"]);

    const types = readFileSync(resolve(root, "lib/core/types.ts"), "utf8");
    const comment = types.slice(types.lastIndexOf("/**", types.indexOf("linkHosts?: string[]")), types.indexOf("linkHosts?: string[]"));
    expect(comment).toContain("url-detector.ts");
  });
});
