import { IconAlertTriangle, IconCheck, IconClock } from '@tabler/icons-react'

const ICONS = { pos: IconCheck, neg: IconAlertTriangle, warn: IconClock }

/**
 * A status word in a small pill. Coloured tones always carry an icon beside
 * the word, so the badge still reads in greyscale; neutral ones are words only.
 */
export default function SignalBadge({ tone = 'neutral', children, icon }) {
  const Icon = icon === false ? null : (icon ?? ICONS[tone])
  return (
    <span className={`badge-sig badge-${tone}`}>
      {Icon && <Icon size={11} stroke={2.25} aria-hidden="true" />}
      {children}
    </span>
  )
}
