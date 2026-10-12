/**
 * Concept 3, "Banknote": the visual language of a birr note (guilloché
 * rosette, engraved wave border, microtext, a red serial) around one line,
 * "Check it like cash." Merchants already check notes against the light;
 * this is the same reflex for a transfer. Drawn as SVG line work, no
 * gradients. Not a copy of any real note: no issuer, no portrait, no value.
 */
import { demoReference, withArticle } from "@/lib/og/card";
import { AM_BIRR, Mark, type CardBank } from "./parts";

const N = {
  paper: "#f1e9d8",
  engrave: "#7a5634",
  engrave2: "#8c3b2e",
  ink: "#2b2016",
  ink2: "#5a4634",
  serial: "#b2352b",
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/** A band of phase-shifted sine waves between (x0,y) and (x1,y), or vertical. */
function waveBand(len: number, amp: number, wavelength: number, curves: number, vertical: boolean, ox: number, oy: number): string {
  let d = "";
  const step = 3;
  for (let k = 0; k < curves; k++) {
    const phase = (k / curves) * Math.PI * 2;
    for (let s = 0; s <= len; s += step) {
      const w = amp * Math.sin((s / wavelength) * Math.PI * 2 + phase) * (0.7 + 0.3 * Math.cos((s / (wavelength * 5)) * Math.PI * 2 + phase / 2));
      const x = vertical ? ox + w : ox + s;
      const y = vertical ? oy + s : oy + w;
      d += `${s === 0 ? "M" : "L"}${r1(x)} ${r1(y)}`;
    }
  }
  return d;
}

/** A guilloché ring: `curves` closed sinusoidal circles, each phase-shifted. */
function ring(cx: number, cy: number, radius: number, amp: number, lobes: number, curves: number, amp2 = 0, lobes2 = 0): string {
  let d = "";
  const steps = 720;
  for (let k = 0; k < curves; k++) {
    const phase = (k / curves) * ((Math.PI * 2) / lobes);
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const r = radius + amp * Math.sin(lobes * (t + phase)) + amp2 * Math.cos(lobes2 * (t - phase * 2));
      d += `${i === 0 ? "M" : "L"}${r1(cx + r * Math.cos(t))} ${r1(cy + r * Math.sin(t))}`;
    }
  }
  return d;
}

/** A small epitrochoid medallion for the corners. */
function medallion(cx: number, cy: number, R: number, r: number, ds: number[]): string {
  let d = "";
  const steps = 900;
  for (const dd of ds) {
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const x = cx + (R + r) * Math.cos(t) - dd * Math.cos(((R + r) / r) * t);
      const y = cy + (R + r) * Math.sin(t) - dd * Math.sin(((R + r) / r) * t);
      d += `${i === 0 ? "M" : "L"}${r1(x)} ${r1(y)}`;
    }
  }
  return d;
}

const W = 1200;
const H = 630;
const INSET = 26;
const BAND = 44;

function Engraving() {
  const inner = INSET + BAND;
  const top = waveBand(W - INSET * 2, 13, 34, 7, false, INSET, INSET + BAND / 2);
  const bottom = waveBand(W - INSET * 2, 13, 34, 7, false, INSET, H - INSET - BAND / 2);
  const left = waveBand(H - INSET * 2, 13, 34, 7, true, INSET + BAND / 2, INSET);
  const right = waveBand(H - INSET * 2, 13, 34, 7, true, W - INSET - BAND / 2, INSET);
  const rosetteOuter = ring(600, 315, 252, 16, 30, 9, 4, 6);
  const rosetteInner = ring(600, 315, 214, 10, 22, 7, 3, 4);
  const c = INSET + BAND / 2;
  const cornerPts = [
    [c, c],
    [W - c, c],
    [c, H - c],
    [W - c, H - c],
  ];
  const corners = cornerPts.map(([x, y]) => medallion(x, y, 24, 4, [6, 9, 12])).join("");
  // fine diagonal hatching over the inner field: engraved paper, not a flat fill
  let hatch = "";
  for (let x = -H; x < W; x += 7) hatch += `M${x} ${H}L${x + H} 0`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0 }}>
      <path d={hatch} stroke={N.engrave} strokeWidth="0.5" fill="none" opacity="0.13" />
      <path d={top + bottom + left + right} stroke={N.engrave} strokeWidth="0.9" fill="none" opacity="0.85" />
      <rect x={INSET} y={INSET} width={W - INSET * 2} height={H - INSET * 2} stroke={N.engrave} strokeWidth="2" fill="none" />
      <rect x={inner} y={inner} width={W - inner * 2} height={H - inner * 2} stroke={N.engrave} strokeWidth="1.2" fill="none" />
      <rect x={inner + 5} y={inner + 5} width={W - (inner + 5) * 2} height={H - (inner + 5) * 2} stroke={N.engrave} strokeWidth="0.6" fill="none" />
      <path d={rosetteOuter} stroke={N.engrave2} strokeWidth="0.8" fill="none" opacity="0.8" />
      <path d={rosetteInner} stroke={N.engrave} strokeWidth="0.7" fill="none" opacity="0.7" />
      {/* corner medallions on a cleared field */}
      {cornerPts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="44" fill={N.paper} stroke={N.engrave} strokeWidth="1.2" />
      ))}
      <path d={corners} stroke={N.engrave2} strokeWidth="0.8" fill="none" />
    </svg>
  );
}

function Microtext({ top, left, width }: { top: number; left: number; width: number }) {
  const unit = "cheki.et · verify against the bank’s own record · ";
  return (
    <div style={{ display: "flex", position: "absolute", top, left, width, overflow: "hidden", fontFamily: "Inter", fontSize: 8.5, lineHeight: 1, color: N.engrave, whiteSpace: "nowrap" }}>
      {unit.repeat(12)}
    </div>
  );
}

export function BanknoteCard({ bank }: { bank?: CardBank }) {
  const inner = INSET + BAND;
  const serial = demoReference(bank?.code ?? "cbe");
  return (
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", background: N.paper, overflow: "hidden", fontFamily: "Inter" }}>
      <Engraving />
      <Microtext top={inner + 12} left={inner + 104} width={W - (inner + 104) * 2} />
      <Microtext top={H - inner - 21} left={inner + 104} width={W - (inner + 104) * 2} />

      {/* clear oval behind the line, like the watermark field on a note */}
      <div style={{ display: "flex", position: "absolute", left: 600 - 205, top: 315 - 158, width: 410, height: 316, borderRadius: 999, background: N.paper }} />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "absolute", left: 0, right: 0, top: 176 }}>
        {bank && <div style={{ display: "flex", fontSize: 24, color: N.ink2, marginBottom: 6 }}>{bank.shortName} receipts</div>}
        <div style={{ display: "flex", fontFamily: "Serif Display", fontStyle: "italic", fontSize: bank ? 92 : 104, lineHeight: 0.98, letterSpacing: "-0.02em", color: N.ink }}>Check it</div>
        <div style={{ display: "flex", fontFamily: "Serif Display", fontStyle: "italic", fontSize: bank ? 92 : 104, lineHeight: 0.98, letterSpacing: "-0.02em", color: N.ink }}>like cash.</div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 16, fontSize: 21, lineHeight: 1.3, color: N.ink2 }}>
          <span>{bank ? `Verify ${withArticle(bank.shortName)} receipt against` : "Verify the receipt against"}</span>
          <span>{bank ? `${bank.shortName}’s own record.` : "the bank’s own record."}</span>
        </div>
      </div>

      {/* serials, top right and bottom left, like a note */}
      <div style={{ display: "flex", position: "absolute", top: inner + 30, right: inner + 34, fontFamily: "Mono", fontSize: 22, color: N.serial, letterSpacing: "0.04em" }}>{serial}</div>
      <div style={{ display: "flex", position: "absolute", bottom: inner + 30, left: inner + 34, fontFamily: "Mono", fontSize: 22, color: N.serial, letterSpacing: "0.04em" }}>{serial}</div>

      <div style={{ display: "flex", position: "absolute", top: inner + 28, left: inner + 34 }}>
        <Mark size={36} color={N.ink} />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, position: "absolute", bottom: inner + 22, right: inner + 34, color: N.ink }}>
        <span style={{ fontFamily: "Ethiopic", fontWeight: 900, fontSize: 46 }}>{AM_BIRR}</span>
        <span style={{ fontSize: 22, color: N.ink2 }}>cheki.et</span>
      </div>
    </div>
  );
}
