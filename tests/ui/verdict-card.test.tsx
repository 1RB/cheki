// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { VerdictCard } from "@/components/verify/VerdictCard";
import { presentVerdict } from "@/lib/verify/verdict";
import { tEn } from "@/lib/i18n/translate";
import type { VerifyResult } from "@/lib/banks";

vi.mock("next/link", () => ({ default: ({ href, children, prefetch: _p, ...rest }: { href: string; children: React.ReactNode; prefetch?: boolean }) => <a href={href} {...rest}>{children}</a> }));

afterEach(() => { cleanup(); vi.useRealTimers(); });

const at = new Date(2026, 9, 11, 14, 32);
const card = (r: VerifyResult, opts: Parameters<typeof presentVerdict>[1] = {}) =>
  render(<VerdictCard verdict={presentVerdict(r, { checkedAt: at, ...opts })} result={r} checkedAt={at} t={tEn} onAnother={() => {}} onRetry={() => {}} />);

describe("VerdictCard", () => {
  it("green: title, record line, big amount, parties, reference, actions", () => {
    const { container } = card({ success: true, verified: true, bankCode: "cbe", reference: "FT1", amount: 12500, currency: "ETB", senderName: "Abebe", receiverName: "Selam", sourceUrl: "https://mbreciept.cbe.com.et/x" });
    expect(container.querySelector(".vc")?.getAttribute("data-tone")).toBe("green");
    expect(screen.getByRole("heading", { name: "Verified with CBE" })).toBeTruthy();
    // The record line is live: "Checked …" comes from the shared minute clock.
    expect(container.querySelector(".vc-sub")?.textContent).toMatch(/^Confirmed with CBE's own receipt record\. Checked /);
    expect(container.querySelector(".vc-sub time")?.getAttribute("datetime")).toBe(at.toISOString());
    expect(screen.getByText("12,500")).toBeTruthy();
    expect(screen.getByText("Abebe")).toBeTruthy();
    expect(screen.getByText("Selam")).toBeTruthy();
    expect(screen.getByText("FT1")).toBeTruthy();
    for (const name of ["Copy result", "Print slip", "Verify another"]) expect(screen.getByRole("button", { name: new RegExp(name) })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Official receipt/ }).getAttribute("href")).toBe("https://mbreciept.cbe.com.et/x");
  });

  it("decoded-only: no amount and no names anywhere in the DOM, JSON panel included", () => {
    const { container } = card({ success: true, verified: false, decodedOnly: true, bankCode: "boa", reference: "FT252003JZPP", amount: 50000, senderName: "Forged Name", receiverName: "Merchant" });
    const html = container.innerHTML;
    expect(container.querySelector(".vc")?.getAttribute("data-tone")).toBe("amber");
    expect(screen.getByText("Decoded from QR, not confirmed with the bank")).toBeTruthy();
    expect(html).toContain("FT252003JZPP");
    expect(html).not.toMatch(/50,?000|Forged Name|Merchant/);
  });

  it("red not-found: one next step and the fraud guide", () => {
    card({ success: false, httpStatus: 422, error: "[CBE] Receipt not found or invalid." }, { bankCode: "cbe" });
    expect(screen.getByRole("heading", { name: "No matching receipt" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "How receipt fraud works" }).getAttribute("href")).toBe("/guides/payment-fraud-ethiopia");
  });

  it("429: neutral with a countdown that re-enables Try again", () => {
    vi.useFakeTimers();
    const { container } = card({ success: false, httpStatus: 429, retryAfter: 2 });
    expect(container.querySelector(".vc")?.getAttribute("data-tone")).toBe("neutral");
    const btn = screen.getByRole("button", { name: /Try again in 2s/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => { vi.advanceTimersByTime(1000); });
    expect((screen.getByRole("button", { name: /^Try again$/ }) as HTMLButtonElement).disabled).toBe(false);
    // A "couldn't check" card offers no copy/print of a judgement.
    expect(screen.queryByRole("button", { name: /Copy result/ })).toBeNull();
  });

  it("offline and 413 never read as a judgement", () => {
    card({ success: false, httpStatus: 0 });
    expect(screen.getByRole("heading", { name: "You're offline" })).toBeTruthy();
    cleanup();
    card({ success: false, httpStatus: 413 });
    expect(screen.getByRole("heading", { name: "Couldn't check that" })).toBeTruthy();
  });

  it("copy result writes text without 'verified by cheki'", async () => {
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });
    card({ success: true, verified: true, bankCode: "cbe", reference: "FT1", amount: 5 });
    await act(async () => { screen.getByRole("button", { name: /Copy result/ }).click(); });
    expect(writeText).toHaveBeenCalledTimes(1);
    const text = (writeText.mock.calls[0] as unknown as [string])[0];
    expect(text).not.toMatch(/verified by cheki/i);
    expect(text).toMatch(/Confirmed with CBE's own receipt record/);
  });
  it("a receipt with no receiver gets no To row, and shows its fee rows", () => {
    // Synthetic BOA fee receipt (tests/fixtures/boa/no-receiver.ts): payer only.
    const { container } = card({
      success: true, verified: true, bankCode: "boa", reference: "FT26999ABCD1", amount: 100, currency: "ETB",
      senderName: "TEST PAYER ONE", senderAccount: "1******45", serviceFee: 5, totalPaid: 120, reason: "Test fee note",
      sourceUrl: "https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=FT26999ABCD112345",
    });
    const labels = Array.from(container.querySelectorAll(".vc-rows dt")).map((n) => n.textContent);
    expect(labels).toContain(tEn("verify.card.from"));
    expect(labels).not.toContain(tEn("verify.card.to"));
    expect(Array.from(container.querySelectorAll(".vc-rows dd")).map((n) => n.textContent)).not.toContain("-");
    const extra = Array.from(container.querySelectorAll(".vc-xrows dt")).map((n) => n.textContent);
    expect(extra).toEqual(expect.arrayContaining(["Reason", "Service fee", "Total paid"]));
  });
});
