import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'

import { db } from '../db/db'
import { BUSINESS_PROFILE, ofProfile } from '../db/queries'
import { buildNotifications, netWorthTotal, reachedGoalIds } from '../lib/notifications'
import { triggerPush } from '../lib/push'

const inBusiness = ofProfile(BUSINESS_PROFILE)
const inPersonal = ofProfile('personal')

/* Two personal notices must not repeat once given, so what has already been
   said is written down. These are markers about this browser rather than
   preferences about the account, which is why they live in localStorage and not
   in the settings table that syncs into an export. */
const CELEBRATED_GOALS = 'dual-celebrated-goals'
const LAST_NET_WORTH = 'dual-last-net-worth'

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage is full or blocked; the notice repeats, which beats crashing.
  }
}

/**
 * Live notification conditions, derived from IndexedDB.
 *
 * A live query re-runs on every write, so the same condition can resolve dozens
 * of times in a session. This set stops the app hammering the backend for
 * something it has already asked to deliver; the server's once-per-type-per-day
 * rule is the real guarantee, this is just good manners.
 */
const requestedThisSession = new Set()

/**
 * What had already been said when this session began.
 *
 * Read once and then held, because two things read these markers — the shell,
 * which delivers, and the bell, which lists — and the live query behind each
 * re-runs on every write. Re-reading storage would mean the shell recording a
 * milestone as sent and the bell, resolving a moment later against the new
 * marker, deciding there was no milestone to show. The notice would be pushed
 * to the phone and be missing from the app that pushed it.
 *
 * So the baseline is fixed for the session: a notice stays visible until the
 * next launch, and the marker written on delivery only governs that launch.
 */
let baseline = null

function sessionBaseline(goals, netWorth) {
  if (baseline) return baseline

  /* First run on this browser records where things already stand without
     announcing it. Without that, opening the app with ₱500,000 already saved
     would read as having just crossed ₱500,000, and every goal met months ago
     would be celebrated afresh. */
  if (localStorage.getItem(LAST_NET_WORTH) === null) {
    write(LAST_NET_WORTH, netWorthTotal(netWorth))
    write(CELEBRATED_GOALS, reachedGoalIds(goals, []))
  }

  baseline = {
    celebrated: readJson(CELEBRATED_GOALS, []),
    lastNetWorth: Number(readJson(LAST_NET_WORTH, 0)) || 0,
  }
  return baseline
}

export function useNotifications() {
  const items = useLiveQuery(async () => {
    const today = new Date().toISOString().slice(0, 10)

    const [transactions, invoices, budgets, settings] = await Promise.all([
      db.transactions.filter(inBusiness).toArray(),
      db.invoices.filter(inBusiness).toArray(),
      db.budgets.filter(inBusiness).toArray(),
      db.settings.toArray(),
    ])

    const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]))
    const currentCash =
      Number(settingsMap.openingBalance ?? 0) +
      transactions
        .filter((t) => t.status === 'cleared' && (t.type === 'income' || t.type === 'expense'))
        .reduce((total, t) => total + (t.type === 'income' ? t.amount : -t.amount), 0)

    // Someone running business-only has no personal books to read, so the
    // queries are not made rather than made and thrown away.
    const activeMode = settingsMap.activeMode ?? 'both'
    let personal = null

    if (activeMode === 'personal' || activeMode === 'both') {
      const [personalTransactions, goals, netWorth] = await Promise.all([
        db.transactions.filter(inPersonal).toArray(),
        db.goals.filter(inPersonal).toArray(),
        db.netWorth.filter(inPersonal).toArray(),
      ])

      personal = {
        transactions: personalTransactions,
        goals,
        netWorth,
        ...sessionBaseline(goals, netWorth),
      }
    }

    return buildNotifications({
      transactions,
      invoices,
      budgets,
      currentCash,
      today,
      symbol: settingsMap.symbol ?? '₱',
      settings: settingsMap,
      personal,
    })
  }, [])

  useEffect(() => {
    if (!items) return
    for (const item of items) {
      if (item.priority !== 'high') continue
      if (requestedThisSession.has(item.type)) continue
      requestedThisSession.add(item.type)
      triggerPush(item)

      /* Marked once it has actually gone out, not when it was worked out. The
         live query re-runs on every write, so marking at build time would
         retire the notice before anyone had the chance to read it. */
      if (item.type === 'goal-reached' && item.reachedIds) {
        write(CELEBRATED_GOALS, [...readJson(CELEBRATED_GOALS, []), ...item.reachedIds])
      }
      if (item.type === 'net-worth-milestone' && item.netWorth !== undefined) {
        write(LAST_NET_WORTH, item.netWorth)
      }
    }
  }, [items])

  return items ?? []
}

export default useNotifications
