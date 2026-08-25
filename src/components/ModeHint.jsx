import { IconPlus, IconX } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useProfile } from '../context/ProfileContext'

const DISMISSED = 'dual-mode-hint-dismissed'

const COPY = {
  business: {
    title: 'Add Personal finance',
    body: 'Track spending, goals, net worth.',
  },
  personal: {
    title: 'Add Business finance',
    body: 'Track invoices, clients, revenue.',
  },
}

const read = () => {
  try {
    return localStorage.getItem(DISMISSED) === 'true'
  } catch {
    return false
  }
}

/**
 * A note that the other half of the app exists.
 *
 * Someone who picked one side during setup has no way of knowing the other is
 * a setting away — nothing in the interface mentions it, because the whole
 * point of the choice was to remove it. The dashed border marks this as a
 * prompt rather than a part of the navigation, and dismissing it is permanent:
 * a hint that keeps coming back is an advert.
 */
export default function ModeHint() {
  const { activeMode } = useProfile()
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(read)

  if (activeMode === 'both' || dismissed) return null

  const copy = COPY[activeMode]
  if (!copy) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED, 'true')
    } catch {
      // Hidden for this visit at least.
    }
    setDismissed(true)
  }

  return (
    <div className="bfh-modehint">
      <button
        type="button"
        className="bfh-modehint__close"
        aria-label="Dismiss"
        onClick={dismiss}
      >
        <IconX size={11} stroke={1.5} aria-hidden="true" />
      </button>

      <span className="bfh-modehint__title">
        <IconPlus size={12} stroke={1.75} aria-hidden="true" />
        {copy.title}
      </span>
      <span className="bfh-modehint__body">{copy.body}</span>

      <button
        type="button"
        className="bfh-micro bfh-modehint__link"
        onClick={() => navigate('/settings?section=appearance')}
      >
        Enable in Settings →
      </button>
    </div>
  )
}
