"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

export function NotFound404() {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div style={{
      fontSize: "clamp(80px, 18vw, 140px)",
      fontWeight: 800,
      letterSpacing: "-0.05em",
      lineHeight: 1,
      color: "var(--ink)",
      fontFamily: "var(--sans)",
      display: "flex",
      alignItems: "center",
      gap: "0.02em",
    }}>
      {["4", "0", "4"].map((digit, i) => (
        <motion.span
          key={i}
          initial={mounted && !reduce ? { opacity: 0, y: 20, scale: 0.8 } : false}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 18,
            mass: 0.8,
            delay: i * 0.08,
          }}
        >
          {digit}
        </motion.span>
      ))}
    </div>
  );
}
