import { IconBuilding, IconChevronRight, IconUser } from '@tabler/icons-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'

import { PROFILE_HOME } from '../config/nav'
import { useProfile } from '../context/ProfileContext'
import { useToast } from '../context/ToastContext'
import useFocusTrap from '../hooks/useFocusTrap'

const OPTIONS = [
  {
    id: 'business',
    label: 'Business',
    description: 'Revenue, invoices, expenses, clients',
    Icon: IconBuilding,
  },
  {
    id: 'personal',
    label: 'Personal',
    description: 'Spending, goals, savings, net worth',
    Icon: IconUser,
  },
]

/**
 * The mode picker, on a phone.
 *
 * The switcher itself lives in the sidebar, which on a phone is a drawer behind
 * the hamburger, findable only if you already know it is there. This puts the
 * same choice on the thing that already names the mode: the greeting.
 *
 * Portalled, because the sheet has to sit above the bottom bar and the floating
 * button, and its parent is inside a stacking context that would trap it.
 */
export default function ModeSheet({ onClose }) {
  const toast = useToast()
  const { profile, switchProfile } = useProfile()
  const navigate = useNavigate()
  const trapRef = useFocusTrap()

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const choose = (id) => {
    // Tapping the mode you are already in is a way of dismissing the sheet,
    // not a request to reload the page you are looking at.
    if (id !== profile) {
      switchProfile(id)
      navigate(PROFILE_HOME[id])
      toast.info(id === 'personal' ? 'Switched to Personal' : 'Switched to Business')
    }
    onClose()
  }

  return createPortal(
    <div className="bfh-modesheet" role="dialog" aria-modal="true" aria-label="Switch mode">
      <button type="button" className="bfh-modesheet__scrim" aria-label="Close" onClick={onClose} />

      <div className="bfh-modesheet__panel" ref={trapRef}>
        <span className="bfh-modesheet__grip" aria-hidden="true" />
        <span className="bfh-micro bfh-modesheet__label">Switch mode</span>

        <div className="bfh-modesheet__options">
          {OPTIONS.map(({ id, label, description, Icon }) => {
            const active = profile === id
            return (
              <button
                key={id}
                type="button"
                className="bfh-modeopt"
                data-active={active ? 'true' : 'false'}
                aria-current={active ? 'true' : undefined}
                onClick={() => choose(id)}
              >
                <span className="bfh-modeopt__icon" aria-hidden="true">
                  <Icon size={20} stroke={1.5} />
                </span>

                <span className="bfh-modeopt__body">
                  <span className="bfh-modeopt__name">{label}</span>
                  <span className="bfh-modeopt__desc">{description}</span>
                </span>

                {active ? (
                  <span className="bfh-modeopt__now">● Now</span>
                ) : (
                  <IconChevronRight
                    size={14}
                    stroke={1.5}
                    aria-hidden="true"
                    className="bfh-modeopt__chevron"
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
