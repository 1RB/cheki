import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const alt = "cheki - verify Ethiopian receipts for free";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadFontFile(path: string) {
  try {
    return await readFile(path);
  } catch {
    return null;
  }
}

export default async function OpenGraphImage() {
  const boldPath = join(process.cwd(), "node_modules/@fontsource/inter/files/inter-latin-700-normal.woff");
  const regularPath = join(process.cwd(), "node_modules/@fontsource/inter/files/inter-latin-400-normal.woff");
  const bold = await loadFontFile(boldPath);
  const regular = await loadFontFile(regularPath);

  const fonts = [
    { name: "Inter", data: bold, weight: 700 as const, style: "normal" as const },
    { name: "Inter", data: regular, weight: 400 as const, style: "normal" as const },
  ].filter((f) => f.data) as {
    name: string;
    data: Buffer;
    weight: 400 | 700;
    style: "normal";
  }[];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#faf9f6",
          color: "#1a1a1a",
          padding: 64,
          fontFamily: fonts.length ? "Inter, system-ui, sans-serif" : "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.04em" }}>cheki</span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#16a34a",
              border: "1px solid #bbf7d0",
              padding: "4px 10px",
              borderRadius: 6,
              background: "#dcfce7",
              letterSpacing: "0.02em",
            }}
          >
            OSS
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 900 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: "100%" }}>
            <div
              style={{
                fontSize: 64,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                whiteSpace: "nowrap",
              }}
            >
              Verify any Ethiopian receipt.
            </div>
            <div
              style={{
                fontSize: 64,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                color: "#16a34a",
              }}
            >
              Free. Forever.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontSize: 24,
              fontWeight: 500,
              color: "#666",
            }}
          >
            <span>No signup</span>
            <span style={{ color: "#d4d4d4" }}>•</span>
            <span>No API key</span>
            <span style={{ color: "#d4d4d4" }}>•</span>
            <span>No scam</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 500, color: "#888" }}>
            chekiapp.vercel.app
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#16a34a",
              }}
            />
            <span style={{ fontSize: 18, fontWeight: 600, color: "#16a34a" }}>
              9 live banks
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
    }
  );
}
