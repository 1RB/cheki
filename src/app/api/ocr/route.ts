import { NextRequest, NextResponse } from "next/server";
import { decodeQrFromImage, parseQrReference } from "@/lib/server-ocr";
import { detectBankFromUrl, isUrl } from "@/lib/adapters/url-detector";
import { ambiguousReferenceCandidates } from "@/lib/ocr-parser";
import { limiters, rateLimited } from "@/lib/rate-limit";
import { readFormDataCapped, BodyTooLargeError, InvalidFormDataError } from "@/lib/http/read-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** The image plus room for multipart boundaries and headers. */
const MAX_BODY_BYTES = MAX_IMAGE_BYTES + 64 * 1024;
const TOO_LARGE = "Image is too large. Maximum size is 10MB.";

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
  const limited = rateLimited(limiters.ocr, request.headers, 1, CORS_HEADERS);
  if (limited) return limited;

  // The body is read with a hard cap (Content-Length and the stream itself,
  // so a chunked upload with no Content-Length is covered too), then the form
  // is parsed from those capped bytes.
  let formData: FormData;
  try {
    formData = await readFormDataCapped(request, MAX_BODY_BYTES);
  } catch (e) {
    if (e instanceof BodyTooLargeError) {
      return NextResponse.json({ success: false, error: TOO_LARGE }, { status: 413, headers: CORS_HEADERS });
    }
    if (e instanceof InvalidFormDataError) {
      return NextResponse.json(
        { success: false, error: "Image file is required." },
        { status: 400, headers: CORS_HEADERS }
      );
    }
    return NextResponse.json(
      { success: false, error: "Could not read that image. Try a JPEG or PNG screenshot." },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  try {
    const image = formData.get("image");

    if (!image || typeof image === "string") {
      return NextResponse.json(
        { success: false, error: "Image file is required." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const bytes = await image.arrayBuffer();
    const inputBuffer = Buffer.from(bytes);

    if (inputBuffer.length > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { success: false, error: TOO_LARGE },
        { status: 413, headers: CORS_HEADERS }
      );
    }

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

      // QR is not a URL, but it may be a raw reference or encoded payload.
      const parsedRef = parseQrReference(qr.data);
      if (parsedRef) {
        return NextResponse.json(
          {
            success: true,
            source: "qr",
            text: qr.data,
            bank: parsedRef.bank,
            reference: parsedRef.reference,
            confidence: "high",
            candidates: ambiguousReferenceCandidates(parsedRef.reference).slice(0, 20),
            durationMs: Date.now() - start,
          },
          { headers: CORS_HEADERS }
        );
      }
    }

    // No QR detected. The client will fall back to client-side Tesseract.js.
    return NextResponse.json(
      {
        success: true,
        source: "none",
        text: "",
        qrDetected: false,
        durationMs: Date.now() - start,
      },
      { headers: CORS_HEADERS }
    );
  } catch {
    // Fixed message: decoder internals stay on the server.
    return NextResponse.json(
      { success: false, error: "Could not read that image. Try a JPEG or PNG screenshot." },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
