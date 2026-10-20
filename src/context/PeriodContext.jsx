import { createContext, useContext, useMemo, useState } from 'react'

/**
 * The window every dashboard widget reads from. It lives here rather than in
 * the topbar so a widget anywhere in the tree can subscribe without prop
 * drilling — switching a tab re-renders all of them at once.
 */

/* `label` is the compact pill text; `name` is the same window said in words,
   for headings and sentences — "Last 30 days", not "Last 30d". */
export const PERIODS = [
  { id: '7d', label: '7d', name: '7 days', days: 7 },
  { id: '30d', label: '30d', name: '30 days', days: 30 },
  { id: '90d', label: '90d', name: '90 days', days: 90 },
  { id: '12m', label: '12m', name: '12 months', days: 365 },
]

const PeriodContext = createContext(null)

/** ISO date `n` days before `from`. */
function isoDaysBefore(from, n) {
  const d = new Date(from)
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export function PeriodProvider({ children, initial = '30d' }) {
  const [periodId, setPeriodId] = useState(initial)

  const value = useMemo(() => {
    const period = PERIODS.find((p) => p.id === periodId) ?? PERIODS[1]
    const now = new Date()
    return {
      periodId: period.id,
      period,
      setPeriodId,
      /** Inclusive ISO date bounds, ready for a Dexie `.between()`. */
      startDate: isoDaysBefore(now, period.days),
      endDate: now.toISOString().slice(0, 10),
    }
  }, [periodId])

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>
}

export function usePeriod() {
  const ctx = useContext(PeriodContext)
  if (!ctx) throw new Error('usePeriod must be used inside a <PeriodProvider>')
  return ctx
}
