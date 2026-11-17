// @vitest-environment jsdom
/**
 * /status and /endpoints after the pass-3 redesign: the user's answer first,
 * dots not pills, every bank still in the server HTML (crawlable, no
 * client-only content), every /endpoints#<bank> anchor kept, and the state
 * mapping honest about what a cloud probe outside Ethiopia can see.
 */
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getEndpointRows } from "@/lib/manifest/endpoints";
import { isSupportedFormat, secondaryFormats } from "@/lib/manifest/formats";
import { bankState, isStale, listNames, measuredFrom, summarize, STALE_AFTER_MS } from "@/lib/status-view";
import StatusPage from "@/app/status/page";
import EndpointsPage from "@/app/endpoints/page";

vi.mock("@/components/Chrome", () => ({ Nav: () => null, Footer: () => null }));
vi.mock("next/link", () => ({ default: ({ href, children, prefetch: _p, ...rest }: { href: string; children: React.ReactNode; prefetch?: boolean }) => <a href={href} {...rest}>{children}</a> }));

const root = resolve(__dirname, "../..");
const read = (f: string) => readFileSync(resolve(root, f), "utf8");

describe("status-view", () => {
  const live = { status: "live" as const, geoBlocked: false };
  it("maps probe outcomes to the reader's words", () => {
    expect(bankState(live, "live")).toBe("working");
    expect(bankState(live, "degraded")).toBe("down");
    expect(bankState({ status: "live", geoBlocked: true }, "not-checked")).toBe("geo");
    // An unanswered probe on a bank that is not geo-blocked is neither green nor red.
    expect(bankState({ status: "live" }, "not-checked")).toBe("unknown");
    expect(bankState({ status: "in-development" }, "live")).toBe("unsupported");
    expect(bankState({ status: "in-development" }, "degraded")).toBe("unsupported");
  });

  it("the headline counts live banks only, and turns amber when one is down", () => {
    expect(summarize(["working", "working", "geo", "unsupported"])).toMatchObject({ live: 3, working: 2, geo: 1, down: 0, tone: "green" });
    expect(summarize(["working", "down"]).tone).toBe("amber");
    expect(summarize(["down"]).tone).toBe("red");
    expect(summarize(["unsupported"]).tone).toBe("neutral");
    // Unanswered probes are never green.
    expect(summarize(["unknown"]).tone).toBe("neutral");
    expect(summarize(["working", "unknown"]).tone).toBe("amber");
  });

  it("says where it measured from", () => {
    expect(measuredFrom("manual run (Oregon, US)")).toBe("Oregon, US");
    expect(measuredFrom("GitHub Actions (ubuntu-latest)")).toMatch(/outside Ethiopia/);
  });

  it("flags a snapshot older than 36 hours as possibly stale", () => {
    const t = Date.parse("2026-10-10T18:08:27Z");
    expect(isStale("2026-10-10T18:08:27Z", t + STALE_AFTER_MS - 1)).toBe(false);
    expect(isStale("2026-10-10T18:08:27Z", t + STALE_AFTER_MS + 1)).toBe(true);
    expect(isStale(undefined, t)).toBe(true);
    expect(isStale("garbage", t)).toBe(true);
  });

  it("lists names in plain English", () => {
    expect(listNames(["Telebirr", "M-Pesa"])).toBe("Telebirr and M-Pesa");
    expect(listNames(["A", "B", "C"])).toBe("A, B and C");
  });
});

describe("server HTML", () => {
  const status = renderToStaticMarkup(<StatusPage />);
  const endpoints = renderToStaticMarkup(<EndpointsPage />);
  const banks = getEndpointRows().filter((r) => !r.doc.aliasOf);

  it("/status answers first, then lists every bank", () => {
    expect(status).toMatch(/\d+ of \d+ banks working/);
    for (const r of banks) expect(status, r.bank.id).toContain(`id="${r.bank.id}"`);
    expect(status).toMatch(/outside Ethiopia/);
    expect(status).toContain("There is no uptime history yet");
  });

  it("/endpoints keeps an anchor for every bank and its content in the HTML", () => {
    for (const r of banks) expect(endpoints, r.bank.id).toContain(`id="${r.bank.id}"`);
    // Disclosure bodies are server-rendered (crawlable), not client-only.
    expect(endpoints).toContain("Unknown-reference error shape");
    expect(endpoints).toContain("mbreciept.cbe.com.et");
    expect(endpoints).toContain('"@type":"TechArticle"');
    expect(endpoints).toContain("How to research a new bank");
  });

  it("uses dots, not tinted pills", () => {
    for (const html of [status, endpoints]) {
      expect(html).toContain('class="sd"');
      expect(html).not.toMatch(/background:\s*var\(--(green|amber)-light\)/);
    }
  });
});

describe("format tags and sections on /endpoints", () => {
  const html = renderToStaticMarkup(<EndpointsPage />);
  // What the page actually renders: non-alias rows with an endpoint (the
  // stub rows render "Reported host" lines instead of FormatSummary).
  const rendered = getEndpointRows().filter(
    (r) => !r.doc.aliasOf && /^https?:\/\//i.test(r.bank.endpointFormat ?? r.bank.endpoint)
  );
  const others = rendered.flatMap((r) => secondaryFormats(r.bank));
  const count = (needle: string) => html.split(needle).length - 1;
  const sections = (title: string) => html.split(title).slice(1).map((s) => s.split("</details>")[0]);

  it("marks exactly the formats cheki fetches as checked, and no others", () => {
    expect(count('ep-format-tag">Still checked')).toBe(others.filter((f) => isSupportedFormat(f)).length);
    expect(count('ep-format-tag">Newer, not supported yet')).toBe(
      others.filter((f) => f.status === "current" && !isSupportedFormat(f)).length
    );
    expect(count('ep-format-tag">Retired')).toBe(others.filter((f) => f.status === "deprecated").length);
    expect(count('ep-format-tag">Not checked')).toBe(
      others.filter((f) => !isSupportedFormat(f) && f.status !== "current" && f.status !== "deprecated").length
    );
  });

  it("keeps each format in the section its support justifies", () => {
    // The tags carry the truth; these check the section titles around them
    // cannot contradict it when the manifest data changes.
    const notSupported = [
      ...sections("Also reported, not supported yet"),
      ...sections("Reported receipt host, not supported yet"),
    ];
    expect(notSupported.length).toBeGreaterThan(0);
    for (const seg of notSupported) expect(seg).not.toContain("Still checked");
    for (const seg of sections("Older receipts")) expect(seg).not.toContain("Newer, not supported yet");
  });
});

describe("source invariants", () => {
  it("no tracked caps or tinted pills in the reference stylesheet", () => {
    const css = read("src/components/reference/reference.css");
    expect(css).not.toMatch(/text-transform:\s*uppercase/);
    expect(css).not.toMatch(/letter-spacing:\s*0\.0[3-9]em/);
    expect(css).not.toMatch(/--(green|amber|red)-light/);
  });

  it("one owner per status reading: bankState and formatStatusTag, not copies in pages", () => {
    // /status's legacy-format dots read HealthStatus through bankState, and
    // /endpoints's format tag words come from formatStatusTag (both in
    // src/lib/status-view.ts). A page re-inlining either mapping is a second
    // reading that can drift from the first.
    const statusPage = read("src/app/status/page.tsx");
    expect(statusPage).toContain("bankState(r.bank, h.status)");
    expect(statusPage).not.toContain('h.status === "degraded"');
    const endpointsPage = read("src/app/endpoints/page.tsx");
    expect(endpointsPage).not.toContain('"Still checked"');
    expect(endpointsPage).not.toContain('"Newer, not supported yet"');
    expect(endpointsPage).not.toContain('"Retired"');
  });
});
