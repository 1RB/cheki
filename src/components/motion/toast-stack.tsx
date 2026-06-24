"use client";

import {
  AlertCircle,
  Bell,
  Check,
  Info,
  LoaderCircle,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from "motion/react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { EASE_OUT } from "@/lib/ease";

/* ──────────────────────────────────────────────────────────────
   Toast stack — adapted from beUI source, rewritten to use
   cheki's CSS variables and inline styles (no tailwind utilities).
   Animation logic preserved: spring entrance, drag-to-dismiss,
   AnimatePresence, status morph.
   ────────────────────────────────────────────────────────────── */

export type ToastStatus = "neutral" | "info" | "loading" | "success" | "error";
export type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type ToastAction = {
  label: ReactNode;
  onClick: (toast: ToastData) => void;
};

export type ToastData = {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  status?: ToastStatus;
  icon?: ReactNode;
  action?: ToastAction;
  duration?: number;
  dismissible?: boolean;
  createdAt?: number;
};

export type ToastInput = Omit<ToastData, "id" | "createdAt"> & {
  id?: string;
};

export interface ToastStackProps {
  toasts: ToastData[];
  onDismiss?: (id: string) => void;
  position?: ToastPosition;
  placement?: "static" | "fixed" | "absolute";
  fixed?: boolean;
  portal?: boolean;
  portalRoot?: Element | null;
  maxVisible?: number;
  style?: CSSProperties;
  icons?: Partial<Record<ToastStatus, ReactNode>>;
  renderToast?: (toast: ToastData) => ReactNode;
}

export interface UseToastStackOptions {
  initialToasts?: ToastInput[];
  defaultDuration?: number;
  limit?: number;
}

/* ── Motion tokens ─────────────────────────────────────────── */

const STACK_SPRING: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.75,
};

const CONTENT_TRANSITION = {
  duration: 0.28,
  ease: EASE_OUT,
} as const;

/* ── Status → icon + accent color ──────────────────────────── */

const STATUS_ICON: Record<ToastStatus, LucideIcon> = {
  neutral: Bell,
  info: Info,
  loading: LoaderCircle,
  success: Check,
  error: AlertCircle,
};

/** Foreground icon color per status, using cheki CSS vars. */
const STATUS_FG: Record<ToastStatus, string> = {
  neutral: "var(--ink-2)",
  info: "var(--ink)",
  loading: "var(--ink)",
  success: "var(--green)",
  error: "var(--red)",
};

/** Soft circular background behind the icon. */
const STATUS_BG: Record<ToastStatus, string> = {
  neutral: "var(--surface-alt)",
  info: "var(--surface-alt)",
  loading: "var(--surface-alt)",
  success: "var(--green-light)",
  error: "var(--red-light)",
};

/* ── Position → inline style fragments ─────────────────────── */

const POSITION_STYLE: Record<ToastPosition, CSSProperties> = {
  "top-left": { top: 16, left: 16 },
  "top-center": { top: 16, left: "50%", transform: "translateX(-50%)" },
  "top-right": { top: 16, right: 16 },
  "bottom-left": { bottom: 24, left: 16 },
  "bottom-center": { bottom: 24, left: "50%", transform: "translateX(-50%)" },
  "bottom-right": { bottom: 24, right: 16 },
};

/* ── Inline style objects ──────────────────────────────────── */

const iconBase: CSSProperties = {
  width: 14,
  height: 14,
};

const iconWrapBase: CSSProperties = {
  marginTop: 2,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  minWidth: 28,
  minHeight: 28,
  borderRadius: "9999px",
  flexShrink: 0,
};

const contentBase: CSSProperties = {
  minWidth: 0,
  flex: 1,
};

const titleBase: CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 500,
  lineHeight: "20px",
  color: "var(--ink)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const descriptionBase: CSSProperties = {
  margin: 0,
  marginTop: 2,
  fontSize: 12,
  lineHeight: "16px",
  color: "var(--ink-3)",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const actionBase: CSSProperties = {
  marginTop: 8,
  display: "inline-flex",
  height: 28,
  alignItems: "center",
  borderRadius: "9999px",
  paddingInline: 12,
  fontSize: 12,
  fontWeight: 500,
  color: "var(--ink)",
  background: "var(--surface-alt)",
  border: "none",
  cursor: "pointer",
};

const closeBase: CSSProperties = {
  display: "inline-flex",
  width: 28,
  height: 28,
  minWidth: 28,
  minHeight: 28,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "9999px",
  color: "var(--ink-3)",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  flexShrink: 0,
};

const surfaceBase: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  borderRadius: 16,
  border: "1px solid var(--border)",
  background: "color-mix(in srgb, var(--surface) 95%, transparent)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  padding: 12,
  boxShadow:
    "0 12px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)",
};

const rowBase: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
};

/* ── Helpers ───────────────────────────────────────────────── */

let idSeed = 0;

function createToast(input: ToastInput, defaultDuration: number): ToastData {
  return {
    duration: defaultDuration,
    dismissible: true,
    ...input,
    id: input.id ?? `toast-${Date.now()}-${idSeed++}`,
    createdAt: Date.now(),
  };
}

/* ── Hook ──────────────────────────────────────────────────── */

export function useToastStack({
  initialToasts = [],
  defaultDuration = 4200,
  limit,
}: UseToastStackOptions = {}) {
  const toastTimers = useRef<Map<string, { timer: number; signature: string }>>(
    new Map(),
  );
  const [toasts, setToasts] = useState<ToastData[]>(() =>
    initialToasts.map((toast) => createToast(toast, defaultDuration)),
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const showToast = useCallback(
    (input: ToastInput) => {
      const toast = createToast(input, defaultDuration);
      setToasts((current) => {
        const next = [...current, toast];
        return typeof limit === "number" ? next.slice(-limit) : next;
      });
      return toast.id;
    },
    [defaultDuration, limit],
  );

  const updateToast = useCallback((id: string, patch: Partial<ToastInput>) => {
    setToasts((current) =>
      current.map((toast) =>
        toast.id === id
          ? {
              ...toast,
              ...patch,
              id,
              createdAt:
                patch.duration === undefined ? toast.createdAt : Date.now(),
            }
          : toast,
      ),
    );
  }, []);

  useEffect(() => {
    const activeIds = new Set(toasts.map((toast) => toast.id));

    toastTimers.current.forEach((entry, id) => {
      if (!activeIds.has(id)) {
        window.clearTimeout(entry.timer);
        toastTimers.current.delete(id);
      }
    });

    toasts.forEach((toast) => {
      const duration = toast.duration ?? defaultDuration;
      const existing = toastTimers.current.get(toast.id);

      if (duration <= 0) {
        if (existing) {
          window.clearTimeout(existing.timer);
          toastTimers.current.delete(toast.id);
        }
        return;
      }

      const createdAt = toast.createdAt ?? Date.now();
      const signature = `${createdAt}:${duration}`;

      if (existing?.signature === signature) {
        return;
      }

      if (existing) {
        window.clearTimeout(existing.timer);
      }

      const elapsed = Date.now() - createdAt;
      const remaining = Math.max(duration - elapsed, 0);
      const timer = window.setTimeout(() => {
        toastTimers.current.delete(toast.id);
        dismissToast(toast.id);
      }, remaining);

      toastTimers.current.set(toast.id, { timer, signature });
    });
  }, [defaultDuration, dismissToast, toasts]);

  useEffect(() => {
    const timers = toastTimers.current;

    return () => {
      timers.forEach((entry) => {
        window.clearTimeout(entry.timer);
      });
      timers.clear();
    };
  }, []);

  return useMemo(
    () => ({
      toasts,
      showToast,
      updateToast,
      dismissToast,
      clearToasts,
    }),
    [clearToasts, dismissToast, showToast, toasts, updateToast],
  );
}

/* ── ToastStack component ──────────────────────────────────── */

export function ToastStack({
  toasts,
  onDismiss,
  position = "bottom-right",
  placement,
  fixed = false,
  portal,
  portalRoot,
  maxVisible = 4,
  style,
  icons,
  renderToast,
}: ToastStackProps) {
  const [mounted, setMounted] = useState(false);
  const visibleToasts = toasts.slice(-maxVisible);
  const isBottom = position.startsWith("bottom");
  const resolvedPlacement = placement ?? (fixed ? "fixed" : "static");
  const shouldPortal = portal ?? resolvedPlacement === "fixed";

  useEffect(() => {
    setMounted(true);
  }, []);

  const stackStyle: CSSProperties = {
    pointerEvents: "none",
    display: "flex",
    flexDirection: isBottom ? "column-reverse" : "column",
    gap: 8,
    width: "min(calc(100vw - 2rem), 24rem)",
    listStyle: "none",
    margin: 0,
    padding: 0,
    ...(resolvedPlacement !== "static" ? POSITION_STYLE[position] : {}),
    ...(resolvedPlacement === "fixed" ? { position: "fixed", zIndex: 90 } : {}),
    ...(resolvedPlacement === "absolute"
      ? { position: "absolute", zIndex: 20 }
      : {}),
    ...style,
  };

  const stack = (
    <ol aria-live="polite" aria-atomic="false" style={stackStyle}>
      <AnimatePresence initial={false} mode="popLayout">
        {visibleToasts.map((toast, index) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            index={index}
            onDismiss={onDismiss}
            icons={icons}
            renderToast={renderToast}
          />
        ))}
      </AnimatePresence>
    </ol>
  );

  if (shouldPortal && !mounted) {
    return null;
  }

  if (shouldPortal) {
    return createPortal(stack, portalRoot ?? document.body);
  }

  return stack;
}

/* ── ToastItem (internal) ──────────────────────────────────── */

const ToastItem = memo(function ToastItem({
  toast,
  index,
  onDismiss,
  icons,
  renderToast,
}: {
  toast: ToastData;
  index: number;
  onDismiss?: (id: string) => void;
  icons?: Partial<Record<ToastStatus, ReactNode>>;
  renderToast?: (toast: ToastData) => ReactNode;
}) {
  const reduce = useReducedMotion();
  const status = toast.status ?? "neutral";
  const Icon = STATUS_ICON[status];
  const iconNode =
    icons?.[status] ?? toast.icon ?? <Icon style={iconBase} />;
  const canDismiss = toast.dismissible !== false && Boolean(onDismiss);

  const iconWrapStyle: CSSProperties = {
    ...iconWrapBase,
    background: STATUS_BG[status],
    color: STATUS_FG[status],
  };

  return (
    <motion.li
      layout
      initial={
        reduce
          ? { opacity: 0 }
          : { opacity: 0, y: 22, scale: 0.96, filter: "blur(10px)" }
      }
      animate={
        reduce
          ? { opacity: 1 }
          : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
      }
      exit={
        reduce
          ? { opacity: 0 }
          : {
              opacity: 0,
              x: 32,
              scale: 0.96,
              filter: "blur(8px)",
              transition: { duration: 0.18, ease: EASE_OUT },
            }
      }
      transition={STACK_SPRING}
      drag={canDismiss && !reduce ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.18}
      onDragEnd={(_, info) => {
        if (!canDismiss || !onDismiss) return;
        if (Math.abs(info.offset.x) > 72 || Math.abs(info.velocity.x) > 520) {
          onDismiss(toast.id);
        }
      }}
      style={{
        pointerEvents: "auto",
        position: "relative",
        willChange: "transform",
        zIndex: 20 - index,
        listStyle: "none",
      }}
    >
      <div style={surfaceBase}>
        {renderToast ? (
          renderToast(toast)
        ) : (
          <div style={rowBase}>
            {/* Icon with status morph */}
            <motion.span layout style={iconWrapStyle}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={status}
                  initial={
                    reduce
                      ? { opacity: 0 }
                      : { opacity: 0, y: 8, scale: 0.8, filter: "blur(6px)" }
                  }
                  animate={
                    reduce
                      ? { opacity: 1 }
                      : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
                  }
                  exit={
                    reduce
                      ? { opacity: 0 }
                      : { opacity: 0, y: -8, scale: 0.9, filter: "blur(6px)" }
                  }
                  transition={CONTENT_TRANSITION}
                  style={{ display: "inline-flex" }}
                >
                  {status === "loading" ? (
                    <span
                      style={{
                        display: "inline-flex",
                        animation: "spin 1s linear infinite",
                      }}
                    >
                      {iconNode}
                    </span>
                  ) : (
                    iconNode
                  )}
                </motion.span>
              </AnimatePresence>
            </motion.span>

            {/* Content with title/description morph */}
            <div style={contentBase}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={`${toast.id}-${status}-${String(toast.title)}`}
                  initial={
                    reduce
                      ? { opacity: 0 }
                      : { opacity: 0, y: 8, filter: "blur(6px)" }
                  }
                  animate={
                    reduce
                      ? { opacity: 1 }
                      : { opacity: 1, y: 0, filter: "blur(0px)" }
                  }
                  exit={
                    reduce
                      ? { opacity: 0 }
                      : { opacity: 0, y: -8, filter: "blur(6px)" }
                  }
                  transition={CONTENT_TRANSITION}
                >
                  <p style={titleBase}>{toast.title}</p>
                  {toast.description ? (
                    <p style={descriptionBase}>{toast.description}</p>
                  ) : null}
                </motion.div>
              </AnimatePresence>

              {toast.action ? (
                <button
                  type="button"
                  onClick={() => toast.action?.onClick(toast)}
                  style={actionBase}
                >
                  {toast.action.label}
                </button>
              ) : null}
            </div>

            {/* Dismiss button */}
            {canDismiss ? (
              <button
                type="button"
                onClick={() => onDismiss?.(toast.id)}
                aria-label="Dismiss toast"
                style={closeBase}
              >
                <X style={iconBase} />
              </button>
            ) : null}
          </div>
        )}
      </div>
    </motion.li>
  );
});
