import {
  IconBuilding,
  IconCheck,
  IconKeyboard,
  IconLayoutColumns,
  IconMessageCircle,
  IconPlus,
  IconSparkles,
  IconUser,
} from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import AIAssistant from './ai/AIAssistant'
import AnimatedLogo from './AnimatedLogo'
import { useAssistantActions } from '../context/AssistantActionsContext'
import { useProfile } from '../context/ProfileContext'
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

const MODE_OPTIONS = [
  {
    id: 'business',
    Icon: IconBuilding,
    title: 'Business',
    body: 'Track revenue, invoices, expenses, and clients for your business or freelance work.',
  },
  {
    id: 'personal',
    Icon: IconUser,
    title: 'Personal',
    body: 'Track your spending, savings goals, and personal net worth.',
  },
  {
    id: 'both',
    Icon: IconLayoutColumns,
    title: 'Both',
    body: 'Switch between business and personal finances in one app.',
    recommended: true,
  },
]

/**
 * The steps each setup actually has.
 *
 * A one-sided setup skips the assistant tour: it is the longest step and the
 * least urgent, and someone who asked for one thing should be asked fewer
 * questions, not the same number.
 */
const stepsFor = (mode) =>
  mode === 'both'
    ? ['Mode', 'Setup', 'Cash', 'Assistant', 'Ready']
    : ['Mode', 'Setup', 'Cash', 'Ready']

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
 *
 * The first question is what the app is for, because the answer decides which
 * of the rest are worth asking. Someone tracking only their own money should
 * never be asked to name a business.
 */
export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0)
  const [mode, setMode] = useState('both')

  const [name, setName] = useState('')
  const [userName, setUserName] = useState('')
  const [currency, setCurrency] = useState('PHP')
  const [balance, setBalance] = useState('')
  const [personalBalance, setPersonalBalance] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const trapRef = useFocusTrap()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const { switchProfile } = useProfile()
  const { assistantOpen, openAssistant, closeAssistant } = useAssistantActions()

  const chosen = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0]
  const steps = stepsFor(mode)
  const needsBusiness = mode !== 'personal'
  const needsUser = mode !== 'business'
  const readyStep = steps.length - 1
  const assistantStep = mode === 'both' ? 3 : -1

  const saveMode = async (e) => {
    e.preventDefault()
    await putSetting('activeMode', mode)
    try {
      localStorage.setItem('dual-onboarding-mode', mode)
    } catch {
      // Remembered in the database either way; this copy is only a convenience.
    }
    setStep(1)
  }

  const saveSetup = async (e) => {
    e.preventDefault()
    if (needsBusiness && !name.trim()) return setError('Business name is required')
    if (needsUser && !userName.trim()) return setError('Your name is required')

    setError(null)
    await Promise.all([
      // A side that was not set up stores an empty name rather than a stale
      // one, so the greeting falls back instead of using something invented.
      putSetting('businessName', needsBusiness ? name.trim() : ''),
      putSetting('userName', needsUser ? userName.trim() : ''),
      putSetting('currency', chosen.code),
      putSetting('symbol', chosen.symbol),
      putSetting('locale', chosen.locale),
    ])
    setStep(2)
    return undefined
  }

  const saveBalance = async (e) => {
    e.preventDefault()
    // openingBalance is the key cash flow reads; a different name here would
    // store the number where nothing looks for it.
    if (needsBusiness && balance !== '') await putSetting('openingBalance', Number(balance) || 0)
    if (needsUser && personalBalance !== '') {
      await putSetting('personalOpeningBalance', Number(personalBalance) || 0)
    }
    setStep(3)
  }

  const finish = async (profile) => {
    setSaving(true)
    await putSetting('onboarded', true)
    switchProfile(profile)
    navigate(profile === 'personal' ? '/personal' : '/')
    onDone()
  }

  const startProfile = mode === 'personal' ? 'personal' : 'business'

  const currencyField = (
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
  )

  return (
    <div className="bfh-onboard" role="dialog" aria-modal="true" aria-label="Set up Dual">
      <div className="bfh-onboard__inner" ref={trapRef}>
        <header className="bfh-onboard__head">
          {/* The one place the mark animates — everywhere else keeps the
              static file. */}
          <AnimatedLogo size={72} />
          <span className="bfh-logo__word">
            <span className="bfh-logo__name">Dual</span>
            <span className="bfh-logo__tag">Dual Finance</span>
          </span>
        </header>

        <ol className="bfh-onboard__steps">
          {steps.map((label, index) => (
            <li
              key={label}
              className="bfh-micro"
              data-state={index === step ? 'current' : index < step ? 'done' : 'todo'}
            >
              {String(index + 1).padStart(2, '0')} — {label}
            </li>
          ))}
        </ol>

        {/* ---- 01 Mode ---- */}
        {step === 0 && (
          <form className="bfh-onboard__panel" onSubmit={saveMode}>
            <h1 className="bfh-onboard__title">What will you use Dual for?</h1>
            <p className="bfh-onboard__note">
              You can always add the other later in Settings.
            </p>

            <div className="bfh-modepick" role="radiogroup" aria-label="What Dual is for">
              {MODE_OPTIONS.map((option) => {
                const { Icon } = option
                const selected = mode === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className="bfh-modepick__card"
                    data-selected={selected ? 'true' : 'false'}
                    onClick={() => setMode(option.id)}
                  >
                    <span className="bfh-modepick__circle" aria-hidden="true">
                      {selected && <IconCheck size={10} stroke={2.5} />}
                    </span>
                    <Icon
                      size={18}
                      stroke={1.5}
                      aria-hidden="true"
                      className="bfh-modepick__icon"
                    />
                    <span className="bfh-modepick__body">
                      <span className="bfh-modepick__title">{option.title}</span>
                      <span className="bfh-modepick__desc">{option.body}</span>
                      {option.recommended && (
                        <span className="bfh-modepick__tag">Recommended</span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="bfh-onboard__actions">
              <button type="submit" className="bfh-btn-primary bfh-btn-primary--inline">
                Continue →
              </button>
            </div>
          </form>
        )}

        {/* ---- 02 Setup ---- */}
        {step === 1 && (
          <form className="bfh-onboard__panel" onSubmit={saveSetup}>
            <h1 className="bfh-onboard__title">
              {mode === 'business' && 'Set up your business.'}
              {mode === 'personal' && 'Set up your personal finances.'}
              {mode === 'both' && "Let's set up both."}
            </h1>
            <p className="bfh-onboard__note">
              {mode === 'business' && "Two things and you're in."}
              {mode === 'personal' && 'Just your name and currency.'}
              {mode === 'both' && "Three fields and you're in."}
            </p>

            {needsUser && (
              <label className="bfh-formfield" htmlFor="onboard-username">
                <span className="bfh-micro">Your name</span>
                <input
                  id="onboard-username"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Your first name"
                  autoFocus
                />
                <span className="bfh-fieldhint">This is how Dual will greet you.</span>
              </label>
            )}

            {needsBusiness && (
              <label className="bfh-formfield" htmlFor="onboard-name">
                <span className="bfh-micro">Business name</span>
                <input
                  id="onboard-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your business or freelance name"
                  autoFocus={!needsUser}
                />
              </label>
            )}

            {currencyField}
            {error && <span className="bfh-formerror">{error}</span>}

            <div className="bfh-onboard__actions">
              <button type="button" className="bfh-btn-ghost" onClick={() => setStep(0)}>
                Back
              </button>
              <button type="submit" className="bfh-btn-primary bfh-btn-primary--inline">
                Continue →
              </button>
            </div>
          </form>
        )}

        {/* ---- 03 Cash ---- */}
        {step === 2 && (
          <form className="bfh-onboard__panel" onSubmit={saveBalance}>
            <h1 className="bfh-onboard__title">
              {mode === 'personal' ? "What's your current savings?" : "What's your current cash balance?"}
            </h1>
            <p className="bfh-onboard__note">
              {mode === 'personal'
                ? 'Enter roughly how much you have saved right now.'
                : 'Used as the starting point for cash flow. You can set it later instead.'}
            </p>

            {needsBusiness && (
              <label className="bfh-formfield" htmlFor="onboard-balance">
                <span className="bfh-micro">
                  {mode === 'both' ? 'Business cash' : 'Opening cash balance'}
                </span>
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
            )}

            {needsUser && (
              <label className="bfh-formfield" htmlFor="onboard-personal-balance">
                <span className="bfh-micro">
                  {mode === 'both' ? 'Personal savings' : 'Current savings'}
                </span>
                <input
                  id="onboard-personal-balance"
                  type="number"
                  step="0.01"
                  value={personalBalance}
                  onChange={(e) => setPersonalBalance(e.target.value)}
                  placeholder="0"
                  autoFocus={!needsBusiness}
                />
              </label>
            )}

            <span className="bfh-fieldhint">
              {mode === 'both'
                ? 'Both can be updated anytime in Settings.'
                : 'You can update this anytime in Settings.'}
            </span>

            <div className="bfh-onboard__actions">
              <button type="button" className="bfh-btn-ghost" onClick={() => setStep(1)}>
                Back
              </button>
              <button type="button" className="bfh-btn-ghost" onClick={() => setStep(3)}>
                Skip
              </button>
              <button type="submit" className="bfh-btn-primary bfh-btn-primary--inline">
                Continue →
              </button>
            </div>
          </form>
        )}

        {/* ---- 04 Assistant, only when both sides were asked for ---- */}
        {step === 3 && assistantStep === 3 && (
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
                    <span className="bfh-howto__iconbox" aria-hidden="true">
                      <Icon size={15} stroke={1.5} />
                    </span>
                    <span className="bfh-howto__rowbody">
                      <span className="bfh-howto__rowname">{feature.label}</span>
                      <span className="bfh-howto__rowdesc">{feature.sub}</span>
                    </span>
                  </li>
                )
              })}
            </ul>

            {!isMobile && (
              <p className="bfh-onboard__shortcut">
                <IconKeyboard size={13} stroke={1.5} aria-hidden="true" />
                Open it anytime with {shortcutLabel()}.
              </p>
            )}

            <div className="bfh-onboard__actions">
              <button
                type="button"
                className="bfh-btn-ghost bfh-onboard__try"
                onClick={openAssistant}
              >
                Try it now
              </button>
              <button
                type="button"
                className="bfh-btn-primary bfh-btn-primary--inline"
                onClick={() => setStep(4)}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ---- Ready ---- */}
        {step === readyStep && step >= 3 && (
          <div className="bfh-onboard__panel">
            <h1 className="bfh-onboard__title">You&apos;re all set.</h1>
            <p className="bfh-onboard__note">
              {mode === 'business' &&
                'Your business dashboard is ready. Add your first transaction to start tracking.'}
              {mode === 'personal' &&
                'Your personal finance dashboard is ready. Add a transaction or set your first goal.'}
              {mode === 'both' &&
                'Both modes are ready. Start with your business or jump straight into personal finance.'}
            </p>

            <dl className="bfh-onboard__summary">
              {needsUser && (
                <div>
                  <dt className="bfh-micro">You</dt>
                  <dd>{userName.trim() || '—'}</dd>
                </div>
              )}
              {needsBusiness && (
                <div>
                  <dt className="bfh-micro">Business</dt>
                  <dd>{name.trim() || '—'}</dd>
                </div>
              )}
              <div>
                <dt className="bfh-micro">Currency</dt>
                <dd>
                  {chosen.code} · {chosen.symbol}
                </dd>
              </div>
              {needsBusiness && (
                <div>
                  <dt className="bfh-micro">Business cash</dt>
                  <dd>
                    {balance === '' ? 'Not set' : formatAmount(Number(balance) || 0, chosen.symbol)}
                  </dd>
                </div>
              )}
              {needsUser && (
                <div>
                  <dt className="bfh-micro">Savings</dt>
                  <dd>
                    {personalBalance === ''
                      ? 'Not set'
                      : formatAmount(Number(personalBalance) || 0, chosen.symbol)}
                  </dd>
                </div>
              )}
            </dl>

            <div
              className={`bfh-onboard__actions${
                mode === 'both' ? ' bfh-onboard__actions--pair' : ''
              }`}
            >
              {mode === 'both' ? (
                <>
                  <button
                    type="button"
                    className="bfh-btn-primary bfh-btn-primary--inline"
                    onClick={() => finish('business')}
                    disabled={saving}
                  >
                    Business Dashboard →
                  </button>
                  <button
                    type="button"
                    className="bfh-btn-ghost bfh-btn-ghost--solid"
                    onClick={() => finish('personal')}
                    disabled={saving}
                  >
                    Personal Dashboard →
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="bfh-btn-primary bfh-btn-primary--inline"
                  onClick={() => finish(startProfile)}
                  disabled={saving}
                >
                  {mode === 'personal' ? 'Go to Personal Dashboard →' : 'Go to Business Dashboard →'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {assistantOpen && <AIAssistant onClose={closeAssistant} />}
    </div>
  )
}
