import { NextRequest, NextResponse } from "next/server";
import { Verifier, errorToHttpStatus, errorToMessage } from "@/lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const regions = ["fra1"];

const verifier = new Verifier();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await verifier.verify({
      bank: body.bank,
      reference: body.reference,
      accountNumber: body.accountNumber,
      phoneNumber: body.phoneNumber,
    });

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
      return NextResponse.json(response, { status });
    }

    return NextResponse.json({ success: true, ...result.value });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
