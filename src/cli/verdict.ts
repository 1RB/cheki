/**
 * What the CLI prints first, and its exit code, for a receipt result. Only a
 * bank-confirmed receipt is reported as verified and exits 0. A BOA QR the
 * bank could not confirm (`decodedOnly`) is printed as not confirmed and exits
 * 2, so scripts that check `$?` never treat it as paid.
 *
 * The verdict is `verificationState()`'s, never a local read of the flags: the
 * CLI, the batch count, the SDKs and the UI all decide "is this verified" with
 * the one function. A `Receipt` only exists once the request was handled, so
 * its success is true here.
 */
import { verificationState } from "../lib/banks";
import type { Receipt } from "../lib/core/types";

export function cliVerdict(r: Pick<Receipt, "verified" | "decodedOnly">): { headline: string; exitCode: number } {
  switch (verificationState({ ...r, success: true })) {
    case "verified":
      return { headline: "Receipt verified", exitCode: 0 };
    case "decodedOnly":
      return { headline: "NOT VERIFIED: decoded from QR, not confirmed with the bank", exitCode: 2 };
    default:
      // "parsed" (content someone pasted) and "none" (no confirmation).
      return { headline: "NOT VERIFIED: the bank did not confirm this receipt", exitCode: 2 };
  }
}
