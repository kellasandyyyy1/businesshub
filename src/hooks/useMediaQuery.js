import { useEffect, useState } from 'react'

/** Subscribes to a media query, SSR-safe and re-subscribing when it changes. */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Icon-only sidebar between 1024px and 1279px. */
export const useIsCompact = () =>
  useMediaQuery('(min-width: 1024px) and (max-width: 1279px)')

/** Below 768px the layout is touch-first; the bottom bar carries navigation. */
export const useIsMobile = () => useMediaQuery('(max-width: 767px)')

export default useMediaQuery
