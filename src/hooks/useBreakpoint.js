import { useState, useEffect } from 'react'

/** Matches the CSS breakpoints exactly, so JS and stylesheets never disagree. */
function getBreakpoint(width) {
  if (width < 768) return 'mobile'
  if (width < 1024) return 'tablet'
  return 'desktop'
}

export function useBreakpoint() {
  const [bp, setBp] = useState(() =>
    getBreakpoint(typeof window === 'undefined' ? 1280 : window.innerWidth),
  )

  useEffect(() => {
    let timer
    const handler = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setBp(getBreakpoint(window.innerWidth)), 150)
    }
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('resize', handler)
      clearTimeout(timer)
    }
  }, [])

  return {
    breakpoint: bp,
    isMobile: bp === 'mobile',
    isTablet: bp === 'tablet',
    isDesktop: bp === 'desktop',
  }
}

export default useBreakpoint
