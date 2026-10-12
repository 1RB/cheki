/**
 * Round 4 of the exploration: old masters and dithering
 * (OG_VARIANT moneylender | pixels | bitmap | ember).
 *
 * Every card says one thing in a glance: a payment screenshot can be faked,
 * and cheki checks it with the bank. The picture carries the doubt (someone
 * scrutinising a phone on a green-tick success screen); a short headline
 * carries the wit; a plain sub-line spells the point out for anyone who
 * missed it.
 *
 *   - moneylender: Quentin Matsys, The Moneylender and His Wife (1514, public
 *     domain), with a phone in his hand where the scale was.
 *   - pixels: a phone on a success screen, dithered in code to 1-bit: a
 *     screenshot is only pixels.
 *   - bitmap: the moneylender, dithered (the hybrid).
 *   - ember: a generated chiaroscuro oil painting (an Ethiopian merchant
 *     holding a phone up to a candle), dithered in candlelight amber. The
 *     painting in full colour was tried as "candle" and killed: at feed size
 *     it read as stock AI oil painting; the dither keeps the scene and loses
 *     that tell.
 *
 * Dithered art is made by scripts/og-dither.py as a 2- or 3-colour PNG with
 * 5px square dots, so it stays crisp at 1200 wide and still reads as texture,
 * not grey, at the ~300px a chat preview shows. The success tick is the only
 * green on every card.
 *
 * Headline, sub-line and hero sit inside the centre square (x 285 to 915)
 * that Telegram and WhatsApp crop to; the wordmark takes a corner outside it.
 */
import type { CSSProperties, ReactNode } from "react";
import { nobreak } from "@/lib/og/card";
import { Mark, type CardBank } from "./parts";
import { At, heroUrl, Words } from "./photo";

/** Round-4 hero art in public/og, by variant. */
export const OG_ART4 = {
  moneylender: "moneylender.jpg",
  pixels: "pixels.png",
  bitmap: "bitmap.png",
  ember: "ember.png",
} as const;
export type OgArt4 = keyof typeof OG_ART4;

const PAPER = "#f4f0e7";
const AMBER = "#f2c46b";

function Hero({ name, children }: { name: OgArt4; children: ReactNode }) {
  return (
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", overflow: "hidden", fontFamily: "Inter", backgroundColor: "#15120f" }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={heroUrl(OG_ART4[name])} width={1200} height={630} style={{ position: "absolute", left: 0, top: 0 }} />
      {children}
    </div>
  );
}

/** A headline set entirely in the italic display serif: the old-master voice. */
function Serif({ lines, size, color, align = "left", shadow }: { lines: string[]; size: number; color: string; align?: "left" | "center"; shadow?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align === "center" ? "center" : "flex-start", color, ...(shadow ? { textShadow: shadow } : {}) }}>
      {lines.map((l) => (
        <div key={l} style={{ display: "flex", fontFamily: "Serif Display", fontStyle: "italic", fontWeight: 400, fontSize: size, lineHeight: 1.04, letterSpacing: "-0.02em" }}>
          {nobreak(l)}
        </div>
      ))}
    </div>
  );
}

/** The plain sub-line: what the joke means, in words nobody can miss. */
function Sub({ text, width, color, size = 21, align = "left", shadow }: { text: string; width: number; color: string; size?: number; align?: "left" | "center"; shadow?: string }) {
  const style: CSSProperties = { display: "flex", width, fontFamily: "Inter", fontWeight: 500, fontSize: size, lineHeight: 1.3, color, justifyContent: align === "center" ? "center" : "flex-start", textAlign: align, ...(shadow ? { textShadow: shadow } : {}) };
  return <div style={style}>{nobreak(text)}</div>;
}

const DARK_LIFT = "0 2px 18px rgba(0, 0, 0, 0.75)";

/** 1. The Moneylender (Matsys, 1514). Wry recognition: merchants have always doubted payments; now the doubt is a phone. */
export function MoneylenderCard({ bank }: { bank?: CardBank }) {
  const sub = bank ? `A ${bank.shortName} screenshot can be faked. cheki checks it with ${bank.shortName}.` : "A screenshot can be faked. cheki checks it with the bank.";
  return (
    <Hero name="moneylender">
      <At left={60} top={44}>
        <Mark size={32} color={PAPER} />
      </At>
      <At left={0} right={0} top={22}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
          <Serif lines={["Checking payments", "since 1514."]} size={56} color={PAPER} align="center" shadow={DARK_LIFT} />
          <div style={{ display: "flex", marginTop: 10 }}>
            <Sub text={sub} width={560} size={20} color="rgba(244,240,231,0.82)" align="center" shadow={DARK_LIFT} />
          </div>
        </div>
      </At>
    </Hero>
  );
}

/** 2. By candlelight, in amber dots. Quiet suspicion: a merchant holds the phone to the flame, the way you'd hold a banknote. */
export function EmberCard({ bank }: { bank?: CardBank }) {
  const sub = bank ? `Screenshots can be faked. cheki checks them with ${bank.shortName}.` : "Screenshots can be faked. cheki checks them with the bank.";
  return (
    <Hero name="ember">
      <At left={60} top={44}>
        <Mark size={32} color={AMBER} />
      </At>
      <At left={304} top={70}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Serif lines={["Looks paid.", "Is it?"]} size={74} color={AMBER} />
          <div style={{ display: "flex", marginTop: 20 }}>
            <Sub text={sub} width={232} size={21} color="rgba(242,196,107,0.85)" />
          </div>
        </div>
      </At>
    </Hero>
  );
}

/** 3. Just pixels. Disillusion with a grin: the dither shows what a screenshot really is. */
export function PixelsCard({ bank }: { bank?: CardBank }) {
  const sub = bank ? `Anyone can fake one. cheki checks it with ${bank.shortName}, in seconds.` : "Anyone can fake one. cheki checks it with the bank, in seconds.";
  return (
    <Hero name="pixels">
      <At left={60} top={44}>
        <Mark size={32} color={PAPER} />
      </At>
      <At left={304} top={110}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Words text="Screenshots are just pixels." italic={["pixels."]} size={56} color={PAPER} width={310} />
          <div style={{ display: "flex", marginTop: 22 }}>
            <Sub text={sub} width={255} size={21} color="rgba(244,240,231,0.8)" />
          </div>
        </div>
      </At>
    </Hero>
  );
}

/** 4. The hybrid: the 1514 moneylender in 1-bit. Deadpan authority: old wisdom, new medium. */
export function BitmapCard({ bank }: { bank?: CardBank }) {
  const first = bank ? `Trust ${bank.shortName},` : "Trust the bank,";
  const sub = bank ? `cheki checks any ${bank.shortName} receipt with ${bank.shortName}, in seconds.` : "cheki checks any receipt with the bank, in seconds.";
  return (
    <Hero name="bitmap">
      <At left={60} top={44}>
        <Mark size={32} color={PAPER} />
      </At>
      <At left={0} right={0} top={24}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
          <Words text={first} size={50} color={PAPER} align="center" width={620} />
          <Words text="not the screenshot." italic={["screenshot."]} size={50} color={PAPER} align="center" width={620} />
          <div style={{ display: "flex", marginTop: 12 }}>
            <Sub text={sub} width={560} size={20} color="rgba(244,240,231,0.8)" align="center" />
          </div>
        </div>
      </At>
    </Hero>
  );
}
