import { Nav, Footer } from "@/components/Chrome";

export default function NotFound() {
  return (
    <>
      <Nav />
      <main className="container" style={{
        paddingTop: "80px",
        paddingBottom: "120px",
        textAlign: "center",
        maxWidth: "600px",
        margin: "0 auto",
      }}>
        <h1 style={{
          fontSize: "clamp(32px, 6vw, 48px)",
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: "var(--ink)",
          marginBottom: "12px",
        }}>
          Page not found
        </h1>
        <p style={{
          fontSize: "17px",
          color: "var(--ink-2)",
          lineHeight: 1.6,
          marginBottom: "32px",
        }}>
          The page you're looking for doesn't exist or has moved. Try one of these instead:
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/" style={{
            padding: "12px 24px",
            borderRadius: "8px",
            background: "var(--green)",
            color: "#fff",
            fontSize: "14px",
            fontWeight: 600,
          }}>
            Verify a receipt
          </a>
          <a href="/guides" style={{
            padding: "12px 24px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            color: "var(--ink)",
            fontSize: "14px",
            fontWeight: 500,
            background: "var(--surface)",
          }}>
            Browse guides
          </a>
          <a href="/banks" style={{
            padding: "12px 24px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            color: "var(--ink)",
            fontSize: "14px",
            fontWeight: 500,
            background: "var(--surface)",
          }}>
            All banks
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
}
