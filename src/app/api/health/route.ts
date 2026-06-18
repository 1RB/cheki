import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const checks: { name: string; status: string; latencyMs?: number }[] = [];

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

  // Telebirr
  const teleStart = Date.now();
  try {
    const resp = await fetch("https://transactioninfo.ethiotelecom.et/receipt/PING", {
      signal: AbortSignal.timeout(10000),
    });
    checks.push({
      name: "Telebirr",
      status: resp.status === 200 ? "ok" : "degraded",
      latencyMs: Date.now() - teleStart,
    });
  } catch {
    checks.push({ name: "Telebirr", status: "down", latencyMs: Date.now() - teleStart });
  }

  // M-Pesa
  const mpesaStart = Date.now();
  try {
    const resp = await fetch("https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo=PING", {
      signal: AbortSignal.timeout(10000),
    });
    checks.push({
      name: "M-Pesa",
      status: resp.status === 200 ? "ok" : "degraded",
      latencyMs: Date.now() - mpesaStart,
    });
  } catch {
    checks.push({ name: "M-Pesa", status: "down", latencyMs: Date.now() - mpesaStart });
  });

  const allDown = checks.every((c) => c.status === "down");
  const anyOk = checks.some((c) => c.status === "ok");

  return NextResponse.json(
    {
      success: true,
      status: allDown ? "down" : anyOk ? "ok" : "degraded",
      version: "0.2.0",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: 200 }
  );
}
