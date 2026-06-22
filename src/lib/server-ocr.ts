import sharp from "sharp";
import path from "path";
import type { QRCode } from "jsqr";
import { PSM } from "tesseract.js";

const TESSDATA_DIR = path.join(process.cwd(), "public");
const TESSERACT_ROOT = path.dirname(require.resolve("tesseract.js/package.json"));
const WORKER_PATH = path.join(TESSERACT_ROOT, "src", "worker-script", "node", "index.js");

export interface OcrConfig {
  /** Tesseract page segmentation mode (PSM). 6 = single uniform block, 11 = sparse text. */
  psm?: keyof typeof PSM;
  /** Restrict recognized characters. Useful for a reference-only pass. */
  whitelist?: string;
}

export interface OcrResult {
  text: string;
  psm: string;
}

/**
 * Preprocess a receipt image for OCR / QR reading.
 *
 * Receipts are often screenshots taken in uneven lighting, with curved stamps
 * and small fonts. We: upscale, grayscale, auto-contrast, sharpen, and output
 * a high-quality JPEG. This gives Tesseract the cleanest possible input while
 * keeping QR codes readable.
 */
export async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: false })
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1.5, m1: 0.5, m2: 0.5 })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

/**
 * Try to decode a QR code from an image buffer.
 *
 * Many Ethiopian receipts (Awash, CBE, etc.) embed a QR code that contains
 * the share URL or a reference number. Decoding it is faster and more accurate
 * than OCR and avoids ambiguous characters (0 vs O).
 */
export async function decodeQrFromImage(buffer: Buffer): Promise<QRCode | null> {
  const { default: jsQR } = await import("jsqr");
  const img = sharp(buffer)
    .resize(1200, 1200, { fit: "inside" })
    .toColorspace("srgb")
    .ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });

  const code = jsQR(new Uint8ClampedArray(data), info.width, info.height, {
    inversionAttempts: "attemptBoth",
  });

  return code || null;
}

export async function runOcr(buffer: Buffer, config?: OcrConfig): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    workerPath: WORKER_PATH,
    logger: () => {},
    errorHandler: () => {},
    cachePath: "/tmp",
    langPath: TESSDATA_DIR,
    gzip: true,
  });
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: config?.psm ? PSM[config.psm] : PSM.SINGLE_BLOCK,
      preserve_interword_spaces: "1",
      ...(config?.whitelist ? { tessedit_char_whitelist: config.whitelist } : {}),
    });
    const ret = await worker.recognize(buffer);
    return ret.data.text;
  } finally {
    await worker.terminate();
  }
}

function hasReferenceToken(text: string): boolean {
  return /\b(FT[A-Z0-9]{6,}|(DET|CHQ|DAB|DEL|ADQ|DEP|CHG|CHA|CHB|CHC|CHD|CHE|CHF|DEB|DEC|DED|DEE|DEF|DEG|DEH|DEI|DEJ|DEK|DEM|DEN|DEO|DEQ|DER|DES|DEU|DEV|DEW|DEX|DEY|DEZ|DF)[A-Z0-9]{6,}|[A-Z]{2}\d[A-Z0-9]{5,}|\d{14,18})\b/i.test(
    text
  );
}

/**
 * Run OCR with the best configuration for receipts.
 *
 * Strategy:
 *   1. PSM 6 (single uniform block) is optimal for most clean screenshots.
 *   2. If no reference-like token is found, fall back to PSM 11 (sparse text)
 *      which handles curved/incomplete receipts better.
 *
 * This keeps the common case fast while improving accuracy on harder images.
 */
export async function runBestOcr(buffer: Buffer): Promise<OcrResult> {
  const text6 = await runOcr(buffer, { psm: "SINGLE_BLOCK" });
  if (hasReferenceToken(text6)) {
    return { text: text6, psm: PSM.SINGLE_BLOCK };
  }

  const text11 = await runOcr(buffer, { psm: "SPARSE_TEXT" });
  return { text: text11 || text6, psm: PSM.SPARSE_TEXT };
}

/**
 * Legacy OCR helper for callers that only need the text string.
 */
export async function runOcrText(buffer: Buffer): Promise<string> {
  const result = await runBestOcr(buffer);
  return result.text;
}
