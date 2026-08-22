import { useEffect, useState } from 'react'

/** Trails `value` by `delay`, so typing does not refilter on every keystroke. */
export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

export default useDebounced
