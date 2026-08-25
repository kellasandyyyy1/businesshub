import {
  IconDotsVertical,
  IconInfoCircle,
  IconLayoutGrid,
  IconPlus,
  IconSettings,
} from '@tabler/icons-react'
import { NavLink, useNavigate } from 'react-router-dom'

import { navGroupsFor } from '../config/nav'
import { useProfile } from '../context/ProfileContext'
import useAlerts from '../hooks/useAlerts'
import useSettings from '../hooks/useSettings'
import ProfileSwitcher from './ProfileSwitcher'

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
  const { profile } = useProfile()
  const groups = navGroupsFor(profile)

  return (
    <aside
      className="bfh-sidebar"
      data-collapsed={collapsed ? 'true' : 'false'}
      data-open={open ? 'true' : 'false'}
      aria-label="Primary"
    >
      <div className="bfh-sidebar__section bfh-sidebar__head">
        {/* The wordmark already reads "Dual Finance", so the tagline
            that used to sit under it would only say it a second time. The short
            mark stands in on the 56px rail, where a 220×56 lockup could only be
            squashed to something unreadable. */}
        {/* Set rather than drawn. The old lockup was a bitmap with the
            previous name baked into it, which no rename can reach — and text
            costs nothing, scales to any screen and inverts with the theme on
            its own. The favicon mark carries the shape. */}
        <div className="bfh-logo">
          <img
            className="bfh-logo__mark"
            src="/favicon.svg"
            alt=""
            width="140"
            height="140"
          />
          <span className="bfh-logo__word">
            <span className="bfh-logo__name">Dual</span>
            <span className="bfh-logo__tag">Finance</span>
          </span>
          <span className="bfh-logo__short">Dual</span>
        </div>

        <ProfileSwitcher onNavigate={onNavigate} />

        {/* Names the choice just made above it, so the switcher reads as a
            control and this as its current state. */}
        <span className="bfh-micro bfh-viewing">
          Viewing {profile === 'personal' ? 'Personal' : 'Business'}
        </span>

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
        {/* Above the groups and outside the keyed block: it belongs to neither
            profile, so it neither changes nor fades when one is swapped. */}
        <NavLink to="/overview" className="bfh-nav__item bfh-nav__overview" title="Overview" onClick={onNavigate}>
          <span className="bfh-nav__dot" aria-hidden="true" />
          <IconLayoutGrid className="bfh-nav__icon" size={16} stroke={1.5} aria-hidden="true" />
          <span className="bfh-nav__text">Overview</span>
        </NavLink>

        {/* Keyed on the profile so React replaces the whole block on a switch
            rather than reconciling row by row, which is what lets the fade
            run and what stops a stale badge riding across. */}
        <div className="bfh-nav__profile" key={profile}>
          {groups.map((group) => (
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
        </div>

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
