/**
 * cheki - free ethiopian receipt verification client
 *
 * Usage:
 *   import { Cheki } from "cheki";
 *   const cheki = new Cheki("https://chekiapp.vercel.app");
 *   const result = await cheki.verify("cbe", "FT26140P01YB", { accountNumber: "1000560536171" });
 */

export interface VerifyOptions {
  accountNumber?: string;
  phoneNumber?: string;
}

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
}

export interface BankInfo {
  code: string;
  name: string;
  status: "live" | "geo-blocked" | "coming_soon";
  requiresAccount: boolean;
  accountDigits?: number;
  requiresPhone: boolean;
  responseType: string;
  endpoint: string;
  note?: string;
}

export interface BatchResult {
  success: boolean;
  total: number;
  verified: number;
  failed: number;
  results: (VerifyResult & { index: number })[];
}

export interface HealthStatus {
  success: boolean;
  status: "ok" | "degraded" | "down";
  version: string;
  timestamp: string;
  checks: { name: string; status: string; latencyMs?: number }[];
}

export class Cheki {
  constructor(private baseUrl: string = "https://chekiapp.vercel.app") {}

  async verify(bank: string, reference: string, options?: VerifyOptions): Promise<VerifyResult> {
    const resp = await fetch(`${this.baseUrl}/api/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bank,
        reference,
        accountNumber: options?.accountNumber,
        phoneNumber: options?.phoneNumber,
      }),
    });
    return resp.json();
  }

  async verifyBatch(
    receipts: { bank: string; reference: string; accountNumber?: string; phoneNumber?: string }[]
  ): Promise<BatchResult> {
    const resp = await fetch(`${this.baseUrl}/api/verify/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receipts }),
    });
    return resp.json();
  }

  async getBanks(): Promise<{ success: boolean; count: number; banks: BankInfo[] }> {
    const resp = await fetch(`${this.baseUrl}/api/banks`);
    return resp.json();
  }

  async getHealth(): Promise<HealthStatus> {
    const resp = await fetch(`${this.baseUrl}/api/health`);
    return resp.json();
  }

  getReceiptUrl(bank: string, reference: string, accountNumber?: string): string {
    const params = new URLSearchParams({ bank, reference });
    if (accountNumber) params.set("account", accountNumber);
    return `${this.baseUrl}/api/receipt?${params}`;
  }
}

export default Cheki;
