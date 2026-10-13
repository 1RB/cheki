import { ImageResponse } from "next/og";
import { banks } from "@/lib/banks";
import { OG_SIZE, ogFonts } from "@/lib/og/card";
import { ogBank } from "@/lib/og/render";

export const runtime = "nodejs";
export const alt = "cheki: verify a bank receipt against the bank's own record";
export const size = OG_SIZE;
export const contentType = "image/png";
// Every bank page has its card built at build time; unknown codes 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return banks.map((b) => ({ code: b.code }));
}

// "Verify a {Bank} receipt" and that bank's verified result, in the design
// OG_VARIANT picks (src/lib/og/variant.ts). Beta banks say so in quiet text;
// banks still in development show only their mark in every variant, since a
// verified result would claim something cheki cannot do for them yet.
export default async function OgImage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return new ImageResponse(ogBank(code), { ...size, fonts: await ogFonts() });
}
