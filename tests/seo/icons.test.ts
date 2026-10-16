/**
 * Site icons (src/app file conventions): favicon.ico, icon.png and
 * apple-icon.png, derived from public/logo.png. They replace the default
 * Next.js favicon, so /icon.png and /apple-icon.png resolve on cheki.et.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const buf = (p: string) => readFileSync(join(ROOT, p));

function pngSize(b: Buffer) {
  expect(b.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe("site icons", () => {
  it("favicon.ico holds 16, 32 and 48 px images", () => {
    const b = buf("src/app/favicon.ico");
    expect(b.readUInt16LE(2)).toBe(1); // type: icon
    const n = b.readUInt16LE(4);
    const sizes = Array.from({ length: n }, (_, i) => b[6 + i * 16] || 256).sort((x, y) => x - y);
    expect(sizes).toEqual([16, 32, 48]);
    // Next's ICO decoder rejects PNG entries that are not RGBA (colour type 6).
    for (let i = 0; i < n; i++) {
      const off = b.readUInt32LE(6 + i * 16 + 12);
      if (b.subarray(off + 1, off + 4).toString("ascii") === "PNG") expect(b[off + 25], `entry ${i}`).toBe(6);
    }
  });

  it("icon.png is 512x512 and apple-icon.png is 180x180", () => {
    expect(pngSize(buf("src/app/icon.png"))).toEqual({ w: 512, h: 512 });
    expect(pngSize(buf("src/app/apple-icon.png"))).toEqual({ w: 180, h: 180 });
  });

  it("the layout leaves icons to the file conventions (no apple-touch-icon pointing at the .ico)", () => {
    const layout = readFileSync(join(ROOT, "src/app/layout.tsx"), "utf8");
    expect(layout).not.toMatch(/apple-touch-icon/);
    expect(layout).not.toMatch(/apple: "\/favicon\.ico"/);
  });

  it("the web manifest lists the PNG icons", () => {
    const m = readFileSync(join(ROOT, "src/app/manifest.ts"), "utf8");
    expect(m).toContain('src: "/icon.png", sizes: "512x512"');
    expect(m).toContain('src: "/apple-icon.png", sizes: "180x180"');
  });
});
