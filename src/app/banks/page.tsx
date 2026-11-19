"use client";

import { useState } from "react";
import { banks } from "@/lib/banks";
import { Nav, Footer } from "@/components/Chrome";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Icon, ChevronDownIcon, ChevronUpIcon, ArrowRight01Icon } from "@/components/Icon";
import { BankMark } from "@/components/BankLogo";
import "@/components/page/page.css";
import { NEW_BANK_ISSUE_URL } from "@/lib/trust-pages";

export default function BanksPage() {
  const { t } = useTranslation();
  const [showInDevelopment, setShowInDevelopment] = useState(false);
  const live = banks.filter((b) => b.status === "live");
  // Grouped by what cheki.et does with the receipt, so the section heading
  // carries the meaning a chip on every card used to.
  const direct = live.filter((b) => !b.geoBlocked);
  const linkOut = live.filter((b) => b.geoBlocked);
  const inDev = banks.filter((b) => b.status === "soon");

  // One row per bank. The group (or the in-development toggle) says the
  // status; the only label on a row is the exception that decides whether the
  // reader can act: "Account required".
  const BankRow = ({ b }: { b: (typeof banks)[0] }) => (
    <li>
      <a href={`/banks/${b.code}`} className="pg-row">
        <BankMark code={b.code} shortName={b.shortName} color={b.color} size={24} />
        <span className="pg-row-name">{b.shortName}</span>
        {b.requiresAccount && (
          <span className="bank-meta__chip pg-row-meta">{t("banks.accountRequired")}</span>
        )}
      </a>
    </li>
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
      <main className="pg">
        <div className="container-wide">
          <nav aria-label="Breadcrumb">
            <ol className="pg-crumb" role="list">
              <li><a href="/">Home</a></li>
              <li aria-current="page">{t("nav.banks")}</li>
            </ol>
          </nav>
          <h1 className="pg-title">{t("banks.title")}</h1>

          <section aria-labelledby="banks-direct" className="pg-split pg-section--near">
            <h2 id="banks-direct" className="pg-h2 pg-split-head">
              {t("banks.checkedDirectly")} <span className="pg-count">{direct.length}</span>
            </h2>
            <ul className="pg-rows pg-rows--2">
              {direct.map((b) => <BankRow key={b.code} b={b} />)}
            </ul>
          </section>

          {linkOut.length > 0 && (
            <section aria-labelledby="banks-linkout" className="pg-split pg-section--near">
              <h2 id="banks-linkout" className="pg-h2 pg-split-head">
                {t("banks.officialPage")} <span className="pg-count">{linkOut.length}</span>
              </h2>
              <ul className="pg-rows pg-rows--2">
                {linkOut.map((b) => <BankRow key={b.code} b={b} />)}
              </ul>
            </section>
          )}

          <div className="pg-split pg-section--near">
            <div className="pg-split-head" aria-hidden="true" />
            <div>
              <button
                type="button"
                className="pg-btn"
                aria-expanded={showInDevelopment}
                aria-controls="banks-in-dev"
                onClick={() => setShowInDevelopment((s) => !s)}
              >
                {showInDevelopment ? t("banks.hideInDevelopment") : t("banks.showInDevelopment", { count: inDev.length })}
                <Icon icon={showInDevelopment ? ChevronUpIcon : ChevronDownIcon} size={16} color="var(--ink-2)" />
              </button>
              {showInDevelopment && (
                <ul id="banks-in-dev" className="pg-rows pg-rows--2" style={{ marginTop: "16px" }}>
                  {inDev.map((b) => <BankRow key={b.code} b={b} />)}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Community contribution: the page's one dark field. */}
        <section className="pg-band" aria-labelledby="banks-contribute">
          <div className="container-wide pg-band-grid">
            <div>
              <h2 id="banks-contribute" className="pg-h2">{t("banks.contribute")}</h2>
              <p className="pg-p">
                {inDev.length} Ethiopian banks still need receipt endpoints. If you use one of these banks and can share a receipt with a QR code or receipt URL, we can reverse-engineer the endpoint and add it to cheki for free. No technical knowledge needed, just send us a screenshot or link.
              </p>
              <div className="pg-actions">
                <a href={NEW_BANK_ISSUE_URL} target="_blank" rel="noopener" className="pg-cta">
                  Submit a bank on GitHub
                </a>
                <a href="https://t.me/raysterminalbot" target="_blank" rel="noopener" className="pg-textlink">
                  Send via Telegram
                  <Icon icon={ArrowRight01Icon} size={16} color="currentColor" />
                </a>
              </div>
            </div>
            <div>
              <h3 className="pg-h3">Three ways to contribute</h3>
              <ol className="pg-band-list" style={{ marginTop: "20px" }}>
                <li>
                  <h4 className="pg-h3">Share a receipt</h4>
                  <p>Send us a receipt screenshot or URL from a bank we don&apos;t support yet. We&apos;ll figure out the endpoint.</p>
                </li>
                <li>
                  <h4 className="pg-h3">Write a parser</h4>
                  <p>If you code, fork the repo and add a parser. The architecture is hexagonal, each bank is a self-contained module.</p>
                </li>
                <li>
                  <h4 className="pg-h3">Report broken endpoints</h4>
                  <p>If a bank changes their receipt URL format, open an issue on GitHub. We fix it fast because the community can submit patches.</p>
                </li>
              </ol>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
