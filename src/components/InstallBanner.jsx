import { IconDownload, IconX } from '@tabler/icons-react'
import { useState } from 'react'

import { usePWAInstall } from '../hooks/usePWAInstall'

const DISMISSED = 'bfh-install-dismissed'

/**
 * The one inverted call to action in the app, and only while it can actually do
 * something: a browser that has offered an install prompt, on a device where
 * the app is not already installed.
 */
export default function InstallBanner() {
  const { canInstall, triggerInstall } = usePWAInstall()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED) === 'true'
    } catch {
      return false
    }
  })

  if (!canInstall || dismissed) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED, 'true')
    } catch {
      // A browser refusing storage still closes it for this visit.
    }
    setDismissed(true)
  }

  return (
    <div className="bfh-install">
      <span className="bfh-install__body">
        <IconDownload size={14} stroke={1.5} aria-hidden="true" />
        <span className="bfh-install__text">Install BFH on this device for quick access.</span>
      </span>

      <span className="bfh-install__actions">
        <button type="button" className="bfh-install__go" onClick={triggerInstall}>
          Install
        </button>
        <button
          type="button"
          className="bfh-install__close"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
        >
          <IconX size={14} stroke={1.5} aria-hidden="true" />
        </button>
      </span>
    </div>
  )
}
