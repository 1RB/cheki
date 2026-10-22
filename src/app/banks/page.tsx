"use client";

import { useState } from "react";
import { banks } from "@/lib/banks";
import { Nav, Footer } from "@/components/Chrome";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Icon, ChevronDownIcon, ChevronUpIcon } from "@/components/Icon";
import { brandTileBg } from "@/lib/utils";
import { NEW_BANK_ISSUE_URL } from "@/lib/trust-pages";

const groupHeading = { fontSize: "17px", fontWeight: 700, letterSpacing: "-0.01em", marginBottom: "16px" } as const;
const groupCount = { color: "var(--ink-3)", fontWeight: 500, fontVariantNumeric: "tabular-nums" } as const;

export default function BanksPage() {
  const { t } = useTranslation();
  const [showInDevelopment, setShowInDevelopment] = useState(false);
  const live = banks.filter((b) => b.status === "live");
  // Grouped by what cheki.et does with the receipt, so the section heading
  // carries the meaning a chip on every card used to.
  const direct = live.filter((b) => !b.geoBlocked);
  const linkOut = live.filter((b) => b.geoBlocked);
  const inDev = banks.filter((b) => b.status === "soon");

  // One row per card, so every card in the grid is the same height. The group
  // (or the in-development toggle) says the status; the only label on a card
  // is the exception that decides whether the reader can act: "Account required".
  const BankCard = ({ b }: { b: (typeof banks)[0] }) => (
    <a key={b.code} href={`/banks/${b.code}`} style={{
      padding: "20px 24px", borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)",
      display: "flex", alignItems: "center", gap: "12px", minWidth: 0,
    }}>
      <div style={{ width: "40px", height: "40px", flexShrink: 0, borderRadius: "10px", background: brandTileBg(b.color), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "15px" }}>
        {b.shortName.slice(0, 3)}
      </div>
      <p style={{ fontSize: "16px", fontWeight: 700, minWidth: 0 }}>{b.shortName}</p>
      {b.requiresAccount && (
        <span className="bank-meta__chip" style={{ marginLeft: "auto", flexShrink: 0 }}>{t("banks.accountRequired")}</span>
      )}
    </a>
  );

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://cheki.et/" },
      { "@type": "ListItem", position: 2, name: "Banks", item: "https://cheki.et/banks" },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <Nav />
      <main className="container" style={{ paddingTop: "48px", paddingBottom: "48px" }}>
        <nav aria-label="Breadcrumb" style={{ fontSize: "13px", color: "var(--ink-3)", marginBottom: "16px" }}>
          <a href="/" style={{ color: "var(--ink-3)" }}>Home</a>
          <span style={{ margin: "0 6px"}}>/</span>
          <span style={{ color: "var(--ink)" }}>{t("nav.banks")}</span>
        </nav>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "32px" }}>
          {t("banks.title")}
        </h1>

        <section aria-labelledby="banks-direct">
          <h2 id="banks-direct" style={groupHeading}>
            {t("banks.checkedDirectly")} <span style={groupCount}>{direct.length}</span>
          </h2>
          <div className="grid-3" style={{ gap: "20px" }}>
            {direct.map((b) => <BankCard key={b.code} b={b} />)}
          </div>
        </section>

        {linkOut.length > 0 && (
          <section aria-labelledby="banks-linkout" style={{ marginTop: "40px" }}>
            <h2 id="banks-linkout" style={groupHeading}>
              {t("banks.officialPage")} <span style={groupCount}>{linkOut.length}</span>
            </h2>
            <div className="grid-3" style={{ gap: "20px" }}>
              {linkOut.map((b) => <BankCard key={b.code} b={b} />)}
            </div>
          </section>
        )}

        <button
          onClick={() => setShowInDevelopment((s) => !s)}
          style={{
            marginTop: "24px",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 16px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--ink-2)",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {showInDevelopment ? t("banks.hideInDevelopment") : t("banks.showInDevelopment", { count: inDev.length })}
          <Icon icon={showInDevelopment ? ChevronUpIcon : ChevronDownIcon} size={16} color="var(--ink-3)" />
        </button>

        {showInDevelopment && (
          <div className="grid-3" style={{ gap: "20px", marginTop: "20px" }}>
            {inDev.map((b) => <BankCard key={b.code} b={b} />)}
          </div>
        )}

        {/* Community contribution CTA */}
        <div style={{
          marginTop: "48px", padding: "32px", borderRadius: "16px",
          background: "var(--surface)", border: "1px solid var(--border)",
        }}>
          <h2 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "16px" }}>
            {t("banks.contribute")}
          </h2>
          <p style={{ fontSize: "15px", color: "var(--ink-2)", lineHeight: 1.7, marginBottom: "20px", maxWidth: "60ch" }}>
            {inDev.length} Ethiopian banks still need receipt endpoints. If you use one of these banks and can share a receipt with a QR code or receipt URL, we can reverse-engineer the endpoint and add it to cheki for free. No technical knowledge needed, just send us a screenshot or link.
          </p>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <a href={NEW_BANK_ISSUE_URL} target="_blank" rel="noopener" style={{
              padding: "12px 24px", borderRadius: "8px", background: "var(--green-cta)", color: "var(--green-cta-fg)",
              fontSize: "14px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "8px",
            }}>
              Submit a bank on GitHub
            </a>
            <a href="https://t.me/raysterminalbot" target="_blank" rel="noopener" style={{
              padding: "12px 24px", borderRadius: "8px", border: "1px solid var(--border)",
              color: "var(--ink)", fontSize: "14px", fontWeight: 600,
            }}>
              Send via Telegram
            </a>
          </div>
        </div>

        {/* How to contribute */}
        <div style={{
          marginTop: "24px", padding: "28px", borderRadius: "14px",
          background: "var(--surface-alt)", border: "1px solid var(--border)",
        }}>
          <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "12px" }}>Three ways to contribute</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink)", marginBottom: "6px" }}>1. Share a receipt</p>
              <p style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.5 }}>Send us a receipt screenshot or URL from a bank we don&apos;t support yet. We&apos;ll figure out the endpoint.</p>
            </div>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink)", marginBottom: "6px" }}>2. Write a parser</p>
              <p style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.5 }}>If you code, fork the repo and add a parser. The architecture is hexagonal, each bank is a self-contained module.</p>
            </div>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink)", marginBottom: "6px" }}>3. Report broken endpoints</p>
              <p style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.5 }}>If a bank changes their receipt URL format, open an issue on GitHub. We fix it fast because the community can submit patches.</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
