/**
 * Central allowlist of hosts cheki's server may contact for receipts.
 *
 * Derived from the manifest (see allowedHosts). Every bank fetch goes
 * through `assertAllowedUrl`, so a parser bug or a crafted reference can never
 * turn cheki into a proxy for an arbitrary URL (SSRF).
 *
 * The comparison is on `URL.host` (hostname plus any non-default port), so
 * `awashpay.awashbank.com:8225` is allowed and `awashpay.awashbank.com:22` is
 * not.
 */
import { getAllBanks } from "../manifest/loader";
import { supportedFormats, templateHost } from "../manifest/formats";

/**
 * Built from the manifest: every bank's top-level `endpoint` plus the
 * `endpoint` of every supported format (current and legacy), so an older
 * receipt still verifies after a bank switches hosts. Deprecated formats and
 * formats without a parser are not fetched, so their hosts are not added
 * (old Dashen Super App links are only read for their reference and rebuilt
 * on the current host).
 */
let cached: Set<string> | null = null;

export function allowedHosts(): Set<string> {
  if (cached) return cached;
  const hosts = new Set<string>();
  for (const bank of getAllBanks()) {
    const top = templateHost(bank.endpoint);
    if (top) hosts.add(top);
    for (const f of supportedFormats(bank)) {
      const h = templateHost(f.endpoint);
      if (h) hosts.add(h);
    }
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
