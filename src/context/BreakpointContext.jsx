import { createContext, useContext } from 'react'

import { useBreakpoint } from '../hooks/useBreakpoint'

const Ctx = createContext({ breakpoint: 'desktop', isMobile: false, isTablet: false, isDesktop: true })

/** One resize listener for the whole tree rather than one per component. */
export const useDevice = () => useContext(Ctx)

export function BreakpointProvider({ children }) {
  const value = useBreakpoint()
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export default BreakpointProvider
