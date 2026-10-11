/**
 * Pure string lookup, shared by the useTranslation hook and by code that runs
 * outside React (presentVerdict, the copied result text, tests). A key missing
 * from the active locale falls back to English, then to the key itself.
 */
import { translations, type Locale } from "./translations";

export type Translate = (path: string, vars?: Record<string, string | number>) => string;

function lookup(obj: unknown, path: string): string | undefined {
  let current: unknown = obj;
  for (const part of path.split(".")) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function translate(locale: Locale, path: string, vars?: Record<string, string | number>): string {
  let text = lookup(translations[locale], path) ?? lookup(translations.en, path) ?? path;
  if (vars) text = text.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
  return text;
}

/** English translator, the default for pure helpers. */
export const tEn: Translate = (path, vars) => translate("en", path, vars);
