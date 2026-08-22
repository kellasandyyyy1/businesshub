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
    <button type="button" className="bfh-fab" onClick={onClick} aria-label="Add transaction">
      <IconPlus size={20} stroke={1.75} aria-hidden="true" />
    </button>
  )
}
