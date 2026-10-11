/**
 * Placeholder with the exact shape of a verified receipt (status line,
 * amount, five label/value rows, the action row), so the result lands in the
 * space the skeleton already holds and never behind a lone spinner. The label
 * says what is happening for screen readers and slow connections.
 */
const ROWS = [78, 64, 52, 70, 34];

export function VerdictSkeleton({ label }: { label: string }) {
  return (
    <div className="vc vc-skel" data-tone="neutral" aria-busy="true">
      <div className="vc-head">
        <div className="vc-status">
          <span className="sk sk-dot" aria-hidden="true" />
          <p className="vc-title vc-skel-label" role="status">{label}</p>
        </div>
        <span className="sk sk-sub" aria-hidden="true" />
      </div>
      <span className="sk sk-amount" aria-hidden="true" />
      <div className="vc-rows" aria-hidden="true">
        {ROWS.map((w, i) => (
          <div key={i} className="vc-row sk-row">
            <span className="sk sk-line" style={{ width: 52 }} />
            <span className="sk-stack">
              <span className="sk sk-line" style={{ width: `${w}%` }} />
              {i < 2 && <span className="sk sk-line sk-acct" style={{ width: "36%" }} />}
            </span>
          </div>
        ))}
      </div>
      <span className="sk sk-note" aria-hidden="true" />
      <div className="sk-actions" aria-hidden="true">
        <span className="sk sk-btn" />
        <span className="sk sk-btn sk-btn--icon" />
        <span className="sk sk-btn sk-btn--icon" />
      </div>
      <div className="vc-foot" aria-hidden="true">
        <div className="sk-foot-row"><span className="sk sk-line" style={{ width: "44%" }} /></div>
        <div className="sk-foot-row"><span className="sk sk-line" style={{ width: "38%" }} /></div>
      </div>
    </div>
  );
}
