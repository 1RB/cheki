/**
 * Bank ids that are not banks of their own: parser-only aliases and the
 * manifest bank each one refers to. `cbe-new` is CBE's current-format parser
 * (the newer receipt system), not a provider, so any consumer holding an id
 * that came from a parser, an OCR read or a URL canonicalises it here before
 * treating it as a bank: lookups (detect, verdict), the verify UI's bank
 * override, and reference-case's rule keys. The parser-only filters in
 * src/lib/banks.ts and src/lib/bank-counts.ts derive from the same map's
 * keys, so an alias is declared exactly once.
 *
 * Bank-id contexts only: parser lookups must keep the parser's own id
 * (getParser("cbe-new") resolves to the CBENewParser).
 */
const ALIASES: Record<string, string> = { "cbe-new": "cbe" };

/** Parser-only ids: no page, no provider count; documented on their bank's panel. */
export const PARSER_ONLY_IDS: ReadonlySet<string> = new Set(Object.keys(ALIASES));

/**
 * The manifest bank code an id refers to. Unknown ids pass through, trimmed
 * and lowercased, so a URL param or a typed code still resolves to a bank.
 */
export function canonicalBankCode(code: string | undefined | null): string {
  const id = String(code ?? "").trim().toLowerCase();
  return ALIASES[id] ?? id;
}
