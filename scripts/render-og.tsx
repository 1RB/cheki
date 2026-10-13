/**
 * Render every OG_VARIANT's home card and one bank card to PNGs, through the
 * same ImageResponse the routes use, so designs can be compared side by side
 * without a build:
 *
 *   npx tsx scripts/render-og.tsx [outDir] [bank=cbe]
 *
 * Writes {outDir}/{variant}-home.png and {outDir}/{variant}-{bank}.png.
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { ImageResponse } from "next/og";
import { OG_SIZE, ogFonts } from "@/lib/og/card";
import { ogBank, ogHome } from "@/lib/og/render";
import { OG_VARIANTS } from "@/lib/og/variant";

async function main() {
  const out = process.argv[2] ?? "og-renders";
  const bank = process.argv[3] ?? "cbe";
  mkdirSync(out, { recursive: true });
  const fonts = await ogFonts();
  for (const v of OG_VARIANTS) {
    for (const [name, el] of [["home", ogHome(v)], [bank, ogBank(bank, v)]] as const) {
      const res = new ImageResponse(el, { ...OG_SIZE, fonts });
      const file = join(out, `${v}-${name}.png`);
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      console.log(file);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
