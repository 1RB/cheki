import { ImageResponse } from "next/og";
import { Frame, Headline, ResultCard, OG_SIZE, ogFonts } from "@/lib/og/card";
import { getBank } from "@/lib/banks";

export const runtime = "nodejs";
export const alt = "cheki: verify an Ethiopian receipt against the bank's own record";
export const size = OG_SIZE;
export const contentType = "image/png";

// The home card: the hero line, and the product as a verified CBE result
// (synthetic amount and reference). No counts: a shared card is cached by
// the platforms long after a number on it changes.
export default async function OpenGraphImage() {
  const cbe = getBank("cbe");
  return new ImageResponse(
    (
      <Frame
        left={<Headline lead="Verify an Ethiopian receipt" rest="against the bank’s own record." size={60} />}
        right={<ResultCard code="cbe" shortName={cbe?.shortName ?? "CBE"} />}
      />
    ),
    { ...size, fonts: await ogFonts() }
  );
}
