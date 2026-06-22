"use client";

import type { OcrParseResult } from "./ocr-parser";
import { parseReceiptText } from "./ocr-parser";

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

async function runClientOcr(
  file: File | Blob,
  onProgress?: (p: OcrProgress) => void
): Promise<OcrServerResult> {
  onProgress?.({ status: "loading model", progress: 0.1 });

  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text") {
        onProgress?.({ status: "reading text", progress: 0.1 + m.progress * 0.8 });
      }
    },
    errorHandler: () => {},
    // Load the traineddata from our own domain so it is cached with the PWA
    // and doesn't hit a third-party CDN.
    langPath: typeof window !== "undefined" ? window.location.origin : undefined,
    gzip: true,
  });

  try {
    onProgress?.({ status: "reading text", progress: 0.2 });
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: "1",
    });
    const ret = await worker.recognize(file);
    const text = ret.data.text;
    const parsed = parseReceiptText(text);

    onProgress?.({ status: "done", progress: 1 });

    return {
      text,
      parsed: parsed
        ? {
            ...parsed,
            candidates: parsed.reference
              ? ambiguousReferenceCandidatesClient(parsed.reference).slice(0, 20)
              : undefined,
          }
        : null,
    };
  } finally {
    await worker.terminate();
  }
}

function ambiguousReferenceCandidatesClient(reference: string): string[] {
  const candidates = new Set<string>();
  candidates.add(reference);

  const chars = reference.split("");
  const ambiguous: Record<string, string[]> = {
    O: ["O", "0"],
    0: ["0", "O"],
    I: ["I", "1"],
    1: ["1", "I"],
    L: ["L", "I", "1"],
    B: ["B", "8"],
    S: ["S", "5"],
    Z: ["Z", "2"],
  };

  function backtrack(idx: number, current: string[]) {
    if (idx === chars.length) {
      candidates.add(current.join(""));
      return;
    }
    const char = chars[idx].toUpperCase();
    const options = ambiguous[char] || [char];
    for (const option of options) {
      current.push(option);
      backtrack(idx + 1, current);
      current.pop();
    }
  }

  backtrack(0, []);
  return Array.from(candidates);
}

/**
 * Extract text from a receipt image.
 *
 * Strategy:
 *   1. Upload the image to the server to check for a QR code. If the QR code
 *      contains a known receipt URL, return the parsed reference immediately.
 *   2. If no QR is found, run Tesseract.js in the browser. This keeps the
 *      image on the device (better privacy) and avoids loading the heavy
 *      Tesseract model on the server, which is unreliable in Vercel serverless.
 */
export async function extractTextFromImage(
  source: string | File | Blob,
  onProgress?: (p: OcrProgress) => void
): Promise<OcrServerResult> {
  const file = await sourceToFile(source);

  onProgress?.({ status: "uploading", progress: 0.05 });

  const formData = new FormData();
  formData.append("image", file);

  const resp = await fetch("/api/ocr", {
    method: "POST",
    body: formData,
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || "OCR failed.");
  }

  const data = await resp.json();
  if (!data.success) {
    throw new Error(data.error || "OCR failed.");
  }

  // QR detected by the server -> return immediately.
  if (data.source === "qr" && data.reference) {
    onProgress?.({ status: "done", progress: 1 });
    return {
      text: data.text,
      parsed: {
        reference: data.reference,
        bank: data.bank,
        confidence: data.confidence,
        rawText: data.text,
        matches: data.matches,
        candidates: data.candidates,
      },
    };
  }

  // No QR -> run client-side Tesseract.
  return runClientOcr(file, onProgress);
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
