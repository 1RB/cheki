import { NextResponse } from "next/server";
import { getAllBanks, getParser } from "@/lib";
import * as https from "node:https";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function checkEndpoint(url: string, sslVerify: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!sslVerify) {
      // Use node:https with SSL verification disabled for banks with broken certs
      const req = https.get(
        url,
        { headers: { "User-Agent": "cheki-health-check" }, rejectUnauthorized: false },
        () => resolve()
      );
      req.on("error", reject);
      req.setTimeout(5000, () => req.destroy(new Error("timeout")));
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "cheki-health-check" },
    })
      .then(() => {
        clearTimeout(timeout);
        resolve();
      })
      .catch((e) => {
        clearTimeout(timeout);
        reject(e);
      });
  });
}

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
        const url = b.endpoint
          .replace("{ref}", "test")
          .replace("{account}", "00000000")
          .replace("{phone}", "0000000000");
        await checkEndpoint(url, b.sslVerify);
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
          status: (b.id === "telebirr" || b.id === "mpesa") ? "geo-blocked" : "unreachable",
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
