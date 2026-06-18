import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const regions = ["fra1"]; // Frankfurt - closer to Ethiopia, may not be IP-blocked

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

  // pdf-parse extracts text with labels and values concatenated in the
  // transaction section (e.g. "PayerMr Mohammed...", "Account1****1685").
  // The header section has labels and values on separate lines.

  let senderName: string | undefined;
  let receiverName: string | undefined;
  let senderAccount: string | undefined;
  let receiverAccount: string | undefined;
  let amount: number | undefined;
  let date: string | undefined;
  let reference: string | undefined;
  let branch: string | undefined;
  let reason: string | undefined;

  // Payer: "PayerMr Mohammed Abdulwasi Reshid" (no space after label)
  const payerMatch = text.match(/Payer(Mr\s+|Mrs\s+|Ms\s+)?(.+?)(?:\n|$)/);
  if (payerMatch) {
    senderName = ((payerMatch[1] || "") + (payerMatch[2] || "")).trim();
  }

  // Receiver: "ReceiverSAMI ADIL ZEKARIA"
  const receiverMatch = text.match(/Receiver(.+?)(?:\n|$)/);
  if (receiverMatch) {
    receiverName = receiverMatch[1].trim();
  }

  // Accounts: "Account1****1685" — find all
  const accountMatches = text.matchAll(/Account([0-9*]+)/g);
  const accounts = Array.from(accountMatches).map((m) => m[1]);
  if (accounts.length >= 1) senderAccount = accounts[0];
  if (accounts.length >= 2) receiverAccount = accounts[1];

  // Amount: "Transferred Amount20,000.00 ETB" (no space after label)
  const amountMatch = text.match(/Transferred Amount([0-9,]+\.\d{2})\s*ETB/);
  if (amountMatch) {
    amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  }

  // Date: "Payment Date & Time5/20/2026, 7:29:00 PM" (no space after label)
  const dateMatch = text.match(
    /Payment Date & Time(\d{1,2}\/\d{1,2}\/\d{4}),\s+(\d{1,2}:\d{2}:\d{2})\s*(AM|PM)?/
  );
  if (dateMatch) {
    date = `${dateMatch[1]} ${dateMatch[2]}`;
    if (dateMatch[3]) date += ` ${dateMatch[3]}`;
  }

  // Reference: "Reference No. (VAT Invoice No)FT26140P01YB" (no space)
  const refMatch = text.match(/Reference No\. \(VAT Invoice No\)(\S+)/);
  if (refMatch) reference = refMatch[1];

  // Branch: value appears right before "Payment / Transaction Information"
  const branchMatch = text.match(/([A-Z][A-Z ]+?)\nPayment \/ Transaction Information/);
  if (branchMatch) branch = branchMatch[1].trim();

  // Reason: "Reason / Type of servicescreen done via Mobile" (no space)
  const reasonMatch = text.match(/Reason \/ Type of service(.+?)(?:\n|$)/);
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

// New CBE receipt API (mbreciept.cbe.com.et)
const CBE_NEW_API = "https://Mb.cbe.com.et/api/v1/transactions/public/transaction-detail";
const CBE_NEW_HEADERS = {
  "X-App-ID": "d1292e42-7400-49de-a2d3-9731caa4c819",
  "X-App-Version": "0a01980b-9859-1369-8198-59f403820000",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "application/json",
};

function parseCBENewJson(data: Record<string, unknown>): ParsedReceipt {
  try {
    const id = data.id as string;
    const debitHolder = data.debitAccountHolder as string;
    const creditHolder = data.creditAccountHolder as string;
    const debitAccount = data.debitAccountNo as string;
    const creditAccount = data.creditAccountNo as string;
    const amountStr = (data.amountCredited as string) || (data.amountDebited as string);
    const amount = amountStr ? parseFloat(amountStr) : undefined;
    const currency = (data.creditCurrency as string) || "ETB";
    const dateTimes = data.dateTimes as string[];
    const date = dateTimes && dateTimes[0] ? dateTimes[0] : undefined;
    const paymentDetails = data.paymentDetails as string[];
    const reason = paymentDetails && paymentDetails[0] ? paymentDetails[0] : undefined;

    if (!id) return { verified: false };

    return {
      verified: true,
      senderName: debitHolder,
      senderAccount: debitAccount,
      receiverName: creditHolder,
      receiverAccount: creditAccount,
      amount,
      currency,
      date,
      reference: id,
      reason,
    };
  } catch {
    return { verified: false };
  }
}

// Detect and parse URL inputs
function parseReceiptUrl(input: string): { bank: string; reference: string; accountNumber?: string } | null {
  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase();

    // New CBE: https://mbreciept.cbe.com.et/{shortId}
    if (host.includes("mbreciept.cbe.com.et") || host.includes("mb.cbe.com.et")) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length > 0) {
        return { bank: "cbe-new", reference: parts[parts.length - 1] };
      }
    }

    // Old CBE: https://apps.cbe.com.et:100/?id=FT26140P01YB60536171
    if (host.includes("apps.cbe.com.et")) {
      const id = url.searchParams.get("id");
      if (id) {
        // FT ref + last 8 digits of account
        const ftMatch = id.match(/^(FT[A-Z0-9]+)/i);
        if (ftMatch) {
          const ref = ftMatch[1];
          const accountSuffix = id.slice(ftMatch[1].length);
          return { bank: "cbe", reference: ref, accountNumber: accountSuffix };
        }
      }
    }

    // Telebirr: https://transactioninfo.ethiotelecom.et/receipt/{REFERENCE}
    if (host.includes("transactioninfo.ethiotelecom.et")) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length > 0) {
        const ref = parts[parts.length - 1];
        return { bank: "telebirr", reference: ref };
      }
    }

    // BOA: https://cs.bankofabyssinia.com/slip/?trx={REFERENCE} or /api/onlineSlip/getDetails/?id={REFERENCE}{SUFFIX}
    if (host.includes("bankofabyssinia.com")) {
      const trx = url.searchParams.get("trx");
      const id = url.searchParams.get("id");
      if (trx) return { bank: "boa", reference: trx };
      if (id) {
        // id = reference + last 5 digits
        const refMatch = id.match(/^([A-Z]{2}\d[A-Z0-9]+)/i);
        if (refMatch) {
          return { bank: "boa", reference: refMatch[1], accountNumber: id.slice(refMatch[1].length) };
        }
        return { bank: "boa", reference: id };
      }
    }

    // Dashen: https://receipt.dashensuperapp.com/receipt/{REFERENCE}
    if (host.includes("dashensuperapp.com")) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length > 0) return { bank: "dashen", reference: parts[parts.length - 1] };
    }

    // Awash: https://awashpay.awashbank.com:8225/-{REFERENCE}
    if (host.includes("awashbank.com")) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length > 0) {
        const ref = parts[parts.length - 1].replace(/^-/, "");
        return { bank: "awash", reference: ref };
      }
    }

    // Zemen: https://share.zemenbank.com/rt/{REFERENCE}/pdf
    if (host.includes("zemenbank.com")) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length > 0) return { bank: "zemen", reference: parts[0] };
    }

    // M-Pesa: https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo={REFERENCE}
    if (host.includes("safaricom.et")) {
      const trx = url.searchParams.get("trxNo");
      if (trx) return { bank: "mpesa", reference: trx };
    }

    return null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { bank, reference, accountNumber, phoneNumber } = body;

    if (!reference) {
      return NextResponse.json(
        { success: false, error: "Reference number or receipt URL is required." },
        { status: 400 }
      );
    }

    // Check if input is a URL
    const trimmedRef = (reference as string).trim();
    if (trimmedRef.startsWith("http://") || trimmedRef.startsWith("https://")) {
      const parsed = parseReceiptUrl(trimmedRef);
      if (parsed) {
        bank = parsed.bank;
        reference = parsed.reference;
        if (parsed.accountNumber && !accountNumber) {
          accountNumber = parsed.accountNumber;
        }
      } else {
        return NextResponse.json(
          { success: false, error: "Could not detect bank from URL. Please paste the reference number manually." },
          { status: 400 }
        );
      }
    }

    // Handle new CBE API (mbreciept.cbe.com.et)
    if (bank === "cbe-new") {
      try {
        const apiUrl = `${CBE_NEW_API}/${reference}`;
        const resp = await fetch(apiUrl, {
          headers: CBE_NEW_HEADERS,
          signal: AbortSignal.timeout(10000),
        });
        if (resp.status === 404) {
          return NextResponse.json(
            { success: false, error: "Receipt not found. Check the link or reference.", bank: "Commercial Bank of Ethiopia", reference },
            { status: 404 }
          );
        }
        if (!resp.ok) {
          return NextResponse.json(
            { success: false, error: "CBE receipt service unavailable. Try again.", bank: "Commercial Bank of Ethiopia", reference },
            { status: 502 }
          );
        }
        const data = await resp.json();
        const parsed = parseCBENewJson(data);
        if (!parsed.verified) {
          return NextResponse.json(
            { success: false, error: "Could not parse receipt data.", bank: "Commercial Bank of Ethiopia", reference },
            { status: 404 }
          );
        }
        return NextResponse.json({
          success: true,
          bank: "Commercial Bank of Ethiopia",
          reference: parsed.reference || reference,
          sourceUrl: `https://mbreciept.cbe.com.et/${reference}`,
          ...parsed,
        });
      } catch (err) {
        return NextResponse.json(
          { success: false, error: "Failed to reach CBE receipt service.", bank: "Commercial Bank of Ethiopia", reference },
          { status: 502 }
        );
      }
    }

    if (!bank) {
      return NextResponse.json(
        { success: false, error: "Bank is required." },
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

    // Ethiopian IP for X-Forwarded-For to bypass geo-blocking on telebirr/mpesa
    const ethIp = "197.156.96.83";
    const isGeoBlocked = bank.toLowerCase() === "telebirr" || bank.toLowerCase() === "mpesa";

    // For M-Pesa, DNS may not resolve from all servers. Use IP directly.
    const mpesaDirectUrl = url.replace("m-pesabusiness.safaricom.et", "102.218.49.92");
    const telebirrDirectUrl = url.replace("transactioninfo.ethiotelecom.et", "196.188.116.120");
    const geoUrl = bank.toLowerCase() === "mpesa" ? mpesaDirectUrl : telebirrDirectUrl;
    const geoHost = bank.toLowerCase() === "mpesa" ? "m-pesabusiness.safaricom.et" : "transactioninfo.ethiotelecom.et";

    let resp: Response;
    let fetchError: string | undefined;
    let geoFallbackUrl: string | undefined;
    try {
      if (isGeoBlocked) {
        // Try 1: native https with direct IP + X-Forwarded-For
        // This works when the server has a non-blocked IP (e.g. self-hosted in Ethiopia)
        try {
          const https = await import("node:https");
          const http = await import("node:http");
          const parsedUrl = new URL(geoUrl);
          const isHttps = parsedUrl.protocol === "https:";
          const lib = isHttps ? https : http;
          const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: "GET",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "X-Forwarded-For": ethIp, "X-Real-IP": ethIp,
              "Host": geoHost, "Accept": "text/html,application/json,*/*",
            },
            rejectUnauthorized: false, servername: geoHost,
          };
          const responseText = await new Promise<string>((resolve, reject) => {
            const req = lib.request(options, (res: any) => {
              let data = ""; res.on("data", (c: Buffer) => data += c); res.on("end", () => resolve(data));
            });
            req.on("error", reject);
            req.setTimeout(8000, () => { req.destroy(); reject(new Error("timeout")); });
            req.end();
          });
          if (responseText && responseText.length >= 10) {
            resp = new Response(responseText, {
              status: 200,
              headers: { "Content-Type": bank.toLowerCase() === "mpesa" ? "application/json" : "text/html" },
            });
          } else {
            throw new Error("empty response");
          }
        } catch {
          // Try 2: edge runtime proxy
          try {
            const edgeResp = await fetch(new URL("/api/verify-geo", request.url), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ bank, reference }),
              signal: AbortSignal.timeout(12000),
            });
            if (edgeResp.ok) {
              const edgeData = await edgeResp.json();
              if (edgeData.success) {
                return NextResponse.json(edgeData);
              }
            }
          } catch {}
          // Try 3: direct fetch with X-Forwarded-For (might work from some regions)
          try {
            resp = await fetch(url, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "X-Forwarded-For": ethIp, "X-Real-IP": ethIp,
              },
              signal: AbortSignal.timeout(8000),
            });
          } catch {
            // All server-side approaches failed - return fallback URL for client-side
            geoFallbackUrl = url;
            throw new Error("geo_blocked");
          }
        }
      } else {
        resp = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
          signal: AbortSignal.timeout(15000),
        });
      }
    } catch (err) {
      fetchError = err instanceof Error ? err.message : String(err);
      // If geo-blocked, return the receipt URL so the client can open it directly
      if (geoFallbackUrl) {
        return NextResponse.json({
          success: false,
          error: "Our server can't reach this bank (it blocks cloud IPs). Open the receipt directly:",
          fallbackUrl: geoFallbackUrl,
          bank: config.name,
          reference,
        });
      }
      return NextResponse.json(
        { success: false, error: `The bank's receipt endpoint is unreachable. ${fetchError}`, bank: config.name, reference },
        { status: 502 }
      );
    }

    if (!isGeoBlocked) {
      if (resp.status === 404) {
        return NextResponse.json(
          { success: false, error: "Receipt not found. Check the reference number.", bank: config.name, reference },
          { status: 404 }
        );
      }
      if (resp.status >= 500) {
        return NextResponse.json(
          { success: false, error: "The bank's server is currently unavailable.", bank: config.name, reference },
          { status: 502 }
        );
      }
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
    let data: string;
    if (isGeoBlocked) {
      // We already have the text from the https module
      data = await resp.text();
      // For geo-blocked banks, check if we got valid data
      if (bank.toLowerCase() === "telebirr") {
        if (data.includes("This request is not correct") || !data.toLowerCase().includes("telebirr receipt")) {
          return NextResponse.json(
            { success: false, error: "Receipt not found or invalid.", bank: config.name, reference },
            { status: 404 }
          );
        }
      }
      if (bank.toLowerCase() === "mpesa") {
        try {
          const payload = JSON.parse(data);
          if (payload.responseCode && String(payload.responseCode) !== "0") {
            return NextResponse.json(
              { success: false, error: payload.responseDescription || "Receipt not found.", bank: config.name, reference },
              { status: 404 }
            );
          }
        } catch {
          return NextResponse.json(
            { success: false, error: "Invalid response from M-Pesa.", bank: config.name, reference },
            { status: 502 }
          );
        }
      }
    } else {
      data = await resp.text();
    }
    const parsed = config.parse(data, contentType);
    if (!parsed.verified) {
      return NextResponse.json(
        { success: false, error: "Receipt not found or invalid.", bank: config.name, reference },
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
