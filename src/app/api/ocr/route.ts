import { NextRequest, NextResponse } from "next/server";
import { preprocessImage, runOcr, runVisionOcr } from "@/lib/server-ocr";
import { parseReceiptText, ambiguousReferenceCandidates } from "@/lib/ocr-parser";

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

    const processed = await preprocessImage(inputBuffer);
    let text: string;
    if (process.env.FIREWORKS_API_KEY) {
      // Vision model is faster and more accurate on ambiguous characters (0 vs O).
      text = await runVisionOcr(processed);
    } else {
      text = await runOcr(processed);
    }
    const parsed = parseReceiptText(text);

    const candidates = parsed?.reference
      ? ambiguousReferenceCandidates(parsed.reference).slice(0, 20)
      : undefined;

    return NextResponse.json(
      {
        success: true,
        text,
        candidates,
        ...parsed,
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
