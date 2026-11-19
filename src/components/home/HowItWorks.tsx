"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SAMPLE } from "@/lib/sample-receipt";
import { Icon, Camera01Icon, Upload01Icon } from "@/components/Icon";

/**
 * "How a check works": the four steps set as a list, beside a fragment of the
 * real checker in the matching state. Every step stays in the markup, so the
 * page reads the same to crawlers and without script; the active step is only
 * a tone change and the fragment crossfades between the four states. While the
 * section is on screen and the reader has not touched it, the steps advance on
 * their own; reduced motion and any tap stop that for good.
 *
 * The steps are ordinary buttons in a real <ol>, so the order reads without
 * script and arrow keys, touch and screen readers behave as they do anywhere.
 *
 * Data is the synthetic SAMPLE receipt (src/lib/sample-receipt.ts), never a
 * real transaction.
 */
const STAGES = [
  { name: "Paste", clause: "the receipt link, or scan the QR code" },
  { name: "Ask", clause: "the bank's own receipt page, live, for that reference" },
  { name: "Read", clause: "the amount, the names, the date and the reference the bank printed" },
  { name: "Answer", clause: "the verdict the bank gives, green only when it confirms the receipt" },
] as const;

const STEP_MS = 3600;

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
  const sectionRef = useRef<HTMLElement>(null);
  /** Set on the first tap: the reader has taken over, so the steps hold still. */
  const takenRef = useRef(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
    let onScreen = false;
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((e) => e.isIntersecting);
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    const timer = window.setInterval(() => {
      if (!onScreen || takenRef.current) return;
      setStage((s) => (s + 1) % STAGES.length);
    }, STEP_MS);
    return () => {
      io.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section ref={sectionRef} className="container-wide hp-section hw" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="hp-h2">How a check works</h2>
      <p className="hp-p">One request, one answer: cheki reads the bank&apos;s own receipt page and repeats what the bank says.</p>

      <div className="hw-body">
        <ol className="hw-steps">
          {STAGES.map((s, i) => (
            <li key={s.name}>
              <button
                type="button"
                className="hw-step"
                data-on={i === stage || undefined}
                aria-current={i === stage ? "step" : undefined}
                onClick={() => {
                  takenRef.current = true;
                  setStage(i);
                }}
              >
                <span className="hw-step-name">{s.name}</span>
                <span className="hw-step-clause">{s.clause}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="hw-stage" data-ui inert>
          <div className="hw-window">
            {STAGES.map((s, i) => (
              <div key={s.name} className="hw-state" data-on={i === stage || undefined} aria-hidden={i !== stage || undefined}>
                <Fragment stage={i} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
