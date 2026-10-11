"use client";

/**
 * A timestamp a person can read at a glance: "11 Oct 2026, 14:32 · 3 hours ago".
 *
 * - Always a <time datetime> with the full timestamp (Addis Ababa clock) in
 *   its title.
 * - The absolute part is server-safe. Server components pass it in
 *   precomputed (`absolute`), so the hydrated text is byte-identical whatever
 *   ICU the browser ships.
 * - The relative part comes from the shared minute clock (useNow), which is 0
 *   on the server and during hydration: it renders only on the client, then
 *   updates once a minute, paused while the tab is hidden.
 * - Past 30 days, or for a time in the future beyond clock skew, the relative
 *   part is dropped and the date stands alone.
 *
 * Variants:
 *   both      date · relative            (verdict date row, /status details)
 *   relative  relative, date as fallback (recent checks, "Checked 2 min ago")
 */
import { useLocaleOrDefault } from "@/lib/i18n/context";
import { translate } from "@/lib/i18n/translate";
import { useNow } from "@/lib/time/use-now";
import { formatAbsolute, formatFull, formatRelative, isoValue, parseTimestamp } from "@/lib/time/relative";

interface Props {
  /** ISO string, a bank's own timestamp text, epoch ms or a Date. */
  value: string | number | Date | null | undefined;
  variant?: "both" | "relative";
  /** i18n key with a {when} slot, e.g. "time.checked" → "Checked 2 min ago". */
  template?: string;
  /** Precomputed English absolute text from a server component. */
  absolute?: string;
  className?: string;
}

export function RelativeTime({ value, variant = "both", template, absolute, className }: Props) {
  const locale = useLocaleOrDefault();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const now = useNow();
  const parsed = parseTimestamp(value ?? null);
  if (!parsed) return value ? <span className={className}>{String(value)}</span> : null;

  const abs = locale !== "en" && now !== 0 ? formatAbsolute(parsed, locale) : (absolute ?? formatAbsolute(parsed, locale));
  const rel = now === 0 ? null : formatRelative(parsed, now, { locale, justNow: t("time.justNow") });
  const title = formatFull(parsed, locale, t("time.zone"));
  const wrap = (s: string) => (template ? t(template, { when: s }) : s);

  return (
    <time dateTime={isoValue(parsed)} title={title} className={className ? `rt ${className}` : "rt"}>
      {variant === "both" ? (
        <>
          {wrap(abs)}
          {rel && (
            <>
              <span className="rt-sep"> · </span>
              <span className="rt-rel">{rel}</span>
            </>
          )}
        </>
      ) : (
        wrap(rel ?? abs)
      )}
    </time>
  );
}
