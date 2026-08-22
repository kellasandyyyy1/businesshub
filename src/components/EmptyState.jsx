/**
 * The one empty state used across the app. No border, no fill — the space
 * around it is the design. The heading names the space rather than announcing
 * that it is empty, and the action is always verb-first.
 */
export default function EmptyState({ icon: Icon, heading, body, actionLabel, onAction }) {
  return (
    <div className="bfh-emptystate">
      <Icon size={32} stroke={1.25} aria-hidden="true" />
      <h3 className="bfh-emptystate__heading">{heading}</h3>
      <p className="bfh-emptystate__body">{body}</p>
      {actionLabel && onAction && (
        <button type="button" className="bfh-btn-primary bfh-btn-primary--inline" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}
