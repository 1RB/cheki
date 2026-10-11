// @vitest-environment jsdom
/**
 * VerifyPanel end to end in jsdom: detection, Enter submits, verdict states,
 * Telebirr makes no request, history keeps verified results without names.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/context";
import { VerifyPanel } from "@/components/verify/VerifyPanel";
import { HISTORY_KEY } from "@/lib/verify/history";

vi.mock("next/link", () => ({ default: ({ href, children, prefetch: _p, ...rest }: { href: string; children: React.ReactNode; prefetch?: boolean }) => <a href={href} {...rest}>{children}</a> }));
// Lazy panels (camera, batch, browser fallback) are not under test here.
vi.mock("next/dynamic", () => ({ default: () => () => null }));

const CBE = "https://mbreciept.cbe.com.et/fHCxyV4mg5pRIwEkJO";
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function setup(props: { lockedBank?: string } = {}) {
  render(<I18nProvider><VerifyPanel {...props} /></I18nProvider>);
  return screen.getByLabelText("Receipt link, reference or QR") as HTMLInputElement;
}

async function submit(input: HTMLInputElement, value: string) {
  fireEvent.change(input, { target: { value } });
  await act(async () => { fireEvent.submit(input.closest("form")!); });
}

describe("VerifyPanel", () => {
  it("detects the bank live in one status row", async () => {
    const input = setup();
    fireEvent.change(input, { target: { value: CBE } });
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/CBE receipt link/));
    expect(screen.getByLabelText("Bank")).toBeTruthy(); // native <select> override
  });

  it("Enter submits and a confirmed result is green; it is saved without names", async () => {
    fetchMock.mockResolvedValue(json({ success: true, verified: true, bankCode: "cbe", reference: "FT1", amount: 12500, senderName: "Abebe Kebede", receiverName: "Selam" }));
    const input = setup();
    await submit(input, CBE);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Verified with CBE" })).toBeTruthy());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ bank: "cbe", reference: CBE });
    const saved = localStorage.getItem(HISTORY_KEY)!;
    expect(saved).toContain(CBE);
    expect(saved).not.toMatch(/Abebe|Selam/);
  });

  it("a second check of the same receipt warns 'Checked before on this device'", async () => {
    fetchMock.mockImplementation(async () => json({ success: true, verified: true, bankCode: "cbe", amount: 5, senderName: "A" }));
    const input = setup();
    await submit(input, CBE);
    await waitFor(() => screen.getByRole("heading", { name: "Verified with CBE" }));
    await submit(input, CBE + " ");
    await waitFor(() => expect(screen.getByText("Checked before on this device")).toBeTruthy());
  });

  it("not found is red; nothing is saved", async () => {
    fetchMock.mockResolvedValue(json({ success: false, error: "[CBE] Receipt not found or invalid." }, 422));
    const input = setup();
    await submit(input, CBE);
    await waitFor(() => expect(screen.getByRole("heading", { name: "No matching receipt" })).toBeTruthy());
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
  });

  it("429 shows a neutral countdown", async () => {
    fetchMock.mockResolvedValue(json({ success: false }, 429, { "retry-after": "20" }));
    const input = setup();
    await submit(input, CBE);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Couldn't check yet" })).toBeTruthy());
    expect(screen.getByRole("button", { name: /Try again in 20s/ })).toBeTruthy();
  });

  it("413 and offline are neutral", async () => {
    fetchMock.mockResolvedValueOnce(new Response("too big", { status: 413 }));
    const input = setup();
    await submit(input, CBE);
    await waitFor(() => screen.getByRole("heading", { name: "Couldn't check that" }));
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await submit(input, CBE + "x");
    await waitFor(() => expect(screen.getByRole("heading", { name: "You're offline" })).toBeTruthy());
  });

  it("Telebirr leads with 'Open the receipt' and sends nothing until asked", async () => {
    const input = setup();
    await submit(input, "DET8FJGUJ4");
    expect(fetchMock).not.toHaveBeenCalled();
    const open = screen.getByRole("link", { name: /Open the Telebirr receipt/ });
    expect(open.getAttribute("href")).toBe("https://transactioninfo.ethiotelecom.et/receipt/DET8FJGUJ4");
    fetchMock.mockResolvedValue(json({ success: false, error: "[Telebirr] blocked", fallbackUrl: "https://transactioninfo.ethiotelecom.et/receipt/DET8FJGUJ4" }, 502));
    await act(async () => { screen.getByRole("button", { name: "Check from cheki's server anyway" }).click(); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("heading", { name: /didn't answer cheki's server/ })).toBeTruthy());
  });

  it("a legacy FT reference opens the account field and waits for it", async () => {
    const input = setup();
    await submit(input, "FT26140P01YB");
    expect(fetchMock).not.toHaveBeenCalled();
    const extra = screen.getByLabelText("Receiving account, last 8 digits") as HTMLInputElement;
    expect(document.activeElement).toBe(extra);
    fetchMock.mockResolvedValue(json({ success: true, verified: true, bankCode: "cbe", amount: 1, senderName: "A" }));
    fireEvent.change(extra, { target: { value: "60536171" } });
    await act(async () => { fireEvent.submit(input.closest("form")!); });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ bank: "cbe", reference: "FT26140P01YB", accountNumber: "60536171" });
  });

  it("recent checks: per-row remove and Clear", async () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([
      { bank: "cbe", ref: "FT1", checkedAt: "2026-10-01T10:00:00Z", amount: 10 },
      { bank: "cbe", ref: "FT2", checkedAt: "2026-10-01T11:00:00Z" },
    ]));
    setup();
    await waitFor(() => screen.getByText("Recent checks"));
    await act(async () => { screen.getByRole("button", { name: "Remove FT1" }).click(); });
    expect(screen.queryByRole("button", { name: "Remove FT1" })).toBeNull();
    await act(async () => { screen.getByRole("button", { name: "Clear" }).click(); });
    expect(screen.queryByText("Recent checks")).toBeNull();
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
  });

  it("Verify another clears the field and returns focus to it", async () => {
    fetchMock.mockResolvedValue(json({ success: true, verified: true, bankCode: "cbe", amount: 1, senderName: "A" }));
    const input = setup();
    await submit(input, CBE);
    await waitFor(() => screen.getByRole("heading", { name: "Verified with CBE" }));
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 0; });
    await act(async () => { screen.getByRole("button", { name: "Verify another" }).click(); });
    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);
  });

  it("a link pasted anywhere on the page is checked", async () => {
    fetchMock.mockResolvedValue(json({ success: true, verified: true, bankCode: "cbe", amount: 1, senderName: "A" }));
    setup();
    const ev = new Event("paste", { bubbles: true }) as Event & { clipboardData: unknown };
    ev.clipboardData = { items: [], getData: () => CBE };
    await act(async () => { document.body.dispatchEvent(ev); });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("locked to a bank: no chooser, and another bank's link points to the full checker", async () => {
    const input = setup({ lockedBank: "boa" });
    expect(screen.queryByLabelText("Bank")).toBeNull();
    await submit(input, CBE);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Check it on the full checker" }).getAttribute("href")).toBe("/#verify");
  });
});
