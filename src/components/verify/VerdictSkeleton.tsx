/**
 * Placeholder shaped like the verdict card (icon + title, amount, parties,
 * meta), so the result lands in the space the skeleton already holds: no
 * layout shift, and never a spinner on its own. The label says what is
 * happening for screen readers and for anyone on a slow connection.
 */
export function VerdictSkeleton({ label }: { label: string }) {
  return (
    <div className="vc vc-skel" data-tone="neutral" aria-busy="true">
      <div className="vc-head">
        <span className="vc-icon sk sk-circle" aria-hidden="true" />
        <div className="vc-headtext">
          <p className="vc-title vc-skel-label" role="status">{label}</p>
          <span className="sk sk-line" style={{ width: "62%" }} aria-hidden="true" />
        </div>
      </div>
      <span className="sk sk-amount" aria-hidden="true" />
      <div className="vc-parties" aria-hidden="true">
        <div className="vc-party"><span className="sk sk-line" style={{ width: "40%" }} /><span className="sk sk-line" style={{ width: "80%" }} /></div>
        <span className="vc-arrow" />
        <div className="vc-party"><span className="sk sk-line" style={{ width: "40%" }} /><span className="sk sk-line" style={{ width: "70%" }} /></div>
      </div>
      <div className="vc-meta sk-meta" aria-hidden="true">
        <span className="sk sk-line" /><span className="sk sk-line" /><span className="sk sk-line" />
      </div>
      <div className="sk-progress" aria-hidden="true" />
    </div>
  );
}
