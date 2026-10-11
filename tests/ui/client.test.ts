/** 429 / 413 / 5xx / offline through the browser client: never a verdict on the receipt. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { postJson } from "@/lib/verify/client";
import { presentVerdict } from "@/lib/verify/verdict";

afterEach(() => vi.unstubAllGlobals());

const respond = (body: string, status: number, headers: Record<string, string> = {}) =>
  vi.fn(async () => new Response(body, { status, headers }));

describe("postJson", () => {
  it("429 keeps the Retry-After for the countdown", async () => {
    vi.stubGlobal("fetch", respond('{"success":true,"verified":true}', 429, { "retry-after": "30" }));
    const r = await postJson("/api/verify", { bank: "cbe", reference: "x" });
    expect(r).toMatchObject({ success: false, httpStatus: 429, retryAfter: 30 });
    const v = presentVerdict(r);
    expect(v.kind).toBe("rateLimited");
    expect(v.retryAfter).toBe(30);
  });

  it("413 from the platform (HTML) is 'too large'", async () => {
    vi.stubGlobal("fetch", respond("<html>Request Entity Too Large</html>", 413));
    const r = await postJson("/api/verify", {});
    expect(presentVerdict(r).kind).toBe("tooLarge");
  });

  it("a 504 HTML page is 'unavailable', not 'no receipt'", async () => {
    vi.stubGlobal("fetch", respond("<html>Gateway Timeout</html>", 504));
    expect(presentVerdict(await postJson("/api/verify", {}), { bankCode: "cbe" }).kind).toBe("unavailable");
  });

  it("a network failure is offline", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    const r = await postJson("/api/verify", {});
    expect(r.httpStatus).toBe(0);
    expect(presentVerdict(r).kind).toBe("offline");
  });

  it("navigator.onLine === false short-circuits without a request", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    vi.stubGlobal("navigator", { onLine: false });
    expect(presentVerdict(await postJson("/api/verify", {})).kind).toBe("offline");
    expect(f).not.toHaveBeenCalled();
  });

  it("an abort is re-thrown so a newer check wins", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw Object.assign(new Error("aborted"), { name: "AbortError" }); }));
    await expect(postJson("/api/verify", {})).rejects.toThrow("aborted");
  });
});
