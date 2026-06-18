/**
 * Tests for error types and helpers.
 */
import { describe, it, expect } from "vitest";
import { ok, err, errorToHttpStatus, errorToMessage } from "@/lib/core/types";

describe("Result type", () => {
  it("ok creates a success result", () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  it("err creates a failure result", () => {
    const result = err({ kind: "MISSING_INPUT", field: "reference", message: "Required" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("MISSING_INPUT");
    }
  });
});

describe("errorToHttpStatus", () => {
  it("maps BANK_NOT_SUPPORTED to 404", () => {
    expect(errorToHttpStatus({ kind: "BANK_NOT_SUPPORTED", bank: "x" })).toBe(404);
  });

  it("maps REF_ERROR to 400", () => {
    expect(errorToHttpStatus({ kind: "REF_ERROR", bank: "cbe", message: "bad" })).toBe(400);
  });

  it("maps MISSING_INPUT to 400", () => {
    expect(errorToHttpStatus({ kind: "MISSING_INPUT", field: "ref", message: "bad" })).toBe(400);
  });

  it("maps ENDPOINT_ERROR to 502", () => {
    expect(errorToHttpStatus({ kind: "ENDPOINT_ERROR", bank: "cbe", message: "down" })).toBe(502);
  });

  it("maps EXTRACTION_ERROR to 422", () => {
    expect(errorToHttpStatus({ kind: "EXTRACTION_ERROR", bank: "cbe", message: "bad" })).toBe(422);
  });

  it("maps INTERNAL_ERROR to 500", () => {
    expect(errorToHttpStatus({ kind: "INTERNAL_ERROR", message: "oops" })).toBe(500);
  });
});

describe("errorToMessage", () => {
  it("formats BANK_NOT_SUPPORTED with suggestion", () => {
    const msg = errorToMessage({
      kind: "BANK_NOT_SUPPORTED",
      bank: "cbe",
      suggestion: "cbe",
    });
    expect(msg).toContain("Unsupported bank: cbe");
    expect(msg).toContain("Did you mean");
  });

  it("formats MISSING_INPUT", () => {
    const msg = errorToMessage({
      kind: "MISSING_INPUT",
      field: "reference",
      message: "Reference is required.",
    });
    expect(msg).toBe("Reference is required.");
  });
});
