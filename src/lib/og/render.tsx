/**
 * The home and bank card art, picked by OG_VARIANT (src/lib/og/variant.ts).
 * The route files only call these, so switching designs is one setting.
 */
import type { ReactElement } from "react";
import { getBank } from "@/lib/banks";
import { Frame, Headline, LogoMark, ResultCard, withArticle } from "@/lib/og/card";
import { OG_VARIANT, type OgVariant } from "@/lib/og/variant";
import type { CardBank } from "@/lib/og/concepts/parts";
import { StampCard } from "@/lib/og/concepts/stamp";
import { SpotCard } from "@/lib/og/concepts/spot";
import { BanknoteCard } from "@/lib/og/concepts/banknote";
import { ChatCard } from "@/lib/og/concepts/chat";
import { PaidCard } from "@/lib/og/concepts/paid";
import { BaitCard, CheckCard, LightCard, LineupCard } from "@/lib/og/concepts/photo";
import { BitmapCard, EmberCard, MoneylenderCard, PixelsCard } from "@/lib/og/concepts/painted";

function cardBank(code: string): CardBank {
  const b = getBank(code);
  return { code, shortName: b?.shortName ?? code.toUpperCase(), name: b?.name ?? code.toUpperCase(), beta: b?.beta };
}

/** The shipped home card (PR #43). */
function currentHome(): ReactElement {
  const cbe = getBank("cbe");
  return (
    <Frame
      left={<Headline lead="Verify an Ethiopian receipt" rest="against the bank’s own record." size={60} />}
      right={<ResultCard code="cbe" shortName={cbe?.shortName ?? "CBE"} />}
    />
  );
}

/** The shipped bank card (PR #43). */
function currentBank(code: string): ReactElement {
  const bank = getBank(code);
  const name = bank?.shortName ?? code.toUpperCase();
  const live = bank?.status === "live";
  // Telebirr and M-Pesa block cloud servers: cheki.et opens their official
  // receipt page instead of confirming them, so their card shows no verified
  // result until a local relay exists.
  const linkOut = live && bank?.geoBlocked === true;
  const showResult = live && !linkOut;
  const note = !live ? "In development" : bank?.beta ? "Beta" : undefined;
  const fullName = bank?.name ?? name;
  const kicker = (
    <>
      {!showResult && <div style={{ display: "flex", marginRight: 14 }}><LogoMark code={code} size={30} /></div>}
      <span>{note ? `${fullName} · ${note}` : fullName}</span>
    </>
  );
  const lead = linkOut ? `Check ${withArticle(name)} receipt` : `Verify ${withArticle(name)} receipt`;
  const rest = linkOut ? `on ${name}’s official receipt page.` : `against ${name}’s own record.`;
  return (
    <Frame
      left={<Headline kicker={kicker} lead={lead} rest={rest} size={showResult ? 60 : 72} />}
      right={showResult ? <ResultCard code={code} shortName={name} /> : undefined}
    />
  );
}

export function ogHome(variant: OgVariant = OG_VARIANT): ReactElement {
  switch (variant) {
    case "stamp":
      return <StampCard />;
    case "spot":
      return <SpotCard />;
    case "banknote":
      return <BanknoteCard />;
    case "chat":
      // Telebirr is most of the demand, but cheki.et only links out to it until
      // a local relay exists, so the home card shows a bank it confirms.
      return <ChatCard bank={cardBank("cbe")} />;
    case "paid":
      return <PaidCard />;
    case "light":
      return <LightCard />;
    case "lineup":
      return <LineupCard />;
    case "bait":
      return <BaitCard />;
    case "check":
      return <CheckCard />;
    case "moneylender":
      return <MoneylenderCard />;
    case "ember":
      return <EmberCard />;
    case "pixels":
      return <PixelsCard />;
    case "bitmap":
      return <BitmapCard />;
    default:
      return currentHome();
  }
}

export function ogBank(code: string, variant: OgVariant = OG_VARIANT): ReactElement {
  const bank = getBank(code);
  // Every concept shows a bank-confirmed result, which a bank still in
  // development, or one cheki.et only links out to (geoBlocked), cannot give
  // yet, so those keep the shipped card (mark, no result).
  if (variant === "current" || bank?.status !== "live" || bank?.geoBlocked) return currentBank(code);
  const b = cardBank(code);
  switch (variant) {
    case "stamp":
      return <StampCard bank={b} />;
    case "spot":
      return <SpotCard bank={b} />;
    case "banknote":
      return <BanknoteCard bank={b} />;
    case "chat":
      return <ChatCard bank={b} />;
    case "paid":
      return <PaidCard bank={b} />;
    case "light":
      return <LightCard bank={b} />;
    case "lineup":
      return <LineupCard bank={b} />;
    case "bait":
      return <BaitCard bank={b} />;
    case "check":
      return <CheckCard bank={b} />;
    case "moneylender":
      return <MoneylenderCard bank={b} />;
    case "ember":
      return <EmberCard bank={b} />;
    case "pixels":
      return <PixelsCard bank={b} />;
    case "bitmap":
      return <BitmapCard bank={b} />;
  }
}
