import { useProfile } from '../context/ProfileContext'
import useSettings from './useSettings'

function timeOfDay(date) {
  const hour = date.getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

/**
 * Who the app is talking to, which depends on which books are open.
 *
 * A business is greeted by its own name; a household by the person's. Each
 * falls back to the other before giving up, because a half-filled setup should
 * still be addressed by a name it knows rather than by nothing.
 *
 * Read through useSettings so it is live: renaming yourself in Settings, or
 * switching profile, changes the greeting without a reload.
 */
export function useGreeting() {
  const { isBusiness } = useProfile()
  const settings = useSettings()

  const business = (settings.businessName ?? '').trim()
  const user = (settings.userName ?? '').trim()

  const preferred = isBusiness ? business : user
  const fallback = isBusiness ? user : business
  const name = preferred || fallback || 'there'

  const part = timeOfDay(new Date())

  return {
    greeting: `Good ${part}, ${name}`,
    name,
    timeOfDay: part,
    mode: isBusiness ? 'Business' : 'Personal',
  }
}

export default useGreeting
