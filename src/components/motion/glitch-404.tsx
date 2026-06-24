"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { SPRING_PANEL } from "@/lib/ease";

export function NotFound404() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div ref={ref} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px" }}>
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={SPRING_PANEL}
        style={{
          fontSize: "clamp(72px, 14vw, 120px)",
          fontWeight: 800,
          letterSpacing: "-0.05em",
          lineHeight: 1,
          color: "var(--ink)",
          fontVariantNumeric: "tabular-nums",
          fontFamily: "var(--sans)",
        }}
      >
        404
      </motion.div>
    </div>
  );
}
