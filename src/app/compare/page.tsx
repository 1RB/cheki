"use client";

import Link from "next/link";
import { Nav, Footer } from "@/components/Chrome";
import { IN_DEVELOPMENT_BANK_COUNT, LIVE_BANK_COUNT } from "@/lib/bank-counts";
import {
  CHEKI_PRICING,
  COMPETITORS_CHECKED,
  COMPETITOR_BANKS_LISTED,
  COMPETITOR_FACTS_AS_OF,
  COMPETITOR_PRICING,
  type Competitor,
} from "@/lib/guides-facts";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Icon, ArrowRight01Icon } from "@/components/Icon";
import { BouncyAccordion } from "@/components/motion/bouncy-accordion";
import { DATA_SOURCE_EVIDENCE, FIT_ROWS, chekiShortfalls, compareFaqs } from "@/lib/compare-content";

const check = "\u2713";
const dash = "-";

/** Table column key for each competitor in guides-facts. */
const COLUMN: Record<Competitor, string> = {
  "check.et": "checket",
  "verify.et": "verifyet",
  qbirr: "qbirr",
  tinaverify: "tinaverify",
  tally: "tally",
};

/** One table row's competitor cells, read from guides-facts. */
function byService(cell: (c: Competitor) => string): Record<string, string> {
  return Object.fromEntries((Object.keys(COLUMN) as Competitor[]).map((c) => [COLUMN[c], cell(c)]));
}

/** A table row: the feature name, then one cell per service column. */
type Row = { feature: string } & Record<string, string>;

const h2Style = { fontSize: "22px", fontWeight: 800, marginBottom: "16px" } as const;
const proseStyle = { color: "var(--ink-2)", fontSize: "15px", lineHeight: 1.7, marginBottom: "12px", maxWidth: "720px" } as const;

const noteStyle = { fontSize: "13px", color: "var(--ink-3)", lineHeight: 1.5, marginBottom: "32px", maxWidth: "720px" } as const;

function Cell({ value, highlight }: { value: string; highlight?: boolean }) {
  if (value === check) {
    return <span style={{ color: highlight ? "var(--green-dark)" : "var(--ink-2)", fontWeight: 700, fontSize: "15px" }}>{check}</span>;
  }
  if (value === dash) {
    return <span style={{ color: "var(--ink-4)" }}>{dash}</span>;
  }
  return <span style={{ color: highlight ? "var(--green-dark)" : "var(--ink-2)", fontWeight: highlight ? 600 : 400 }}>{value}</span>;
}

/** Table columns, cheki first. */
const services = [
  { key: "cheki", name: "cheki", href: "/", color: "var(--green-dark)" },
  { key: "checket", name: "check.et", href: "https://check.et" },
  { key: "verifyet", name: "verify.et", href: "https://verify.et" },
  { key: "qbirr", name: "qbirr", href: "https://qbirr.com" },
  { key: "tinaverify", name: "tinaverify", href: "https://tinaverify.com" },
  { key: "tally", name: "tally", href: "https://tally.com.et" },
];

function Table({ rows, noted }: { rows: Row[]; noted?: boolean }) {
  return (
    <div className="table-wrap" style={{ marginBottom: noted ? "12px" : "32px" }}>
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
                <td key={s.key} style={{ padding: "11px 14px", verticalAlign: "top" }}>
                  {/* Values wrap at a fixed width (a td ignores max-width) so a long
                      price, like verify.et's three plans, can't push every other
                      column off screen. */}
                  <div style={{ minWidth: "72px", maxWidth: "168px" }}>
                    <Cell value={row[s.key]} highlight={s.key === "cheki"} />
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ComparePage() {
  const { t } = useTranslation();

  const pricingData: Row[] = [
    { feature: "Price", cheki: CHEKI_PRICING.price, ...byService((c) => COMPETITOR_PRICING[c].price) },
    { feature: "Free tier", cheki: CHEKI_PRICING.freeTier, ...byService((c) => COMPETITOR_PRICING[c].freeTier) },
    { feature: "Per-verify cost", cheki: CHEKI_PRICING.perVerification, ...byService((c) => COMPETITOR_PRICING[c].perVerification) },
    { feature: "Signup required", cheki: "No", checket: "Yes (phone+SMS)", verifyet: "Yes (Telegram)", qbirr: "Yes (email)", tinaverify: "Yes (email)", tally: "Yes (Telegram)" },
    { feature: "API key required", cheki: "No", checket: "Yes (business)", verifyet: "Yes", qbirr: "Yes", tinaverify: dash, tally: dash },
  ];

  const platformData: Row[] = [
    { feature: "Banks and wallets listed", cheki: `${LIVE_BANK_COUNT} live`, ...byService((c) => String(COMPETITOR_BANKS_LISTED[c])) },
    { feature: "REST API", cheki: check, checket: check, verifyet: check, qbirr: check, tinaverify: dash, tally: dash },
    { feature: "QR code scanning", cheki: check, checket: check, verifyet: check, qbirr: "Upload", tinaverify: check, tally: check },
    { feature: "BOA QR decryption", cheki: check, checket: dash, verifyet: dash, qbirr: dash, tinaverify: dash, tally: dash },
    { feature: "Batch verification", cheki: check, checket: dash, verifyet: dash, qbirr: dash, tinaverify: dash, tally: dash },
    { feature: "Mobile app", cheki: "PWA", checket: "PWA", verifyet: "Android", qbirr: dash, tinaverify: "iOS+Android", tally: "Android (staff)" },
    { feature: "Geo-block bypass", cheki: dash, checket: dash, verifyet: dash, qbirr: check, tinaverify: dash, tally: check },
    { feature: "Duplicate detection", cheki: dash, checket: "Per-branch", verifyet: "History", qbirr: "Per-merchant", tinaverify: "Audit trail", tally: dash },
    { feature: "Amount tolerance check", cheki: dash, checket: dash, verifyet: dash, qbirr: check, tinaverify: dash, tally: dash },
  ];

  const openData: Row[] = [
    { feature: "Open source", cheki: check, checket: dash, verifyet: dash, qbirr: dash, tinaverify: dash, tally: dash },
    { feature: "Self-hosting", cheki: check, checket: dash, verifyet: dash, qbirr: dash, tinaverify: dash, tally: dash },
    { feature: "Source URL shown", cheki: check, checket: dash, verifyet: dash, qbirr: dash, tinaverify: dash, tally: dash },
    { feature: "AI crawler access", cheki: check, checket: check, verifyet: dash, qbirr: check, tinaverify: check, tally: check },
    { feature: "Python library", cheki: check, checket: dash, verifyet: dash, qbirr: "Own git server", tinaverify: dash, tally: dash },
    { feature: "TypeScript SDK", cheki: check, checket: dash, verifyet: check, qbirr: "Own git server", tinaverify: dash, tally: dash },
    { feature: "Dart / Flutter SDK", cheki: check, checket: dash, verifyet: dash, qbirr: dash, tinaverify: dash, tally: dash },
    { feature: "PHP SDK", cheki: check, checket: dash, verifyet: dash, qbirr: "Own git server", tinaverify: dash, tally: dash },
    { feature: "Go SDK", cheki: check, checket: dash, verifyet: dash, qbirr: "Own git server", tinaverify: dash, tally: dash },
  ];



  const banksListed = (c: Competitor) => `${COMPETITOR_BANKS_LISTED[c]} banks and wallets listed`;

  const competitors = [
    {
      name: "check.et",
      tagline: "The established player",
      url: "https://check.et",
      banks: banksListed("check.et"),
      pricing: COMPETITOR_PRICING["check.et"].sentence,
      strengths: ["Bilingual (EN + Amharic)", "Polished UI, good SEO content", "Employee management, roles", "Webhooks on Pro plan", "Affiliate program (250 ETB/referral)"],
      limitations: ["Charges for public data", "200 free verifications are one-time", "API requires business account", "No self-hosting, no open source", "Receipt source URLs hidden"],
      stack: "Next.js, Vercel, Cloudflare",
    },
    {
      name: "verify.et",
      tagline: "Suba Software's offering",
      url: "https://verify.et",
      banks: banksListed("verify.et"),
      pricing: COMPETITOR_PRICING["verify.et"].sentence,
      strengths: ["Android app on Play Store", "Free receipt check with no account", "Blog content, status pages per bank", "TypeScript SDK published"],
      limitations: ["Accounts need Telegram sign-in", "Blocks AI crawlers (GPTBot, ClaudeBot, CCBot)", "No open source, no self-hosting", "No batch verification, no Python library"],
      stack: "React, Cloudflare",
    },
    {
      name: "qbirr",
      tagline: "Developer-first API (launched June 2026)",
      url: "https://qbirr.com",
      banks: banksListed("qbirr"),
      pricing: COMPETITOR_PRICING.qbirr.sentence,
      strengths: ["Clean REST API with rate limits", "Ethiopian relay for Telebirr/M-Pesa geo-block", "Configurable amount tolerance per merchant", "Per-merchant duplicate ref locking", "Scale plan promised a 99.9% SLA"],
      limitations: ["Young (launched June 2026)", "SDKs only on its own git server, not npm/PyPI/Packagist", "No mobile app; QR by upload only", "No web UI for verification", "English only, fewer banks than check.et/verify.et", "No Dart SDK"],
      stack: "NestJS, Contabo VPS (France)",
    },
    {
      name: "tinaverify",
      tagline: "Mobile-first for cashiers",
      url: "https://tinaverify.com",
      banks: banksListed("tinaverify"),
      pricing: COMPETITOR_PRICING.tinaverify.sentence,
      strengths: ["Published iOS + Android apps", "Cashier workflow: scan, verify, audit trail", "Multi-branch support", "Search by cashier, branch, amount, reference", "Daily sales tracking"],
      limitations: ["No REST API", "Credit-based pricing (expires in 90 days)", "No open source, no self-hosting", "No batch verification", "Fewer banks than check.et/verify.et"],
      stack: "Next.js (App Router, Turbopack)",
    },
    {
      name: "tally",
      tagline: "Telegram bot by Sabi LLC",
      url: "https://tally.com.et",
      banks: banksListed("tally"),
      pricing: COMPETITOR_PRICING.tally.sentence,
      strengths: ["Telegram bot delivery (low friction)", "Ethiopian-hosted (Ethio Telecom IP)", "Workspace codes and an Android app for staff"],
      limitations: ["Only 4 banks (CBE, Telebirr, BOA, Awash)", "No web app, no public API, no docs", "iOS app not out yet", "VAT charged on top of plans"],
      stack: "Static HTML + Tailwind CDN, nginx/Plesk, Ethiopian IP",
    },
  ];

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://cheki.et/" },
      { "@type": "ListItem", position: 2, name: "Compare", item: "https://cheki.et/compare" },
    ],
  };

  // Built from the same objects as the visible FAQ at the end of the page.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: compareFaqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Nav />
      <main className="container" style={{ paddingTop: "48px", paddingBottom: "48px" }}>
        <nav aria-label="Breadcrumb" style={{ fontSize: "13px", color: "var(--ink-3)", marginBottom: "16px" }}>
          <Link href="/" style={{ color: "var(--ink-3)" }}>Home</Link>
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
          <Link href="/" style={{
            display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 20px", borderRadius: "8px", background: "var(--green-cta)", color: "var(--green-cta-fg)", fontSize: "14px", fontWeight: 600,
          }}>
            {t("compare.cta")}
            <Icon icon={ArrowRight01Icon} size={14} color="var(--green-cta-fg)" />
          </Link>
        </div>

        {/* Who each service fits */}
        <h2 id="which-fits" style={h2Style}>check.et vs verify.et vs cheki: which one fits you</h2>
        <p style={proseStyle}>
          Choose by the job, not the longest feature list. Most people need one thing: to confirm the payment happened.
        </p>
        <div className="table-wrap" style={{ marginBottom: "12px" }}>
          <table style={{ borderCollapse: "collapse", fontSize: "13px", background: "var(--surface)", borderRadius: "12px", overflow: "hidden", width: "100%" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "12px 14px", fontWeight: 700 }}>You need</th>
                <th style={{ textAlign: "left", padding: "12px 14px", fontWeight: 700 }}>Use</th>
              </tr>
            </thead>
            <tbody>
              {FIT_ROWS.map(([need, service], i) => (
                <tr key={need} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "var(--surface)" : "var(--surface-alt)" }}>
                  <td style={{ padding: "11px 14px", color: "var(--ink-2)" }}>{need}</td>
                  <td style={{ padding: "11px 14px", fontWeight: 600, color: "var(--ink)" }}>{service}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={noteStyle}>{chekiShortfalls()}</p>

        {/* The table scrolls sideways on narrow screens and its scrollbar is
            the only in-flow signal that more columns exist past the edge. */}
        <p className="table-scroll-hint">Swipe the table sideways to compare every service →</p>

        {/* Pricing */}
        <h2 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "16px" }}>{t("compare.pricing")}</h2>
        <Table rows={pricingData} noted />
        <p style={noteStyle}>
          Prices as listed on each service&apos;s public site on {COMPETITORS_CHECKED}. The signup and API key rows are as of {COMPETITOR_FACTS_AS_OF}.
        </p>

        {/* Platform */}
        <h2 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "16px" }}>{t("compare.platform")}</h2>
        <Table rows={platformData} noted />
        <p style={noteStyle}>
          Bank counts are what each service listed on its own site on {COMPETITORS_CHECKED}; cheki also lists {IN_DEVELOPMENT_BANK_COUNT} more banks and wallets as in development. The other rows are as of {COMPETITOR_FACTS_AS_OF}, except QR scanning and mobile apps, re-checked on {COMPETITORS_CHECKED}.
        </p>

        {/* Openness */}
        <h2 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "16px" }}>{t("compare.transparency")}</h2>
        <Table rows={openData} noted />
        <p style={noteStyle}>
          As of {COMPETITOR_FACTS_AS_OF}, except qbirr&apos;s SDKs, re-checked on {COMPETITORS_CHECKED}.
        </p>

        {/* The story */}
        <div style={{
          padding: "32px", borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)", marginBottom: "40px",
        }}>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "var(--ink)", marginBottom: "16px" }}>{t("compare.coreFact")}</h2>
          <p style={{ color: "var(--ink-2)", fontSize: "15px", lineHeight: 1.7, marginBottom: "12px" }}>
            {t("compare.coreFactText")}
          </p>
          <a href="#data-source" style={{
            display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "var(--green-dark)", fontWeight: 600,
          }}>
            See the evidence
            <Icon icon={ArrowRight01Icon} size={14} color="var(--green)" />
          </a>
        </div>

        {/* Competitor profiles */}
        <h2 id="profiles" style={{ fontSize: "22px", fontWeight: 800, marginBottom: "8px" }}>cheki vs the competition, service by service</h2>
        <p style={{ fontSize: "13px", color: "var(--ink-3)", lineHeight: 1.5, marginBottom: "20px", maxWidth: "720px" }}>
          Prices and bank counts as listed on {COMPETITORS_CHECKED}. Strengths, limitations and stacks are as of {COMPETITOR_FACTS_AS_OF}, except mobile apps, qbirr&apos;s SDKs and tally&apos;s site, re-checked on {COMPETITORS_CHECKED}.
        </p>
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
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "16px" }}>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", marginBottom: "8px" }}>Strengths</p>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {c.strengths.map((s) => (
                      <li key={s} style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.5, marginBottom: "4px", paddingLeft: "14px", position: "relative" }}>
                        <span aria-hidden="true" style={{ position: "absolute", left: 0, color: "var(--ink-3)" }}>+</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", marginBottom: "8px" }}>Limitations</p>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {c.limitations.map((w) => (
                      <li key={w} style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.5, marginBottom: "4px", paddingLeft: "14px", position: "relative" }}>
                        <span aria-hidden="true" style={{ position: "absolute", left: 0, color: "var(--ink-3)" }}>-</span>{w}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <p style={{ marginTop: "16px", fontSize: "12px", color: "var(--ink-3)", fontFamily: "var(--mono)" }}>{c.stack}</p>
            </div>
          ))}
        </div>

        {/* The shared geo-block */}
        <h2 id="geo-blocking" style={h2Style}>Geo-blocking: the shared problem</h2>
        <p style={proseStyle}>
          Telebirr and M-Pesa block non-Ethiopian IP addresses at the network level. That affects every service without an Ethiopian relay or server, cheki&apos;s hosted version included. No service has a private line to Ethio Telecom or Safaricom.
        </p>
        <p style={proseStyle}>
          When cheki cannot reach a geo-blocked bank, it returns the bank&apos;s own receipt link to open on a phone on an Ethiopian network, and you can paste the receipt text instead. A pasted or decoded receipt is marked as not confirmed: only the bank&apos;s record turns a result green.
        </p>
        <p style={{ ...proseStyle, marginBottom: "40px" }}>
          The permanent fixes are to self-host cheki on an Ethiopian server, or to use a service that has an Ethiopian relay or server: as of {COMPETITOR_FACTS_AS_OF}, qbirr offered a relay and tally ran on an Ethio Telecom IP.
        </p>

        {/* Where the data comes from */}
        <h2 id="data-source" style={h2Style}>Do the paid services use private bank APIs?</h2>
        <p style={proseStyle}>No. All six read the same public endpoints. The evidence:</p>
        <ul style={{ ...proseStyle, paddingLeft: "20px", marginBottom: "40px" }}>
          {DATA_SOURCE_EVIDENCE.map((e) => <li key={e} style={{ marginBottom: "4px" }}>{e}</li>)}
        </ul>

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
          cheki combines these approaches: a web UI, REST API, batch verification, TypeScript SDK, Python library, Docker, {LIVE_BANK_COUNT} live banks, guide pages, and BOA QR decryption. All free and open source.
        </p>

        {/* Visible FAQ: the FAQPage JSON-LD above is built from these exact objects. */}
        <h2 id="faq" style={{ ...h2Style, marginTop: "48px" }}>Questions about the comparison</h2>
        <BouncyAccordion items={compareFaqs.map((f, i) => ({ id: `faq-${i}`, title: f.q, description: f.a }))} />
      </main>
      <Footer />
    </>
  );
}
