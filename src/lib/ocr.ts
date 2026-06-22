"use client";

import type { OcrParseResult } from "./ocr-parser";

export type OcrProgress = {
  status: string;
  progress: number;
};

export type OcrServerResult = {
  text: string;
  parsed: (OcrParseResult & { candidates?: string[] }) | null;
};

async function sourceToFile(source: string | File | Blob): Promise<File | Blob> {
  if (typeof source === "string") {
    const resp = await fetch(source);
    if (!resp.ok) throw new Error("Failed to fetch image.");
    return resp.blob();
  }
  return source;
}

/**
 * Server-side OCR.
 *
 * The image is uploaded to /api/ocr, where it is preprocessed with sharp
 * and run through Tesseract. This avoids fetching the large traineddata files
 * in the browser and gives us more CPU/ram for preprocessing, so it is both
 * faster and more accurate than client-side tesseract.js.
 */
export async function extractTextFromImage(
  source: string | File | Blob,
  onProgress?: (p: OcrProgress) => void
): Promise<OcrServerResult> {
  const file = await sourceToFile(source);

  onProgress?.({ status: "uploading", progress: 0.15 });

  const formData = new FormData();
  formData.append("image", file);

  const resp = await fetch("/api/ocr", {
    method: "POST",
    body: formData,
  });

  onProgress?.({ status: "parsing", progress: 0.85 });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || "OCR failed.");
  }

  const data = await resp.json();
  if (!data.success) {
    throw new Error(data.error || "OCR failed.");
  }

  onProgress?.({ status: "done", progress: 1 });

  return {
    text: data.text,
    parsed: data.reference
      ? {
          reference: data.reference,
          bank: data.bank,
          confidence: data.confidence,
          rawText: data.text,
          matches: data.matches,
          candidates: data.candidates,
        }
      : null,
  };
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
