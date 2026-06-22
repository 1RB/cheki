"use client";

/**
 * Lightweight OCR wrapper using tesseract.js.
 *
 * The library is loaded dynamically so the large worker/traineddata files are
 * only fetched when a user actually uploads or captures a receipt photo.
 */

export type OcrProgress = {
  status: string;
  progress: number;
};

export async function extractTextFromImage(
  source: string | File | Blob,
  onProgress?: (p: OcrProgress) => void
): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (typeof m === "object" && m.status && onProgress) {
        onProgress({ status: m.status, progress: m.progress ?? 0 });
      }
    },
  });
  try {
    const ret = await worker.recognize(source);
    return ret.data.text;
  } finally {
    await worker.terminate();
  }
}

export function imageToBlob(image: HTMLImageElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context not available");
  ctx.drawImage(image, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("canvas toBlob failed"));
    }, "image/jpeg", 0.92);
  });
}
