/**
 * Shared art for the Open Graph / X cards (1200x630, ImageResponse).
 *
 * One idea per card: the site's hero type on the left (Inter Display, then an
 * italic serif line in the sepia ink), and the product itself on the right,
 * a verified result typeset like the checker's VerdictCard. The receipt is
 * synthetic (ETB 12,500.00, a DEMO reference, no names or accounts): a card
 * never shows real receipt data.
 *
 * Rules from the design language: hierarchy from type, colour only as the
 * one semantic green check, hairline borders and soft shadows, no pills,
 * strips, tinted tiles, tracked caps, nested cards or decorative gradients.
 */
import { readFile } from "fs/promises";
import { join } from "path";
import type { ReactNode } from "react";
import { bankLogoSpec } from "@/lib/bank-logos";

export const OG_SIZE = { width: 1200, height: 630 };

/** Light-scheme tokens from src/app/globals.css. */
const C = {
  bg: "#faf9f7",
  surface: "#ffffff",
  ink: "#1c1814",
  ink2: "#463d34",
  ink3: "#5c5248",
  green: "#16a34a",
  border: "rgba(28, 25, 23, 0.09)",
  dotted: "#d9d5ce",
};

const FONT_DIR = join(process.cwd(), "src/lib/og/fonts");
const FONT_FILES = [
  { name: "Inter", file: "Inter-Regular.ttf", weight: 400, style: "normal" },
  { name: "Inter", file: "Inter-Medium.ttf", weight: 500, style: "normal" },
  { name: "Inter", file: "Inter-SemiBold.ttf", weight: 600, style: "normal" },
  { name: "Inter Display", file: "InterDisplay-SemiBold.ttf", weight: 600, style: "normal" },
  { name: "Inter Display", file: "InterDisplay-Bold.ttf", weight: 700, style: "normal" },
  { name: "Serif", file: "NotoSerif-Italic.ttf", weight: 400, style: "italic" },
  { name: "Mono", file: "JetBrainsMono-Medium.ttf", weight: 500, style: "normal" },
  // Used only by the exploration concepts in src/lib/og/concepts (OG_VARIANT).
  { name: "Serif Display", file: "NotoSerifDisplay-Italic.ttf", weight: 400, style: "italic" },
  { name: "Ethiopic", file: "NotoSerifEthiopic-Black.ttf", weight: 900, style: "normal" },
] as const;

type OgFont = {
  name: string;
  data: Buffer;
  weight: 400 | 500 | 600 | 700 | 900;
  style: "normal" | "italic";
};

let fontsPromise: Promise<OgFont[]> | null = null;

/** The subset TTFs built by scripts/subset-og-fonts.sh, read once per process. */
export function ogFonts(): Promise<OgFont[]> {
  fontsPromise ??= Promise.all(
    FONT_FILES.map(async (f) => ({
      name: f.name,
      data: await readFile(join(FONT_DIR, f.file)),
      weight: f.weight,
      style: f.style,
    }))
  );
  return fontsPromise;
}

/** Keep "M-Pesa" in one piece: hyphens become non-breaking hyphens (U+2011). */
export function nobreak(text: string): string {
  return text.replace(/-/g, "\u2011");
}

/** "a CBE receipt", "an Awash receipt", "an M-Pesa receipt". */
export function withArticle(name: string): string {
  const an = /^[aeiou]/i.test(name) || /^M-/.test(name);
  return `${an ? "an" : "a"} ${name}`;
}

/** Synthetic, obviously-fake references shaped loosely like each bank's. */
const DEMO_REFS: Record<string, string> = {
  cbe: "FT26DEMO1250",
  telebirr: "DEMO1250TB",
  boa: "FT26DEMO1250",
  mpesa: "SEDEMO1250",
  dashen: "DEMO1250DSH",
  awash: "DEMO-1250-AW",
  siinqee: "SQDEMO1250",
  ebirr: "DEMO-1250-EB",
  zamzam: "DEMO1250",
  cbebirr: "DTSDEMO1250",
};

export function demoReference(code: string): string {
  return DEMO_REFS[code] ?? "DEMO-1250";
}

export function LogoMark({ code, size }: { code: string; size: number }) {
  const spec = bankLogoSpec(code);
  const k = size / 40;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: 8 * k,
        background: spec.color,
        color: "#fff",
        fontFamily: "Inter",
        fontWeight: spec.fontWeight >= 700 ? 600 : spec.fontWeight,
        fontSize: spec.fontSize * k,
        letterSpacing: spec.letterSpacing ?? "0",
        flexShrink: 0,
      }}
    >
      {spec.label}
    </div>
  );
}

function Check({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="12" fill={C.green} />
      <path d="M7 12.4l3.3 3.3L17.2 8.8" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The verified result, typeset like VerdictCard: status line and sub-line,
 * the amount with light cents and currency, then label/value rows under one
 * hairline. Synthetic data only.
 */
export function ResultCard({ code, shortName }: { code: string; shortName: string }) {
  const row = (label: string, value: ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", fontSize: 20, lineHeight: "28px" }}>
      <div style={{ display: "flex", width: 132, color: C.ink3 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", color: C.ink }}>{value}</div>
    </div>
  );
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 480,
        padding: "34px 36px 32px",
        background: C.surface,
        borderRadius: 24,
        border: `1px solid ${C.border}`,
        boxShadow: "0 1px 2px rgba(28, 25, 23, 0.05), 0 24px 64px rgba(28, 25, 23, 0.10)",
        fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Check size={26} />
        <div style={{ display: "flex", fontSize: 25, fontWeight: 600, letterSpacing: "-0.012em", color: C.ink }}>
          Verified with {shortName}
        </div>
      </div>
      <div style={{ display: "flex", marginTop: 6, paddingLeft: 38, fontSize: 17, lineHeight: "24px", color: C.ink2 }}>
        Confirmed with {shortName}&rsquo;s own receipt record
      </div>

      <div style={{ display: "flex", alignItems: "baseline", marginTop: 30, color: C.ink }}>
        <div style={{ display: "flex", fontFamily: "Inter Display", fontWeight: 600, fontSize: 76, lineHeight: 1, letterSpacing: "-0.035em" }}>
          12,500
        </div>
        <div style={{ display: "flex", fontFamily: "Inter Display", fontWeight: 600, fontSize: 38, letterSpacing: "-0.01em", color: C.ink2 }}>
          .00
        </div>
        <div style={{ display: "flex", marginLeft: 12, fontSize: 28, fontWeight: 400, color: C.ink3 }}>ETB</div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          marginTop: 30,
          paddingTop: 22,
          borderTop: `1px solid ${C.border}`,
        }}
      >
        {row("Reference", <span style={{ fontFamily: "Mono", fontSize: 19, letterSpacing: "-0.01em" }}>{demoReference(code)}</span>)}
        {row(
          "Bank",
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <LogoMark code={code} size={26} />
            <span style={{ fontWeight: 500 }}>{shortName}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** The cheki wordmark, as the nav sets it. */
export function Wordmark({ size = 34 }: { size?: number }) {
  return (
    <div style={{ display: "flex", fontFamily: "Inter Display", fontWeight: 700, fontSize: size, letterSpacing: "-0.04em", color: C.ink }}>
      cheki
    </div>
  );
}

/**
 * The card frame: wordmark top-left, `left` (the headline) and `right` (the
 * product) side by side, cheki.et and an optional quiet note at the foot.
 */
export function Frame({ left, right, foot }: { left: ReactNode; right?: ReactNode; foot?: ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: C.bg,
        padding: "60px 72px 56px",
        fontFamily: "Inter",
        color: C.ink,
      }}
    >
      <Wordmark />
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between", gap: 48 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>{left}</div>
        {right}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 20, fontSize: 21, color: C.ink3 }}>
        <span>cheki.et</span>
        {foot}
      </div>
    </div>
  );
}

/**
 * The hero headline: an Inter Display lead and an italic serif rest in the
 * secondary ink, the same pairing as .hp-title / .hp-title-rest.
 */
export function Headline({ kicker, lead, rest, size = 64 }: { kicker?: ReactNode; lead: string; rest?: string; size?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {kicker && <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, fontSize: 24, color: C.ink3 }}>{kicker}</div>}
      <div
        style={{
          display: "flex",
          fontFamily: "Inter Display",
          fontWeight: 700,
          fontSize: size,
          lineHeight: 1.06,
          letterSpacing: "-0.035em",
          color: C.ink,
          textWrap: "balance",
        }}
      >
        {nobreak(lead)}
      </div>
      {rest && (
        <div
          style={{
            display: "flex",
            marginTop: size * 0.12,
            fontFamily: "Serif",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: size * 1.04,
            lineHeight: 1.1,
            letterSpacing: "-0.015em",
            color: C.ink2,
            textWrap: "balance",
          }}
        >
          {nobreak(rest)}
        </div>
      )}
    </div>
  );
}

export const OG_COLORS = C;
