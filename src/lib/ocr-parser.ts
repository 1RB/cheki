import { detectBankFromUrl } from "./adapters/url-detector";
import { banks, detectBank } from "./banks";

export type OcrParseConfidence = "high" | "medium" | "low";

export interface OcrParseResult {
  reference: string;
  bank: string;
  confidence: OcrParseConfidence;
  rawText: string;
  matches?: string[];
  /** For banks that require a share URL (e.g. Awash), the detected URL if present. */
  shareUrl?: string;
  /** Human-readable note when the OCR text is not enough to verify. */
  message?: string;
}

// Ethiopian bank names and their common variants / Amharic hints.
// Order matters: more specific names should come before generic ones.
const BANK_TEXT_CLUES: { code: string; keywords: string[] }[] = [
  { code: "awash", keywords: ["AWASH BANK", "AWASHBANK", "AWASHBIRR", "አዋሽ", "IFB-KHIDMA", "SEND TO BANK", "AWASH BANK SHARE"] },
  { code: "cbe", keywords: ["COMMERCIAL BANK OF ETHIOPIA", "CBE", "ኮሜርሻል ባንክ ኦፍ ኢትዮጵያ", "CBE BIRR", "CBEBIRR"] },
  { code: "boa", keywords: ["BANK OF ABYSSINIA", "ABYSSINIA"] },
  { code: "dashen", keywords: ["DASHEN", "DASHEN SUPERAPP", "DASHEN BANK", "MONEY SUCCESSFULLY SENT", "BACK TO HOME"] },
  { code: "zemen", keywords: ["ZEMEN BANK", "ZEMEN"] },
  { code: "telebirr", keywords: ["TELEBIRR", "ETHIO TELECOM", "ETHIOTELECOM"] },
  { code: "mpesa", keywords: ["M-PESA", "MPESA", "SAFARICOM"] },
  { code: "siinqee", keywords: ["SIINQEE", "SINQEE", "SIINQEE BANK"] },
  { code: "ebirr", keywords: ["EBIRR", "NIB", "WEGAGEN", "AHADU", "KAAFI"] },
  { code: "hijra", keywords: ["HIJRA"] },
  { code: "goh", keywords: ["GOH"] },
];

export function detectBankFromText(text: string): string | null {
  const upper = text.toUpperCase();
  for (const { code, keywords } of BANK_TEXT_CLUES) {
    for (const keyword of keywords) {
      if (upper.includes(keyword.toUpperCase())) return code;
    }
  }
  return null;
}

function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"'{}|\^`\[\]]+/i);
  return match ? match[0] : null;
}

// Label-aware reference extraction. We look for the label on the same line
// followed by a delimiter, or on the immediately preceding line with the value
// on the current line.
const REFERENCE_LABELS = [
  "TRANSACTION ID",
  "TRANSACTION NUMBER",
  "REFERENCE NO",
  "REFERENCE NUMBER",
  "REF NO",
  "FT REF",
  "TRANSFER REF",
  "TRANSACTION REF",
  "FT REFERENCE",
  "TRANSFER REFERENCE",
  "TRANSACTION REFERENCE",
  "VAT RECEIPT NO",
  "VAT INVOICE NO",
  "INVOICE NO",
  "RECEIPT NO",
  "TRANSFER NO",
  "MB REF",
];

// A token must look like a reference: alphanumeric with at least one digit
// or a letter prefix, and not a common English word.
function looksLikeReference(token: string): boolean {
  if (!token || token.length < 4) return false;
  if (/^[A-Z]+$/i.test(token)) return false; // bare word like "here"
  if (/^\d+$/.test(token) && token.length < 10) return false; // small number
  return /^[A-Z0-9/\-]+$/i.test(token);
}

function extractReferenceByLabel(text: string, labels = REFERENCE_LABELS): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Search labels in the given order, each label across all lines. This lets
  // callers prefer "Transaction Ref" over "FT Ref" even if "FT Ref" appears
  // earlier in the text.
  for (const label of labels) {
    const labelRegex = new RegExp(
      `(${label.replace(/\s+/g, "\\s+")})(\\s*[:=.-])\\s*`,
      "i"
    );

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(labelRegex);
      if (match) {
        const afterLabel = line.slice(match.index! + match[0].length).trim();
        // Take the first alphanumeric token after the delimiter
        const token = afterLabel.split(/\s+/)[0].replace(/[^A-Z0-9/\-]/gi, "");
        if (looksLikeReference(token)) return token.toUpperCase();
      }

      // Label on previous line, value on current line
      if (i > 0) {
        const prevMatch = lines[i - 1].match(labelRegex);
        if (prevMatch) {
          const token = line.split(/\s+/)[0].replace(/[^A-Z0-9/\-]/gi, "");
          if (looksLikeReference(token)) return token.toUpperCase();
        }
      }
    }
  }

  return null;
}

// Preferred labels when a bank is already detected from text. Order matters:
// for Dashen we prefer the app's "Transaction Ref" over "FT Ref".
const BANK_PREFERRED_LABELS: Record<string, string[]> = {
  dashen: ["TRANSACTION REFERENCE", "TRANSACTION REF", "TRANSFER REFERENCE", "TRANSFER REF", "FT REFERENCE", "FT REF"],
  cbe: ["VAT RECEIPT NO", "VAT INVOICE NO", "REFERENCE NO", "REFERENCE NUMBER", "FT REFERENCE", "FT REF"],
  awash: ["TRANSACTION ID", "TRANSACTION NUMBER"],
};

// Reference patterns. Order matters: bank-specific, high-confidence first.
// A standalone name like "ABDULWEHAB" should NOT be matched as a BOA reference.
const OCR_PATTERNS: { bank: string; pattern: RegExp; confidence: OcrParseConfidence }[] = [
  // CBE: FT followed by 10 alphanumeric characters.
  { bank: "cbe", pattern: /\bFT[A-Z0-9]{10}\b/i, confidence: "high" },
  // Telebirr: 2-3 letter prefix + 6-8 alphanumeric.
  {
    bank: "telebirr",
    pattern: /\b(DET|CHQ|DAB|DEL|ADQ|DEP|CHG|CHA|CHB|CHC|CHD|CHE|CHF|DEB|DEC|DED|DEE|DEF|DEG|DEH|DEI|DEJ|DEK|DEM|DEN|DEO|DEQ|DER|DES|DEU|DEV|DEW|DEX|DEY|DEZ|DF)[A-Z0-9]{6,8}\b/i,
    confidence: "high",
  },
  // Awash: numeric transaction ID found near the Transaction ID label.
  { bank: "awash", pattern: /\b\d{14,18}\b/, confidence: "high" },
  // Dashen: observed PDF format (B22WDTI261620001) and app format (OBTI28455679126320660525).
  { bank: "dashen", pattern: /\b[A-Z][A-Z0-9]{2,6}\d{9,}\b/i, confidence: "high" },
  // Zemen.
  { bank: "zemen", pattern: /\bZM[A-Z0-9]{6,}\b/i, confidence: "medium" },
  // CBE Birr.
  { bank: "cbebirr", pattern: /\bCB[A-Z0-9]{6,}\b/i, confidence: "medium" },
  // Siinqee.
  { bank: "siinqee", pattern: /\b(SQ|SI)[A-Z0-9]{6,}\b/i, confidence: "medium" },
  // eBirr tenants.
  { bank: "ebirr", pattern: /\b(NIB|WEGAGEN|AHADU|KAAFI)[A-Z0-9]{6,}\b/i, confidence: "medium" },
  // M-Pesa.
  { bank: "mpesa", pattern: /\b(SA|SE|MP|ME)[A-Z0-9]{6,}\b/i, confidence: "medium" },
  // BOA: two-letter prefix followed by a digit. Require at least 6 chars
  // and avoid matching bare human names.
  { bank: "boa", pattern: /\b[A-Z]{2}\d[A-Z0-9]{5,}\b/i, confidence: "medium" },
  // Fallback CBE.
  { bank: "cbe", pattern: /\bFT[A-Z0-9]{6,}\b/i, confidence: "medium" },
];

// Bank-specific label overrides. For banks whose references are plain numbers
// (Awash) or have prefixes that clash with other banks, we require the label
// to be present in the text before matching the numeric pattern.
const BANK_LABEL_PRESENCE: Record<string, string[]> = {
  awash: ["TRANSACTION ID", "TRANSACTION NUMBER", "REFERENCE NO", "RECEIPT", "AWASH"],
};

function bankLabelPresent(text: string, bank: string): boolean {
  const labels = BANK_LABEL_PRESENCE[bank];
  if (!labels) return true;
  const upper = text.toUpperCase();
  return labels.some((l) => upper.includes(l.toUpperCase()));
}

export function parseReceiptText(text: string): OcrParseResult | null {
  const result = parseReceiptTextInternal(text);
  if (result && result.bank === "awash" && /^\d{14,18}$/.test(result.reference)) {
    return {
      ...result,
      message:
        "Awash verification requires the share link or QR code. The numeric transaction ID alone is not sufficient.",
    };
  }
  return result;
}

function parseReceiptTextInternal(text: string): OcrParseResult | null {
  const upper = text.toUpperCase();
  const bankFromText = detectBankFromText(text);

  // 0. If a receipt URL is visible in the OCR text (e.g. Awash share link),
  //    use it directly. This is the highest-confidence path.
  const urlInText = extractUrl(text);
  if (urlInText) {
    const fromUrl = detectBankFromUrl(urlInText);
    if (fromUrl) {
      const canonicalBank = fromUrl.bank === "cbe-new" ? "cbe" : fromUrl.bank;
      return {
        reference: fromUrl.reference,
        bank: canonicalBank,
        confidence: "high",
        rawText: text,
        shareUrl: urlInText,
      };
    }
  }

  // 1. Try bank-specific text clue first, then extract a reference by label
  //    or by bank-specific pattern.
  if (bankFromText) {
    const labels = BANK_PREFERRED_LABELS[bankFromText] || REFERENCE_LABELS;
    const labelRef = extractReferenceByLabel(text, labels);
    if (labelRef) {
      const detectedFromRef = detectBank(labelRef);
      const bank = detectedFromRef && detectedFromRef !== bankFromText ? detectedFromRef : bankFromText;
      return {
        reference: labelRef.toUpperCase(),
        bank,
        confidence: "high",
        rawText: text,
      };
    }

    for (const { bank, pattern, confidence } of OCR_PATTERNS) {
      if (bank !== bankFromText) continue;
      if (!bankLabelPresent(text, bank)) continue;
      const match = upper.match(pattern);
      if (match) {
        return {
          reference: match[0],
          bank,
          confidence,
          rawText: text,
          matches: match.slice(0, 5),
        };
      }
    }
  }

  // 2. Try label-based extraction even when no bank text clue is found,
  //    but only accept it when the token has a known bank prefix or is a
  //    long numeric ID (likely Awash). Never fall back to "cbe" by default.
  const labelRef = extractReferenceByLabel(text);
  if (labelRef) {
    const detectedFromRef = detectBank(labelRef);
    if (detectedFromRef) {
      return {
        reference: labelRef.toUpperCase(),
        bank: detectedFromRef,
        confidence: "high",
        rawText: text,
      };
    }
    // Long numeric ID without a known bank prefix -> assume Awash if label present
    if (/^\d{14,18}$/.test(labelRef) && bankLabelPresent(text, "awash")) {
      return {
        reference: labelRef.toUpperCase(),
        bank: "awash",
        confidence: "medium",
        rawText: text,
      };
    }
  }

  // 3. General pattern pass, skipping patterns that conflict with detected text.
  for (const { bank, pattern, confidence } of OCR_PATTERNS) {
    if (bankFromText && bankFromText !== bank) continue;
    if (!bankLabelPresent(text, bank)) continue;
    const match = upper.match(pattern);
    if (match) {
      return {
        reference: match[0],
        bank,
        confidence,
        rawText: text,
        matches: match.slice(0, 5),
      };
    }
  }

  // 4. Manifest refPattern fallback. Only accept if the bank is detected
  //    from text or the reference itself has a known prefix. Avoid guessing.
  for (const b of banks) {
    if (b.refPattern) {
      const source = b.refPattern.source.startsWith("^")
        ? b.refPattern.source.slice(1)
        : b.refPattern.source;
      const pattern = new RegExp(`\\b${source}\\b`, b.refPattern.flags);
      const match = upper.match(pattern);
      if (match && looksLikeReference(match[0])) {
        const bank = bankFromText || detectBank(match[0]) || b.code;
        return {
          reference: match[0],
          bank,
          confidence: "medium",
          rawText: text,
        };
      }
    }
  }

  return null;
}

export function parseReceiptReferenceOnly(reference: string): { bank: string; confidence: OcrParseConfidence } | null {
  const detected = detectBank(reference);
  if (detected) return { bank: detected, confidence: "high" };
  return null;
}

/**
 * Given a reference, return a list of candidate references for ambiguous
 * characters (0/O, 1/I, 5/S, 8/B). Useful for OCR post-correction.
 */
export function ambiguousReferenceCandidates(reference: string): string[] {
  const ambiguous: Record<string, string[]> = {
    "0": ["O"],
    "O": ["0"],
    "1": ["I", "L"],
    "I": ["1", "L"],
    "L": ["1", "I"],
    "5": ["S"],
    "S": ["5"],
    "8": ["B"],
    "B": ["8"],
  };

  const candidates: string[] = [reference];
  for (let i = 0; i < reference.length; i++) {
    const char = reference[i].toUpperCase();
    const replacements = ambiguous[char];
    if (replacements) {
      for (const replacement of replacements) {
        candidates.push(reference.slice(0, i) + replacement + reference.slice(i + 1));
      }
    }
  }

  return Array.from(new Set(candidates));
}
