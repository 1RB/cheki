import { describe, it, expect } from "vitest";
import { parseQrReference } from "@/lib/server-ocr";

describe("parseQrReference", () => {
  it("extracts CBE reference from raw QR text", () => {
    const result = parseQrReference("FT26140P01YB");
    expect(result).toEqual({ bank: "cbe", reference: "FT26140P01YB" });
  });

  it("extracts Telebirr invoice number from base64-encoded QR payload", () => {
    const result = parseQrReference(
      "ODAxODAwMDIwNjAxMDI5MTAyMDEzMTgxMjQwMDBBNDM0NzQ5MzE0YzQ0NTE0NDU1NDQ2MzA0RTYxOQ==",
    );
    expect(result).toEqual({ bank: "telebirr", reference: "CGI1LDQDUD" });
  });

  it("returns null for unknown QR payloads", () => {
    const result = parseQrReference("random unknown payload");
    expect(result).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseQrReference("")).toBeNull();
    expect(parseQrReference(null as unknown as string)).toBeNull();
  });
});
