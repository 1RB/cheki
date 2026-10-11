/**
 * /api/ocr body cap (CodeRabbit on PR #28). The cap must hold while the body
 * is being read, so a chunked upload with no Content-Length can't make the
 * server buffer an unbounded body before the size check.
 */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as ocrPOST } from "@/app/api/ocr/route";
import { readBytesCapped, readFormDataCapped, BodyTooLargeError } from "@/lib/http/read-body";

let ip = 0;
const freshIp = () => `10.77.${Math.floor(++ip / 250)}.${ip % 250}`;

/** A streamed body with no Content-Length, `chunks` x `size` bytes. */
function chunkedStream(chunks: number, size: number, onPull?: () => void): ReadableStream<Uint8Array> {
  let sent = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      onPull?.();
      if (sent >= chunks) {
        controller.close();
        return;
      }
      sent++;
      controller.enqueue(new Uint8Array(size));
    },
  });
}

describe("/api/ocr body cap", () => {
  it("returns 413 for a chunked upload with no Content-Length, and stops reading early", async () => {
    let pulls = 0;
    // 64 chunks of 1 MB = 64 MB, far over the 10 MB cap.
    const body = chunkedStream(64, 1024 * 1024, () => pulls++);
    const req = new NextRequest("http://localhost/api/ocr", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=x", "x-real-ip": freshIp() },
      body,
      duplex: "half",
    } as unknown as ConstructorParameters<typeof NextRequest>[1]);
    expect(req.headers.get("content-length")).toBeNull();
    const res = await ocrPOST(req);
    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.success).toBe(false);
    // It cancelled the stream shortly after the cap, not after 64 MB.
    expect(pulls).toBeLessThan(20);
  });

  it("returns 413 when Content-Length declares an oversized body", async () => {
    const req = new NextRequest("http://localhost/api/ocr", {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=x",
        "content-length": String(50 * 1024 * 1024),
        "x-real-ip": freshIp(),
      },
      body: "x",
    });
    const res = await ocrPOST(req);
    expect(res.status).toBe(413);
  });

  it("parses a normal multipart upload from the capped bytes", async () => {
    const fd = new FormData();
    fd.append("note", "no image here");
    const req = new NextRequest("http://localhost/api/ocr", {
      method: "POST",
      headers: { "x-real-ip": freshIp() },
      body: fd,
    });
    const res = await ocrPOST(req);
    // The form was read; it just has no image field.
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Image file is required.");
  });

  it("a non-multipart body is a 400, not a 500", async () => {
    const req = new NextRequest("http://localhost/api/ocr", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": freshIp() },
      body: "{}",
    });
    const res = await ocrPOST(req);
    expect(res.status).toBe(400);
  });
});

describe("read-body helpers", () => {
  it("readBytesCapped throws past the cap on a stream with no Content-Length", async () => {
    const req = new Request("http://localhost/", {
      method: "POST",
      body: chunkedStream(10, 1024),
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    await expect(readBytesCapped(req, 4096)).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it("readFormDataCapped returns the fields of a small form", async () => {
    const fd = new FormData();
    fd.append("a", "1");
    const req = new Request("http://localhost/", { method: "POST", body: fd });
    const out = await readFormDataCapped(req, 64 * 1024);
    expect(out.get("a")).toBe("1");
  });
});
