// @vitest-environment jsdom
/**
 * Language control (English / አማርኛ): the shared SegmentedControl in the
 * header and the menu, persistence, the pre-hydration attribute, and the
 * whole-row tap in the mobile menu.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/context";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LOCALE_INIT_SCRIPT, LOCALE_STORAGE_KEY, LOCALES, parseLocale } from "@/lib/i18n/locale-store";

vi.mock("next/link", () => ({ default: ({ href, children, prefetch: _p, ...rest }: { href: string; children: React.ReactNode; prefetch?: boolean }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const html = () => document.documentElement;
beforeEach(() => {
  localStorage.clear();
  html().removeAttribute("data-locale");
  html().lang = "en";
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as typeof window.matchMedia;
});
afterEach(() => cleanup());

describe("locale store", () => {
  it("supports exactly the locales in translations.ts", () => {
    expect(LOCALES).toEqual(["en", "am"]);
    expect(parseLocale("am")).toBe("am");
    for (const v of [null, "", "fr", "AM"]) expect(parseLocale(v)).toBe("en");
  });

  it("the inline script sets data-locale (not lang) from storage, safely", () => {
    for (const [stored, want] of [[null, "en"], ["am", "am"], ["en", "en"], ["xx", "en"]] as const) {
      localStorage.clear();
      if (stored) localStorage.setItem(LOCALE_STORAGE_KEY, stored);
      new Function(LOCALE_INIT_SCRIPT)();
      expect(html().getAttribute("data-locale"), String(stored)).toBe(want);
      expect(html().lang).toBe("en");
    }
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
    new Function(LOCALE_INIT_SCRIPT)();
    expect(html().getAttribute("data-locale")).toBe("en");
    spy.mockRestore();
  });
});

describe("LanguageSwitcher", () => {
  const setup = () => render(
    <I18nProvider>
      <LanguageSwitcher variant="compact" />
      <LanguageSwitcher variant="full" />
    </I18nProvider>,
  );

  it("is a labelled radiogroup with native names, codes in compact, and lang on each option", () => {
    setup();
    const groups = screen.getAllByRole("radiogroup", { name: "Language" });
    expect(groups).toHaveLength(2);
    const [compact, full] = groups;
    expect(Array.from(compact.querySelectorAll('[role="radio"]')).map((r) => r.textContent)).toEqual(["EN", "አማ"]);
    expect(Array.from(full.querySelectorAll('[role="radio"]')).map((r) => r.textContent)).toEqual(["English", "አማርኛ"]);
    // the accessible name is the full native name in both variants
    expect(screen.getAllByRole("radio", { name: "አማርኛ" })).toHaveLength(2);
    expect(full.querySelector('[data-v="am"]')?.getAttribute("lang")).toBe("am");
    expect(full.querySelector('[aria-checked="true"]')?.getAttribute("data-v")).toBe("en");
  });

  it("a tap switches the language everywhere, persists, and updates <html>", async () => {
    setup();
    const full = screen.getAllByRole("radiogroup")[1];
    await act(async () => { fireEvent.click(full.querySelector('[data-v="am"]')!); });
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("am");
    expect(html().lang).toBe("am");
    expect(html().getAttribute("data-locale")).toBe("am");
    // the group's own name follows the new language
    expect(screen.getAllByRole("radiogroup", { name: "ቋንቋ" })).toHaveLength(2);
    for (const g of screen.getAllByRole("radiogroup")) expect(g.querySelector('[aria-checked="true"]')?.getAttribute("data-v")).toBe("am");
  });

  it("restores the stored locale without flipping <html> to English first", async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "am");
    html().setAttribute("data-locale", "am");
    const seen: string[] = [];
    const mo = new MutationObserver(() => seen.push(html().getAttribute("data-locale") ?? ""));
    mo.observe(html(), { attributes: true, attributeFilter: ["data-locale"] });
    render(<I18nProvider><LanguageSwitcher variant="full" /></I18nProvider>);
    await act(async () => {});
    await new Promise((r) => setTimeout(r, 0));
    mo.disconnect();
    expect(seen).not.toContain("en");
    expect(html().lang).toBe("am");
  });

  it("arrow keys switch like a radio group", async () => {
    render(<I18nProvider><LanguageSwitcher variant="full" /></I18nProvider>);
    const en = screen.getByRole("radio", { name: "English" });
    en.focus();
    await act(async () => { fireEvent.keyDown(en, { key: "ArrowRight" }); });
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("am");
    expect(document.activeElement?.getAttribute("data-v")).toBe("am");
  });

  it("survives a throwing localStorage", async () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    render(<I18nProvider><LanguageSwitcher variant="full" /></I18nProvider>);
    await act(async () => { fireEvent.click(screen.getByRole("radio", { name: "አማርኛ" })); });
    expect(html().lang).toBe("am");
    spy.mockRestore();
  });

  it("follows a switch made in another tab", async () => {
    render(<I18nProvider><LanguageSwitcher variant="full" /></I18nProvider>);
    await act(async () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, "am");
      window.dispatchEvent(new StorageEvent("storage", { key: LOCALE_STORAGE_KEY, newValue: "am" }));
    });
    expect(html().lang).toBe("am");
  });
});

describe("mobile menu Language row", () => {
  it("tapping the row label switches to the other language", async () => {
    const { Nav } = await import("@/components/Chrome");
    render(<I18nProvider><Nav /></I18nProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const dialog = screen.getByRole("dialog", { name: "Menu" });
    const group = dialog.querySelector('[aria-labelledby="nmm-lang-label"]')!;
    expect(group.getAttribute("role")).toBe("radiogroup");
    await act(async () => { fireEvent.click(dialog.querySelector("#nmm-lang-label")!); });
    expect(html().lang).toBe("am");
    expect(group.querySelector('[aria-checked="true"]')?.getAttribute("data-v")).toBe("am");
  });
});
