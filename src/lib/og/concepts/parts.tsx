/**
 * Shared pieces for the exploration cards (OG_VARIANT, src/lib/og/variant.ts):
 * a thermal-paper receipt, an inked rubber stamp, and the SVG textures they
 * use. Everything is drawn with flex boxes and inline SVG paths, because
 * ImageResponse (Satori) has no canvas, no SVG <text> and no filters.
 *
 * All receipt data is synthetic: a DEMO reference, DEMO names, 12,500.00 ETB.
 */
import type { ReactNode } from "react";
import { demoReference, LogoMark } from "@/lib/og/card";

/** Every Ethiopic character a card may use. Keep in sync with OG_AMHARIC in scripts/subset-og-fonts.sh. */
export const OG_AMHARIC = "ተረጋግጧልከፍያለሁብር";
/** "verified" */
export const AM_VERIFIED = "ተረጋግጧል";
/** "I've paid" */
export const AM_PAID = "ከፍያለሁ";
/** "birr" */
export const AM_BIRR = "ብር";

export interface CardBank {
  code: string;
  shortName: string;
  name: string;
  beta?: boolean;
}

export const P = {
  night: "#15120f",
  paper: "#f4f0e7",
  paperShade: "#e7e1d4",
  ink: "#1c1814",
  ink2: "#463d34",
  ink3: "#6b6157",
  green: "#16a34a",
  stampGreen: "#13803d",
  red: "#c0362c",
};

/** Small seeded PRNG (mulberry32) so every render of a card is identical. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** A zigzag torn edge, `width` wide, pointing up (top edge) or down (bottom edge). */
export function TornEdge({ width, color, down = false, tooth = 22, depth = 11 }: { width: number; color: string; down?: boolean; tooth?: number; depth?: number }) {
  const n = Math.ceil(width / tooth);
  let d = down ? `M0 0` : `M0 ${depth}`;
  for (let i = 0; i < n; i++) {
    const x0 = i * tooth;
    d += down ? ` L${r1(x0 + tooth / 2)} ${depth} L${r1(x0 + tooth)} 0` : ` L${r1(x0 + tooth / 2)} 0 L${r1(x0 + tooth)} ${depth}`;
  }
  d += down ? ` L${width} 0 Z` : ` L${width} ${depth} Z`;
  return (
    <svg width={width} height={depth} viewBox={`0 0 ${width} ${depth}`} style={{ display: "flex" }}>
      <path d={d} fill={color} />
    </svg>
  );
}

/**
 * A dashed rule, like the separators a thermal printer prints (dashes drawn
 * as rects). The SVG box is padded well past the 2px line and pulled back
 * with negative margins: Satori clips an SVG to its axis-aligned box, so a
 * 2px-tall box inside a rotated receipt would only show its middle dashes.
 */
export function DashRule({ width, color, dash = 8, gap = 6, weight = 2 }: { width: number; color: string; dash?: number; gap?: number; weight?: number }) {
  const w = Math.floor(width);
  const pad = 40;
  const h = Math.ceil(weight) + pad * 2;
  let d = "";
  for (let x = 0; x + dash <= w; x += dash + gap) d += `M${r1(x)} ${pad}h${r1(dash)}v${r1(weight)}h${r1(-dash)}Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "flex", margin: `${-pad}px 0` }}>
      <path d={d} fill={color} />
    </svg>
  );
}

/** A synthetic barcode (seeded), the printed foot of a receipt. */
export function Barcode({ width, height, color, seed = 7 }: { width: number; height: number; color: string; seed?: number }) {
  const rand = rng(seed);
  let x = 0;
  let d = "";
  while (x < width) {
    const w = 1.5 + Math.floor(rand() * 4) * 1.5;
    if (x + w > width) break;
    d += `M${r1(x)} 0h${w}v${height}h-${w}Z`;
    x += w + 1.5 + Math.floor(rand() * 3) * 1.5;
  }
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "flex" }}>
      <path d={d} fill={color} />
    </svg>
  );
}

/**
 * Worn-ink texture: specks, nicks and thin scratches in the paper colour,
 * laid over a stamp so the ink looks pressed rather than printed.
 */
export function InkWear({ width, height, color, seed = 3, density = 1 }: { width: number; height: number; color: string; seed?: number; density?: number }) {
  const rand = rng(seed);
  let specks = "";
  const n = Math.round(((width * height) / 260) * density);
  for (let i = 0; i < n; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const r = rand() < 0.86 ? 0.5 + rand() * 1.3 : 1.8 + rand() * 2.6;
    const rx = r * (0.6 + rand() * 0.9);
    // an ellipse as two arcs keeps it one path
    specks += `M${r1(x - rx)} ${r1(y)}a${r1(rx)} ${r1(r)} 0 1 0 ${r1(rx * 2)} 0a${r1(rx)} ${r1(r)} 0 1 0 ${r1(-rx * 2)} 0Z`;
  }
  let scratches = "";
  for (let i = 0; i < Math.round(10 * density); i++) {
    const x = rand() * width;
    const y = rand() * height;
    const len = 30 + rand() * 110;
    const ang = -0.35 + rand() * 0.7;
    scratches += `M${r1(x)} ${r1(y)}l${r1(Math.cos(ang) * len)} ${r1(Math.sin(ang) * len)}`;
  }
  // a few soft "thin ink" patches where the stamp did not press evenly
  const patches: ReactNode[] = [];
  for (let i = 0; i < 5; i++) {
    patches.push(
      <ellipse key={i} cx={r1(rand() * width)} cy={r1(rand() * height)} rx={r1(40 + rand() * 90)} ry={r1(14 + rand() * 30)} fill={color} opacity={0.22 + rand() * 0.18} />
    );
  }
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", left: 0, top: 0 }}>
      {patches}
      <path d={specks} fill={color} />
      <path d={scratches} stroke={color} strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** A green check in a circle (bank-confirmed only). */
export function CheckDisc({ size, color = P.green, fg = "#fff" }: { size: number; color?: string; fg?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "flex", flexShrink: 0 }}>
      <circle cx="12" cy="12" r="12" fill={color} />
      <path d="M7 12.4l3.3 3.3L17.2 8.8" fill="none" stroke={fg} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A red cross in a circle (not found at the bank). */
export function CrossDisc({ size, color = P.red }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "flex", flexShrink: 0 }}>
      <circle cx="12" cy="12" r="12" fill={color} />
      <path d="M8.2 8.2l7.6 7.6M15.8 8.2l-7.6 7.6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * A thermal-paper transfer receipt in monospace, synthetic data only.
 * `scale` sizes the type; the paper runs to `height` (let it bleed off-frame).
 */
export function ThermalReceipt({
  bank,
  width,
  height,
  scale = 1,
  edge = "top",
  shadow = true,
  showBank = true,
  stampSpace = 0,
}: {
  bank?: CardBank;
  width: number;
  height: number;
  scale?: number;
  edge?: "top" | "both" | "none";
  /** true for the default drop shadow, or a CSS box-shadow. */
  shadow?: boolean | string;
  showBank?: boolean;
  /** Blank paper before the barcode, where a stamp can land on a clean field. */
  stampSpace?: number;
}) {
  const s = scale;
  const pad = 34 * s;
  const inner = width - pad * 2;
  const fs = 21 * s;
  const ref = demoReference(bank?.code ?? "cbe");
  const row = (label: string, value: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: fs, lineHeight: 1.55, color: P.ink2 }}>
      <span>{label}</span>
      <span style={{ color: P.ink }}>{value}</span>
    </div>
  );
  const rule = (
    <div style={{ display: "flex", margin: `${14 * s}px 0` }}>
      <DashRule width={inner} color="#b9b1a3" dash={7 * s} gap={6 * s} weight={2 * s} />
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", width, height }}>
      {edge !== "none" && <TornEdge width={width} color={P.paper} tooth={22 * s} depth={11 * s} />}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          background: P.paper,
          padding: `${26 * s}px ${pad}px ${20 * s}px`,
          fontFamily: "Mono",
          color: P.ink,
          // Satori draws `boxShadow: "none"` as a solid black box, so leave it out.
          ...(shadow ? { boxShadow: shadow === true ? "0 30px 60px rgba(0,0,0,0.35)" : shadow } : {}),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 * s, fontSize: 23 * s, color: P.ink }}>
          {showBank && bank && <LogoMark code={bank.code} size={30 * s} />}
          <span>{showBank && bank ? `${bank.shortName} transfer` : "Transfer receipt"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 6 * s, fontSize: 17 * s, color: P.ink3 }}>12 Oct 2026 · 14:32</div>
        {rule}
        {row("Ref", ref)}
        {row("From", "DEMO PAYER")}
        {row("To", "DEMO SHOP")}
        {rule}
        <div style={{ display: "flex", fontSize: fs, color: P.ink2 }}>Amount</div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", marginTop: 4 * s }}>
          <span style={{ fontSize: 58 * s, letterSpacing: "-0.04em", lineHeight: 1.1 }}>12,500.00</span>
          <span style={{ fontSize: 24 * s, marginLeft: 10 * s, color: P.ink2 }}>ETB</span>
        </div>
        {rule}
        {stampSpace > 0 && <div style={{ display: "flex", height: stampSpace }} />}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 6 * s }}>
          <Barcode width={inner * 0.86} height={54 * s} color={P.ink} seed={11} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 * s, fontSize: 15 * s, color: P.ink3 }}>{ref}</div>
      </div>
      {edge === "both" && <TornEdge width={width} color={P.paper} down tooth={22 * s} depth={11 * s} />}
    </div>
  );
}

/**
 * An inked rubber stamp: a double-ruled frame, a big first line and a small
 * second line, worn with paper-coloured specks. Fixed size so the wear
 * texture covers it exactly.
 */
export function RubberStamp({
  width,
  height,
  color,
  paper,
  top,
  bottom,
  topFont = "Ethiopic",
  topSize,
  bottomSize,
  seed = 5,
}: {
  width: number;
  height: number;
  color: string;
  paper: string;
  top: string;
  bottom?: string;
  topFont?: string;
  topSize: number;
  bottomSize?: number;
  seed?: number;
}) {
  const k = height / 200;
  return (
    <div style={{ display: "flex", position: "relative", width, height }}>
      <div
        style={{
          display: "flex",
          width,
          height,
          padding: 7 * k,
          border: `${8 * k}px solid ${color}`,
          borderRadius: 22 * k,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            border: `${3 * k}px solid ${color}`,
            borderRadius: 13 * k,
            color,
          }}
        >
          <div style={{ display: "flex", fontFamily: topFont, fontWeight: topFont === "Ethiopic" ? 900 : 700, fontSize: topSize, lineHeight: 1.05 }}>{top}</div>
          {bottom && (
            <div style={{ display: "flex", marginTop: 4 * k, fontFamily: "Inter Display", fontWeight: 700, fontSize: bottomSize ?? 30 * k, letterSpacing: "0.02em", lineHeight: 1 }}>
              {bottom}
            </div>
          )}
        </div>
      </div>
      <InkWear width={width} height={height} color={paper} seed={seed} />
    </div>
  );
}

/** The cheki wordmark in any colour. */
export function Mark({ size = 34, color = P.ink }: { size?: number; color?: string }) {
  return (
    <div style={{ display: "flex", fontFamily: "Inter Display", fontWeight: 700, fontSize: size, letterSpacing: "-0.04em", color, lineHeight: 1 }}>
      cheki
    </div>
  );
}
