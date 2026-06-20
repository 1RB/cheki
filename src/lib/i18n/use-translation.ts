"use client";

import { useI18n, translations } from "./context";

function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  if (typeof current === "string") return current;
  return undefined;
}

export function useTranslation() {
  const { locale, setLocale, locales } = useI18n();
  const t = (path: string, vars?: Record<string, string | number>) => {
    const dict = translations[locale] as Record<string, unknown>;
    let text = getNestedValue(dict, path) ?? getNestedValue(translations.en as Record<string, unknown>, path) ?? path;
    if (vars) {
      text = text.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
    }
    return text;
  };
  return { t, locale, setLocale, locales };
}

export function useScopedTranslation(scope: string) {
  const { t, locale, setLocale, locales } = useTranslation();
  return {
    t: (path: string, vars?: Record<string, string | number>) => t(`${scope}.${path}`, vars),
    locale,
    setLocale,
    locales,
  };
}
