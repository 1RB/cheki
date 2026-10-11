/**
 * Browser image helpers shared by the verify panel, OCR and the contribute box.
 *
 * Everything here runs on the device. Redrawing through a canvas drops EXIF
 * (location, device) and other metadata, and lets a 12 MP phone photo shrink
 * under the upload limit before it leaves the phone.
 */

export interface DecodedImage {
  src: CanvasImageSource;
  w: number;
  h: number;
  close: () => void;
}

export async function decodeImage(file: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file);
      return { src: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() };
    } catch {
      /* fall back to <img> (older Safari, some HEIC paths) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, close: () => undefined };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Draws a region of `src` scaled so its longer edge is at most `maxEdge` (or `scale`x, capped). */
export function drawRegion(
  src: CanvasImageSource,
  region: { x: number; y: number; w: number; h: number },
  opts: { maxEdge: number; scale?: number; background?: string }
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const wanted = opts.scale ?? 1;
  const scale = Math.min(wanted, opts.maxEdge / Math.max(region.w, region.h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(region.w * scale));
  canvas.height = Math.max(1, Math.round(region.h * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available.");
  if (opts.background) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(src, region.x, region.y, region.w, region.h, 0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
}

export function drawScaled(src: CanvasImageSource, w: number, h: number, maxEdge: number) {
  return drawRegion(src, { x: 0, y: 0, w, h }, { maxEdge, background: "#ffffff" });
}

export function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/** Vercel rejects request bodies over 4.5 MB; stay clear of it with multipart overhead. */
export const UPLOAD_LIMIT = 4 * 1024 * 1024 - 64 * 1024;

/**
 * A metadata-free JPEG of `file` no larger than `maxBytes`. Steps down the
 * size and quality until it fits; throws when even a small copy does not.
 */
export async function prepareUpload(
  file: Blob,
  opts: { maxBytes?: number; maxEdge?: number; image?: DecodedImage } = {}
): Promise<Blob> {
  const maxBytes = opts.maxBytes ?? UPLOAD_LIMIT;
  const img = opts.image ?? (await decodeImage(file));
  try {
    let edge = opts.maxEdge ?? 2000;
    for (let attempt = 0; attempt < 4; attempt++) {
      const { canvas } = drawScaled(img.src, img.w, img.h, edge);
      for (const q of [0.85, 0.7, 0.55]) {
        const blob = await toJpeg(canvas, q);
        if (blob && blob.size <= maxBytes) return blob;
      }
      edge = Math.round(edge * 0.75);
    }
    throw new Error("too large");
  } finally {
    if (!opts.image) img.close();
  }
}
