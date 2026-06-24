"use client";

import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { SPRING_PRESS, SPRING_SWAP } from "@/lib/ease";

export function ThemeToggle({ size = 36 }: { size?: number }) {
  const reduce = useReducedMotion();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("cheki-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = (stored as "light" | "dark") || (prefersDark ? "dark" : "light");
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("cheki-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  if (!mounted) {
    return (
      <div style={{ width: size, height: size, borderRadius: "999px", flexShrink: 0 }} />
    );
  }

  return (
    <motion.button
      type="button"
      onClick={toggle}
      whileTap={reduce ? undefined : { scale: 0.9 }}
      transition={SPRING_PRESS}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      style={{
        width: size,
        height: size,
        borderRadius: "999px",
        border: "1px solid var(--border)",
        background: "var(--surface)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
      }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={theme}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.5, filter: "blur(8px)" }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.5, filter: "blur(8px)" }}
          transition={SPRING_SWAP}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "absolute",
            inset: 0,
          }}
        >
          {theme === "light" ? (
            <Sun style={{ width: 16, height: 16, color: "var(--ink-2)" }} />
          ) : (
            <Moon style={{ width: 16, height: 16, color: "var(--ink-2)" }} />
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
