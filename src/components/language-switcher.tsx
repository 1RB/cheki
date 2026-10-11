"use client";

/**
 * Language: English / አማርኛ (every locale in translations.ts). One component
 * for the desktop header (compact: "EN" / "አማ" codes, full names as the
 * accessible names) and the mobile menu (full native names). Built on
 * SegmentedControl, like the theme control: radiogroup semantics, keyboard,
 * and a selection drawn in CSS from html[data-locale], which an inline <head>
 * script sets before first paint.
 *
 * It replaced an "EN ⌄" pill with a custom dropdown: the dropdown overlapped
 * the rows below it in the menu, Escape closed the whole menu instead of the
 * dropdown, the options had no selected state for assistive tech, the
 * accessible name "Language" hid the visible "EN", and the current locale was
 * marked in brand green.
 */
import { useTranslation } from "@/lib/i18n/use-translation";
import { translations, type Locale } from "@/lib/i18n/translations";
import { SegmentedControl } from "@/components/segmented-control";

/** Short codes for the compact header control. Native script for Amharic. */
const SHORT: Record<Locale, string> = { en: "EN", am: "አማ" };

export function LanguageSwitcher({ variant = "compact", labelledBy }: { variant?: "full" | "compact"; labelledBy?: string }) {
  const { t, locale, setLocale, locales } = useTranslation();
  // Native names come from each locale's own strings, so they read the same in every UI language.
  const options = locales.map((code) => ({
    value: code,
    label: translations[code].language[code],
    short: SHORT[code] ?? code.toUpperCase(),
    lang: code,
  }));
  return (
    <SegmentedControl
      options={options}
      value={locale}
      onChange={(next) => setLocale(next)}
      label={t("language.switch")}
      labelledBy={labelledBy}
      compact={variant === "compact"}
    />
  );
}
