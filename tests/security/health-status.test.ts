/**
 * /api/health's envelope `status` is derived from the banks, not a constant:
 * "ok" only when every bank is reachable, expected to block cloud IPs, or not
 * built yet. A constant would let the route answer "ok" while a bank is down
 * or has no parser, which is exactly what `status` exists to tell a caller.
 *
 * The route caches at module level, so each case re-imports it fresh.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  banks: [] as import("@/lib/core/types").BankManifestEntry[],
  /** Live banks whose parser lookup fails (the registry has no entry). */
  noParser: new Set<string>(),
  /** Endpoint hosts whose probe throws. */
  failing: new Set<string>(),
}));

vi.mock("@/lib", () => ({
  getAllBanks: () => state.banks,
  getParser: (id: string) => (state.noParser.has(id) ? undefined : ({} as never)),
}));

const bank = (id: string, extra: Record<string, unknown> = {}): import("@/lib/core/types").BankManifestEntry =>
  ({
    id,
    name: id.toUpperCase(),
    status: "live",
    endpoint: `https://${id}.bank.example/receipt/{ref}`,
    geoBlocked: false,
    ...extra,
  }) as unknown as import("@/lib/core/types").BankManifestEntry;

async function probe(): Promise<{ status: string; banks: Array<{ id: string; status: string }> }> {
  vi.resetModules();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      if (state.failing.has(new URL(String(url)).hostname)) throw new Error("probe failed");
      return new Response("ok", { status: 200 });
    })
  );
  const { GET } = await import("@/app/api/health/route");
  return (await (await GET()).json()) as { status: string; banks: Array<{ id: string; status: string }> };
}

afterEach(() => {
  vi.unstubAllGlobals();
  state.banks = [];
  state.noParser.clear();
  state.failing.clear();
});

describe("/api/health envelope status", () => {
  it("is ok when every bank answers, is expected to block us, or is not built yet", async () => {
    state.banks = [bank("cbe"), bank("telebirr", { geoBlocked: true }), bank("nib", { status: "in-development" })];
    state.failing.add("telebirr.bank.example");
    const body = await probe();
    expect(body.status).toBe("ok");
    expect(body.banks.map((b) => [b.id, b.status])).toEqual([
      ["cbe", "reachable"],
      ["telebirr", "geo-blocked"],
      ["nib", "in-development"],
    ]);
  });

  it("is degraded when a live bank's endpoint cannot be reached", async () => {
    state.banks = [bank("cbe"), bank("dashen")];
    state.failing.add("dashen.bank.example");
    const body = await probe();
    expect(body.status).toBe("degraded");
    expect(body.banks.map((b) => [b.id, b.status])).toEqual([
      ["cbe", "reachable"],
      ["dashen", "unreachable"],
    ]);
  });

  it("an expected geo-block never degrades the answer", async () => {
    state.banks = [bank("telebirr", { geoBlocked: true }), bank("mpesa", { geoBlocked: true })];
    state.failing.add("telebirr.bank.example");
    state.failing.add("mpesa.bank.example");
    const body = await probe();
    expect(body.banks.map((b) => b.status)).toEqual(["geo-blocked", "geo-blocked"]);
    expect(body.status).toBe("ok");
  });

  it("is degraded when a live bank has no parser to check it with", async () => {
    state.banks = [bank("cbe"), bank("phantom")];
    state.noParser.add("phantom");
    const body = await probe();
    expect(body.status).toBe("degraded");
    expect(body.banks.map((b) => [b.id, b.status])).toEqual([
      ["cbe", "reachable"],
      ["phantom", "no-parser"],
    ]);
  });
});
