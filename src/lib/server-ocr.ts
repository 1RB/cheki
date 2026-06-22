import sharp from "sharp";
import type { QRCode } from "jsqr";

/**
 * Decode a QR code from an image buffer.
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

/**
 * Preprocess a receipt image for OCR.
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
