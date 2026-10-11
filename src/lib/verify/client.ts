/**
 * Browser calls to /api/verify and /api/parse. Every response goes through
 * readVerifyResponse (429 / 413 / 5xx / non-JSON handled there); a request
 * that never got an answer becomes { success: false, httpStatus: 0 }, which
 * presentVerdict shows as "offline", never as a judgement on the receipt.
 */
import type { VerifyResult } from "@/lib/banks";
import { readVerifyResponse } from "@/lib/verify-response";

export const OFFLINE_MESSAGE = "No connection. Check your internet and try again.";

export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export async function postJson(endpoint: "/api/verify" | "/api/parse", body: Record<string, unknown>, signal?: AbortSignal): Promise<VerifyResult> {
  if (isOffline()) return { success: false, verified: false, httpStatus: 0, error: OFFLINE_MESSAGE };
  let resp: Response;
  try {
    resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") throw e;
    return { success: false, verified: false, httpStatus: 0, error: OFFLINE_MESSAGE };
  }
  return readVerifyResponse(resp);
}
