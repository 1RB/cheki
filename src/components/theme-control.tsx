"use client";

/**
 * Light / Dark / System. One component for the desktop header
 * (variant="compact", icons only) and the mobile menu (icons plus labels),
 * backed by one store (src/lib/theme.ts), so every instance shows the same
 * state. Built on SegmentedControl (radiogroup semantics, keyboard, and a
 * CSS-drawn selection from html[data-theme-pref], so nothing swaps in after
 * hydration).
 * - The palette swap is a circle reveal from the tapped option where View
 *   Transitions exist and motion is allowed; otherwise a one-frame clean cut.
 *   A tap during a running reveal finishes it and applies the new choice
 *   (the old toggle ignored taps for 500ms).
 */
import { useSyncExternalStore } from "react";
import { Sun03Icon, Moon02Icon, ComputerIcon } from "@/components/Icon";
import { SegmentedControl } from "@/components/segmented-control";
import { useTranslation } from "@/lib/i18n/use-translation";
import { THEME_PREFS, getPref, getServerPref, resolveTheme, setPref, subscribe, type ThemePref } from "@/lib/theme";

const ICONS = { light: Sun03Icon, dark: Moon02Icon, system: ComputerIcon } as const;

export function nextPref(pref: ThemePref): ThemePref {
  return THEME_PREFS[(THEME_PREFS.indexOf(pref) + 1) % THEME_PREFS.length];
}

let running: ViewTransition | null = null;

/** Apply a preference, animating the palette swap from `origin` when allowed. */
export function changeTheme(next: ThemePref, origin?: Element | null): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const before = root.getAttribute("data-theme");
  const osDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  const after = resolveTheme(next, osDark);
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  if (running) {
    running.skipTransition();
    running = null;
  }

  // Same palette (e.g. Dark -> System on a dark OS): only the selection moves.
  if (before === after) {
    setPref(next);
    return;
  }

  if (!reduce && typeof document.startViewTransition === "function") {
    const transition = document.startViewTransition(() => setPref(next));
    running = transition;
    transition.ready
      .then(() => {
        const rect = origin?.getBoundingClientRect();
        const x = rect ? rect.left + rect.width / 2 : window.innerWidth - 40;
        const y = rect ? rect.top + rect.height / 2 : 16;
        const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
          { duration: 500, easing: "cubic-bezier(0.16, 1, 0.3, 1)", pseudoElement: "::view-transition-new(root)" },
        );
      })
      .catch(() => {});
    transition.finished.finally(() => {
      if (running === transition) running = null;
    });
    return;
  }

  // No View Transitions, or reduced motion: suppress colour transitions for
  // exactly one frame so the swap is a clean cut, not a smear.
  root.classList.add("theme-instant");
  setPref(next);
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-instant")));
}

export function ThemeControl({ variant = "full", labelledBy }: { variant?: "full" | "compact"; labelledBy?: string }) {
  const { t } = useTranslation();
  // null during SSR and hydration; the visual state is CSS-driven meanwhile.
  const pref = useSyncExternalStore(subscribe, getPref, getServerPref);
  const options = THEME_PREFS.map((p) => ({ value: p, label: t(`theme.${p}`), icon: ICONS[p] }));
  return (
    <SegmentedControl
      options={options}
      value={pref}
      onChange={changeTheme}
      label={t("theme.label")}
      labelledBy={labelledBy}
      compact={variant === "compact"}
    />
  );
}
