/**
 * Concept 2, "Spot the fake": two identical receipts side by side. The bank
 * has no record of one (red cross); the other is confirmed (green check).
 * The headline opens the curiosity gap; the receipts close it.
 */
import { CheckDisc, CrossDisc, Mark, P, ThermalReceipt, type CardBank } from "./parts";

function Verdict({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 20px 12px 14px",
        background: "#ffffff",
        borderRadius: 12,
        boxShadow: "0 1px 2px rgba(28,25,23,0.08), 0 14px 34px rgba(28,25,23,0.22)",
        fontFamily: "Inter",
        fontWeight: 600,
        fontSize: 25,
        letterSpacing: "-0.01em",
        color: P.ink,
      }}
    >
      {ok ? <CheckDisc size={34} /> : <CrossDisc size={34} />}
      {label}
    </div>
  );
}

export function SpotCard({ bank }: { bank?: CardBank }) {
  const name = bank?.shortName ?? "CBE";
  return (
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", background: "#e9e3d7", overflow: "hidden", fontFamily: "Inter" }}>
      {/* the two receipts */}
      <div style={{ display: "flex", position: "absolute", left: 292, top: 188, transform: "rotate(-4deg)" }}>
        <ThermalReceipt bank={bank} width={310} height={560} scale={0.64} shadow="0 1px 2px rgba(60,40,20,0.10), 0 18px 40px rgba(60,40,20,0.16)" />
      </div>
      <div style={{ display: "flex", position: "absolute", left: 600, top: 188, transform: "rotate(3deg)" }}>
        <ThermalReceipt bank={bank} width={310} height={560} scale={0.64} shadow="0 1px 2px rgba(60,40,20,0.10), 0 18px 40px rgba(60,40,20,0.16)" />
      </div>
      {/* the fake is struck through */}
      <svg width="310" height="430" viewBox="0 0 310 430" style={{ position: "absolute", left: 292, top: 200 }}>
        <path d="M26 40L284 410M284 40L26 410" stroke={P.red} strokeWidth="9" strokeLinecap="round" opacity="0.9" />
      </svg>
      <div style={{ display: "flex", position: "absolute", left: 286, top: 452, transform: "rotate(-4deg)" }}>
        <Verdict ok={false} label="Not found at the bank" />
      </div>
      <div style={{ display: "flex", position: "absolute", left: 640, top: 452, transform: "rotate(3deg)" }}>
        <Verdict ok label={`Confirmed by ${name}`} />
      </div>

      {/* the hook */}
      <div style={{ display: "flex", position: "absolute", left: 0, right: 0, top: 58, justifyContent: "center" }}>
        <div style={{ display: "flex", fontFamily: "Inter Display", fontWeight: 700, fontSize: 64, letterSpacing: "-0.035em", lineHeight: 1, color: P.ink }}>
          One of these is
          <span style={{ fontFamily: "Serif", fontStyle: "italic", fontWeight: 400, marginLeft: 16, letterSpacing: "-0.01em", color: P.ink }}>fake.</span>
        </div>
      </div>

      <div style={{ display: "flex", position: "absolute", left: 60, bottom: 52 }}>
        <Mark size={32} />
      </div>
      <div style={{ display: "flex", position: "absolute", right: 60, bottom: 54, fontSize: 22, color: P.ink3 }}>cheki.et</div>
    </div>
  );
}
