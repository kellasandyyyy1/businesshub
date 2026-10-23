import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { setTitleBadge } from './useDocumentTitle'
import { useNotifications } from './useNotifications'
import { notificationTone } from '../lib/signal'

const SEEN_KEY = 'dual-seen-notifications'
const TONE_RANK = { neg: 3, warn: 2, pos: 1 }

/** What a notice is, for remembering that it has been seen. */
const keyOf = (item) => `${item.type}|${item.title}`

function readSeen() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

/**
 * Everything the bell needs to say at a glance:
 *
 *   count   notices showing in the list
 *   fresh   how many of them have not been looked at yet
 *   tone    the most serious tone among the fresh ones — neg, warn or pos
 *   ring    true for a moment when something new arrives, to wiggle the bell
 *   markSeen()  call when the list is opened
 *
 * It reads the same list the dropdown shows, so the badge and the list can
 * never disagree. Fresh notices also show in the tab title and, when the app
 * is installed, as a number on its icon.
 */
export default function useBellState() {
  const items = useNotifications()
  const [seen, setSeen] = useState(readSeen)
  const [ring, setRing] = useState(false)
  const lastFresh = useRef(null)

  const fresh = useMemo(() => items.filter((item) => !seen.has(keyOf(item))), [items, seen])

  const tone = useMemo(() => {
    let best = null
    for (const item of fresh) {
      const t = notificationTone(item)
      if (t && (TONE_RANK[t] ?? 0) > (TONE_RANK[best] ?? 0)) best = t
    }
    return best
  }, [fresh])

  // A new arrival rings the bell once — on load too, if something is waiting.
  useEffect(() => {
    const previous = lastFresh.current
    lastFresh.current = fresh.length
    if (fresh.length > 0 && (previous === null || fresh.length > previous)) {
      setRing(true)
      const t = setTimeout(() => setRing(false), 1200)
      return () => clearTimeout(t)
    }
    return undefined
  }, [fresh.length])

  // The tab title and the installed app's icon carry the count too, so it is
  // seen from another tab or the home screen.
  useEffect(() => {
    setTitleBadge(fresh.length)
    try {
      if (fresh.length > 0) navigator.setAppBadge?.(fresh.length)
      else navigator.clearAppBadge?.()
    } catch {
      // Badging is a nicety; a browser without it simply skips it.
    }
  }, [fresh.length])

  const markSeen = useCallback(() => {
    const next = new Set(items.map(keyOf))
    setSeen(next)
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...next]))
    } catch {
      // Without storage the badge simply comes back next visit.
    }
  }, [items])

  return { count: items.length, fresh: fresh.length, tone, ring, markSeen }
}
