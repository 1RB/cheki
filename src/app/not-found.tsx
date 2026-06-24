import { Nav, Footer } from "@/components/Chrome";
import { NotFound404 } from "@/components/motion/glitch-404";

export default function NotFound() {
  return (
    <>
      <Nav />
      <main
        className="container"
        style={{
          paddingTop: "80px",
          paddingBottom: "120px",
          maxWidth: "520px",
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <NotFound404 />

        <h1
          style={{
            fontSize: "24px",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
            marginBottom: "8px",
            marginTop: "8px",
          }}
        >
          Page not found
        </h1>

        <p
          style={{
            fontSize: "15px",
            color: "var(--ink-2)",
            lineHeight: 1.6,
            marginBottom: "32px",
          }}
        >
          The page you're looking for doesn't exist or has moved.
        </p>

        <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
          <a
            href="/"
            style={{
              padding: "12px 24px",
              borderRadius: "10px",
              background: "var(--green)",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Verify a receipt
          </a>
          <a
            href="/guides"
            style={{
              padding: "12px 24px",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              color: "var(--ink)",
              fontSize: "14px",
              fontWeight: 500,
              background: "var(--surface)",
              textDecoration: "none",
            }}
          >
            Browse guides
          </a>
          <a
            href="/banks"
            style={{
              padding: "12px 24px",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              color: "var(--ink)",
              fontSize: "14px",
              fontWeight: 500,
              background: "var(--surface)",
              textDecoration: "none",
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
