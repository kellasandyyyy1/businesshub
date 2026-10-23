import { IconSparkles, IconX } from '@tabler/icons-react'
import { useState } from 'react'

import { useAssistantActions } from '../context/AssistantActionsContext'

const DISMISSED = 'dual-ai-hint-dismissed'
const OPEN_COUNT = 'dual-open-count'
/** Past a handful of visits the app is no longer new and the nudge is noise. */
const MAX_OPENS = 5

const read = (key) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * A quiet, one-time pointer to the assistant for anyone who skipped it during
 * setup. It retires on its own after a few visits, so it never becomes
 * furniture someone has to keep ignoring.
 */
export default function AiHint() {
  const { openAssistant } = useAssistantActions()
  const [dismissed, setDismissed] = useState(() => read(DISMISSED) === 'true')

  const opens = Number(read(OPEN_COUNT) ?? '0')
  if (dismissed || opens > MAX_OPENS) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED, 'true')
    } catch {
      // A browser refusing storage still gets it closed for this visit.
    }
    setDismissed(true)
  }

  return (
    <div className="bfh-aihint">
      <span className="bfh-aihint__body">
        <IconSparkles size={14} stroke={1.5} aria-hidden="true" />
        <span className="bfh-aihint__text">
          Ask Dual anything: finances, expenses, invoices.
        </span>
        <button type="button" className="bfh-aihint__try" onClick={openAssistant}>
          Try it →
        </button>
      </span>

      <button
        type="button"
        className="bfh-iconaction"
        onClick={dismiss}
        aria-label="Dismiss assistant hint"
      >
        <IconX size={13} stroke={1.5} aria-hidden="true" />
      </button>
    </div>
  )
}
