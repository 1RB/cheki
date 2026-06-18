import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BatchItem {
  bank: string;
  reference: string;
  accountNumber?: string;
  phoneNumber?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!Array.isArray(body.receipts)) {
      return NextResponse.json(
        { success: false, error: "Expected a 'receipts' array." },
        { status: 400 }
      );
    }

    const receipts: BatchItem[] = body.receipts;
    if (receipts.length === 0) {
      return NextResponse.json(
        { success: false, error: "Receipts array is empty." },
        { status: 400 }
      );
    }
    if (receipts.length > 50) {
      return NextResponse.json(
        { success: false, error: "Maximum 50 receipts per batch request." },
        { status: 400 }
      );
    }

    // Process all receipts in parallel
    const results = await Promise.all(
      receipts.map(async (item, index) => {
        try {
          const resp = await fetch(new URL("/api/verify", request.url), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bank: item.bank,
              reference: item.reference,
              accountNumber: item.accountNumber,
              phoneNumber: item.phoneNumber,
            }),
          });
          const data = await resp.json();
          return { index, ...data };
        } catch (err) {
          return {
            index,
            success: false,
            error: err instanceof Error ? err.message : "Internal error",
            bank: item.bank,
            reference: item.reference,
          };
        }
      })
    );

    const verified = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      total: receipts.length,
      verified,
      failed,
      results,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
