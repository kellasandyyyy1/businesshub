import { IconX } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { db } from '../db/db'
import { BUSINESS_PROFILE, ofProfile } from '../db/queries'

/** Built before the profile split, so it reads the business side. */
const inProfile = ofProfile(BUSINESS_PROFILE)

const KEY = 'dual-howto-dismissed'

/**
 * The first-run nudge at the top of the dashboard.
 *
 * Shown only while there is genuinely nothing recorded yet, and only until it
 * is dismissed — the choice is remembered in localStorage rather than the
 * database, since it is about this browser rather than about the business.
 */
export default function HowToBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === 'true'
    } catch {
      return false
    }
  })

  const count = useLiveQuery(() => db.transactions.filter(inProfile).count(), [], null)

  // `null` means the count has not come back yet; showing the banner before
  // then would flash it at someone who already has data.
  if (dismissed || count === null || count > 0) return null

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, 'true')
    } catch {
      // A browser refusing storage still gets the banner closed for this visit.
    }
    setDismissed(true)
  }

  return (
    <div className="bfh-howtobanner">
      <span className="bfh-howtobanner__text">
        Welcome to Dual.{' '}
        <Link to="/how-it-works" className="bfh-howtobanner__link">
          Learn how it works →
        </Link>
      </span>

      <button
        type="button"
        className="bfh-iconaction"
        onClick={dismiss}
        aria-label="Dismiss welcome message"
      >
        <IconX size={14} stroke={1.5} aria-hidden="true" />
      </button>
    </div>
  )
}
