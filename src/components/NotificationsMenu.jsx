import { IconBellOff, IconChevronRight } from '@tabler/icons-react'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import { useNotifications } from '../hooks/useNotifications'
import { notificationTone } from '../lib/signal'

/**
 * What currently needs attention, hung under the bell.
 *
 * The same conditions that drive push notifications drive this list, so the
 * bell and the phone never disagree. When there is nothing, it says so in as
 * many words rather than opening an empty box.
 */
export default function NotificationsMenu({ onClose }) {
  const items = useNotifications()
  const navigate = useNavigate()
  const panelRef = useRef(null)

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    // A click anywhere else dismisses it, including on the bell itself, which
    // is why the bell's own handler only ever toggles.
    const onPointerDown = (e) => {
      if (!panelRef.current?.contains(e.target) && !e.target.closest?.('[data-bell]')) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [onClose])

  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  const open = (link) => {
    navigate(link)
    onClose()
  }

  return (
    <div
      className="bfh-notifmenu"
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-label="Notifications"
    >
      <header className="bfh-notifmenu__head">
        <span className="bfh-notifmenu__title">Notifications</span>
        {items.length > 0 && <span className="bfh-micro">{items.length}</span>}
      </header>

      {items.length === 0 ? (
        <div className="bfh-notifmenu__empty">
          <IconBellOff size={22} stroke={1.5} aria-hidden="true" />
          <p className="bfh-notifmenu__emptyhead">No notifications</p>
          <p className="bfh-notifmenu__emptybody">
            Nothing needs your attention right now. Overdue invoices, budget warnings and low cash
            will show up here.
          </p>
        </div>
      ) : (
        <ul className="bfh-notifmenu__list">
          {items.map((item) => (
            <li key={item.type}>
              <button type="button" className="bfh-notifmenu__item" onClick={() => open(item.link)}>
                {notificationTone(item) && (
                  <span className={`dot dot-${notificationTone(item)}`} aria-hidden="true" />
                )}
                <span className="bfh-notifmenu__body">
                  <span className="bfh-notifmenu__itemtitle">{item.title}</span>
                  <span className="bfh-notifmenu__itembody">{item.body}</span>
                </span>
                <IconChevronRight size={14} stroke={1.5} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
