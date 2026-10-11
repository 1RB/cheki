/**
 * Central allowlist of hosts cheki's server may contact for receipts.
 *
 * Built from the manifest `endpoint` of every bank plus the few receipt hosts
 * the parsers use that the manifest does not spell out. Every bank fetch goes
 * through `assertAllowedUrl`, so a parser bug or a crafted reference can never
 * turn cheki into a proxy for an arbitrary URL (SSRF).
 *
 * The comparison is on `URL.host` (hostname plus any non-default port), so
 * `awashpay.awashbank.com:8225` is allowed and `awashpay.awashbank.com:22` is
 * not.
 */
import { getAllBanks } from "../manifest/loader";

/** Receipt hosts used by parsers or routes that the manifest does not list. */
const EXTRA_HOSTS = [
  // CBE new receipt API (manifest writes it as "Mb.cbe.com.et").
  "mb.cbe.com.et",
  // eBirr white-label receipts (Siinqee, Nib, Wegagen, ...).
  "receipt.ebirr.com",
  // Dashen's receipt host (receipts.dashenbanksc.com) comes from the manifest.
  // The legacy dashensuperapp.com hosts are not fetched: links to them are
  // only read for their reference and rebuilt on the manifest host.
];

let cached: Set<string> | null = null;

function hostOf(endpoint: string): string | null {
  if (!/^https:\/\//i.test(endpoint)) return null;
  try {
    // Placeholders like {ref} are not valid in a hostname; swap them out first.
    const url = new URL(endpoint.replace(/\{[^}]*\}/g, "x"));
    return url.host.toLowerCase();
  } catch {
    return null;
  }
}

export function allowedHosts(): Set<string> {
  if (cached) return cached;
  const hosts = new Set<string>(EXTRA_HOSTS);
  for (const bank of getAllBanks()) {
    const h = hostOf(bank.endpoint);
    if (h) hosts.add(h);
  }
  cached = hosts;
  return hosts;
}

export class HostNotAllowedError extends Error {
  constructor() {
    super("Refusing to contact a host that is not a known bank receipt endpoint.");
    this.name = "HostNotAllowedError";
  }
}

/** True only for an https URL, without credentials, on an allowlisted host. */
export function isAllowedUrl(input: string): boolean {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  return allowedHosts().has(url.host.toLowerCase());
}

export function assertAllowedUrl(input: string): void {
  if (!isAllowedUrl(input)) throw new HostNotAllowedError();
}
