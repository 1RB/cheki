/**
 * presentVerdict(): the one place that decides what a check result looks like.
 *
 * Every surface that shows a receipt check (the homepage panel, the panel on
 * each bank page, batch rows, the copied text, the JSON panel) asks this
 * function. It is pure and has no React or DOM dependency.
 *
 * Rules, in order:
 *   - green ("verified") ONLY when verificationState() says "verified", the
 *     status is not a failure, and no fraud check reports a mismatch;
 *   - a fraud-check mismatch is red, whatever the bank said;
 *   - a BOA QR the bank could not confirm (decodedOnly) is amber and carries
 *     the reference only: never the QR's amount or names;
 *   - text the user pasted (parsed) and a bank answer that did not confirm
 *     are amber;
 *   - "no such receipt", a failed or pending status, and a different reference
 *     are red, with one next step and the fraud guide;
 *   - 429 / 413 / 5xx / offline / a geo-blocked bank are neutral "couldn't
 *     check": they say nothing about the receipt.
 */
import { banks, verificationState, type Bank, type VerifyResult } from "@/lib/banks";
import { classifyStatus } from "@/lib/core/status";
import { tEn, type Translate } from "@/lib/i18n/translate";
import { formatAgeDays, parseTimestamp } from "@/lib/time/relative";

/** "info" is a neutral note (grey dot): worth reading, not a warning. */
export type FraudCheckState = "pass" | "warn" | "mismatch" | "unknown" | "info";

/** One independent signal about the receipt, shown as a row on the card. */
export interface FraudCheck {
  id: string;
  label: string;
  state: FraudCheckState;
  detail?: string;
}

export type VerdictTone = "green" | "amber" | "red" | "neutral";

export type VerdictKind =
  | "verified"
  | "decodedOnly"
  | "parsed"
  | "unconfirmed"
  | "notFound"
  | "notCompleted"
  | "mismatch"
  | "rateLimited"
  | "tooLarge"
  | "offline"
  | "unavailable"
  | "geoBlocked"
  | "invalidInput";

export interface Verdict {
  kind: VerdictKind;
  tone: VerdictTone;
  title: string;
  subtitle: string;
  bank?: Pick<Bank, "code" | "name" | "shortName" | "type" | "geoBlocked">;
  /**
   * False when the card, the copied text and the JSON panel must not show
   * amounts or names (a decoded-only QR, an unconfirmed answer, any failure).
   */
  showDetails: boolean;
  amount?: { value: number; currency: string };
  from?: { name?: string; account?: string };
  to?: { name?: string; account?: string };
  date?: string;
  reference?: string;
  /** https:// bank page that produced a verified result; nothing else. */
  sourceUrl?: string;
  /** The bank's own receipt page, for geo-blocked banks. https only. */
  fallbackUrl?: string;
  nextStep?: string;
  guideHref?: string;
  retryAfter?: number;
  checks: FraudCheck[];
  /** The API's message, cleaned of internal prefixes, for the details area. */
  detail?: string;
  /**
   * A fresh (not cached) confirmation: the subtitle without its clock time,
   * so the card can add a live "Checked 2 min ago" (copied text keeps the
   * subtitle with the time).
   */
  liveSubtitle?: string;
  /** ISO time of the check, for that live line. */
  checkedAt?: string;
}

/** Past this age a confirmed receipt gets a neutral "Receipt is N days old" note. */
export const RECEIPT_AGE_NOTE_MS = 24 * 60 * 60 * 1000;

/**
 * Receipt age as a soft signal: a confirmed receipt from days ago is real, but
 * it may be an older payment shown again. Neutral, never red; null when the
 * date is unreadable or recent.
 */
export function receiptAgeCheck(date: string | undefined, checkedAt: Date, t: Translate = tEn): FraudCheck | null {
  const parsed = parseTimestamp(date);
  if (!parsed) return null;
  const age = formatAgeDays(parsed, checkedAt.getTime());
  if (!age) return null;
  return { id: "receipt-age", state: "info", label: t("verify.checks.receiptAge", { age }), detail: t("verify.checks.receiptAgeDetail") };
}

export const FRAUD_GUIDE = "/guides/payment-fraud-ethiopia";

export interface PresentOptions {
  /** Bank the user asked about, used when the result does not name one. */
  bankCode?: string;
  /** When the check finished. Defaults to now. */
  checkedAt?: Date;
  /** The browser reported it is offline, or fetch threw. */
  offline?: boolean;
  checks?: FraudCheck[];
  /** What the user entered, shown when the response carries no reference. */
  reference?: string;
  t?: Translate;
}

const HTTPS = /^https:\/\//i;

export function findBank(codeOrName: string | undefined | null): Bank | undefined {
  if (!codeOrName) return undefined;
  const raw = String(codeOrName).trim();
  const code = raw.toLowerCase() === "cbe-new" ? "cbe" : raw.toLowerCase();
  return (
    banks.find((b) => b.code === code) ??
    banks.find((b) => b.name.toLowerCase() === raw.toLowerCase() || b.shortName.toLowerCase() === raw.toLowerCase())
  );
}

/** "[Telebirr] Our server can't reach this bank. Try the new receipt format: https://x" -> "Our server can't reach this bank." */
export function cleanError(message: string | undefined): string | undefined {
  if (!message) return undefined;
  return message
    .replace(/^\s*\[[^\]]{1,60}\]\s*/, "")
    .replace(/\s*Try the new receipt format:\s*\S+\s*$/i, "")
    .trim() || undefined;
}

function hhmm(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

function finiteAmount(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function presentVerdict(result: VerifyResult | null | undefined, opts: PresentOptions = {}): Verdict {
  const t = opts.t ?? tEn;
  const checks = opts.checks ?? [];
  const bankInfo = findBank(result?.bankCode) ?? findBank(result?.bank) ?? findBank(opts.bankCode);
  const bank = bankInfo
    ? { code: bankInfo.code, name: bankInfo.name, shortName: bankInfo.shortName, type: bankInfo.type, geoBlocked: bankInfo.geoBlocked }
    : undefined;
  const short = bank?.shortName ?? t("verify.verdict.theBank");
  const reference = str(result?.reference) ?? str(opts.reference);
  const fallbackUrl = str(result?.fallbackUrl) && HTTPS.test(result!.fallbackUrl!) ? result!.fallbackUrl : undefined;
  const base = { bank, checks, reference, showDetails: false } as const;

  const details = (r: VerifyResult) => ({
    amount: finiteAmount(r.amount) !== undefined ? { value: r.amount as number, currency: str(r.currency) ?? "ETB" } : undefined,
    from: str(r.senderName) || str(r.senderAccount) ? { name: str(r.senderName), account: str(r.senderAccount) } : undefined,
    to: str(r.receiverName) || str(r.receiverAccount) ? { name: str(r.receiverName), account: str(r.receiverAccount) } : undefined,
    date: str(r.date),
  });

  const red = (kind: VerdictKind, title: string, subtitle: string, nextStep: string, extra: Partial<Verdict> = {}): Verdict => ({
    ...base,
    kind,
    tone: "red",
    title,
    subtitle,
    nextStep,
    guideHref: FRAUD_GUIDE,
    detail: cleanError(result?.error),
    ...extra,
  });

  const neutral = (kind: VerdictKind, title: string, subtitle: string, extra: Partial<Verdict> = {}): Verdict => ({
    ...base,
    kind,
    tone: "neutral",
    title,
    subtitle,
    detail: cleanError(result?.error),
    ...extra,
  });

  // ── Couldn't check: nothing here is a judgement on the receipt ─────────
  if (opts.offline || (result && result.success !== true && result.httpStatus === 0)) {
    return neutral("offline", t("verify.verdict.offline.title"), t("verify.verdict.offline.subtitle"));
  }
  if (!result) {
    return neutral("unavailable", t("verify.verdict.unavailable.title"), t("verify.verdict.unavailable.subtitle"));
  }

  const state = verificationState(result);
  const mismatch = checks.find((c) => c.state === "mismatch");

  if (result.success !== true) {
    const status = result.httpStatus;
    const message = cleanError(result.error) ?? "";
    if (status === 429) {
      const wait = typeof result.retryAfter === "number" && result.retryAfter > 0 ? result.retryAfter : 60;
      return neutral("rateLimited", t("verify.verdict.rateLimited.title"), t("verify.verdict.rateLimited.subtitle"), { retryAfter: wait });
    }
    if (status === 413) {
      return neutral("tooLarge", t("verify.verdict.tooLarge.title"), t("verify.verdict.tooLarge.subtitle"));
    }
    if (fallbackUrl || (bank?.geoBlocked && (status === 502 || status === 504))) {
      return neutral("geoBlocked", t("verify.verdict.geoBlocked.title", { bank: short }), t("verify.verdict.geoBlocked.subtitle", { bank: short }), { fallbackUrl });
    }
    if (status === 422) {
      const listed = /lists this transaction as "([^"]{1,40})"/i.exec(message);
      if (listed) {
        return red("notCompleted", t("verify.verdict.notCompleted.title"), t("verify.verdict.notCompleted.subtitle", { bank: short, status: listed[1] }), t("verify.verdict.notCompleted.next"));
      }
      if (/different reference/i.test(message)) {
        return red("mismatch", t("verify.verdict.refMismatch.title"), t("verify.verdict.refMismatch.subtitle", { bank: short }), t("verify.verdict.refMismatch.next"));
      }
      if (/(no valid amount|missing the payer|cannot be confirmed as a receipt)/i.test(message)) {
        return { ...base, kind: "unconfirmed", tone: "amber", title: t("verify.verdict.unconfirmed.title"), subtitle: t("verify.verdict.unconfirmed.subtitle", { bank: short }), nextStep: t("verify.verdict.unconfirmed.next"), detail: message || undefined };
      }
      return red("notFound", t("verify.verdict.notFound.title"), t("verify.verdict.notFound.subtitle", { bank: short }), t("verify.verdict.notFound.next"));
    }
    if (status === 400 || status === 404) {
      return neutral("invalidInput", t("verify.verdict.invalidInput.title"), message || t("verify.verdict.invalidInput.subtitle"));
    }
    return neutral("unavailable", t("verify.verdict.unavailable.title"), t("verify.verdict.unavailable.subtitle"));
  }

  // ── A handled request ───────────────────────────────────────────────────
  if (state === "decodedOnly") {
    // The QR's amount and names are attacker-controlled until BOA confirms
    // them, so they are not carried at all: only the reference.
    return {
      ...base,
      kind: "decodedOnly",
      tone: mismatch ? "red" : "amber",
      title: t("verify.verdict.decodedOnly.title"),
      subtitle: t("verify.verdict.decodedOnly.subtitle", { bank: short }),
      nextStep: t("verify.verdict.decodedOnly.next"),
      guideHref: FRAUD_GUIDE,
    };
  }

  if (state === "parsed") {
    return {
      ...base,
      ...details(result),
      kind: "parsed",
      tone: mismatch ? "red" : "amber",
      showDetails: true,
      title: t("verify.verdict.parsed.title"),
      subtitle: t("verify.verdict.parsed.subtitle", { bank: short }),
      nextStep: t("verify.verdict.parsed.next"),
    };
  }

  if (state === "verified") {
    if (classifyStatus(result.transactionStatus) === "failure") {
      return red("notCompleted", t("verify.verdict.notCompleted.title"), t("verify.verdict.notCompleted.subtitle", { bank: short, status: String(result.transactionStatus).slice(0, 40) }), t("verify.verdict.notCompleted.next"));
    }
    const d = details(result);
    const sourceUrl = str(result.sourceUrl) && HTTPS.test(result.sourceUrl!) ? result.sourceUrl : undefined;
    const at = hhmm(opts.checkedAt ?? new Date());
    if (mismatch) {
      return {
        ...base,
        ...d,
        kind: "mismatch",
        tone: "red",
        showDetails: true,
        sourceUrl,
        title: t("verify.verdict.checkMismatch.title"),
        subtitle: mismatch.detail ?? mismatch.label,
        nextStep: t("verify.verdict.checkMismatch.next"),
        guideHref: FRAUD_GUIDE,
      };
    }
    const checkedAt = opts.checkedAt ?? new Date();
    const age = receiptAgeCheck(d.date, checkedAt, t);
    return {
      ...base,
      ...d,
      checks: age ? [...checks, age] : checks,
      kind: "verified",
      tone: "green",
      showDetails: true,
      sourceUrl,
      title: t("verify.verdict.verified.title", { bank: short }),
      ...(result.cached === true
        ? {}
        : { liveSubtitle: t("verify.verdict.verified.subtitleLive", { bank: short }), checkedAt: checkedAt.toISOString() }),
      // A cached answer was confirmed earlier, not "at" this check.
      subtitle: result.cached === true
        ? t("verify.verdict.verified.subtitleCached", { bank: short })
        : t("verify.verdict.verified.subtitle", { bank: short, time: at }),
    };
  }

  // success: true but the bank did not confirm.
  return {
    ...base,
    kind: "unconfirmed",
    tone: mismatch ? "red" : "amber",
    title: t("verify.verdict.unconfirmed.title"),
    subtitle: t("verify.verdict.unconfirmed.subtitle", { bank: short }),
    nextStep: t("verify.verdict.unconfirmed.next"),
  };
}

/**
 * The JSON a user may copy or inspect. A decoded-only or unconfirmed result is
 * reduced to its status and reference, so a forged QR's amount and names never
 * reach the clipboard.
 */
export function publicJson(result: VerifyResult, verdict: Verdict): Record<string, unknown> {
  if (verdict.showDetails) {
    // httpStatus / retryAfter are client-side annotations, not API fields.
    const { httpStatus: _h, retryAfter: _r, ...rest } = result;
    return rest;
  }
  const out: Record<string, unknown> = {
    success: result.success === true,
    verified: false,
  };
  if (result.decodedOnly === true) out.decodedOnly = true;
  if (verdict.bank) out.bank = verdict.bank.name;
  if (verdict.reference) out.reference = verdict.reference;
  if (verdict.detail) out.error = verdict.detail;
  return out;
}
