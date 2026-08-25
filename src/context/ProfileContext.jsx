import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { db } from '../db/db'

export const PROFILES = ['business', 'personal']

/** Which sides of the app the user asked for during setup. */
export const MODES = ['business', 'personal', 'both']

const STORAGE_KEY = 'dual-active-profile'

/**
 * Private browsing and locked-down storage settings make localStorage throw on
 * access rather than return null, and a throw here would take the whole app
 * down before it painted. Business is the profile the app has always been.
 */
function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return PROFILES.includes(value) ? value : 'business'
  } catch {
    return 'business'
  }
}

const Ctx = createContext({
  profile: 'business',
  switchProfile: () => {},
  isBusiness: true,
  isPersonal: false,
  activeMode: 'both',
  showSwitcher: true,
})

export const useProfile = () => useContext(Ctx)

/**
 * Which side of the app the user is looking at, and which sides exist at all.
 *
 * Someone who set the app up for one side only has no second set of books to
 * switch to, so the switcher is not offered and the profile is pinned. Every
 * profile-scoped read still goes through db/queries.js with this value; the two
 * sets of records live in the same tables and never mix.
 */
export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(readStored)

  const stored = useLiveQuery(async () => {
    const row = await db.settings.where('key').equals('activeMode').first()
    return MODES.includes(row?.value) ? row.value : 'both'
  }, [])

  // Both until the setting is read. Assuming one side and then revealing the
  // other would flash a switcher into existence on every load.
  const activeMode = stored ?? 'both'

  const switchProfile = useCallback((next) => {
    if (!PROFILES.includes(next)) return
    setProfile(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // The choice still holds for this visit; it just will not be remembered.
    }
  }, [])

  // A one-sided setup has one profile by definition. This also rescues a device
  // left on the other side by an earlier choice.
  useEffect(() => {
    if (activeMode === 'both') return
    if (profile !== activeMode) switchProfile(activeMode)
  }, [activeMode, profile, switchProfile])

  const value = useMemo(
    () => ({
      profile,
      switchProfile,
      isBusiness: profile === 'business',
      isPersonal: profile === 'personal',
      activeMode,
      showSwitcher: activeMode === 'both',
    }),
    [profile, switchProfile, activeMode],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export default ProfileProvider
