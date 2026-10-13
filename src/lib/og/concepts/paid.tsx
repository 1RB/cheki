/**
 * Concept 5, "Paid?": the merchant's whole question as one enormous italic
 * word, and the answer as one small, precise line: the bank-confirmed result.
 * The scale contrast is the design. The word sits inside the centre square
 * so a Telegram or WhatsApp crop keeps all of it.
 */
import { CheckDisc, Mark, P, type CardBank } from "./parts";

export function PaidCard({ bank }: { bank?: CardBank }) {
  const name = bank?.shortName ?? "CBE";
  return (
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", background: P.paper, overflow: "hidden", fontFamily: "Inter", color: P.ink }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "absolute", left: 0, right: 0, top: 84 }}>
        <div style={{ display: "flex", fontFamily: "Serif Display", fontStyle: "italic", fontSize: 244, lineHeight: 1, letterSpacing: "-0.045em", color: P.ink, paddingRight: 24 }}>
          Paid?
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 34, fontFamily: "Inter Display", fontWeight: 600, fontSize: 36, letterSpacing: "-0.02em", color: P.ink }}>
          <CheckDisc size={38} />
          Yes. 12,500 ETB, confirmed by {name}.
        </div>
      </div>
      <div style={{ display: "flex", position: "absolute", left: 60, bottom: 52 }}>
        <Mark size={32} />
      </div>
      <div style={{ display: "flex", position: "absolute", right: 60, bottom: 54, fontSize: 22, color: P.ink3 }}>
        cheki.et
      </div>
    </div>
  );
}
