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
import { getParser } from "./parsers/registry";
import "./parsers";

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
  const text = r.body.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
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
    const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    hint = (title || text.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  }
  hint = hint.slice(0, 80);
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
}

export function buildProbeTargets(opts: { checkGeoRestricted: boolean }): ProbeTarget[] {
  return getEndpointRows().map(({ bank, doc }) => {
    const base = { id: bank.id, label: doc.label, bank };
    if ("skip" in doc.probe) return { ...base, skip: doc.probe.skip };
    if (bank.geoBlocked && !opts.checkGeoRestricted) return { ...base, skip: "geo-restricted" as const };
    const parser = getParser(doc.probe.parser ?? bank.id);
    if (!parser) return { ...base, skip: "no-endpoint" as const };
    return {
      ...base,
      probe: doc.probe,
      url: parser.buildUrl(doc.probe.ref, doc.probe.account, doc.probe.phone),
      headers: doc.probe.useManifestHeaders ? bank.headers : undefined,
    };
  });
}

/** Turns one probe outcome into a status row. */
export function evaluate(
  t: ProbeTarget,
  outcome: { response?: ObservedResponse; error?: string },
  checkedAt: string,
): BankHealth {
  const base = { id: t.id, label: t.label, manifestStatus: t.bank.status, checkedAt };
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
