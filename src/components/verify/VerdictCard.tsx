"use client";

/**
 * The verdict, typeset like a receipt: a status dot and one sentence that
 * answers "can I hand over the goods?", the amount, then label/value rows.
 * Colour is only the dot (set by data-tone in CSS). Everything it shows comes
 * from presentVerdict() (src/lib/verify/verdict.ts); this component never
 * decides a colour itself.
 */
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import type { VerifyResult } from "@/lib/banks";
import { publicJson, type Verdict } from "@/lib/verify/verdict";
import { formatAmount, resultText } from "@/lib/verify/summary";
import type { Translate } from "@/lib/i18n/translate";
import { BankLogoByName } from "@/components/BankLogo";
import { RelativeTime } from "@/components/RelativeTime";
import {
  Icon,
  Copy01Icon,
  CopyCheckIcon,
  Share08Icon,
  Link01Icon,
  PrinterIcon,
  RefreshIcon,
  ArrowUpRight01Icon,
  ChevronDownIcon,
} from "@/components/Icon";

interface Props {
  verdict: Verdict;
  result: VerifyResult | null;
  checkedAt: Date;
  t: Translate;
  onAnother: () => void;
  onRetry?: () => void;
  /** Re-check link for this result: opening it asks the bank again. */
  shareUrl?: string;
}

const noop = () => () => {};
function useCanShare(): boolean {
  return useSyncExternalStore(
    noop,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false
  );
}

function splitAmount(value: number): { whole: string; cents?: string } {
  const [whole, cents] = value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).split(".");
  return { whole, cents };
}

function Countdown({ seconds, t, onRetry }: { seconds: number; t: Translate; onRetry?: () => void }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  return (
    <button type="button" className="vc-btn vc-btn--primary" onClick={onRetry} disabled={left > 0 || !onRetry} aria-live="off">
      <Icon icon={RefreshIcon} size={16} />
      <span className="vc-num">{left > 0 ? t("verify.card.retryIn", { s: left }) : t("verify.card.retry")}</span>
    </button>
  );
}

export function VerdictCard({ verdict, result, checkedAt, t, onAnother, onRetry, shareUrl }: Props) {
  const [copied, setCopied] = useState<"text" | "json" | "link" | null>(null);
  const canShare = useCanShare();
  const v = verdict;
  const isJudgement = v.tone !== "neutral";
  // Shared text is only as trustworthy as its sender, so it ends with the
  // re-check link: the recipient opens it and gets the bank's own answer.
  const text = () => {
    const body = resultText(v, { checkedAt, t });
    return shareUrl ? `${body}\n${t("verify.shared.recheck")}: ${shareUrl}` : body;
  };

  const copy = async (what: "text" | "json" | "link") => {
    const value = what === "text" ? text() : what === "link" ? (shareUrl ?? "") : JSON.stringify(result ? publicJson(result, v) : {}, null, 2);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard blocked: nothing to undo */
    }
  };

  const share = async () => {
    try {
      // The link goes in `url` only: most targets append it to the text.
      await navigator.share({ title: v.title, text: resultText(v, { checkedAt, t }), ...(shareUrl ? { url: shareUrl } : {}) });
    } catch {
      /* dismissed */
    }
  };

  const amount = v.showDetails && v.amount ? splitAmount(v.amount.value) : null;
  const extraRows =
    v.showDetails && result
      ? ([
          ["Status", result.transactionStatus],
          ["Invoice", result.invoiceNumber],
          ["Reason", result.reason],
          ["Branch", result.branch],
          ["Payment mode", result.paymentMode],
          ["Channel", result.paymentChannel],
          ["Service fee", result.serviceFee != null ? formatAmount(result.serviceFee) : undefined],
          ["VAT", result.serviceFeeVat != null ? formatAmount(result.serviceFeeVat) : undefined],
          ["Total paid", result.totalPaid != null ? formatAmount(result.totalPaid) : undefined],
        ].filter(([, val]) => typeof val === "string" && val) as [string, string][])
      : [];

  // One filled action per card. A retry/open beats "Verify another"; when
  // there is none, "Verify another" is the primary.
  const hasOwnPrimary =
    v.kind === "rateLimited" || ((v.kind === "unavailable" || v.kind === "offline") && !!onRetry) || (v.kind === "geoBlocked" && !!v.fallbackUrl);
  const rows: [string, ReactNode, string?][] = [];
  if (v.showDetails && (v.from || v.to)) {
    const party = (p?: { name?: string; account?: string }) => (
      <>
        <span className="vc-name">{p?.name || p?.account || "-"}</span>
        {p?.name && p.account && <span className="vc-acct">{p.account}</span>}
      </>
    );
    // A party the bank did not return gets no row (a BOA fee receipt has no
    // receiver), rather than a "-" placeholder.
    if (v.from) rows.push([t("verify.card.from"), party(v.from)]);
    if (v.to) rows.push([t("verify.card.to"), party(v.to)]);
  }
  if (v.showDetails && v.date) rows.push([t("verify.card.date"), <RelativeTime key="d" value={v.date} className="vc-num" />]);
  if (v.reference) rows.push([t("verify.card.reference"), <span key="r" className="vc-mono">{v.reference}</span>]);
  if (v.bank) rows.push([t("verify.card.bank"), <span key="b" className="vc-bank"><BankLogoByName code={v.bank.code} size={18} /><span>{v.bank.shortName}</span></span>, "vc-bank-row"]);

  return (
    <article className="vc" data-tone={v.tone} data-kind={v.kind} data-print-slip aria-labelledby="vc-title">
      <header className="vc-head">
        <div className="vc-status">
          <span className="vc-dot" aria-hidden="true" />
          <h2 id="vc-title" className="vc-title" tabIndex={-1}>{v.title}</h2>
        </div>
        <p className="vc-sub">
          {v.liveSubtitle && v.checkedAt ? (
            <>
              {v.liveSubtitle}.{" "}
              <RelativeTime value={v.checkedAt} variant="relative" template="time.checked" />
            </>
          ) : (
            v.subtitle
          )}
        </p>
      </header>

      {amount && (
        <p className="vc-amount" aria-label={`${t("verify.card.amount")} ${formatAmount(v.amount!.value, v.amount!.currency)}`}>
          <span className="vc-amount-num">{amount.whole}{amount.cents && <span className="vc-amount-cents">.{amount.cents}</span>}</span>
          <span className="vc-amount-cur">{v.amount!.currency}</span>
        </p>
      )}

      {rows.length > 0 && (
        <dl className="vc-rows">
          {rows.map(([label, value, cls]) => (
            <div key={label} className={cls ? `vc-row ${cls}` : "vc-row"}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {v.checks.length > 0 && (
        <ul className="vc-checks">
          {v.checks.map((c) => (
            <li key={c.id} data-state={c.state}>
              <span><strong>{c.label}</strong>{c.detail ? <>. {c.detail}</> : null}</span>
            </li>
          ))}
        </ul>
      )}

      {v.kind === "verified" && <p className="vc-note">{t("verify.card.before")}</p>}

      {v.nextStep && (
        <p className="vc-next">
          {v.nextStep}
          {v.guideHref && (
            <>
              {" "}
              <Link href={v.guideHref} prefetch={false} className="vc-link">{t("verify.card.guide")}</Link>
            </>
          )}
        </p>
      )}

      {v.referenceHint && <p className="vc-note">{v.referenceHint}</p>}

      <div className="vc-actions vc-no-print">
        {v.kind === "rateLimited" && <Countdown seconds={v.retryAfter ?? 60} t={t} onRetry={onRetry} />}
        {(v.kind === "unavailable" || v.kind === "offline") && onRetry && (
          <button type="button" className="vc-btn vc-btn--primary" onClick={onRetry}>
            <Icon icon={RefreshIcon} size={16} />
            {t("verify.card.retry")}
          </button>
        )}
        {v.kind === "geoBlocked" && v.fallbackUrl && (
          <a className="vc-btn vc-btn--primary" href={v.fallbackUrl} target="_blank" rel="noopener noreferrer">
            {t("verify.card.openReceipt")}
            <Icon icon={ArrowUpRight01Icon} size={16} />
          </a>
        )}
        {!hasOwnPrimary && (
          <button type="button" className="vc-btn vc-btn--primary" onClick={onAnother}>
            {t("verify.actions.another")}
          </button>
        )}
        {isJudgement && (
          <button
            type="button"
            className="vc-btn vc-btn--quiet vc-btn--icon"
            onClick={() => copy("text")}
            aria-label={copied === "text" ? t("verify.actions.copied") : t("verify.actions.copy")}
            title={t("verify.actions.copy")}
          >
            <Icon icon={copied === "text" ? CopyCheckIcon : Copy01Icon} size={18} />
          </button>
        )}
        {isJudgement && shareUrl && (
          <button
            type="button"
            className="vc-btn vc-btn--quiet vc-btn--icon"
            onClick={() => copy("link")}
            aria-label={copied === "link" ? t("verify.actions.linkCopied") : t("verify.actions.copyLink")}
            title={t("verify.actions.copyLink")}
          >
            <Icon icon={copied === "link" ? CopyCheckIcon : Link01Icon} size={18} />
          </button>
        )}
        {isJudgement && canShare && (
          <button type="button" className="vc-btn vc-btn--quiet vc-btn--icon" onClick={share} aria-label={t("verify.actions.share")} title={t("verify.actions.share")}>
            <Icon icon={Share08Icon} size={18} />
          </button>
        )}
        {isJudgement && (
          <button type="button" className="vc-btn vc-btn--quiet vc-btn--icon" onClick={() => window.print()} aria-label={t("verify.actions.print")} title={t("verify.actions.print")}>
            <Icon icon={PrinterIcon} size={18} />
          </button>
        )}
        <span className="sr-only" aria-live="polite">{copied === "link" ? t("verify.actions.linkCopied") : copied ? t("verify.actions.copied") : ""}</span>
        {hasOwnPrimary && (
          <button type="button" className="vc-btn vc-btn--text" onClick={onAnother}>
            {t("verify.actions.another")}
          </button>
        )}
      </div>

      {(v.sourceUrl || v.checkedUrl || (result && isJudgement)) && (
        <div className="vc-foot vc-no-print">
          {v.sourceUrl && (
            <a className="vc-source" href={v.sourceUrl} target="_blank" rel="noopener noreferrer">
              <span>{t("verify.card.source")}</span>
              <span className="vc-source-url">{v.sourceUrl.replace(/^https:\/\//, "")}</span>
              <Icon icon={ArrowUpRight01Icon} size={16} />
            </a>
          )}
          {!v.sourceUrl && v.checkedUrl && (
            <a className="vc-source" href={v.checkedUrl} target="_blank" rel="noopener noreferrer nofollow">
              <span>{t("verify.card.checked")}</span>
              <span className="vc-source-url">{v.checkedUrl.replace(/^https:\/\//, "")}</span>
              <Icon icon={ArrowUpRight01Icon} size={16} />
            </a>
          )}
          {result && isJudgement && (
            <details className="vc-details">
              <summary>
                {t("verify.card.details")}
                <span className="vc-chev" aria-hidden="true"><Icon icon={ChevronDownIcon} size={16} /></span>
              </summary>
              <div className="vc-details-body">
                {extraRows.length > 0 && (
                  <dl className="vc-xrows">
                    {extraRows.map(([k, val]) => (
                      <div key={k}><dt>{k}</dt><dd>{val}</dd></div>
                    ))}
                  </dl>
                )}
                <pre className="vc-json">{JSON.stringify(publicJson(result, v), null, 2)}</pre>
                <button type="button" className="vc-btn vc-btn--small" onClick={() => copy("json")}>
                  <Icon icon={copied === "json" ? CopyCheckIcon : Copy01Icon} size={14} />
                  {copied === "json" ? t("verify.actions.copied") : t("verify.card.copyJson")}
                </button>
              </div>
            </details>
          )}
        </div>
      )}
    </article>
  );
}
