import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BANK_ENDPOINTS: Record<string, (ref: string, account?: string) => string> = {
  cbe: (ref, account) => {
    const suffix = (account || "").slice(-8);
    return `https://apps.cbe.com.et:100/?id=${ref}${suffix}`;
  },
  zemen: (ref) => `https://share.zemenbank.com/rt/${ref}/pdf`,
  dashen: (ref) => `https://api.dashensuperapp.com/receipts/Within-Dashen-Transfer-${ref}.pdf`,
};

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const bank = params.get("bank");
  const reference = params.get("reference");
  const accountNumber = params.get("account");

  if (!bank || !reference) {
    return NextResponse.json(
      { success: false, error: "bank and reference are required." },
      { status: 400 }
    );
  }

  const builder = BANK_ENDPOINTS[bank.toLowerCase()];
  if (!builder) {
    return NextResponse.json(
      {
        success: false,
        error: `Receipt download not supported for bank '${bank}'. Supported: ${Object.keys(BANK_ENDPOINTS).join(", ")}`,
      },
      { status: 400 }
    );
  }

  const url = builder(reference, accountNumber || undefined);

  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; cheki)" },
      signal: AbortSignal.timeout(15000),
    });

    if (resp.status !== 200) {
      return NextResponse.json(
        { success: false, error: `Bank returned status ${resp.status}.` },
        { status: resp.status }
      );
    }

    const contentType = resp.headers.get("content-type") || "application/octet-stream";
    const buf = Buffer.from(await resp.arrayBuffer());

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="receipt_${reference}.${contentType.includes("pdf") ? "pdf" : "html"}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to download receipt.",
      },
      { status: 502 }
    );
  }
}
