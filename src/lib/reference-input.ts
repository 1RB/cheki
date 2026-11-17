/**
 * Reading a request's reference, once.
 *
 * Two places turn an incoming request into what the bank is actually asked:
 * the verifier (which fetches) and the cache key (which must name exactly the
 * fetch the verifier will make, or the same receipt is fetched twice and the
 * wrong entry can be served). Both used to write this out by hand, twice.
 *
 * Two steps, in this order:
 *
 *   1. A receipt link is read into (bank, reference, accountNumber,
 *      phoneNumber). Anything with URL syntax that is not a proper http(s)
 *      link to a host cheki knows is rejected here: never fetched, never
 *      used as a reference. "http:/x", "http:evil.com" and "//x" all land
 *      on `unrecognised-link`.
 *   2. The reference is put in its bank's canonical form (see
 *      reference-case.ts): uppercased for a bank that prints capitals,
 *      separators dropped only when the reference was typed, because a
 *      link's own spelling is the bank's.
 *
 * `fromLink` says which of those two the reference is. No API route sets it:
 * both routes build VerifyRequest field by field from JSON, so the only code
 * that can is this module (it read a link) and the verifier's QR branches
 * (a QR printed the reference).
 */
import { detectBankFromUrl, isUrl, looksLikeUrl } from "./adapters/url-detector";
import { canonicalReference } from "./reference-case";
import type { DetectedReceipt } from "./adapters/url-detector";

/** The request fields that decide what the bank is asked for. */
export interface ReferenceInput {
  bank?: string;
  reference?: string;
  accountNumber?: string;
  phoneNumber?: string;
  /**
   * The reference came from a receipt link or a QR payload, not a keyboard:
   * canonicalReference() then uppercases it but never drops its separators.
   * Set by this module and by the verifier's QR branches; see the module
   * comment.
   */
  fromLink?: boolean;
}

/** The request after its reference has been read: what the bank is asked. */
export interface ResolvedReference {
  bank?: string;
  reference: string;
  accountNumber?: string;
  phoneNumber?: string;
  /**
   * Already applied to `reference` above. It travels with the result so the
   * result can be resolved again without being compacted on the second pass.
   */
  fromLink: boolean;
}

export type ReferenceRead =
  /** A receipt link cheki recognises; `link` is what the link itself said. */
  | { kind: "link"; link: DetectedReceipt; input: ResolvedReference }
  /** No URL syntax: a typed reference, or one a QR printed. */
  | { kind: "not-a-link"; input: ResolvedReference }
  /** URL syntax cheki does not recognise: reject, never fetch. */
  | { kind: "unrecognised-link" };

/**
 * Read the reference out of a request, or report that its URL syntax is not
 * a receipt link cheki knows. Pure: the verifier and the cache key call it
 * on the same input and get the same answer.
 */
export function resolveReference(input: ReferenceInput): ReferenceRead {
  const reference = (input.reference ?? "").trim();
  const accountNumber = input.accountNumber?.trim() || undefined;
  const phoneNumber = input.phoneNumber?.trim() || undefined;

  if (looksLikeUrl(reference)) {
    const link = isUrl(reference) ? detectBankFromUrl(reference) : null;
    if (!link) return { kind: "unrecognised-link" };
    return {
      kind: "link",
      link,
      input: {
        bank: link.bank,
        // A link's reference is never compacted: whatever the bank put in
        // its own URL is what it is looked up by.
        reference: canonicalReference(link.bank, link.reference, { compact: false }),
        // What was typed wins; the link only fills what is missing. The one
        // place that does the opposite is the CBE Birr QR branch, where the
        // pair the QR was issued for is the only pair the bank answers for.
        accountNumber: accountNumber ?? (link.accountNumber || undefined),
        phoneNumber: phoneNumber ?? (link.phoneNumber || undefined),
        fromLink: true,
      },
    };
  }

  return {
    kind: "not-a-link",
    input: {
      bank: input.bank,
      // Already canonical, and canonicalReference() is idempotent for the
      // same flags, so resolving this result again changes nothing.
      reference: canonicalReference(input.bank, reference, { compact: input.fromLink !== true }),
      accountNumber,
      phoneNumber,
      fromLink: input.fromLink === true,
    },
  };
}
