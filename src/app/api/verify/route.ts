import { NextRequest, NextResponse } from "next/server";
import { Verifier, errorToHttpStatus, errorToMessage } from "@/lib";
import { getCached, setCached, verificationCacheKey } from "@/lib/receipt-cache";
import { limiters, rateLimited } from "@/lib/rate-limit";
import { readJsonCapped, bodyErrorResponse } from "@/lib/http/read-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const regions = ["fra1"];
export const maxDuration = 60; // CBE legacy PDF endpoint can take 10-30s

const verifier = new Verifier();
const MAX_BODY_BYTES = 16 * 1024;

export async function POST(request: NextRequest) {
  const limited = rateLimited(limiters.verify, request.headers);
  if (limited) return limited;

  try {
    let body: Record<string, unknown>;
    try {
      body = await readJsonCapped<Record<string, unknown>>(request, MAX_BODY_BYTES);
    } catch (e) {
      const be = bodyErrorResponse(e);
      if (be) return NextResponse.json({ success: false, error: be.error }, { status: be.status });
      throw e;
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: "Request body must be a JSON object." }, { status: 400 });
    }

    const str = (v: unknown) => (typeof v === "string" ? v : undefined);
    const input = {
      bank: str(body.bank) ?? "",
      reference: str(body.reference),
      accountNumber: str(body.accountNumber),
      phoneNumber: str(body.phoneNumber),
      qrData: str(body.qrData),
    };

    // A receipt is immutable, so a repeat check never needs the bank again.
    const key = verificationCacheKey(input);
    const cached = getCached(key);
    if (cached) {
      return NextResponse.json(
        // Drop durationMs: it describes a fetch that did not happen.
        { ...cached, cached: true, durationMs: undefined },
        { headers: { "x-cheki-cache": "hit" } }
      );
    }

    const result = await verifier.verify(input);

    if (!result.ok) {
      const status = errorToHttpStatus(result.error);
      const message = errorToMessage(result.error);
      const response: Record<string, unknown> = {
        success: false,
        error: message,
      };
      // Include fallback URL for geo-blocked banks
      if (result.error.kind === "ENDPOINT_ERROR" && "fallbackUrl" in result.error) {
        response.fallbackUrl = (result.error as { fallbackUrl?: string }).fallbackUrl;
      }
      // Failures are never cached. A timeout or geo-block must retry live.
      return NextResponse.json(response, { status });
    }

    const payload = { success: true, ...result.value };
    if (result.value.verified) setCached(key, payload);

    return NextResponse.json({ ...payload, cached: false }, {
      headers: { "x-cheki-cache": "miss" },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
