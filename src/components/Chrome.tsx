export function Nav() {
  const links = [
    { href: "/", label: "Verify" },
    { href: "/banks", label: "Banks" },
    { href: "/guides", label: "Guides" },
    { href: "/developers", label: "Developers" },
    { href: "/compare", label: "Compare" },
  ];
  return (
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
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
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
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            GitHub
          </a>
        </div>
      </div>
    </nav>
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
    { href: "/guides/cbe-receipt-qr-code", label: "CBE QR codes" },
    { href: "/guides/free-receipt-verification-no-api-key", label: "Free verification" },
    { href: "/guides/payment-fraud-ethiopia", label: "Payment fraud" },
    { href: "/guides/check-et-vs-verify-et-vs-cheki", label: "vs check.et" },
    { href: "/guides/payment-verification-api-guide", label: "API guide" },
    { href: "/guides/self-hosting-docker-guide", label: "Self-hosting" },
  ];
  return (
    <footer style={{ marginTop: "80px", borderTop: "1px solid var(--border)", background: "var(--surface-alt)" }}>
      <div className="container" style={{ padding: "48px 24px" }}>
        <div className="grid-3" style={{ gap: "32px" }}>
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
        </div>
        <div style={{ marginTop: "32px", paddingTop: "20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
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
