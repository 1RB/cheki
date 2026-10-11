/**
 * The one QR pipeline. Used by the verify panel (upload, paste, drop, camera)
 * and the contribute box.
 *
 * - The native BarcodeDetector is tried first, one shared instance.
 * - jsQR (46 KB gz) is imported on first use only, never in the page bundle.
 * - Photos are scanned in passes: the whole image, the bottom half enlarged
 *   (receipt QRs sit at the bottom) and the centre enlarged, so a small QR in
 *   a tall screenshot is found without asking the user to crop.
 */
import { decodeImage, drawRegion, type DecodedImage } from "@/lib/image/prepare";

type JsQR = typeof import("jsqr").default;
let jsqrPromise: Promise<JsQR> | null = null;

export function loadJsQR(): Promise<JsQR> {
  jsqrPromise ??= import("jsqr").then((m) => m.default);
  return jsqrPromise;
}

interface NativeDetector {
  detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]>;
}

let detector: NativeDetector | null | undefined;

function nativeDetector(): NativeDetector | null {
  if (detector !== undefined) return detector;
  const Ctor = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => NativeDetector }).BarcodeDetector;
  try {
    detector = Ctor ? new Ctor({ formats: ["qr_code"] }) : null;
  } catch {
    detector = null;
  }
  return detector;
}

/**
 * A BOA receipt QR: base64 of AES-CBC ciphertext (a multiple of 16 bytes).
 * It is only an input: BOA must still confirm the reference inside it.
 */
export function isBoaQrPayload(input: string): boolean {
  const t = input.trim();
  if (t.length < 80 || t.length > 4096) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(t)) return false;
  try {
    const decoded = atob(t);
    return decoded.length % 16 === 0 && decoded.length >= 32;
  } catch {
    return false;
  }
}

export async function decodeQrFromImageData(
  data: ImageData,
  opts: { invert?: boolean; skipNative?: boolean } = {}
): Promise<string | null> {
  const native = opts.skipNative ? null : nativeDetector();
  if (native) {
    try {
      const codes = await native.detect(data);
      if (codes[0]?.rawValue) return codes[0].rawValue;
    } catch {
      /* fall through to jsQR */
    }
  }
  const jsQR = await loadJsQR();
  const code = jsQR(data.data, data.width, data.height, { inversionAttempts: opts.invert ? "attemptBoth" : "dontInvert" });
  return code?.data || null;
}

type Pass = { x: number; y: number; w: number; h: number; scale: number; maxEdge: number; invert?: boolean };

function passes(w: number, h: number): Pass[] {
  const cw = Math.floor(w * 0.4);
  const ch = Math.floor(h * 0.4);
  return [
    { x: 0, y: 0, w, h, scale: 1, maxEdge: 2000, invert: true },
    { x: 0, y: 0, w, h, scale: 1, maxEdge: 1000 },
    { x: 0, y: Math.floor(h * 0.5), w, h: Math.ceil(h * 0.5), scale: 2, maxEdge: 1920 },
    { x: Math.floor((w - cw) / 2), y: Math.floor((h - ch) / 2), w: cw, h: ch, scale: 3, maxEdge: 1920 },
  ];
}

/** Finds a QR code in a photo or screenshot. Resolves null when there is none; never throws. */
export async function decodeQrFromImage(file: Blob | DecodedImage): Promise<string | null> {
  let img: DecodedImage | null = null;
  const owned = file instanceof Blob;
  try {
    img = owned ? await decodeImage(file as Blob) : (file as DecodedImage);
    const seen = new Set<string>();
    for (const p of passes(img.w, img.h)) {
      const { canvas, ctx } = drawRegion(img.src, p, { maxEdge: p.maxEdge, scale: p.scale });
      const sig = `${canvas.width}x${canvas.height}@${p.x},${p.y}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      const found = await decodeQrFromImageData(ctx.getImageData(0, 0, canvas.width, canvas.height), { invert: p.invert });
      if (found) return found;
    }
    return null;
  } catch {
    return null;
  } finally {
    if (owned) img?.close();
  }
}
