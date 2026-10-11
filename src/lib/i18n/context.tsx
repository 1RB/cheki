"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { translations, type Locale } from "./translations";
import { DEFAULT_LOCALE, LOCALES, LOCALE_STORAGE_KEY, parseLocale, readStoredLocale, storeLocale } from "./locale-store";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  locales: Locale[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

function applyLocale(locale: Locale) {
  const root = document.documentElement;
  root.lang = locale;
  root.setAttribute("data-locale", locale);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const restored = useRef(false);

  // Declared before the restore effect on purpose: on mount it is skipped, so
  // <html> never flips to English for a frame before the stored locale lands.
  useEffect(() => {
    if (restored.current) applyLocale(locale);
  }, [locale]);

  useEffect(() => {
    restored.current = true;
    const stored = readStoredLocale();
    if (stored === DEFAULT_LOCALE) applyLocale(stored);
    else setLocaleState(stored);
    // Another tab switched language.
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === LOCALE_STORAGE_KEY) setLocaleState(parseLocale(e.newValue ?? readStoredLocale()));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    if (!LOCALES.includes(next)) return;
    setLocaleState(next);
    storeLocale(next);
  }, []);

  return (
    <I18nContext.Provider value={{ locale, setLocale, locales: LOCALES }}>
      {children}
    </I18nContext.Provider>
  );
}

/**
 * The active locale, or English outside the provider (components rendered on
 * their own in tests, or in isolation). Never throws.
 */
export function useLocaleOrDefault(): Locale {
  return useContext(I18nContext)?.locale ?? DEFAULT_LOCALE;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export { translations };
