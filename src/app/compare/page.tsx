"use client";

import { Nav, Footer } from "@/components/Chrome";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Icon, ArrowRight01Icon } from "@/components/Icon";

const check = "\u2713";
const dash = "-";

function Cell({ value, highlight }: { value: string; highlight?: boolean }) {
  if (value === check) {
    return <span style={{ color: highlight ? "var(--green)" : "var(--ink-2)", fontWeight: 700, fontSize: "15px" }}>{check}</span>;
  }
  if (value === dash) {
    return <span style={{ color: "var(--ink-4)" }}>{dash}</span>;
  }
  return <span style={{ color: highlight ? "var(--green-dark)" : "var(--ink-2)", fontWeight: highlight ? 600 : 400 }}>{value}</span>;
}

export default function ComparePage() {
  const { t } = useTranslation();
  const services = [
    { key: "cheki", name: "cheki", href: "/", color: "var(--green)" },
    { key: "checket", name: "check.et", href: "https://check.et" },
    { key: "verifyet", name: "verify.et", href: "https://verify.et" },
    { key: "qbirr", name: "qbirr", href: "https://qbirr.com" },
    { key: "tinaverify", name: "tinaverify", href: "https://tinaverify.com" },
    { key: "tally", name: "tally", href: "https://tally.com.et" },
  ];

  const pricingData = [
    { feature: "Price", cheki: "Free forever", checket: "499 ETB/mo", verifyet: "$20-40/mo", qbirr: "500-8K ETB/mo", tinaverify: "3K-8K ETB/90d", tally: "Unknown" },
    { feature: "Free tier", cheki: "Unlimited", checket: "200 one-time", verifyet: "200 one-time", qbirr: "50/mo", tinaverify: dash, tally: "Unknown" },
    { feature: "Per-verify cost", cheki: "0 ETB", checket: "~2.5 ETB at 200/mo", verifyet: "~$0.10-0.20", qbirr: "0.50-0.84 ETB", tinaverify: "0.84-0.91 ETB", tally: "Unknown" },
    { feature: "Signup required", cheki: "No", checket: "Yes (phone+SMS)", verifyet: "Yes (Telegram)", qbirr: "Yes (email)", tinaverify: "Yes (email)", tally: "Yes (Telegram)" },
    { feature: "API key required", cheki: "No", checket: "Yes (business)", verifyet: "Yes", qbirr: "Yes", tinaverify: dash, tally: dash },
  ];

  const platformData = [
    { feature: "Banks supported", cheki: "31", checket: "9", verifyet: "10", qbirr: "7", tinaverify: "6", tally: "4" },
    { feature: "Banks live", cheki: "9", checket: "9", verifyet: "9", qbirr: "7", tinaverify: "6", tally: "4" },
    { feature: "REST API", cheki: check, checket: check, verifyet: check, qbirr: check, tinaverify: dash, tally: dash },
    { feature: "QR code scanning", cheki: check, checket: check, verifyet: check, qbirr: dash, tinaverify: check, tally: dash },
    { feature: "BOA QR decryption", cheki: check, checket: dash, verifyet: dash, qbirr: dash, tinaverify: dash, tally: dash },
    { feature: "Batch verification", cheki: check, checket: dash, verifyet: dash, qbirr: dash, tinaverify: dash, tally: dash },
    { feature: "Mobile app", cheki: "PWA", checket: "PWA", verifyet: "Android", qbirr: dash, tinaverify: "iOS+Android", tally: "Unreleased" },
    { feature: "Geo-block bypass", cheki: dash, checket: dash, verifyet: dash, qbirr: check, tinaverify: dash, tally: check },
    { feature: "Duplicate detection", cheki: dash, checket: "Per-branch", verifyet: "History", qbirr: "Per-merchant", tinaverify: "Audit trail", tally: dash },
    { feature: "Amount tolerance check", cheki: dash, checket: dash, verifyet: dash, qbirr: check, tinaverify: dash, tally: dash },
  ];

  const openData = [
    { feature: "Open source", cheki: check, checket: dash, verifyet: dash, qbirr: dash, tinaverify: dash, tally: dash },
    { feature: "Self-hosting", cheki: check, checket: dash, verifyet: dash, qbirr: dash, tinaverify: dash, tally: dash },
    { feature: "Source URL shown", cheki: check, checket: dash, verifyet: dash, qbirr: dash, tinaverify: dash, tally: dash },
    { feature: "AI crawler access", cheki: check, checket: check, verifyet: dash, qbirr: check, tinaverify: check, tally: check },
    { feature: "Python library", cheki: check, checket: dash, verifyet: dash, qbirr: "Advertised", tinaverify: dash, tally: dash },
    { feature: "TypeScript SDK", cheki: check, checket: dash, verifyet: check, qbirr: "Advertised", tinaverify: dash, tally: dash },
    { feature: "Dart / Flutter SDK", cheki: check, checket: dash, verifyet: dash, qbirr: dash, tinaverify: dash, tally: dash },
    { feature: "PHP SDK", cheki: check, checket: dash, verifyet: dash, qbirr: dash, tinaverify: dash, tally: dash },
    { feature: "Go SDK", cheki: check, checket: dash, verifyet: dash, qbirr: dash, tinaverify: dash, tally: dash },
  ];

  function Table({ rows }: { rows: typeof pricingData }) {
    return (
      <div className="table-wrap" style={{ marginBottom: "32px" }}>
        <table style={{ borderCollapse: "collapse", fontSize: "13px", background: "var(--surface)", borderRadius: "12px", overflow: "hidden", width: "100%" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border)" }}>
              <th style={{ textAlign: "left", padding: "12px 14px", fontWeight: 700, whiteSpace: "nowrap" }}>Feature</th>
              {services.map((s) => (
                <th key={s.key} style={{ textAlign: "left", padding: "12px 14px", fontWeight: 700, whiteSpace: "nowrap", color: s.color || "var(--ink)" }}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer nofollow" style={{ color: "inherit", textDecoration: "none" }}>{s.name}</a>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.feature} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)" }}>
                <td style={{ padding: "11px 14px", fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap" }}>{row.feature}</td>
                {services.map((s) => (
                  <td key={s.key} style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                    <Cell value={(row as Record<string, string>)[s.key]} highlight={s.key === "cheki"} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const competitors = [
    {
      name: "check.et",
      tagline: "The established player",
      url: "https://check.et",
      banks: "9 banks, all live",
      pricing: "499 ETB/mo or 4,990/yr. 200 free (one-time, not monthly).",
      strengths: ["Bilingual (EN + Amharic)", "Polished UI, good SEO content", "Employee management, roles", "Webhooks on Pro plan", "Affiliate program (250 ETB/referral)"],
      limitations: ["Charges for public data", "200 free verifications are one-time", "API requires business account", "No self-hosting, no open source", "Receipt source URLs hidden"],
      stack: "Next.js, Vercel, Cloudflare",
    },
    {
      name: "verify.et",
      tagline: "Suba Software's offering",
      url: "https://verify.et",
      banks: "10 banks, 9 live",
      pricing: "$20-40/mo USD. 200 free (one-time).",
      strengths: ["Android app on Play Store", "Blog content, status pages per bank", "TypeScript SDK published"],
      limitations: ["Charges in USD", "Requires Telegram OAuth signup", "Blocks AI crawlers (GPTBot, ClaudeBot, CCBot)", "No open source, no self-hosting", "No batch verification, no Python library"],
      stack: "React, Cloudflare",
    },
    {
      name: "qbirr",
      tagline: "Developer-first API (launched June 2026)",
      url: "https://qbirr.com",
      banks: "7 banks, all live",
      pricing: "50/mo free. 500-8K ETB/mo for 1K-100K verifications.",
      strengths: ["Clean REST API with rate limits", "Ethiopian relay for Telebirr/M-Pesa geo-block", "Configurable amount tolerance per merchant", "Per-merchant duplicate ref locking", "Scale plan with 99.9% SLA"],
      limitations: ["Brand new (day-one launch)", "4 SDKs advertised but none published on npm/PyPI/Packagist/GitHub", "No mobile app, no QR scanning", "No web UI for verification", "English only, fewer banks than check.et/verify.et", "No Dart/PHP/Go SDK"],
      stack: "NestJS, Contabo VPS (France)",
    },
    {
      name: "tinaverify",
      tagline: "Mobile-first for cashiers",
      url: "https://tinaverify.com",
      banks: "6 banks, all live",
      pricing: "Credit-based. 3K ETB / 3,300 credits or 8K ETB / 9,500 credits. 90-day validity.",
      strengths: ["Published iOS + Android apps", "Cashier workflow: scan, verify, audit trail", "Multi-branch support", "Search by cashier, branch, amount, reference", "Daily sales tracking"],
      limitations: ["No REST API", "Credit-based pricing (expires in 90 days)", "No open source, no self-hosting", "No batch verification", "Fewer banks than check.et/verify.et"],
      stack: "Next.js (App Router, Turbopack)",
    },
    {
      name: "tally",
      tagline: "Telegram bot by Sabi LLC",
      url: "https://tally.com.et",
      banks: "4 banks (CBE, Telebirr, BOA, Awash)",
      pricing: "Not public. Pricing link is a dead anchor.",
      strengths: ["Telegram bot delivery (low friction)", "Ethiopian-hosted (Ethio Telecom IP)", "Workspace codes for staff"],
      limitations: ["Only 4 banks", "No web app, no API, no docs", "Mobile app claimed but store links are dead", "SSL certificate expired April 2026, unrenewed", "No pricing transparency"],
      stack: "Static HTML + Tailwind CDN, nginx/Plesk, Ethiopian IP",
    },
  ];

  return (
    <>
      <Nav />
      <main className="container" style={{ paddingTop: "48px", paddingBottom: "48px" }}>
        <nav style={{ fontSize: "13px", color: "var(--ink-3)", marginBottom: "16px" }}>
          <a href="/" style={{ color: "var(--ink-3)" }}>Home</a>
          <span style={{ margin: "0 6px"}}>/</span>
          <span style={{ color: "var(--ink)" }}>{t("nav.compare")}</span>
        </nav>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "16px" }}>
          {t("compare.title")}
        </h1>
        <p style={{ color: "var(--ink-2)", fontSize: "17px", maxWidth: "640px", marginBottom: "24px" }}>
          {t("compare.subtitle")}
        </p>

        <div style={{
          padding: "20px", borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)", marginBottom: "32px",
        }}>
          <p style={{ fontSize: "15px", color: "var(--ink-2)", lineHeight: 1.6, marginBottom: "14px" }}>
            {t("compare.verdict")}
          </p>
          <a href="/" style={{
            display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 20px", borderRadius: "8px", background: "var(--green)", color: "var(--bg)", fontSize: "14px", fontWeight: 600,
          }}>
            {t("compare.cta")}
            <Icon icon={ArrowRight01Icon} size={14} color="var(--bg)" />
          </a>
        </div>

        {/* Pricing */}
        <h2 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "16px" }}>{t("compare.pricing")}</h2>
        <Table rows={pricingData} />

        {/* Platform */}
        <h2 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "16px" }}>{t("compare.platform")}</h2>
        <Table rows={platformData} />

        {/* Openness */}
        <h2 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "16px" }}>{t("compare.transparency")}</h2>
        <Table rows={openData} />

        {/* The story */}
        <div style={{
          padding: "32px", borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)", marginBottom: "40px",
        }}>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "var(--ink)", marginBottom: "16px" }}>{t("compare.coreFact")}</h2>
          <p style={{ color: "var(--ink-2)", fontSize: "15px", lineHeight: 1.7, marginBottom: "12px" }}>
            {t("compare.coreFactText")}
          </p>
          <a href="/guides/check-et-vs-verify-et-vs-cheki" style={{
            display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "var(--green)", fontWeight: 600,
          }}>
            Read the full guide
            <Icon icon={ArrowRight01Icon} size={14} color="var(--green)" />
          </a>
        </div>

        {/* Competitor profiles */}
        <h2 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "20px" }}>Service profiles</h2>
        <div className="grid-2" style={{ gap: "16px", marginBottom: "40px" }}>
          {competitors.map((c) => (
            <div key={c.name} style={{
              padding: "24px", borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
                <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" style={{ fontSize: "17px", fontWeight: 700, color: "var(--ink)" }}>{c.name}</a>
                <span style={{ fontSize: "12px", color: "var(--ink-3)" }}>{c.banks}</span>
              </div>
              <p style={{ fontSize: "13px", color: "var(--ink-3)", marginBottom: "16px" }}>{c.tagline}</p>
              <p style={{ fontSize: "13px", color: "var(--ink-2)", marginBottom: "16px" }}>{c.pricing}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--green-dark)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Strengths</p>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {c.strengths.map((s) => (
                      <li key={s} style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.5, marginBottom: "4px", paddingLeft: "14px", position: "relative" }}>
                        <span style={{ position: "absolute", left: 0, color: "var(--green)" }}>+</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--red)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Limitations</p>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {c.limitations.map((w) => (
                      <li key={w} style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.5, marginBottom: "4px", paddingLeft: "14px", position: "relative" }}>
                        <span style={{ position: "absolute", left: 0, color: "var(--red)" }}>-</span>{w}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <p style={{ marginTop: "16px", fontSize: "12px", color: "var(--ink-3)", fontFamily: "var(--mono)" }}>{c.stack}</p>
            </div>
          ))}
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
                <span style={{ fontSize: "13px", color: "var(--ink-3)" }}>{"\u2605"}{p.stars}</span>
              </div>
              <p style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.5 }}>{p.desc}</p>
            </a>
          ))}
        </div>
        <p style={{ marginTop: "16px", fontSize: "14px", color: "var(--ink-2)" }}>
          cheki combines these approaches: a web UI, REST API, batch verification, TypeScript SDK, Python library, Docker, 9 live banks, guide pages, and BOA QR decryption. All free and open source.
        </p>
      </main>
      <Footer />
    </>
  );
}
