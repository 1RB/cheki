"use client";

import { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { banks, type Bank } from "@/lib/banks";
import { SPRING_PANEL } from "@/lib/ease";

interface BankSelectorProps {
  value: string;
  onChange: (code: string) => void;
}

const GROUP_ORDER: { label: string; filter: (b: Bank) => boolean }[] = [
  { label: "Live", filter: (b) => b.status === "live" },
  { label: "Via eBirr", filter: (b) => ["nib", "wegagen", "ahadu", "kaafi"].includes(b.code) },
  { label: "Researching", filter: (b) => b.status === "soon" && !["nib", "wegagen", "ahadu", "kaafi"].includes(b.code) },
];

export function BankSelector({ value, onChange }: BankSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [panelRect, setPanelRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const reduce = useReducedMotion();

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedBank = banks.find((b) => b.code === value);

  useEffect(() => {
    setMounted(true);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return banks;
    const q = query.toLowerCase();
    return banks.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.shortName.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q)
    );
  }, [query]);

  const flatFiltered = useMemo(() => {
    return GROUP_ORDER.flatMap((g) => filtered.filter(g.filter));
  }, [filtered]);

  const handleSelect = useCallback(
    (code: string) => {
      onChange(code);
      setOpen(false);
      setQuery("");
      setHighlighted(0);
    },
    [onChange]
  );

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPanelRect({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      const panel = document.querySelector("[data-bank-selector-panel]");
      if (panel?.contains(target)) return;
      setOpen(false);
      setQuery("");
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Update position on open, scroll, resize
  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, updatePosition]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, flatFiltered.length - 1));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
      return;
    }

    if (e.key === "Enter" && flatFiltered[highlighted]) {
      e.preventDefault();
      handleSelect(flatFiltered[highlighted].code);
      return;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${highlighted}"]`);
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [highlighted, open]);

  const maxPanelHeight = panelRect ? Math.min(400, window.innerHeight - panelRect.top - 8) : 400;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input type="hidden" value={value} />

      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
            setQuery("");
          } else {
            setOpen(true);
          }
        }}
        onKeyDown={handleKeyDown}
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{
          width: "100%",
          padding: "12px 16px",
          fontSize: "15px",
          border: `1px solid ${open ? "var(--border-strong)" : "var(--border)"}`,
          borderRadius: "10px",
          background: "var(--surface)",
          color: "var(--ink)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          textAlign: "left",
          transition: "border-color 0.15s",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, overflow: "hidden" }}>
          {selectedBank && (
            <span
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                background: selectedBank.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: "11px",
                flexShrink: 0,
              }}
            >
              {selectedBank.shortName.slice(0, 3)}
            </span>
          )}
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontWeight: 500,
            }}
          >
            {selectedBank?.name || "Select a bank..."}
          </span>
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            flexShrink: 0,
            color: "var(--ink-3)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && mounted && panelRect && createPortal(
        <AnimatePresence>
          <motion.div
            data-bank-selector-panel
            role="listbox"
            onClick={(e) => e.stopPropagation()}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            transition={SPRING_PANEL}
            style={{
              position: "fixed",
              top: `${panelRect.top}px`,
              left: `${panelRect.left}px`,
              width: `${panelRect.width}px`,
              background: "var(--surface)",
              border: "1px solid var(--border-strong)",
              borderRadius: "10px",
              zIndex: 99999,
              maxHeight: `${maxPanelHeight}px`,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 12px 32px rgba(0,0,0,0.08), 0 0 0 1px var(--border)",
              overflow: "hidden",
              transformOrigin: "top",
            }}
          >
            {/* Search */}
            <div style={{ padding: "10px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlighted(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search banks..."
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: "14px",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  background: "var(--bg)",
                  color: "var(--ink)",
                  outline: "none",
                }}
              />
            </div>

            {/* List */}
            <div ref={listRef} style={{ overflowY: "auto", flex: 1, padding: "4px 0" }}>
              {flatFiltered.length === 0 && (
                <p style={{ padding: "20px", fontSize: "14px", color: "var(--ink-3)", textAlign: "center" }}>
                  No banks found
                </p>
              )}

              {GROUP_ORDER.map((group) => {
                const groupBanks = filtered.filter(group.filter);
                if (groupBanks.length === 0) return null;

                return (
                  <div key={group.label}>
                    <p
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "var(--ink-3)",
                        padding: "10px 14px 6px",
                      }}
                    >
                      {group.label}
                    </p>
                    {groupBanks.map((b) => {
                      const flatIdx = flatFiltered.indexOf(b);
                      const isSelected = b.code === value;
                      const isHighlighted = flatIdx === highlighted;

                      return (
                        <button
                          key={b.code}
                          type="button"
                          data-idx={flatIdx}
                          onClick={() => handleSelect(b.code)}
                          onMouseEnter={() => setHighlighted(flatIdx)}
                          style={{
                            width: "100%",
                            padding: "8px 14px",
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            border: "none",
                            background: isSelected
                              ? "var(--surface-alt)"
                              : isHighlighted
                                ? "var(--surface-alt)"
                                : "transparent",
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "background 0.08s",
                          }}
                        >
                          <span
                            style={{
                              width: "24px",
                              height: "24px",
                              borderRadius: "5px",
                              background: b.color,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: "9px",
                              flexShrink: 0,
                            }}
                          >
                            {b.shortName.slice(0, 3)}
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span
                              style={{
                                display: "block",
                                fontSize: "14px",
                                fontWeight: isSelected ? 600 : 500,
                                color: "var(--ink)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {b.shortName}
                            </span>
                          </span>
                          {/* Minimal status: just a dot */}
                          <span
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              background: b.status === "live" ? "var(--green)" : "var(--ink-3)",
                              flexShrink: 0,
                              opacity: isSelected ? 1 : 0.5,
                            }}
                          />
                          {isSelected && (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="var(--green)"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{ flexShrink: 0 }}
                            >
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Minimal footer */}
            <div
              style={{
                padding: "8px 14px",
                borderTop: "1px solid var(--border)",
                fontSize: "12px",
                color: "var(--ink-3)",
                display: "flex",
                justifyContent: "space-between",
                flexShrink: 0,
              }}
            >
              <span>{filtered.length} banks</span>
              <span style={{ display: "flex", gap: "8px" }}>
                <kbd style={{ fontSize: "10px", padding: "1px 5px", border: "1px solid var(--border)", borderRadius: "4px" }}>↑↓</kbd>
                <kbd style={{ fontSize: "10px", padding: "1px 5px", border: "1px solid var(--border)", borderRadius: "4px" }}>↵</kbd>
                <kbd style={{ fontSize: "10px", padding: "1px 5px", border: "1px solid var(--border)", borderRadius: "4px" }}>esc</kbd>
              </span>
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
