import { sum } from './ledger'
import { netWorthSummary } from './netWorth'
import { personalMetrics } from './personal'

/** A transfer moves money between our own accounts, never revenue or spend. */
const isOperating = (r) => r.type === 'income' || r.type === 'expense'

/** The first of the month `today` falls in, and today itself. */
export function monthToDate(today) {
  return { from: `${today.slice(0, 7)}-01`, to: today }
}

const inMonth = (rows, { from, to }) => rows.filter((r) => r.date >= from && r.date <= to)

/**
 * Cash the business is holding.
 *
 * The same rule the business dashboard uses: everything that has actually
 * cleared, transfers excluded, with no cut-off, cash on hand is a running
 * position rather than something a reporting period slices.
 */
export function businessCash(transactions = []) {
  const cleared = transactions.filter((r) => r.status === 'cleared' && isOperating(r))
  return (
    sum(cleared.filter((r) => r.type === 'income')) -
    sum(cleared.filter((r) => r.type === 'expense'))
  )
}

/** Revenue, spend and profit for the month so far. */
export function businessMonth(transactions = [], bounds) {
  const rows = inMonth(transactions, bounds)
  const revenue = sum(rows.filter((r) => r.type === 'income'))
  const expenses = sum(rows.filter((r) => r.type === 'expense'))
  return { revenue, expenses, profit: revenue - expenses }
}

/**
 * What the owner has paid themselves this month.
 *
 * Counted from the business side, which is the half that carries the link,
 * counting both would double it.
 */
export function transfersThisMonth(businessTransactions = [], bounds) {
  return sum(inMonth(businessTransactions.filter((r) => r.linkedTransactionId), bounds))
}

/**
 * Everything on one line.
 *
 * Combined worth is the business's cash plus what the household owns, less
 * what it owes. Business receivables and liabilities are deliberately left
 * out: an unpaid invoice is not money anyone holds yet, and folding it in
 * would make the headline figure flatter than the bank account behind it.
 */
export function combinedOverview({ businessTransactions = [], personalTransactions = [], netWorthItems = [] } = {}, today) {
  const bounds = monthToDate(today)

  const cash = businessCash(businessTransactions)
  const business = { cash, ...businessMonth(businessTransactions, bounds) }

  const personal = personalMetrics({ rows: inMonth(personalTransactions, bounds) })
  const worth = netWorthSummary(netWorthItems)

  return {
    bounds,
    business,
    personal,
    worth,
    transfers: transfersThisMonth(businessTransactions, bounds),
    combinedNetWorth: cash + worth.assets - worth.liabilities,
  }
}
