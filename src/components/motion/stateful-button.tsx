"use client";

import {
  motion,
  AnimatePresence,
  useReducedMotion,
  type Transition,
} from "motion/react";
import { forwardRef, type ReactNode } from "react";
import { SPRING_PRESS, SPRING_SWAP } from "@/lib/ease";

export type StatefulButtonState = "idle" | "loading" | "success" | "error";

export interface StatefulButtonProps {
  /** Current visual state of the button. */
  state?: StatefulButtonState;
  /** Controlled disabled flag (independent of state). */
  disabled?: boolean;
  /** Click handler (fires only when interactive). */
  onClick?: () => void;
  /** Idle-state label. */
  children: ReactNode;
  /** Loading-state label; defaults to "Verifying…". */
  loadingLabel?: ReactNode;
  /** Success-state label; defaults to "Verified". */
  successLabel?: ReactNode;
  /** Error-state label; defaults to "Error". */
  errorLabel?: ReactNode;
  /** Override the primary (idle) background color. Defaults to var(--green-cta). */
  color?: string;
  /** Optional descriptive text id (e.g. why the button is disabled). */
  "aria-describedby"?: string;
  /** Whether the control is flagged invalid. */
  "aria-invalid"?: boolean;
  /** Optional inline style overrides on the outer button. */
  style?: React.CSSProperties;
  /** Optional aria-label fallback. */
  "aria-label"?: string;
  /** Button type attribute. */
  type?: "button" | "submit" | "reset";
}

/* ------------------------------------------------------------------ */
/*  State visuals                                                      */
/* ------------------------------------------------------------------ */

/* Filled buttons are the site's only high-chroma surfaces, so they carry the
   theme-aware tokens: white on --green is 3.29:1 in light mode and 1.83:1 in
   dark mode, so neither theme can share a literal #fff. */
const STATE_BG: Record<StatefulButtonState, string> = {
  idle: "var(--green-cta)",
  loading: "var(--green-cta)",
  success: "var(--green-dark)",
  error: "var(--red-cta)",
};

const STATE_FG: Record<StatefulButtonState, string> = {
  idle: "var(--green-cta-fg)",
  loading: "var(--green-cta-fg)",
  success: "var(--green-cta-fg)",
  error: "var(--red-cta-fg)",
};

/** A small inline spinner used for the loading state. */
function Spinner({ color = "currentColor" }: { color?: string }) {
  return (
    <span
      aria-hidden
      style={{
        width: 16,
        height: 16,
        border: "2px solid",
        borderColor: "color-mix(in srgb, currentColor 35%, transparent)",
        borderTopColor: color,
        borderRadius: "50%",
        display: "inline-block",
        boxSizing: "border-box",
        animation: "spin 0.8s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

/** A simple SVG check used for the success state. */
function Check({ color = "currentColor" }: { color?: string }) {
  return (
    <svg
      aria-hidden
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{ flexShrink: 0, display: "block" }}
    >
      <motion.path
        d="M3.5 8.5l3 3 6-7"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{ pathLength: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 20, mass: 0.6 }}
      />
    </svg>
  );
}

/** A simple SVG cross used for the error state. */
function Cross({ color = "currentColor" }: { color?: string }) {
  return (
    <svg
      aria-hidden
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{ flexShrink: 0, display: "block" }}
    >
      <motion.path
        d="M4 4l8 8M12 4l-8 8"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        initial={false}
        animate={{ pathLength: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 20, mass: 0.6 }}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const pressTransition: Transition = SPRING_PRESS;
const swapTransition: Transition = SPRING_SWAP;

export const StatefulButton = forwardRef<
  HTMLButtonElement,
  StatefulButtonProps
>(function StatefulButton(
  {
    state = "idle",
    disabled = false,
    onClick,
    children,
    loadingLabel = "Verifying…",
    successLabel = "Verified",
    errorLabel = "Error",
    color,
    style,
    type = "button",
    ...rest
  },
  ref,
) {
  const reduce = useReducedMotion();
  const isDisabled = disabled;
  const isInteractive = !isDisabled;

  // Resolve the label/icon per state so AnimatePresence can crossfade.
  const content: ReactNode = (() => {
    switch (state) {
      case "loading":
        return (
          <>
            <Spinner />
            <span>{loadingLabel}</span>
          </>
        );
      case "success":
        return (
          <>
            <Check />
            <span>{successLabel}</span>
          </>
        );
      case "error":
        return (
          <>
            <Cross />
            <span>{errorLabel}</span>
          </>
        );
      default:
        return <span>{children}</span>;
    }
  })();

  const bg = isDisabled ? "var(--border)" : (color ?? STATE_BG[state]);
  const fg = isDisabled ? "var(--ink-2)" : STATE_FG[state];
  const cursor = isDisabled ? "not-allowed" : "pointer";

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={isDisabled}
      onClick={() => isInteractive && onClick?.()}
      whileTap={isInteractive && !reduce ? { scale: 0.96 } : undefined}
      transition={pressTransition}
      aria-label={rest["aria-label"]}
      aria-describedby={rest["aria-describedby"]}
      aria-invalid={rest["aria-invalid"]}
      style={{
        width: "100%",
        padding: "14px 24px",
        fontSize: "15px",
        fontWeight: 600,
        border: "none",
        borderRadius: "8px",
        background: bg,
        color: fg,
        cursor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        minHeight: "48px",
        fontFamily: "var(--sans)",
        WebkitTapHighlightColor: "transparent",
        ...style,
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.96 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.96 }}
          transition={swapTransition}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap",
          }}
        >
          {content}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
});
