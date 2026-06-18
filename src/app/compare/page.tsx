import type { Metadata } from "next";
import { Nav, Footer } from "@/components/Chrome";

export const metadata: Metadata = {
  title: "cheki vs check.et vs verify.et — Full Comparison",
  description: "Detailed comparison of cheki (free, open source) vs check.et (499 ETB/mo) vs verify.et ($20+/mo). Features, pricing, banks, API, and transparency.",
};

export default function ComparePage() {
  const features = [
    { feature: "Price", cheki: "Free forever", checket: "499 ETB/mo or 4,990/yr", verifyet: "$20-40/mo" },
    { feature: "Free verifications", cheki: "Unlimited", checket: "200 (one-time)", verifyet: "200 (one-time)" },
    { feature: "API key required", cheki: "No", checket: "Yes (business account)", verifyet: "Yes" },
    { feature: "Signup required", cheki: "No", checket: "Yes", verifyet: "Yes (Telegram OAuth)" },
    { feature: "Open source", cheki: "Yes (MIT)", checket: "No", verifyet: "No" },
    { feature: "Self-hosting", cheki: "Yes (Docker)", checket: "No", verifyet: "No" },
    { feature: "REST API", cheki: "Yes (free)", checket: "Yes (paid)", verifyet: "Yes (paid)" },
    { feature: "Batch verification", cheki: "Yes (50 at once)", checket: "No", verifyet: "No" },
    { feature: "Python library", cheki: "Yes", checket: "No", verifyet: "No (SDK only)" },
    { feature: "TypeScript SDK", cheki: "Yes", checket: "No", verifyet: "Yes" },
    { feature: "Bank guides", cheki: "Yes", checket: "Yes", verifyet: "No (blog only)" },
    { feature: "AI crawler access", cheki: "Allowed", checket: "Not blocked", verifyet: "Blocked (GPTBot, ClaudeBot, etc.)" },
    { feature: "Receipt source URL", cheki: "Shown to user", checket: "Hidden", verifyet: "Hidden" },
    { feature: "Data source", cheki: "Public bank endpoints", checket: "Same public endpoints", verifyet: "Same public endpoints" },
  ];

  return (
    <>
      <Nav />
      <main className="container" style={{ paddingTop: "48px", paddingBottom: "48px" }}>
        <nav style={{ fontSize: "13px", color: "var(--ink-3)", marginBottom: "16px" }}>
          <a href="/" style={{ color: "var(--ink-3)" }}>Home</a>
          <span style={{ margin: "0 6px"}}>/</span>
          <span style={{ color: "var(--ink)" }}>Compare</span>
        </nav>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "16px" }}>
          cheki vs check.et vs verify.et
        </h1>
        <p style={{ color: "var(--ink-2)", fontSize: "17px", maxWidth: "640px", marginBottom: "32px" }}>
          All three services verify receipts by fetching the same public bank endpoints. The difference is that cheki is free and open source, while check.et and verify.et charge you for the same data.
        </p>

        {/* Comparison table */}
        <div style={{ overflowX: "auto", marginBottom: "40px" }}>
          <table style={{
            width: "100%", borderCollapse: "collapse", fontSize: "14px",
            background: "var(--surface)", borderRadius: "12px", overflow: "hidden",
          }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "16px", fontWeight: 700 }}>Feature</th>
                <th style={{ textAlign: "left", padding: "16px", fontWeight: 700, color: "var(--green)" }}>cheki</th>
                <th style={{ textAlign: "left", padding: "16px", fontWeight: 700, color: "var(--red)" }}>check.et</th>
                <th style={{ textAlign: "left", padding: "16px", fontWeight: 700, color: "var(--red)" }}>verify.et</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => (
                <tr key={f.feature} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)" }}>
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: "var(--ink)" }}>{f.feature}</td>
                  <td style={{ padding: "14px 16px", color: "var(--green-dark)", fontWeight: 500 }}>{f.cheki}</td>
                  <td style={{ padding: "14px 16px", color: "var(--ink-2)" }}>{f.checket}</td>
                  <td style={{ padding: "14px 16px", color: "var(--ink-2)" }}>{f.verifyet}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* The story */}
        <div style={{
          padding: "32px", borderRadius: "12px", background: "var(--red-light)", border: "1px solid #fecaca", marginBottom: "32px",
        }}>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "var(--red)", marginBottom: "16px" }}>The story</h2>
          <p style={{ color: "#7f1d1d", fontSize: "15px", lineHeight: 1.7, marginBottom: "12px" }}>
            Every Ethiopian bank and mobile wallet publishes transaction receipts at public URLs. These URLs require no authentication. Anyone can access them. This is not a security flaw; it is by design. Banks want merchants to be able to verify payments.
          </p>
          <p style={{ color: "#7f1d1d", fontSize: "15px", lineHeight: 1.7, marginBottom: "12px" }}>
            <strong>check.et</strong> was built on top of these public endpoints. It adds authentication, a dashboard, and a pricing model. For 200 verifications, it is free. After that, it charges 499 ETB/month or 4,990 ETB/year. The data is identical to what cheki returns for free.
          </p>
          <p style={{ color: "#7f1d1d", fontSize: "15px", lineHeight: 1.7, marginBottom: "12px" }}>
            <strong>verify.et</strong> does the same thing, but charges in USD ($20-40/month). It also blocks AI crawlers (GPTBot, ClaudeBot, CCBot, Google-Extended) in its robots.txt, presumably to prevent users from discovering that the data is public. Made by Suba Software.
          </p>
          <p style={{ color: "#7f1d1d", fontSize: "15px", lineHeight: 1.7, marginBottom: "12px" }}>
            <strong>cheki</strong> does the same thing as both services, but is free, open source, and transparent. We show you the exact bank endpoint URL we fetched the data from. We allow AI crawlers to index our content. We let you self-host on your own infrastructure. No one owns the public bank endpoints. No one should charge you for accessing them.
          </p>
        </div>

        {/* Other OSS competitors */}
        <h2 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "16px" }}>Other open source projects</h2>
        <div className="grid-2" style={{ gap: "16px" }}>
          {[
            { name: "ethiobank_receipts", stars: "40", url: "https://github.com/NahomAl/ethiobank_receipts", desc: "Python library, 6 banks, requires Selenium for BOA, no web UI, no API, PyPI published" },
            { name: "verification-engine", stars: "1", url: "https://github.com/oneshotEFA/verification-engine", desc: "TypeScript engine, 4 banks, 5 verification methods, npm published as @localpay/verification-engine" },
            { name: "telebirr-receipt", stars: "14", url: "https://github.com/TheRealYT/telebirr-receipt", desc: "Node.js package for Telebirr receipt parsing only, npm published" },
            { name: "receipt_verify", stars: "2", url: "https://github.com/TsinatKibru/receipt_verify", desc: "NestJS + PostgreSQL backend, Telebirr + CBE, duplicate prevention, Prisma ORM" },
            { name: "veri-py", stars: "0", url: "https://github.com/nahom-d54/veri-py", desc: "Python toolkit, async/sync, 6 banks, image verification via OpenAI, PyPI published" },
            { name: "receipt-verifier", stars: "0", url: "https://github.com/barok21/receipt-verifier", desc: "Python FastAPI microservice for Ethiopian bank receipts" },
          ].map((p) => (
            <a key={p.name} href={p.url} target="_blank" rel="noopener" style={{
              padding: "20px", borderRadius: "10px", background: "var(--surface)", border: "1px solid var(--border)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <p style={{ fontSize: "15px", fontWeight: 600, fontFamily: "var(--mono)" }}>{p.name}</p>
                <span style={{ fontSize: "13px", color: "var(--ink-3)" }}>{"★"}{p.stars}</span>
              </div>
              <p style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.5 }}>{p.desc}</p>
            </a>
          ))}
        </div>
        <p style={{ marginTop: "16px", fontSize: "14px", color: "var(--ink-2)" }}>
          cheki improves on all of these: web UI, REST API, batch verification, TypeScript SDK, Python library, Docker, 9 banks, bank-specific guide pages, and zero cost.
        </p>
      </main>
      <Footer />
    </>
  );
}
