"use client";

import { useState } from "react";
import { Icon, GithubIcon, Menu01Icon, Cancel01Icon, ArrowRight01Icon } from "@/components/Icon";

export function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = [
    { href: "/", label: "Verify" },
    { href: "/banks", label: "Banks" },
    { href: "/guides", label: "Guides" },
    { href: "/developers", label: "Developers" },
    { href: "/compare", label: "Compare" },
  ];
  return (
    <>
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(250,249,246,0.92)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)", height: "var(--nav-h)",
      }}>
        <div className="container" style={{
          height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{
              fontWeight: 800, fontSize: "20px", letterSpacing: "-0.03em", color: "var(--ink)",
            }}>cheki</span>
            <span style={{
              fontSize: "10px", fontWeight: 600, color: "var(--green)", border: "1px solid var(--green-light)",
              padding: "2px 6px", borderRadius: "4px", background: "var(--green-light)",
            }}>OSS</span>
          </a>
          <div className="nav-desktop" style={{ display: "flex", gap: "2px", alignItems: "center" }}>
            {links.map((l) => (
              <a key={l.href} href={l.href} style={{
                padding: "6px 12px", fontSize: "14px", fontWeight: 500, color: "var(--ink-2)",
                borderRadius: "6px", transition: "all 0.15s",
              }}>{l.label}</a>
            ))}
            <a href="https://github.com/1RB/cheki" target="_blank" rel="noopener" style={{
              padding: "6px 14px", fontSize: "14px", fontWeight: 600, color: "#fff",
              background: "var(--ink)", borderRadius: "6px", marginLeft: "4px",
              display: "flex", alignItems: "center", gap: "6px",
            }}>
              <Icon icon={GithubIcon} size={14} color="#fff" />
              GitHub
            </a>
          </div>
          <button className="nav-mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} style={{
            background: "transparent", border: "none", cursor: "pointer", padding: "8px",
            display: "none",
          }}>
            <Icon icon={mobileOpen ? Cancel01Icon : Menu01Icon} size={22} color="var(--ink)" />
          </button>
        </div>
      </nav>
      {mobileOpen && (
        <div className="nav-mobile-menu" style={{
          position: "fixed", top: "var(--nav-h)", left: 0, right: 0, bottom: 0,
          background: "var(--bg)", zIndex: 99, padding: "24px",
          display: "flex", flexDirection: "column", gap: "8px",
        }}>
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)} style={{
              padding: "16px 20px", fontSize: "18px", fontWeight: 600, color: "var(--ink)",
              borderRadius: "10px", background: "var(--surface)", border: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              {l.label}
              <Icon icon={ArrowRight01Icon} size={18} color="var(--ink-3)" />
            </a>
          ))}
          <a href="https://github.com/1RB/cheki" target="_blank" rel="noopener" style={{
            padding: "16px 20px", fontSize: "18px", fontWeight: 600, color: "#fff",
            background: "var(--ink)", borderRadius: "10px",
            display: "flex", alignItems: "center", gap: "10px",
          }}>
            <Icon icon={GithubIcon} size={18} color="#fff" />
            GitHub
          </a>
        </div>
      )}
    </>
  );
}

export function Footer() {
  const bankLinks = [
    { href: "/banks/cbe", label: "CBE" },
    { href: "/banks/telebirr", label: "Telebirr" },
    { href: "/banks/boa", label: "BOA" },
    { href: "/banks/dashen", label: "Dashen" },
    { href: "/banks/awash", label: "Awash" },
    { href: "/banks/zemen", label: "Zemen" },
    { href: "/banks/mpesa", label: "M-Pesa" },
    { href: "/banks/cbebirr", label: "CBE Birr" },
    { href: "/banks/siinqee", label: "Siinqee" },
  ];
  const guideLinks = [
    { href: "/guides/how-to-verify-cbe-receipt", label: "Verify CBE" },
    { href: "/guides/how-to-verify-telebirr-receipt", label: "Verify Telebirr" },
    { href: "/guides/how-to-verify-boa-receipt", label: "Verify BOA" },
    { href: "/guides/cbe-receipt-qr-code", label: "CBE QR codes" },
    { href: "/guides/free-receipt-verification-no-api-key", label: "Free verification" },
    { href: "/guides/payment-fraud-ethiopia", label: "Payment fraud" },
    { href: "/guides/check-et-vs-verify-et-vs-cheki", label: "Compare all" },
    { href: "/guides/payment-verification-api-guide", label: "API guide" },
    { href: "/guides/self-hosting-docker-guide", label: "Self-hosting" },
    { href: "/guides/contribute-new-bank", label: "Add a bank" },
  ];
  const seoLinks = [
    { href: "/verify/verify-cbe-receipt-online", label: "Verify CBE receipt" },
    { href: "/verify/verify-telebirr-receipt-online", label: "Verify Telebirr receipt" },
    { href: "/verify/verify-boa-receipt-online", label: "Verify BOA receipt" },
    { href: "/verify/verify-mpesa-receipt-online", label: "Verify M-Pesa receipt" },
    { href: "/verify/verify-dashen-receipt-online", label: "Verify Dashen receipt" },
    { href: "/verify/free-receipt-verification-ethiopia", label: "Free verification" },
    { href: "/verify/how-to-check-fake-receipt-ethiopia", label: "Check fake receipt" },
    { href: "/verify/cheki-vs-check-et-vs-verify-et", label: "cheki vs check.et" },
  ];
  const resourceLinks = [
    { href: "/verify/ethiopian-receipt-api-free", label: "Free receipt API" },
    { href: "/verify/receipt-verification-sdk-typescript", label: "TypeScript SDK" },
    { href: "/verify/receipt-verification-python-library", label: "Python library" },
    { href: "/verify/receipt-verification-for-business", label: "For businesses" },
    { href: "/verify/edited-screenshot-receipt-fraud", label: "Screenshot fraud" },
    { href: "/verify/old-receipt-reuse-fraud", label: "Old receipt fraud" },
    { href: "/verify/reference-number-fraud-ethiopia", label: "Reference fraud" },
    { href: "/verify/ethiopian-bank-receipt-formats", label: "Receipt formats" },
  ];
  return (
    <footer style={{ marginTop: "64px", borderTop: "1px solid var(--border)", background: "var(--surface-alt)" }}>
      <div className="container" style={{ padding: "40px 24px" }}>
        <div className="footer-grid" style={{
          display: "grid", gridTemplateColumns: "1fr", gap: "28px",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <span style={{ fontWeight: 800, fontSize: "18px", letterSpacing: "-0.03em" }}>cheki</span>
              <span style={{
                fontSize: "10px", fontWeight: 600, color: "var(--green)", border: "1px solid var(--green-light)",
                padding: "2px 6px", borderRadius: "4px", background: "var(--green-light)",
              }}>OSS</span>
            </div>
            <p style={{ fontSize: "13px", color: "var(--ink-3)", lineHeight: 1.6, maxWidth: "280px" }}>
              Free, open-source Ethiopian receipt verification. MIT licensed. Not affiliated with any bank.
            </p>
          </div>
          <div>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Banks</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {bankLinks.map((l) => (
                <a key={l.href} href={l.href} style={{ fontSize: "13px", color: "var(--ink-2)" }}>{l.label}</a>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Guides</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {guideLinks.map((l) => (
                <a key={l.href} href={l.href} style={{ fontSize: "13px", color: "var(--ink-2)" }}>{l.label}</a>
              ))}
              <a href="/guides" style={{ fontSize: "13px", color: "var(--green-dark)", fontWeight: 600 }}>All guides</a>
            </div>
          </div>
          <div>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Verify</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {seoLinks.map((l) => (
                <a key={l.href} href={l.href} style={{ fontSize: "13px", color: "var(--ink-2)" }}>{l.label}</a>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Resources</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {resourceLinks.map((l) => (
                <a key={l.href} href={l.href} style={{ fontSize: "13px", color: "var(--ink-2)" }}>{l.label}</a>
              ))}
            </div>
          </div>
        </div>
        <div style={{ marginTop: "28px", paddingTop: "20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <p style={{ fontSize: "12px", color: "var(--ink-3)" }}>cheki is not affiliated with any ethiopian bank or wallet. MIT licensed.</p>
          <div style={{ display: "flex", gap: "16px" }}>
            <a href="/docs" style={{ fontSize: "12px", color: "var(--ink-3)" }}>API Docs</a>
            <a href="https://github.com/1RB/cheki" target="_blank" rel="noopener" style={{ fontSize: "12px", color: "var(--ink-3)" }}>GitHub</a>
            <a href="https://github.com/1RB/cheki/tree/main/python" target="_blank" rel="noopener" style={{ fontSize: "12px", color: "var(--ink-3)" }}>Python</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
