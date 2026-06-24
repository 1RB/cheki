import { Nav, Footer } from "@/components/Chrome";
import { Glitch404 } from "@/components/motion/glitch-404";

export default function NotFound() {
  return (
    <>
      <Nav />
      <main
        className="container"
        style={{
          paddingTop: "80px",
          paddingBottom: "120px",
          textAlign: "center",
          maxWidth: "600px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Animated glitch 404 — scramble + chromatic split */}
        <div style={{ marginBottom: "28px" }}>
          <Glitch404 />
        </div>

        <h1
          style={{
            fontSize: "clamp(28px, 5vw, 40px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--ink)",
            marginBottom: "12px",
          }}
        >
          Page not found
        </h1>

        <p
          style={{
            fontSize: "17px",
            color: "var(--ink-2)",
            lineHeight: 1.6,
            marginBottom: "32px",
            maxWidth: "440px",
          }}
        >
          The page you're looking for doesn't exist or may have moved.
          Try one of these instead:
        </p>

        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {/* Green primary — verify */}
          <a
            href="/"
            style={{
              padding: "12px 24px",
              borderRadius: "8px",
              background: "var(--green)",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 600,
              display: "inline-block",
            }}
          >
            Verify a receipt
          </a>

          {/* Outline — guides */}
          <a
            href="/guides"
            style={{
              padding: "12px 24px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              color: "var(--ink)",
              fontSize: "14px",
              fontWeight: 500,
              background: "var(--surface)",
              display: "inline-block",
            }}
          >
            Browse guides
          </a>

          {/* Outline — banks */}
          <a
            href="/banks"
            style={{
              padding: "12px 24px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              color: "var(--ink)",
              fontSize: "14px",
              fontWeight: 500,
              background: "var(--surface)",
              display: "inline-block",
            }}
          >
            All banks
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
}
