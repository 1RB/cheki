"use client";

/**
 * Several screenshots at once (end-of-day reconciliation). Loaded lazily when
 * more than one image is dropped or picked. Each image is scanned for a QR on
 * the device, then checked one at a time; every row's colour comes from
 * presentVerdict, so a decoded-only BOA QR is amber and shows its reference
 * only, exactly like the single check.
 */
import { useEffect, useState } from "react";
import type { Translate } from "@/lib/i18n/translate";
import { decodeQrFromImage } from "@/lib/qr/decode";
import { detectInput } from "@/lib/verify/detect";
import { postJson } from "@/lib/verify/client";
import { presentVerdict, type Verdict } from "@/lib/verify/verdict";
import { formatAmount } from "@/lib/verify/summary";

type Row =
  | { name: string; status: "scanning" | "checking" }
  | { name: string; status: "noQr" }
  | { name: string; status: "done"; verdict: Verdict };

interface Props {
  files: File[];
  t: Translate;
  onClear: () => void;
}

export default function BatchPanel({ files, t, onClear }: Props) {
  const [rows, setRows] = useState<Row[]>(() => files.map((f) => ({ name: f.name, status: "scanning" as const })));

  useEffect(() => {
    let cancelled = false;
    const set = (i: number, row: Row) => {
      if (!cancelled) setRows((prev) => prev.map((r, j) => (j === i ? row : r)));
    };
    (async () => {
      for (let i = 0; i < files.length && !cancelled; i++) {
        const name = files[i].name;
        const raw = await decodeQrFromImage(files[i]);
        if (!raw) {
          set(i, { name, status: "noQr" });
          continue;
        }
        const d = detectInput(raw);
        if (!d.bank || d.kind === "unknownUrl" || d.kind === "empty") {
          set(i, { name, status: "noQr" });
          continue;
        }
        set(i, { name, status: "checking" });
        const body = d.kind === "boaQr" ? { bank: "boa", qrData: d.value } : { bank: d.bank.code, reference: d.value };
        const result = await postJson("/api/verify", body);
        set(i, { name, status: "done", verdict: presentVerdict(result, { bankCode: d.bank.code, t }) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [files, t]);

  return (
    <section className="bp" aria-labelledby="bp-title">
      <div className="bp-head">
        <h3 id="bp-title" className="rch-title">{t("verify.batch.title")}</h3>
        <button type="button" className="rch-clear" onClick={onClear}>{t("verify.batch.clear")}</button>
      </div>
      <ul className="bp-list" aria-live="polite">
        {rows.map((r, i) => (
          <li key={i} className="bp-row" data-tone={r.status === "done" ? r.verdict.tone : r.status === "noQr" ? "neutral" : "pending"}>
            <span className="bp-name">{r.name}</span>
            <span className="bp-state">
              {r.status === "scanning" && t("verify.batch.scanning")}
              {r.status === "checking" && t("verify.batch.checking")}
              {r.status === "noQr" && t("verify.batch.noQr")}
              {r.status === "done" && r.verdict.title}
            </span>
            {r.status === "done" && (
              <span className="bp-detail">
                {r.verdict.showDetails && r.verdict.amount && <strong>{formatAmount(r.verdict.amount.value, r.verdict.amount.currency)}</strong>}
                {r.verdict.reference && <span className="vc-mono">{r.verdict.reference}</span>}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
