"use client";

import { useState } from "react";
import { banks } from "@/lib/banks";
import { Nav, Footer } from "@/components/Chrome";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Icon, ChevronDownIcon, ChevronUpIcon } from "@/components/Icon";

export default function BanksPage() {
  const { t } = useTranslation();
  const [showInDevelopment, setShowInDevelopment] = useState(false);
  const live = banks.filter((b) => b.status === "live");
  const inDev = banks.filter((b) => b.status === "soon");

  const BankCard = ({ b }: { b: (typeof banks)[0] }) => (
    <a key={b.code} href={`/banks/${b.code}`} style={{
      padding: "24px", borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)",
      display: "flex", flexDirection: "column", gap: "12px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: b.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "15px" }}>
          {b.shortName.slice(0, 3)}
        </div>
        <div>
          <p style={{ fontSize: "16px", fontWeight: 700 }}>{b.shortName}</p>
          <p style={{ fontSize: "12px", color: "var(--ink-3)" }}>{b.type === "mobile" ? "Mobile wallet" : b.type === "wallet" ? "Wallet" : "Bank"}</p>
        </div>
        <span style={{
          marginLeft: "auto", fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "4px",
          background: b.status === "live" ? "var(--green-light)" : "var(--surface-alt)",
          color: b.status === "live" ? "var(--green-dark)" : "var(--ink-3)",
        }}>{b.status === "live" ? t("banks.live") : t("banks.inDevelopment")}</span>
      </div>
      <p style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.5 }}>
        {b.description.slice(0, 120)}...
      </p>
      <div style={{ display: "flex", gap: "12px", fontSize: "12px", color: "var(--ink-3)" }}>
        {b.requiresAccount && <span>{t("banks.accountRequired")}</span>}
        {b.geoBlocked && <span>{t("banks.ethiopiaOnly")}</span>}
        {!b.requiresAccount && !b.geoBlocked && <span>{t("banks.referenceOnly")}</span>}
      </div>
    </a>
  );

  return (
    <>
      <Nav />
      <main className="container" style={{ paddingTop: "48px", paddingBottom: "48px" }}>
        <nav style={{ fontSize: "13px", color: "var(--ink-3)", marginBottom: "16px" }}>
          <a href="/" style={{ color: "var(--ink-3)" }}>Home</a>
          <span style={{ margin: "0 6px"}}>/</span>
          <span style={{ color: "var(--ink)" }}>{t("nav.banks")}</span>
        </nav>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "12px" }}>
          {t("banks.title")}
        </h1>
        <p style={{ color: "var(--ink-2)", fontSize: "17px", maxWidth: "600px", marginBottom: "40px" }}>
          {t("banks.subtitle", { count: banks.length })}
        </p>

        <div className="grid-3" style={{ gap: "20px" }}>
          {live.map((b) => <BankCard key={b.code} b={b} />)}
        </div>

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
          <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.02em" }}>
              {t("banks.contribute")}
            </h2>
            <span style={{ fontSize: "13px", color: "var(--green)", fontWeight: 600 }}>Open source</span>
          </div>
          <p style={{ fontSize: "15px", color: "var(--ink-2)", lineHeight: 1.7, marginBottom: "20px" }}>
            {inDev.length - 4} Ethiopian banks still need receipt endpoints. If you use one of these banks and can share a receipt with a QR code or receipt URL, we can reverse-engineer the endpoint and add it to cheki for free. No technical knowledge needed, just send us a screenshot or link.
          </p>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <a href="https://github.com/1RB/cheki/issues/new?labels=new-bank&title=Add+support+for+%5Bbank+name%5D&body=Bank%3A%20%0AReceipt%20URL%20or%20QR%20screenshot%3A%20%0AReference%20number%3A%20" target="_blank" rel="noopener" style={{
              padding: "12px 24px", borderRadius: "8px", background: "var(--green)", color: "#fff",
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
          <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--border)" }}>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", marginBottom: "10px" }}>Banks we need receipts from:</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {inDev.filter((b) => !["nib", "wegagen", "ahadu", "kaafi"].includes(b.code)).map((b) => (
                <span key={b.code} style={{
                  fontSize: "12px", padding: "4px 12px", borderRadius: "6px",
                  background: "var(--surface-alt)", color: "var(--ink-2)", border: "1px solid var(--border)",
                }}>{b.shortName}</span>
              ))}
            </div>
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
              <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--green-dark)", marginBottom: "6px" }}>1. Share a receipt</p>
              <p style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.5 }}>Send us a receipt screenshot or URL from a bank we don&apos;t support yet. We&apos;ll figure out the endpoint.</p>
            </div>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--green-dark)", marginBottom: "6px" }}>2. Write a parser</p>
              <p style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.5 }}>If you code, fork the repo and add a parser. The architecture is hexagonal, each bank is a self-contained module.</p>
            </div>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--green-dark)", marginBottom: "6px" }}>3. Report broken endpoints</p>
              <p style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.5 }}>If a bank changes their receipt URL format, open an issue on GitHub. We fix it fast because the community can submit patches.</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
