"use client";

/**
 * The verdict is the hero: one card, one colour, one sentence that answers
 * "can I hand over the goods?". Everything it shows comes from presentVerdict()
 * (src/lib/verify/verdict.ts); this component never decides a colour itself.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { VerifyResult } from "@/lib/banks";
import { publicJson, type Verdict } from "@/lib/verify/verdict";
import { formatAmount, resultText } from "@/lib/verify/summary";
import type { Translate } from "@/lib/i18n/translate";
import { BankLogoByName } from "@/components/BankLogo";
import {
  Icon,
  CheckmarkCircle01Icon,
  Alert01Icon,
  CancelCircleIcon,
  Clock01Icon,
  WifiDisconnected01Icon,
  InformationCircleIcon,
  Copy01Icon,
  CopyCheckIcon,
  Share08Icon,
  PrinterIcon,
  RefreshIcon,
  ArrowUpRight01Icon,
  ArrowRight01Icon,
  Tick02Icon,
} from "@/components/Icon";

interface Props {
  verdict: Verdict;
  result: VerifyResult | null;
  checkedAt: Date;
  t: Translate;
  onAnother: () => void;
  onRetry?: () => void;
}

const noop = () => () => {};
function useCanShare(): boolean {
  return useSyncExternalStore(
    noop,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false
  );
}

function prettyDate(raw: string): string {
  if (!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  // Receipt times are Ethiopian bank times: show them on the bank's clock.
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Addis_Ababa" });
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
      {left > 0 ? t("verify.card.retryIn", { s: left }) : t("verify.card.retry")}
    </button>
  );
}

const TONE_ICON = {
  green: CheckmarkCircle01Icon,
  amber: Alert01Icon,
  red: CancelCircleIcon,
  neutral: InformationCircleIcon,
} as const;

export function VerdictCard({ verdict, result, checkedAt, t, onAnother, onRetry }: Props) {
  const [copied, setCopied] = useState<"text" | "json" | null>(null);
  const canShare = useCanShare();
  const v = verdict;
  const icon =
    v.kind === "rateLimited" ? Clock01Icon : v.kind === "offline" ? WifiDisconnected01Icon : TONE_ICON[v.tone];
  const isJudgement = v.tone !== "neutral";
  const text = () => resultText(v, { checkedAt, t });

  const copy = async (what: "text" | "json") => {
    const value = what === "text" ? text() : JSON.stringify(result ? publicJson(result, v) : {}, null, 2);
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
      await navigator.share({ title: v.title, text: text() });
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

  return (
    <article className="vc" data-tone={v.tone} data-kind={v.kind} data-print-slip aria-labelledby="vc-title">
      <header className="vc-head">
        <span className="vc-icon" aria-hidden="true">
          <Icon icon={icon} size={22} strokeWidth={2} />
        </span>
        <div className="vc-headtext">
          <h2 id="vc-title" className="vc-title" tabIndex={-1}>{v.title}</h2>
          <p className="vc-sub">{v.subtitle}</p>
        </div>
      </header>

      {amount && (
        <p className="vc-amount" aria-label={`${t("verify.card.amount")} ${formatAmount(v.amount!.value, v.amount!.currency)}`}>
          <span className="vc-amount-num">{amount.whole}</span>
          {amount.cents && <span className="vc-amount-cents">.{amount.cents}</span>}
          <span className="vc-amount-cur">{v.amount!.currency}</span>
        </p>
      )}

      {v.showDetails && (v.from || v.to) && (
        <div className="vc-parties">
          <div className="vc-party">
            <span className="vc-lbl">{t("verify.card.from")}</span>
            <span className="vc-party-name">{v.from?.name || v.from?.account || "-"}</span>
            {v.from?.name && v.from.account && <span className="vc-party-acct">{v.from.account}</span>}
          </div>
          <span className="vc-arrow" aria-hidden="true"><Icon icon={ArrowRight01Icon} size={18} /></span>
          <div className="vc-party">
            <span className="vc-lbl">{t("verify.card.to")}</span>
            <span className="vc-party-name">{v.to?.name || v.to?.account || "-"}</span>
            {v.to?.name && v.to.account && <span className="vc-party-acct">{v.to.account}</span>}
          </div>
        </div>
      )}

      {(v.reference || v.bank || (v.showDetails && v.date)) && (
        <dl className="vc-meta">
          {v.showDetails && v.date && (
            <div><dt>{t("verify.card.date")}</dt><dd>{prettyDate(v.date)}</dd></div>
          )}
          {v.reference && (
            <div className={v.reference.length > 14 ? "vc-meta-wide" : undefined}><dt>{t("verify.card.reference")}</dt><dd className="vc-mono">{v.reference}</dd></div>
          )}
          {v.bank && (
            <div>
              <dt>{t("verify.card.bank")}</dt>
              <dd className="vc-bank"><BankLogoByName code={v.bank.code} size={18} /><span>{v.bank.shortName}</span></dd>
            </div>
          )}
        </dl>
      )}

      {v.checks.length > 0 && (
        <ul className="vc-checks">
          {v.checks.map((c) => (
            <li key={c.id} data-state={c.state}>
              <Icon icon={c.state === "pass" ? Tick02Icon : c.state === "mismatch" ? CancelCircleIcon : Alert01Icon} size={16} strokeWidth={2} />
              <span><strong>{c.label}</strong>{c.detail ? <> {c.detail}</> : null}</span>
            </li>
          ))}
        </ul>
      )}

      {v.kind === "verified" && <p className="vc-before">{t("verify.card.before")}</p>}

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
        {isJudgement && (
          <button type="button" className="vc-btn" onClick={() => copy("text")}>
            <Icon icon={copied === "text" ? CopyCheckIcon : Copy01Icon} size={16} />
            <span aria-live="polite">{copied === "text" ? t("verify.actions.copied") : t("verify.actions.copy")}</span>
          </button>
        )}
        {isJudgement && canShare && (
          <button type="button" className="vc-btn" onClick={share}>
            <Icon icon={Share08Icon} size={16} />
            {t("verify.actions.share")}
          </button>
        )}
        {isJudgement && (
          <button type="button" className="vc-btn" onClick={() => window.print()}>
            <Icon icon={PrinterIcon} size={16} />
            {t("verify.actions.print")}
          </button>
        )}
        <button type="button" className="vc-btn vc-btn--ghost" onClick={onAnother}>
          {t("verify.actions.another")}
        </button>
      </div>

      {v.sourceUrl && (
        <a className="vc-source vc-no-print" href={v.sourceUrl} target="_blank" rel="noopener noreferrer">
          <span>{t("verify.card.source")}</span>
          <span className="vc-source-url">{v.sourceUrl.replace(/^https:\/\//, "")}</span>
          <Icon icon={ArrowUpRight01Icon} size={14} />
        </a>
      )}

      {result && isJudgement && (
        <details className="vc-details vc-no-print">
          <summary>{t("verify.card.details")}</summary>
          {extraRows.length > 0 && (
            <dl className="vc-rows">
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
        </details>
      )}
    </article>
  );
}
