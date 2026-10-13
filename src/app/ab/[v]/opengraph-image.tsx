import { ImageResponse } from "next/og";
import { OG_SIZE, ogFonts } from "@/lib/og/card";
import { ogHome } from "@/lib/og/render";
import { OG_AB, OG_ARMS, isOgArm } from "@/lib/og/ab";

export const runtime = "nodejs";
export const alt = "cheki: verify an Ethiopian receipt against the bank's own record";
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamicParams = false;

export function generateStaticParams() {
  return OG_ARMS.map((v) => ({ v }));
}

// The home card for one arm of the share-link test (src/lib/og/ab.ts).
export default async function AbOgImage({ params }: { params: Promise<{ v: string }> }) {
  const { v } = await params;
  const variant = isOgArm(v) ? OG_AB[v] : undefined;
  return new ImageResponse(ogHome(variant), { ...size, fonts: await ogFonts() });
}
