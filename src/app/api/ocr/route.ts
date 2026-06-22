import { NextRequest, NextResponse } from "next/server";
import {
  preprocessImage,
  runBestOcr,
  decodeQrFromImage,
} from "@/lib/server-ocr";
import { detectBankFromUrl, isUrl } from "@/lib/adapters/url-detector";
import {
  parseReceiptText,
  ambiguousReferenceCandidates,
} from "@/lib/ocr-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  const start = Date.now();
  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (!image || typeof image === "string") {
      return NextResponse.json(
        { success: false, error: "Image file is required." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const bytes = await image.arrayBuffer();
    const inputBuffer = Buffer.from(bytes);

    if (inputBuffer.length > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "Image is too large. Maximum size is 10MB." },
        { status: 413, headers: CORS_HEADERS }
      );
    }

    // 1. Try QR code first (fastest and most accurate for share URLs).
    const qr = await decodeQrFromImage(inputBuffer);
    if (qr?.data) {
      const parsedUrl = isUrl(qr.data) ? detectBankFromUrl(qr.data) : null;
      if (parsedUrl) {
        return NextResponse.json(
          {
            success: true,
            source: "qr",
            text: qr.data,
            bank: parsedUrl.bank,
            reference: parsedUrl.reference,
            confidence: "high",
            candidates: ambiguousReferenceCandidates(parsedUrl.reference).slice(0, 20),
            durationMs: Date.now() - start,
          },
          { headers: CORS_HEADERS }
        );
      }
    }

    // 2. Fall back to Tesseract OCR.
    const processed = await preprocessImage(inputBuffer);
    const { text, psm } = await runBestOcr(processed);
    const parsed = parseReceiptText(text);

    const candidates = parsed?.reference
      ? ambiguousReferenceCandidates(parsed.reference).slice(0, 20)
      : undefined;

    return NextResponse.json(
      {
        success: true,
        source: "tesseract",
        psm,
        text,
        candidates,
        ...parsed,
        durationMs: Date.now() - start,
      },
      { headers: CORS_HEADERS }
    );
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "OCR failed.",
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
