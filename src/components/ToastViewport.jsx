import { IconAlertCircle, IconCheck, IconInfoCircle, IconTrash, IconX } from '@tabler/icons-react'
import { useRef } from 'react'

import { useIsMobile } from '../hooks/useMediaQuery'

const ICONS = { success: IconCheck, undo: IconTrash, info: IconInfoCircle, error: IconAlertCircle }

/** Past this many pixels, a drag is a dismissal rather than a wobble. */
const SWIPE = 36

/**
 * Pulled the wrong way, a toast gives a little and no more — the rubber band
 * iOS uses, so the drag never feels like it has come loose.
 */
const resist = (d) => Math.sign(d) * Math.min(Math.abs(d), 8 + Math.sqrt(Math.abs(d)) * 2)

function Toast({ toast, atTop, onDismiss, onAction, onPause, onResume }) {
  const Icon = toast.icon ?? ICONS[toast.type]
  const ref = useRef(null)
  const drag = useRef(null)
  // Undo and errors want a deliberate choice, so a stray tap never settles them.
  const tapToClose = toast.type === 'success' || toast.type === 'info'
  const closable = toast.type === 'error' || toast.type === 'undo'

  const settle = (style) => {
    const el = ref.current
    if (!el) return
    el.style.transition = 'transform 420ms cubic-bezier(0.22, 1.2, 0.36, 1), opacity 260ms ease'
    Object.assign(el.style, style)
  }

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' || e.target.closest('button')) return
    drag.current = { x: e.clientX, y: e.clientY }
    if (ref.current) ref.current.style.transition = 'none'
    onPause(toast.id)
  }
  const onPointerMove = (e) => {
    if (!drag.current || !ref.current) return
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    // The way out is up at the top of a phone, down at the bottom of a desktop.
    const away = atTop ? Math.min(dy, 0) : Math.max(dy, 0)
    const back = atTop ? Math.max(dy, 0) : Math.min(dy, 0)
    const y = away + resist(back)
    ref.current.style.transform = `translate(${dx}px, ${y}px)`
    ref.current.style.opacity = String(Math.max(1 - Math.max(Math.abs(dx), Math.abs(away)) / 140, 0.25))
  }
  const onPointerUp = (e) => {
    if (!drag.current || !ref.current) return
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    drag.current = null
    const out = atTop ? dy < -SWIPE : dy > SWIPE
    if (Math.abs(dx) > SWIPE * 2 || out) {
      const off = Math.abs(dx) > SWIPE * 2 ? `translateX(${Math.sign(dx) * 120}%)` : `translateY(${atTop ? -140 : 140}%)`
      // Flung out by hand, so it finishes the throw rather than replaying the
      // exit animation from where it started.
      ref.current.dataset.swiped = 'true'
      settle({ transform: off, opacity: '0' })
      onDismiss(toast.id)
      return
    }
    settle({ transform: '', opacity: '' })
    onResume(toast.id)
  }

  return (
    <div
      ref={ref}
      className="bfh-toast"
      data-type={toast.type}
      data-leaving={toast.leaving || undefined}
      role={toast.type === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => onPause(toast.id)}
      onMouseLeave={() => onResume(toast.id)}
      onFocus={() => onPause(toast.id)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) onResume(toast.id)
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <span className="bfh-toast__badge" aria-hidden="true">
        <Icon size={15} stroke={2.4} />
      </span>
      <span className="bfh-toast__message" onClick={tapToClose ? () => onDismiss(toast.id) : undefined}>
        {toast.message}
      </span>

      {toast.actionLabel && (
        <button type="button" className="bfh-toast__action" onClick={() => onAction(toast.id)}>
          {toast.actionLabel}
        </button>
      )}
      {closable && (
        <button type="button" className="bfh-toast__close" aria-label="Dismiss" onClick={() => onDismiss(toast.id)}>
          <IconX size={13} stroke={2.4} aria-hidden="true" />
        </button>
      )}

      {toast.type === 'undo' && toast.duration && (
        <span
          className="bfh-toast__countdown"
          aria-hidden="true"
          style={{ animationDuration: `${toast.duration}ms`, animationPlayState: toast.paused ? 'paused' : 'running' }}
        />
      )}
    </div>
  )
}

/**
 * Where toasts appear: dropped in from the top on a phone, like a system
 * banner, and bottom-right above the assistant bubble on larger screens.
 * Above every modal, so a save made from a sheet is confirmed as it closes.
 */
export default function ToastViewport({ toasts, ...handlers }) {
  const atTop = useIsMobile()
  return (
    <div className="bfh-toasts" data-edge={atTop ? 'top' : 'bottom'} aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} atTop={atTop} {...handlers} />
      ))}
    </div>
  )
}
