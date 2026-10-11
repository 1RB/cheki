/**
 * Endpoint health check: sends each bank a known-fake reference and checks
 * that the error comes back in the expected shape. A changed shape usually
 * means the bank moved its endpoint or changed its receipt format.
 *
 * Pure logic lives here so it can be unit tested; scripts/health-check.ts
 * does the network calls and writes public/status.json.
 */
import { getEndpointRows, type ProbeExpectation, type ProbeSpec } from "./manifest/endpoints";
import type { BankManifestEntry } from "./core/types";
import { primaryFormat } from "./manifest/formats";
import { getParser } from "./parsers/registry";
import "./parsers";
import { removeScriptsAndStyles, TAG_RE } from "./core/html";

export type HealthStatus = "live" | "in-development" | "degraded" | "not-checked";

export interface ObservedResponse {
  status: number;
  contentType: string;
  body: string;
}

export interface BankHealth {
  id: string;
  label: string;
  manifestStatus: BankManifestEntry["status"];
  status: HealthStatus;
  /** Plain-language reason, shown on /status. */
  detail: string;
  /** Short description of what came back, e.g. `400 application/json "Transaction not found"`. */
  observed?: string;
  checkedAt: string;
  /** Set on rows for a bank's older format ("<bank>:<formatId>"). A legacy host being down never fails the run. */
  formatStatus?: "legacy";
}

export interface StatusFile {
  generatedAt: string;
  runner: string;
  checkedGeoRestricted: boolean;
  banks: BankHealth[];
}

/** ISO 8601 UTC timestamp built from the clock fields (no locale formatting). */
export function isoNow(d: Date = new Date()): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}Z`;
}

export function describeResponse(r: ObservedResponse): string {
  const ct = r.contentType.split(";")[0].trim() || "no content type";
  // Linear helpers: the body is untrusted and the lazy/`[^>]+` regexes are
  // quadratic on unclosed tags.
  const text = removeScriptsAndStyles(r.body.slice(0, 64 * 1024));
  let hint = "";
  const json = (() => {
    try {
      return JSON.parse(r.body) as Record<string, unknown>;
    } catch {
      return null;
    }
  })();
  if (json && typeof json === "object") {
    const msg = json.detail ?? json.messages ?? json.message ?? json.error;
    if (typeof msg === "string") hint = msg;
    else if (json.body !== undefined) hint = JSON.stringify(json.body);
  }
  if (!hint) {
    const lower = text.toLowerCase();
    const open = lower.indexOf("<title");
    const gt = open === -1 ? -1 : lower.indexOf(">", open);
    const close = gt === -1 ? -1 : lower.indexOf("</title", gt);
    const title = close === -1 ? undefined : text.slice(gt + 1, close);
    hint = (title || text.replace(TAG_RE, " ")).replace(/\s+/g, " ").trim();
  }
  // Committed to a public repo and shown on /status: no control characters.
  hint = hint.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ").slice(0, 80);
  return `${r.status} ${ct}${hint ? ` "${hint}"` : ""}`;
}

/** Returns the list of mismatches; empty means the shape matched. */
export function matchExpectation(r: ObservedResponse, e: ProbeExpectation): string[] {
  const problems: string[] = [];
  if (e.status !== undefined && r.status !== e.status) problems.push(`expected HTTP ${e.status}, got ${r.status}`);
  if (e.contentType && !r.contentType.toLowerCase().includes(e.contentType.toLowerCase())) {
    problems.push(`expected content type ${e.contentType}, got ${r.contentType || "none"}`);
  }
  for (const s of e.bodyIncludes ?? []) {
    if (!r.body.includes(s)) problems.push(`body is missing "${s}"`);
  }
  if (e.status === undefined && r.status >= 500) problems.push(`server error HTTP ${r.status}`);
  return problems;
}

export interface ProbeTarget {
  id: string;
  label: string;
  bank: BankManifestEntry;
  url?: string;
  headers?: Record<string, string>;
  probe?: ProbeSpec;
  skip?: "no-endpoint" | "geo-restricted";
  formatStatus?: "legacy";
}

/** Headers of the manifest format a parser reads (falls back to the bank's own headers). */
function headersFor(bank: BankManifestEntry, parserId: string): Record<string, string> | undefined {
  return bank.formats?.find((f) => f.parser === parserId)?.headers ?? bank.headers;
}

export function buildProbeTargets(opts: { checkGeoRestricted: boolean }): ProbeTarget[] {
  return getEndpointRows().flatMap(({ bank, doc }) => {
    const base = { id: bank.id, label: doc.label, bank };
    const legacy: ProbeTarget[] = (doc.legacy ?? []).flatMap((l) => {
      if (!l.probe) return [];
      const lp = getParser(l.probe.parser ?? bank.id);
      if (!lp) return [];
      return [{
        id: `${bank.id}:${l.formatId}`,
        label: `${doc.label} (legacy: ${bank.formats?.find((f) => f.id === l.formatId)?.label ?? l.formatId})`,
        bank,
        formatStatus: "legacy" as const,
        probe: l.probe,
        url: lp.buildUrl(l.probe.ref, l.probe.account, l.probe.phone),
        headers: l.probe.useManifestHeaders ? headersFor(bank, lp.bankId) : undefined,
      }];
    });
    if ("skip" in doc.probe) return [{ ...base, skip: doc.probe.skip }, ...legacy];
    if (bank.geoBlocked && !opts.checkGeoRestricted) return [{ ...base, skip: "geo-restricted" as const }, ...legacy];
    // The bank's row probes its current format: the probe's parser defaults to
    // the primary (current) format's parser, so a format switch in banks.json
    // moves the probe with it.
    const parser = getParser(doc.probe.parser ?? primaryFormat(bank)?.parser ?? bank.id);
    if (!parser) return [{ ...base, skip: "no-endpoint" as const }, ...legacy];
    return [
      {
        ...base,
        probe: doc.probe,
        url: parser.buildUrl(doc.probe.ref, doc.probe.account, doc.probe.phone),
        headers: doc.probe.useManifestHeaders ? headersFor(bank, parser.bankId) : undefined,
      },
      ...legacy,
    ];
  });
}

/** Turns one probe outcome into a status row. */
export function evaluate(
  t: ProbeTarget,
  outcome: { response?: ObservedResponse; error?: string },
  checkedAt: string,
): BankHealth {
  const base = { id: t.id, label: t.label, manifestStatus: t.bank.status, checkedAt, ...(t.formatStatus ? { formatStatus: t.formatStatus } : {}) };
  if (t.skip === "geo-restricted") {
    return { ...base, status: "not-checked", detail: "Geo-restricted to Ethiopian IPs, not checked from CI." };
  }
  if (t.skip === "no-endpoint") {
    return { ...base, status: "in-development", detail: "No public receipt endpoint known yet." };
  }
  if (outcome.error || !outcome.response) {
    return { ...base, status: "degraded", detail: `Endpoint unreachable: ${outcome.error ?? "no response"}.` };
  }
  const problems = matchExpectation(outcome.response, t.probe?.expect ?? {});
  const observed = describeResponse(outcome.response);
  if (problems.length > 0) {
    return { ...base, status: "degraded", detail: `Unknown-reference response changed: ${problems.join("; ")}.`, observed };
  }
  return {
    ...base,
    status: t.bank.status === "live" ? "live" : "in-development",
    detail: t.bank.status === "live" ? "Endpoint answers in the expected shape." : "Endpoint answers in the expected shape. Parser still needs a real receipt.",
    observed,
  };
}
