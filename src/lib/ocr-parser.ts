import { banks, detectBank } from "./banks";

export type OcrParseConfidence = "high" | "medium" | "low";

export interface OcrParseResult {
  reference: string;
  bank: string;
  confidence: OcrParseConfidence;
  rawText: string;
  matches?: string[];
}

// OCR patterns: look for reference-like tokens inside larger receipt text.
const OCR_PATTERNS: { bank: string; pattern: RegExp; confidence: OcrParseConfidence }[] = [
  { bank: "cbe", pattern: /\bFT[A-Z0-9]{10}\b/i, confidence: "high" },
  {
    bank: "telebirr",
    pattern: /\b(DET|CHQ|DAB|DEL|ADQ|DEP|CHG|CHA|CHB|CHC|CHD|CHE|CHF|DEB|DEC|DED|DEE|DEF|DEG|DEH|DEI|DEJ|DEK|DEM|DEN|DEO|DEQ|DER|DES|DEU|DEV|DEW|DEX|DEY|DEZ|DF)[A-Z0-9]{6,8}\b/i,
    confidence: "high",
  },
  { bank: "boa", pattern: /\b(AB|BOA)[A-Z0-9]{6,}\b/i, confidence: "medium" },
  { bank: "mpesa", pattern: /\b(SA|SE|MP|ME)[A-Z0-9]{6,}\b/i, confidence: "medium" },
  { bank: "dashen", pattern: /\b[A-Z]\d{2}[A-Z]{2,4}\d{9,12}\b/i, confidence: "high" },
  { bank: "zemen", pattern: /\bZM[A-Z0-9]{6,}\b/i, confidence: "medium" },
  { bank: "cbebirr", pattern: /\bCB[A-Z0-9]{6,}\b/i, confidence: "medium" },
  { bank: "siinqee", pattern: /\b(SQ|SI)[A-Z0-9]{6,}\b/i, confidence: "medium" },
  { bank: "ebirr", pattern: /\b(NIB|WEGAGEN|AHADU|KAAFI)[A-Z0-9]{6,}\b/i, confidence: "medium" },
  // Fallback: any FT reference (often found in BOA inter-bank transfers too)
  { bank: "cbe", pattern: /\bFT[A-Z0-9]{6,}\b/i, confidence: "medium" },
];

export function parseReceiptText(text: string): OcrParseResult | null {
  const upper = text.toUpperCase();

  // 1. Try bank-specific patterns first
  for (const { bank, pattern, confidence } of OCR_PATTERNS) {
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

  // 2. Use manifest refPatterns as a secondary pass (re-anchored to word boundaries)
  for (const b of banks) {
    if (b.refPattern) {
      const source = b.refPattern.source.startsWith("^")
        ? b.refPattern.source.slice(1)
        : b.refPattern.source;
      const pattern = new RegExp(`\\b${source}\\b`, b.refPattern.flags);
      const match = upper.match(pattern);
      if (match) {
        return {
          reference: match[0],
          bank: b.code,
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
