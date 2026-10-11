/**
 * Read a /api/verify or /api/parse response in the browser.
 *
 * The API answers 429 (per-IP rate limit, with Retry-After) and 413 (body too
 * large) with JSON, but a proxy or the platform can answer either one, or a
 * 5xx, with HTML. `resp.json()` would then throw and the UI would say
 * "Network error". This always returns a VerifyResult, and only ever one with
 * `success: false` for an error status, so nothing upstream can show green
 * for it. Whether a successful result counts as verified is still decided by
 * verificationState().
 */
import type { VerifyResult } from "./banks";

export function retryAfterSeconds(resp: Pick<Response, "headers">): number | undefined {
  const raw = resp.headers.get("retry-after");
  if (!raw) return undefined;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return Math.min(Math.ceil(n), 3600);
  const at = Date.parse(raw);
  if (Number.isNaN(at)) return undefined;
  return Math.max(0, Math.min(Math.ceil((at - Date.now()) / 1000), 3600));
}

export function rateLimitMessage(seconds: number | undefined): string {
  const wait = seconds && seconds > 0 ? `${seconds} second${seconds === 1 ? "" : "s"}` : "a minute";
  return `Too many checks from your network. Wait ${wait} and try again.`;
}

export const TOO_LARGE_MESSAGE = "That request is too large. Send less text or a smaller image.";

export async function readVerifyResponse(resp: Response): Promise<VerifyResult> {
  let body: unknown = null;
  try {
    body = await resp.json();
  } catch {
    body = null;
  }
  const data: VerifyResult =
    body && typeof body === "object" && !Array.isArray(body) ? (body as VerifyResult) : { success: false };

  // httpStatus and retryAfter are only set on failures, so the verdict can
  // tell "we couldn't check" (429, 413, 5xx) from "the bank said no" (422).
  if (resp.status === 429) {
    const retryAfter = retryAfterSeconds(resp);
    return { ...data, success: false, verified: false, httpStatus: 429, retryAfter, error: rateLimitMessage(retryAfter) };
  }
  if (resp.status === 413) {
    return { ...data, success: false, verified: false, httpStatus: 413, error: TOO_LARGE_MESSAGE };
  }
  if (!resp.ok) {
    return {
      ...data,
      success: false,
      verified: false,
      httpStatus: resp.status,
      error: data.error || `The checker is unavailable right now (HTTP ${resp.status}). Try again shortly.`,
    };
  }
  if (body === null) {
    return { success: false, verified: false, httpStatus: resp.status, error: "Unexpected response from the checker. Try again shortly." };
  }
  return data;
}
