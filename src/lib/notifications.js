import { CAUTION_AT, PERIOD_WORD, budgetWindow, spendForBudget } from './budget'
import { daysBetween, formatCurrency, formatFullDate, shiftDays } from './format'
import { balanceOf, effectiveStatus } from './invoice'

/**
 * The conditions worth interrupting someone for.
 *
 * Each one collapses to a single notification however many rows triggered it —
 * the delivery layer sends at most one push per type per day, so an aggregate
 * ("3 invoices overdue") is the honest shape rather than three separate alerts
 * where only the first would arrive.
 *
 * Everything here is derived from IndexedDB. Nothing reads it but this file.
 */

/** Days a transaction can sit pending before it counts as stale. */
const STALE_AFTER_DAYS = 14
/** Invoices landing inside this window are worth a heads-up. */
const DUE_SOON_DAYS = 7
/** Below this many months of cover, runway stops being a statistic. */
const RUNWAY_MONTHS = 3

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/* ---- 1. Overdue invoices --------------------------------------------------- */

function overdueInvoices({ invoices, today, money }) {
  const overdue = invoices.filter((i) => effectiveStatus(i, today) === 'overdue')
  if (overdue.length === 0) return null

  const outstanding = overdue.reduce((total, i) => total + balanceOf(i), 0)
  const oldest = overdue.reduce((worst, i) => (i.dueDate < worst.dueDate ? i : worst))
  const days = daysBetween(oldest.dueDate, today)

  return {
    type: 'overdue-invoices',
    title: overdue.length === 1 ? `${oldest.invoiceNumber} is overdue` : `${plural(overdue.length, 'invoice')} overdue`,
    body:
      overdue.length === 1
        ? `${money(outstanding)} outstanding, ${plural(days, 'day')} past due.`
        : `${money(outstanding)} outstanding — the oldest is ${plural(days, 'day')} past due.`,
    link: '/invoices',
  }
}

/* ---- 2. Invoices due soon -------------------------------------------------- */

function invoicesDueSoon({ invoices, today, money }) {
  const horizon = shiftDays(today, DUE_SOON_DAYS)
  const soon = invoices.filter((i) => {
    const status = effectiveStatus(i, today)
    return (status === 'sent' || status === 'viewed') && i.dueDate >= today && i.dueDate <= horizon
  })
  if (soon.length === 0) return null

  const total = soon.reduce((sum, i) => sum + balanceOf(i), 0)
  const next = soon.reduce((first, i) => (i.dueDate < first.dueDate ? i : first))

  return {
    type: 'invoices-due-soon',
    title: `${plural(soon.length, 'invoice')} due within ${DUE_SOON_DAYS} days`,
    body: `${money(total)} expected. The first falls due ${formatFullDate(next.dueDate)}.`,
    link: '/invoices',
  }
}

/* ---- 3. Budget warnings ---------------------------------------------------- */

function budgetWarnings({ budgets, transactions, today }, { type = 'budget-warning', link = '/budgets' } = {}) {
  const breached = []

  for (const budget of budgets) {
    if (!budget.amount || budget.amount <= 0) continue
    const window = budgetWindow(budget.period, today)
    const spent = spendForBudget(transactions, budget, window)
    const ratio = spent / budget.amount
    // One-payee budgets (a subscription) are expected to be all but used each
    // month; they only count once a charge comes in above the limit.
    const threshold = budget.match ? 1 + Number.EPSILON : CAUTION_AT
    if (ratio >= threshold) breached.push({ ...budget, ratio })
  }

  if (breached.length === 0) return null
  const worst = breached.sort((a, b) => b.ratio - a.ratio)[0]
  const pct = Math.round(worst.ratio * 100)

  return {
    type,
    // Past the cap is a problem; nearing it is a warning.
    tone: worst.ratio >= 1 ? 'neg' : 'warn',
    title:
      breached.length === 1
        ? `${worst.name} is at ${pct}% of budget`
        : `${plural(breached.length, 'budget')} past ${Math.round(CAUTION_AT * 100)}%`,
    body:
      breached.length === 1
        ? `Spending ${PERIOD_WORD[worst.period] ?? 'so far'} has reached ${pct}% of what you set aside.`
        : `${worst.name} is furthest along at ${pct}%.`,
    link,
  }
}

/* ---- 4. Low cash runway ---------------------------------------------------- */

function lowRunway({ transactions, currentCash, today, money }) {
  // Same 90-day burn the Insights page uses, so the two never disagree.
  const from = shiftDays(today, -89)
  const burn =
    transactions
      .filter((t) => t.type === 'expense' && t.date >= from && t.date <= today)
      .reduce((total, t) => total + t.amount, 0) / 3

  if (burn <= 0) return null
  const months = currentCash / burn
  if (months >= RUNWAY_MONTHS) return null

  return {
    type: 'low-runway',
    title: `Cash runway is under ${RUNWAY_MONTHS} months`,
    body: `${money(currentCash)} on hand covers about ${months.toFixed(1)} months at your recent rate of spending.`,
    link: '/cashflow',
  }
}

/* ---- 5. Stale pending transactions ----------------------------------------- */

function stalePending({ transactions, today, money }) {
  const cutoff = shiftDays(today, -STALE_AFTER_DAYS)
  const stale = transactions.filter((t) => t.status === 'pending' && t.date <= cutoff)
  if (stale.length === 0) return null

  const total = stale.reduce((sum, t) => sum + t.amount, 0)

  return {
    type: 'stale-pending',
    title: `${plural(stale.length, 'transaction')} still not cleared`,
    body: `${money(total)} has been pending for more than ${STALE_AFTER_DAYS} days.`,
    link: '/transactions',
  }
}

/* ==========================================================================
   Personal

   Same rules as the business set above: one notification per type however many
   rows triggered it, every threshold named once, and nothing read from storage
   in here. The two markers that have to survive a reload — which goals have
   already been celebrated, and the last net worth announced — are passed in and
   handed back, so this file stays a pure function of its inputs.
   ========================================================================== */

/** A deadline this close is worth a word; further out there is still time. */
const GOAL_HORIZON_DAYS = 14
/** Personal entries go stale sooner than business ones: fewer, and yours. */
const PERSONAL_STALE_AFTER_DAYS = 3
/** Below this, a month of saving is not really saving. */
const SAVINGS_FLOOR_PCT = 10
/** A fall this steep is a change in behaviour, not a noisy month. */
const SAVINGS_DROP_PCT = 15
/** Spending this many times the usual is what a spike means. */
const SPIKE_MULTIPLE = 2
/** Under this, the multiple is arithmetic rather than money worth a word. */
const SPIKE_FLOOR = 1000
export const NET_WORTH_MILESTONES = [100_000, 250_000, 500_000, 1_000_000, 2_000_000, 5_000_000]

const sumAmounts = (rows) => rows.reduce((total, r) => total + (Number(r.amount) || 0), 0)

/* ---- 6. Goal deadline approaching ------------------------------------------ */

function goalDeadlines({ goals, today, money }) {
  const due = goals
    .filter((g) => g.deadline)
    .map((g) => ({ goal: g, days: daysBetween(today, g.deadline) }))
    .filter(({ goal, days }) => {
      const target = Number(goal.target) || 0
      return days >= 0 && days <= GOAL_HORIZON_DAYS && (Number(goal.current) || 0) < target
    })
  if (due.length === 0) return null

  const soonest = due.reduce((first, d) => (d.days < first.days ? d : first))
  const remaining = (Number(soonest.goal.target) || 0) - (Number(soonest.goal.current) || 0)
  // Rounded up to the nearest ten: a daily figure is a plan, not a measurement.
  const perDay = soonest.days > 0 ? Math.ceil(remaining / soonest.days / 10) * 10 : remaining

  return {
    type: 'goal-deadline',
    title:
      due.length === 1
        ? `${soonest.goal.name} deadline in ${plural(soonest.days, 'day')}`
        : `${plural(due.length, 'goal')} due within ${GOAL_HORIZON_DAYS} days`,
    body:
      soonest.days > 0
        ? `${money(remaining)} still needed — ${money(perDay)} a day to reach ${soonest.goal.name}.`
        : `${money(remaining)} still needed, and ${soonest.goal.name} is due today.`,
    link: '/personal/goals',
  }
}

/* ---- 7. Goal reached -------------------------------------------------------- */

function goalsReached({ goals, celebrated, money }) {
  const reached = goals.filter((g) => {
    const target = Number(g.target) || 0
    return target > 0 && (Number(g.current) || 0) >= target && !celebrated.includes(g.id)
  })
  if (reached.length === 0) return null

  const first = reached[0]
  const saved = reached.reduce((total, g) => total + (Number(g.target) || 0), 0)

  return {
    type: 'goal-reached',
    // The one place an emoji earns its keep: everything else in this file is a
    // problem to deal with, and this is the only line that is good news.
    title:
      reached.length === 1
        ? `${first.name} — goal reached! 🎉`
        : `${plural(reached.length, 'goal')} reached! 🎉`,
    body:
      reached.length === 1
        ? `You saved ${money(Number(first.target) || 0)}. Time to set a new one.`
        : `${money(saved)} put aside across them. Time to set new ones.`,
    link: '/personal/goals',
    reachedIds: reached.map((g) => g.id),
  }
}

/* ---- 8. Savings rate drop --------------------------------------------------- */

const monthOf = (iso) => iso.slice(0, 7)

/** What was kept from income; null when nothing came in to keep. */
function savingsRate(rows) {
  const income = sumAmounts(rows.filter((t) => t.type === 'income'))
  if (income <= 0) return null
  return ((income - sumAmounts(rows.filter((t) => t.type === 'expense'))) / income) * 100
}

function savingsRateDrop({ personalTransactions, today }) {
  const thisMonth = monthOf(today)
  const previous = monthOf(shiftDays(`${thisMonth}-01`, -1))

  const now = savingsRate(personalTransactions.filter((t) => monthOf(t.date) === thisMonth))
  const before = savingsRate(personalTransactions.filter((t) => monthOf(t.date) === previous))
  if (now === null || before === null) return null
  if (now >= SAVINGS_FLOOR_PCT) return null
  if (before - now < SAVINGS_DROP_PCT) return null

  return {
    type: 'savings-rate-drop',
    title: `Your savings rate dropped to ${Math.round(now)}%`,
    body: `Down from ${Math.round(before)}% last month. You are keeping under ${SAVINGS_FLOOR_PCT}% of what comes in.`,
    link: '/personal/reports',
  }
}

/* ---- 9. Spending spike ------------------------------------------------------ */

function spendingSpike({ personalTransactions, today, money }) {
  const weekStart = shiftDays(today, -6)
  const historyStart = shiftDays(today, -27)

  const byCategory = (rows) => {
    const totals = {}
    for (const t of rows) {
      const key = t.category || 'Uncategorised'
      totals[key] = (totals[key] ?? 0) + (Number(t.amount) || 0)
    }
    return totals
  }

  const expenses = personalTransactions.filter((t) => t.type === 'expense')
  const week = byCategory(expenses.filter((t) => t.date >= weekStart && t.date <= today))
  // The three weeks before this one, averaged — a single prior week is too thin
  // a base to call anything unusual against.
  const history = byCategory(expenses.filter((t) => t.date >= historyStart && t.date < weekStart))

  const spikes = Object.entries(week)
    .map(([category, spent]) => ({ category, spent, usual: (history[category] ?? 0) / 3 }))
    .filter(({ spent, usual }) => usual > 0 && spent >= SPIKE_FLOOR && spent / usual >= SPIKE_MULTIPLE)
  if (spikes.length === 0) return null

  const worst = spikes.reduce((a, b) => (b.spent / b.usual > a.spent / a.usual ? b : a))

  return {
    type: 'spending-spike',
    title: `${worst.category} spending is unusually high`,
    body: `${money(worst.spent)} this week — about ${(worst.spent / worst.usual).toFixed(1)}× your usual ${money(worst.usual)}.`,
    link: '/personal/expenses',
  }
}

/* ---- 10. Stale pending personal entries ------------------------------------- */

function personalStalePending({ personalTransactions, today, money }) {
  const cutoff = shiftDays(today, -PERSONAL_STALE_AFTER_DAYS)
  const stale = personalTransactions.filter((t) => t.status === 'pending' && t.date <= cutoff)
  if (stale.length === 0) return null

  const oldest = stale.reduce((worst, t) => (t.date < worst.date ? t : worst))
  const days = daysBetween(oldest.date, today)

  return {
    type: 'personal-stale-pending',
    title:
      stale.length === 1
        ? `${oldest.description || 'An entry'} is still pending`
        : `${plural(stale.length, 'entry')} still pending`,
    body:
      stale.length === 1
        ? `${money(Number(oldest.amount) || 0)}, added ${plural(days, 'day')} ago.`
        : `${money(sumAmounts(stale))} in total — the oldest was added ${plural(days, 'day')} ago.`,
    link: '/personal/transactions',
  }
}

/* ---- 11. Net worth milestone ------------------------------------------------ */

/** Returns the net worth alongside the notice, since the caller has to store it. */
function netWorthMilestone({ netWorth, lastNetWorth, money }) {
  const assets = sumAmounts(netWorth.filter((n) => n.type !== 'liability'))
  const liabilities = sumAmounts(netWorth.filter((n) => n.type === 'liability'))
  const net = assets - liabilities

  // Upward crossings only. Falling back under a number is not news anyone asked
  // to be given, and announcing the same one twice would be worse.
  const crossed = NET_WORTH_MILESTONES.filter((m) => net >= m && lastNetWorth < m)

  return {
    net,
    item:
      crossed.length === 0
        ? null
        : {
            type: 'net-worth-milestone',
            // Carried on the item so the delivery layer can record where we got
            // to, and only once the notice has actually gone out.
            netWorth: net,
            title: 'Net worth milestone reached',
            body: `Your net worth just passed ${money(crossed[crossed.length - 1])}. Keep going.`,
            link: '/personal/net-worth',
          },
  }
}

/**
 * The types this app can notify about, in the order Settings lists them. The
 * `setting` key is the existing Notifications toggle that gates each one;
 * runway has no toggle because it is the one alert worth never missing.
 */
export const NOTIFICATION_TYPES = [
  { type: 'overdue-invoices', label: 'Overdue invoices', setting: 'notifyOverdue' },
  { type: 'invoices-due-soon', label: 'Invoices due within 7 days', setting: 'notifyOverdue' },
  { type: 'budget-warning', label: 'Budget warnings (80%+)', setting: 'notifyBudgets' },
  { type: 'low-runway', label: 'Low cash runway (under 3 months)', setting: null },
  { type: 'stale-pending', label: 'Stale pending transactions', setting: 'notifyPending' },
  { type: 'goal-deadline', label: 'Goal deadlines', setting: 'notifyGoalDeadline', profile: 'personal' },
  { type: 'goal-reached', label: 'Goal reached', setting: 'notifyGoalReached', profile: 'personal' },
  {
    type: 'savings-rate-drop',
    label: 'Savings rate drop',
    setting: 'notifySavingsRate',
    profile: 'personal',
  },
  {
    type: 'spending-spike',
    label: 'Spending spikes',
    setting: 'notifySpendingSpike',
    profile: 'personal',
  },
  {
    type: 'personal-budget-warning',
    label: 'Personal budget warnings (80%+)',
    setting: 'notifyBudgets',
    profile: 'personal',
  },
  // The same idea as the business one above, so it answers to the same switch.
  {
    type: 'personal-stale-pending',
    label: 'Stale pending entries',
    setting: 'notifyPending',
    profile: 'personal',
  },
  {
    type: 'net-worth-milestone',
    label: 'Net worth milestones',
    setting: 'notifyNetWorth',
    profile: 'personal',
  },
]

/**
 * Builds the current notification list. A generator only returns something once
 * its threshold is crossed, so everything it produces is high priority by
 * definition — the field is kept so a gentler class of notice can be added
 * later without changing what gets pushed.
 */
export function buildNotifications({
  transactions,
  invoices,
  budgets,
  currentCash,
  today,
  symbol = '₱',
  settings = {},
  // Omitted entirely when the personal side is switched off, which is what
  // keeps its conditions from being evaluated at all rather than computed and
  // then discarded.
  personal = null,
}) {
  const money = (value) => formatCurrency(value, symbol)
  const context = { transactions, invoices, budgets, currentCash, today, money }

  const enabled = (key) => key === null || (settings[key] ?? true)

  const business = [
    overdueInvoices(context),
    invoicesDueSoon(context),
    budgetWarnings(context),
    lowRunway(context),
    stalePending(context),
  ]

  let personalItems = []

  if (personal) {
    const personalContext = {
      ...context,
      personalTransactions: personal.transactions ?? [],
      goals: personal.goals ?? [],
      netWorth: personal.netWorth ?? [],
      celebrated: personal.celebrated ?? [],
      lastNetWorth: Number(personal.lastNetWorth) || 0,
    }

    personalItems = [
      goalDeadlines(personalContext),
      goalsReached(personalContext),
      savingsRateDrop(personalContext),
      spendingSpike(personalContext),
      personalStalePending(personalContext),
      // The household's own budgets, measured against its own spending.
      budgetWarnings(
        { budgets: personal.budgets ?? [], transactions: personal.transactions ?? [], today },
        { type: 'personal-budget-warning', link: '/personal/budgets' },
      ),
      netWorthMilestone(personalContext).item,
    ]
  }

  return [...business, ...personalItems]
    .filter(Boolean)
    .filter((item) => enabled(NOTIFICATION_TYPES.find((t) => t.type === item.type)?.setting))
    .map((item) => ({ ...item, priority: 'high' }))
}

/* ---- What the caller has to remember ----------------------------------------
   Two notices must not repeat once given, so the caller stores a mark and
   passes it back next time. The arithmetic behind each mark lives here, beside
   the condition that reads it, rather than being restated in the hook. */

/** Goals newly at their target — the ones about to be celebrated. */
export const reachedGoalIds = (goals = [], celebrated = []) =>
  goals
    .filter((g) => {
      const target = Number(g.target) || 0
      return target > 0 && (Number(g.current) || 0) >= target && !celebrated.includes(g.id)
    })
    .map((g) => g.id)

/** Assets less liabilities, by the same reckoning the milestone check uses. */
export const netWorthTotal = (rows = []) =>
  sumAmounts(rows.filter((n) => n.type !== 'liability')) -
  sumAmounts(rows.filter((n) => n.type === 'liability'))
