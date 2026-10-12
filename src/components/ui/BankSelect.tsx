"use client";

/**
 * The bank chooser: a button that opens a listbox. It replaces the native
 * <select> under the verify input, so the closed control and the open list
 * both follow the site's type, ink and motion instead of the platform's.
 *
 * Semantics (WAI-ARIA APG):
 * - the trigger is a button with aria-haspopup="listbox" and aria-expanded;
 * - with more than FILTER_MIN options the popup opens on a filter input with
 *   role="combobox" that owns the listbox; otherwise the listbox itself takes
 *   focus. Either way the active option is aria-activedescendant, and the
 *   chosen one is aria-selected.
 *
 * Keys: ↑/↓, Home/End, Enter (and Space when nothing is typed) choose, Esc
 * closes without a change, Tab closes and moves on, letters filter or jump.
 * An outside click closes. Focus returns to the trigger.
 *
 * Under 560px the list opens as a bottom sheet (portalled, so no transformed
 * ancestor can trap the fixed position). On a touch screen the filter is not
 * focused on open, so the keyboard does not cover the list.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { Bank } from "@/lib/banks";
import { betaInfo } from "@/lib/verify/detect";
import type { Translate } from "@/lib/i18n/translate";
import { BankLogoByName } from "@/components/BankLogo";
import { Icon, ChevronDownIcon, Search01Icon, Tick02Icon } from "@/components/Icon";
import "./bank-select.css";

/** Above this many options the list gets a filter field. */
export const FILTER_MIN = 8;
const SHEET_QUERY = "(max-width: 559px)";
const TYPEAHEAD_MS = 600;
/** Tall enough for the filter and all ten options today. */
const POPOVER_MAX = 520;
/** Matches --dur-fast / --dur-base: exits are faster than enters. */
const EXIT_MS = { popover: 120, sheet: 180 } as const;

export interface BankOption {
  /** "" is Auto-detect. */
  code: string;
  label: string;
  /** Full name, matched by the filter too ("Bank of Abyssinia" finds BOA). */
  name?: string;
  beta?: boolean;
  betaNote?: string;
}

/**
 * Auto-detect, then the confirmed banks, then the beta ones: the same set the
 * native select offered, in an order that puts the sure things first.
 */
export function bankOptions(banks: Bank[], autoLabel: string): BankOption[] {
  const rows = banks.map((b) => {
    const beta = betaInfo(b);
    return { code: b.code, label: b.shortName, name: b.name, beta: beta.beta, betaNote: beta.note };
  });
  return [{ code: "", label: autoLabel }, ...rows.filter((r) => !r.beta), ...rows.filter((r) => r.beta)];
}

/**
 * Options whose short or full name contains the query. Names that start with
 * it come first ("t" puts Telebirr above Auto-detect), otherwise list order.
 */
export function filterOptions(options: BankOption[], query: string): BankOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  const rank = (o: BankOption) => {
    const names = [o.label, o.name ?? ""].map((n) => n.toLowerCase());
    if (names.some((n) => n.startsWith(q))) return 0;
    if (names.some((n) => n.split(/[\s-]+/).some((w) => w.startsWith(q)))) return 1;
    return names.some((n) => n.includes(q)) ? 2 : -1;
  };
  return options
    .map((o, i) => ({ o, i, r: rank(o) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.o);
}

/** Next option whose label starts with `buffer`, searching after `from` and wrapping. */
export function typeaheadIndex(options: BankOption[], buffer: string, from: number): number {
  const b = buffer.toLowerCase();
  if (!b || !options.length) return -1;
  // A repeated letter ("ddd") cycles through the matches for that letter.
  const cycling = b.length > 1 && [...b].every((c) => c === b[0]);
  const needle = cycling ? b[0] : b;
  const start = cycling || b.length === 1 ? from + 1 : from;
  for (let k = 0; k < options.length; k++) {
    const i = (start + k + options.length) % options.length;
    if (options[i].label.toLowerCase().startsWith(needle)) return i;
  }
  return -1;
}

const isPrintable = (e: KeyboardEvent) => e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
const matches = (q: string) => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(q).matches;

interface Props {
  id: string;
  /** Chosen bank code; "" is Auto-detect. */
  value: string;
  onChange: (code: string) => void;
  banks: Bank[];
  /** What auto-detection found for the current input, shown on the closed control. */
  detected?: { code: string; shortName: string };
  t: Translate;
}

export function BankSelect({ id, value, onChange, banks, detected, t }: Props) {
  const uid = useId();
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;
  const listId = `${id}-list`;
  const optId = (code: string) => `${uid}-opt-${code || "auto"}`;

  const options = useMemo(() => bankOptions(banks, t("verify.autoDetect")), [banks, t]);
  const hasFilter = options.length > FILTER_MIN;

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [side, setSide] = useState<"bottom" | "top">("bottom");
  const [maxH, setMaxH] = useState(POPOVER_MAX);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  /** Keyboard in use: only then does the active option carry the focus ring. */
  const [kbd, setKbd] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typeahead = useRef({ buffer: "", at: 0 });
  /** Focus the filter (or the list) once the popup has rendered. */
  const focusOnOpen = useRef<"input" | "list" | null>(null);

  const shown = useMemo(() => filterOptions(options, query), [options, query]);
  const activeOpt = shown[Math.min(active, shown.length - 1)];
  const selected = options.find((o) => o.code === value) ?? options[0];

  const openList = useCallback(
    (opts: { kbd: boolean; seed?: string; at?: "first" | "last" }) => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
      const asSheet = matches(SHEET_QUERY);
      const touch = matches("(pointer: coarse)");
      // With a filter, a letter typed on the closed control starts the
      // filter; without one it jumps like a native select.
      const q = hasFilter ? opts.seed ?? "" : "";
      const list = filterOptions(options, q);
      let idx = Math.max(0, list.findIndex((o) => o.code === value));
      if (opts.at === "first" || q) idx = 0;
      else if (opts.at === "last") idx = list.length - 1;
      else if (opts.seed) {
        const hit = typeaheadIndex(list, opts.seed, idx);
        if (hit >= 0) idx = hit;
        typeahead.current = { buffer: opts.seed, at: Date.now() };
      }
      if (!asSheet && triggerRef.current) {
        // Open where there is room, and never taller than that room.
        const r = triggerRef.current.getBoundingClientRect();
        const below = window.innerHeight - r.bottom;
        const up = below < 280 && r.top > below;
        setSide(up ? "top" : "bottom");
        setMaxH(Math.max(160, Math.min(POPOVER_MAX, (up ? r.top : below) - 16)));
      }
      setSheet(asSheet);
      setQuery(q);
      setActive(idx);
      setKbd(opts.kbd);
      setMounted(true);
      setOpen(true);
      focusOnOpen.current = hasFilter && !touch ? "input" : "list";
    },
    [hasFilter, options, value]
  );

  const close = useCallback(
    (opts: { focus: boolean }) => {
      setOpen(false);
      typeahead.current = { buffer: "", at: 0 };
      if (opts.focus) triggerRef.current?.focus({ preventScroll: true });
      const ms = matches("(prefers-reduced-motion: reduce)") ? 0 : EXIT_MS[sheet ? "sheet" : "popover"];
      if (exitTimer.current) clearTimeout(exitTimer.current);
      if (ms === 0) setMounted(false);
      else exitTimer.current = setTimeout(() => setMounted(false), ms);
    },
    [sheet]
  );

  const choose = (o: BankOption | undefined) => {
    if (!o) return;
    if (o.code !== value) onChange(o.code);
    close({ focus: true });
  };

  useEffect(() => () => { if (exitTimer.current) clearTimeout(exitTimer.current); }, []);

  // Move focus into the popup after it renders (layout effect: before paint,
  // so the first frame already shows the caret and the active row).
  useLayoutEffect(() => {
    if (!open || !focusOnOpen.current) return;
    const target = focusOnOpen.current === "input" ? inputRef.current : listRef.current;
    focusOnOpen.current = null;
    target?.focus({ preventScroll: true });
  }, [open]);

  // Outside press closes. Focus goes back to the trigger unless the press
  // landed on something that takes focus itself (the input, a link).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (!el || triggerRef.current?.contains(el) || popRef.current?.contains(el)) return;
      const focusable = el.closest?.("input, textarea, select, button, a[href], [tabindex], [contenteditable], label");
      close({ focus: !focusable });
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, close]);

  // The sheet holds the page still while it is open.
  useEffect(() => {
    if (!open || !sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open, sheet]);

  // Keep the active row in view without scrolling the page.
  useEffect(() => {
    if (!open || !activeOpt) return;
    const list = listRef.current;
    const el = list ? (list.querySelector(`[id="${optId(activeOpt.code)}"]`) as HTMLElement | null) : null;
    if (!list || !el) return;
    if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop - 4;
    else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight + 4;
    // optId is derived from uid, which never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeOpt]);

  const move = (to: number) => {
    setKbd(true);
    setActive(Math.max(0, Math.min(to, shown.length - 1)));
  };

  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (open) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openList({ kbd: true });
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      openList({ kbd: true, at: e.key === "Home" ? "first" : "last" });
    } else if (isPrintable(e)) {
      e.preventDefault();
      openList({ kbd: true, seed: e.key });
    }
  };

  const onPopKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const inInput = e.target === inputRef.current;
    // The sheet's Close button keeps its own Enter and Space.
    if (!inInput && e.target !== listRef.current && e.key !== "Escape" && e.key !== "Tab") return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(active + 1);
        return;
      case "ArrowUp":
        e.preventDefault();
        move(active - 1);
        return;
      case "Home":
        e.preventDefault();
        move(0);
        return;
      case "End":
        e.preventDefault();
        move(shown.length - 1);
        return;
      case "PageDown":
        e.preventDefault();
        move(active + 5);
        return;
      case "PageUp":
        e.preventDefault();
        move(active - 5);
        return;
      case "Enter":
        e.preventDefault();
        choose(activeOpt);
        return;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close({ focus: true });
        return;
      case "Tab":
        // Focus the trigger now; the browser's own Tab then moves on from it.
        close({ focus: true });
        return;
      case " ":
        if (!inInput || !query) {
          e.preventDefault();
          choose(activeOpt);
        }
        return;
    }
    if (!inInput && isPrintable(e)) {
      e.preventDefault();
      const now = Date.now();
      const ta = typeahead.current;
      ta.buffer = now - ta.at > TYPEAHEAD_MS ? e.key : ta.buffer + e.key;
      ta.at = now;
      const i = typeaheadIndex(shown, ta.buffer, active);
      if (i >= 0) move(i);
    }
  };

  const autoHint = !value && detected ? detected : undefined;
  const triggerText = value ? selected.label : autoHint ? t("verify.bankPicker.autoShort", { bank: autoHint.shortName }) : t("verify.autoDetect");
  const activeId = open && activeOpt ? optId(activeOpt.code) : undefined;

  const listbox = (
    <ul
      ref={listRef}
      id={listId}
      role="listbox"
      aria-labelledby={labelId}
      tabIndex={-1}
      aria-activedescendant={activeId}
      className="bs-list"
    >
      {shown.map((o, i) => {
        const isActive = activeOpt?.code === o.code;
        const isSelected = o.code === value;
        return (
          <li
            key={o.code || "auto"}
            id={optId(o.code)}
            role="option"
            aria-selected={isSelected}
            data-active={isActive || undefined}
            className="bs-opt"
            data-auto={o.code === "" || undefined}
            // Keep focus in the filter / list while the pointer chooses.
            onMouseDown={(e) => e.preventDefault()}
            onPointerMove={() => {
              if (kbd) setKbd(false);
              if (active !== i) setActive(i);
            }}
            onClick={() => choose(o)}
          >
            {o.code ? (
              <BankLogoByName code={o.code} size={20} />
            ) : null}
            <span className="bs-opt-text">
              <span className="bs-opt-label">{o.label}</span>
              {o.code === "" && (
                <span className="bs-opt-sub">
                  {detected ? t("verify.bankPicker.autoDetected", { bank: detected.shortName }) : t("verify.bankPicker.autoSub")}
                </span>
              )}
            </span>
            {o.beta && (
              <span className="bs-opt-beta" title={o.betaNote}>{t("verify.beta")}</span>
            )}
            <span className="bs-opt-tick" aria-hidden="true">
              {isSelected && <Icon icon={Tick02Icon} size={16} strokeWidth={2} />}
            </span>
          </li>
        );
      })}
      {shown.length === 0 && (
        <li role="presentation" className="bs-empty">{t("verify.bankPicker.noMatch", { query: query.trim() })}</li>
      )}
    </ul>
  );

  const popup = mounted ? (
    <div
      ref={popRef}
      className={sheet ? "bs-sheet-root" : "bs-pop"}
      data-side={sheet ? undefined : side}
      data-state={open ? "open" : "closed"}
      data-kbd={kbd || undefined}
      onKeyDown={onPopKey}
      inert={!open || undefined}
    >
      {sheet && <div className="bs-scrim" aria-hidden="true" onClick={() => close({ focus: true })} />}
      <div
        className={sheet ? "bs-sheet" : "bs-pop-inner"}
        role={sheet ? "dialog" : undefined}
        aria-labelledby={sheet ? labelId : undefined}
        style={sheet ? undefined : { maxHeight: maxH }}
      >
        {sheet && (
          <div className="bs-sheet-head">
            <span className="bs-sheet-title" aria-hidden="true">{t("verify.bankSelect")}</span>
            <button type="button" className="bs-sheet-close" onClick={() => close({ focus: true })}>
              {t("verify.bankPicker.close")}
            </button>
          </div>
        )}
        {hasFilter && (
          <div className="bs-search">
            <Icon icon={Search01Icon} size={16} color="var(--ink-3)" />
            <input
              ref={inputRef}
              className="bs-filter"
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeId}
              aria-label={t("verify.bankPicker.filter")}
              placeholder={t("verify.bankPicker.filter")}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="done"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
            />
          </div>
        )}
        {listbox}
      </div>
    </div>
  ) : null;

  return (
    <div className="bs" data-open={open || undefined}>
      <span id={labelId} className="sr-only">{t("verify.bankSelect")}</span>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="bs-trigger"
        data-value={value}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${labelId} ${valueId}`}
        onClick={() => (open ? close({ focus: true }) : openList({ kbd: false }))}
        onKeyDown={onTriggerKey}
      >
        {value && <BankLogoByName code={value} size={16} />}
        <span id={valueId} className="bs-trigger-text" data-auto={!value || undefined}>{triggerText}</span>
        <span className="bs-chev" aria-hidden="true">
          <Icon icon={ChevronDownIcon} size={14} strokeWidth={2} />
        </span>
      </button>
      {popup && (sheet ? createPortal(popup, document.body) : popup)}
    </div>
  );
}
