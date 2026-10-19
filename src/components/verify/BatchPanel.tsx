"use client";

/**
 * Several screenshots at once (end-of-day reconciliation). Loaded lazily when
 * more than one image is dropped or picked.
 *
 * Reads like a ledger: a numbered line per screenshot, the bank's verdict, the
 * reference, and the amount in one right-aligned column (bank-confirmed only).
 * On top, the confirmed total. A receipt that appears twice is red and counted
 * once. Each image is scanned for a QR on the device, one at a time; reading
 * the text of an image without a QR (OCR) is slow, so it is offered, not run.
 * Colours come from rowTone (src/lib/verify/batch.ts), which takes the bank's
 * answer from presentVerdict. A row opens in place (never a card in the list),
 * with a downscaled preview made only when it is opened.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Translate } from "@/lib/i18n/translate";
import { decodeQrFromImage } from "@/lib/qr/decode";
import { detectInput } from "@/lib/verify/detect";
import { postJson } from "@/lib/verify/client";
import { presentVerdict } from "@/lib/verify/verdict";
import {
  batchCsv,
  batchText,
  displayReference,
  formatTotals,
  isConfirmed,
  isPending,
  markDuplicates,
  needsLook,
  rowTone,
  summarize,
  type BatchRow,
  type BatchSummary,
} from "@/lib/verify/batch";
import { Icon, ChevronDownIcon, ArrowUpRight01Icon, Copy01Icon, CopyCheckIcon } from "@/components/Icon";

interface Props {
  files: File[];
  t: Translate;
  onClear: () => void;
  /** A reference read from an image whose bank also needs account digits: finish it in the main field. */
  onPick: (reference: string, bankCode?: string) => void;
}

const RETRYABLE = new Set(["unavailable", "rateLimited", "offline"]);

const num = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });

function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) || !/\d{4}-\d{2}-\d{2}T/.test(value)
    ? value
    : d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function splitAmount(value: number): { whole: string; cents?: string } {
  const [whole, cents] = num(value).split(".");
  return { whole, cents };
}

export default function BatchPanel({ files, t, onClear, onPick }: Props) {
  const [rows, setRows] = useState<BatchRow[]>(() => files.map((f) => ({ name: f.name, status: "queued" as const })));
  const [open, setOpen] = useState<number | null>(null);
  const [onlyLook, setOnlyLook] = useState(false);
  const [copied, setCopied] = useState<"summary" | number | null>(null);
  const [announce, setAnnounce] = useState("");
  const [previews, setPreviews] = useState<Record<number, { small?: string; full: string }>>({});

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Object URLs live as long as the panel.
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const set = useCallback((i: number, row: BatchRow) => {
    if (alive.current) setRows((prev) => markDuplicates(prev.map((r, j) => (j === i ? row : r))));
  }, []);

  const label = useCallback(
    (row: BatchRow): string => {
      if (row.duplicateOf !== undefined) return t("verify.batch.duplicateOf", { n: row.duplicateOf + 1 });
      if (row.status === "done" && row.verdict) return row.verdict.title;
      return t(`verify.batch.${row.status}`);
    },
    [t]
  );

  const check = useCallback(
    async (i: number, raw: string, bankHint?: string) => {
      const name = files[i].name;
      const d = detectInput(raw, bankHint ? { overrideBank: bankHint } : {});
      if (!d.bank || d.kind === "unknownUrl" || d.kind === "empty") return set(i, { name, status: "noReceipt" });
      if (d.needsAccount || d.needsPhone) return set(i, { name, status: "needsAccount", reference: d.value, bankCode: d.bank.code });
      set(i, { name, status: "checking", reference: d.value, bankCode: d.bank.code });
      const body = d.kind === "boaQr" ? { bank: "boa", qrData: d.value } : { bank: d.bank.code, reference: d.value };
      const result = await postJson("/api/verify", body);
      set(i, { name, status: "done", reference: d.value, bankCode: d.bank.code, verdict: presentVerdict(result, { bankCode: d.bank.code, t }) });
    },
    [files, set, t]
  );

  const scan = useCallback(
    async (i: number) => {
      const name = files[i].name;
      set(i, { name, status: "scanning" });
      const qr = await decodeQrFromImage(files[i]);
      if (qr) return check(i, qr);
      set(i, { name, status: "noQr" });
    },
    [check, files, set]
  );

  /** OCR: the server first, then Tesseract on the device. Slow, so on request. */
  const read = useCallback(
    async (i: number) => {
      const name = files[i].name;
      set(i, { name, status: "reading" });
      try {
        const { extractTextFromImage } = await import("@/lib/ocr");
        const { parsed } = await extractTextFromImage(files[i]);
        if (!parsed?.reference) return set(i, { name, status: "noReceipt" });
        return check(i, parsed.reference, parsed.bank === "cbe-new" ? "cbe" : parsed.bank || undefined);
      } catch {
        set(i, { name, status: "noReceipt" });
      }
    },
    [check, files, set]
  );

  // One pass per set of files: a language switch re-creates `scan` but must
  // not start a second loop over the same images.
  const started = useRef<File[] | null>(null);
  useEffect(() => {
    if (started.current === files) return;
    started.current = files;
    (async () => {
      for (let i = 0; i < files.length && alive.current; i++) await scan(i);
    })();
  }, [files, scan]);

  const readAll = async () => {
    const todo = rows.map((r, i) => (r.status === "noQr" ? i : -1)).filter((i) => i >= 0);
    todo.forEach((i) => set(i, { name: files[i].name, status: "queued" }));
    for (const i of todo) {
      if (!alive.current) return;
      await read(i);
    }
  };

  const summary = summarize(rows);
  const running = rows.some(isPending);
  const look = rows.filter(needsLook).length;
  const noQr = rows.filter((r) => r.status === "noQr").length;
  const headline = useCallback(
    (s: BatchSummary) => t("verify.batch.confirmed", { n: s.confirmed, total: s.total }),
    [t]
  );

  // Screen readers hear the batch once, when it settles, not on every row.
  const wasRunning = useRef(true);
  useEffect(() => {
    if (wasRunning.current && !running) setAnnounce(`${t("verify.batch.done")} ${headline(summary)}.`);
    wasRunning.current = running;
  }, [running, summary, headline, t]);

  // Leaving the filter on with nothing left to look at would show an empty list.
  useEffect(() => {
    if (onlyLook && look === 0) setOnlyLook(false);
  }, [onlyLook, look]);

  const toggle = async (i: number) => {
    const next = open === i ? null : i;
    setOpen(next);
    if (next === null || previews[i]) return;
    const full = URL.createObjectURL(files[i]);
    urls.current.push(full);
    setPreviews((p) => ({ ...p, [i]: { full } }));
    try {
      const { prepareUpload } = await import("@/lib/image/prepare");
      const small = URL.createObjectURL(await prepareUpload(files[i], { maxEdge: 480, maxBytes: 200_000 }));
      urls.current.push(small);
      if (alive.current) setPreviews((p) => ({ ...p, [i]: { full, small } }));
    } catch {
      /* an image the browser cannot decode: the link to the original stays */
    }
  };

  const copy = async (value: string, what: "summary" | number) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
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

  const finished = summary.finished;
  const totals = summary.amounts.length ? summary.amounts : [{ currency: "ETB", value: 0 }];
  const sub = running
    ? t("verify.batch.progress", { n: Math.min(finished + 1, summary.total), total: summary.total })
    : [
        headline(summary),
        summary.attention - summary.duplicates > 0 ? t("verify.batch.attention", { n: summary.attention - summary.duplicates }) : null,
        summary.duplicates > 0 ? t("verify.batch.duplicates", { n: summary.duplicates }) : null,
      ]
        .filter(Boolean)
        .join(" · ");

  return (
    <section className="bp" aria-labelledby="bp-title">
      <div className="bp-head">
        <h3 id="bp-title" className="rch-title">{t("verify.batch.title")}</h3>
        <button type="button" className="rch-clear" onClick={onClear}>{t("verify.batch.clear")}</button>
      </div>

      <div className="bp-sum">
        <p className="bp-total" aria-label={`${t("verify.batch.totalLabel")} ${totals.map((a) => `${num(a.value)} ${a.currency}`).join(", ")}`}>
          {totals.map((a) => {
            const { whole, cents } = splitAmount(a.value);
            return (
              <span key={a.currency} className="bp-total-item">
                <span className="vc-amount-num">{whole}{cents && <span className="vc-amount-cents">.{cents}</span>}</span>
                <span className="vc-amount-cur">{a.currency}</span>
              </span>
            );
          })}
        </p>
        <p className="bp-sum-sub">{sub}</p>
        <p className="bp-sr" role="status">{announce}</p>
      </div>

      {!running && (look > 0 || noQr > 1) && (
        <div className="bp-tools">
          {look > 0 && (
            <button type="button" className="rch-clear" aria-pressed={onlyLook} onClick={() => setOnlyLook((v) => !v)}>
              {onlyLook ? t("verify.batch.showAll") : t("verify.batch.showLook", { n: look })}
            </button>
          )}
          {noQr > 1 && (
            <button type="button" className="rch-clear" onClick={readAll}>{t("verify.batch.readAll", { n: noQr })}</button>
          )}
        </div>
      )}

      <ol className="bp-list">
        {rows.map((r, i) => {
          if (onlyLook && !needsLook(r)) return null;
          const v = r.verdict;
          const dup = r.duplicateOf !== undefined;
          const pending = isPending(r);
          const confirmed = isConfirmed(r) && v?.showDetails && v.amount;
          const ref = displayReference(v?.reference ?? r.reference);
          const isOpen = open === i && !pending;
          const pv = previews[i];
          const note = dup
            ? t("verify.batch.duplicateNote", { n: (r.duplicateOf ?? 0) + 1 })
            : r.status === "done" && v && v.kind !== "verified"
              ? [v.subtitle, v.nextStep].filter(Boolean).join(" ")
              : r.status === "needsAccount" || r.status === "noQr" || r.status === "noReceipt"
                ? t(`verify.batch.${r.status}Note`)
                : null;
          return (
            <li key={i} className="bp-row" data-tone={rowTone(r)} data-open={isOpen || undefined}>
              <button
                type="button"
                className="bp-main"
                onClick={() => toggle(i)}
                disabled={pending}
                aria-expanded={pending ? undefined : isOpen}
                aria-controls={isOpen ? `bp-more-${i}` : undefined}
              >
                <span className="bp-idx" aria-hidden="true">{i + 1}</span>
                <span className="bp-text">
                  <span className="bp-line">{ref ? <span className="vc-mono">{ref}</span> : r.name}</span>
                  <span className="bp-state">{label(r)}</span>
                </span>
                <span className="bp-amt" data-empty={!confirmed || undefined}>
                  {confirmed ? <>{num(v!.amount!.value)} <span className="bp-cur">{v!.amount!.currency}</span></> : "–"}
                </span>
                <span className="bp-chev" aria-hidden="true">{!pending && <Icon icon={ChevronDownIcon} size={16} />}</span>
              </button>
              {isOpen && (
                <div className="bp-more" id={`bp-more-${i}`}>
                  {note && <p className="bp-note">{note}</p>}
                  <dl className="bp-rows">
                    {ref && (
                      <>
                        <dt>{t("verify.card.reference")}</dt>
                        <dd className="bp-ref">
                          <span className="vc-mono">{ref}</span>
                          <button type="button" className="bp-copy" onClick={() => copy(ref, i)} aria-label={t("verify.batch.copyRef", { ref })}>
                            <Icon icon={copied === i ? CopyCheckIcon : Copy01Icon} size={14} />
                          </button>
                        </dd>
                      </>
                    )}
                    {confirmed && !dup && v?.from && (
                      <><dt>{t("verify.card.from")}</dt><dd>{[v.from.name, v.from.account].filter(Boolean).join(" · ")}</dd></>
                    )}
                    {confirmed && !dup && v?.to && (
                      <><dt>{t("verify.card.to")}</dt><dd>{[v.to.name, v.to.account].filter(Boolean).join(" · ")}</dd></>
                    )}
                    {confirmed && !dup && v?.date && (
                      <><dt>{t("verify.batch.paid")}</dt><dd className="vc-num">{formatDate(v.date)}</dd></>
                    )}
                    {v?.bank && (
                      <><dt>{t("verify.card.bank")}</dt><dd>{v.bank.shortName}</dd></>
                    )}
                    <dt>{t("verify.batch.file")}</dt>
                    <dd className="bp-file">{r.name}</dd>
                  </dl>
                  {pv && (
                    <a className="bp-preview" href={pv.full} target="_blank" rel="noopener noreferrer" aria-label={t("verify.batch.openImage", { name: r.name })}>
                      {pv.small ? (
                        // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an optimisable asset
                        <img src={pv.small} alt="" decoding="async" />
                      ) : (
                        <span className="bp-preview-wait" />
                      )}
                    </a>
                  )}
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
                    {r.status === "noQr" && (
                      <button type="button" className="bp-act" onClick={() => read(i)}>{t("verify.batch.readText")}</button>
                    )}
                    {r.status === "needsAccount" && r.reference && (
                      <button type="button" className="bp-act" onClick={() => onPick(r.reference!, r.bankCode)}>
                        {t("verify.batch.addAccount")}
                      </button>
                    )}
                    {v && RETRYABLE.has(v.kind) && (
                      <button type="button" className="bp-act" onClick={() => scan(i)}>{t("verify.card.retry")}</button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="bp-foot">
        <button type="button" className="rch-clear" disabled={running} onClick={() => copy(batchText(rows, { headline: (s) => [headline(s), formatTotals(s.amounts)].filter(Boolean).join(" · "), label }), "summary")}>
          {copied === "summary" ? t("verify.batch.copied") : t("verify.batch.copy")}
        </button>
        <button type="button" className="rch-clear" disabled={running} onClick={downloadCsv}>{t("verify.batch.csv")}</button>
      </div>
    </section>
  );
}
