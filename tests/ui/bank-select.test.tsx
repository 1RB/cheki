// @vitest-environment jsdom
/**
 * BankSelect: the bank chooser under the verify input. Options (parity with
 * the native select it replaced), ARIA wiring, keyboard, filter, typeahead,
 * outside press, the mobile sheet and Amharic.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { BankSelect, bankOptions, filterOptions, typeaheadIndex, FILTER_MIN } from "@/components/ui/BankSelect";
import { liveBanks } from "@/lib/verify/detect";
import { tEn, translate } from "@/lib/i18n/translate";

let media: { sheet: boolean; coarse: boolean };
beforeEach(() => {
  media = { sheet: false, coarse: false };
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    // Reduced motion on: the popup unmounts as soon as it closes.
    matches: q.includes("reduced-motion") || (q.includes("max-width") && media.sheet) || (q.includes("coarse") && media.coarse),
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => cleanup());

function Harness({ initial = "", detected, t = tEn, onChange }: { initial?: string; detected?: { code: string; shortName: string }; t?: typeof tEn; onChange?: (c: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <input aria-label="Elsewhere" />
      <BankSelect id="b" value={value} onChange={(c) => { setValue(c); onChange?.(c); }} banks={liveBanks} detected={detected} t={t} />
    </>
  );
}

const trigger = () => document.getElementById("b") as HTMLButtonElement;
const listbox = () => screen.queryByRole("listbox");
const filter = () => screen.getByRole("combobox") as HTMLInputElement;
const activeLabel = () => {
  const id = (document.activeElement as HTMLElement).getAttribute("aria-activedescendant");
  return id ? document.getElementById(id)?.querySelector(".bs-opt-label")?.textContent : null;
};
const key = (k: string, el: Element = document.activeElement!) => fireEvent.keyDown(el, { key: k });

describe("bankOptions", () => {
  it("offers Auto-detect and every live bank, nothing else (parity with the native select)", () => {
    const opts = bankOptions(liveBanks, "Auto-detect");
    expect(opts[0]).toEqual({ code: "", label: "Auto-detect" });
    expect(opts.slice(1).map((o) => o.code).sort()).toEqual(liveBanks.map((b) => b.code).sort());
    expect(opts.map((o) => o.code)).not.toContain("zemen"); // in development
    expect(opts.length).toBeGreaterThan(FILTER_MIN);
  });

  it("puts confirmed banks first and the beta ones last", () => {
    const opts = bankOptions(liveBanks, "Auto-detect").slice(1);
    const firstBeta = opts.findIndex((o) => o.beta);
    expect(firstBeta).toBeGreaterThan(0);
    expect(opts.slice(firstBeta).every((o) => o.beta)).toBe(true);
    expect(opts.filter((o) => o.beta).map((o) => o.code)).toEqual(expect.arrayContaining(["mpesa", "zamzam"]));
  });

  it("filters on short and full names; typeahead cycles a repeated letter", () => {
    const opts = bankOptions(liveBanks, "Auto-detect");
    expect(filterOptions(opts, "abyss").map((o) => o.code)).toEqual(["boa"]);
    expect(filterOptions(opts, "  ").length).toBe(opts.length);
    expect(filterOptions(opts, "t")[0].code).toBe("telebirr"); // prefix before "Auto-detect"
    expect(filterOptions(opts, "pesa")[0].code).toBe("mpesa"); // word start
    const d1 = typeaheadIndex(opts, "d", 0);
    expect(opts[d1].code).toBe("dashen");
    const t1 = typeaheadIndex(opts, "t", 0);
    expect(opts[t1].code).toBe("telebirr");
    expect(typeaheadIndex(opts, "zz", 0)).toBe(opts.findIndex((o) => o.code === "zamzam"));
    expect(typeaheadIndex(opts, "q", 0)).toBe(-1);
  });
});

describe("BankSelect", () => {
  it("is a labelled listbox button; the closed face shows the auto-detected bank", () => {
    const { rerender } = render(<Harness />);
    expect(trigger().getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: "Bank Auto-detect" })).toBe(trigger());
    expect(screen.getByLabelText("Bank")).toBe(trigger());
    rerender(<Harness detected={{ code: "cbe", shortName: "CBE" }} />);
    expect(screen.getByRole("button", { name: "Bank Auto · CBE" })).toBe(trigger());
  });

  it("opens on click with the filter focused and the chosen option active", () => {
    render(<Harness initial="boa" />);
    act(() => trigger().click());
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(trigger().getAttribute("aria-controls")).toBe(listbox()!.id);
    expect(document.activeElement).toBe(filter());
    expect(filter().getAttribute("aria-controls")).toBe(listbox()!.id);
    expect(activeLabel()).toBe("BOA");
    const boa = screen.getByRole("option", { name: /BOA/ });
    expect(boa.getAttribute("aria-selected")).toBe("true");
    expect(screen.getAllByRole("option").filter((o) => o.getAttribute("aria-selected") === "true")).toHaveLength(1);
  });

  it("arrows, Home and End move the active option; Enter chooses and returns focus", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    act(() => trigger().focus());
    key("ArrowDown"); // opens on Auto-detect
    expect(listbox()).not.toBeNull();
    expect(activeLabel()).toBe("Auto-detect");
    key("ArrowDown");
    expect(activeLabel()).toBe("CBE");
    key("ArrowUp");
    key("ArrowUp"); // clamps at the top
    expect(activeLabel()).toBe("Auto-detect");
    key("End");
    const last = bankOptions(liveBanks, "Auto-detect").at(-1)!.label;
    expect(activeLabel()).toBe(last);
    key("Home");
    key("ArrowDown");
    key("ArrowDown");
    key("Enter");
    expect(onChange).toHaveBeenCalledWith("telebirr");
    expect(listbox()).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect(trigger().textContent).toContain("Telebirr");
    expect(trigger().getAttribute("data-value")).toBe("telebirr");
  });

  it("Space chooses when nothing is typed; Escape closes without a change", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    act(() => trigger().click());
    key("ArrowDown");
    key("Escape");
    expect(listbox()).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger());
    key("Enter", trigger());
    key("ArrowDown");
    key(" ");
    expect(onChange).toHaveBeenCalledWith("cbe");
  });

  it("Tab closes and leaves focus on the trigger for the browser to move on", () => {
    render(<Harness />);
    act(() => trigger().click());
    key("Tab");
    expect(listbox()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("type to filter: matches short and full names, says when nothing matches", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    act(() => trigger().click());
    fireEvent.change(filter(), { target: { value: "abyss" } });
    expect(screen.getAllByRole("option").map((o) => o.querySelector(".bs-opt-label")?.textContent)).toEqual(["BOA"]);
    fireEvent.change(filter(), { target: { value: "xyz" } });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No bank matches “xyz”")).toBeTruthy();
    expect(filter().getAttribute("aria-activedescendant")).toBeNull();
    key("Enter"); // nothing to choose
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(filter(), { target: { value: "dash" } });
    key(" "); // a space inside a typed filter is text, not a choice
    expect(onChange).not.toHaveBeenCalled();
    key("Enter");
    expect(onChange).toHaveBeenCalledWith("dashen");
  });

  it("a letter on the closed trigger opens the list filtered by it", () => {
    render(<Harness />);
    act(() => trigger().focus());
    key("t", trigger());
    expect(filter().value).toBe("t");
    expect(activeLabel()).toBe("Telebirr");
  });

  it("on a touch screen the list takes focus (no keyboard pops up) and letters jump", () => {
    media.coarse = true;
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    act(() => trigger().click());
    expect(document.activeElement).toBe(listbox());
    expect(listbox()!.getAttribute("aria-activedescendant")).toBeTruthy();
    key("d");
    expect(activeLabel()).toBe("Dashen");
    key("Enter");
    expect(onChange).toHaveBeenCalledWith("dashen");
  });

  it("an outside press closes; focus returns to the trigger unless the press took focus", () => {
    render(<Harness />);
    act(() => trigger().click());
    fireEvent.pointerDown(document.body);
    expect(listbox()).toBeNull();
    expect(document.activeElement).toBe(trigger());
    act(() => trigger().click());
    fireEvent.pointerDown(screen.getByLabelText("Elsewhere"));
    expect(listbox()).toBeNull();
    expect(document.activeElement).not.toBe(trigger());
  });

  it("clicking an option chooses it; pressing inside the list does not close it", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    act(() => trigger().click());
    const opt = screen.getByRole("option", { name: /Awash/ });
    fireEvent.pointerDown(opt);
    expect(listbox()).not.toBeNull();
    fireEvent.pointerMove(opt);
    expect(activeLabel()).toBe("Awash");
    act(() => opt.click());
    expect(onChange).toHaveBeenCalledWith("awash");
    expect(document.activeElement).toBe(trigger());
  });

  it("marks beta banks with a plain word and shows what auto-detect found", () => {
    render(<Harness detected={{ code: "cbe", shortName: "CBE" }} />);
    act(() => trigger().click());
    expect(screen.getByRole("option", { name: /M-Pesa/ }).textContent).toContain("Beta");
    expect(screen.getByRole("option", { name: "CBE" }).textContent).not.toContain("Beta");
    expect(screen.getByRole("option", { name: /Auto-detect/ }).textContent).toContain("Detected: CBE");
  });

  it("under 560px it opens as a bottom sheet in <body> with a Close button", () => {
    media.sheet = true;
    const { container } = render(<Harness />);
    act(() => trigger().click());
    expect(container.contains(listbox())).toBe(false);
    expect(listbox()!.closest(".bs-sheet")).not.toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByRole("dialog", { name: "Bank" }).contains(listbox())).toBe(true);
    const closeBtn = screen.getByRole("button", { name: "Close" });
    key("Enter", closeBtn); // the button's own key, not "choose the active row"
    expect(listbox()).not.toBeNull();
    act(() => closeBtn.click());
    expect(listbox()).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(trigger());
    act(() => trigger().click());
    act(() => (document.querySelector(".bs-scrim") as HTMLElement).click());
    expect(listbox()).toBeNull();
  });

  it("speaks Amharic", () => {
    const am: typeof tEn = (p, v) => translate("am", p, v);
    render(<Harness t={am} detected={{ code: "cbe", shortName: "CBE" }} />);
    expect(screen.getByRole("button", { name: "ባንክ ራስ-ሰር · CBE" })).toBe(trigger());
    act(() => trigger().click());
    expect(filter().getAttribute("aria-label")).toBe("ባንክ ይፈልጉ");
    expect(screen.getByRole("option", { name: /ራስ-ሰር መለየት/ })).toBeTruthy();
  });
});
