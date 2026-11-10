// @vitest-environment jsdom
/**
 * VerifyPanel with a Dashen Super App receipt QR (synthetic payload): an
 * uploaded screenshot, the camera or a paste fills the FT Ref, chooses Dashen
 * and checks it exactly like a typed reference. The raw token is never sent,
 * and it is only left in the field where the page has to report the mismatch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/context";
import { VerifyPanel } from "@/components/verify/VerifyPanel";
import { HISTORY_KEY } from "@/lib/verify/history";
import { SYNTHETIC_QR, SYNTHETIC_REF, dashenQr } from "../fixtures/dashen-qr";

vi.mock("next/link", () => ({ default: ({ href, children, prefetch: _p, ...rest }: { href: string; children: React.ReactNode; prefetch?: boolean }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));

const decoded = vi.hoisted(() => ({ value: null as string | null }));
vi.mock("@/lib/qr/decode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/qr/decode")>()),
  decodeQrFromImage: vi.fn(async () => decoded.value),
}));
// OCR must not run: every case here has a readable QR.
vi.mock("@/lib/ocr", () => ({ extractTextFromImage: vi.fn(async () => { throw new Error("OCR should not run"); }) }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  localStorage.clear();
  decoded.value = SYNTHETIC_QR;
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function setup(props: { lockedBank?: string } = {}) {
  const { container } = render(<I18nProvider><VerifyPanel {...props} /></I18nProvider>);
  const input = screen.getByLabelText("Receipt link, reference or QR") as HTMLInputElement;
  const file = container.querySelector('input[type="file"]') as HTMLInputElement;
  return { input, file };
}

async function upload(file: HTMLInputElement) {
  const img = new File([new Uint8Array([137, 80, 78, 71])], "receipt.png", { type: "image/png" });
  await act(async () => { fireEvent.change(file, { target: { files: [img] } }); });
}

/** Paste QR text into a field, or anywhere on the page when the target is the body. */
async function paste(target: Element, text: string) {
  const ev = new Event("paste", { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
  ev.clipboardData = { items: [], getData: () => text };
  await act(async () => { target.dispatchEvent(ev); });
}

describe("VerifyPanel: Dashen Super App receipt QR", () => {
  it("an uploaded screenshot fills the FT Ref, chooses Dashen and checks it; the token is never shown or sent", async () => {
    fetchMock.mockResolvedValue(json({ success: true, verified: true, bankCode: "dashen", reference: SYNTHETIC_REF, amount: 500 }));
    const { input, file } = setup();
    await upload(file);
    await waitFor(() => expect(input.value).toBe(SYNTHETIC_REF));
    expect(screen.getByLabelText("Bank").getAttribute("data-value")).toBe("dashen");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ bank: "dashen", reference: SYNTHETIC_REF });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Verified with Dashen" })).toBeTruthy());
    expect(screen.getByText(/not proof of payment/)).toBeTruthy();
    expect(document.body.textContent).not.toContain(SYNTHETIC_QR);
    const saved = localStorage.getItem(HISTORY_KEY)!;
    expect(saved).toContain(SYNTHETIC_REF);
    expect(saved).not.toContain(SYNTHETIC_QR);
  });

  it("QR text pasted anywhere on the page is read the same way", async () => {
    fetchMock.mockResolvedValue(json({ success: true, verified: true, bankCode: "dashen", reference: SYNTHETIC_REF, amount: 500 }));
    const { input } = setup();
    await paste(document.body, SYNTHETIC_QR);
    await waitFor(() => expect(input.value).toBe(SYNTHETIC_REF));
    expect(screen.getByLabelText("Bank").getAttribute("data-value")).toBe("dashen");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ bank: "dashen", reference: SYNTHETIC_REF });
    expect(document.body.textContent).not.toContain(SYNTHETIC_QR);
  });

  it("QR text pasted into the field is swapped for the FT Ref, not left there as a token", async () => {
    fetchMock.mockResolvedValue(json({ success: true, verified: true, bankCode: "dashen", reference: SYNTHETIC_REF, amount: 500 }));
    const { input } = setup();
    await paste(input, SYNTHETIC_QR);
    await waitFor(() => expect(input.value).toBe(SYNTHETIC_REF));
    expect(input.value).not.toContain("superappreceipt_");
    expect(document.body.textContent).not.toContain(SYNTHETIC_QR);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ bank: "dashen", reference: SYNTHETIC_REF });
  });

  it("on the Dashen page it fills the FT Ref too", async () => {
    fetchMock.mockResolvedValue(json({ success: true, verified: true, bankCode: "dashen", reference: SYNTHETIC_REF, amount: 500 }));
    const { input, file } = setup({ lockedBank: "dashen" });
    await upload(file);
    await waitFor(() => expect(input.value).toBe(SYNTHETIC_REF));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ bank: "dashen", reference: SYNTHETIC_REF });
    expect(document.body.textContent).not.toContain(SYNTHETIC_QR);
  });

  it("on another bank's page it is reported as a Dashen receipt and never sent to that bank", async () => {
    const { input, file } = setup({ lockedBank: "boa" });
    await upload(file);
    // The token is kept so detectInput can still name Dashen and report the
    // mismatch; it is never handed to the bank the page is locked to.
    await waitFor(() => expect(input.value).toBe(SYNTHETIC_QR));
    await waitFor(() => expect(screen.getByText(/This is a Dashen receipt/)).toBeTruthy());
    expect(screen.getByRole("link", { name: "Check it on the full checker" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a token for a different FT Ref is read from the QR, not guessed", async () => {
    fetchMock.mockResolvedValue(json({ success: false, error: "[Dashen] Transaction not found" }, 400));
    const other = dashenQr("A10LTWI00SAMPLE0");
    const { input, file } = setup();
    decoded.value = other;
    await upload(file);
    await waitFor(() => expect(input.value).toBe("A10LTWI00SAMPLE0"));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ bank: "dashen", reference: "A10LTWI00SAMPLE0" });
    expect(document.body.textContent).not.toContain(other);
  });

  it("text that only looks like a Dashen token is left alone", async () => {
    const { input } = setup();
    await paste(document.body, "superappreceipt_not-hex-at-all.zzz");
    expect(input.value).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
