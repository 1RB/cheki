/**
 * Base parser — shared HTTP client with retries, timeout, geo-block handling.
 *
 * Each bank parser extends this class and implements:
 *   - buildUrl(ref, account?, phone?) → receipt URL
 *   - parse(data, contentType) → ParsedReceipt
 *
 * The base class handles:
 *   - HTTP fetching with configurable retries
 *   - SSL bypass for banks with broken certs (CBE, Awash)
 *   - Geo-block workaround (X-Forwarded-For, direct IP)
 *   - Timeout management
 */
import type { ParsedReceipt, HttpResult, HttpFetchOptions, Result } from "../core/types";
import { ok, err } from "../core/types";

export const MAX_RETRIES = 2;
export const RETRY_BACKOFF_MS = 1000;
export const DEFAULT_TIMEOUT_MS = 15000;
export const ETHIOPIAN_IP = "197.156.96.83";

// Direct IPs for geo-blocked services
const GEO_DIRECT_IPS: Record<string, { ip: string; host: string }> = {
  telebirr: { ip: "196.188.116.120", host: "transactioninfo.ethiotelecom.et" },
  mpesa: { ip: "102.218.49.92", host: "m-pesabusiness.safaricom.et" },
};

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

export abstract class BaseParser {
  abstract readonly bankId: string;
  abstract readonly bankName: string;
  abstract readonly responseType: "pdf" | "html" | "json";
  abstract readonly requiresAccount: boolean;
  abstract readonly accountDigits?: number;
  abstract readonly requiresPhone: boolean;
  readonly sslVerify: boolean = true;
  readonly geoBlocked: boolean = false;

  abstract buildUrl(ref: string, account?: string, phone?: string): string;
  abstract parse(data: string | Buffer, contentType: string): ParsedReceipt;

  /**
   * Fetch receipt data from the bank endpoint with retries and geo-block handling.
   */
  async fetchReceipt(
    ref: string,
    account?: string,
    phone?: string,
    options?: { fallbackUrl?: string }
  ): Promise<Result<HttpResult>> {
    const url = this.buildUrl(ref, account, phone);
    const maxRetries = MAX_RETRIES;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.doFetch(url);
        if (result.ok) return result;

        // On last attempt, return error or fallback
        if (attempt === maxRetries) {
          if (this.geoBlocked && options?.fallbackUrl) {
            return err({
              kind: "ENDPOINT_ERROR" as const,
              bank: this.bankName,
              message: "Our server can't reach this bank (it blocks cloud IPs). Open the receipt directly:",
              fallbackUrl: options.fallbackUrl,
            });
          }
          return result;
        }

        // Wait before retry (exponential backoff)
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS * Math.pow(2, attempt)));
      } catch (e) {
        if (attempt === maxRetries) {
          if (this.geoBlocked && options?.fallbackUrl) {
            return err({
              kind: "ENDPOINT_ERROR" as const,
              bank: this.bankName,
              message: "Our server can't reach this bank (it blocks cloud IPs). Open the receipt directly:",
              fallbackUrl: options.fallbackUrl,
            });
          }
          return err({
            kind: "ENDPOINT_ERROR" as const,
            bank: this.bankName,
            message: `Failed to reach ${this.bankName}: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS * Math.pow(2, attempt)));
      }
    }

    return err({
      kind: "ENDPOINT_ERROR" as const,
      bank: this.bankName,
      message: `Failed to reach ${this.bankName} after ${maxRetries + 1} attempts.`,
    });
  }

  private async doFetch(url: string): Promise<Result<HttpResult>> {
    if (this.geoBlocked) {
      return this.fetchGeoBlocked(url);
    }

    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": BROWSER_UA },
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });

      if (resp.status === 404) {
        return err({
          kind: "EXTRACTION_ERROR" as const,
          bank: this.bankName,
          message: "Receipt not found. Check the reference number.",
        });
      }

      if (resp.status >= 500) {
        return err({
          kind: "ENDPOINT_ERROR" as const,
          bank: this.bankName,
          message: `${this.bankName} server is currently unavailable (HTTP ${resp.status}).`,
        });
      }

      const contentType = resp.headers.get("content-type") || "";
      const data = this.responseType === "pdf"
        ? Buffer.from(await resp.arrayBuffer())
        : await resp.text();

      return ok({ status: resp.status, data, contentType });
    } catch (e) {
      return err({
        kind: "ENDPOINT_ERROR" as const,
        bank: this.bankName,
        message: `Network error: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  /**
   * Geo-blocked fetch: tries direct IP with X-Forwarded-For, then falls back
   * to standard fetch with spoofed headers.
   */
  private async fetchGeoBlocked(url: string): Promise<Result<HttpResult>> {
    const geoInfo = GEO_DIRECT_IPS[this.bankId];
    if (!geoInfo) {
      // Fallback to standard fetch with X-Forwarded-For
      try {
        const resp = await fetch(url, {
          headers: {
            "User-Agent": BROWSER_UA,
            "X-Forwarded-For": ETHIOPIAN_IP,
            "X-Real-IP": ETHIOPIAN_IP,
          },
          signal: AbortSignal.timeout(8000),
        });
        const contentType = resp.headers.get("content-type") || "";
        const data = await resp.text();
        return ok({ status: resp.status, data, contentType });
      } catch (e) {
        return err({
          kind: "ENDPOINT_ERROR" as const,
          bank: this.bankName,
          message: `Geo-blocked endpoint unreachable: ${e instanceof Error ? e.message : String(e)}`,
          fallbackUrl: url,
        });
      }
    }

    // Try 1: direct IP with node:https
    try {
      const https = await import("node:https");
      const http = await import("node:http");
      const directUrl = url.replace(geoInfo.host, geoInfo.ip);
      const parsedUrl = new URL(directUrl);
      const isHttps = parsedUrl.protocol === "https:";
      const lib = isHttps ? https : http;

      const responseText = await new Promise<string>((resolve, reject) => {
        const req = lib.request(
          {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: "GET",
            headers: {
              "User-Agent": BROWSER_UA,
              "X-Forwarded-For": ETHIOPIAN_IP,
              "X-Real-IP": ETHIOPIAN_IP,
              Host: geoInfo.host,
              Accept: "text/html,application/json,*/*",
            },
            rejectUnauthorized: false,
            servername: geoInfo.host,
          },
          (res: { on: (event: string, cb: (chunk?: Buffer) => void) => void }) => {
            let data = "";
            res.on("data", (c?: Buffer) => { if (c) data += c.toString(); });
            res.on("end", () => resolve(data));
          }
        );
        req.on("error", reject);
        req.setTimeout(8000, () => { req.destroy(); reject(new Error("timeout")); });
        req.end();
      });

      if (responseText && responseText.length >= 10) {
        const contentType = this.responseType === "json" ? "application/json" : "text/html";
        return ok({ status: 200, data: responseText, contentType });
      }
      throw new Error("empty response");
    } catch {
      // Try 2: standard fetch with X-Forwarded-For
      try {
        const resp = await fetch(url, {
          headers: {
            "User-Agent": BROWSER_UA,
            "X-Forwarded-For": ETHIOPIAN_IP,
            "X-Real-IP": ETHIOPIAN_IP,
          },
          signal: AbortSignal.timeout(8000),
        });
        const contentType = resp.headers.get("content-type") || "";
        const data = await resp.text();
        return ok({ status: resp.status, data, contentType });
      } catch (e) {
        return err({
          kind: "ENDPOINT_ERROR" as const,
          bank: this.bankName,
          message: `Geo-blocked endpoint unreachable: ${e instanceof Error ? e.message : String(e)}`,
          fallbackUrl: url,
        });
      }
    }
  }
}
