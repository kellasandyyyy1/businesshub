import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

import ToastViewport from '../components/ToastViewport'

/**
 * Short confirmations of what the user just did, an undo for what they just
 * removed, and the error when a save fails. Never financial alerts, insights
 * or AI suggestions, those belong to the bell, the page and push.
 *
 *   toast.success('Budget saved')
 *   toast.undo('Goal deleted', onUndo, onExpire)
 *   toast.error("Couldn't save. Try again.")  , stays until closed
 */

const ToastContext = createContext(null)

const MAX_VISIBLE = 2
const DURATIONS = { success: 3000, info: 3000, undo: 5000, error: null }
/** Long enough for the exit fade before the toast leaves the DOM. */
const EXIT_MS = 320

let counter = 0
const nextId = () => (globalThis.crypto?.randomUUID?.() ?? `t${Date.now()}-${(counter += 1)}`)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  // Per toast: its timer, when that timer started, and the time it had left.
  const timers = useRef({})
  const live = useRef([])

  const remove = useCallback((id) => {
    const timer = timers.current[id]
    if (timer) clearTimeout(timer.handle)
    delete timers.current[id]
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    setTimeout(() => {
      live.current = live.current.filter((t) => t.id !== id)
      setToasts((list) => list.filter((t) => t.id !== id))
    }, EXIT_MS)
  }, [])

  /** The undo window closing: commit, then go. Runs at most once per toast. */
  const expire = useCallback(
    (id) => {
      const toast = live.current.find((t) => t.id === id)
      if (!toast || toast.settled) return
      toast.settled = true
      toast.onExpire?.()
      remove(id)
    },
    [remove],
  )

  /** Closing by hand counts as letting the window run out, the delete stands. */
  const dismiss = useCallback((id) => expire(id), [expire])

  const startTimer = useCallback(
    (id, ms) => {
      timers.current[id] = { handle: setTimeout(() => expire(id), ms), startedAt: Date.now(), remaining: ms }
    },
    [expire],
  )

  const pause = useCallback((id) => {
    const timer = timers.current[id]
    if (!timer?.handle) return
    clearTimeout(timer.handle)
    timer.remaining = Math.max(timer.remaining - (Date.now() - timer.startedAt), 0)
    timer.handle = null
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, paused: true } : t)))
  }, [])

  const resume = useCallback(
    (id) => {
      const timer = timers.current[id]
      if (!timer || timer.handle) return
      startTimer(id, timer.remaining)
      setToasts((list) => list.map((t) => (t.id === id ? { ...t, paused: false } : t)))
    },
    [startTimer],
  )

  const act = useCallback(
    (id) => {
      const toast = live.current.find((t) => t.id === id)
      if (!toast || toast.settled) return
      toast.settled = true
      toast.onAction?.()
      remove(id)
    },
    [remove],
  )

  const show = useCallback(
    (opts) => {
      const type = opts.type ?? 'success'
      const toast = {
        id: nextId(),
        type,
        message: opts.message,
        icon: opts.icon,
        actionLabel: opts.actionLabel,
        onAction: opts.onAction,
        onExpire: opts.onExpire,
        duration: opts.duration === undefined ? DURATIONS[type] : opts.duration,
      }

      // The same words already up are replaced rather than stacked, and the
      // oldest makes way past two, an undo it pushes out still commits.
      const current = live.current.filter((t) => !t.settled)
      const same = current.filter((t) => t.message === toast.message)
      const rest = current.filter((t) => t.message !== toast.message)
      const overflow = rest.length + 1 > MAX_VISIBLE ? rest.slice(0, rest.length + 1 - MAX_VISIBLE) : []
      for (const old of [...same, ...overflow]) expire(old.id)

      live.current = [...live.current, toast]
      setToasts((list) => [...list, toast])
      if (toast.duration) startTimer(toast.id, toast.duration)
      return toast.id
    },
    [expire, startTimer],
  )

  const api = useMemo(
    () => ({
      success: (message, o = {}) => show({ ...o, type: 'success', message }),
      info: (message, o = {}) => show({ ...o, type: 'info', message }),
      error: (message, o = {}) => show({ ...o, type: 'error', message }),
      undo: (message, onUndo, onExpire, o = {}) =>
        show({ ...o, type: 'undo', message, actionLabel: 'Undo', onAction: onUndo, onExpire }),
      dismiss,
    }),
    [show, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} onAction={act} onPause={pause} onResume={resume} />
    </ToastContext.Provider>
  )
}

/** Works outside the provider too (tests, stray mounts), it simply does nothing. */
const NOOP = { success() {}, info() {}, error() {}, undo() {}, dismiss() {} }
export const useToast = () => useContext(ToastContext) ?? NOOP
