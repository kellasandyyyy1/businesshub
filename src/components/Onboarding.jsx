import { IconKeyboard, IconMessageCircle, IconPlus, IconSparkles } from '@tabler/icons-react'
import { useState } from 'react'

import AIAssistant from './ai/AIAssistant'
import { useAssistantActions } from '../context/AssistantActionsContext'
import { putSetting } from '../db/db'
import { formatAmount } from '../lib/format'
import { useIsMobile } from '../hooks/useMediaQuery'
import useFocusTrap from '../hooks/useFocusTrap'

const CURRENCIES = [
  { code: 'PHP', symbol: '₱', locale: 'en-PH' },
  { code: 'USD', symbol: '$', locale: 'en-US' },
  { code: 'SGD', symbol: 'S$', locale: 'en-SG' },
  { code: 'AUD', symbol: 'A$', locale: 'en-AU' },
]

const STEPS = ['Business', 'Cash', 'Assistant', 'Ready']

/** What the assistant is good for, in the order someone would meet it. */
const ASSISTANT_FEATURES = [
  {
    icon: IconMessageCircle,
    label: 'Ask in plain English or Filipino',
    sub: 'How much did I spend this month? Magkano na ang gastos ko?',
  },
  {
    icon: IconPlus,
    label: 'Add transactions by typing',
    sub: "Say 'log 3000 Meralco bill' — it fills the form for you.",
  },
  {
    icon: IconSparkles,
    label: 'Get insights on your finances',
    sub: 'Ask about runway, top expenses, overdue invoices, and more.',
  },
]

/** Mac reads Cmd, everything else reads Ctrl. */
const shortcutLabel = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '')
    ? 'Cmd+K'
    : 'Ctrl+K'

/**
 * First run, before any data exists. A full page rather than a modal — there
 * is nothing behind it worth showing yet.
 */
export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('PHP')
  const [balance, setBalance] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const trapRef = useFocusTrap()
  const isMobile = useIsMobile()
  const { assistantOpen, openAssistant, closeAssistant } = useAssistantActions()

  const chosen = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0]

  const saveBusiness = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Enter a business name')
      return
    }
    setError(null)
    await Promise.all([
      putSetting('businessName', name.trim()),
      putSetting('currency', chosen.code),
      putSetting('symbol', chosen.symbol),
      putSetting('locale', chosen.locale),
    ])
    setStep(1)
  }

  const saveBalance = async (e) => {
    e.preventDefault()
    if (balance !== '') await putSetting('openingBalance', Number(balance) || 0)
    setStep(2)
  }

  const finish = async () => {
    setSaving(true)
    // Marks the setup as done so this never reappears on a later load.
    await putSetting('onboarded', true)
    onDone()
  }

  return (
    <div className="bfh-onboard" role="dialog" aria-modal="true" aria-label="Set up your business">
      <div className="bfh-onboard__inner" ref={trapRef}>
        <header className="bfh-onboard__head">
          {/* The same mark the installed app and the browser tab carry, so the
              first screen already looks like the icon they tapped. Decorative:
              the wordmark underneath says the name. */}
          <img
            className="bfh-onboard__logo"
            src="/favicon.svg"
            alt=""
            width="140"
            height="140"
          />
          <div className="bfh-logo">Dual</div>
          <div className="bfh-micro bfh-logo__tag">Dual Finance</div>
        </header>

        <ol className="bfh-onboard__steps">
          {STEPS.map((label, index) => (
            <li key={label} className="bfh-micro" data-state={index === step ? 'current' : index < step ? 'done' : 'todo'}>
              {String(index + 1).padStart(2, '0')} — {label}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <form className="bfh-onboard__panel" onSubmit={saveBusiness}>
            <h1 className="bfh-onboard__title">Let&apos;s set up your business.</h1>
            <p className="bfh-onboard__note">
              Two questions, then you are in. Everything stays on this device.
            </p>

            <label className="bfh-formfield" htmlFor="onboard-name">
              <span className="bfh-micro">Business name</span>
              <input
                id="onboard-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your business"
                autoFocus
              />
              {error && <span className="bfh-formerror">{error}</span>}
            </label>

            <label className="bfh-formfield" htmlFor="onboard-currency">
              <span className="bfh-micro">Currency</span>
              <select
                id="onboard-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.symbol}
                  </option>
                ))}
              </select>
            </label>

            <div className="bfh-onboard__actions">
              <button type="submit" className="bfh-btn-primary bfh-btn-primary--inline">
                Continue
              </button>
            </div>
          </form>
        )}

        {step === 1 && (
          <form className="bfh-onboard__panel" onSubmit={saveBalance}>
            <h1 className="bfh-onboard__title">What&apos;s your current cash balance?</h1>
            <p className="bfh-onboard__note">
              Used as the starting point for cash flow. You can set it later instead.
            </p>

            <label className="bfh-formfield" htmlFor="onboard-balance">
              <span className="bfh-micro">Opening cash balance</span>
              <input
                id="onboard-balance"
                type="number"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </label>

            <div className="bfh-onboard__actions">
              <button type="button" className="bfh-btn-ghost" onClick={() => setStep(2)}>
                Skip
              </button>
              <button type="submit" className="bfh-btn-primary bfh-btn-primary--inline">
                Continue
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="bfh-onboard__panel">
            <span className="bfh-micro">AI assistant</span>
            <h1 className="bfh-onboard__title bfh-onboard__title--tight">Ask Dual anything.</h1>
            <p className="bfh-onboard__note bfh-onboard__note--wide">
              Dual has a built-in AI that knows your finances. Ask it questions, get instant answers,
              or just say &lsquo;add 500 for food&rsquo; and it opens the form for you.
            </p>

            <ul className="bfh-onboard__features">
              {ASSISTANT_FEATURES.map((feature) => {
                const Icon = feature.icon
                return (
                  <li key={feature.label} className="bfh-onboard__feature">
                    <span className="bfh-onboard__featureicon" aria-hidden="true">
                      <Icon size={14} stroke={1.5} />
                    </span>
                    <span className="bfh-onboard__featurebody">
                      <span className="bfh-onboard__featurelabel">{feature.label}</span>
                      <span className="bfh-onboard__featuresub">{feature.sub}</span>
                    </span>
                  </li>
                )
              })}
            </ul>

            <p className="bfh-onboard__shortcut">
              <IconKeyboard size={13} stroke={1.5} aria-hidden="true" />
              <span>Open anytime with </span>
              <kbd className="bfh-onboard__kbd">{shortcutLabel()}</kbd>
              <span> or the </span>
              <IconMessageCircle size={12} stroke={1.5} aria-hidden="true" />
              <span> button.</span>
            </p>

            {/* Trying it does not advance anything — the panel closes back to
                this step so the flow carries on where it left off. */}
            {!isMobile && (
              <button type="button" className="bfh-onboard__try" onClick={openAssistant}>
                Try the assistant →
              </button>
            )}

            <div className="bfh-onboard__actions">
              <button
                type="button"
                className="bfh-btn-primary bfh-btn-primary--inline"
                onClick={() => setStep(3)}
              >
                Continue →
              </button>
              <button type="button" className="bfh-btn-ghost" onClick={() => setStep(3)}>
                Skip
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bfh-onboard__panel">
            <h1 className="bfh-onboard__title">You&apos;re ready.</h1>
            <p className="bfh-onboard__note">Here is what was set. All of it is editable in Settings.</p>

            <dl className="bfh-onboard__summary">
              <div>
                <dt className="bfh-micro">Business</dt>
                <dd>{name.trim() || '—'}</dd>
              </div>
              <div>
                <dt className="bfh-micro">Currency</dt>
                <dd>
                  {chosen.code} · {chosen.symbol}
                </dd>
              </div>
              <div>
                <dt className="bfh-micro">Opening balance</dt>
                <dd>{balance === '' ? 'Not set' : formatAmount(Number(balance) || 0, chosen.symbol)}</dd>
              </div>
            </dl>

            <div className="bfh-onboard__actions">
              <button
                type="button"
                className="bfh-btn-primary bfh-btn-primary--inline"
                onClick={finish}
                disabled={saving}
              >
                Go to dashboard
              </button>
            </div>
          </div>
        )}
      </div>

      {assistantOpen && <AIAssistant onClose={closeAssistant} />}
    </div>
  )
}
