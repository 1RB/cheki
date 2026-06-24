"use client";

import { useReducedMotion, AnimatePresence, motion } from "motion/react";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState, useCallback, useRef } from "react";
import { SPRING_SWAP } from "@/lib/ease";

export function ThemeToggle({ size = 36 }: { size?: number }) {
  const reduce = useReducedMotion();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);
  const [animating, setAnimating] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("cheki-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = (stored as "light" | "dark") || (prefersDark ? "dark" : "light");
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const toggle = useCallback(() => {
    if (animating) return;
    const next = theme === "light" ? "dark" : "light";

    // Circle clip-path reveal from the button position
    if (!reduce && document.startViewTransition) {
      setAnimating(true);
      const transition = document.startViewTransition(() => {
        setTheme(next);
        localStorage.setItem("cheki-theme", next);
        document.documentElement.setAttribute("data-theme", next);
      });
      transition.ready.then(() => {
        const btn = btnRef.current;
        const rect = btn?.getBoundingClientRect();
        const x = rect ? rect.left + rect.width / 2 : window.innerWidth - 40;
        const y = rect ? rect.top + rect.height / 2 : 16;
        const endRadius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y),
        );
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 500,
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      });
      transition.finished.then(() => setAnimating(false));
    } else {
      setTheme(next);
      localStorage.setItem("cheki-theme", next);
      document.documentElement.setAttribute("data-theme", next);
    }
  }, [theme, reduce, animating]);

  if (!mounted) {
    return <div style={{ width: size * 0.44, height: size * 0.44, flexShrink: 0 }} />;
  }

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={toggle}
      disabled={animating}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      style={{
        background: "transparent",
        border: "none",
        cursor: animating ? "wait" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        padding: "4px",
        position: "relative",
        width: "32px",
        height: "32px",
        overflow: "hidden",
      }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={theme}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.3, filter: "blur(8px)" }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.3, filter: "blur(8px)" }}
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
            <Sun style={{ width: size * 0.44, height: size * 0.44, color: "var(--ink-2)" }} />
          ) : (
            <Moon style={{ width: size * 0.44, height: size * 0.44, color: "var(--ink-2)" }} />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
