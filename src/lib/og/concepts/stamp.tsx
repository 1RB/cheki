/**
 * Concept 1, "Stamp": a thermal receipt cropped huge on a night background,
 * with a green rubber stamp "ተረጋግጧል / VERIFIED" pressed across the amount.
 * One physical object, one gesture. The stamp is green because it stands for
 * the bank's confirmation, the only thing green means on cheki.
 */
import { AM_VERIFIED, Mark, P, RubberStamp, ThermalReceipt, type CardBank } from "./parts";

export function StampCard({ bank }: { bank?: CardBank }) {
  const stampLine = bank ? `VERIFIED · ${bank.shortName.toUpperCase()}` : "VERIFIED";
  return (
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", background: P.night, overflow: "hidden", fontFamily: "Inter" }}>
      {/* the receipt, tilted and bleeding off the bottom */}
      <div style={{ display: "flex", position: "absolute", left: 350, top: 26, transform: "rotate(-5deg)" }}>
        <ThermalReceipt bank={bank} width={500} height={780} scale={0.94} stampSpace={210} />
      </div>

      {/* the stamp, pressed under the amount and kept on the paper */}
      <div style={{ display: "flex", position: "absolute", left: 382, top: 360, transform: "rotate(-9deg)" }}>
        <RubberStamp
          width={446}
          height={172}
          color={P.stampGreen}
          paper={P.paper}
          top={AM_VERIFIED}
          bottom={stampLine}
          topSize={86}
          bottomSize={29}
          seed={bank ? 9 : 5}
        />
      </div>

      {/* margins, outside the square crop */}
      <div style={{ display: "flex", position: "absolute", left: 60, top: 54 }}>
        <Mark size={36} color={P.paper} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: 60, bottom: 56, width: 215, color: P.paper }}>
        <div style={{ display: "flex", fontFamily: "Inter Display", fontWeight: 700, fontSize: 29, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
          {bank ? `Is the ${bank.shortName} receipt real?` : "Is the receipt real?"}
        </div>
        <div style={{ display: "flex", marginTop: 8, fontFamily: "Serif", fontStyle: "italic", fontSize: 28, lineHeight: 1.2, color: "#cfc6ba" }}>
          Ask the bank.
        </div>
      </div>
      <div style={{ display: "flex", position: "absolute", right: 60, bottom: 56, fontSize: 24, color: "#ada395" }}>cheki.et</div>
    </div>
  );
}
