import { NextResponse } from "next/server";
import { getAllBanks, getParser } from "@/lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const banks = getAllBanks();
  const checks = await Promise.all(
    banks.map(async (b) => {
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
        // Just check if the endpoint is reachable (HEAD or quick GET)
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const url = b.endpoint
          .replace("{ref}", "test")
          .replace("{account}", "00000000")
          .replace("{phone}", "0000000000");
        await fetch(url, {
          method: "GET",
          signal: controller.signal,
          headers: { "User-Agent": "cheki-health-check" },
        });
        clearTimeout(timeout);
        return {
          id: b.id,
          name: b.name,
          status: "reachable",
          latencyMs: Date.now() - start,
        };
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

  return NextResponse.json({
    status: "ok",
    banks: checks,
  });
}
