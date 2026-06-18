export const banks = [
  { code: "cbe", name: "Commercial Bank of Ethiopia", requiresAccount: true, accountLabel: "Full receiving account number", accountDigits: 8, status: "live" },
  { code: "boa", name: "Bank of Abyssinia", requiresAccount: true, accountLabel: "Full receiving account number", accountDigits: 5, status: "live" },
  { code: "telebirr", name: "Telebirr", requiresAccount: false, status: "geo" },
  { code: "mpesa", name: "M-Pesa Ethiopia", requiresAccount: false, status: "geo" },
  { code: "zemen", name: "Zemen Bank", requiresAccount: false, status: "soon" },
  { code: "dashen", name: "Dashen Bank", requiresAccount: false, status: "soon" },
  { code: "awash", name: "Awash Bank", requiresAccount: false, status: "soon" },
  { code: "cbebirr", name: "CBE Birr", requiresAccount: false, status: "soon" },
] as const;

export type BankCode = (typeof banks)[number]["code"];
export type BankStatus = "live" | "geo" | "soon";

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
