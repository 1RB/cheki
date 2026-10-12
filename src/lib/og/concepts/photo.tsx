/**
 * Round 2 of the exploration (OG_VARIANT light | lineup | bait | check):
 * one emotion, one hero image, a few words.
 *
 * The hero art is generated photography and 3D, saved without any text in
 * public/og/{name}.jpg at exactly 1200x630, so the card is the image plus a
 * headline and the wordmark set in the site's own type. A bank card swaps
 * only the headline ("Hold every CBE receipt to the light."). Receipts in the
 * art are blank or blurred: no card ever shows receipt data.
 *
 * Telegram and WhatsApp crop a card to its centre square (x 285 to 915), so
 * the headline and the hero both sit inside it and the image alone still
 * carries the idea at the ~300px a feed shows. The wordmark takes the corner
 * outside the square.
 */
import { readFileSync } from "fs";
import { join } from "path";
import type { CSSProperties, ReactNode } from "react";
import { nobreak } from "@/lib/og/card";
import { Mark, type CardBank } from "./parts";

export const OG_ART = ["light", "lineup", "bait", "check"] as const;
export type OgArt = (typeof OG_ART)[number];

const art = new Map<OgArt, string>();

/** public/og/{name}.jpg as a data URL, read once per process. */
export function artUrl(name: OgArt): string {
  let url = art.get(name);
  if (!url) {
    const buf = readFileSync(join(process.cwd(), "public/og", `${name}.jpg`));
    url = `data:image/jpeg;base64,${buf.toString("base64")}`;
    art.set(name, url);
  }
  return url;
}

const WHITE = "#ffffff";
const INK = "#1c1814";
/** A soft shadow so white type holds on the brighter parts of a photo. */
const LIFT = "0 2px 22px rgba(0, 20, 60, 0.45)";

/**
 * A headline as words that wrap, with the words in `italic` set in the
 * italic display serif (the hero type pairing). Hyphens never break.
 */
function Words({ text, italic = [], size, color, align = "left", width, shadow }: { text: string; italic?: string[]; size: number; color: string; align?: "left" | "center"; width: number; shadow?: string }) {
  const words = text.split(" ");
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start", width, color, lineHeight: 1.02, ...(shadow ? { textShadow: shadow } : {}) }}>
      {words.map((w, i) => {
        const serif = italic.includes(w);
        const style: CSSProperties = serif
          ? { fontFamily: "Serif Display", fontStyle: "italic", fontWeight: 400, fontSize: size * 1.12, letterSpacing: "-0.02em" }
          : { fontFamily: "Inter Display", fontWeight: 700, fontSize: size, letterSpacing: "-0.035em" };
        return (
          <div key={i} style={{ display: "flex", ...style, marginRight: i < words.length - 1 ? size * 0.24 : 0 }}>
            {nobreak(w)}
          </div>
        );
      })}
    </div>
  );
}

function Art({ name, children }: { name: OgArt; children: ReactNode }) {
  return (
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", overflow: "hidden", fontFamily: "Inter" }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={artUrl(name)} width={1200} height={630} style={{ position: "absolute", left: 0, top: 0 }} />
      {children}
    </div>
  );
}

function At({ children, ...pos }: { children: ReactNode } & Pick<CSSProperties, "left" | "right" | "top" | "bottom">) {
  return <div style={{ display: "flex", position: "absolute", ...pos }}>{children}</div>;
}

/** 1. Hold it to the light. Scrutiny turning into confidence: the green tick shows through the paper like a watermark. */
export function LightCard({ bank }: { bank?: CardBank }) {
  const text = bank ? `Hold every ${bank.shortName} receipt to the light.` : "Hold every receipt to the light.";
  return (
    <Art name="light">
      <At left={60} top={50}>
        <Mark size={34} color={WHITE} />
      </At>
      <At left={318} top={bank ? 92 : 96}>
        <Words text={text} italic={["light."]} size={bank ? 50 : 56} color={WHITE} width={bank ? 330 : 320} shadow={LIFT} />
      </At>
    </Art>
  );
}

/** 2. The lineup. Playful suspicion: five receipts, one in a joke-shop disguise. */
export function LineupCard({ bank }: { bank?: CardBank }) {
  const text = bank ? `One of them isn’t from ${bank.shortName}.` : "One of them is lying.";
  return (
    <Art name="lineup">
      <At left={0} right={0} top={70}>
        <div style={{ display: "flex", width: "100%", justifyContent: "center" }}>
          <Words text={text} italic={["lying.", `${bank?.shortName}.`]} size={58} color={INK} align="center" width={1100} />
        </div>
      </At>
      <At left={60} top={14}>
        <Mark size={32} color={INK} />
      </At>
    </Art>
  );
}

/** 3. Don't take the bait. A wary smirk: a receipt on a hook, on tomato red. */
export function BaitCard({ bank }: { bank?: CardBank }) {
  const text = bank ? `Fake ${bank.shortName} receipts are bait.` : "Don’t take the bait.";
  return (
    <Art name="bait">
      <At left={60} top={50}>
        <Mark size={34} color={WHITE} />
      </At>
      <At left={322} top={bank ? 170 : 190}>
        <Words text={text} italic={["bait."]} size={bank ? 58 : 66} color={WHITE} width={340} />
      </At>
    </Art>
  );
}

/** 4. One bold 3D object. Satisfaction: a big green tick pressed into a stack of receipts. */
export function CheckCard({ bank }: { bank?: CardBank }) {
  const text = bank ? `Every ${bank.shortName} receipt, checked.` : "Every receipt, checked.";
  return (
    <Art name="check">
      <At left={60} top={50}>
        <Mark size={34} color={WHITE} />
      </At>
      <At left={0} right={0} top={46}>
        <div style={{ display: "flex", width: "100%", justifyContent: "center" }}>
          <Words text={text} italic={["checked."]} size={58} color={WHITE} align="center" width={bank ? 560 : 500} />
        </div>
      </At>
    </Art>
  );
}
