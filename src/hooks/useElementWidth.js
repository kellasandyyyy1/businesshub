import { useEffect, useRef, useState } from 'react'

/**
 * Measures an element so an SVG can be drawn at real pixel size — scaling a
 * viewBox instead would stretch the axis type out of the mono register.
 */
export function useElementWidth(fallback = 640) {
  const ref = useRef(null)
  const [width, setWidth] = useState(fallback)

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return [ref, width]
}

export default useElementWidth
