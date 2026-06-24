"use client";

import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EASE_OUT } from "@/lib/ease";

export interface NumberTickerProps {
  value: number;
  pad?: number;
  duration?: number;
  stagger?: number;
  startOnView?: boolean;
  prefix?: string;
  suffix?: string;
  blur?: boolean;
  style?: React.CSSProperties;
  digitClassName?: string;
  locale?: boolean;
}

const DIGIT_HEIGHT_EM = 1.1;
const DIGITS = Array.from({ length: 10 }, (_, n) => n);

export function NumberTicker({
  value,
  pad,
  duration = 0.9,
  stagger = 0.04,
  startOnView = true,
  prefix,
  suffix,
  blur = false,
  style,
  locale,
}: NumberTickerProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const inView = useInView(containerRef, { once: true, amount: 0.6 });
  const [armed, setArmed] = useState(!startOnView);

  useEffect(() => {
    if (startOnView && inView) setArmed(true);
  }, [startOnView, inView]);

  const text = useMemo(() => {
    const rounded = Math.round(value);
    const formatted = locale ? rounded.toLocaleString() : rounded.toString();
    return pad ? formatted.padStart(pad, "0") : formatted;
  }, [value, pad, locale]);

  const glyphs = useMemo(() => {
    const chars = text.split("");
    return chars.map((char, i) => ({ char, id: `g-${chars.length - 1 - i}` }));
  }, [text]);

  const readableText = `${prefix ?? ""}${text}${suffix ?? ""}`;

  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!armed || entered) return;
    const total = (duration + glyphs.length * stagger) * 1000;
    const t = window.setTimeout(() => setEntered(true), total);
    return () => window.clearTimeout(t);
  }, [armed, entered, duration, stagger, glyphs.length]);

  return (
    <span ref={containerRef} style={{ display: "inline-flex", alignItems: "center", fontVariantNumeric: "tabular-nums", ...style }}>
      <span className="sr-only">{readableText}</span>
      <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center" }}>
        {prefix ? <span>{prefix}</span> : null}
        {glyphs.map(({ char, id }, i) => {
          const isDigit = /\d/.test(char);
          if (!isDigit) {
            return <span key={id} style={{ display: "inline-block" }}>{char}</span>;
          }
          const digit = Number(char);
          return (
            <Digit
              key={id}
              digit={armed ? digit : 0}
              delay={entered ? 0 : i * stagger}
              duration={duration}
              blur={blur}
            />
          );
        })}
        {suffix ? <span>{suffix}</span> : null}
      </span>
    </span>
  );
}

function Digit({
  digit,
  delay,
  duration,
  blur,
}: {
  digit: number;
  delay: number;
  duration: number;
  blur: boolean;
}) {
  const reduce = useReducedMotion();
  const columnRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduce || !blur || !columnRef.current || !Number.isFinite(digit)) return;
    const node = columnRef.current;
    const controls = animate(
      node,
      { filter: ["blur(10px)", "blur(0px)"] },
      { duration: Math.min(duration * 0.75, 0.32), delay, ease: EASE_OUT },
    );
    return () => { controls.stop(); node.style.filter = "blur(0px)"; };
  }, [blur, delay, digit, duration, reduce]);

  return (
    <span style={{ position: "relative", display: "inline-block", overflow: "hidden", height: `${DIGIT_HEIGHT_EM}em`, width: "0.6em" }}>
      <motion.span
        ref={columnRef}
        initial={{ y: 0 }}
        animate={{ y: `-${digit * DIGIT_HEIGHT_EM}em` }}
        transition={reduce ? { duration: 0 } : { duration, delay, ease: EASE_OUT }}
        style={{ position: "absolute", insetInline: 0, top: 0, display: "flex", flexDirection: "column", alignItems: "center", willChange: "transform,filter" }}
      >
        {DIGITS.map((n) => (
          <span key={n} style={{ display: "flex", height: "1.1em", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  );
}
