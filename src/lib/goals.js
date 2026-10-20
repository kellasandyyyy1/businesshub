import { goalProgress } from './personal'

export { goalProgress }

const DAY = 86400000
const DAYS_PER_MONTH = 30.44

const asDate = (iso) => new Date(`${iso}T00:00:00Z`)

/** Whole days from `today` to `deadline`; negative once it has passed. */
export function daysUntil(deadline, today) {
  if (!deadline) return null
  const days = Math.round((asDate(deadline) - asDate(today)) / DAY)
  return Number.isNaN(days) ? null : days
}

/**
 * Where a goal stands.
 *
 *   completed  the target is met, whatever the date
 *   overdue    the deadline has passed and it is not
 *   behind     less has been put aside than the time elapsed would suggest
 *   not-started nothing put aside yet, and not yet late — "on track" would
 *              be a strange thing to tell someone who has not begun
 *   on-track   everything else
 *
 * "Behind" measures saving against the clock: a goal a third of the way
 * through its run should be a third funded. Without a deadline there is no
 * clock to be behind, so an unfinished goal is simply on track.
 */
export function goalStatus(goal, today) {
  const status = clockStatus(goal, today)
  return status === 'on-track' && !(Number(goal?.current) > 0) ? 'not-started' : status
}

function clockStatus(goal, today) {
  const target = Number(goal?.target) || 0
  const current = Number(goal?.current) || 0

  if (target > 0 && current >= target) return 'completed'
  if (!goal?.deadline) return 'on-track'

  const left = daysUntil(goal.deadline, today)
  if (left === null) return 'on-track'
  if (left < 0) return 'overdue'

  // The run is from when the goal was set to when it is due. A goal created
  // without a usable date gets no expectation to fall short of.
  const start = goal.createdAt ? goal.createdAt.slice(0, 10) : null
  if (!start) return 'on-track'

  const total = daysUntil(goal.deadline, start)
  if (total === null || total <= 0) return 'on-track'

  const elapsed = Math.max(total - left, 0)
  return goalProgress(goal) < elapsed / total ? 'behind' : 'on-track'
}

export const STATUS_LABELS = {
  completed: 'Completed',
  overdue: 'Overdue',
  behind: 'Behind',
  'not-started': 'Not started',
  'on-track': 'On track',
}

/**
 * What has to go in each month to arrive on time.
 *
 * Null when there is nothing left to save or no date to save by. The month
 * count floors at one: inside the final month the honest answer is the whole
 * remaining amount, not a rate extrapolated from a handful of days.
 */
export function monthlySaveNeeded(goal, today) {
  const target = Number(goal?.target) || 0
  const current = Number(goal?.current) || 0
  const remaining = target - current

  if (remaining <= 0 || !goal?.deadline) return null

  const left = daysUntil(goal.deadline, today)
  if (left === null || left < 0) return null

  return remaining / Math.max(left / DAYS_PER_MONTH, 1)
}

/** The three figures above the grid. */
export function goalsSummary(goals = [], today) {
  const totals = goals.reduce(
    (acc, goal) => {
      acc.totalTarget += Number(goal.target) || 0
      // A goal saved past its target has not put more aside than it holds.
      acc.totalSaved += Math.min(Number(goal.current) || 0, Number(goal.target) || 0)
      if (goalStatus(goal, today) !== 'completed') acc.active += 1
      return acc
    },
    { active: 0, totalTarget: 0, totalSaved: 0 },
  )

  return totals
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "Due March 2027", or the plain truth that there is no date. */
export function deadlineLabel(goal) {
  if (!goal?.deadline) return 'No deadline'
  const month = MONTHS[Number(goal.deadline.slice(5, 7)) - 1]
  if (!month) return 'No deadline'
  return `Due ${month} ${goal.deadline.slice(0, 4)}`
}
