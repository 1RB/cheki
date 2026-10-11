/**
 * Frontend labelling (CodeRabbit on PR #28): only `verified: true` may drive
 * green, "Verified" or a success toast. `success` only means the request was
 * handled; decodedOnly and parsed results are amber and never saved as checked.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { verificationState } from "@/lib/banks";
import { cliVerdict } from "@/cli/verdict";

describe("verificationState", () => {
  it("is verified only for success + verified:true", () => {
    expect(verificationState({ success: true, verified: true })).toBe("verified");
  });

  it("success without verified is never verified", () => {
    expect(verificationState({ success: true })).toBe("none");
    expect(verificationState({ success: true, verified: false })).toBe("none");
  });

  it("a decoded-only BOA QR is decodedOnly, even if verified is wrongly set", () => {
    expect(verificationState({ success: true, verified: false, decodedOnly: true })).toBe("decodedOnly");
    expect(verificationState({ success: true, verified: true, decodedOnly: true })).toBe("decodedOnly");
  });

  it("pasted content is parsed, even if verified is wrongly set", () => {
    expect(verificationState({ success: true, verified: false, parsed: true })).toBe("parsed");
    expect(verificationState({ success: true, verified: true, parsed: true })).toBe("parsed");
  });

  it("failed requests and missing results are none", () => {
    expect(verificationState({ success: false, verified: true })).toBe("none");
    expect(verificationState(null)).toBe("none");
    expect(verificationState(undefined)).toBe("none");
  });

  it("truthy non-boolean values do not count", () => {
    const loose = { success: true, verified: "true" } as unknown as Parameters<typeof verificationState>[0];
    expect(verificationState(loose)).toBe("none");
  });
});

describe("HomePage labels", () => {
  const src = readFileSync(join(__dirname, "..", "..", "src/components/HomePage.tsx"), "utf8");

  it("no label or colour is keyed on `success` alone", () => {
    expect(src).not.toMatch(/result\?\.success\s*\?/);
    expect(src).not.toMatch(/r\.data\?\.success/);
    expect(src).not.toMatch(/result && result\.success &&/);
  });

  it("the success toast and history save sit behind verificationState", () => {
    const toastIdx = src.indexOf('title: "Receipt verified"');
    expect(toastIdx).toBeGreaterThan(-1);
    const before = src.slice(Math.max(0, toastIdx - 300), toastIdx);
    expect(before).toMatch(/state === "verified"/);
    expect(src).toMatch(/Decoded from QR, not confirmed with the bank/);
    const saveIdx = src.indexOf('localStorage.setItem("cheki_history", JSON.stringify(newHistory))');
    expect(src.slice(Math.max(0, saveIdx - 600), saveIdx)).toMatch(/if \(state === "verified"\)/);
  });

  it("a batch image scan that throws still settles and frees its object URL", () => {
    expect(src).toMatch(/scanImageMultiScale\(img\)\.then\(resolve, \(\) => resolve\(null\)\)/);
    expect(src).toMatch(/\.finally\(\(\) => URL\.revokeObjectURL\(objectUrl\)\)/);
  });

  it("the inline bookmarklet escapes the API error before innerHTML", () => {
    expect(src).toMatch(/esc\(d\.error\|\|/);
    expect(src).not.toMatch(/'\+\(d\.error\|\|/);
  });
});


describe("CLI verdict", () => {
  it("only a verified receipt prints 'Receipt verified' and exits 0", () => {
    expect(cliVerdict({ verified: true })).toEqual({ headline: "Receipt verified", exitCode: 0 });
  });

  it("a decoded-only BOA QR is not verified and exits non-zero", () => {
    const v = cliVerdict({ verified: false, decodedOnly: true });
    expect(v.exitCode).not.toBe(0);
    expect(v.headline).toMatch(/NOT VERIFIED/);
    expect(cliVerdict({ verified: true, decodedOnly: true }).exitCode).not.toBe(0);
  });

  it("an unverified result exits non-zero", () => {
    expect(cliVerdict({ verified: false }).exitCode).not.toBe(0);
  });
});
