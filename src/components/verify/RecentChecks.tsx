"use client";

import type { RecentCheck } from "@/lib/verify/history";
import type { Translate } from "@/lib/i18n/translate";
import { formatAmount } from "@/lib/verify/summary";
import { findBank } from "@/lib/verify/verdict";
import { BankLogoByName } from "@/components/BankLogo";
import { RelativeTime } from "@/components/RelativeTime";
import { Icon, Cancel01Icon } from "@/components/Icon";

function shortRef(ref: string): string {
  const r = ref.replace(/^https?:\/\/(www\.)?/i, "");
  return r.length > 34 ? `${r.slice(0, 20)}…${r.slice(-10)}` : r;
}

interface Props {
  items: RecentCheck[];
  t: Translate;
  onUse: (item: RecentCheck) => void;
  onRemove: (item: RecentCheck) => void;
  onClear: () => void;
}

/** Verified-only, on-device list. Each row re-checks; × removes it; Clear empties it. */
export function RecentChecks({ items, t, onUse, onRemove, onClear }: Props) {
  if (items.length === 0) return null;
  return (
    <section className="rch" aria-labelledby="rch-title">
      <div className="rch-head">
        <h3 id="rch-title" className="rch-title">{t("verify.recent.title")}</h3>
        <button type="button" className="rch-clear" onClick={onClear}>{t("verify.recent.clear")}</button>
      </div>
      <ul className="rch-list">
        {items.map((item) => {
          const bank = findBank(item.bank);
          return (
            <li key={`${item.bank}:${item.ref}`} className="rch-row">
              <button type="button" className="rch-use" onClick={() => onUse(item)} aria-label={t("verify.recent.use", { ref: shortRef(item.ref) })}>
                <BankLogoByName code={bank?.code ?? item.bank} size={24} />
                <span className="rch-ref">{shortRef(item.ref)}</span>
                <span className="rch-meta">
                  {item.amount != null && <span className="rch-amt">{formatAmount(item.amount, item.currency)}</span>}
                  <RelativeTime value={item.checkedAt} variant="relative" />
                </span>
              </button>
              <button type="button" className="rch-remove" onClick={() => onRemove(item)} aria-label={t("verify.recent.remove", { ref: shortRef(item.ref) })}>
                <Icon icon={Cancel01Icon} size={16} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
