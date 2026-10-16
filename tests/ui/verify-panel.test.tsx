// @vitest-environment jsdom
/**
 * VerifyPanel end to end in jsdom: detection, Enter submits, verdict states,
 * Telebirr makes no request, history keeps verified results without names.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/context";
import { VerifyPanel, verdictNeedsScroll } from "@/components/verify/VerifyPanel";
import { HISTORY_KEY } from "@/lib/verify/history";

vi.mock("next/link", () => ({ default: ({ href, children, prefetch: _p, ...rest }: { href: string; children: React.ReactNode; prefetch?: boolean }) => <a href={href} {...rest}>{children}</a> }));
// Lazy panels (camera, batch, browser fallback) are not under test here.
vi.mock("next/dynamic", () => ({ default: () => () => null }));

const CBE = "https://mbreciept.cbe.com.et/fHCxExampleRcpt01";
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
    expect(screen.getByRole("button", { name: "Bank Auto · CBE" }).getAttribute("aria-haspopup")).toBe("listbox");
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
    await submit(input, "DET0SAMPLE");
    expect(fetchMock).not.toHaveBeenCalled();
    const open = screen.getByRole("link", { name: /Open the Telebirr receipt/ });
    expect(open.getAttribute("href")).toBe("https://transactioninfo.ethiotelecom.et/receipt/DET0SAMPLE");
    fetchMock.mockResolvedValue(json({ success: false, error: "[Telebirr] blocked", fallbackUrl: "https://transactioninfo.ethiotelecom.et/receipt/DET0SAMPLE" }, 502));
    await act(async () => { screen.getByRole("button", { name: "Check from cheki's server anyway" }).click(); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("heading", { name: /didn't answer cheki's server/ })).toBeTruthy());
  });

  it("a legacy FT reference opens the account field and waits for it", async () => {
    const input = setup();
    await submit(input, "FT26SAMPLE01");
    expect(fetchMock).not.toHaveBeenCalled();
    const extra = screen.getByLabelText("Receiving account, last 8 digits") as HTMLInputElement;
    expect(document.activeElement).toBe(extra);
    fetchMock.mockResolvedValue(json({ success: true, verified: true, bankCode: "cbe", amount: 1, senderName: "A" }));
    fireEvent.change(extra, { target: { value: "00006171" } });
    await act(async () => { fireEvent.submit(input.closest("form")!); });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ bank: "cbe", reference: "FT26SAMPLE01", accountNumber: "00006171" });
  });

  it("a BOA slip link with the 5-digit suffix is sent as is, with no account field", async () => {
    // Synthetic reference and suffix (tests/fixtures/boa/no-receiver.ts).
    const link = "https://cs.bankofabyssinia.com/slip/?trx=FT26999ABCD112345";
    fetchMock.mockResolvedValue(json({ success: true, verified: true, bankCode: "boa", reference: "FT26999ABCD1", amount: 100, senderName: "TEST PAYER ONE" }));
    const input = setup();
    await submit(input, link);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ bank: "boa", reference: link });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Verified with BOA" })).toBeTruthy());
  });

  it("a BOA slip link without the suffix asks for the account on the receipt", async () => {
    const link = "https://cs.bankofabyssinia.com/slip/?trx=FT26999ABCD1";
    const input = setup();
    await submit(input, link);
    expect(fetchMock).not.toHaveBeenCalled();
    const extra = screen.getByLabelText("Account on the receipt, last 5 digits") as HTMLInputElement;
    expect(screen.getByText(/Enter at least the last 5 digits of the account on the receipt/)).toBeTruthy();
    fetchMock.mockResolvedValue(json({ success: true, verified: true, bankCode: "boa", amount: 100, senderName: "A" }));
    fireEvent.change(extra, { target: { value: "12345" } });
    await act(async () => { fireEvent.submit(input.closest("form")!); });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ bank: "boa", reference: link, accountNumber: "12345" });
  });

  it("choosing a bank in the chooser overrides detection and is what gets sent", async () => {
    const input = setup();
    fireEvent.change(input, { target: { value: "SE12345678" } });
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/Pick the bank/));
    const chooser = screen.getByRole("button", { name: "Bank Auto-detect" }); // ambiguous: no "Auto · X" hint
    act(() => chooser.click());
    fireEvent.change(screen.getByRole("combobox", { name: "Find a bank" }), { target: { value: "dash" } });
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    expect(document.activeElement).toBe(chooser);
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/Dashen \(chosen\)/));
    expect(chooser.textContent).toContain("Dashen");
    fetchMock.mockResolvedValue(json({ success: true, verified: true, bankCode: "dashen", amount: 1, senderName: "A" }));
    await act(async () => { fireEvent.submit(input.closest("form")!); });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ bank: "dashen", reference: "SE12345678" });
  });

  it("a receipt link names its own bank: the chooser cannot re-route it", async () => {
    const input = setup();
    fireEvent.change(input, { target: { value: CBE } });
    const chooser = await waitFor(() => screen.getByRole("button", { name: "Bank Auto · CBE" }));
    act(() => chooser.click());
    act(() => screen.getByRole("option", { name: "Dashen" }).click());
    fetchMock.mockResolvedValue(json({ success: true, verified: true, bankCode: "cbe", amount: 1, senderName: "A" }));
    await act(async () => { fireEvent.submit(input.closest("form")!); });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ bank: "cbe", reference: CBE });
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
  it("a verdict below the fold scrolls into view (instant under reduced motion) and its heading takes focus", async () => {
    fetchMock.mockResolvedValue(json({ success: true, verified: true, bankCode: "cbe", amount: 1, senderName: "A" }));
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const rect = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: 900, height: 500, bottom: 1400, left: 0, right: 390, width: 390, x: 0, y: 900, toJSON: () => ({}) } as DOMRect);
    Object.defineProperty(window, "innerHeight", { value: 844, configurable: true });
    const input = setup();
    await submit(input, CBE);
    const heading = await waitFor(() => screen.getByRole("heading", { name: "Verified with CBE" }));
    await waitFor(() => expect(scroll).toHaveBeenCalledWith({ behavior: "auto", block: "start" }));
    expect(document.activeElement).toBe(heading);
    rect.mockRestore();
  });

  it("a verdict already on screen is not scrolled", () => {
    expect(verdictNeedsScroll({ top: 200, height: 900 }, 844, 56)).toBe(false);
    expect(verdictNeedsScroll({ top: 300, height: 400 }, 844, 56)).toBe(false);
    expect(verdictNeedsScroll({ top: 405, height: 700 }, 900, 56)).toBe(false); // desktop, beside the hero
    expect(verdictNeedsScroll({ top: 530, height: 900 }, 844, 56)).toBe(true); // mobile, under the input
    expect(verdictNeedsScroll({ top: 400, height: 900 }, 560, 56)).toBe(true); // short landscape viewport
    expect(verdictNeedsScroll({ top: 20, height: 500 }, 844, 56)).toBe(true);
  });
});
