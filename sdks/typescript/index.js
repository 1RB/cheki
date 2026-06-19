"use strict";
/**
 * cheki — free ethiopian receipt verification client
 *
 * Usage:
 *   import { Cheki } from "cheki";
 *   const cheki = new Cheki("https://cheki-pi.vercel.app");
 *   const result = await cheki.verify("cbe", "FT26140P01YB", { accountNumber: "1000560536171" });
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cheki = void 0;
class Cheki {
    constructor(baseUrl = "https://cheki-pi.vercel.app") {
        this.baseUrl = baseUrl;
    }
    async verify(bank, reference, options) {
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
    async verifyBatch(receipts) {
        const resp = await fetch(`${this.baseUrl}/api/verify/batch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ receipts }),
        });
        return resp.json();
    }
    async getBanks() {
        const resp = await fetch(`${this.baseUrl}/api/banks`);
        return resp.json();
    }
    async getHealth() {
        const resp = await fetch(`${this.baseUrl}/api/health`);
        return resp.json();
    }
    getReceiptUrl(bank, reference, accountNumber) {
        const params = new URLSearchParams({ bank, reference });
        if (accountNumber)
            params.set("account", accountNumber);
        return `${this.baseUrl}/api/receipt?${params}`;
    }
}
exports.Cheki = Cheki;
exports.default = Cheki;
