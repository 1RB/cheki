"use client";

/**
 * ⌘K search, loaded only when it is first opened (see Chrome.tsx).
 *
 * A modal dialog with an ARIA combobox: the input owns a listbox, arrow keys
 * move aria-activedescendant, Enter opens, Escape closes and focus returns to
 * whatever opened it. The page behind is inert while it is open. Items come
 * from /search-index.json, a static file built from the bank manifest and the
 * guides, so neither ships in the page bundle.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Icon, Search01Icon, Cancel01Icon } from "@/components/Icon";

export type CommandItem = {
  id: string;
  label: string;
  description?: string;
  href: string;
  group?: string;
};

let cache: Promise<CommandItem[]> | null = null;
function loadItems(): Promise<CommandItem[]> {
  cache ??= fetch("/search-index.json")
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => {
      cache = null;
      return [];
    });
  return cache;
}

interface Props {
  onClose: () => void;
}

export default function CommandPalette({ onClose }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<CommandItem[]>([]);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const labelId = useId();

  useEffect(() => {
    let live = true;
    loadItems().then((list) => live && setItems(list));
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    // Everything outside the dialog is inert while it is open.
    const siblings = Array.from(document.body.children).filter((el) => el !== dialogRef.current?.parentElement && !el.contains(dialogRef.current));
    siblings.forEach((el) => el.setAttribute("inert", ""));
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      live = false;
      siblings.forEach((el) => el.removeAttribute("inert"));
      document.body.style.overflow = prevOverflow;
      opener?.focus();
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? items.filter((i) => i.label.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q) || i.group?.toLowerCase().includes(q))
      : items.filter((i) => i.group !== "Guides").concat(items.filter((i) => i.group === "Guides").slice(0, 6));
    return list.slice(0, 60);
  }, [items, query]);

  const go = (item: CommandItem | undefined) => {
    if (!item) return;
    onClose();
    router.push(item.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(filtered[active]);
    } else if (e.key === "Tab") {
      // Focus stays in the dialog: input and close button only.
      e.preventDefault();
      const close = dialogRef.current?.querySelector<HTMLButtonElement>(".cp-close");
      (document.activeElement === inputRef.current ? close : inputRef.current)?.focus();
    }
  };

  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  // Group header above the first item of each group (computed, not mutated in render).
  const headers = useMemo(
    () => filtered.map((item, i) => (item.group && item.group !== filtered[i - 1]?.group ? item.group : null)),
    [filtered]
  );
  return createPortal(
    <div className="cp-root">
      <div className="cp-backdrop" onClick={onClose} aria-hidden="true" />
      <div ref={dialogRef} className="cp" role="dialog" aria-modal="true" aria-labelledby={labelId} onKeyDown={onKeyDown}>
        <h2 id={labelId} className="sr-only">Search cheki</h2>
        <div className="cp-search">
          <Icon icon={Search01Icon} size={18} color="var(--ink-3)" />
          <input
            ref={inputRef}
            className="cp-input"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
            aria-label="Search banks, guides and pages"
            placeholder="Search banks, guides, pages"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
          />
          <button type="button" className="cp-close" onClick={onClose} aria-label="Close search">
            <Icon icon={Cancel01Icon} size={16} />
          </button>
        </div>
        <ul id={listId} role="listbox" aria-label="Results" className="cp-list">
          {filtered.length === 0 && <li className="cp-empty" role="presentation">{items.length ? "No results" : "Loading…"}</li>}
          {filtered.map((item, i) => {
            const header = headers[i];
            return (
              <li key={item.id} role="presentation">
                {header && <span className="cp-group" aria-hidden="true">{header}</span>}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className="cp-option"
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(item)}
                >
                  <span className="cp-label">{item.label}</span>
                  {item.description && <span className="cp-desc">{item.description}</span>}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="cp-foot" aria-hidden="true"><kbd>↑↓</kbd> move <kbd>↵</kbd> open <kbd>esc</kbd> close</p>
      </div>
    </div>,
    document.body
  );
}
