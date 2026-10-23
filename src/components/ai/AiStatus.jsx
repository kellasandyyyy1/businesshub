import { IconAlertCircle, IconKey } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { aiErrorMessage } from '../../lib/ai'

/**
 * Pulsing dot while a call is in flight. Groq is usually under a second, so
 * anything past three is worth acknowledging rather than leaving silent.
 */
export function AiLoading({ label = 'Thinking' }) {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 3000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <span className="bfh-ai-loading" role="status">
      <span className="bfh-ai-loading__dot" aria-hidden="true" />
      <span className="bfh-micro">{slow ? 'Still working…' : `${label}…`}</span>
    </span>
  )
}

/**
 * Every AI failure surfaces here, inline, dashed, never a crash. A missing
 * key is a setup prompt rather than an error, since nothing has gone wrong.
 */
export function AiError({ error, onRetry }) {
  if (!error) return null

  if (error.code === 'NO_API_KEY') {
    return (
      <div className="bfh-ai-note">
        <IconKey size={14} stroke={1.5} aria-hidden="true" />
        <span>
          Add your Groq API key in Settings to enable AI features.{' '}
          <Link className="bfh-ai-note__link" to="/settings">
            Go to Settings →
          </Link>
        </span>
      </div>
    )
  }

  return (
    <div className="bfh-ai-note">
      <IconAlertCircle size={14} stroke={1.5} aria-hidden="true" />
      <span>{aiErrorMessage(error)}</span>
      {onRetry && (
        <button type="button" className="bfh-ai-note__link" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
