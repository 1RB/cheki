"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon, GithubIcon, Menu01Icon, Cancel01Icon, ArrowRight01Icon } from "@/components/Icon";
import { useTranslation } from "@/lib/i18n/use-translation";
import { LanguageSwitcher } from "@/components/language-switcher";

export function Nav() {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (mobileOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
      document.body.style.overscrollBehavior = "none";
      document.body.dataset.scrollY = String(scrollY);
      return () => {
        document.body.style.overflow = "";
        document.body.style.touchAction = "";
        document.body.style.overscrollBehavior = "";
        window.scrollTo(0, Number(document.body.dataset.scrollY || 0));
      };
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
      document.body.style.overscrollBehavior = "";
    }
  }, [mobileOpen]);
  const links = [
    { href: "/", label: t("nav.verify") },
    { href: "/banks", label: t("nav.banks") },
    { href: "/guides", label: t("nav.guides") },
    { href: "/developers", label: t("nav.developers") },
    { href: "/compare", label: t("nav.compare") },
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
            <LanguageSwitcher />
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
      {mobileOpen && createPortal(
        <div className="nav-mobile-menu" style={{
          position: "fixed", top: "var(--nav-h)", left: 0, right: 0,
          height: "calc(100dvh - var(--nav-h))",
          background: "var(--bg)", zIndex: 99,
          display: "flex", flexDirection: "column",
          overflow: "hidden", isolation: "isolate",
        }}>
          <div style={{
            flex: 1,
            padding: "24px",
            display: "flex", flexDirection: "column", gap: "8px",
            overflowY: "auto", overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
          }}>
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)} style={{
                flexShrink: 0,
                padding: "16px 20px", fontSize: "18px", fontWeight: 600, color: "var(--ink)",
                borderRadius: "10px", background: "var(--surface)", border: "1px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                {l.label}
                <Icon icon={ArrowRight01Icon} size={18} color="var(--ink-3)" />
              </a>
            ))}
            <a href="https://github.com/1RB/cheki" target="_blank" rel="noopener" onClick={() => setMobileOpen(false)} style={{
              flexShrink: 0,
              padding: "16px 20px", fontSize: "18px", fontWeight: 600, color: "#fff",
              background: "var(--ink)", borderRadius: "10px",
              display: "flex", alignItems: "center", gap: "10px",
            }}>
              <Icon icon={GithubIcon} size={18} color="#fff" />
              GitHub
            </a>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export function Footer() {
  const { t } = useTranslation();
  const bankLinks = [
    { href: "/banks/cbe", label: "CBE" },
    { href: "/banks/telebirr", label: "Telebirr" },
    { href: "/banks/boa", label: "BOA" },
    { href: "/banks/mpesa", label: "M-Pesa" },
    { href: "/banks/dashen", label: "Dashen" },
  ];
  const guideLinks = [
    { href: "/guides/how-to-verify-cbe-receipt", label: t("footer.verify") + " CBE" },
    { href: "/guides/how-to-verify-telebirr-receipt", label: t("footer.verify") + " Telebirr" },
    { href: "/guides/free-receipt-verification-no-api-key", label: t("footer.guides") },
    { href: "/guides/payment-fraud-ethiopia", label: "Payment fraud" },
    { href: "/guides/contribute-new-bank", label: "Add a bank" },
  ];
  const resourceLinks = [
    { href: "/developers", label: "API" },
    { href: "/docs", label: t("footer.apiDocs") },
    { href: "https://github.com/1RB/cheki", label: t("footer.github") },
    { href: "https://github.com/1RB/cheki/tree/main/python", label: t("footer.python") },
  ];
  return (
    <footer style={{ marginTop: "64px", borderTop: "1px solid var(--border)", background: "var(--surface-alt)" }}>
      <div className="container" style={{ padding: "40px 24px" }}>
        <div className="footer-grid" style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "28px",
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
              {t("footer.tagline")}
            </p>
            <a href="/guides/contribute-translations" style={{
              display: "inline-flex", marginTop: "12px", fontSize: "13px", color: "var(--green-dark)", fontWeight: 600,
            }}>
              {t("language.contribute")}
            </a>
          </div>
          <div>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>{t("footer.banks")}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {bankLinks.map((l) => (
                <a key={l.href} href={l.href} style={{ fontSize: "13px", color: "var(--ink-2)" }}>{l.label}</a>
              ))}
              <a href="/banks" style={{ fontSize: "13px", color: "var(--green-dark)", fontWeight: 600 }}>{t("footer.banks")}</a>
            </div>
          </div>
          <div>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>{t("footer.guides")}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {guideLinks.map((l) => (
                <a key={l.href} href={l.href} style={{ fontSize: "13px", color: "var(--ink-2)" }}>{l.label}</a>
              ))}
              <a href="/guides" style={{ fontSize: "13px", color: "var(--green-dark)", fontWeight: 600 }}>{t("footer.allGuides")}</a>
            </div>
          </div>
          <div>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>{t("footer.resources")}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {resourceLinks.map((l) => (
                <a key={l.href} href={l.href} style={{ fontSize: "13px", color: "var(--ink-2)" }}>{l.label}</a>
              ))}
            </div>
          </div>
        </div>
        <div style={{ marginTop: "28px", paddingTop: "20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <p style={{ fontSize: "12px", color: "var(--ink-3)" }}>{t("footer.legal")}</p>
          <div style={{ display: "flex", gap: "16px" }}>
            <a href="/docs" style={{ fontSize: "12px", color: "var(--ink-3)" }}>{t("footer.apiDocs")}</a>
            <a href="https://github.com/1RB/cheki" target="_blank" rel="noopener" style={{ fontSize: "12px", color: "var(--ink-3)" }}>{t("footer.github")}</a>
            <a href="https://github.com/1RB/cheki/tree/main/python" target="_blank" rel="noopener" style={{ fontSize: "12px", color: "var(--ink-3)" }}>{t("footer.python")}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
