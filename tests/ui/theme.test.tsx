// @vitest-environment jsdom
/**
 * Theme preference (Light / Dark / System) and the shared ThemeControl.
 *
 *  - The inline pre-hydration script and the store agree on every stored value.
 *  - A choice persists, System follows the OS live, other tabs stay in sync.
 *  - The control is a radiogroup with aria-checked radios, roving tabindex and
 *    arrow keys; two instances (header and menu) never disagree.
 *  - In the mobile menu the whole Theme row is tappable.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/context";
import { ThemeControl, nextPref } from "@/components/theme-control";
import {
  THEME_INIT_SCRIPT, THEME_STORAGE_KEY, __resetThemeStore, getPref, parsePref, resolveTheme, setPref, subscribe,
} from "@/lib/theme";

vi.mock("next/link", () => ({ default: ({ href, children, prefetch: _p, ...rest }: { href: string; children: React.ReactNode; prefetch?: boolean }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

let osDark = false;
let mqListeners: Array<() => void> = [];
function mockMatchMedia() {
  window.matchMedia = vi.fn((q: string) => ({
    matches: q.includes("prefers-color-scheme: dark") ? osDark : false,
    media: q,
    addEventListener: (_: string, l: () => void) => mqListeners.push(l),
    removeEventListener: (_: string, l: () => void) => { mqListeners = mqListeners.filter((x) => x !== l); },
  })) as unknown as typeof window.matchMedia;
}
const html = () => document.documentElement;
const runInit = () => new Function(THEME_INIT_SCRIPT)();

beforeEach(() => {
  localStorage.clear();
  osDark = false;
  mqListeners = [];
  mockMatchMedia();
  html().removeAttribute("data-theme");
  html().removeAttribute("data-theme-pref");
  __resetThemeStore();
});
afterEach(() => cleanup());

describe("theme preference", () => {
  it("anything but light/dark is System", () => {
    expect(parsePref("light")).toBe("light");
    expect(parsePref("dark")).toBe("dark");
    for (const v of [null, undefined, "", "system", "auto", "DARK"]) expect(parsePref(v)).toBe("system");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("the inline pre-hydration script matches the store for every stored value and OS", () => {
    for (const stored of [null, "light", "dark", "system", "junk"]) {
      for (const dark of [false, true]) {
        localStorage.clear();
        if (stored !== null) localStorage.setItem(THEME_STORAGE_KEY, stored);
        osDark = dark;
        runInit();
        const pref = parsePref(stored);
        expect(html().getAttribute("data-theme-pref"), `${stored}/${dark}`).toBe(pref);
        expect(html().getAttribute("data-theme"), `${stored}/${dark}`).toBe(resolveTheme(pref, dark));
      }
    }
  });

  it("the inline script survives a throwing localStorage", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
    osDark = true;
    runInit();
    expect(html().getAttribute("data-theme")).toBe("dark");
    expect(html().getAttribute("data-theme-pref")).toBe("system");
    spy.mockRestore();
  });

  it("a choice persists (System included) and applies at once", () => {
    setPref("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(html().getAttribute("data-theme")).toBe("dark");
    setPref("system");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
    expect(html().getAttribute("data-theme")).toBe("light");
    expect(html().getAttribute("data-theme-pref")).toBe("system");
    __resetThemeStore();
    expect(getPref()).toBe("system");
  });

  it("System follows the OS while subscribed; an explicit choice does not", () => {
    const seen = vi.fn();
    const off = subscribe(seen);
    setPref("system");
    osDark = true;
    mqListeners.forEach((l) => l());
    expect(html().getAttribute("data-theme")).toBe("dark");
    setPref("light");
    osDark = false;
    mqListeners.forEach((l) => l());
    osDark = true;
    mqListeners.forEach((l) => l());
    expect(html().getAttribute("data-theme")).toBe("light");
    off();
    expect(mqListeners).toHaveLength(0);
  });

  it("a change in another tab is picked up", () => {
    const seen = vi.fn();
    const off = subscribe(seen);
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY }));
    expect(getPref()).toBe("dark");
    expect(html().getAttribute("data-theme")).toBe("dark");
    expect(seen).toHaveBeenCalled();
    off();
  });

  it("cycles Light -> Dark -> System -> Light", () => {
    expect(nextPref("light")).toBe("dark");
    expect(nextPref("dark")).toBe("system");
    expect(nextPref("system")).toBe("light");
  });
});

describe("ThemeControl", () => {
  const setup = () =>
    render(
      <I18nProvider>
        <ThemeControl variant="compact" />
        <ThemeControl />
      </I18nProvider>,
    );

  it("is a labelled radiogroup with one checked radio per instance", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    setup();
    const groups = screen.getAllByRole("radiogroup", { name: "Theme" });
    expect(groups).toHaveLength(2);
    for (const g of groups) {
      const radios = g.querySelectorAll('[role="radio"]');
      expect(radios).toHaveLength(3);
      expect(g.querySelector('[aria-checked="true"]')?.getAttribute("data-v")).toBe("dark");
      // roving tabindex: only the checked option is in the tab order
      expect(Array.from(radios).map((r) => r.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"]);
    }
    // compact options are named by aria-label; full ones by their visible label
    expect(screen.getAllByRole("radio", { name: "System" })).toHaveLength(2);
  });

  it("a tap in one instance updates both, persists, and is not undone by a second render", () => {
    setup();
    const [compact, full] = screen.getAllByRole("radiogroup");
    fireEvent.click(full.querySelector('[data-v="dark"]')!);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(html().getAttribute("data-theme")).toBe("dark");
    expect(compact.querySelector('[aria-checked="true"]')?.getAttribute("data-v")).toBe("dark");
    // tapping the selected option again is a no-op, not a toggle back
    fireEvent.click(full.querySelector('[data-v="dark"]')!);
    expect(html().getAttribute("data-theme")).toBe("dark");
  });

  it("arrow keys move and select like a native radio group", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    setup();
    const full = screen.getAllByRole("radiogroup")[1];
    const light = full.querySelector<HTMLButtonElement>('[data-v="light"]')!;
    light.focus();
    fireEvent.keyDown(light, { key: "ArrowRight" });
    expect(getPref()).toBe("dark");
    expect(document.activeElement?.getAttribute("data-v")).toBe("dark");
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(getPref()).toBe("system");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(getPref()).toBe("light");
  });

  it("uses the Amharic strings", async () => {
    localStorage.setItem("cheki-locale", "am");
    render(<I18nProvider><ThemeControl /></I18nProvider>);
    expect(await screen.findByRole("radiogroup", { name: "ገጽታ" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "ጨለማ" })).toBeTruthy();
  });
});

describe("mobile menu Theme row", () => {
  it("tapping the row label moves to the next option", async () => {
    const { Nav } = await import("@/components/Chrome");
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    render(<I18nProvider><Nav /></I18nProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const dialog = screen.getByRole("dialog", { name: "Menu" });
    const group = dialog.querySelector('[aria-labelledby="nmm-theme-label"]')!;
    expect(group.getAttribute("role")).toBe("radiogroup");
    await act(async () => { fireEvent.click(dialog.querySelector("#nmm-theme-label")!); });
    expect(getPref()).toBe("dark");
    expect(group.querySelector('[aria-checked="true"]')?.getAttribute("data-v")).toBe("dark");
  });
});
