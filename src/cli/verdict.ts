/**
 * What the CLI prints first, and its exit code, for a receipt result. Only a
 * bank-confirmed receipt (`verified: true`) is reported as verified and exits
 * 0. A BOA QR the bank could not confirm (`decodedOnly`) is printed as not
 * confirmed and exits 2, so scripts that check `$?` never treat it as paid.
 */
import type { Receipt } from "../lib/core/types";

export function cliVerdict(r: Pick<Receipt, "verified" | "decodedOnly">): { headline: string; exitCode: number } {
  if (r.verified === true && r.decodedOnly !== true) {
    return { headline: "Receipt verified", exitCode: 0 };
  }
  if (r.decodedOnly === true) {
    return { headline: "NOT VERIFIED: decoded from QR, not confirmed with the bank", exitCode: 2 };
  }
  return { headline: "NOT VERIFIED: the bank did not confirm this receipt", exitCode: 2 };
}
