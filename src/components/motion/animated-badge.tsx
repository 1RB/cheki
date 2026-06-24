"use client";

import {
  AlertTriangle,
  Check,
  Circle,
  Info,
  LoaderCircle,
  X,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react";
import type { ReactNode } from "react";
import { EASE_OUT } from "@/lib/ease";

export type BadgeStatus = "neutral" | "info" | "success" | "warning" | "danger" | "loading";
export type BadgeSize = "sm" | "md";

const STATUS_STYLE: Record<BadgeStatus, React.CSSProperties> = {
  neutral: { borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink-3)" },
  info: { borderColor: "rgba(22,163,74,0.3)", background: "var(--green-light)", color: "var(--green-dark)" },
  success: { borderColor: "rgba(22,163,74,0.3)", background: "var(--green-light)", color: "var(--green-dark)" },
  warning: { borderColor: "rgba(245,158,11,0.3)", background: "var(--amber-light)", color: "#92400e" },
  danger: { borderColor: "rgba(220,38,38,0.3)", background: "var(--red-light)", color: "var(--red)" },
  loading: { borderColor: "rgba(22,163,74,0.3)", background: "var(--green-light)", color: "var(--green-dark)" },
};

const SIZE_STYLE: Record<BadgeSize, React.CSSProperties> = {
  sm: { height: "22px", gap: "5px", padding: "0 8px", fontSize: "10px" },
  md: { height: "28px", gap: "6px", padding: "0 10px", fontSize: "11px" },
};

const ICONS: Record<BadgeStatus, typeof Circle> = {
  neutral: Circle,
  info: Info,
  success: Check,
  warning: AlertTriangle,
  danger: X,
  loading: LoaderCircle,
};

const ICON_SIZE: Record<BadgeSize, number> = { sm: 11, md: 13 };

const ICON_ROLL: Variants = {
  initial: { opacity: 0.72, y: "80%", scale: 0.92, rotate: -8, filter: "blur(6px)" },
  animate: {
    opacity: 1, y: "0%", scale: 1, rotate: 0, filter: "blur(0px)",
    transition: {
      y: { type: "spring", stiffness: 210, damping: 24, mass: 0.85 },
      scale: { type: "spring", stiffness: 250, damping: 24, mass: 0.75 },
      rotate: { duration: 0.28, ease: EASE_OUT },
      opacity: { duration: 0.28, ease: EASE_OUT },
      filter: { duration: 0.42, ease: EASE_OUT },
    },
  },
  exit: {
    opacity: 0.5, y: "-80%", scale: 0.96, rotate: 8, filter: "blur(6px)",
    transition: { duration: 0.22, ease: EASE_OUT },
  },
};

const TEXT_ROLL: Variants = {
  initial: { opacity: 0.76, y: "85%", filter: "blur(6px)" },
  animate: {
    opacity: 1, y: "0%", filter: "blur(0px)",
    transition: {
      y: { type: "spring", stiffness: 210, damping: 24, mass: 0.85 },
      opacity: { duration: 0.3, ease: EASE_OUT },
      filter: { duration: 0.42, ease: EASE_OUT },
    },
  },
  exit: {
    opacity: 0.5, y: "-85%", filter: "blur(6px)",
    transition: { duration: 0.2, ease: EASE_OUT },
  },
};

export function AnimatedBadge({
  status = "neutral",
  size = "md",
  children,
  showIcon = true,
  pulse = status === "loading",
  contentKey,
  style,
}: {
  status?: BadgeStatus;
  size?: BadgeSize;
  children?: ReactNode;
  showIcon?: boolean;
  pulse?: boolean;
  contentKey?: string | number;
  style?: React.CSSProperties;
}) {
  const reduce = useReducedMotion();
  const Icon = ICONS[status];
  const resolvedKey = contentKey ?? (typeof children === "string" ? children : status);

  return (
    <motion.span
      layout
      transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.7 }}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        flexShrink: 0,
        overflow: "hidden",
        whiteSpace: "nowrap",
        borderRadius: "999px",
        border: "1px solid",
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        fontFamily: "var(--sans)",
        ...STATUS_STYLE[status],
        ...SIZE_STYLE[size],
        ...style,
      }}
    >
      {pulse && !reduce ? (
        <motion.span
          aria-hidden
          style={{ position: "absolute", inset: 0, borderRadius: "999px", background: "currentColor", opacity: 0.08 }}
          animate={{ scale: [0.94, 1.08, 0.94], opacity: [0.06, 0.14, 0.06] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}

      {showIcon ? (
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={status}
            variants={reduce ? undefined : ICON_ROLL}
            initial={reduce ? { opacity: 0 } : "initial"}
            animate={reduce ? { opacity: 1 } : "animate"}
            exit={reduce ? { opacity: 0 } : "exit"}
            style={{ display: "inline-flex", position: "relative", zIndex: 1 }}
          >
            {status === "loading" ? (
              <span style={{ display: "inline-flex", animation: "spin 0.8s linear infinite" }}>
                <Icon style={{ width: ICON_SIZE[size], height: ICON_SIZE[size] }} />
              </span>
            ) : (
              <Icon style={{ width: ICON_SIZE[size], height: ICON_SIZE[size] }} />
            )}
          </motion.span>
        </AnimatePresence>
      ) : null}

      {children ? (
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={resolvedKey}
            variants={reduce ? undefined : TEXT_ROLL}
            initial={reduce ? { opacity: 0 } : "initial"}
            animate={reduce ? { opacity: 1 } : "animate"}
            exit={reduce ? { opacity: 0 } : "exit"}
            style={{ position: "relative", zIndex: 1 }}
          >
            {children}
          </motion.span>
        </AnimatePresence>
      ) : null}
    </motion.span>
  );
}
