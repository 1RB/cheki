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
 * Parse raw receipt HTML/JSON without fetching from the bank endpoint.
 *
 * Used by the cheki bookmarklet: the user opens the bank's receipt page
 * directly (from their Ethiopian IP), clicks the bookmarklet, which reads
 * the page HTML and sends it here for parsing.
 *
 * This bypasses geo-blocking entirely because cheki's server never contacts
 * the bank. The user's browser is the one that fetched the receipt.
 */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bank, html, url } = body as {
      bank?: string;
      html?: string;
      url?: string;
    };

    if (!bank) {
      return NextResponse.json(
        { success: false, error: "Bank code is required." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!html) {
      return NextResponse.json(
        { success: false, error: "Page HTML content is required." },
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

    const contentType =
      parser.responseType === "json" ? "application/json" : "text/html";
    const parsed: ParsedReceipt = parser.parse(html, contentType);

    if (!parsed.verified) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          error:
            "Could not parse receipt from the provided HTML. Make sure you are on the bank's receipt page.",
          bank: parser.bankName,
        },
        { status: 422, headers: CORS_HEADERS }
      );
    }

    const receipt: Receipt = {
      verified: true,
      bank: parser.bankName,
      bankCode: bankCode,
      reference: parsed.reference || "unknown",
      senderName: parsed.senderName,
      receiverName: parsed.receiverName,
      amount: parsed.amount,
      currency: parsed.currency || "ETB",
      date: parsed.date,
      sourceUrl: url || "(via bookmarklet)",
      durationMs: 0,
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
