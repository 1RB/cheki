export const banks = [
  { code: "cbe", name: "Commercial Bank of Ethiopia", requiresAccount: true, accountLabel: "Full receiving account number", accountDigits: 8 },
  { code: "telebirr", name: "Telebirr", requiresAccount: false },
  { code: "boa", name: "Bank of Abyssinia", requiresAccount: true, accountLabel: "Full receiving account number", accountDigits: 5 },
  { code: "mpesa", name: "M-Pesa Ethiopia", requiresAccount: false },
  { code: "zemen", name: "Zemen Bank", requiresAccount: false, comingSoon: true },
  { code: "dashen", name: "Dashen Bank", requiresAccount: false, comingSoon: true },
  { code: "awash", name: "Awash Bank", requiresAccount: false, comingSoon: true },
  { code: "cbebirr", name: "CBE Birr", requiresAccount: false, comingSoon: true },
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
