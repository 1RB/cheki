"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Icon, Globe02Icon, ChevronDownIcon, CheckmarkCircle01Icon } from "@/components/Icon";

export function LanguageSwitcher() {
  const { t, locale, setLocale, locales } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handle);
      return () => document.removeEventListener("mousedown", handle);
    }
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        aria-label={t("language.switch")}
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", gap: "6px",
          padding: "5px 10px", borderRadius: "20px", border: "1px solid var(--border)",
          background: "var(--surface)", color: "var(--ink-2)", fontSize: "12px", fontWeight: 700,
          cursor: "pointer", transition: "all 0.15s", letterSpacing: "0.02em", lineHeight: 1,
        }}
      >
        <Icon icon={Globe02Icon} size={14} color="var(--ink-3)" strokeWidth={1.6} />
        {locale.toUpperCase()}
        <Icon icon={ChevronDownIcon} size={12} color="var(--ink-3)" />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          minWidth: "150px", background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "10px", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", padding: "4px",
          zIndex: 200,
        }}>
          {locales.map((code) => {
            const active = locale === code;
            return (
              <button
                key={code}
                onClick={() => { setLocale(code); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  width: "100%", padding: "8px 10px", borderRadius: "6px", border: "none",
                  background: active ? "var(--green-light)" : "transparent",
                  cursor: "pointer", fontSize: "13px", color: "var(--ink)",
                  fontWeight: active ? 600 : 400, textAlign: "left",
                }}
              >
                <span>{t(`language.${code}`)}</span>
                {active && <Icon icon={CheckmarkCircle01Icon} size={14} color="var(--green)" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
