/**
 * The one HTTP client for bank receipt fetches.
 *
 *   - Only allowlisted hosts (see security/hosts.ts), checked on every hop.
 *   - Redirects are followed manually (max 3) so each Location is re-checked.
 *   - One total deadline for the whole request, body included.
 *   - The body is read with a byte cap; past it the stream is cancelled.
 *   - Error messages are fixed strings, so a network error can't be used as a
 *     port-scan oracle.
 */
import { assertAllowedUrl, HostNotAllowedError } from "../security/hosts";

export const MAX_TEXT_BYTES = 2 * 1024 * 1024; // HTML / JSON receipts
export const MAX_PDF_BYTES = 5 * 1024 * 1024; // PDF receipts
const MAX_REDIRECTS = 3;

export class ResponseTooLargeError extends Error {
  constructor() {
    super("The bank response was larger than expected.");
    this.name = "ResponseTooLargeError";
  }
}

export interface SafeResponse {
  status: number;
  contentType: string;
  body: Buffer;
  url: string;
}

export interface SafeFetchOptions {
  headers?: Record<string, string>;
  timeoutMs: number;
  maxBytes: number;
}

/** Read a fetch Response body into a Buffer, aborting past `maxBytes`. */
export async function readCapped(resp: Response, maxBytes: number): Promise<Buffer> {
  const declared = Number(resp.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await resp.body?.cancel().catch(() => {});
    throw new ResponseTooLargeError();
  }
  if (!resp.body) return Buffer.alloc(0);
  const reader = resp.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new ResponseTooLargeError();
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

export async function safeFetch(url: string, opts: SafeFetchOptions): Promise<SafeResponse> {
  const signal = AbortSignal.timeout(opts.timeoutMs);
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertAllowedUrl(current);
    const resp = await fetch(current, {
      headers: opts.headers,
      redirect: "manual",
      signal,
    });
    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get("location");
      await resp.body?.cancel().catch(() => {});
      if (!location) {
        return { status: resp.status, contentType: "", body: Buffer.alloc(0), url: current };
      }
      current = new URL(location, current).href;
      continue;
    }
    const body = await readCapped(resp, opts.maxBytes);
    return {
      status: resp.status,
      contentType: resp.headers.get("content-type") || "",
      body,
      url: current,
    };
  }
  throw new Error("Too many redirects.");
}

/** Fixed, non-leaky description of a fetch failure. */
export function describeFetchError(e: unknown): string {
  if (e instanceof HostNotAllowedError) return e.message;
  if (e instanceof ResponseTooLargeError) return e.message;
  if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError" || /timeout/i.test(e.message))) {
    return "The bank did not answer in time.";
  }
  return "Could not connect to the bank.";
}
