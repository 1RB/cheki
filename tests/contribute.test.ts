import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  MAX_IMAGE_BYTES,
  PAUSED_MESSAGE,
  RateLimiter,
  clientIp,
  contributeLeadMode,
  formatTelegramMessage,
  sniffImageType,
  validateContribution,
  validateImageMeta,
} from "@/lib/contribute";
import { getAllBanks } from "@/lib/manifest/loader";

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

  it("accepts a screenshot on its own", () => {
    const r = validateContribution({ ...base, bank: "abay" }, { type: "image/jpeg", size: 250_000 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.image).toEqual({ type: "image/jpeg", size: 250_000 });
      expect(r.value.link).toBeUndefined();
      expect(r.value.reference).toBeUndefined();
    }
  });

  it("does not need the payer phone when a screenshot comes with the reference", () => {
    expect(validateContribution({ ...base, bank: "cbebirr", reference: "CHK0000001" }, { type: "image/png", size: 1000 }).ok).toBe(true);
  });

  it("needs at least one of link, reference or screenshot", () => {
    const r = validateContribution({ ...base, bank: "abay" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/screenshot/);
  });

  it("rejects screenshots of the wrong type or size", () => {
    expect(validateContribution({ ...base, bank: "abay" }, { type: "image/gif", size: 1000 }).ok).toBe(false);
    expect(validateContribution({ ...base, bank: "abay" }, { type: "application/pdf", size: 1000 }).ok).toBe(false);
    expect(validateContribution({ ...base, bank: "abay" }, { type: "image/jpeg", size: MAX_IMAGE_BYTES + 1 }).ok).toBe(false);
    expect(validateContribution({ ...base, bank: "abay" }, { type: "image/jpeg", size: 0 }).ok).toBe(false);
    expect(validateImageMeta({ type: "image/webp", size: MAX_IMAGE_BYTES })).toBeNull();
    // A bad image fails even when a valid link comes with it.
    expect(validateContribution({ ...base, link: "https://share.zemenbank.com/rt/x/pdf" }, { type: "image/svg+xml", size: 10 }).ok).toBe(false);
  });

  it("sniffs the real image type from the bytes", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(sniffImageType(new Uint8Array([]))).toBeNull();
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

describe("contributeLeadMode", () => {
  const screenshotFirst = [
    "abay", "addis", "amhara", "berhan", "bunna", "enat", "global", "lion", "oromia",
    "hibret", "zamzam", "hijra", "shabelle", "goh", "tsedey", "gadaa", "rammis",
  ];
  const linkFirst = ["zemen", "cbebirr", "nib", "wegagen", "ahadu", "kaafi"];

  it("leads with a screenshot for banks with no known endpoint", () => {
    for (const id of screenshotFirst) expect(contributeLeadMode(id), id).toBe("screenshot");
  });

  it("leads with the link for banks with a known URL template", () => {
    for (const id of linkFirst) expect(contributeLeadMode(id), id).toBe("link");
  });

  it("covers every in-development bank in the manifest", () => {
    const inDev = getAllBanks().filter((b) => b.status === "in-development").map((b) => b.id).sort();
    expect(inDev).toEqual([...screenshotFirst, ...linkFirst].sort());
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

  it("returns a generic 503 when the Telegram env vars are missing and logs the detail server-side", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_CONTRIB_CHAT_ID", "");
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await import("@/app/api/contribute/route");
    const resp = await POST(makeReq({ ...base, link: "https://share.zemenbank.com/rt/x/pdf" }));
    expect(resp.status).toBe(503);
    const data = await resp.json();
    expect(data.error).toBe(PAUSED_MESSAGE);
    expect(data.error).toBe("Submissions are paused right now. Try again later.");
    expect(JSON.stringify(data)).not.toMatch(/TELEGRAM|BOT_TOKEN|CHAT_ID/);
    expect(err).toHaveBeenCalledWith(expect.stringContaining("TELEGRAM_BOT_TOKEN"));
    err.mockRestore();
  });

  const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 2, 3]);
  const makeForm = (fields: Record<string, string>, image?: Blob, ip = "5.5.5.5") => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    if (image) form.append("image", image, "receipt.jpg");
    return new NextRequest("https://cheki.et/api/contribute", {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: form,
    });
  };

  it("forwards an image-only submission with sendPhoto and does not log it", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("TELEGRAM_CONTRIB_CHAT_ID", "123");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const log = vi.spyOn(console, "log");
    const { POST } = await import("@/app/api/contribute/route");
    const resp = await POST(makeForm({ bank: "abay", consent: "true", credit: "@me" }, new Blob([jpeg()], { type: "image/jpeg" })));
    expect(resp.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bottest-token/sendPhoto");
    const sent = init.body as FormData;
    expect(sent.get("chat_id")).toBe("123");
    expect(String(sent.get("caption"))).toContain("Abay");
    expect(String(sent.get("caption"))).toContain("Screenshot: attached");
    expect(String(sent.get("caption"))).toContain("Credit: @me");
    const photo = sent.get("photo") as Blob;
    expect(photo.type).toBe("image/jpeg");
    expect(photo.size).toBe(jpeg().length);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("falls back to sendDocument when sendPhoto is refused", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("TELEGRAM_CONTRIB_CHAT_ID", "123");
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith("/sendPhoto")
        ? new Response(JSON.stringify({ ok: false, description: "PHOTO_INVALID_DIMENSIONS" }), { status: 400 })
        : new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("@/app/api/contribute/route");
    const resp = await POST(makeForm({ bank: "abay", consent: "true" }, new Blob([jpeg()], { type: "image/jpeg" }), "5.5.5.6"));
    expect(resp.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1] as unknown as [string])[0]).toContain("/sendDocument");
  });

  it("rejects an upload that is not really an image, without calling Telegram", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("TELEGRAM_CONTRIB_CHAT_ID", "123");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("@/app/api/contribute/route");
    const fake = new Blob(["<svg xmlns='http://www.w3.org/2000/svg'/>"], { type: "image/jpeg" });
    const resp = await POST(makeForm({ bank: "abay", consent: "true" }, fake, "5.5.5.7"));
    expect(resp.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized screenshot", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("TELEGRAM_CONTRIB_CHAT_ID", "123");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("@/app/api/contribute/route");
    const big = new Uint8Array(MAX_IMAGE_BYTES + 10);
    big.set(jpeg());
    const resp = await POST(makeForm({ bank: "abay", consent: "true" }, new Blob([big], { type: "image/jpeg" }), "5.5.5.8"));
    expect([400, 413]).toContain(resp.status);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the consent box and honeypot for multipart submissions", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("TELEGRAM_CONTRIB_CHAT_ID", "123");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("@/app/api/contribute/route");
    const img = () => new Blob([jpeg()], { type: "image/jpeg" });
    expect((await POST(makeForm({ bank: "abay" }, img(), "5.5.5.9"))).status).toBe(400);
    expect((await POST(makeForm({ bank: "abay", consent: "true", website: "spam" }, img(), "5.5.5.9"))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
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
