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

  const lines = text.split("\n").map((l) => l.trim());
  let senderName: string | undefined;
  let receiverName: string | undefined;
  let senderAccount: string | undefined;
  let receiverAccount: string | undefined;
  let amount: number | undefined;
  let date: string | undefined;
  let reference: string | undefined;
  let branch: string | undefined;
  let reason: string | undefined;
  const accounts: string[] = [];

  for (const line of lines) {
    if (line.startsWith("Payer") && !senderName) {
      senderName = line.replace("Payer", "").trim();
    } else if (line.startsWith("Receiver") && !receiverName) {
      receiverName = line.replace("Receiver", "").trim();
    } else if (line.startsWith("Account")) {
      const m = line.match(/Account\s+([0-9*]+)/);
      if (m) accounts.push(m[1]);
    } else if (line.includes("Transferred Amount")) {
      const m = line.match(/Transferred Amount\s+([0-9,]+\.\d{2})\s*ETB/);
      if (m) amount = parseFloat(m[1].replace(/,/g, ""));
    } else if (line.includes("Payment Date & Time")) {
      const m = line.match(
        /Payment Date & Time\s+(\d{1,2}\/\d{1,2}\/\d{4}),\s+(\d{1,2}:\d{2}:\d{2})\s*(AM|PM)?/
      );
      if (m) {
        let ds = `${m[1]} ${m[2]}`;
        if (m[3]) ds += ` ${m[3]}`;
        date = ds;
      }
    } else if (line.includes("VAT Receipt No:")) {
      const m = line.match(/VAT Receipt No:\s*(\S+)/);
      if (m) reference = m[1];
    } else if (line.includes("Branch:")) {
      const m = line.match(/Branch:\s*(.+)/);
      if (m) branch = m[1].trim();
    } else if (line.includes("Reason / Type of service")) {
      reason = line.replace("Reason / Type of service", "").trim();
    }
  }

  if (accounts.length >= 1) senderAccount = accounts[0];
  if (accounts.length >= 2) receiverAccount = accounts[1];

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
    try {
      resp = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; cheki)" },
      });
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "The bank's receipt endpoint is unreachable. It may be down or geo-blocking.",
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
