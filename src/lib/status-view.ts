/**
 * What /status and /endpoints say about a bank, in the reader's words.
 *
 * The health check (src/lib/health.ts) records a probe outcome. A merchant
 * asks a different question: "can I check a <bank> receipt right now?" This
 * maps one onto the other, from status.json and the manifest only (no bank
 * data is written here).
 *
 *   working      a live bank whose endpoint answered the daily probe as expected
 *   down         a live bank whose endpoint was unreachable or answered differently
 *   geo          a live bank that only answers Ethiopian networks, so the
 *                cloud probe (outside Ethiopia) cannot see it
 *   unsupported  cheki does not check this bank's receipts yet (in development)
 *
 * There is no "slow": status.json records no latency today. When it does,
 * this is the one place to add it.
 */
import type { BankManifestEntry } from "./core/types";
import type { BankHealth, HealthStatus } from "./health";

export type BankState = "working" | "down" | "geo" | "unsupported";

export const STATE_LABEL: Record<BankState, string> = {
  working: "Working",
  down: "Down",
  geo: "Geo-restricted",
  unsupported: "Not supported yet",
};

/** One sentence under the label: what the state means for a check right now. */
export function stateMeaning(state: BankState, bank: string, measuredFrom: string): string {
  switch (state) {
    case "working":
      return `cheki can check ${bank} receipts. The endpoint answered the daily probe in the expected shape.`;
    case "down":
      return `${bank} checks may fail right now: the endpoint did not answer the daily probe as expected. A failed check says "couldn't check", never "fake".`;
    case "geo":
      return `${bank} only answers Ethiopian networks, so the probe from ${measuredFrom} cannot reach it. From an Ethiopian network, checks usually work.`;
    case "unsupported":
      return `cheki does not check ${bank} receipts yet, whatever its endpoint does.`;
  }
}

export function bankState(bank: Pick<BankManifestEntry, "status" | "geoBlocked">, status: HealthStatus): BankState {
  if (bank.status !== "live") return "unsupported";
  if (status === "degraded") return "down";
  if (status === "not-checked") return bank.geoBlocked ? "geo" : "working";
  return "working";
}

/** The dot's tone. Green is "answering as expected", nothing stronger. */
export function stateTone(state: BankState): "green" | "red" | "amber" | "neutral" {
  return state === "working" ? "green" : state === "down" ? "red" : state === "geo" ? "amber" : "neutral";
}

export interface StatusSummary {
  live: number;
  working: number;
  down: number;
  geo: number;
  tone: "green" | "amber" | "red" | "neutral";
}

export function summarize(states: BankState[]): StatusSummary {
  const live = states.filter((s) => s !== "unsupported");
  const working = live.filter((s) => s === "working").length;
  const down = live.filter((s) => s === "down").length;
  const geo = live.filter((s) => s === "geo").length;
  const tone = live.length === 0 ? "neutral" : down === live.length ? "red" : down > 0 ? "amber" : "green";
  return { live: live.length, working, down, geo, tone };
}

/** "Telebirr and M-Pesa", "CBE, BOA and Dashen". */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** "Oregon, US" from "manual run (Oregon, US)"; the runner name otherwise. */
export function measuredFrom(runner: string): string {
  const m = /\(([^)]+)\)\s*$/.exec(runner);
  if (m && !/ubuntu|latest|windows|macos/i.test(m[1])) return m[1];
  if (/github actions/i.test(runner)) return "GitHub's cloud (outside Ethiopia)";
  return runner;
}

/** status.json older than this is flagged "may be stale" (CI runs daily). */
export const STALE_AFTER_MS = 36 * 60 * 60 * 1000;

export function isStale(generatedAt: string | undefined, now: number): boolean {
  if (!generatedAt) return true;
  const t = Date.parse(generatedAt);
  return Number.isNaN(t) || now - t > STALE_AFTER_MS;
}

/** Health rows for a bank's older formats ("<bank>:<formatId>"). */
export function legacyHealth(all: BankHealth[], bankId: string): BankHealth[] {
  return all.filter((h) => h.id.startsWith(`${bankId}:`));
}
