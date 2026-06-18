import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BankConfig {
  code: string;
  name: string;
  requiresAccount: boolean;
  accountDigits?: number;
  requiresPhone: boolean;
  endpoint: (ref: string, account?: string, phone?: string) => string;
  parse: (data: string, contentType: string) => ParsedReceipt;
  responseType: "pdf" | "html" | "json";
}

interface ParsedReceipt {
  verified: boolean;
  senderName?: string;
  senderAccount?: string;
  receiverName?: string;
  receiverAccount?: string;
  amount?: number;
  currency?: string;
  date?: string;
  reference?: string;
  branch?: string;
  reason?: string;
  raw?: string;
}

const BANKS: Record<string, BankConfig> = {
  cbe: {
    code: "cbe",
    name: "Commercial Bank of Ethiopia",
    requiresAccount: true,
    accountDigits: 8,
    requiresPhone: false,
    responseType: "pdf",
    endpoint: (ref, account) => {
      const suffix = (account || "").slice(-8);
      return `https://apps.cbe.com.et:100/?id=${ref}${suffix}`;
    },
    parse: (_data: string, _ct: string) => ({ verified: false }), // handled separately
  },
  telebirr: {
    code: "telebirr",
    name: "Telebirr",
    requiresAccount: false,
    requiresPhone: false,
    responseType: "html",
    endpoint: (ref) => `https://transactioninfo.ethiotelecom.et/receipt/${ref}`,
    parse: parseTelebirrHtml,
  },
  boa: {
    code: "boa",
    name: "Bank of Abyssinia",
    requiresAccount: true,
    accountDigits: 5,
    requiresPhone: false,
    responseType: "json",
    endpoint: (ref, account) => {
      const suffix = (account || "").slice(-5);
      return `https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=${ref}${suffix}`;
    },
    parse: parseBOAJson,
  },
  mpesa: {
    code: "mpesa",
    name: "M-Pesa Ethiopia",
    requiresAccount: false,
    requiresPhone: false,
    responseType: "json",
    endpoint: (ref) =>
      `https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo=${ref}`,
    parse: parseMpesaJson,
  },
};

async function extractPdfText(data: Buffer): Promise<string> {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(data);
    return result.text || "";
  } catch {
    return "";
  }
}

function parseCBEPdfText(text: string): ParsedReceipt {
  if (!text || !text.includes("Commercial Bank of Ethiopia")) {
    return { verified: false };
  }

  // pdf-parse may not preserve line breaks the same way pdfplumber does.
  // Use regex on the full text to extract fields regardless of layout.

  let senderName: string | undefined;
  let receiverName: string | undefined;
  let senderAccount: string | undefined;
  let receiverAccount: string | undefined;
  let amount: number | undefined;
  let date: string | undefined;
  let reference: string | undefined;
  let branch: string | undefined;
  let reason: string | undefined;

  // Sender/receiver names: "Payer <name>" and "Receiver <name>"
  const payerMatch = text.match(/Payer\s+(Mr\s+|Mrs\s+|Ms\s+)?(.+?)(?:\n|$)/);
  if (payerMatch) {
    senderName = (payerMatch[1] || "") + (payerMatch[2] || "");
    senderName = senderName.trim();
  }

  const receiverMatch = text.match(/Receiver\s+(.+?)(?:\n|$)/);
  if (receiverMatch) {
    receiverName = receiverMatch[1].trim();
  }

  // Accounts: "Account <masked number>" — find all
  const accountMatches = text.matchAll(/Account\s+([0-9*]+)/g);
  const accounts = Array.from(accountMatches).map((m) => m[1]);
  if (accounts.length >= 1) senderAccount = accounts[0];
  if (accounts.length >= 2) receiverAccount = accounts[1];

  // Amount: "Transferred Amount 20,000.00 ETB"
  const amountMatch = text.match(/Transferred Amount\s+([0-9,]+\.\d{2})\s*ETB/);
  if (amountMatch) {
    amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  }

  // Date: "Payment Date & Time 5/20/2026, 7:29:00 PM"
  const dateMatch = text.match(
    /Payment Date & Time\s+(\d{1,2}\/\d{1,2}\/\d{4}),\s+(\d{1,2}:\d{2}:\d{2})\s*(AM|PM)?/
  );
  if (dateMatch) {
    date = `${dateMatch[1]} ${dateMatch[2]}`;
    if (dateMatch[3]) date += ` ${dateMatch[3]}`;
  }

  // Reference: "VAT Receipt No: FT26140P01YB"
  const refMatch = text.match(/VAT Receipt No:\s*(\S+)/);
  if (refMatch) reference = refMatch[1];

  // Branch: "Branch: MEKANISA MICHAEL BRANC"
  const branchMatch = text.match(/Branch:\s*(.+?)(?:\n|$)/);
  if (branchMatch) branch = branchMatch[1].trim();

  // Reason: "Reason / Type of service <text>"
  const reasonMatch = text.match(/Reason \/ Type of service\s+(.+?)(?:\n|$)/);
  if (reasonMatch) reason = reasonMatch[1].trim();

  return {
    verified: true,
    senderName,
    senderAccount,
    receiverName,
    receiverAccount,
    amount,
    currency: "ETB",
    date,
    reference,
    branch,
    reason,
  };
}

function parseTelebirrHtml(html: string, _contentType: string): ParsedReceipt {
  if (
    html.includes("This request is not correct") ||
    !html.toLowerCase().includes("telebirr receipt")
  ) {
    return { verified: false, raw: html.slice(0, 500) };
  }

  const $ = cheerio.load(html);
  const text = $("body").text();
  const lines = text
    .split("\n")
    .map((l: string) => l.trim())
    .filter((l: string) => l);

  function nextValueAfter(en: string, am?: string): string | undefined {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(en) || (am && lines[i].includes(am))) {
        if (i + 1 < lines.length) return lines[i + 1];
      }
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

  return {
    verified: true,
    senderName: nextValueAfter("Payer Name", "\u12E8\u12A8\u12CD\u12FA\u12ED \u1235\u121B"),
    senderAccount: nextValueAfter("Payer telebirr no", "\u12E8\u12A8\u12CD\u12FA\u12ED \u124C\u12EC\u12A5\u1228\u1201 \u1230\u1201"),
    receiverName: nextValueAfter("Credited Party name", "\u12E8\u1300\u12AD\u12F0\u12E5 \u1320\u1241\u124B\u12ED \u1235\u121B"),
    receiverAccount: nextValueAfter("Credited party account no", "\u12E8\u1300\u12AD\u12F0\u12E5 \u1320\u1241\u124B\u12ED \u124C\u12EC\u12A5\u1228\u1201 \u1230\u1201"),
    amount,
    currency: "ETB",
    date,
    raw: text.slice(0, 1000),
  };
}

function parseBOAJson(data: string, _contentType: string): ParsedReceipt {
  try {
    const payload = JSON.parse(data);
    const body = payload.body;
    if (
      !body ||
      !body[0] ||
      body[0]["Payer's Name"] === "Invalid reference number"
    ) {
      return { verified: false, raw: data.slice(0, 500) };
    }
    const row = body[0];
    let amount: number | undefined;
    const amtRaw = row["Transferred Amount"];
    if (amtRaw) {
      const m = amtRaw.toString().replace(/[^0-9.]/g, "");
      if (m) amount = parseFloat(m);
    }
    return {
      verified: true,
      senderName: row["Source Account Name"],
      senderAccount: row["Source Account"],
      receiverName: row["Receiver's Name"],
      receiverAccount: row["Receiver's Account"],
      amount,
      currency: row.currency || "ETB",
      date: row["Transaction Date"],
      reference: row["Transaction Reference"],
      raw: data.slice(0, 1000),
    };
  } catch {
    return { verified: false, raw: data.slice(0, 500) };
  }
}

function parseMpesaJson(data: string, _contentType: string): ParsedReceipt {
  try {
    const payload = JSON.parse(data);
    if (payload.responseCode && String(payload.responseCode) !== "0") {
      return { verified: false, raw: data.slice(0, 500) };
    }
    return {
      verified: true,
      senderName: payload.senderName || payload.payerName,
      receiverName: payload.receiverName || payload.creditPartyName,
      amount: payload.amount ? parseFloat(payload.amount) : undefined,
      currency: payload.currency || "ETB",
      raw: data.slice(0, 1000),
    };
  } catch {
    return { verified: false, raw: data.slice(0, 500) };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bank, reference, accountNumber, phoneNumber } = body;

    if (!bank || !reference) {
      return NextResponse.json(
        { success: false, error: "Bank and reference are required." },
        { status: 400 }
      );
    }

    const config = BANKS[bank.toLowerCase()];
    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported bank. Supported: ${Object.keys(BANKS).join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (config.requiresAccount && !accountNumber) {
      return NextResponse.json(
        {
          success: false,
          error: `${config.name} requires the full receiving account number.`,
        },
        { status: 400 }
      );
    }

    const url = config.endpoint(reference, accountNumber, phoneNumber);

    let resp: Response;
    let fetchError: string | undefined;
    try {
      resp = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; cheki)" },
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
      fetchError = err instanceof Error ? err.message : String(err);
      // Check if it's a timeout or connection error (likely geo-blocking)
      const isTimeout = fetchError.includes("timeout") || fetchError.includes("aborted");
      return NextResponse.json(
        {
          success: false,
          error: isTimeout
            ? `${config.name}'s receipt endpoint is unreachable from our servers. It may be geo-blocking non-Ethiopian IPs. Try again later.`
            : `The bank's receipt endpoint is unreachable. ${fetchError}`,
          bank: config.name,
          reference,
        },
        { status: 502 }
      );
    }

    if (resp.status === 404) {
      return NextResponse.json(
        {
          success: false,
          error: "Receipt not found. Check the reference number.",
          bank: config.name,
          reference,
        },
        { status: 404 }
      );
    }

    if (resp.status >= 500) {
      return NextResponse.json(
        {
          success: false,
          error: "The bank's server is currently unavailable.",
          bank: config.name,
          reference,
        },
        { status: 502 }
      );
    }

    const contentType = resp.headers.get("content-type") || "";

    // CBE returns a PDF
    if (config.responseType === "pdf") {
      const buf = Buffer.from(await resp.arrayBuffer());
      if (!buf.toString("ascii", 0, 4).includes("%PDF")) {
        return NextResponse.json(
          {
            success: false,
            error:
              "The bank did not return a valid receipt PDF. The reference or account may be incorrect.",
            bank: config.name,
            reference,
          },
          { status: 404 }
        );
      }
      const text = await extractPdfText(buf);
      const parsed = parseCBEPdfText(text);
      if (!parsed.verified) {
        return NextResponse.json(
          {
            success: false,
            error: "Could not parse the receipt PDF. The reference or account may be incorrect.",
            bank: config.name,
            reference,
          },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        bank: config.name,
        reference,
        sourceUrl: url,
        ...parsed,
        debug_rawText: text.slice(0, 2000),
      });
    }

    // HTML or JSON
    const data = await resp.text();
    const parsed = config.parse(data, contentType);
    if (!parsed.verified) {
      return NextResponse.json(
        {
          success: false,
          error: "Receipt not found or invalid.",
          bank: config.name,
          reference,
        },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      bank: config.name,
      reference,
      sourceUrl: url,
      ...parsed,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
