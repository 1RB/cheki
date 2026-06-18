import { NextRequest, NextResponse } from "next/server";
import { Verifier, errorToHttpStatus, errorToMessage } from "@/lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const verifier = new Verifier();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const receipts = body.receipts;
    if (!Array.isArray(receipts) || receipts.length === 0) {
      return NextResponse.json(
        { success: false, error: "receipts array is required." },
        { status: 400 }
      );
    }
    if (receipts.length > 50) {
      return NextResponse.json(
        { success: false, error: "Maximum 50 receipts per batch." },
        { status: 400 }
      );
    }

    const results = await verifier.verifyBatch(
      receipts.map((r: { bank: string; reference: string; accountNumber?: string; phoneNumber?: string }) => ({
        bank: r.bank,
        reference: r.reference,
        accountNumber: r.accountNumber,
        phoneNumber: r.phoneNumber,
      }))
    );

    return NextResponse.json({
      success: true,
      results: results.map((r) => {
        if (!r.ok) {
          return {
            success: false,
            error: errorToMessage(r.error),
            status: errorToHttpStatus(r.error),
          };
        }
        return { success: true, ...r.value };
      }),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
