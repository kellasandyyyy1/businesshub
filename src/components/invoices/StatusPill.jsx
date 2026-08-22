/**
 * Status as border treatment, not colour: dashed for a draft, solid for one in
 * flight, inverted once paid, and a pulsing dot when it is late.
 */
export default function StatusPill({ status }) {
  return (
    <span className="bfh-status-pill" data-status={status}>
      {status === 'overdue' && <span className="bfh-status-pill__dot" aria-hidden="true" />}
      {status}
    </span>
  )
}
