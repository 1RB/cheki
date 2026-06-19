/**
 * cheki — free ethiopian receipt verification client
 *
 * Usage:
 *   import { Cheki } from "cheki";
 *   const cheki = new Cheki("https://cheki-pi.vercel.app");
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
    results: (VerifyResult & {
        index: number;
    })[];
}
export interface HealthStatus {
    success: boolean;
    status: "ok" | "degraded" | "down";
    version: string;
    timestamp: string;
    checks: {
        name: string;
        status: string;
        latencyMs?: number;
    }[];
}
export declare class Cheki {
    private baseUrl;
    constructor(baseUrl?: string);
    verify(bank: string, reference: string, options?: VerifyOptions): Promise<VerifyResult>;
    verifyBatch(receipts: {
        bank: string;
        reference: string;
        accountNumber?: string;
        phoneNumber?: string;
    }[]): Promise<BatchResult>;
    getBanks(): Promise<{
        success: boolean;
        count: number;
        banks: BankInfo[];
    }>;
    getHealth(): Promise<HealthStatus>;
    getReceiptUrl(bank: string, reference: string, accountNumber?: string): string;
}
export default Cheki;
