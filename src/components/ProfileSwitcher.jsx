import { IconBuilding, IconUser } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'

import { PROFILE_HOME } from '../config/nav'
import { useProfile } from '../context/ProfileContext'

const OPTIONS = [
  { id: 'business', label: 'Business', sub: 'Finance Hub', Icon: IconBuilding },
  { id: 'personal', label: 'Personal', sub: 'Finance', Icon: IconUser },
]

/**
 * Which set of books the sidebar is showing.
 *
 * Both options stay on screen rather than hiding behind a dropdown: there are
 * only two, and seeing the one you are not in is what makes it obvious the
 * other exists at all.
 *
 * Collapsed to the 56px rail the labels go and the two icons stack, which the
 * stylesheet handles — the markup is the same either way so nothing remounts
 * when the sidebar narrows.
 */
export default function ProfileSwitcher({ onNavigate }) {
  const { profile, switchProfile } = useProfile()
  const navigate = useNavigate()

  const choose = (id) => {
    if (id === profile) return
    switchProfile(id)
    // The current page belongs to the profile being left, so the switch lands
    // on the other one's home rather than a route it does not own.
    navigate(PROFILE_HOME[id])
    onNavigate?.()
  }

  return (
    <div className="bfh-profileswitch" role="group" aria-label="Active profile">
      {OPTIONS.map(({ id, label, sub, Icon }) => {
        const active = profile === id
        return (
          <button
            key={id}
            type="button"
            className="bfh-profileswitch__option"
            data-active={active ? 'true' : 'false'}
            aria-pressed={active}
            title={`${label} — ${sub}`}
            onClick={() => choose(id)}
          >
            <span className="bfh-profileswitch__icon" aria-hidden="true">
              <Icon size={14} stroke={1.5} />
            </span>
            <span className="bfh-profileswitch__text">
              <span className="bfh-profileswitch__label">{label}</span>
              <span className="bfh-profileswitch__sub">{sub}</span>
            </span>
            {active && <span className="bfh-profileswitch__dot" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}
