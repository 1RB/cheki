import { ImageResponse } from "next/og";
import { banks, getBank } from "@/lib/banks";

export const alt = "cheki - Bank Receipt Verification";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return banks.filter(b => b.status === "live").map((b) => ({ code: b.code }));
}

export default async function OgImage({ params }: { params: { code: string } }) {
  const bank = getBank(params.code);
  const bankName = bank?.shortName || bank?.name || "Bank";
  const bankFullName = bank?.name || "Ethiopian Bank";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#080808", color: "#faf9f6", fontFamily: "system-ui, sans-serif", padding: "60px", borderTop: "6px solid #16a34a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "36px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "52px", height: "52px", backgroundColor: "#16a34a", fontSize: "28px", fontWeight: 800, color: "#fff" }}>c</div>
          <div style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-0.03em" }}>cheki</div>
          <div style={{ fontSize: "18px", fontWeight: 600, color: "#888", marginLeft: "8px" }}>{bankName} verification</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1, justifyContent: "center" }}>
          <div style={{ fontSize: "52px", fontWeight: 800, lineHeight: 1.12, letterSpacing: "-0.02em" }}>Verify {bankFullName}</div>
          <div style={{ fontSize: "52px", fontWeight: 800, lineHeight: 1.12, letterSpacing: "-0.02em", color: "#16a34a" }}>Receipts for free.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", borderTop: "2px solid #222", paddingTop: "24px" }}>
          <div style={{ fontSize: "20px", fontWeight: 600, color: "#16a34a", border: "2px solid #16a34a", padding: "6px 18px" }}>Free, no signup, instant</div>
          <div style={{ marginLeft: "auto", fontSize: "16px", color: "#666" }}>cheki.app/banks/{params.code}</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
