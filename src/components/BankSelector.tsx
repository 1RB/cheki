"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { banks, type Bank } from "@/lib/banks";

interface BankSelectorProps {
  value: string;
  onChange: (code: string) => void;
}

const GROUP_ORDER: { label: string; filter: (b: Bank) => boolean }[] = [
  { label: "Live now", filter: (b) => b.status === "live" },
  { label: "Via eBirr", filter: (b) => ["nib", "wegagen", "ahadu", "kaafi"].includes(b.code) },
  { label: "In development", filter: (b) => b.status === "soon" && !["nib", "wegagen", "ahadu", "kaafi"].includes(b.code) },
];

export function BankSelector({ value, onChange }: BankSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedBank = banks.find((b) => b.code === value);

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

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

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

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Hidden native select for form compatibility */}
      <input type="hidden" value={value} />

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onKeyDown={handleKeyDown}
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{
          width: "100%",
          padding: "12px 16px",
          fontSize: "15px",
          border: `1px solid ${open ? "var(--green)" : "var(--border)"}`,
          borderRadius: open ? "8px 8px 0 0" : "8px",
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
            {selectedBank?.status === "soon" && (
              <span style={{ color: "var(--ink-3)", fontSize: "13px", fontWeight: 400 }}> (in development)</span>
            )}
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
      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "var(--surface)",
            border: "1px solid var(--green)",
            borderTop: "none",
            borderRadius: "0 0 8px 8px",
            zIndex: 50,
            maxHeight: "380px",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          }}
        >
          {/* Search input */}
          <div style={{ padding: "8px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlighted(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search 31 banks..."
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "14px",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                background: "var(--bg)",
                color: "var(--ink)",
                outline: "none",
              }}
            />
          </div>

          {/* Options list */}
          <div ref={listRef} style={{ overflowY: "auto", flex: 1, padding: "4px 0" }}>
            {flatFiltered.length === 0 && (
              <p style={{ padding: "16px", fontSize: "14px", color: "var(--ink-3)", textAlign: "center" }}>
                No banks found for &quot;{query}&quot;
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
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: group.label === "Live now" ? "var(--green)" : "var(--ink-3)",
                      padding: "8px 14px 4px",
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
                            ? "var(--green-light)"
                            : isHighlighted
                              ? "var(--surface-alt)"
                              : "transparent",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "background 0.1s",
                        }}
                      >
                        <span
                          style={{
                            width: "26px",
                            height: "26px",
                            borderRadius: "5px",
                            background: b.color,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: "10px",
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
                          <span
                            style={{
                              display: "block",
                              fontSize: "12px",
                              color: "var(--ink-3)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {b.name}
                          </span>
                        </span>
                        {/* Status indicators */}
                        <span style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                          {b.geoBlocked && (
                            <span
                              title="Geo-blocked (Ethiopian IPs only)"
                              style={{
                                fontSize: "10px",
                                padding: "2px 6px",
                                borderRadius: "3px",
                                background: "#fef3c7",
                                color: "#92400e",
                              }}
                            >
                              ET only
                            </span>
                          )}
                          {b.status === "live" && (
                            <span
                              style={{
                                fontSize: "10px",
                                padding: "2px 6px",
                                borderRadius: "3px",
                                background: "var(--green-light)",
                                color: "var(--green-dark)",
                                fontWeight: 600,
                              }}
                            >
                              Live
                            </span>
                          )}
                        </span>
                        {isSelected && (
                          <svg
                            width="16"
                            height="16"
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

          {/* Footer */}
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
            <span>{filtered.length} of {banks.length} banks</span>
            <span>
              <kbd style={{ fontSize: "10px", padding: "1px 5px", border: "1px solid var(--border)", borderRadius: "3px" }}>↑↓</kbd>{" "}
              navigate{" "}
              <kbd style={{ fontSize: "10px", padding: "1px 5px", border: "1px solid var(--border)", borderRadius: "3px" }}>Enter</kbd>{" "}
              select{" "}
              <kbd style={{ fontSize: "10px", padding: "1px 5px", border: "1px solid var(--border)", borderRadius: "3px" }}>Esc</kbd>{" "}
              close
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
