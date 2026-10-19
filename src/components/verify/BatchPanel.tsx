"use client";

/**
 * Several screenshots at once (end-of-day reconciliation). Loaded lazily when
 * more than one image is dropped or picked.
 *
 * Each image is scanned for a QR on the device; one without a QR is read with
 * OCR, the same as a single photo. Images are checked one at a time (the bank
 * and the per-IP limits stay gentle). On top: how many the banks confirmed and
 * what that adds up to. A receipt that appears twice is flagged and counted
 * once. Every row's colour comes from presentVerdict, so a decoded-only BOA QR
 * is amber and shows its reference only, exactly like the single check. A row
 * opens in place to show the details (never a card inside the list).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Translate } from "@/lib/i18n/translate";
import { decodeQrFromImage } from "@/lib/qr/decode";
import { detectInput } from "@/lib/verify/detect";
import { postJson } from "@/lib/verify/client";
import { presentVerdict } from "@/lib/verify/verdict";
import { formatAmount } from "@/lib/verify/summary";
import { batchCsv, batchText, formatTotals, markDuplicates, summarize, type BatchRow } from "@/lib/verify/batch";
import { Icon, ChevronDownIcon, ArrowUpRight01Icon } from "@/components/Icon";

interface Props {
  files: File[];
  t: Translate;
  onClear: () => void;
  /** A reference read from an image whose bank also needs account digits: finish it in the main field. */
  onPick: (reference: string, bankCode?: string) => void;
}

const RETRYABLE = new Set(["unavailable", "rateLimited", "offline"]);

/** A receipt link shows as its last path part or id, not the whole URL. */
function shortRef(ref?: string): string | undefined {
  if (!ref || !/^https?:\/\//i.test(ref)) return ref;
  try {
    const u = new URL(ref);
    return u.searchParams.get("id") || u.searchParams.get("trx") || u.pathname.split("/").filter(Boolean).pop() || ref;
  } catch {
    return ref;
  }
}

function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) || !/\d{4}-\d{2}-\d{2}T/.test(value)
    ? value
    : d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export default function BatchPanel({ files, t, onClear, onPick }: Props) {
  const [rows, setRows] = useState<BatchRow[]>(() => files.map((f) => ({ name: f.name, status: "scanning" as const })));
  const [open, setOpen] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const thumbs = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => thumbs.forEach((u) => URL.revokeObjectURL(u)), [thumbs]);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const set = useCallback((i: number, row: BatchRow) => {
    if (alive.current) setRows((prev) => markDuplicates(prev.map((r, j) => (j === i ? row : r))));
  }, []);

  const check = useCallback(
    async (i: number, raw: string, bankHint?: string) => {
      const name = files[i].name;
      const d = detectInput(raw, bankHint ? { overrideBank: bankHint } : {});
      if (!d.bank || d.kind === "unknownUrl" || d.kind === "empty") {
        set(i, { name, status: "noReceipt" });
        return;
      }
      if (d.needsAccount || d.needsPhone) {
        set(i, { name, status: "needsAccount", reference: d.value, bankCode: d.bank.code });
        return;
      }
      set(i, { name, status: "checking", reference: d.value, bankCode: d.bank.code });
      const body = d.kind === "boaQr" ? { bank: "boa", qrData: d.value } : { bank: d.bank.code, reference: d.value };
      const result = await postJson("/api/verify", body);
      set(i, { name, status: "done", reference: d.value, bankCode: d.bank.code, verdict: presentVerdict(result, { bankCode: d.bank.code, t }) });
    },
    [files, set, t]
  );

  const process = useCallback(
    async (i: number) => {
      const name = files[i].name;
      set(i, { name, status: "scanning" });
      const qr = await decodeQrFromImage(files[i]);
      if (qr) return check(i, qr);
      // No QR on the device: read the text, the same as a single photo.
      set(i, { name, status: "reading" });
      try {
        const { extractTextFromImage } = await import("@/lib/ocr");
        const { parsed } = await extractTextFromImage(files[i]);
        if (!parsed?.reference) return set(i, { name, status: "noReceipt" });
        const bank = parsed.bank === "cbe-new" ? "cbe" : parsed.bank || undefined;
        return check(i, parsed.reference, bank);
      } catch {
        set(i, { name, status: "noReceipt" });
      }
    },
    [check, files, set]
  );

  // One pass per set of files: a language switch re-creates `process` but must
  // not start a second loop over the same images.
  const started = useRef<File[] | null>(null);
  useEffect(() => {
    if (started.current === files) return;
    started.current = files;
    (async () => {
      for (let i = 0; i < files.length && alive.current; i++) await process(i);
    })();
  }, [files, process]);

  const summary = summarize(rows);
  const running = summary.finished < summary.total;
  const labels = { title: t("verify.batch.title"), confirmed: t("verify.batch.confirmedWord"), attention: t("verify.batch.attentionWord") };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(batchText(rows, labels));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  };

  const downloadCsv = () => {
    const url = URL.createObjectURL(new Blob([batchCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `cheki-batch-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className="bp" aria-labelledby="bp-title">
      <div className="bp-head">
        <h3 id="bp-title" className="rch-title">{t("verify.batch.title")}</h3>
        <button type="button" className="rch-clear" onClick={onClear}>{t("verify.batch.clear")}</button>
      </div>

      <div className="bp-sum" aria-live="polite">
        <p className="bp-sum-main">
          <span className="vc-num">{t("verify.batch.confirmed", { n: summary.confirmed, total: summary.total })}</span>
          {summary.amounts.length > 0 && <span className="bp-sum-amt vc-num">{formatTotals(summary.amounts)}</span>}
        </p>
        <p className="bp-sum-sub">
          {running
            ? t("verify.batch.progress", { n: Math.min(summary.finished + 1, summary.total), total: summary.total })
            : [
                summary.attention - summary.duplicates > 0 ? t("verify.batch.attention", { n: summary.attention - summary.duplicates }) : null,
                summary.duplicates > 0 ? t("verify.batch.duplicates", { n: summary.duplicates }) : null,
              ]
                .filter(Boolean)
                .join(" · ") || t("verify.batch.allConfirmed")}
        </p>
      </div>

      <ul className="bp-list">
        {rows.map((r, i) => {
          const v = r.verdict;
          const dup = r.duplicateOf !== undefined;
          const tone = dup ? "red" : r.status === "done" && v ? v.tone : r.status === "needsAccount" || r.status === "noReceipt" ? "neutral" : "pending";
          const pending = r.status === "scanning" || r.status === "reading" || r.status === "checking";
          const state = dup
            ? t("verify.batch.duplicateOf", { n: (r.duplicateOf ?? 0) + 1 })
            : r.status === "done" && v
              ? v.title
              : t(`verify.batch.${r.status}`);
          const amount = !dup && v?.showDetails && v.amount ? formatAmount(v.amount.value, v.amount.currency) : null;
          const ref = shortRef(v?.reference ?? r.reference);
          const isOpen = open === i && !pending;
          return (
            <li key={i} className="bp-row" data-tone={tone} data-open={isOpen || undefined}>
              <button
                type="button"
                className="bp-main"
                onClick={() => setOpen(isOpen ? null : i)}
                disabled={pending}
                aria-expanded={pending ? undefined : isOpen}
                aria-controls={`bp-more-${i}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an optimisable asset */}
                <img className="bp-thumb" src={thumbs[i]} alt="" width={40} height={40} />
                <span className="bp-text">
                  <span className="bp-line">
                    {amount ?? (ref ? <span className="vc-mono">{ref}</span> : r.name)}
                  </span>
                  <span className="bp-sub">
                    <span className="bp-state">{state}</span>
                    <span className="bp-name">{amount && ref ? <span className="vc-mono">{ref}</span> : `#${i + 1}`}</span>
                  </span>
                </span>
                {!pending && <span className="bp-chev" aria-hidden="true"><Icon icon={ChevronDownIcon} size={16} /></span>}
              </button>
              {isOpen && (
                <div className="bp-more" id={`bp-more-${i}`}>
                  {v && <p className="bp-note">{v.subtitle}</p>}
                  {dup && <p className="bp-note">{t("verify.batch.duplicateNote", { n: (r.duplicateOf ?? 0) + 1 })}</p>}
                  {r.status === "needsAccount" && <p className="bp-note">{t("verify.batch.needsAccountNote")}</p>}
                  {r.status === "noReceipt" && <p className="bp-note">{t("verify.batch.noReceiptNote")}</p>}
                  <dl className="bp-rows">
                    {v?.showDetails && !dup && v.from && (
                      <><dt>{t("verify.card.from")}</dt><dd>{[v.from.name, v.from.account].filter(Boolean).join(" · ")}</dd></>
                    )}
                    {v?.showDetails && !dup && v.to && (
                      <><dt>{t("verify.card.to")}</dt><dd>{[v.to.name, v.to.account].filter(Boolean).join(" · ")}</dd></>
                    )}
                    {v?.showDetails && !dup && v.date && (
                      <><dt>{t("verify.card.date")}</dt><dd className="vc-num">{formatDate(v.date)}</dd></>
                    )}
                    {v?.bank && (
                      <><dt>{t("verify.card.bank")}</dt><dd>{v.bank.shortName}</dd></>
                    )}
                    <dt>{t("verify.batch.file")}</dt>
                    <dd className="bp-file">{r.name}</dd>
                  </dl>
                  <div className="bp-acts">
                    {v?.sourceUrl && (
                      <a className="bp-act" href={v.sourceUrl} target="_blank" rel="noopener noreferrer">
                        {t("verify.card.source")} <Icon icon={ArrowUpRight01Icon} size={14} />
                      </a>
                    )}
                    {!v?.sourceUrl && (v?.fallbackUrl || v?.checkedUrl) && (
                      <a className="bp-act" href={v.fallbackUrl || v.checkedUrl} target="_blank" rel="noopener noreferrer nofollow">
                        {v.fallbackUrl ? t("verify.card.openReceipt") : t("verify.card.checked")} <Icon icon={ArrowUpRight01Icon} size={14} />
                      </a>
                    )}
                    {r.status === "needsAccount" && r.reference && (
                      <button type="button" className="bp-act" onClick={() => onPick(r.reference!, r.bankCode)}>
                        {t("verify.batch.addAccount")}
                      </button>
                    )}
                    {v && RETRYABLE.has(v.kind) && (
                      <button type="button" className="bp-act" onClick={() => process(i)}>
                        {t("verify.card.retry")}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {!running && (
        <div className="bp-foot">
          <button type="button" className="rch-clear" onClick={copySummary}>
            {copied ? t("verify.batch.copied") : t("verify.batch.copy")}
          </button>
          <button type="button" className="rch-clear" onClick={downloadCsv}>{t("verify.batch.csv")}</button>
        </div>
      )}
    </section>
  );
}
