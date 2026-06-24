"use client";

import { motion, MotionConfig, useReducedMotion, type Transition } from "motion/react";
import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { EASE_OUT } from "@/lib/ease";

type Variant = "pill" | "underline" | "segment";

type Ctx = {
  value: string;
  setValue: (v: string) => void;
  layoutId: string;
  variant: Variant;
};

const TabsCtx = createContext<Ctx | null>(null);

function useTabs() {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error("Tabs.* must be used inside <Tabs>");
  return ctx;
}

const transition: Transition = {
  type: "spring",
  stiffness: 170,
  damping: 24,
  mass: 1.2,
};

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  variant = "underline",
  children,
  style,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  variant?: Variant;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const layoutId = useId();
  const reduce = useReducedMotion();
  const controlled = value !== undefined;
  const current = controlled ? value : internal;
  const setValue = (v: string) => {
    if (!controlled) setInternal(v);
    onValueChange?.(v);
  };
  return (
    <MotionConfig transition={reduce ? { duration: 0 } : transition}>
      <TabsCtx.Provider value={{ value: current, setValue, layoutId, variant }}>
        <motion.div layoutRoot style={style}>
          {children}
        </motion.div>
      </TabsCtx.Provider>
    </MotionConfig>
  );
}

export function TabsList({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  const { variant } = useTabs();
  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0",
    ...(variant === "underline" ? { borderBottom: "1px solid var(--border)" } : {}),
    ...(variant === "pill" ? { gap: "4px", padding: "4px", borderRadius: "999px", background: "var(--surface-alt)" } : {}),
    ...(variant === "segment" ? { gap: "0", padding: "3px", borderRadius: "10px", background: "var(--surface-alt)" } : {}),
  };
  return (
    <div role="tablist" style={{ ...baseStyle, ...style }}>
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  style,
}: {
  value: string;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  const { value: current, setValue, layoutId, variant } = useTabs();
  const active = current === value;

  if (variant === "underline") {
    return (
      <button
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => setValue(value)}
        style={{
          position: "relative",
          padding: "8px 16px",
          marginBottom: "-1px",
          fontSize: "13px",
          fontWeight: 600,
          minHeight: "44px",
          display: "inline-flex",
          alignItems: "center",
          border: "none",
          borderBottom: active ? "2px solid var(--green)" : "2px solid transparent",
          background: "transparent",
          color: active ? "var(--green)" : "var(--ink-3)",
          cursor: "pointer",
          transition: "color 0.15s, border-color 0.15s",
          ...style,
        }}
      >
        {children}
        {active ? (
          <motion.span
            layoutId={layoutId}
            style={{
              position: "absolute",
              bottom: "-1px",
              left: 0,
              right: 0,
              height: "2px",
              background: "var(--green)",
            }}
          />
        ) : null}
      </button>
    );
  }

  const radius = variant === "pill" ? 9999 : 8;
  return (
    <div style={{ position: "relative" }}>
      {active ? (
        <motion.span
          layoutId={layoutId}
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--green)",
            borderRadius: radius,
          }}
        />
      ) : null}
      <button
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => setValue(value)}
        style={{
          position: "relative",
          zIndex: 10,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          whiteSpace: "nowrap",
          background: "transparent",
          padding: "6px 14px",
          fontSize: "13px",
          fontWeight: 600,
          border: "none",
          borderRadius: radius,
          color: active ? "var(--bg)" : "var(--ink-3)",
          cursor: "pointer",
          transition: "color 0.15s",
          ...style,
        }}
      >
        {children}
      </button>
    </div>
  );
}

export function TabsContent({ value, children, style }: { value: string; children: ReactNode; style?: React.CSSProperties }) {
  const { value: current } = useTabs();
  const reduce = useReducedMotion();
  const active = current === value;
  if (!active) {
    return (
      <div hidden style={style}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      key={value}
      initial={{ opacity: 0, y: reduce ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: EASE_OUT }}
      style={{ marginTop: "16px", ...style }}
    >
      {children}
    </motion.div>
  );
}
