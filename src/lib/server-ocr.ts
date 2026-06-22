import sharp from "sharp";
import path from "path";

const TESSDATA_DIR = path.join(process.cwd(), "public");

/**
 * Preprocess a receipt image for OCR.
 *
 * Receipts are often screenshots taken in uneven lighting, with curved stamps
 * and small fonts. We: upscale, grayscale, auto-contrast, sharpen, and output
 * a high-quality JPEG. This gives Tesseract the cleanest possible input.
 */
export async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(1280, 1280, { fit: "inside", withoutEnlargement: false })
    .grayscale()
    .normalize()
    .sharpen(1, 1, 2)
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

export async function runOcr(buffer: Buffer): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: () => {},
    errorHandler: () => {},
    cachePath: "/tmp",
    langPath: TESSDATA_DIR,
    gzip: true,
  });
  try {
    const ret = await worker.recognize(buffer);
    return ret.data.text;
  } finally {
    await worker.terminate();
  }
}

export interface VisionOcrOptions {
  apiKey?: string;
  model?: string;
  prompt?: string;
  maxTokens?: number;
}

/**
 * Vision-model OCR fallback for cases where Tesseract is too slow or ambiguous
 * characters (0 vs O) are hard to resolve. Requires a Fireworks API key.
 */
export async function runVisionOcr(
  buffer: Buffer,
  options: VisionOcrOptions = {}
): Promise<string> {
  const apiKey = options.apiKey || process.env.FIREWORKS_API_KEY;
  if (!apiKey) {
    throw new Error("FIREWORKS_API_KEY is not set.");
  }
  const model = options.model || process.env.FIREWORKS_VISION_MODEL || "accounts/fireworks/models/kimi-k2p7-code";
  const prompt =
    options.prompt ||
    "Transcribe all visible text from this Ethiopian bank receipt image. Preserve line breaks. Output only the receipt text, no commentary.";

  const base64 = buffer.toString("base64");
  const res = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "You are a precise OCR engine. Output only the text visible in the image, no explanations.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } },
          ],
        },
      ],
      max_tokens: options.maxTokens || 800,
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vision OCR failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || "").trim();
}
