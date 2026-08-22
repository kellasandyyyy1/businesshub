import { IconDotsVertical, IconInfoCircle, IconPlus, IconSettings } from '@tabler/icons-react'
import { NavLink, useNavigate } from 'react-router-dom'

import { NAV_GROUPS } from '../config/nav'
import useAlerts from '../hooks/useAlerts'
import useSettings from '../hooks/useSettings'

/** "Broadheader" → "BR", "Reyes Creative" → "RC". */
function initials(name) {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function NavItem({ item, badgeCount, onNavigate }) {
  const Icon = item.icon
  const showBadge = badgeCount > 0

  return (
    <NavLink
      to={item.to}
      end={item.end}
      className="bfh-nav__item"
      data-badge={showBadge ? 'true' : undefined}
      data-label={item.label}
      title={item.label}
      onClick={onNavigate}
    >
      <span className="bfh-nav__dot" aria-hidden="true" />
      <Icon className="bfh-nav__icon" size={16} stroke={1.5} aria-hidden="true" />
      <span className="bfh-nav__text">{item.label}</span>
      {showBadge && (
        <span className="bfh-badge" aria-label={`${badgeCount} overdue`}>
          {badgeCount}
        </span>
      )}
    </NavLink>
  )
}

export default function Sidebar({ collapsed, open, onNavigate, onAddTransaction }) {
  const navigate = useNavigate()
  const settings = useSettings()
  const alerts = useAlerts()

  return (
    <aside
      className="bfh-sidebar"
      data-collapsed={collapsed ? 'true' : 'false'}
      data-open={open ? 'true' : 'false'}
      aria-label="Primary"
    >
      <div className="bfh-sidebar__section bfh-sidebar__head">
        {/* The wordmark already reads "Business Finance Hub", so the tagline
            that used to sit under it would only say it a second time. The short
            mark stands in on the 56px rail, where a 220×56 lockup could only be
            squashed to something unreadable. */}
        <div className="bfh-logo">
          <img
            className="bfh-logo__mark"
            src="/badge-72.png"
            alt="Business Finance Hub"
            width="220"
            height="56"
          />
          <span className="bfh-logo__short">BFH</span>
        </div>

        <button
          type="button"
          className="bfh-btn-primary mt-3"
          onClick={onAddTransaction}
          title="Add transaction"
        >
          <IconPlus size={14} stroke={1.75} aria-hidden="true" />
          <span>Add transaction</span>
        </button>
      </div>

      <nav className="bfh-nav">
        {NAV_GROUPS.map((group) => (
          <div className="bfh-nav__group" key={group.label}>
            <div className="bfh-micro bfh-nav__label">{group.label}</div>
            {group.items.map((item) => (
              <NavItem
                key={item.to}
                item={item}
                badgeCount={item.badge ? alerts[item.badge] : 0}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}

        <div className="bfh-nav__divider" role="separator" />

        <NavItem
          item={{ to: '/how-it-works', label: 'How it works', icon: IconInfoCircle }}
          badgeCount={0}
          onNavigate={onNavigate}
        />

        <NavItem
          item={{ to: '/settings', label: 'Settings', icon: IconSettings }}
          badgeCount={0}
          onNavigate={onNavigate}
        />
      </nav>

      <div className="bfh-sidebar__foot">
        {/* The card describes the business, so it opens where the business is
            edited rather than sitting there as decoration. */}
        <button
          type="button"
          className="bfh-profile"
          title={`${settings.businessName} — open business settings`}
          aria-label={`${settings.businessName}, open business settings`}
          onClick={() => {
            onNavigate?.()
            navigate('/settings?section=business')
          }}
        >
          <span className="bfh-avatar" aria-hidden="true">
            {(settings.businessAvatar ?? settings.logo) ? (
              <img src={settings.businessAvatar ?? settings.logo} alt="" className="bfh-avatar__img" />
            ) : (
              initials(settings.businessName)
            )}
          </span>
          <span className="bfh-profile__meta">
            <span className="bfh-profile__name">{settings.businessName}</span>
            <span className="bfh-micro">Owner</span>
          </span>
          <IconDotsVertical
            className="bfh-profile__more"
            size={14}
            stroke={1.5}
            aria-hidden="true"
          />
        </button>
      </div>
    </aside>
  )
}
