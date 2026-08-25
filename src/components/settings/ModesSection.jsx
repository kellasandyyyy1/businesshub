import {
  IconBuilding,
  IconCheck,
  IconInfoCircle,
  IconLayoutColumns,
  IconUser,
} from '@tabler/icons-react'
import { useState } from 'react'

import { useProfile } from '../../context/ProfileContext'
import { putSetting } from '../../db/db'
import { useIsMobile } from '../../hooks/useMediaQuery'
import useSettings from '../../hooks/useSettings'

const OPTIONS = [
  {
    id: 'business',
    Icon: IconBuilding,
    title: 'Business',
    body: 'Revenue, invoices, expenses, and clients.',
  },
  {
    id: 'personal',
    Icon: IconUser,
    title: 'Personal',
    body: 'Spending, savings goals, and net worth.',
  },
  {
    id: 'both',
    Icon: IconLayoutColumns,
    title: 'Both',
    body: 'Switch between the two in one app.',
  },
]

const NAMES = { business: 'Business', personal: 'Personal' }

/**
 * What the change will do, said before it happens.
 *
 * Turning a side off looks like deleting it, so the wording leads with what
 * survives. Adding one leads with what stays untouched, for the same reason.
 */
function describe(from, to) {
  if (to === 'both') {
    const added = from === 'personal' ? 'Business' : 'Personal'
    const kept = from === 'personal' ? 'personal' : 'business'
    return {
      title: `You're adding ${added} finance.`,
      body: `Your ${kept} data stays exactly as it is. You'll just have a ${added} section added to the app.`,
    }
  }

  const hidden = to === 'personal' ? 'Business' : 'Personal'
  return {
    title: `${hidden} finance will be hidden.`,
    body: 'Nothing is deleted. Switch back anytime to restore it.',
  }
}

/** The name the newly-enabled side needs before it can greet anyone. */
function missingNameFor(mode, settings) {
  const needsBusiness = mode !== 'personal' && !(settings.businessName ?? '').trim()
  const needsUser = mode !== 'business' && !(settings.userName ?? '').trim()
  if (needsBusiness) return 'businessName'
  if (needsUser) return 'userName'
  return null
}

/**
 * Which sides of the app are in use.
 *
 * Nothing is written until the change is confirmed: the cards read as a
 * setting, and a setting that applies on touch gives no chance to read what it
 * is about to do.
 */
export default function ModesSection() {
  const { activeMode } = useProfile()
  const settings = useSettings()
  const isMobile = useIsMobile()

  const [pending, setPending] = useState(null)
  const [asking, setAsking] = useState(null) // null | 'businessName' | 'userName'
  const [nameValue, setNameValue] = useState('')
  const [done, setDone] = useState(false)

  const confirm = async () => {
    const next = pending
    setPending(null)
    await putSetting('activeMode', next)

    const missing = missingNameFor(next, settings)
    if (missing) {
      setAsking(missing)
      setNameValue('')
      setDone(false)
    } else {
      setDone(true)
    }
  }

  const saveName = async (e) => {
    e.preventDefault()
    await putSetting(asking, nameValue.trim())
    setAsking(null)
    setDone(true)
  }

  const selected = pending ?? activeMode
  const change = pending && pending !== activeMode ? describe(activeMode, pending) : null

  return (
    <section className="bfh-modesetting">
      <h3 className="bfh-datablock__title">Active modes</h3>
      <p className="bfh-modesetting__lede">
        Choose what Dual tracks for you. Turning a mode off hides it — nothing is deleted, and
        it all comes back if you turn it on again.
      </p>

      <div className="bfh-modepick" role="radiogroup" aria-label="Active modes">
        {OPTIONS.map(({ id, Icon, title, body }) => {
          const isSelected = selected === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className="bfh-modepick__card"
              data-selected={isSelected ? 'true' : 'false'}
              onClick={() => {
                setDone(false)
                setPending(id === activeMode ? null : id)
              }}
            >
              <span className="bfh-modepick__circle" aria-hidden="true">
                {isSelected && <IconCheck size={10} stroke={2.5} />}
              </span>
              <Icon size={18} stroke={1.5} aria-hidden="true" className="bfh-modepick__icon" />
              <span className="bfh-modepick__body">
                <span className="bfh-modepick__title">{title}</span>
                <span className="bfh-modepick__desc">{body}</span>
              </span>
            </button>
          )
        })}
      </div>

      {change && (
        <div className="bfh-modeconfirm">
          <span className="bfh-modeconfirm__head">
            <IconInfoCircle size={13} stroke={1.5} aria-hidden="true" />
            {change.title}
          </span>
          <span className="bfh-modeconfirm__body">{change.body}</span>
          <span className="bfh-modeconfirm__actions">
            <button type="button" className="bfh-btn-primary bfh-btn-primary--inline" onClick={confirm}>
              Confirm
            </button>
            <button type="button" className="bfh-micro bfh-link" onClick={() => setPending(null)}>
              Cancel
            </button>
          </span>
        </div>
      )}

      {asking && (
        <form className="bfh-modeconfirm" onSubmit={saveName}>
          <span className="bfh-modeconfirm__head">
            {asking === 'businessName' ? 'What is your business called?' : "What's your name?"}
          </span>
          <span className="bfh-modeconfirm__body">
            {asking === 'businessName'
              ? 'Used on invoices, reports, and the business greeting.'
              : 'This is how Dual will greet you in personal mode.'}
          </span>
          <label className="bfh-formfield">
            <input
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              placeholder={asking === 'businessName' ? 'Your business name' : 'Your first name'}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
          </label>
          <span className="bfh-modeconfirm__actions">
            <button type="submit" className="bfh-btn-primary bfh-btn-primary--inline">
              Save
            </button>
            <button
              type="button"
              className="bfh-micro bfh-link"
              onClick={() => {
                setAsking(null)
                setDone(true)
              }}
            >
              Skip
            </button>
          </span>
        </form>
      )}

      {done && !asking && (
        <p className="bfh-modedone">
          <IconCheck size={14} stroke={1.75} aria-hidden="true" />
          {activeMode === 'both'
            ? `Both modes are now active. Switch between them ${
                isMobile ? 'by tapping your name at the top' : 'from the switcher at the top of the sidebar'
              }.`
            : `Only ${NAMES[activeMode]} is showing now. Turn the other back on here whenever you want it.`}
        </p>
      )}
    </section>
  )
}
