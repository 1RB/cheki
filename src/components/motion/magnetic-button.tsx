"use client";

import { useRef, type ReactNode, useCallback } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

interface MagneticButtonProps {
  children: ReactNode;
  href?: string;
  target?: string;
  rel?: string;
  onClick?: () => void;
  className?: string;
  strength?: number;
  style?: React.CSSProperties;
}

export function MagneticButton({
  children,
  href,
  target,
  rel,
  onClick,
  className,
  strength = 0.3,
  style,
}: MagneticButtonProps) {
  const ref = useRef<HTMLAnchorElement | HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 150, damping: 15, mass: 0.1 });
  const springY = useSpring(y, { stiffness: 150, damping: 15, mass: 0.1 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      x.set((e.clientX - cx) * strength);
      y.set((e.clientY - cy) * strength);
    },
    [strength, x, y]
  );

  const handleMouseLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  const sharedProps = {
    ref: ref as any,
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
    className,
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      ...style,
    },
  };

  const inner = (
    <motion.span
      style={{ x: springX, y: springY, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
    >
      {children}
    </motion.span>
  );

  if (href) {
    return (
      <a href={href} target={target} rel={rel} {...sharedProps}>
        {inner}
      </a>
    );
  }

  return (
    <button onClick={onClick} {...sharedProps}>
      {inner}
    </button>
  );
}
