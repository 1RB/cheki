import { ImageResponse } from "next/og";
import { OG_SIZE, ogFonts } from "@/lib/og/card";
import { ogHome } from "@/lib/og/render";

export const runtime = "nodejs";
export const alt = "cheki: verify an Ethiopian receipt against the bank's own record";
export const size = OG_SIZE;
export const contentType = "image/png";

// The home card. Which design it uses is OG_VARIANT (src/lib/og/variant.ts);
// the default is the shipped one: the hero line and a verified CBE result
// (synthetic amount and reference). No counts: a shared card is cached by
// the platforms long after a number on it changes.
export default async function OpenGraphImage() {
  return new ImageResponse(ogHome(), { ...size, fonts: await ogFonts() });
}
