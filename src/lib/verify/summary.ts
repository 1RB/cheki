/**
 * The plain-text result a merchant copies, shares or prints.
 *
 * It states who confirmed the payment (the bank's own record), never "verified
 * by cheki": this text gets pasted into chats as proof, and cheki is only the
 * messenger. Unconfirmed results start with NOT VERIFIED and carry no amount
 * or names (see Verdict.showDetails).
 */
import { tEn, type Translate } from "@/lib/i18n/translate";
import type { Verdict } from "./verdict";

export function formatAmount(value: number, currency = "ETB"): string {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;
}

export function resultText(verdict: Verdict, opts: { checkedAt?: Date; t?: Translate } = {}): string {
  const t = opts.t ?? tEn;
  const lines: string[] = [];
  if (verdict.kind === "verified") {
    lines.push(verdict.subtitle);
  } else {
    lines.push(`${t("verify.copy.notVerified")}: ${verdict.title}`);
    lines.push(verdict.subtitle);
  }
  if (verdict.showDetails) {
    if (verdict.amount) lines.push(`${t("verify.card.amount")}: ${formatAmount(verdict.amount.value, verdict.amount.currency)}`);
    const party = (p?: { name?: string; account?: string }) => [p?.name, p?.account].filter(Boolean).join(" · ");
    if (party(verdict.from)) lines.push(`${t("verify.card.from")}: ${party(verdict.from)}`);
    if (party(verdict.to)) lines.push(`${t("verify.card.to")}: ${party(verdict.to)}`);
    if (verdict.date) lines.push(`${t("verify.card.date")}: ${verdict.date}`);
  }
  if (verdict.reference) lines.push(`${t("verify.card.reference")}: ${verdict.reference}`);
  if (verdict.bank) lines.push(`${t("verify.card.bank")}: ${verdict.bank.name}`);
  if (verdict.sourceUrl) lines.push(`${t("verify.card.source")}: ${verdict.sourceUrl}`);
  const at = opts.checkedAt ?? new Date();
  lines.push(`${t("verify.card.checkedAt")}: ${at.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`);
  return lines.join("\n");
}
