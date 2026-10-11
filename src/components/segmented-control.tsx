"use client";

/**
 * The one segmented control behind the theme and language settings, in the
 * desktop header (compact) and the mobile menu (full).
 *
 * - role="radiogroup" with role="radio" + aria-checked options, roving
 *   tabindex and arrow / Home / End keys that move and select, like a native
 *   radio group.
 * - The selected option's raised surface and ink label are drawn in CSS from
 *   an attribute on <html> (`data-theme-pref`, `data-locale`) that an inline
 *   <head> script sets before first paint, so the selection is right before
 *   hydration and nothing swaps in afterwards. `value` only drives ARIA.
 * - compact: icon-only (or a short text code) with the full name as the
 *   accessible name; full: icon plus label.
 */
import type { KeyboardEvent } from "react";
import type { IconSvgElement } from "@hugeicons/react";
import { Icon } from "@/components/Icon";

export interface SegmentOption<T extends string> {
  value: T;
  /** Full name: the visible label (full) and the accessible name (always). */
  label: string;
  /** Visible text in the compact variant when there is no icon (e.g. "EN"). */
  short?: string;
  icon?: IconSvgElement;
  /** BCP 47 language of the label, so screen readers pronounce it right. */
  lang?: string;
}

export function SegmentedControl<T extends string>({
  options, value, onChange, label, labelledBy, compact = false, className,
}: {
  options: readonly SegmentOption<T>[];
  /** null before hydration: every option stays tabbable and none is announced as checked. */
  value: T | null;
  onChange: (next: T, origin: HTMLElement | null) => void;
  label?: string;
  labelledBy?: string;
  compact?: boolean;
  className?: string;
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const n = options.length;
    let idx = Math.max(0, options.findIndex((o) => o.value === value));
    if (e.key in step) idx = (idx + step[e.key] + n) % n;
    else if (e.key === "Home") idx = 0;
    else if (e.key === "End") idx = n - 1;
    else return;
    e.preventDefault();
    const target = e.currentTarget.querySelector<HTMLButtonElement>(`[data-v="${options[idx].value}"]`);
    target?.focus();
    if (options[idx].value !== value) onChange(options[idx].value, target);
  };

  return (
    <div
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      className={["tc", compact && "tc--compact", className].filter(Boolean).join(" ")}
      onKeyDown={onKeyDown}
    >
      {options.map((o) => {
        const checked = value === o.value;
        const iconOnly = compact && !!o.icon;
        const text = compact ? (o.icon ? null : o.short ?? o.label) : o.label;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            // Compact options show an icon or a code; the full name is the accessible name.
            aria-label={compact ? o.label : undefined}
            title={iconOnly ? o.label : undefined}
            tabIndex={value === null || checked ? 0 : -1}
            data-v={o.value}
            lang={o.lang}
            className={text && compact ? "tc-opt tc-opt--text" : "tc-opt"}
            onClick={(e) => { if (!checked) onChange(o.value, e.currentTarget); }}
          >
            {o.icon && <Icon icon={o.icon} size={compact ? 15 : 14} strokeWidth={1.7} />}
            {text && <span className="tc-label">{text}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A mobile-menu settings row: label on the left, a SegmentedControl on the
 * right. The whole row is tappable: a tap outside the control (on the label
 * or the padding) selects the next option, through the option's own click.
 */
export function selectNextInRow(row: HTMLElement): void {
  const radios = Array.from(row.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
  if (radios.length === 0) return;
  const cur = radios.findIndex((r) => r.getAttribute("aria-checked") === "true");
  radios[(cur + 1) % radios.length].click();
}
