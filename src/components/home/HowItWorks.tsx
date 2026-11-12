"use client";

import { useId, useState } from "react";
import { SAMPLE } from "@/lib/sample-receipt";
import { Icon, Camera01Icon, Upload01Icon } from "@/components/Icon";

/**
 * "How a check works": one slider drives the stage's sentence (the section
 * heading) and a fragment of the real checker in the matching state. Every
 * stage is in the markup (the inactive ones are aria-hidden and faded), so
 * the page reads the same to crawlers and without script; the slider is a
 * native range input, so arrow keys and touch work as they do everywhere.
 *
 * Data is the synthetic SAMPLE receipt (src/lib/sample-receipt.ts), never a
 * real transaction.
 */
const STAGES = [
  { name: "Paste", clause: "Paste the receipt link or scan its QR" },
  { name: "Ask", clause: "cheki asks the bank's own receipt page" },
  { name: "Read", clause: "It reads what the bank published" },
  { name: "Answer", clause: "Green only when the bank confirms it" },
] as const;

const amount = SAMPLE.amount.toLocaleString("en-US", { minimumFractionDigits: 2 });

function Fragment({ stage }: { stage: number }) {
  switch (stage) {
    case 0:
      return (
        <div className="hw-frag">
          <span className="hw-label">Receipt link, reference or QR</span>
          <div className="hw-field">
            <code className="hw-field-value">{SAMPLE.receiptUrl}</code>
            <span className="hw-tools" aria-hidden="true">
              <Icon icon={Camera01Icon} size={18} color="var(--ink-2)" />
              <Icon icon={Upload01Icon} size={18} color="var(--ink-2)" />
            </span>
          </div>
          <span className="hw-detect"><span className="hw-dot" data-tone="ink" />CBE · Receipt ID</span>
        </div>
      );
    case 1:
      return (
        <div className="hw-frag">
          <span className="hw-label">Request</span>
          <pre className="hw-code"><code>{`GET https://mbreciept.cbe.com.et/
    ${SAMPLE.receiptId}`}</code></pre>
          <span className="hw-detect"><span className="hw-dot" data-tone="ink" />200 · {(SAMPLE.durationMs / 1000).toFixed(1)} s · PDF</span>
        </div>
      );
    case 2:
      return (
        <div className="hw-frag">
          <span className="hw-label">From the bank&apos;s page</span>
          <dl className="hw-rows">
            <div><dt>Payer</dt><dd>{SAMPLE.senderName}</dd></div>
            <div><dt>Receiver</dt><dd>{SAMPLE.receiverName}</dd></div>
            <div><dt>Amount</dt><dd>{amount} {SAMPLE.currency}</dd></div>
            <div><dt>Date</dt><dd>{SAMPLE.date}</dd></div>
            <div><dt>Reference</dt><dd><code>{SAMPLE.reference}</code></dd></div>
          </dl>
        </div>
      );
    default:
      return (
        <div className="hw-frag hw-frag--slip">
          <span className="hw-verdict"><span className="hw-dot" data-tone="green" />Confirmed by CBE</span>
          <span className="hw-amount">{amount}<span> {SAMPLE.currency}</span></span>
          <span className="hw-to">To {SAMPLE.receiverName} · {SAMPLE.receiverAccount}</span>
        </div>
      );
  }
}

export function HowItWorks() {
  const [stage, setStage] = useState(0);
  const id = useId();
  const valueText = (i: number) => `${STAGES[i].name}: ${STAGES[i].clause}`;

  return (
    <section className="hw" aria-labelledby={`${id}-h`}>
      <div className="hw-fields">
        <div className="hw-words">
          <h2 id={`${id}-h`} className="hw-clause">
            {STAGES.map((s, i) => (
              <span key={s.name} className="hw-clause-text" data-on={i === stage || undefined} aria-hidden={i !== stage || undefined}>
                {s.clause}
              </span>
            ))}
          </h2>
        </div>
        <div className="hw-stage">
          <div className="hw-window" data-ui>
            {STAGES.map((s, i) => (
              <div key={s.name} className="hw-state" data-on={i === stage || undefined} aria-hidden={i !== stage || undefined}>
                <Fragment stage={i} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="container hw-control">
        <label htmlFor={`${id}-r`} className="sr-only">Stage of a check</label>
        <input
          id={`${id}-r`}
          className="hw-range"
          type="range"
          min={0}
          max={STAGES.length - 1}
          step={1}
          value={stage}
          aria-valuetext={valueText(stage)}
          onChange={(e) => setStage(Number(e.target.value))}
          style={{ ["--hw-p" as string]: `${(stage / (STAGES.length - 1)) * 100}%` }}
        />
        <ol className="hw-names">
          {STAGES.map((s, i) => (
            <li key={s.name}>
              <button type="button" className="hw-name" data-on={i === stage || undefined} aria-current={i === stage ? "step" : undefined} onClick={() => setStage(i)}>
                {s.name}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
