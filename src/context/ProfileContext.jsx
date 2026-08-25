import { createContext, useCallback, useContext, useMemo, useState } from 'react'

export const PROFILES = ['business', 'personal']

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
})

export const useProfile = () => useContext(Ctx)

/**
 * Which side of the app the user is looking at. Every profile-scoped read goes
 * through db/queries.js with this value; the two sets of records live in the
 * same tables and never mix.
 */
export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(readStored)

  const switchProfile = useCallback((next) => {
    if (!PROFILES.includes(next)) return
    setProfile(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // The choice still holds for this visit; it just will not be remembered.
    }
  }, [])

  const value = useMemo(
    () => ({
      profile,
      switchProfile,
      isBusiness: profile === 'business',
      isPersonal: profile === 'personal',
    }),
    [profile, switchProfile],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export default ProfileProvider
