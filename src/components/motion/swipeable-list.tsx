"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type PanInfo,
} from "motion/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/* ──────────────────────────────────────────────────────────────
   SwipeableList — adapted from beUI source, rewritten to use
   cheki's CSS variables and inline styles (no tailwind utilities).
   Motion logic preserved: drag-x to reveal action buttons, spring
   snap-back, velocity + threshold-based open/close, fling support,
   controlled/uncontrolled open-state.
   ────────────────────────────────────────────────────────────── */

export type SwipeSide = "left" | "right";

export type SwipeableListValue = {
  id: string;
  side: SwipeSide;
};

/** Tone maps to cheki CSS variables for action icon + circle bg. */
export type SwipeActionTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger";

export type SwipeAction = {
  id: string;
  label: ReactNode;
  icon: ReactNode;
  tone?: SwipeActionTone;
  disabled?: boolean;
  onClick?: (item: SwipeableListItemData) => void;
};

/**
 * Public data shape for a list item. Renamed from the beUI
 * `SwipeableListItem` (which collided with the component type) to
 * `SwipeableListItemData`. The React component is exported as
 * `SwipeableListItem`.
 */
export type SwipeableListItemData = {
  id: string;
  title?: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  leading?: ReactNode;
  content?: ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  disabled?: boolean;
};

/* ── Motion tuning (preserved from beUI) ──────────────────────── */

const ROW_SETTLE = {
  type: "spring",
  stiffness: 560,
  damping: 48,
  mass: 0.82,
  restDelta: 0.5,
  restSpeed: 8,
} as const;

const OPEN_DISTANCE_RATIO = 0.46;
const CLOSE_DISTANCE_RATIO = 0.72;
const OPEN_VELOCITY = 720;
const CLOSE_VELOCITY = 320;
const FLING_DISTANCE = 14;
const RELEASE_VELOCITY_LIMIT = 1500;

/* ── Tone → cheki CSS var colors ──────────────────────────────── */

const ACTION_TONE_FG: Record<SwipeActionTone, string> = {
  neutral: "var(--ink-2)",
  primary: "var(--ink)",
  success: "var(--green)",
  warning: "var(--amber)",
  danger: "var(--red)",
};

const ACTION_TONE_BG: Record<SwipeActionTone, string> = {
  neutral: "var(--surface-alt)",
  primary: "var(--surface-alt)",
  success: "var(--green-light)",
  warning: "var(--amber-light)",
  danger: "var(--red-light)",
};

/* ── Inline style objects ─────────────────────────────────────── */

const rootStyle: CSSProperties = {
  display: "flex",
  width: "100%",
  flexDirection: "column",
  gap: 8,
};

const rowStyle: CSSProperties = {
  position: "relative",
  isolation: "isolate",
  overflow: "hidden",
  borderRadius: 12,
  background: "var(--surface-alt)",
};

const railStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 0,
  display: "flex",
  overflow: "hidden",
  borderRadius: 12,
};

const railSideStyle: CSSProperties = {
  display: "flex",
  height: "100%",
  overflow: "hidden",
};

const actionButtonStyle: CSSProperties = {
  display: "flex",
  height: "100%",
  flexShrink: 0,
  alignItems: "center",
  justifyContent: "center",
  outline: "none",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: 0,
};

const actionIconWrapBase: CSSProperties = {
  display: "grid",
  width: 36,
  height: 36,
  placeItems: "center",
  borderRadius: "9999px",
  transition:
    "background-color 150ms ease, color 150ms ease, transform 150ms ease",
};

const surfaceBase: CSSProperties = {
  position: "relative",
  zIndex: 10,
  minHeight: 72,
  cursor: "grab",
  touchAction: "pan-y",
  userSelect: "none",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  paddingInline: 16,
  paddingBlock: 12,
  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
};

const contentRowStyle: CSSProperties = {
  display: "flex",
  minWidth: 0,
  alignItems: "center",
  gap: 12,
};

const leadingStyle: CSSProperties = {
  flexShrink: 0,
};

const contentColStyle: CSSProperties = {
  minWidth: 0,
  flex: 1,
};

const titleStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 14,
  fontWeight: 500,
  color: "var(--ink)",
};

const descriptionStyle: CSSProperties = {
  marginTop: 2,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 12,
  color: "var(--ink-3)",
};

const metaStyle: CSSProperties = {
  flexShrink: 0,
  fontSize: 12,
  fontWeight: 500,
  color: "var(--ink-3)",
};

const srOnlyStyle: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0,
};

/* ── Helpers (preserved) ──────────────────────────────────────── */

function useControllableSwipeValue({
  value,
  defaultValue,
  onValueChange,
}: {
  value?: SwipeableListValue | null;
  defaultValue?: SwipeableListValue | null;
  onValueChange?: (value: SwipeableListValue | null) => void;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? null);
  const isControlled = value !== undefined;
  const currentValue = value ?? internalValue;

  const setValue = useCallback(
    (next: SwipeableListValue | null) => {
      if (!isControlled) {
        setInternalValue(next);
      }
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  return [currentValue, setValue] as const;
}

function isActionableSide(value: number, sideWidth: number) {
  return sideWidth > 0 && Math.abs(value) > 0;
}

function clampReleaseVelocity(velocity: number) {
  return Math.max(
    -RELEASE_VELOCITY_LIMIT,
    Math.min(RELEASE_VELOCITY_LIMIT, velocity),
  );
}

/* ── Action button ────────────────────────────────────────────── */

function SwipeActionButton({
  action,
  actionWidth,
  side,
  focusable,
  onAction,
}: {
  action: SwipeAction;
  actionWidth: number;
  side: SwipeSide;
  focusable: boolean;
  onAction: (action: SwipeAction, side: SwipeSide) => void;
}) {
  const tone = action.tone ?? "neutral";

  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const iconWrapStyle: CSSProperties = {
    ...actionIconWrapBase,
    color: ACTION_TONE_FG[tone],
    background: hovered ? ACTION_TONE_BG[tone] : "transparent",
    transform: pressed ? "scale(0.95)" : "scale(1)",
  };

  return (
    <button
      type="button"
      disabled={action.disabled}
      tabIndex={focusable ? 0 : -1}
      aria-label={typeof action.label === "string" ? action.label : undefined}
      onClick={() => onAction(action, side)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        ...actionButtonStyle,
        width: actionWidth,
        opacity: action.disabled ? 0.5 : 1,
        pointerEvents: action.disabled ? "none" : "auto",
      }}
    >
      <span style={iconWrapStyle}>{action.icon}</span>
      <span style={srOnlyStyle}>{action.label}</span>
    </button>
  );
}

/* ── Row (internal) ───────────────────────────────────────────── */

function SwipeableListRow({
  item,
  actionWidth,
  revealThreshold,
  openValue,
  setOpenValue,
  closeOnAction,
  onAction,
  onClick,
  renderItem,
}: {
  item: SwipeableListItemData;
  actionWidth: number;
  revealThreshold: number;
  openValue: SwipeableListValue | null;
  setOpenValue: (value: SwipeableListValue | null) => void;
  closeOnAction: boolean;
  onAction?: SwipeableListProps["onAction"];
  onClick?: (item: SwipeableListItemData) => void;
  renderItem?: (item: SwipeableListItemData) => ReactNode;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const animationRef = useRef<{ stop: () => void } | null>(null);
  const commandedTargetRef = useRef(0);
  const leftActions = item.leftActions ?? [];
  const rightActions = item.rightActions ?? [];
  const leftWidth = leftActions.length * actionWidth;
  const rightWidth = rightActions.length * actionWidth;
  const openSide = openValue?.id === item.id ? openValue.side : null;
  const targetX =
    openSide === "left" ? leftWidth : openSide === "right" ? -rightWidth : 0;

  const settleX = useCallback(
    (nextX: number, velocity = 0) => {
      commandedTargetRef.current = nextX;
      animationRef.current?.stop();

      if (reduce) {
        x.set(nextX);
        return;
      }

      animationRef.current = animate(x, nextX, {
        ...ROW_SETTLE,
        velocity: clampReleaseVelocity(velocity),
        onComplete: () => x.set(nextX),
      });
    },
    [reduce, x],
  );

  useEffect(() => {
    return () => animationRef.current?.stop();
  }, []);

  useEffect(() => {
    if (commandedTargetRef.current === targetX) {
      return;
    }
    settleX(targetX);
  }, [settleX, targetX]);

  const getTargetX = useCallback(
    (side: SwipeSide | null) =>
      side === "left" ? leftWidth : side === "right" ? -rightWidth : 0,
    [leftWidth, rightWidth],
  );

  const snapTo = useCallback(
    (side: SwipeSide | null, velocity = 0) => {
      setOpenValue(side ? { id: item.id, side } : null);
      settleX(getTargetX(side), velocity);
    },
    [getTargetX, item.id, setOpenValue, settleX],
  );

  const onDragStart = useCallback(() => {
    animationRef.current?.stop();
    if (openValue && openValue.id !== item.id) {
      setOpenValue(null);
    }
  }, [item.id, openValue, setOpenValue]);

  const onDragEnd = useCallback(
    (_: PointerEvent, info: PanInfo) => {
      const velocity = info.velocity.x;
      const latest = x.get();
      const leftOpenThreshold = Math.max(
        revealThreshold,
        leftWidth * OPEN_DISTANCE_RATIO,
      );
      const rightOpenThreshold = Math.max(
        revealThreshold,
        rightWidth * OPEN_DISTANCE_RATIO,
      );

      if (openSide === "left") {
        if (
          latest < leftWidth * CLOSE_DISTANCE_RATIO ||
          velocity < -CLOSE_VELOCITY
        ) {
          snapTo(null, velocity);
          return;
        }
        snapTo("left", velocity);
        return;
      }

      if (openSide === "right") {
        if (
          Math.abs(latest) < rightWidth * CLOSE_DISTANCE_RATIO ||
          velocity > CLOSE_VELOCITY
        ) {
          snapTo(null, velocity);
          return;
        }
        snapTo("right", velocity);
        return;
      }

      if (
        isActionableSide(latest, leftWidth) &&
        (latest > leftOpenThreshold ||
          (velocity > OPEN_VELOCITY && latest > FLING_DISTANCE))
      ) {
        snapTo("left", velocity);
        return;
      }

      if (
        isActionableSide(latest, rightWidth) &&
        (latest < -rightOpenThreshold ||
          (velocity < -OPEN_VELOCITY && latest < -FLING_DISTANCE))
      ) {
        snapTo("right", velocity);
        return;
      }

      snapTo(null, velocity);
    },
    [leftWidth, openSide, revealThreshold, rightWidth, snapTo, x],
  );

  const handleAction = useCallback(
    (action: SwipeAction, side: SwipeSide) => {
      action.onClick?.(item);
      onAction?.({ item, action, side });
      if (closeOnAction) {
        snapTo(null);
      }
    },
    [closeOnAction, item, onAction, snapTo],
  );

  /* Distinguish a tap from a drag for the onClick handler. */
  const dragMovedRef = useRef(false);

  const handleSurfaceClick = useCallback(() => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    if (item.disabled) return;
    onClick?.(item);
  }, [item, onClick]);

  const defaultContent = (
    <div style={contentRowStyle}>
      {item.leading ? <div style={leadingStyle}>{item.leading}</div> : null}
      <div style={contentColStyle}>
        {item.title ? <div style={titleStyle}>{item.title}</div> : null}
        {item.description ? (
          <div style={descriptionStyle}>{item.description}</div>
        ) : null}
      </div>
      {item.meta ? <div style={metaStyle}>{item.meta}</div> : null}
    </div>
  );

  const surfaceStyle: CSSProperties = {
    ...surfaceBase,
    cursor: item.disabled ? "default" : onClick ? "pointer" : "grab",
    opacity: item.disabled ? 0.6 : 1,
  };

  return (
    <div style={rowStyle}>
      {/* Action rail behind the surface */}
      <div aria-hidden={!openSide} style={railStyle}>
        <div style={{ ...railSideStyle, borderTopLeftRadius: 12, borderBottomLeftRadius: 12 }}>
          {leftActions.map((action) => (
            <SwipeActionButton
              key={action.id}
              action={action}
              actionWidth={actionWidth}
              focusable={openSide === "left"}
              onAction={handleAction}
              side="left"
            />
          ))}
        </div>
        <div
          style={{
            ...railSideStyle,
            marginLeft: "auto",
            borderTopRightRadius: 12,
            borderBottomRightRadius: 12,
          }}
        >
          {rightActions.map((action) => (
            <SwipeActionButton
              key={action.id}
              action={action}
              actionWidth={actionWidth}
              focusable={openSide === "right"}
              onAction={handleAction}
              side="right"
            />
          ))}
        </div>
      </div>

      {/* Draggable surface */}
      <motion.div
        drag={item.disabled ? false : "x"}
        dragConstraints={{ left: -rightWidth, right: leftWidth }}
        dragElastic={0.04}
        dragMomentum={false}
        onDragStart={() => {
          dragMovedRef.current = true;
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        onClick={handleSurfaceClick}
        style={{ ...surfaceStyle, x }}
      >
        {renderItem ? renderItem(item) : item.content ?? defaultContent}
      </motion.div>
    </div>
  );
}

/* ── Public wrapper: SwipeableList ────────────────────────────── */

export interface SwipeableListProps {
  items: SwipeableListItemData[];
  value?: SwipeableListValue | null;
  defaultValue?: SwipeableListValue | null;
  onValueChange?: (value: SwipeableListValue | null) => void;
  onAction?: (payload: {
    item: SwipeableListItemData;
    action: SwipeAction;
    side: SwipeSide;
  }) => void;
  /** Click handler fired when the main content is tapped (not dragged). */
  onItemClick?: (item: SwipeableListItemData) => void;
  actionWidth?: number;
  revealThreshold?: number;
  closeOnAction?: boolean;
  style?: CSSProperties;
  renderItem?: (item: SwipeableListItemData) => ReactNode;
}

export function SwipeableList({
  items,
  value,
  defaultValue = null,
  onValueChange,
  onAction,
  onItemClick,
  actionWidth = 56,
  revealThreshold = 34,
  closeOnAction = true,
  style,
  renderItem,
}: SwipeableListProps) {
  const [openValue, setOpenValue] = useControllableSwipeValue({
    value,
    defaultValue,
    onValueChange,
  });

  return (
    <div style={{ ...rootStyle, ...style }}>
      {items.map((item) => (
        <SwipeableListRow
          key={item.id}
          item={item}
          actionWidth={actionWidth}
          revealThreshold={revealThreshold}
          openValue={openValue}
          setOpenValue={setOpenValue}
          closeOnAction={closeOnAction}
          onAction={onAction}
          onClick={onItemClick}
          renderItem={renderItem}
        />
      ))}
    </div>
  );
}

/* ── Public item: SwipeableListItem ───────────────────────────── */

export interface SwipeableListItemProps {
  /** Unique id for the row. */
  id: string;
  /** Main row title. */
  title?: ReactNode;
  /** Secondary line under the title. */
  description?: ReactNode;
  /** Right-aligned meta (e.g. date). */
  meta?: ReactNode;
  /** Leading avatar / icon. */
  leading?: ReactNode;
  /** Fully custom content — overrides title/description/meta. */
  content?: ReactNode;
  /** Actions revealed by swiping right (left side). */
  leftActions?: SwipeAction[];
  /** Actions revealed by swiping left (right side). */
  rightActions?: SwipeAction[];
  disabled?: boolean;
  /** Click on the main content surface (not triggered on drag). */
  onClick?: (item: SwipeableListItemData) => void;
  /** Width of each action button in px. */
  actionWidth?: number;
  /** Px the row must travel before it snaps open. */
  revealThreshold?: number;
  /** Close the row after an action button is pressed. */
  closeOnAction?: boolean;
  /** Controlled open state for this item. */
  openValue?: SwipeableListValue | null;
  onOpenValueChange?: (value: SwipeableListValue | null) => void;
  style?: CSSProperties;
  renderItem?: (item: SwipeableListItemData) => ReactNode;
}

/**
 * Standalone swipeable row. Use inside a custom list layout when you
 * don't want the `SwipeableList` wrapper to manage open-state. Each
 * instance manages its own open/close state internally when
 * `openValue` is not provided.
 */
export function SwipeableListItem({
  id,
  title,
  description,
  meta,
  leading,
  content,
  leftActions,
  rightActions,
  disabled,
  onClick,
  actionWidth = 56,
  revealThreshold = 34,
  closeOnAction = true,
  openValue: controlledOpen,
  onOpenValueChange,
  style,
  renderItem,
}: SwipeableListItemProps) {
  const [internalOpen, setInternalOpen] =
    useState<SwipeableListValue | null>(null);
  const isControlled = controlledOpen !== undefined;
  const openValue = isControlled ? controlledOpen : internalOpen;

  const setOpenValue = useCallback(
    (next: SwipeableListValue | null) => {
      if (!isControlled) setInternalOpen(next);
      onOpenValueChange?.(next);
    },
    [isControlled, onOpenValueChange],
  );

  const item: SwipeableListItemData = {
    id,
    title,
    description,
    meta,
    leading,
    content,
    leftActions,
    rightActions,
    disabled,
  };

  return (
    <SwipeableListRow
      item={item}
      actionWidth={actionWidth}
      revealThreshold={revealThreshold}
      openValue={openValue}
      setOpenValue={setOpenValue}
      closeOnAction={closeOnAction}
      onClick={onClick}
      renderItem={renderItem}
    />
  );
}
