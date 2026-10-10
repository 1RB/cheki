/**
 * Reads public/status.json, written daily by the endpoint health check
 * (.github/workflows/endpoint-health.yml). The same file is served at
 * https://cheki.et/status.json.
 */
import statusData from "../../public/status.json";
import type { BankHealth, HealthStatus, StatusFile } from "./health";
import type { BankManifestEntry } from "./core/types";

export const statusFile = statusData as StatusFile;

const byId = new Map<string, BankHealth>(statusFile.banks.map((b) => [b.id, b]));

export function getBankHealth(id: string): BankHealth | undefined {
  return byId.get(id);
}

/** Health status for a bank, falling back to its manifest status when it has not been checked yet. */
export function healthStatusFor(bank: BankManifestEntry): HealthStatus {
  return byId.get(bank.id)?.status ?? (bank.status === "live" ? "live" : "in-development");
}

/** "2026-10-10 18:08 UTC", stable across server and client renders. */
export function formatCheckedAt(iso: string | undefined): string {
  if (!iso) return "Not yet";
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]} UTC` : iso;
}
