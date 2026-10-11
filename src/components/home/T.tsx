"use client";

import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * A translated string inside a server component. The server renders English;
 * the client swaps in the reader's language after hydration.
 */
export function T({ k, vars }: { k: string; vars?: Record<string, string | number> }) {
  const { t } = useTranslation();
  return <>{t(k, vars)}</>;
}
