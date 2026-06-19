import { ImageResponse } from "next/og";
import { allSeoPages, getSeoPage } from "@/lib/seo-pages";

export const alt = "cheki - Ethiopian Receipt Verification";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return allSeoPages.map((p) => ({ slug: p.slug }));
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getSeoPage(slug);
  const title = page?.h1 || "Verify Ethiopian Receipts";
  const tagline = page?.bankCode
    ? `${page.bankCode.toUpperCase()} receipt verification`
    : "Free receipt verification";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#080808", color: "#faf9f6", fontFamily: "system-ui, sans-serif", padding: "60px", borderTop: "6px solid #16a34a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "36px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "52px", height: "52px", backgroundColor: "#16a34a", fontSize: "28px", fontWeight: 800, color: "#fff" }}>c</div>
          <div style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-0.03em" }}>cheki</div>
          <div style={{ fontSize: "18px", fontWeight: 600, color: "#888", marginLeft: "8px" }}>{tagline}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1, justifyContent: "center" }}>
          <div style={{ fontSize: "48px", fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.02em" }}>{title}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", borderTop: "2px solid #222", paddingTop: "24px" }}>
          <div style={{ fontSize: "20px", fontWeight: 600, color: "#16a34a", border: "2px solid #16a34a", padding: "6px 18px" }}>Free, no signup, no API key</div>
          <div style={{ marginLeft: "auto", fontSize: "16px", color: "#666" }}>cheki.app</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
