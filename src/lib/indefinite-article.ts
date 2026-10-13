/**
 * "a" or "an" before a bank or format name, by how it is said: "an M-Pesa
 * receipt", "an Awash receipt", "an eBirr receipt", "an HTML page", but "a CBE
 * receipt" and "a BOA receipt" (said "see", "bee").
 *
 * Imported by next.config.ts (through seo-redirects.ts), so no imports here.
 */
export function aOrAn(word: string): "a" | "an" {
  // Vowel sounds: a vowel letter, or a letter said with a leading vowel sound
  // when it starts an initialism or a hyphenated name (M-Pesa, HTML).
  if (/^[aeiou]/i.test(word)) return "an";
  if (/^(?:[FHLMNRSX](?:[A-Z]|-))/.test(word)) return "an";
  return "a";
}

/** The word with its article: withArticle("M-Pesa") is "an M-Pesa". */
export const withArticle = (word: string): string => `${aOrAn(word)} ${word}`;
