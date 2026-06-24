"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Glitch404 — animated "404" with a character-scramble effect and
 * chromatic red/cyan split overlay.
 *
 * Each digit scrambles through random glyphs for ~700 ms, settling
 * one-by-one, then a brief re-glitch fires periodically to keep the
 * page feeling alive. Respects prefers-reduced-motion.
 */

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&*+=<>?/@!~^0123456789";
const TARGET = "404";
const SCRAMBLE_MS = 700;
const REGLITCH_INTERVAL = 4500;
const REGLITCH_MS = 180;
const CYAN = "#00d4e0";

function randomGlyph(): string {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
}

/** Build the display string for a given animation progress (0 → 1). */
function scrambleText(progress: number): string {
  return TARGET.split("")
    .map((ch, i) => {
      // Each digit settles slightly later than the previous one.
      const settleThreshold = (i + 1) / (TARGET.length + 1);
      return progress >= settleThreshold ? ch : randomGlyph();
    })
    .join("");
}

export function Glitch404() {
  const [display, setDisplay] = useState(TARGET);
  const [scrambling, setScrambling] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      setDisplay(TARGET);
      setScrambling(false);
      return;
    }

    let rafId = 0;
    let timerId: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    /** Run a scramble for `duration` ms, calling `onDone` when settled. */
    const runScramble = (duration: number, onDone: () => void) => {
      const start = performance.now();
      const tick = (now: number) => {
        if (cancelled || !mountedRef.current) return;
        const elapsed = now - start;
        if (elapsed >= duration) {
          setDisplay(TARGET);
          onDone();
          return;
        }
        setDisplay(scrambleText(elapsed / duration));
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    };

    // Initial scramble on mount
    setScrambling(true);
    runScramble(SCRAMBLE_MS, () => {
      if (cancelled) return;
      setScrambling(false);
      // Schedule periodic re-glitch to keep the page alive
      const scheduleReglitch = () => {
        timerId = setTimeout(() => {
          if (cancelled) return;
          setScrambling(true);
          runScramble(REGLITCH_MS, () => {
            if (cancelled) return;
            setScrambling(false);
            scheduleReglitch();
          });
        }, REGLITCH_INTERVAL);
      };
      scheduleReglitch();
    });

    return () => {
      cancelled = true;
      mountedRef.current = false;
      cancelAnimationFrame(rafId);
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  // Chromatic offset — larger while scrambling, subtle when settled
  const offset = scrambling ? 4 : 2;
  const layerOpacity = scrambling ? 0.9 : 0.55;

  const textStyle: React.CSSProperties = {
    fontFamily: "var(--mono)",
    fontSize: "clamp(80px, 18vw, 180px)",
    fontWeight: 800,
    letterSpacing: "-0.02em",
    lineHeight: 1,
    userSelect: "none",
    display: "inline-block",
  };

  const overlayBase: React.CSSProperties = {
    ...textStyle,
    position: "absolute",
    top: 0,
    left: 0,
    transition: "transform 0.15s ease-out, opacity 0.2s ease-out",
    willChange: "transform, opacity",
  };

  return (
    <div
      role="img"
      aria-label="404"
      style={{
        position: "relative",
        display: "inline-block",
        transform: scrambling ? "translateX(-1px)" : "translateX(0)",
        transition: "transform 0.1s ease-out",
      }}
    >
      {/* Red layer — offset left/up */}
      <span
        aria-hidden="true"
        style={{
          ...overlayBase,
          color: "var(--red)",
          transform: `translate(${-offset}px, ${-offset * 0.35}px)`,
          opacity: layerOpacity,
        }}
      >
        {display}
      </span>

      {/* Cyan layer — offset right/down */}
      <span
        aria-hidden="true"
        style={{
          ...overlayBase,
          color: CYAN,
          transform: `translate(${offset}px, ${offset * 0.35}px)`,
          opacity: layerOpacity,
        }}
      >
        {display}
      </span>

      {/* Base layer — on top, defines layout size */}
      <span
        aria-hidden="true"
        style={{
          ...textStyle,
          position: "relative",
          color: "var(--ink)",
          zIndex: 1,
        }}
      >
        {display}
      </span>
    </div>
  );
}
