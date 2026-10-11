"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { Icon, GithubIcon, Menu01Icon, Cancel01Icon, ArrowRight01Icon, Search01Icon } from "@/components/Icon";
import { useTranslation } from "@/lib/i18n/use-translation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/motion/theme-toggle";

// The palette (and its search index) loads on the first ⌘K or click only.
const CommandPalette = dynamic(() => import("@/components/motion/command-palette"), { ssr: false });

/**
 * Mobile menu as a real modal: focus moves in on open and is kept inside,
 * Escape closes it, focus returns to the toggle, and everything behind it is
 * inert (not just covered).
 */
function MobileMenu({ links, onClose, t }: { links: { href: string; label: string }[]; onClose: () => void; t: (k: string) => string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const siblings = Array.from(document.body.children).filter((el) => !el.contains(root));
    siblings.forEach((el) => el.setAttribute("inert", ""));
    const prev = { overflow: document.body.style.overflow, touch: document.body.style.touchAction };
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    root.querySelector<HTMLElement>("a, button")?.focus();
    return () => {
      siblings.forEach((el) => el.removeAttribute("inert"));
      document.body.style.overflow = prev.overflow;
      document.body.style.touchAction = prev.touch;
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !ref.current) return;
    const focusable = Array.from(ref.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div ref={ref} className="nav-mobile-menu" role="dialog" aria-modal="true" aria-label="Menu" onKeyDown={onKeyDown}>
      <div className="nmm-head">
        <Link href="/" onClick={onClose} className="nav-logo" prefetch={false}>
          <span className="nav-logo-word">cheki</span>
          <span className="nav-oss">OSS</span>
        </Link>
        <button type="button" onClick={onClose} className="nav-icon-btn" aria-label="Close menu">
          <Icon icon={Cancel01Icon} size={22} color="var(--ink)" />
        </button>
      </div>
      <div className="nmm-body">
        {links.map((l) => (
          <Link key={l.href} href={l.href} onClick={onClose} className="nmm-link" prefetch={false}>
            {l.label}
            <Icon icon={ArrowRight01Icon} size={18} color="var(--ink-3)" />
          </Link>
        ))}
        <div className="nmm-row">
          <span>{t("language.switch")}</span>
          <LanguageSwitcher />
        </div>
        <div className="nmm-row">
          <span>Theme</span>
          <ThemeToggle size={36} />
        </div>
        <a href="https://github.com/1RB/cheki" target="_blank" rel="noopener noreferrer" onClick={onClose} className="nmm-gh">
          <Icon icon={GithubIcon} size={18} color="var(--bg)" />
          GitHub
        </a>
      </div>
    </div>,
    document.body
  );
}

export function Nav() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstPath = useRef(pathname);

  // After the first client-side navigation, pages fade in (see .t-page-enter).
  useEffect(() => {
    if (pathname !== firstPath.current) document.documentElement.dataset.nav = "1";
  }, [pathname]);

  const closeMenu = useCallback(() => {
    setMobileOpen(false);
    requestAnimationFrame(() => toggleRef.current?.focus());
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const links = [
    { href: "/", label: t("nav.verify") },
    { href: "/banks", label: t("nav.banks") },
    { href: "/guides", label: t("nav.guides") },
    { href: "/developers", label: t("nav.developers") },
    { href: "/endpoints", label: t("nav.endpoints") },
    { href: "/compare", label: t("nav.compare") },
  ];

  return (
    <>
      <nav aria-label="Main" className="site-nav">
        <div className="container nav-inner">
          <div className="nav-left">
            <Link href="/" className="nav-logo" prefetch={false}>
              <span className="nav-logo-word">cheki</span>
              <span className="nav-oss">OSS</span>
            </Link>
            <div className="nav-desktop nav-links">
              {links.map((l) => {
                const here = l.href === "/" ? pathname === "/" : pathname === l.href || pathname.startsWith(`${l.href}/`);
                return (
                  <Link key={l.href} href={l.href} prefetch={false} aria-current={here ? "page" : undefined} className="nav-link">
                    {l.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="nav-desktop nav-right">
            <button type="button" className="nav-icon-btn" onClick={() => setPaletteOpen(true)} aria-label="Search (⌘K)" aria-haspopup="dialog">
              <Icon icon={Search01Icon} size={17} color="var(--ink-3)" />
            </button>
            <LanguageSwitcher />
            <ThemeToggle />
            <a href="https://github.com/1RB/cheki" target="_blank" rel="noopener noreferrer" className="nav-gh">
              <Icon icon={GithubIcon} size={14} color="var(--bg)" />
              GitHub
            </a>
          </div>

          <div className="nav-mobile-actions">
            <button type="button" className="nav-icon-btn nav-mobile-only" onClick={() => setPaletteOpen(true)} aria-label="Search" aria-haspopup="dialog">
              <Icon icon={Search01Icon} size={20} color="var(--ink-2)" />
            </button>
            <button
              ref={toggleRef}
              type="button"
              className="nav-icon-btn nav-mobile-toggle"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              aria-haspopup="dialog"
              aria-expanded={mobileOpen}
            >
              <Icon icon={Menu01Icon} size={22} color="var(--ink)" />
            </button>
          </div>
        </div>
      </nav>
      {mobileOpen && <MobileMenu links={links} onClose={closeMenu} t={t} />}
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
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
    { href: "/endpoints", label: "Endpoints" },
    { href: "/status", label: "Status" },
    { href: "/verify", label: "Verify guides" },
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
                fontSize: "11px", fontWeight: 600, color: "var(--green-dark)", border: "1px solid var(--green-light)",
                padding: "2px 6px", borderRadius: "4px", background: "var(--green-light)",
              }}>OSS</span>
            </div>
            <p style={{ fontSize: "13px", color: "var(--ink-3)", lineHeight: 1.6, maxWidth: "280px" }}>
              {t("footer.tagline")}
            </p>
            <Link href="/guides/contribute-translations" prefetch={false} style={{
              display: "inline-flex", marginTop: "12px", fontSize: "13px", color: "var(--green-dark)", fontWeight: 600,
            }}>
              {t("language.contribute")}
            </Link>
          </div>
          <div>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>{t("footer.banks")}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {bankLinks.map((l) => (
                <Link key={l.href} href={l.href} prefetch={false} style={{ fontSize: "13px", color: "var(--ink-2)" }}>{l.label}</Link>
              ))}
              <Link href="/banks" prefetch={false} style={{ fontSize: "13px", color: "var(--green-dark)", fontWeight: 600 }}>{t("footer.banks")}</Link>
            </div>
          </div>
          <div>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>{t("footer.guides")}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {guideLinks.map((l) => (
                <Link key={l.href} href={l.href} prefetch={false} style={{ fontSize: "13px", color: "var(--ink-2)" }}>{l.label}</Link>
              ))}
              <Link href="/guides" prefetch={false} style={{ fontSize: "13px", color: "var(--green-dark)", fontWeight: 600 }}>{t("footer.allGuides")}</Link>
            </div>
          </div>
          <div>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>{t("footer.resources")}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {resourceLinks.map((l) => (
                <Link key={l.href} href={l.href} prefetch={false} style={{ fontSize: "13px", color: "var(--ink-2)" }}>{l.label}</Link>
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
