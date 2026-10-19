/**
 * Batch check (several screenshots at once): the pure parts the panel uses,
 * kept out of the component so they can be tested. A batch is end-of-day
 * reconciliation: how many payments the banks confirmed, how much that adds
 * up to, which screenshots need a second look, and whether the same receipt
 * was handed over twice.
 */
import type { Verdict } from "./verdict";

export type BatchRowStatus =
  | "queued" // waiting for its turn
  | "scanning" // looking for a QR on the device
  | "reading" // no QR: reading the text (OCR)
  | "checking" // asking the bank
  | "done" // the bank (or cheki) answered: see verdict
  | "needsAccount" // a reference was read, but this bank also needs account digits
  | "noQr" // no QR on the device; reading the text (OCR) is opt-in, it is slow
  | "noReceipt"; // nothing checkable in the image, even after reading the text

const PENDING: ReadonlySet<BatchRowStatus> = new Set(["queued", "scanning", "reading", "checking"]);

export function isPending(row: BatchRow): boolean {
  return PENDING.has(row.status);
}

/** Bank-confirmed and not a second copy: the only rows that count. */
export function isConfirmed(row: BatchRow): boolean {
  return row.status === "done" && row.verdict?.kind === "verified" && row.duplicateOf === undefined;
}

/** Finished, but not a confirmed first copy: someone should look at it. */
export function needsLook(row: BatchRow): boolean {
  return !isPending(row) && !isConfirmed(row);
}

export type BatchTone = "green" | "amber" | "red" | "neutral" | "pending";

/**
 * A row's dot. The bank's answer decides through presentVerdict (green only
 * ever comes from there); the batch adds exactly one judgement of its own: a
 * second copy of a receipt is red, whatever the bank said about the first.
 */
export function rowTone(row: BatchRow): BatchTone {
  if (isPending(row)) return "pending";
  if (row.duplicateOf !== undefined) return "red";
  if (row.status === "done" && row.verdict) return row.verdict.tone;
  return "neutral";
}

export interface BatchRow {
  name: string;
  status: BatchRowStatus;
  verdict?: Verdict;
  /** Read from the image when it could not be checked on its own. */
  reference?: string;
  bankCode?: string;
  /** Index of the earlier row that holds the same receipt. */
  duplicateOf?: number;
}

/** Same bank + reference: the same receipt, whatever the screenshot looks like. */
export function receiptKey(row: BatchRow): string | null {
  const ref = row.verdict?.reference ?? row.reference;
  const bank = row.verdict?.bank?.code ?? row.bankCode;
  if (!ref || !bank) return null;
  return `${bank}:${ref.trim().toUpperCase()}`;
}

/**
 * Marks every row whose receipt already appeared earlier in the batch. The
 * first copy keeps its verdict; later copies point at it and never count
 * toward the total, because one receipt is one payment.
 */
export function markDuplicates(rows: BatchRow[]): BatchRow[] {
  const seen = new Map<string, number>();
  return rows.map((row, i) => {
    const key = row.status === "done" || row.status === "needsAccount" ? receiptKey(row) : null;
    if (!key) return row.duplicateOf === undefined ? row : { ...row, duplicateOf: undefined };
    const first = seen.get(key);
    if (first === undefined) {
      seen.set(key, i);
      return row.duplicateOf === undefined ? row : { ...row, duplicateOf: undefined };
    }
    return row.duplicateOf === first ? row : { ...row, duplicateOf: first };
  });
}

export interface BatchSummary {
  total: number;
  finished: number;
  /** Bank-confirmed, first copy only. */
  confirmed: number;
  /** Every finished row that is not a confirmed first copy. */
  attention: number;
  duplicates: number;
  /** Sum of confirmed amounts per currency (first copies only). */
  amounts: { currency: string; value: number }[];
}

export function summarize(rows: BatchRow[]): BatchSummary {
  const amounts = new Map<string, number>();
  let finished = 0;
  let confirmed = 0;
  let duplicates = 0;
  for (const row of rows) {
    if (isPending(row)) continue;
    finished++;
    if (row.duplicateOf !== undefined) {
      duplicates++;
      continue;
    }
    const v = row.verdict;
    if (row.status === "done" && v?.kind === "verified") {
      confirmed++;
      if (v.showDetails && v.amount) amounts.set(v.amount.currency, (amounts.get(v.amount.currency) ?? 0) + v.amount.value);
    }
  }
  return {
    total: rows.length,
    finished,
    confirmed,
    attention: finished - confirmed,
    duplicates,
    amounts: [...amounts].map(([currency, value]) => ({ currency, value: Math.round(value * 100) / 100 })),
  };
}

/** One machine word per row, for the CSV (never shown as prose). */
export function rowOutcome(row: BatchRow): string {
  if (row.duplicateOf !== undefined) return "duplicate";
  if (row.status === "done" && row.verdict) return row.verdict.kind;
  return row.status;
}

const CSV_HEADER = ["#", "file", "outcome", "bank", "reference", "amount", "currency", "from", "to", "date", "same_as"];

function csvCell(value: string | number | undefined): string {
  if (value === undefined || value === "") return "";
  let s = String(value);
  // A cell starting with = + - @ is a formula in Excel and Sheets; prefix it.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * The batch as CSV for a spreadsheet. Amounts and names appear only for a
 * bank-confirmed receipt (Verdict.showDetails), the same rule as the card and
 * the copied text, so an unconfirmed screenshot never puts its claims in a
 * ledger.
 */
export function batchCsv(rows: BatchRow[]): string {
  const party = (p?: { name?: string; account?: string }) => [p?.name, p?.account].filter(Boolean).join(" ");
  const lines = [CSV_HEADER.join(",")];
  rows.forEach((row, i) => {
    const v = row.verdict;
    const details = !!v?.showDetails && row.duplicateOf === undefined;
    lines.push(
      [
        i + 1,
        row.name,
        rowOutcome(row),
        v?.bank?.shortName ?? row.bankCode,
        displayReference(v?.reference ?? row.reference),
        details && v?.amount ? v.amount.value : undefined,
        details && v?.amount ? v.amount.currency : undefined,
        details ? party(v?.from) : undefined,
        details ? party(v?.to) : undefined,
        details ? v?.date : undefined,
        row.duplicateOf !== undefined ? row.duplicateOf + 1 : undefined,
      ]
        .map(csvCell)
        .join(",")
    );
  });
  return lines.join("\r\n") + "\r\n";
}

export function formatTotals(amounts: BatchSummary["amounts"]): string {
  return amounts.map((a) => `${a.value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${a.currency}`).join(" + ");
}

/**
 * Plain text a cashier pastes into a chat at the end of the day. It is read
 * by people, so every row speaks in the same words as the screen (`label`),
 * never in verdict kinds.
 */
export function batchText(
  rows: BatchRow[],
  words: { headline: (s: BatchSummary) => string; label: (row: BatchRow) => string }
): string {
  const s = summarize(rows);
  const lines = [words.headline(s)];
  rows.forEach((row, i) => {
    const v = row.verdict;
    const ref = displayReference(v?.reference ?? row.reference);
    const amt = isConfirmed(row) && v?.showDetails && v.amount ? ` · ${v.amount.value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${v.amount.currency}` : "";
    lines.push(`${i + 1}. ${words.label(row)}${amt}${ref ? ` · ${ref}` : ""}`);
  });
  return lines.join("\n");
}

/** A receipt link shows as its id or last path part, not the whole URL. */
export function displayReference(ref?: string): string | undefined {
  if (!ref || !/^https?:\/\//i.test(ref)) return ref;
  try {
    const u = new URL(ref);
    return u.searchParams.get("id") || u.searchParams.get("trx") || u.pathname.split("/").filter(Boolean).pop() || ref;
  } catch {
    return ref;
  }
}
