/**
 * Keeps /endpoints, /status and the health check in step with banks.json.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getAllBanks } from "@/lib/manifest/loader";
import { endpointDocs, getEndpointRows } from "@/lib/manifest/endpoints";
import { buildProbeTargets, describeResponse, evaluate, isoNow, matchExpectation } from "@/lib/health";
import status from "../../public/status.json";

const root = resolve(__dirname, "../..");

describe("endpoint docs", () => {
  it("has exactly one entry per manifest bank", () => {
    const ids = getAllBanks().map((b) => b.id).sort();
    expect(endpointDocs.map((d) => d.id).sort()).toEqual(ids);
    expect(getEndpointRows()).toHaveLength(ids.length);
  });

  it("links only to parser sources and fixtures that exist", () => {
    for (const d of endpointDocs) {
      if (d.parserSource) expect(existsSync(resolve(root, d.parserSource)), d.parserSource).toBe(true);
      if (d.fixture) expect(existsSync(resolve(root, d.fixture)), d.fixture).toBe(true);
    }
  });

  it("gives every bank with a known endpoint a probe", () => {
    for (const { bank, doc } of getEndpointRows()) {
      const known = /^https?:\/\//.test(bank.endpointFormat ?? bank.endpoint);
      expect("skip" in doc.probe, bank.id).toBe(!known);
    }
  });

  it("labels the bare Zemen reference as unconfirmed and prefers the share link", () => {
    const zemen = endpointDocs.find((d) => d.id === "zemen")!;
    expect(zemen.preferLink).toBe(true);
    expect(zemen.placeholders[0].confirmed).toBe(false);
    expect(zemen.placeholders[0].format).toMatch(/24 character/);
  });

  it("records the Dashen host change and the FT Ref trap", () => {
    const dashen = endpointDocs.find((d) => d.id === "dashen")!;
    expect(dashen.changelog.some((c) => c.date === "2026-10-10" && /receipts\.dashenbanksc\.com/.test(c.note))).toBe(true);
    expect(dashen.placeholders[0].traps).toMatch(/Transaction Ref/);
    expect(dashen.gotchas.join(" ")).toMatch(/receipt\.dashensuperapp\.com.*502/);
  });

  it("uses no em-dashes in user-facing copy", () => {
    const files = [
      "src/lib/manifest/endpoints.ts",
      "src/app/endpoints/page.tsx",
      "src/app/status/page.tsx",
      "src/components/ContributeBox.tsx",
      "src/components/StatusPill.tsx",
      "src/lib/contribute.ts",
      "src/app/api/contribute/route.ts",
      ".github/ISSUE_TEMPLATE/bank-request.yml",
    ];
    for (const f of files) expect(readFileSync(resolve(root, f), "utf8"), f).not.toContain("\u2014");
  });
});

describe("health check", () => {
  it("skips geo-restricted banks unless asked to check them", () => {
    const off = buildProbeTargets({ checkGeoRestricted: false });
    expect(off.find((t) => t.id === "telebirr")?.skip).toBe("geo-restricted");
    expect(off.find((t) => t.id === "mpesa")?.skip).toBe("geo-restricted");
    const on = buildProbeTargets({ checkGeoRestricted: true });
    expect(on.find((t) => t.id === "telebirr")?.url).toContain("transactioninfo.ethiotelecom.et");
  });

  it("builds probe URLs with the real parsers", () => {
    const t = buildProbeTargets({ checkGeoRestricted: false });
    expect(t.find((x) => x.id === "dashen")?.url).toBe("https://receipts.dashenbanksc.com/receipt/CHEKIPROBE000000");
    expect(t.find((x) => x.id === "zemen")?.url).toBe("https://share.zemenbank.com/rt/CHEKIPROBE000000/pdf");
    expect(t.find((x) => x.id === "cbebirr")?.url).toContain("cbepay1.cbe.com.et/aureceipt?TID=");
    expect(t.find((x) => x.id === "cbe-new")?.headers?.["X-App-ID"]).toBeTruthy();
  });

  it("matches the Dashen unknown-reference shape and flags a change", () => {
    const t = buildProbeTargets({ checkGeoRestricted: false }).find((x) => x.id === "dashen")!;
    const good = { status: 400, contentType: "application/json; charset=utf-8", body: '{"statusCode":400,"message":"Transaction not found"}' };
    expect(matchExpectation(good, t.probe!.expect)).toEqual([]);
    expect(evaluate(t, { response: good }, "x").status).toBe("live");
    expect(describeResponse(good)).toBe('400 application/json "Transaction not found"');
    const moved = { status: 502, contentType: "text/html", body: "<title>502 Bad Gateway</title>" };
    expect(evaluate(t, { response: moved }, "x").status).toBe("degraded");
    expect(evaluate(t, { error: "timeout" }, "x").status).toBe("degraded");
  });

  it("keeps in-development banks in development when their shape matches", () => {
    const t = buildProbeTargets({ checkGeoRestricted: false }).find((x) => x.id === "zemen")!;
    const r = evaluate(t, { response: { status: 404, contentType: "application/json", body: '{"messages":"Transaction not found.","status":"404"}' } }, "x");
    expect(r.status).toBe("in-development");
  });

  it("writes ISO timestamps", () => {
    expect(isoNow(new Date(Date.UTC(2026, 9, 10, 18, 8, 5)))).toBe("2026-10-10T18:08:05Z");
  });

  it("has a committed status.json covering every bank", () => {
    const ids = getAllBanks().map((b) => b.id).sort();
    expect(status.banks.map((b) => b.id).sort()).toEqual(ids);
    expect(status.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    for (const b of status.banks) expect(["live", "in-development", "degraded", "not-checked"]).toContain(b.status);
  });
});
