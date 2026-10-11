import { NextResponse } from "next/server";
import { getAllBanks, getParser } from "@/lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Per-bank reachability.
 *
 * This used to probe every live bank on every request, so each call to
 * /api/health fanned out to every bank endpoint (an amplifier). Results are
 * now cached for 5 minutes per instance, and the CDN may serve the same
 * response for 5 minutes (s-maxage), so the banks see at most one probe per
 * instance per 5 minutes no matter how often this is called.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_HEADERS = { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" };

type BankCheck = { id: string; name: string; status: string; latencyMs: number };
type HealthBody = { status: string; checkedAt: string; banks: BankCheck[] };
let cache: { at: number; body: HealthBody } | null = null;
let inflight: Promise<HealthBody> | null = null;

async function checkEndpoint(url: string, timeoutMs: number): Promise<void> {
  // TLS is verified for every bank (the Awash and Telebirr/M-Pesa bypasses
  // were removed). Only reachability matters, so the body is discarded.
  const resp = await fetch(url, {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "User-Agent": "cheki-health-check" },
  });
  await resp.body?.cancel().catch(() => {});
}

async function probeAll(): Promise<HealthBody> {
  const banks = getAllBanks();
  const checks = await Promise.all(
    banks.map(async (b): Promise<BankCheck> => {
      const start = Date.now();
      const parser = getParser(b.id);
      if (!parser || b.status !== "live") {
        return {
          id: b.id,
          name: b.name,
          status: b.status === "live" ? "no-parser" : "in-development",
          latencyMs: 0,
        };
      }
      try {
        const url = b.endpoint
          .replace("{ref}", "test")
          .replace("{account}", "00000000")
          .replace("{phone}", "0000000000");
        // Each bank's top-level endpoint is its current format (CBE: the
        // mb.cbe.com.et JSON API, not the slow legacy apps.cbe.com.et PDF host).
        const healthTimeout = 5000;
        await checkEndpoint(url, healthTimeout);
        return { id: b.id, name: b.name, status: "reachable", latencyMs: Date.now() - start };
      } catch {
        return {
          id: b.id,
          name: b.name,
          status: b.geoBlocked ? "geo-blocked" : "unreachable",
          latencyMs: Date.now() - start,
        };
      }
    })
  );
  return { status: "ok", checkedAt: new Date().toISOString(), banks: checks };
}

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return NextResponse.json({ ...cache.body, cached: true }, { headers: CACHE_HEADERS });
  }
  // Concurrent requests during a refresh share one probe.
  if (!inflight) {
    inflight = probeAll()
      .then((body) => {
        cache = { at: Date.now(), body };
        return body;
      })
      .finally(() => {
        inflight = null;
      });
  }
  const body = await inflight;
  return NextResponse.json({ ...body, cached: false }, { headers: CACHE_HEADERS });
}
