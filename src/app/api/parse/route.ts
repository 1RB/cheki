import { NextRequest, NextResponse } from "next/server";
import { getParser } from "@/lib/parsers/registry";
import "@/lib/parsers"; // Register all parsers
import type { ParsedReceipt, Receipt } from "@/lib/core/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Parse raw receipt HTML, JSON, or plain text without fetching from the bank.
 *
 * Two usage modes:
 *   1. Bookmarklet: reads document.documentElement.outerHTML on the bank page,
 *      sends it here with the bank code and page URL.
 *   2. Copy-paste (mobile): user opens the receipt page, selects all, copies,
 *      pastes into cheki's textarea. Input may be plain text (Telebirr) or
 *      raw JSON (M-Pesa). This endpoint auto-detects the format.
 *
 * This bypasses geo-blocking entirely because cheki's server never contacts
 * the bank. The user's browser is the one that fetched the receipt.
 */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function detectContentType(input: string, parserType: string): string {
  const trimmed = input.trim();

  // If it starts with { or [, treat as JSON
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return "application/json";
  }

  // If it contains HTML tags, treat as HTML
  if (/<html|<body|<div|<table|<span|<p[\s>]/i.test(trimmed)) {
    return "text/html";
  }

  // Plain text: Telebirr parser handles this fine because it strips HTML
  // tags (no-op for plain text) then splits by newlines and searches labels.
  // For JSON-based parsers (M-Pesa), wrap plain text in a minimal JSON
  // attempt, but if it's not JSON, the parser will return unverified.
  if (parserType === "json") {
    // Try to parse as JSON anyway (maybe it has whitespace before {)
    try {
      JSON.parse(trimmed);
      return "application/json";
    } catch {
      return "text/plain";
    }
  }

  // For HTML parsers, plain text works (parser strips tags, splits lines)
  return "text/html";
}

/**
 * Wrap plain text in minimal HTML so the parser's validation checks pass.
 * The Telebirr parser checks for "telebirr receipt" in the content, which
 * is present in the actual HTML page but not in plain text copied by mobile
 * users. We add it as a hidden title so the check passes but it doesn't
 * interfere with field extraction.
 */
function wrapPlainText(text: string, bankCode: string): string {
  const bankMarker =
    bankCode === "telebirr" ? "telebirr receipt" :
    bankCode === "mpesa" ? "mpesa receipt" : "";
  return `<html><head><title>${bankMarker}</title></head><body><pre>${text}</pre></body></html>`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bank, html, content, url } = body as {
      bank?: string;
      html?: string;
      content?: string;
      url?: string;
    };

    // Accept both `html` and `content` fields (content is used by the paste flow)
    const rawData = html || content;

    if (!bank) {
      return NextResponse.json(
        { success: false, error: "Bank code is required." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!rawData || !rawData.trim()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Receipt content is required. Open the receipt page, copy the page content, and paste it here.",
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Auto-detect bank from URL if not specified
    let bankCode = bank;
    if (!bankCode && url) {
      if (url.includes("ethiotelecom.et")) bankCode = "telebirr";
      else if (url.includes("safaricom.et") || url.includes("m-pesa"))
        bankCode = "mpesa";
    }

    const parser = getParser(bankCode);
    if (!parser) {
      return NextResponse.json(
        { success: false, error: `Bank "${bankCode}" is not supported.` },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Auto-detect content type (HTML, JSON, or plain text)
    const contentType = detectContentType(rawData, parser.responseType);

    // If the content is plain text (no HTML tags), wrap it in minimal HTML
    // so the parser's validation checks (e.g. "telebirr receipt" header) pass
    let parseData = rawData;
    if (contentType === "text/html" && !/<html|<body|<div|<table|<span|<p[\s>]/i.test(rawData.trim())) {
      parseData = wrapPlainText(rawData, bankCode);
    }

    const parsed: ParsedReceipt = parser.parse(parseData, contentType);

    if (!parsed.verified) {
      // Provide a helpful error based on what was pasted
      const isPlainText = contentType === "text/plain";
      const errorMsg = isPlainText
        ? `Could not parse the receipt from the pasted text. Make sure you copied the full receipt page content (long press on the page, Select All, then Copy).`
        : `Could not parse receipt from the provided content. Make sure you are on the bank's receipt page.`;

      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: errorMsg,
          bank: parser.bankName,
        },
        { status: 422, headers: CORS_HEADERS }
      );
    }

    // Return the full parsed receipt with all fields (including Telebirr-specific)
    const receipt: Receipt & Partial<ParsedReceipt> = {
      verified: true,
      bank: parser.bankName,
      bankCode: bankCode,
      reference: parsed.reference || "unknown",
      senderName: parsed.senderName,
      senderAccount: parsed.senderAccount,
      receiverName: parsed.receiverName,
      receiverAccount: parsed.receiverAccount,
      amount: parsed.amount,
      currency: parsed.currency || "ETB",
      date: parsed.date,
      sourceUrl: url || "(via paste/bookmarklet)",
      durationMs: 0,
      // Telebirr / wallet-specific fields
      invoiceNumber: parsed.invoiceNumber,
      transactionStatus: parsed.transactionStatus,
      settledAmount: parsed.settledAmount,
      stampDuty: parsed.stampDuty,
      discountAmount: parsed.discountAmount,
      serviceFee: parsed.serviceFee,
      serviceFeeVat: parsed.serviceFeeVat,
      totalPaid: parsed.totalPaid,
      amountInWords: parsed.amountInWords,
      paymentMode: parsed.paymentMode,
      paymentChannel: parsed.paymentChannel,
      bankAccountNumber: parsed.bankAccountNumber,
      bankAccountName: parsed.bankAccountName,
      reason: parsed.reason,
    };

    return NextResponse.json(
      { success: true, ...receipt },
      { headers: CORS_HEADERS }
    );
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Internal server error.",
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
