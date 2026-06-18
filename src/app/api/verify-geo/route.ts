import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const ETH_IP = "197.156.96.83";

const GEO_BANKS: Record<string, { url: (ref: string) => string; ip: string; host: string; type: "html" | "json" }> = {
  telebirr: {
    url: (ref) => `https://transactioninfo.ethiotelecom.et/receipt/${ref}`,
    ip: "196.188.116.120",
    host: "transactioninfo.ethiotelecom.et",
    type: "html",
  },
  mpesa: {
    url: (ref) => `https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo=${ref}`,
    ip: "102.218.49.92",
    host: "m-pesabusiness.safaricom.et",
    type: "json",
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bank, reference } = body;

    if (!bank || !reference) {
      return NextResponse.json({ success: false, error: "bank and reference are required." }, { status: 400 });
    }

    const config = GEO_BANKS[bank.toLowerCase()];
    if (!config) {
      return NextResponse.json({ success: false, error: "This endpoint only supports telebirr and mpesa." }, { status: 400 });
    }

    const originalUrl = config.url(reference);
    const directUrl = originalUrl.replace(config.host, config.ip);

    // Edge runtime fetch runs on Cloudflare's network - different IPs than serverless
    let resp: Response;
    try {
      resp = await fetch(directUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "X-Forwarded-For": ETH_IP,
          "X-Real-IP": ETH_IP,
          "Host": config.host,
          "Accept": "text/html,application/json,*/*",
        },
        signal: AbortSignal.timeout(12000),
      });
    } catch {
      // Try original URL as fallback
      try {
        resp = await fetch(originalUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "X-Forwarded-For": ETH_IP,
            "X-Real-IP": ETH_IP,
          },
          signal: AbortSignal.timeout(12000),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { success: false, error: `Bank endpoint unreachable: ${msg}`, bank, reference },
          { status: 502 }
        );
      }
    }

    const text = await resp.text();

    // Parse based on bank type
    if (config.type === "json") {
      try {
        const payload = JSON.parse(text);
        if (payload.responseCode && String(payload.responseCode) !== "0") {
          return NextResponse.json(
            { success: false, error: payload.responseDescription || "Receipt not found.", bank, reference },
            { status: 404 }
          );
        }
        return NextResponse.json({
          success: true,
          bank,
          reference,
          sourceUrl: originalUrl,
          verified: true,
          senderName: payload.senderName || payload.payerName,
          receiverName: payload.receiverName || payload.creditPartyName,
          amount: payload.amount ? parseFloat(payload.amount) : undefined,
          currency: payload.currency || "ETB",
        });
      } catch {
        return NextResponse.json({ success: false, error: "Invalid JSON from bank.", bank, reference }, { status: 502 });
      }
    } else {
      // Telebirr HTML parsing
      if (text.includes("This request is not correct") || !text.toLowerCase().includes("telebirr receipt")) {
        return NextResponse.json({ success: false, error: "Receipt not found or invalid.", bank, reference }, { status: 404 });
      }

      // Simple text extraction
      const lines = text.replace(/<[^>]+>/g, "\n").split("\n").map((l) => l.trim()).filter((l) => l);
      function nextAfter(label: string): string | undefined {
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(label) && i + 1 < lines.length) return lines[i + 1];
        }
        return undefined;
      }

      let amount: number | undefined;
      let date: string | undefined;
      for (const line of lines) {
        if (amount === undefined) {
          const m = line.match(/([0-9,]+\.?\d*)\s*(Birr|ETB)/i);
          if (m) amount = parseFloat(m[1].replace(/,/g, ""));
        }
        if (date === undefined) {
          const m = line.match(/(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2})/);
          if (m) date = m[1];
        }
      }

      return NextResponse.json({
        success: true,
        bank: "Telebirr",
        reference,
        sourceUrl: originalUrl,
        verified: true,
        senderName: nextAfter("Payer Name"),
        senderAccount: nextAfter("Payer telebirr no"),
        receiverName: nextAfter("Credited Party name"),
        receiverAccount: nextAfter("Credited party account no"),
        amount,
        currency: "ETB",
        date,
      });
    }
  } catch {
    return NextResponse.json({ success: false, error: "Internal server error." }, { status: 500 });
  }
}
