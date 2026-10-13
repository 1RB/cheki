/**
 * Open Graph cards (src/lib/og, src/app/**\/opengraph-image.tsx):
 *   - the receipt on a card is synthetic: a DEMO reference, never receipt data
 *   - no hardcoded counts, no "OSS" pill, no "Free. Forever." line
 *   - the fonts the cards load exist (a missing file would fall back to tofu)
 *   - copy helpers: "a"/"an", and M-Pesa never breaks at its hyphen
 *   - OG_VARIANT defaults to the shipped design, and every Ethiopic character
 *     an exploration card uses is in the subset font (no tofu)
 *   - every round-2 hero image exists, is a 1200x630 JPEG and stays small
 *   - every round-4 hero image (painting or dither) exists, is 1200x630 and
 *     stays small, and the dithered ones are true palette PNGs
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { demoReference, nobreak, withArticle } from "@/lib/og/card";
import { BANK_LOGOS, bankLogoSpec } from "@/lib/bank-logos";
import { banks } from "@/lib/banks";
import { OG_VARIANTS, resolveOgVariant } from "@/lib/og/variant";
import { OG_AMHARIC } from "@/lib/og/concepts/parts";
import { OG_ART } from "@/lib/og/concepts/photo";
import { OG_ART4 } from "@/lib/og/concepts/painted";

const root = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const OG_FILES = [
  "src/lib/og/card.tsx",
  "src/app/opengraph-image.tsx",
  "src/app/twitter-image.tsx",
  "src/app/banks/[code]/opengraph-image.tsx",
  "src/lib/og/render.tsx",
  "src/lib/og/concepts/parts.tsx",
  "src/lib/og/concepts/stamp.tsx",
  "src/lib/og/concepts/spot.tsx",
  "src/lib/og/concepts/banknote.tsx",
  "src/lib/og/concepts/chat.tsx",
  "src/lib/og/concepts/paid.tsx",
  "src/lib/og/concepts/photo.tsx",
  "src/lib/og/concepts/painted.tsx",
];

/** Code points a TrueType font maps (cmap formats 4 and 12). */
function cmapCodepoints(buf: Buffer): Set<number> {
  const numTables = buf.readUInt16BE(4);
  let cmap = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (buf.toString("ascii", rec, rec + 4) === "cmap") cmap = buf.readUInt32BE(rec + 8);
  }
  const out = new Set<number>();
  const n = buf.readUInt16BE(cmap + 2);
  for (let i = 0; i < n; i++) {
    const sub = cmap + buf.readUInt32BE(cmap + 4 + i * 8 + 4);
    const format = buf.readUInt16BE(sub);
    if (format === 4) {
      const segX2 = buf.readUInt16BE(sub + 6);
      const ends = sub + 14;
      const starts = ends + segX2 + 2;
      for (let k = 0; k < segX2 / 2; k++) {
        const end = buf.readUInt16BE(ends + k * 2);
        const start = buf.readUInt16BE(starts + k * 2);
        if (start === 0xffff) continue;
        for (let c = start; c <= end; c++) out.add(c);
      }
    } else if (format === 12) {
      const groups = buf.readUInt32BE(sub + 12);
      for (let g = 0; g < groups; g++) {
        const start = buf.readUInt32BE(sub + 16 + g * 12);
        const end = buf.readUInt32BE(sub + 20 + g * 12);
        for (let c = start; c <= end; c++) out.add(c);
      }
    }
  }
  return out;
}

describe("OG cards", () => {
  it("every bank's card reference is an obvious DEMO value", () => {
    for (const b of banks) expect(demoReference(b.code), b.code).toMatch(/DEMO/);
  });

  it("carry no counts, pills or stale slogans", () => {
    for (const f of OG_FILES) {
      const src = read(f);
      expect(src, f).not.toMatch(/BANK_COUNT|liveProviders\.length/);
      expect(src, f).not.toMatch(/>\s*OSS\s*</);
      expect(src, f).not.toMatch(/Free\. Forever/);
      expect(src, f).not.toMatch(/linear-gradient|radial-gradient/);
      expect(src, f).not.toMatch(/textTransform:\s*"uppercase"/);
    }
  });

  it("load fonts that exist", () => {
    const src = read("src/lib/og/card.tsx");
    const files = [...src.matchAll(/file: "([^"]+\.ttf)"/g)].map((m) => m[1]);
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const f of files) expect(existsSync(join(root, "src/lib/og/fonts", f)), f).toBe(true);
  });

  it("pick a/an and keep hyphenated names whole", () => {
    expect(withArticle("CBE")).toBe("a CBE");
    expect(withArticle("Awash")).toBe("an Awash");
    expect(withArticle("eBirr")).toBe("an eBirr");
    expect(withArticle("M-Pesa")).toBe("an M-Pesa");
    expect(nobreak("M-Pesa")).toBe("M\u2011Pesa");
  });

  it("bank marks match the checker's logos", () => {
    expect(bankLogoSpec("cbe")).toEqual(BANK_LOGOS.cbe);
    expect(bankLogoSpec("zamzam").label).toBe("ZZB");
    expect(bankLogoSpec("hijra")).toMatchObject({ label: "HIJ", color: "#666" });
  });

  it("OG_VARIANT defaults to the shipped design and ignores unknown values", () => {
    expect(OG_VARIANTS[0]).toBe("current");
    expect(resolveOgVariant(undefined)).toBe("current");
    expect(resolveOgVariant("")).toBe("current");
    expect(resolveOgVariant("nope")).toBe("current");
    expect(resolveOgVariant(" Stamp ")).toBe("stamp");
    for (const v of OG_VARIANTS) expect(resolveOgVariant(v)).toBe(v);
  });

  it("every Ethiopic character on a card is in the subset font", () => {
    const font = cmapCodepoints(readFileSync(join(root, "src/lib/og/fonts/NotoSerifEthiopic-Black.ttf")));
    const used = new Set<string>();
    for (const f of OG_FILES) for (const ch of read(f)) if (/[\u1200-\u139F\u2D80-\u2DDF]/.test(ch)) used.add(ch);
    for (const ch of OG_AMHARIC) used.add(ch);
    expect(used.size).toBeGreaterThan(0);
    for (const ch of used) {
      expect(OG_AMHARIC, `${ch} missing from OG_AMHARIC`).toContain(ch);
      expect(font.has(ch.codePointAt(0)!), `${ch} missing from the subset font`).toBe(true);
    }
    // the subset script builds the font from the same list
    expect(read("scripts/subset-og-fonts.sh")).toContain(`OG_AMHARIC="${OG_AMHARIC}"`);
  });

  it("ships every round-2 hero image as a small 1200x630 JPEG", () => {
    for (const name of OG_ART) {
      expect(OG_VARIANTS, name).toContain(name);
      const file = join(root, "public/og", `${name}.jpg`);
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size, file).toBeLessThan(300 * 1024);
      const buf = readFileSync(file);
      expect(buf.readUInt16BE(0), `${name} is a JPEG`).toBe(0xffd8);
      // the first SOFn marker holds the frame size
      let i = 2;
      while (i < buf.length) {
        const marker = buf.readUInt16BE(i);
        const len = buf.readUInt16BE(i + 2);
        if (marker >= 0xffc0 && marker <= 0xffcf && marker !== 0xffc4 && marker !== 0xffc8 && marker !== 0xffcc) {
          expect([buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)], name).toEqual([1200, 630]);
          break;
        }
        i += 2 + len;
      }
    }
  });

  it("ships every round-4 hero image at 1200x630 and under 300KB", () => {
    for (const [name, fileName] of Object.entries(OG_ART4)) {
      expect(OG_VARIANTS, name).toContain(name);
      const file = join(root, "public/og", fileName);
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size, file).toBeLessThan(300 * 1024);
      const buf = readFileSync(file);
      if (fileName.endsWith(".png")) {
        // IHDR: width, height, bit depth, colour type 3 (indexed) for the dithers
        expect(buf.toString("ascii", 1, 4), name).toBe("PNG");
        expect([buf.readUInt32BE(16), buf.readUInt32BE(20)], name).toEqual([1200, 630]);
        expect(buf[25], `${name} is a palette PNG`).toBe(3);
      } else {
        expect(buf.readUInt16BE(0), `${name} is a JPEG`).toBe(0xffd8);
      }
    }
  });

  it("ships the lineup's disguise cut-out that sits over the screen words", () => {
    const file = join(root, "public/og", "lineup-disguise.png");
    expect(existsSync(file), file).toBe(true);
    expect(statSync(file).size, file).toBeLessThan(100 * 1024);
    expect(read("src/lib/og/concepts/photo.tsx")).toContain("lineup-disguise.png");
  });

  it("spells the Amharic right", () => {
    // ተረጋግጧል "verified", ከፍያለሁ "I've paid", ብር "birr"
    expect(OG_AMHARIC).toContain("\u1270\u1228\u130B\u130D\u1327\u120D");
    expect(OG_AMHARIC).toContain("\u12A8\u134D\u12EB\u1208\u1201");
    expect(OG_AMHARIC).toContain("\u1265\u122D");
  });
});
