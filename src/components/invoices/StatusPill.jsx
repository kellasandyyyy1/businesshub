import SignalBadge from '../SignalBadge'
import { invoiceSignal } from '../../lib/signal'

/**
 * Where an invoice stands, as a badge: paid is good news, overdue is a
 * problem, due within three days is a warning. Sent and draft are ordinary,
 * so they stay grey, colour is kept for the ones that need a look.
 */
export default function StatusPill({ invoice, today }) {
  const { tone, label } = invoiceSignal(invoice, today)
  return <SignalBadge tone={tone}>{label}</SignalBadge>
}
