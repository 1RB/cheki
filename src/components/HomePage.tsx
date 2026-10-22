/**
 * The homepage. A server component: the guides corpus, the FAQ and the bank
 * list render here and never ship to the browser. The only client islands are
 * the checker (VerifyPanel), the agent-prompt button and translated strings.
 */
import "./home/home.css";
import { Fragment } from "react";
import Link from "next/link";
import { banks } from "@/lib/banks";
import { articles } from "@/lib/guides";
import { homeFaqs } from "@/lib/home-faq";
import { linkOutBankList, linkOutNote } from "@/lib/bank-counts";
import { Nav, Footer } from "@/components/Chrome";
import { BankLogoByName } from "@/components/BankLogo";
import { VerifyPanel } from "@/components/verify/VerifyPanel";
import { T } from "@/components/home/T";
import { AgentPrompt } from "@/components/home/AgentPrompt";

const FEATURED_GUIDES = [
  "payment-fraud-ethiopia",
  "boa-qr-code-receipts",
  "free-receipt-verification-no-api-key",
  "cbe-receipt-qr-code",
  "ethiopian-bank-receipt-formats",
  "contribute-new-bank",
];

/** Who checks receipts, and how cheki fits each (the "for business" section). */
const BUSINESS_USES = [
  { title: "Shops and counters", body: "Staff check a transfer on cheki.et before the goods leave the counter. No integration, no accounts to set up." },
  { title: "Online orders", body: "Your backend calls POST /api/verify before an order ships, or the SDK for TypeScript, Python, Go, PHP or Dart." },
  { title: "Delivery", body: "Riders check cash-on-delivery transfers at the door, and the day's receipts are checked again in one batch." },
  { title: "Accounting", body: "POST /api/verify/batch checks up to 20 receipts per call for end-of-day reconciliation. Self-host if you need more." },
];

const FEATURES = [
  { title: "Answers in seconds", body: "Each check asks the bank's own public receipt page, live. Fast enough for a checkout counter." },
  { title: "No API key, no signup", body: "Start checking immediately. No account, no business plan, no credit limit." },
  { title: "Honest results", body: "Green only when the bank's record confirms the receipt. A decoded QR or pasted text is marked as not confirmed." },
  { title: "Batch reconciliation", body: "Check up to 20 receipts in one API call, or drop a folder of screenshots on the page." },
  { title: "QR, photo and OCR", body: "Scan the QR with your camera, paste a screenshot, or let OCR read the transaction number." },
  { title: "Self-host with Docker", body: "Run cheki on an Ethiopian network to reach the wallets that block foreign servers." },
  { title: "Same JSON for every bank", body: "Every bank returns the same response shape. Write the integration once. SDKs for TS, Python, Dart, PHP and Go." },
  { title: "Open source", body: "MIT licensed. Read the code, contribute, fork it. No black box." },
];

/**
 * Break opportunities after "/", "?", "&" and "." so a long endpoint wraps at
 * its own separators on a phone instead of mid-word. Desktop keeps the URL on
 * one line (white-space: nowrap), where <wbr> does nothing.
 */
function breakableUrl(url: string) {
  return url.split(/(?<=[/?&.])/).map((part, i) => (
    <Fragment key={i}>{i > 0 && <wbr />}{part}</Fragment>
  ));
}

export function HomePage() {
  const live = banks.filter((b) => b.status === "live");
  // Telebirr and M-Pesa block cloud servers: cheki.et opens their official
  // receipt page instead of checking them, so they are not counted as direct.
  const direct = live.filter((b) => !b.geoBlocked);
  const linkOut = live.length - direct.length;
  const research = banks.filter((b) => b.status === "soon").length;
  const featured = FEATURED_GUIDES.map((slug) => articles.find((a) => a.slug === slug)).filter((a): a is (typeof articles)[number] => Boolean(a));

  return (
    <>
      <Nav />
      <main>
        <section className="container hp-hero">
          <div className="hp-hero-grid">
            <div className="hp-hero-copy">
              <h1 className="hp-title">
                <T k="hero.titleLead" /> <span className="hp-title-rest"><T k="hero.titleRest" /></span>
              </h1>
              <p className="hp-lede"><T k="hero.subtitle" /></p>
              <ul className="hp-trust" aria-label="Why cheki">
                <li>{direct.length} banks and wallets checked directly</li>
                <li>Answers in seconds</li>
                <li>Open source</li>
              </ul>
              <div className="hp-hero-desktop-extra">
                <AgentPrompt />
              </div>
            </div>

            <div id="verify" className="hp-panel">
              <VerifyPanel />
            </div>
          </div>
          {/* Phones: the same spot as on desktop, the end of the hero, right
              before the endpoint list (the developer content it introduces). */}
          <div className="hp-agent-mobile">
            <AgentPrompt />
          </div>
        </section>

        <section className="container hp-section">
          <h2 className="hp-h2">The banks publish receipts on public pages</h2>
          <p className="hp-p">
            Ethiopian banks and wallets publish each transaction receipt at a public address. cheki asks that page,
            reads it, and returns the same JSON for every bank, with the source link so you can open it yourself.
          </p>
          {linkOut > 0 && <p className="hp-p">{linkOutNote()}</p>}
          <div className="hp-term">
            <div className="hp-term-bar" aria-hidden="true">
              <span /><span /><span />
              <code>cheki --list-endpoints</code>
            </div>
            <ul className="hp-endpoints">
              {live.map((b) => (
                <li key={b.code}>
                  <Link href={`/banks/${b.code}`} prefetch={false} className="hp-endpoint">
                    <span className="hp-endpoint-name">
                      <span className="hp-dot" style={{ background: b.color }} aria-hidden="true" />
                      {b.shortName}
                    </span>
                    <span className="hp-endpoint-url">{breakableUrl(b.endpointFormat)}</span>
                    <span className="hp-badge" data-tone={b.geoBlocked ? "amber" : "green"}>{b.geoBlocked ? "Official page" : "Checked directly"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="container hp-section hp-features">
          <div>
            <h2 className="hp-h2">Everything you need, nothing you don&apos;t</h2>
            <p className="hp-p">A single-purpose tool. No dashboards, no accounts, no billing portal.</p>
          </div>
          <ol className="hp-feature-list">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="container hp-section hp-features">
          <div>
            <h2 id="business" className="hp-h2" style={{ scrollMarginTop: "80px" }}>Receipt verification for your business</h2>
            <p className="hp-p">Free for a business of any size: no per-check fee, no subscription, no signup. Fake screenshots, reused receipts and made-up references are caught the same way, by asking the bank.</p>
          </div>
          <ol className="hp-feature-list">
            {BUSINESS_USES.map((f) => (
              <li key={f.title}>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="container hp-section">
          <div className="hp-section-head">
            <h2 className="hp-h2">Guides and articles</h2>
            <Link href="/guides" prefetch={false} className="hp-more">All {articles.length} articles</Link>
          </div>
          <div className="hp-guides">
            {featured.map((a, i) => (
              <Link key={a.slug} href={`/guides/${a.slug}`} prefetch={false} className="hp-guide" data-featured={i === 0 || undefined}>
                <span className="hp-guide-meta">
                  <span>{a.category.replace("-", " ")}</span>
                  <span>{a.readTime}</span>
                </span>
                <h3>{a.title}</h3>
                <p>{a.excerpt}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="container hp-section">
          <h2 className="hp-h2">{direct.length} banks and wallets checked directly</h2>
          <p className="hp-p">
            {linkOut > 0 && <>Plus {linkOutBankList()} through their official receipt pages. </>}
            {research} more in research. All use public receipt pages.
          </p>
          <ul className="hp-banks">
            {live.map((b) => (
              <li key={b.code}>
                <Link href={`/banks/${b.code}`} prefetch={false} className="hp-bank">
                  <BankLogoByName code={b.code} size={32} />
                  <span className="hp-bank-text">
                    <span className="hp-bank-name">{b.shortName}</span>
                    {b.geoBlocked && <span className="hp-badge" data-tone="amber">Official page</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="hp-small">
            {research} banks are still in research. <Link href="/banks" prefetch={false}>Help us add them</Link>
          </p>
        </section>

        <section className="container hp-section">
          <div className="hp-community">
            <div>
              <h2 className="hp-h2">Built by the community, for the community</h2>
              <p>
                cheki is MIT licensed and lives on GitHub. No company owns it. If a bank changes its receipt page,
                anyone can submit a fix.
              </p>
              <div className="hp-community-links">
                <a href="https://github.com/1RB/cheki" target="_blank" rel="noopener noreferrer" className="hp-cta">Star on GitHub</a>
                <a href="https://github.com/1RB/cheki/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer" className="hp-cta hp-cta--ghost">Contribute</a>
              </div>
            </div>
            <dl className="hp-facts">
              {[
                ["License", "MIT"],
                ["Banks", linkOut > 0 ? `${banks.length} (${direct.length} checked directly, ${linkOut} via official page)` : `${banks.length} (${live.length} live)`],
                ["SDKs", "TS, Python, Dart, PHP, Go"],
                ["CLI", "cheki verify, info, health"],
                ["Self-hosting", "Docker included"],
              ].map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          </div>
        </section>

        {/* The FAQPage JSON-LD on this route is generated from these exact strings. */}
        <section className="container hp-section hp-faq" id="faq">
          <h2 className="hp-h2">Questions people actually ask</h2>
          <p className="hp-p">
            If yours is not here,{" "}
            <a href="https://github.com/1RB/cheki/issues" target="_blank" rel="noopener noreferrer">open an issue</a>. The answers stay in public.
          </p>
          <div className="hp-faq-list">
            {homeFaqs.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
