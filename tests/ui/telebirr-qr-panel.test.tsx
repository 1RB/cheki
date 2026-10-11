// @vitest-environment jsdom
/**
 * VerifyPanel with a Telebirr receipt QR (synthetic payload): an uploaded
 * screenshot, the camera or a paste fills the transaction number, chooses
 * Telebirr and leads with the normal browser-first Telebirr flow. Nothing is
 * sent until asked, and nothing from the QR but the number is shown or saved.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/context";
import { VerifyPanel } from "@/components/verify/VerifyPanel";
import { HISTORY_KEY } from "@/lib/verify/history";
import { SYNTHETIC_QR, SYNTHETIC_REF, telebirrQr } from "../fixtures/telebirr-qr";

vi.mock("next/link", () => ({ default: ({ href, children, prefetch: _p, ...rest }: { href: string; children: React.ReactNode; prefetch?: boolean }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));

const decoded = vi.hoisted(() => ({ value: null as string | null }));
vi.mock("@/lib/qr/decode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/qr/decode")>()),
  decodeQrFromImage: vi.fn(async () => decoded.value),
}));
// OCR must not run: every case here has a readable QR.
vi.mock("@/lib/ocr", () => ({ extractTextFromImage: vi.fn(async () => { throw new Error("OCR should not run"); }) }));

const RECEIPT = `https://transactioninfo.ethiotelecom.et/receipt/${SYNTHETIC_REF}`;
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

describe("VerifyPanel: Telebirr receipt QR", () => {
  it("an uploaded screenshot fills the transaction number and opens the Telebirr flow; nothing is sent", async () => {
    const { input, file } = setup();
    await upload(file);
    await waitFor(() => expect(input.value).toBe(SYNTHETIC_REF));
    expect((screen.getByLabelText("Bank") as HTMLSelectElement).value).toBe("telebirr");
    const open = await screen.findByRole("link", { name: /Open the Telebirr receipt/ });
    expect(open.getAttribute("href")).toBe(RECEIPT);
    expect(screen.getByText(/not proof of payment/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain(SYNTHETIC_QR);
  });

  it("asking the server sends only the transaction number, and a failure is never green", async () => {
    const { input, file } = setup();
    await upload(file);
    await waitFor(() => expect(input.value).toBe(SYNTHETIC_REF));
    fetchMock.mockResolvedValue(json({ success: false, error: "[Telebirr] blocked", fallbackUrl: RECEIPT }, 502));
    await act(async () => { screen.getByRole("button", { name: "Check from cheki's server anyway" }).click(); });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ bank: "telebirr", reference: SYNTHETIC_REF });
    await waitFor(() => expect(screen.getByRole("heading", { name: /didn't answer cheki's server/ })).toBeTruthy());
    expect(screen.queryByRole("heading", { name: /Verified with/ })).toBeNull();
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
  });

  it("QR text pasted anywhere on the page is read the same way", async () => {
    const { input } = setup();
    const ev = new Event("paste", { bubbles: true }) as Event & { clipboardData: unknown };
    ev.clipboardData = { items: [], getData: () => SYNTHETIC_QR };
    await act(async () => { document.body.dispatchEvent(ev); });
    await waitFor(() => expect(input.value).toBe(SYNTHETIC_REF));
    expect(screen.getByRole("link", { name: /Open the Telebirr receipt/ }).getAttribute("href")).toBe(RECEIPT);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("on the Telebirr page it fills the number too", async () => {
    const { input, file } = setup({ lockedBank: "telebirr" });
    await upload(file);
    await waitFor(() => expect(input.value).toBe(SYNTHETIC_REF));
    expect(screen.getByRole("link", { name: /Open the Telebirr receipt/ }).getAttribute("href")).toBe(RECEIPT);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("on another bank's page it is reported as a Telebirr receipt and never sent to that bank", async () => {
    const { file } = setup({ lockedBank: "boa" });
    await upload(file);
    await waitFor(() => expect(screen.getByText(/This is a Telebirr receipt/)).toBeTruthy());
    expect(screen.getByRole("link", { name: "Check it on the full checker" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a QR with a bad CRC is not read as Telebirr", async () => {
    decoded.value = telebirrQr(SYNTHETIC_REF, { crc: "0000" });
    const { input, file } = setup();
    await upload(file);
    await waitFor(() => expect(input.value).not.toBe(""));
    expect(input.value).not.toBe(SYNTHETIC_REF);
    expect(screen.queryByRole("link", { name: /Open the Telebirr receipt/ })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
