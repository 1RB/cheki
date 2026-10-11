/**
 * Locale persistence, shared by the I18nProvider and the inline <head> script.
 *
 * The site is server-rendered in English and switches on the client; the
 * locale is not in the URL. LOCALE_INIT_SCRIPT sets html[data-locale] from
 * localStorage before first paint, so the language control shows the right
 * selection immediately (the page text follows at hydration). `lang` is left
 * to the provider, because the text is still English until then.
 */
import { translations, type Locale } from "./translations";

export const LOCALE_STORAGE_KEY = "cheki-locale";
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALES = Object.keys(translations) as Locale[];

export function parseLocale(stored: string | null | undefined): Locale {
  return stored && (LOCALES as string[]).includes(stored) ? (stored as Locale) : DEFAULT_LOCALE;
}

export function readStoredLocale(): Locale {
  try {
    return parseLocale(localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* private mode: the switch still applies to this page */
  }
}

/** Runs inline in <head> before first paint. Mirrors parseLocale (tests run it). */
export const LOCALE_INIT_SCRIPT = `(function(){var l="${DEFAULT_LOCALE}";try{var s=localStorage.getItem("${LOCALE_STORAGE_KEY}");if(${JSON.stringify(LOCALES)}.indexOf(s)>-1)l=s;}catch(e){}document.documentElement.setAttribute("data-locale",l);})();`;
