/**
 * Post-parse verification gate.
 *
 * Every parser decides on its own whether a bank response "looks like" a
 * receipt, and several of those checks were far too loose (an empty JSON
 * object, a page with only the bank name, a failed transfer). This gate runs
 * after every parser, for every bank, and fails closed: `verified: true` is
 * only allowed when all of these hold.
 *
 *   1. A finite amount greater than zero.
 *   2. When the bank returns a reference, it matches the one requested
 *      (case and whitespace are ignored). Banks whose public link uses an
 *      opaque share token instead of the transaction reference are exempt.
 *   3. At least one party: a payer or a receiver (name or account).
 *   4. The transaction status, when the bank gives one, is not a known
 *      failure or non-final state (Failed, Reversed, Pending, Cancelled, ...).
 */
import type { ParsedReceipt } from "./types";
import { classifyStatus } from "./status";

/**
 * Banks whose lookup key is not the transaction reference printed on the
 * receipt, so the returned reference can never equal the requested one:
 *   - awash: the link carries a share token; the receipt prints a numeric
 *     Transaction ID.
 *   - ebirr / siinqee: the link carries an opaque token.
 */
const REFERENCE_IS_OPAQUE_TOKEN = new Set(["awash", "ebirr", "siinqee"]);

export type GateFailure = "amount" | "reference" | "party" | "status";

export type GateResult =
  | { ok: true }
  | { ok: false; reason: GateFailure; detail?: string };

export function normalizeReference(ref: string | undefined | null): string {
  return String(ref ?? "").replace(/\s+/g, "").toUpperCase();
}

function present(v: unknown): boolean {
  return typeof v === "string" ? v.trim().length > 0 : false;
}

export function verificationGate(
  parsed: ParsedReceipt,
  ctx: { bankId: string; requestedReference?: string }
): GateResult {
  if (!parsed || parsed.verified !== true) {
    return { ok: false, reason: "party", detail: "parser did not accept the response" };
  }

  const amount = parsed.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: "amount" };
  }

  if (!REFERENCE_IS_OPAQUE_TOKEN.has(ctx.bankId.toLowerCase())) {
    const returned = normalizeReference(parsed.reference);
    const requested = normalizeReference(ctx.requestedReference);
    if (returned && requested && returned !== requested) {
      return { ok: false, reason: "reference", detail: String(parsed.reference).slice(0, 64) };
    }
  }

  const hasParty =
    present(parsed.senderName) ||
    present(parsed.receiverName) ||
    present(parsed.senderAccount) ||
    present(parsed.receiverAccount);
  if (!hasParty) {
    return { ok: false, reason: "party" };
  }

  if (classifyStatus(parsed.transactionStatus) === "failure") {
    return { ok: false, reason: "status", detail: String(parsed.transactionStatus).slice(0, 40) };
  }

  return { ok: true };
}

/** User-facing message for a gate failure. No em-dashes in this copy. */
export function gateFailureMessage(result: Extract<GateResult, { ok: false }>): string {
  switch (result.reason) {
    case "status":
      return `The bank lists this transaction as "${result.detail}". It is not a completed payment.`;
    case "reference":
      return "The bank returned a receipt with a different reference than the one you entered.";
    case "amount":
      return "The bank's response has no valid amount, so it cannot be confirmed as a receipt.";
    case "party":
    default:
      return "The bank's response is missing the payer and receiver, so it cannot be confirmed as a receipt.";
  }
}
