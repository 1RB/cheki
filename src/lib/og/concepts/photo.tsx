/**
 * Round 2 of the exploration (OG_VARIANT light | lineup | bait | check):
 * one emotion, one hero image, a few words.
 *
 * The hero art is generated photography and 3D, saved without any text in
 * public/og/{name}.jpg at exactly 1200x630, so the card is the image plus a
 * headline and the wordmark set in the site's own type.
 *
 * Round 3 (lineup, bait): a blank strip of paper did not say "payment". The
 * objects are now what a merchant is actually shown, a phone on a banking
 * app's green-tick success screen, and the screen's words are set here in
 * Satori on top of the art: "Transfer successful", ETB 25,000.00, a masked
 * reference and a date. All synthetic, the same on every phone, so the
 * lineup's joke lands (they all look the same, one is lying). A bank card
 * puts the bank's name on the screen as plain text, never a logo. light and
 * check keep their blank receipts.
 *
 * Telegram and WhatsApp crop a card to its centre square (x 285 to 915), so
 * the headline and the hero both sit inside it and the amount and
 * "successful" still read at the ~300px a feed shows. The wordmark takes the
 * corner outside the square.
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

/**
 * The success screen every phone in the art shows, synthetic: the words a
 * banking app puts under its green tick. The art keeps the tick and the
 * screen; these are set on the blank part below it, `width` wide.
 */
export const OG_RECEIPT = {
  status: ["Transfer", "successful"],
  currency: "ETB",
  amount: "25,000",
  cents: ".00",
  reference: "FT25\u2022\u2022\u2022\u2022\u2022K7Q",
  date: "08 Oct 2026",
  /** The lineup's liar is identical but for one tell: a date that does not exist. */
  fakeDate: "31 Sep 2026",
} as const;

const SCREEN_INK = "#111111";
const SCREEN_INK2 = "#5a5a5a";

function Screen({ width, bank, fake = false, size = 1 }: { width: number; bank?: CardBank; fake?: boolean; size?: number }) {
  const r = OG_RECEIPT;
  const mono: CSSProperties = { display: "flex", fontFamily: "Mono", fontWeight: 500, fontSize: 9.5 * size, color: SCREEN_INK2 };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width, color: SCREEN_INK }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "Inter", fontWeight: 600, fontSize: 18 * size, lineHeight: 1.06, letterSpacing: "-0.01em" }}>
        {r.status.map((w) => (
          <div key={w} style={{ display: "flex" }}>
            {w}
          </div>
        ))}
      </div>
      <div style={{ ...mono, fontSize: 11 * size, marginTop: 12 * size }}>{r.currency}</div>
      <div style={{ display: "flex", alignItems: "flex-end", fontFamily: "Inter Display", fontWeight: 700, letterSpacing: "-0.03em" }}>
        <div style={{ display: "flex", fontSize: 28 * size, lineHeight: 1 }}>{r.amount}</div>
        <div style={{ display: "flex", fontSize: 15 * size, lineHeight: 1.2 }}>{r.cents}</div>
      </div>
      <div style={{ display: "flex", width: width - 26, borderTop: "1px solid #dcdcdc", marginTop: 10 * size }} />
      <div style={{ ...mono, marginTop: 8 * size }}>{r.reference}</div>
      <div style={{ ...mono, marginTop: 3 * size }}>{fake ? r.fakeDate : r.date}</div>
      <div style={{ ...mono, fontSize: 8.5 * size, color: "#7a7a7a", marginTop: 6 * size, width: width - 14, justifyContent: "center", textAlign: "center", lineHeight: 1.15 }}>
        {bank ? bank.name : "Bank transfer"}
      </div>
    </div>
  );
}

/** Screen words sit on the photo: a hair of blur and opacity so they read as lit pixels, not a sticker. */
const ON_SCREEN: CSSProperties = { opacity: 0.95, filter: "blur(0.3px)" };

let disguise: string | undefined;
/** public/og/lineup-disguise.png: the joke glasses cut out of the lineup art, laid back over the screen words. */
function disguiseUrl(): string {
  disguise ??= `data:image/png;base64,${readFileSync(join(process.cwd(), "public/og", "lineup-disguise.png")).toString("base64")}`;
  return disguise;
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

/** 2. The lineup. Playful suspicion: five phones on the same success screen, one in a joke-shop disguise. */
const PHONES = [164, 379, 602, 828, 1043];
const PHONE_W = 128;

export function LineupCard({ bank }: { bank?: CardBank }) {
  const text = bank ? `One of them isn’t from ${bank.shortName}.` : "One of them is lying.";
  return (
    <Art name="lineup">
      {PHONES.map((cx, i) => (
        <At key={cx} left={cx - PHONE_W / 2} top={400}>
          <div style={{ display: "flex", ...ON_SCREEN }}>
            <Screen width={PHONE_W} bank={bank} fake={i === 2} />
          </div>
        </At>
      ))}
      <At left={517} top={252}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={disguiseUrl()} width={176} height={180} />
      </At>
      <At left={0} right={0} top={bank ? 58 : 70}>
        <div style={{ display: "flex", width: "100%", justifyContent: "center" }}>
          {/* the bank line is longer: two lines, so it stays inside the centre square */}
          <Words text={text} italic={["lying.", `${bank?.shortName}.`]} size={bank ? 54 : 58} color={INK} align="center" width={bank ? 560 : 1100} />
        </div>
      </At>
      <At left={60} top={14}>
        <Mark size={32} color={INK} />
      </At>
    </Art>
  );
}

/** 3. Don't take the bait. A wary smirk: a phone on a fishing hook, on tomato red, showing a payment that never happened. */
const BAIT_W = 126;
const BAIT_H = 190;

export function BaitCard({ bank }: { bank?: CardBank }) {
  const text = bank ? `Fake ${bank.shortName} receipts are bait.` : "Don’t take the bait.";
  return (
    <Art name="bait">
      {/* the phone hangs 8.7° off vertical; the screen's blank half is centred at (804, 474) */}
      <At left={804 - BAIT_W / 2} top={474 - BAIT_H / 2}>
        <div style={{ display: "flex", width: BAIT_W, height: BAIT_H, transform: "rotate(-8.7deg)", ...ON_SCREEN }}>
          <Screen width={BAIT_W} bank={bank} size={1.05} />
        </div>
      </At>
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
