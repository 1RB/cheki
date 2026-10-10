import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { RateLimiter, clientIp, formatTelegramMessage, validateContribution } from "@/lib/contribute";

const base = { bank: "zemen", consent: true };

describe("validateContribution", () => {
  it("accepts a share link for an in-development bank", () => {
    const r = validateContribution({ ...base, link: "https://share.zemenbank.com/rt/ABCDEFGH1234567890123456/pdf", credit: "@tester" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.bank).toBe("zemen");
      expect(r.value.link).toContain("share.zemenbank.com");
      expect(r.value.credit).toBe("@tester");
    }
  });

  it("requires the consent box", () => {
    const r = validateContribution({ bank: "zemen", link: "https://share.zemenbank.com/rt/x/pdf" });
    expect(r.ok).toBe(false);
    const r2 = validateContribution({ bank: "zemen", consent: "true", link: "https://share.zemenbank.com/rt/x/pdf" });
    expect(r2.ok).toBe(false);
  });

  it("rejects live and unknown banks", () => {
    expect(validateContribution({ ...base, bank: "dashen", link: "https://example.com/x" }).ok).toBe(false);
    expect(validateContribution({ ...base, bank: "nope", link: "https://example.com/x" }).ok).toBe(false);
  });

  it("needs the payer phone with a bare CBE Birr reference", () => {
    expect(validateContribution({ ...base, bank: "cbebirr", reference: "CHK0000001" }).ok).toBe(false);
    const r = validateContribution({ ...base, bank: "cbebirr", reference: "CHK0000001", phoneOrAccount: "251900000000" });
    expect(r.ok).toBe(true);
  });

  it("rejects non-http links, junk references and long credits", () => {
    expect(validateContribution({ ...base, link: "javascript:alert(1)" }).ok).toBe(false);
    expect(validateContribution({ ...base, reference: "<script>" }).ok).toBe(false);
    expect(validateContribution({ ...base, reference: "ABC123", credit: "x".repeat(61) }).ok).toBe(false);
    expect(validateContribution({ ...base, reference: "ABC123", phoneOrAccount: "12ab" }).ok).toBe(false);
  });

  it("rejects the honeypot", () => {
    expect(validateContribution({ ...base, reference: "ABC123", website: "spam" }).ok).toBe(false);
  });

  it("strips control characters", () => {
    const r = validateContribution({ ...base, reference: "ABC123", credit: "Abebe\u0000\nInjected" });
    expect(r.ok && r.value.credit).toBe("Abebe Injected");
  });
});

describe("formatTelegramMessage", () => {
  it("includes the bank, the link, credit and the deletion reminder", () => {
    const text = formatTelegramMessage(
      { bank: "zemen", bankName: "Zemen Bank", link: "https://share.zemenbank.com/rt/x/pdf" },
      "2026-10-10T00:00:00Z",
    );
    expect(text).toContain("Zemen Bank (zemen)");
    expect(text).toContain("Link: https://share.zemenbank.com/rt/x/pdf");
    expect(text).toContain("Credit: anonymous");
    expect(text).toContain("then delete this message");
  });
});

describe("RateLimiter", () => {
  it("allows the limit then blocks until the window passes", () => {
    const rl = new RateLimiter(2, 1000);
    expect(rl.check("ip", 0)).toBe(0);
    expect(rl.check("ip", 10)).toBe(0);
    expect(rl.check("ip", 20)).toBeGreaterThan(0);
    expect(rl.check("other", 20)).toBe(0);
    expect(rl.check("ip", 1001)).toBe(0);
  });

  it("reads the first forwarded IP", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("POST /api/contribute", () => {
  const makeReq = (body: unknown, ip = "9.9.9.9") =>
    new NextRequest("https://cheki.et/api/contribute", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("returns 503 with a clear message when the Telegram env vars are missing", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_CONTRIB_CHAT_ID", "");
    const { POST } = await import("@/app/api/contribute/route");
    const resp = await POST(makeReq({ ...base, link: "https://share.zemenbank.com/rt/x/pdf" }));
    expect(resp.status).toBe(503);
    const data = await resp.json();
    expect(data.error).toContain("TELEGRAM_BOT_TOKEN");
  });

  it("forwards a valid submission to Telegram sendMessage and stores nothing", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("TELEGRAM_CONTRIB_CHAT_ID", "123");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const log = vi.spyOn(console, "log");
    const { POST } = await import("@/app/api/contribute/route");
    const resp = await POST(makeReq({ ...base, link: "https://share.zemenbank.com/rt/SECRET/pdf", credit: "@me" }, "8.8.8.8"));
    expect(resp.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bottest-token/sendMessage");
    const sent = JSON.parse(String(init.body));
    expect(sent.chat_id).toBe("123");
    expect(sent.text).toContain("SECRET");
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("returns 400 for invalid input and 429 after the rate limit", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("TELEGRAM_CONTRIB_CHAT_ID", "123");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true }))));
    const { POST } = await import("@/app/api/contribute/route");
    expect((await POST(makeReq({ bank: "zemen" }, "7.7.7.7"))).status).toBe(400);
    for (let i = 0; i < 4; i++) await POST(makeReq({ bank: "zemen" }, "7.7.7.7"));
    const limited = await POST(makeReq({ bank: "zemen" }, "7.7.7.7"));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 502 when Telegram rejects the message", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("TELEGRAM_CONTRIB_CHAT_ID", "123");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 400 })));
    const { POST } = await import("@/app/api/contribute/route");
    const resp = await POST(makeReq({ ...base, reference: "ABC123" }, "6.6.6.6"));
    expect(resp.status).toBe(502);
  });
});
