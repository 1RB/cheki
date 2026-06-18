import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const regions = ["fra1"];

export async function GET() {
  const checks: { name: string; status: string; latencyMs?: number }[] = [];
  const ethIp = "197.156.96.83";

  // CBE
  const cbeStart = Date.now();
  try {
    const resp = await fetch("https://apps.cbe.com.et:100/?id=PING0000000000000000", {
      signal: AbortSignal.timeout(10000),
    });
    checks.push({
      name: "CBE",
      status: resp.status === 200 || resp.status === 404 ? "ok" : "degraded",
      latencyMs: Date.now() - cbeStart,
    });
  } catch {
    checks.push({ name: "CBE", status: "down", latencyMs: Date.now() - cbeStart });
  }

  // BOA
  const boaStart = Date.now();
  try {
    const resp = await fetch("https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=PING00000", {
      signal: AbortSignal.timeout(10000),
    });
    checks.push({
      name: "BOA",
      status: resp.status === 200 ? "ok" : "degraded",
      latencyMs: Date.now() - boaStart,
    });
  } catch {
    checks.push({ name: "BOA", status: "down", latencyMs: Date.now() - boaStart });
  }

  // Telebirr (geo-blocked - uses direct IP + X-Forwarded-For)
  const teleStart = Date.now();
  try {
    const https = await import("node:https");
    const responseText = await new Promise<string>((resolve, reject) => {
      const req = https.request({
        hostname: "196.188.116.120",
        port: 443,
        path: "/receipt/PING",
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "X-Forwarded-For": ethIp,
          "Host": "transactioninfo.ethiotelecom.et",
        },
        rejectUnauthorized: false,
        servername: "transactioninfo.ethiotelecom.et",
      }, (res) => {
        let data = "";
        res.on("data", (c) => data += c);
        res.on("end", () => resolve(data));
      });
      req.on("error", reject);
      req.setTimeout(8000, () => { req.destroy(); reject(new Error("timeout")); });
      req.end();
    });
    checks.push({
      name: "Telebirr",
      status: responseText.length > 10 ? "ok" : "down",
      latencyMs: Date.now() - teleStart,
    });
  } catch {
    checks.push({ name: "Telebirr", status: "down", latencyMs: Date.now() - teleStart });
  }

  // M-Pesa (geo-blocked - uses direct IP)
  const mpesaStart = Date.now();
  try {
    const https = await import("node:https");
    const responseText = await new Promise<string>((resolve, reject) => {
      const req = https.request({
        hostname: "102.218.49.92",
        port: 443,
        path: "/api/receipt/getReceipt?trxNo=PING",
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "X-Forwarded-For": ethIp,
          "Host": "m-pesabusiness.safaricom.et",
        },
        rejectUnauthorized: false,
        servername: "m-pesabusiness.safaricom.et",
      }, (res) => {
        let data = "";
        res.on("data", (c) => data += c);
        res.on("end", () => resolve(data));
      });
      req.on("error", reject);
      req.setTimeout(8000, () => { req.destroy(); reject(new Error("timeout")); });
      req.end();
    });
    checks.push({
      name: "M-Pesa",
      status: responseText.length > 10 ? "ok" : "down",
      latencyMs: Date.now() - mpesaStart,
    });
  } catch {
    checks.push({ name: "M-Pesa", status: "down", latencyMs: Date.now() - mpesaStart });
  }

  const allDown = checks.every((c) => c.status === "down");
  const anyOk = checks.some((c) => c.status === "ok");

  return NextResponse.json({
    success: true,
    status: allDown ? "down" : anyOk ? "ok" : "degraded",
    version: "0.3.0",
    timestamp: new Date().toISOString(),
    checks,
  });
}
