/**
 * Concept 4, "The chat": the moment cheki is for, in the app it happens in.
 * A customer sends a receipt screenshot and "ከፍያለሁ" ("I've paid"); the
 * merchant checks it and the reply is the bank-confirmed result. Telegram's
 * dark theme, so the green check is the only colour that speaks.
 */
import { AM_PAID, CheckDisc, Mark, ThermalReceipt, type CardBank } from "./parts";

const T = {
  bg: "#0e1621",
  dots: "#16212e",
  in: "#182533",
  out: "#2b5278",
  text: "#f5f7fa",
  muted: "#7f91a4",
  outMuted: "#9bb7d4",
  link: "#71baf2",
};

function Ticks({ color }: { color: string }) {
  return (
    <svg width="26" height="16" viewBox="0 0 26 16" style={{ display: "flex" }}>
      <path d="M1.5 8.5l4 4 9-9M10 12.5l9-9" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Tail({ side, color }: { side: "left" | "right"; color: string }) {
  const d = side === "left" ? "M18 0v20H0c8-3 14-9 18-20z" : "M0 0v20h18C10 17 4 11 0 0z";
  return (
    <svg width="18" height="20" viewBox="0 0 18 20" style={{ position: "absolute", bottom: 0, [side]: -12 }}>
      <path d={d} fill={color} />
    </svg>
  );
}

function DotGrid() {
  let d = "";
  for (let y = 18; y < 630; y += 36) for (let x = 18 + ((y / 36) % 2) * 18; x < 1200; x += 36) d += `M${x} ${y}h0.01`;
  return (
    <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: "absolute", left: 0, top: 0 }}>
      <path d={d} stroke={T.dots} strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function ChatCard({ bank }: { bank: CardBank }) {
  return (
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", background: T.bg, overflow: "hidden", fontFamily: "Inter", color: T.text }}>
      <DotGrid />

      {/* incoming: the screenshot and "I've paid" */}
      <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: 300, top: 40, width: 330, padding: 6, background: T.in, borderRadius: "22px 22px 22px 6px" }}>
        <div style={{ display: "flex", height: 214, overflow: "hidden", borderRadius: 16 }}>
          <ThermalReceipt bank={bank} width={318} height={420} scale={0.6} edge="none" shadow={false} />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "10px 12px 6px 14px" }}>
          <span style={{ fontFamily: "Ethiopic", fontWeight: 900, fontSize: 34, lineHeight: 1.1 }}>{AM_PAID}</span>
          <span style={{ fontSize: 17, color: T.muted }}>14:32</span>
        </div>
        <Tail side="left" color={T.in} />
      </div>

      {/* outgoing: the bank's answer */}
      <div style={{ display: "flex", flexDirection: "column", position: "absolute", right: 300, top: 318, width: 470, padding: "22px 26px 14px", background: T.out, borderRadius: "24px 24px 6px 24px" }}>
        <div style={{ display: "flex", fontSize: 20, color: T.link, fontWeight: 500 }}>cheki.et</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10 }}>
          <CheckDisc size={58} />
          <span style={{ fontFamily: "Inter Display", fontWeight: 700, fontSize: 68, letterSpacing: "-0.03em", lineHeight: 1 }}>Real</span>
          <span style={{ fontFamily: "Inter Display", fontWeight: 600, fontSize: 38, letterSpacing: "-0.02em", color: T.text, marginLeft: 6 }}>12,500 ETB</span>
        </div>
        <div style={{ display: "flex", marginTop: 12, fontSize: 23, color: T.outMuted }}>Confirmed with {bank.shortName}’s own record</div>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6, marginTop: 4, fontSize: 17, color: T.outMuted }}>
          14:33 <Ticks color={T.link} />
        </div>
        <Tail side="right" color={T.out} />
      </div>

      <div style={{ display: "flex", position: "absolute", left: 60, top: 52 }}>
        <Mark size={36} color={T.text} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: 60, bottom: 52, width: 210 }}>
        <div style={{ display: "flex", fontFamily: "Inter Display", fontWeight: 700, fontSize: 28, lineHeight: 1.15, letterSpacing: "-0.02em" }}>Check before you hand it over.</div>
      </div>
      <div style={{ display: "flex", position: "absolute", right: 60, bottom: 54, fontSize: 22, color: T.muted }}>cheki.et</div>
    </div>
  );
}
