import { IconPlus } from '@tabler/icons-react'

import { useDevice } from '../context/BreakpointContext'

/**
 * Mobile-only shortcut to the same Add transaction flow the sidebar button
 * opens. It sits above the bottom nav, clear of the home indicator.
 */
export default function FAB({ onClick }) {
  const { isMobile } = useDevice()
  if (!isMobile) return null

  return (
    <button type="button" className="bfh-fab" data-help-id="add-transaction" onClick={onClick} aria-label="Add transaction">
      <IconPlus size={22} stroke={2} aria-hidden="true" />
    </button>
  )
}
