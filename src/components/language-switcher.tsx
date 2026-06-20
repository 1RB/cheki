"use client";

import { useTranslation } from "@/lib/i18n/use-translation";

export function LanguageSwitcher() {
  const { t, locale, setLocale, locales } = useTranslation();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      {locales.map((code) => (
        <button
          key={code}
          onClick={() => setLocale(code)}
          aria-label={t(`language.${code}`)}
          style={{
            padding: "4px 8px",
            fontSize: "12px",
            fontWeight: 600,
            borderRadius: "4px",
            border: "1px solid",
            borderColor: locale === code ? "var(--green)" : "var(--border)",
            background: locale === code ? "var(--green-light)" : "transparent",
            color: locale === code ? "var(--green-dark)" : "var(--ink-3)",
            cursor: "pointer",
            transition: "all 0.15s",
            lineHeight: 1,
          }}
        >
          {t(`language.${code}`)}
        </button>
      ))}
    </div>
  );
}
