"use client";

import { useCallback } from "react";
import { useI18n } from "./context";
import { translate, type Translate } from "./translate";

export function useTranslation() {
  const { locale, setLocale, locales } = useI18n();
  const t: Translate = useCallback((path, vars) => translate(locale, path, vars), [locale]);
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
