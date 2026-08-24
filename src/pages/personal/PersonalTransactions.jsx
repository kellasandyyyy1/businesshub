import Transactions from '../Transactions'

/**
 * The personal transactions page is the business one.
 *
 * The page reads its rows for whichever profile is active, and this route
 * only renders under PersonalOnly, so mounting it here is the whole
 * difference. Keeping one component means the two sides cannot drift.
 */
export default function PersonalTransactions() {
  return <Transactions />
}
