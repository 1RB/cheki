import type { BankState } from "@/lib/status-view";
import { STATE_LABEL, stateTone } from "@/lib/status-view";

/**
 * A bank's state as an 8px dot and a word (no tinted pill). The colour is
 * semantic and small; the word carries the meaning for anyone who can't see it.
 */
export function StatusDot({ state, label, quiet }: { state: BankState; label?: string; quiet?: boolean }) {
  return (
    <span className="sd" data-tone={stateTone(state)} data-quiet={quiet ? "" : undefined}>
      <span className="sd-dot" aria-hidden="true" />
      <span className="sd-word">{label ?? STATE_LABEL[state]}</span>
    </span>
  );
}
