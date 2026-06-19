import { ImageResponse } from "next/og";

export const alt = "cheki - Free Ethiopian Receipt Verification";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#080808",
          color: "#faf9f6",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "60px",
          position: "relative",
        }}
      >
        {/* Top border accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "6px",
            backgroundColor: "#16a34a",
          }}
        />

        {/* Logo / wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              backgroundColor: "#16a34a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #16a34a",
              fontSize: "32px",
              fontWeight: 800,
              color: "#fff",
            }}
          >
            c
          </div>
          <div
            style={{
              fontSize: "44px",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "#faf9f6",
            }}
          >
            cheki
          </div>
        </div>

        {/* Main headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            flex: 1,
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: "56px",
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              color: "#faf9f6",
            }}
          >
            Verify Ethiopian receipts.
          </div>
          <div
            style={{
              fontSize: "56px",
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              color: "#16a34a",
            }}
          >
            Free. Forever.
          </div>
        </div>

        {/* Bottom tagline row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            borderTop: "2px solid #222",
            paddingTop: "28px",
          }}
        >
          <div
            style={{
              fontSize: "22px",
              fontWeight: 600,
              color: "#888",
            }}
          >
            CBE - Telebirr - BOA - M-Pesa - Dashen - Awash
          </div>
          <div
            style={{
              marginLeft: "auto",
              fontSize: "18px",
              fontWeight: 600,
              color: "#16a34a",
              border: "2px solid #16a34a",
              padding: "8px 20px",
            }}
          >
            No signup. No API key.
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
