import { useEffect, useState } from 'react'

import { useProfile } from '../../context/ProfileContext'
import { useToast } from '../../context/ToastContext'
import { putSetting } from '../../db/db'
import {
  isPushConfigured,
  isPushEnabled,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from '../../lib/push'

/**
 * These drive the bell indicator and the dashboard's attention list. The brief
 * named the section without specifying its contents, so the toggles map to the
 * alerts the app already computes rather than inventing new ones.
 */
const TOGGLES = [
  {
    key: 'notifyOverdue',
    label: 'Overdue invoices',
    note: 'Count an invoice as needing attention once it passes its due date.',
    fallback: true,
  },
  {
    key: 'notifyBudgets',
    label: 'Budget warnings',
    note: 'Flag a budget once spending passes 80% of its limit.',
    fallback: true,
  },
  {
    key: 'notifyPending',
    label: 'Uncleared transactions',
    note: 'Remind me about entries still marked pending.',
    fallback: true,
  },
  {
    key: 'notifyWeekly',
    label: 'Weekly summary',
    note: 'Show a recap of the week the first time the app opens on a Monday.',
    fallback: false,
  },
]

/* Only offered to someone who keeps personal books; there is nothing behind
   these switches for a business-only setup to turn off. */
const PERSONAL_TOGGLES = [
  {
    key: 'notifyGoalDeadline',
    label: 'Goal deadlines',
    note: 'Remind me when a savings goal is due within two weeks.',
    fallback: true,
  },
  {
    key: 'notifyGoalReached',
    label: 'Goal reached',
    note: 'Say something when I hit a savings goal.',
    fallback: true,
  },
  {
    key: 'notifySavingsRate',
    label: 'Savings rate drop',
    note: 'Tell me when I keep under 10% of what came in, after a much better month.',
    fallback: true,
  },
  {
    key: 'notifySpendingSpike',
    label: 'Spending spikes',
    note: 'Flag a category running at twice its usual weekly spend.',
    fallback: true,
  },
  {
    key: 'notifyNetWorth',
    label: 'Net worth milestones',
    note: 'Mark it when my net worth passes a round number.',
    fallback: true,
  },
]

const GENERAL_TOGGLES = [
  {
    key: 'voiceInput',
    label: 'Voice input',
    // Says where the audio goes, because this is the one part of the app that
    // leaves the device without the reader having typed anything.
    note: 'Show a microphone in the assistant. Your browser transcribes what you say, which on most browsers means sending the audio to its maker.',
    fallback: true,
  },
]

/* Shown only after someone actually tries the toggle, never while the section
   is sitting idle, and worded for the person reading it rather than for
   whoever wrote the fetch. */
const FAILURE_NOTE = {
  denied: 'Notifications are blocked for this site in your browser settings.',
  server: 'Push server unavailable. Try again later.',
  unsupported: 'This browser cannot receive push notifications.',
  unconfigured: 'Push notifications are not set up for this build.',
}

function SwitchList({ toggles, settings }) {
  return (
    <ul className="bfh-catlist">
      {toggles.map((toggle) => {
        const value = settings[toggle.key] ?? toggle.fallback
        return (
          <li key={toggle.key} className="bfh-catrow bfh-catrow--stacked">
            <span className="bfh-catrow__body">
              <span className="bfh-catrow__name">{toggle.label}</span>
              <span className="bfh-settings__note">{toggle.note}</span>
            </span>

            <button
              type="button"
              className="bfh-switch"
              role="switch"
              aria-checked={value}
              aria-label={toggle.label}
              onClick={() => putSetting(toggle.key, !value)}
            >
              <span className="bfh-switch__knob" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export default function NotificationsSection({ settings }) {
  const { activeMode } = useProfile()
  // Business-only setups keep the flat list they have always had; the headings
  // only earn their space once there are two groups to tell apart.
  const showPersonal = activeMode === 'personal' || activeMode === 'both'

  const [pushOn, setPushOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState(null)
  const toast = useToast()

  // localStorage is not available during the first render on every host. No
  // failure is surfaced here: an untouched toggle has nothing to report yet.
  useEffect(() => {
    setPushOn(isPushEnabled())
  }, [])

  // A build with no backend URL, or a browser without the APIs, has no honest
  // toggle to offer, so it says "Not supported" rather than a dead switch.
  const available = isPushSupported() && isPushConfigured()

  const togglePush = async () => {
    setBusy(true)
    setFailure(null)
    if (pushOn) {
      await unsubscribeFromPush()
      setPushOn(false)
      toast.info('Push notifications off')
    } else {
      const result = await subscribeToPush()
      if (result.ok) {
        setPushOn(true)
        toast.info('Push notifications on')
      } else if (result.reason === 'server') {
        // Nothing the user can fix here — say so and let it go.
        toast.error("Couldn't reach the notification server. Try again later.")
      } else {
        // Denied or unsupported needs explaining, so it stays beside the switch.
        setFailure(result.reason)
      }
    }
    setBusy(false)
  }

  return (
    <div className="bfh-settings__body">
      <h2 className="bfh-panel__title">Notifications</h2>
      <p className="bfh-settings__note">
        Everything is calculated on this device. Turning push on registers this browser with the
        delivery server — it stores nothing but that registration.
      </p>

      {showPersonal && <span className="bfh-micro bfh-settings__grouplabel">Business</span>}
      <SwitchList toggles={TOGGLES} settings={settings} />

      {showPersonal && (
        <>
          <span className="bfh-micro bfh-settings__grouplabel">Personal</span>
          <SwitchList toggles={PERSONAL_TOGGLES} settings={settings} />
        </>
      )}

      <span className="bfh-micro bfh-settings__grouplabel">Assistant</span>
      <SwitchList toggles={GENERAL_TOGGLES} settings={settings} />

      <section className="bfh-push">
        <div className="bfh-catrow bfh-catrow--stacked bfh-push__row">
          <span className="bfh-catrow__body">
            <span className="bfh-catrow__name">Push notifications</span>
            <span className="bfh-settings__note">Get alerts when you&rsquo;re away from the app.</span>
          </span>

          {available ? (
            <button
              type="button"
              className="bfh-switch"
              role="switch"
              aria-checked={pushOn}
              aria-label="Push notifications"
              disabled={busy}
              onClick={togglePush}
            >
              <span className="bfh-switch__knob" />
            </button>
          ) : (
            <span className="bfh-micro bfh-push__unsupported">Not supported</span>
          )}
        </div>

        {failure && <p className="bfh-push__failure">{FAILURE_NOTE[failure]}</p>}
      </section>
    </div>
  )
}
