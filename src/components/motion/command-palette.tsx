"use client";

import {
  motion,
  AnimatePresence,
  useReducedMotion,
} from "motion/react";
import { Search, X, ArrowRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { EASE_OUT, SPRING_PANEL } from "@/lib/ease";

export type CommandItem = {
  id: string;
  label: string;
  description?: string;
  href: string;
  icon?: ReactNode;
  group?: string;
};

export interface CommandPaletteProps {
  items: CommandItem[];
  placeholder?: string;
  emptyText?: string;
}

export function CommandPalette({
  items,
  placeholder = "Search banks, guides, pages...",
  emptyText = "No results found",
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // ⌘K / Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.group?.toLowerCase().includes(q),
    );
  }, [items, query]);

  // Group filtered results
  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const item of filtered) {
      const g = item.group || "Pages";
      if (!groups[g]) groups[g] = [];
      groups[g].push(item);
    }
    return groups;
  }, [filtered]);

  const flatList = useMemo(() => Object.values(grouped).flat(), [grouped]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatList.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = flatList[activeIndex];
        if (item) {
          window.location.href = item.href;
          setOpen(false);
        }
      }
    },
    [flatList, activeIndex],
  );

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (typeof document === "undefined") return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search (⌘K)"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "32px",
          height: "32px",
          borderRadius: "8px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          flexShrink: 0,
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        <Search style={{ width: 16, height: 16, color: "var(--ink-3)" }} />
      </button>

      {open ? createPortal(
        <AnimatePresence>
          {open ? (
            <>
              {/* Backdrop */}
              <motion.div
                initial={reduce ? { opacity: 0 } : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.4)",
                  backdropFilter: "blur(4px)",
                  zIndex: 200,
                }}
                onClick={() => setOpen(false)}
              />
              {/* Panel */}
              <motion.div
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98, x: "-50%" }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, x: "-50%" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98, x: "-50%" }}
                transition={{ type: "spring", stiffness: 600, damping: 35, mass: 0.4 }}
                style={{
                  position: "fixed",
                  top: "15vh",
                  left: "50%",
                  width: "calc(100vw - 32px)",
                  maxWidth: "560px",
                  maxHeight: "60vh",
                  background: "var(--surface)",
                  borderRadius: "16px",
                  border: "1px solid var(--border)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
                  zIndex: 201,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
                onKeyDown={handleKeyDown}
              >
                {/* Search input */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--border)",
                }}>
                  <Search style={{ width: 18, height: 18, color: "var(--ink-3)", flexShrink: 0 }} />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
                    placeholder={placeholder}
                    style={{
                      flex: 1,
                      border: "none",
                      background: "transparent",
                      fontSize: "16px",
                      color: "var(--ink)",
                      fontFamily: "var(--sans)",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    style={{
                      border: "none",
                      background: "var(--surface-alt)",
                      borderRadius: "6px",
                      padding: "4px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X style={{ width: 14, height: 14, color: "var(--ink-3)" }} />
                  </button>
                </div>

                {/* Results */}
                <div ref={listRef} style={{
                  overflowY: "auto",
                  flex: 1,
                  padding: "8px",
                }}>
                  {flatList.length === 0 ? (
                    <div style={{
                      padding: "32px 20px",
                      textAlign: "center",
                      color: "var(--ink-3)",
                      fontSize: "14px",
                    }}>{emptyText}</div>
                  ) : (
                    Object.entries(grouped).map(([group, groupItems]) => (
                      <div key={group} style={{ marginBottom: "4px" }}>
                        <div style={{
                          padding: "8px 12px 4px",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "var(--ink-3)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}>{group}</div>
                        {groupItems.map((item) => {
                          const idx = flatList.indexOf(item);
                          const isActive = idx === activeIndex;
                          return (
                            <a
                              key={item.id}
                              href={item.href}
                              data-idx={idx}
                              onMouseEnter={() => setActiveIndex(idx)}
                              onClick={() => setOpen(false)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                padding: "10px 12px",
                                borderRadius: "10px",
                                textDecoration: "none",
                                background: isActive ? "var(--surface-alt)" : "transparent",
                                transition: "background 0.1s",
                              }}
                            >
                              {item.icon && (
                                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, flexShrink: 0 }}>
                                  {item.icon}
                                </span>
                              )}
                              <span style={{ flex: 1, minWidth: 0 }}>
                                <span style={{
                                  display: "block",
                                  fontSize: "14px",
                                  fontWeight: 500,
                                  color: "var(--ink)",
                                  fontFamily: "var(--sans)",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}>{item.label}</span>
                                {item.description && (
                                  <span style={{
                                    display: "block",
                                    fontSize: "12px",
                                    color: "var(--ink-3)",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}>{item.description}</span>
                                )}
                              </span>
                              {isActive && (
                                <ArrowRight style={{ width: 14, height: 14, color: "var(--green)", flexShrink: 0 }} />
                              )}
                            </a>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div style={{
                  padding: "10px 16px",
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  gap: "16px",
                  fontSize: "11px",
                  color: "var(--ink-3)",
                  fontFamily: "var(--sans)",
                }}>
                  <span><kbd style={kbdStyle}>↑↓</kbd> navigate</span>
                  <span><kbd style={kbdStyle}>↵</kbd> open</span>
                  <span><kbd style={kbdStyle}>esc</kbd> close</span>
                </div>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>,
        document.body,
      ) : null}
    </>
  );
}

const kbdStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 600,
  padding: "1px 5px",
  borderRadius: "3px",
  background: "var(--surface-alt)",
  border: "1px solid var(--border)",
  fontFamily: "var(--mono)",
  marginRight: "3px",
};
