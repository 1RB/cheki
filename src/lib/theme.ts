/**
 * Theme preference: Light, Dark or System (follow the OS).
 *
 * One store for every theme control on the page (the desktop header and the
 * mobile menu), so two instances can never disagree about the current state.
 *
 * <html> carries two attributes:
 *  - data-theme       the resolved palette, "light" | "dark" (the CSS keys off this)
 *  - data-theme-pref  the user's choice, "light" | "dark" | "system" (the
 *                     segmented control's selected state is drawn from this
 *                     in CSS, so it is right on first paint, before hydration)
 *
 * THEME_INIT_SCRIPT sets both inline in <head>, before first paint (no flash),
 * and the store keeps them in sync afterwards, including OS changes while the
 * preference is System and changes made in another tab.
 */

export type ThemePref = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "cheki-theme";
export const THEME_PREFS: readonly ThemePref[] = ["light", "dark", "system"] as const;
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Anything other than "light" or "dark" (missing, "system", junk) means System. */
export function parsePref(stored: string | null | undefined): ThemePref {
  return stored === "light" || stored === "dark" ? stored : "system";
}

export function resolveTheme(pref: ThemePref, osDark: boolean): ResolvedTheme {
  return pref === "system" ? (osDark ? "dark" : "light") : pref;
}

/**
 * Runs inline in <head> before the first paint. Kept dependency-free and in
 * ES5 because it executes before any bundle. Mirrors parsePref/resolveTheme
 * (tests/ui/theme.test.ts runs this exact string against both).
 */
export const THEME_INIT_SCRIPT = `(function(){var r=document.documentElement,p="system";try{var s=localStorage.getItem("${THEME_STORAGE_KEY}");if(s==="light"||s==="dark")p=s;}catch(e){}var d=false;try{d=window.matchMedia("${DARK_QUERY}").matches;}catch(e){}r.setAttribute("data-theme",p==="system"?(d?"dark":"light"):p);r.setAttribute("data-theme-pref",p);})();`;

function osDark(): boolean {
  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

export function readPref(): ThemePref {
  try {
    return parsePref(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

/** Writes both attributes on <html>. Returns the resolved theme. */
export function applyPref(pref: ThemePref): ResolvedTheme {
  const resolved = resolveTheme(pref, osDark());
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.setAttribute("data-theme-pref", pref);
  return resolved;
}

const listeners = new Set<() => void>();
let current: ThemePref | null = null;

function emit() {
  for (const l of listeners) l();
}

/** The store's snapshot (client). */
export function getPref(): ThemePref {
  if (current === null) current = readPref();
  return current;
}

/** Server snapshot: unknown until hydration. The control's visuals come from CSS, so nothing flashes. */
export function getServerPref(): ThemePref | null {
  return null;
}

/** Persist and apply a choice. "system" is stored explicitly so the choice survives reloads. */
export function setPref(pref: ThemePref): void {
  current = pref;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* private mode: still applies for this page */
  }
  applyPref(pref);
  emit();
}

let mql: MediaQueryList | null = null;
const onOsChange = () => {
  if (getPref() === "system") {
    applyPref("system");
    emit();
  }
};
const onStorage = (e: StorageEvent) => {
  if (e.key !== null && e.key !== THEME_STORAGE_KEY) return;
  current = readPref();
  applyPref(current);
  emit();
};

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") {
    try {
      mql = window.matchMedia(DARK_QUERY);
      mql.addEventListener?.("change", onOsChange);
    } catch {
      mql = null;
    }
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      mql?.removeEventListener?.("change", onOsChange);
      mql = null;
      window.removeEventListener("storage", onStorage);
    }
  };
}

/** Test hook: forget the cached preference. */
export function __resetThemeStore(): void {
  current = null;
}
