/**
 * The homepage. A server component: the guides corpus, the FAQ and the bank
 * list render here and never ship to the browser. The client islands are the
 * checker (VerifyPanel), the "how a check works" slider, the agent-prompt
 * button and translated strings.
 *
 * Composition (Taste Skill direction "The product performs"): the product
 * leads at true size, and each later section shows a working fragment of it
 * rather than describing it. Fragments are marked data-ui; the rest of the
 * page draws no lines and no resting shadows.
 */
import "./home/home.css";
import { Fragment } from "react";
import Link from "next/link";
import { banks } from "@/lib/banks";
import { articles } from "@/lib/guides";
import { homeFaqs } from "@/lib/home-faq";
import { linkOutBankList, linkOutNote } from "@/lib/bank-counts";
import { SAMPLE } from "@/lib/sample-receipt";
import { Nav, Footer } from "@/components/Chrome";
import { BankLogoByName } from "@/components/BankLogo";
import { VerifyPanel } from "@/components/verify/VerifyPanel";
import { T } from "@/components/home/T";
import { AgentPrompt } from "@/components/home/AgentPrompt";
import { HowItWorks } from "@/components/home/HowItWorks";
import { Photo, PhotoCredits } from "@/components/Photo";
import { Icon, Camera01Icon, Upload01Icon, ArrowRight01Icon } from "@/components/Icon";

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

const amount = SAMPLE.amount.toLocaleString("en-US", { minimumFractionDigits: 2 });

/**
 * The capabilities, each beside a cropped fragment of the product doing it.
 * Fragments are static pictures of the interface (inert), not controls.
 */
const FEATURES: { title: string; body: string; frag: React.ReactNode }[] = [
  {
    title: "Honest results",
    body: "Green only when the bank's record confirms the receipt. A decoded QR or pasted text is marked as not confirmed.",
    frag: (
      <ul className="fx-verdicts">
        <li><span className="hw-dot" data-tone="green" />Confirmed by CBE</li>
        <li><span className="hw-dot" data-tone="amber" />Decoded from the QR, not confirmed</li>
        <li><span className="hw-dot" data-tone="red" />Not found at the bank</li>
      </ul>
    ),
  },
  {
    title: "QR, photo or paste",
    body: "Scan the QR with your camera, drop a screenshot, or paste the link. OCR reads the transaction number when there is no QR.",
    frag: (
      <div className="fx-field">
        <code>{SAMPLE.reference}</code>
        <span aria-hidden="true">
          <Icon icon={Camera01Icon} size={18} color="var(--ink-2)" />
          <Icon icon={Upload01Icon} size={18} color="var(--ink-2)" />
        </span>
      </div>
    ),
  },
  {
    title: "Same JSON for every bank",
    body: "Every bank returns the same response shape. Write the integration once. SDKs for TS, Python, Dart, PHP and Go.",
    frag: (
      <pre className="fx-code"><code>{`{
  "verified": true,
  "bank": "Commercial Bank of Ethiopia",
  "amount": ${SAMPLE.amount},
  "receiverName": "${SAMPLE.receiverName}",
  "sourceUrl": "${SAMPLE.receiptUrl}"
}`}</code></pre>
    ),
  },
  {
    title: "No API key, no signup",
    body: "Start checking immediately: no account and no business plan. Each check asks the bank's own public receipt page, live, in about two seconds.",
    frag: (
      <pre className="fx-code"><code>{`curl -X POST https://cheki.et/api/verify \\
  -d '{"bank":"cbe",
       "reference":"${SAMPLE.receiptId}"}'`}</code></pre>
    ),
  },
  {
    title: "Batch reconciliation",
    body: "Check up to 20 receipts in one API call, or drop a folder of screenshots on the page.",
    frag: (
      <ul className="fx-batch">
        <li><span className="hw-dot" data-tone="green" /><code>FT26SAMPLE01</code><span>{amount}</span></li>
        <li><span className="hw-dot" data-tone="green" /><code>FT26SAMPLE02</code><span>480.00</span></li>
        <li><span className="hw-dot" data-tone="red" /><code>FT26SAMPLE03</code><span>Not found</span></li>
        <li><span className="hw-dot" data-tone="green" /><code>FT26SAMPLE04</code><span>2,000.00</span></li>
      </ul>
    ),
  },
  {
    title: "Open source, self-hosted",
    body: "MIT licensed. Run it with Docker on an Ethiopian network to reach the wallets that block foreign servers.",
    frag: (
      <pre className="fx-code"><code>{`git clone https://github.com/1RB/cheki
cd cheki
docker compose up -d`}</code></pre>
    ),
  },
];

/**
 * Break opportunities after "/", "?", "&" and "." so a long endpoint wraps at
 * its own separators on a phone instead of mid-word.
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
        <section className="container-wide hp-hero">
          <div className="hp-hero-grid">
            <div className="hp-hero-copy">
              <h1 className="hp-title">
                <T k="hero.titleLead" /> <T k="hero.titleRest" />
              </h1>
              <div className="hp-hero-desktop-extra">
                <AgentPrompt />
              </div>
            </div>

            <div id="verify" className="hp-panel">
              <VerifyPanel />
            </div>
          </div>
          {/* Phones: the same spot as on desktop, the end of the hero. */}
          <div className="hp-agent-mobile">
            <AgentPrompt />
          </div>
        </section>

        <HowItWorks />

        <section className="container-wide hp-section hp-cells-sec">
          <h2 className="hp-h2">What a check gives you</h2>
          <ul className="hp-cells">
            {FEATURES.map((f) => (
              <li key={f.title} className="hp-cell">
                <div className="hp-cell-text">
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
                <div className="hp-cell-frag" data-ui inert>
                  {f.frag}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="container-wide hp-section hp-biz">
          <Photo id="counter" className="hp-biz-photo" sizes="(min-width: 900px) 560px, 100vw" />
          <div className="hp-biz-copy">
            <h2 id="business" className="hp-h2">Receipt verification for your business</h2>
            <p className="hp-p">Free for a business of any size: no per-check fee, no subscription, no signup. Fake screenshots, reused receipts and made-up references are caught the same way, by asking the bank.</p>
            <ul className="hp-uses">
              {BUSINESS_USES.map((f) => (
                <li key={f.title}>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="container-wide hp-section hp-split">
          <div className="hp-split-head">
            <h2 className="hp-h2">{direct.length} banks and wallets checked directly</h2>
            <p className="hp-p">
              Each one publishes its receipts at a public address, and cheki reads that page.{" "}
              {linkOut > 0 && <>Plus {linkOutBankList()} through their official receipt pages. </>}
              <Link href="/banks" prefetch={false}>{research} more in research</Link>.
            </p>
            {linkOut > 0 && <p className="hp-p hp-p--quiet">{linkOutNote()}</p>}
          </div>
          <ul className="hp-endpoints">
            {live.map((b) => (
              <li key={b.code}>
                <Link href={`/banks/${b.code}`} prefetch={false} className="hp-endpoint">
                  <span className="hp-bank-text">
                    <span className="hp-bank-name"><BankLogoByName code={b.code} size={20} />{b.shortName}</span>
                    {/* Label the exception only: the two link-out wallets. */}
                    {b.geoBlocked && <span className="hp-badge" data-tone="amber">Official page</span>}
                  </span>
                  <code className="hp-endpoint-url">{breakableUrl(b.endpointFormat)}</code>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="container-wide hp-section hp-guides-sec">
          <div className="hp-section-head">
            <h2 className="hp-h2">Guides and articles</h2>
            <Link href="/guides" prefetch={false} className="hp-more">All {articles.length} articles<Icon icon={ArrowRight01Icon} size={16} color="currentColor" /></Link>
          </div>
          <div className="hp-guides-grid">
            <Photo id="shopByNight" className="hp-guides-photo" sizes="(min-width: 900px) 520px, 100vw" />
            <ul className="hp-guides">
              {featured.map((a) => (
                <li key={a.slug}>
                  <Link href={`/guides/${a.slug}`} prefetch={false} className="hp-guide">
                    <h3>{a.title}</h3>
                    <p>{a.excerpt}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="hp-band">
          <div className="container-wide hp-community">
            <div>
              <h2 className="hp-h2">Built by the community, for the community</h2>
              <p>
                cheki is MIT licensed and lives on GitHub. No company owns it. If a bank changes its receipt page,
                anyone can submit a fix.
              </p>
              <div className="hp-community-links">
                <a href="https://github.com/1RB/cheki" target="_blank" rel="noopener noreferrer" className="hp-cta">Star cheki on GitHub</a>
                <a href="https://github.com/1RB/cheki/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer" className="hp-textlink">Read the contributing guide<Icon icon={ArrowRight01Icon} size={16} color="currentColor" /></a>
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
        <section className="container-wide hp-section hp-faq" id="faq">
          <h2 className="hp-h2">Questions people ask</h2>
          <div className="hp-faq-list">
            {homeFaqs.map((f) => (
              <details key={f.q} name="home-faq">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
        <PhotoCredits ids={["counter", "shopByNight"]} />
      </main>
      <Footer />
    </>
  );
}
