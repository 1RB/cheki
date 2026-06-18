export const banks = [
  { code: "cbe", name: "Commercial Bank of Ethiopia", shortName: "CBE", requiresAccount: true, accountLabel: "Receiving account number", accountDigits: 8, status: "live", refPattern: /^FT/i, color: "#1a5c3e" },
  { code: "boa", name: "Bank of Abyssinia", shortName: "BOA", requiresAccount: true, accountLabel: "Receiving account number", accountDigits: 5, status: "live", refPattern: /^[A-Z]{2}\d/i, color: "#7c3aed" },
  { code: "telebirr", name: "Telebirr", shortName: "Telebirr", requiresAccount: false, status: "live", refPattern: /^(DET|CHQ|DAB|DEL)/i, color: "#e8a000", geoBlocked: true },
  { code: "mpesa", name: "M-Pesa Ethiopia", shortName: "M-Pesa", requiresAccount: false, status: "live", refPattern: /^[A-Z]{2}\d{6}/i, color: "#16a34a", geoBlocked: true },
  { code: "zemen", name: "Zemen Bank", shortName: "Zemen", requiresAccount: false, status: "soon", color: "#2563eb" },
  { code: "dashen", name: "Dashen Bank", shortName: "Dashen", requiresAccount: false, status: "soon", color: "#dc2626" },
  { code: "awash", name: "Awash Bank", shortName: "Awash", requiresAccount: false, status: "soon", color: "#f59e0b" },
  { code: "cbebirr", name: "CBE Birr", shortName: "CBE Birr", requiresAccount: false, requiresPhone: true, status: "soon", color: "#0ea5e9" },
] as const;

export type BankCode = (typeof banks)[number]["code"];

export interface VerifyResult {
  success: boolean;
  error?: string;
  bank?: string;
  reference?: string;
  sourceUrl?: string;
  verified?: boolean;
  senderName?: string;
  senderAccount?: string;
  receiverName?: string;
  receiverAccount?: string;
  amount?: number;
  currency?: string;
  date?: string;
  branch?: string;
  reason?: string;
  raw?: string;
}

export function detectBank(reference: string): string | null {
  for (const b of banks) {
    if ("refPattern" in b && b.refPattern) {
      try {
        if (b.refPattern.test(reference)) return b.code;
      } catch {}
    }
  }
  return null;
}
