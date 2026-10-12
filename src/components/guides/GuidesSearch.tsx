"use client";

import { useCallback, useId, useState } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * The /guides search box: the page's only client island. The list itself is
 * server-rendered (and complete without JavaScript); this hides the rows and
 * sections that don't match. Each row carries its lower-cased search text in
 * data-search, so filtering never ships the article corpus to the browser.
 */
export function GuidesSearch({ listId, total }: { listId: string; total: number }) {
  const { t } = useTranslation();
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(total);

  const apply = useCallback(
    (value: string) => {
      setQuery(value);
      const list = document.getElementById(listId);
      if (!list) return;
      const terms = value.toLowerCase().trim().split(/\s+/).filter(Boolean);
      let count = 0;
      list.querySelectorAll<HTMLElement>("[data-guide-section]").forEach((section) => {
        let inSection = 0;
        section.querySelectorAll<HTMLElement>("[data-guide-row]").forEach((row) => {
          const haystack = row.dataset.search ?? "";
          const match = terms.every((term) => haystack.includes(term));
          row.hidden = !match;
          if (match) inSection += 1;
        });
        section.hidden = inSection === 0;
        count += inSection;
      });
      setShown(count);
    },
    [listId]
  );

  const searching = query.trim().length > 0;

  return (
    <div className="gx-search" role="search">
      <label htmlFor={inputId} className="sr-only">
        {t("guides.searchLabel")}
      </label>
      <svg className="gx-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        id={inputId}
        type="search"
        className="gx-search-input"
        value={query}
        placeholder={t("guides.searchPlaceholder")}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        aria-controls={listId}
        onChange={(e) => apply(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && query) {
            e.preventDefault();
            apply("");
          }
        }}
      />
      <p className="gx-search-status" data-guides-status aria-live="polite">
        {!searching ? "" : shown > 0 ? t("guides.results", { count: shown, total }) : t("guides.noResults", { query: query.trim() })}
      </p>
      {searching && shown === 0 && (
        <div className="gx-empty" data-guides-empty>
          <button type="button" className="gx-clear" onClick={() => apply("")}>
            {t("guides.clear")}
          </button>
        </div>
      )}
    </div>
  );
}
