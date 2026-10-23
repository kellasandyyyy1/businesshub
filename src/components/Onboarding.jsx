import {
  IconBuilding,
  IconCheck,
  IconChevronDown,
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
    sub: "Say 'log 3000 Meralco bill' and it fills the form for you.",
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
 * How far along, as a row of marks rather than a numbered list.
 *
 * The current step is the only one that carries a shape: it stretches into a
 * bar while the rest stay dots, so where you are reads at a glance without
 * anyone having to count.
 */
function Dots({ count, step }) {
  return (
    <div className="bfh-onb__dots" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="bfh-onb__dot"
          data-state={i === step ? 'current' : i < step ? 'done' : 'todo'}
        />
      ))}
    </div>
  )
}

/**
 * First run, before any data exists. A full page rather than a modal. There
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
  // Which way the last move went, so the leaving and arriving panels slide the
  // same way rather than both sliding left.
  const [back, setBack] = useState(false)

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

  const goTo = (next, isBack = false) => {
    setBack(isBack)
    setStep(next)
  }

  const saveMode = async (e) => {
    e.preventDefault()
    await putSetting('activeMode', mode)
    try {
      localStorage.setItem('dual-onboarding-mode', mode)
    } catch {
      // Remembered in the database either way; this copy is only a convenience.
    }
    goTo(1)
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
    goTo(2)
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
    goTo(3)
  }

  const finish = async (profile) => {
    setSaving(true)
    await putSetting('onboarded', true)
    switchProfile(profile)
    navigate(profile === 'personal' ? '/personal' : '/')
    onDone()
  }

  const startProfile = mode === 'personal' ? 'personal' : 'business'

  const heading = {
    0: 'What will you use Dual for?',
    1: {
      business: 'Set up your business.',
      personal: 'Set up your personal finances.',
      both: "Let's set up both.",
    }[mode],
    2: mode === 'personal' ? "What's your current savings?" : "What's your current cash balance?",
    3: assistantStep === 3 ? 'Ask Dual anything.' : "You're all set.",
    4: "You're all set.",
  }[step]

  const sub = {
    0: 'You can always add the other later in Settings.',
    1: {
      business: "Two things and you're in.",
      personal: 'Just your name and currency.',
      both: "Three fields and you're in.",
    }[mode],
    2:
      mode === 'personal'
        ? 'Enter roughly how much you have saved right now.'
        : 'Used as the starting point for cash flow. You can set it later instead.',
    3:
      assistantStep === 3
        ? 'Ask anything, in English or Filipino.'
        : 'Everything below can be changed in Settings.',
    4: 'Start with business, personal, or try the assistant.',
  }[step]

  const currencyField = (
    <label className="bfh-onb__field" htmlFor="onboard-currency">
      <span className="bfh-onb__label">Currency</span>
      <span className="bfh-onb__selectwrap">
        <select
          id="onboard-currency"
          className="bfh-onb__input"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} · {c.symbol}
            </option>
          ))}
        </select>
        <IconChevronDown size={14} stroke={1.5} aria-hidden="true" />
      </span>
    </label>
  )

  /** The row under every step: one way on, one way back. */
  const footer = (onBack, label = 'Continue →') => (
    <div className="bfh-onb__foot">
      <button type="submit" className="bfh-onb__cta">
        {label}
      </button>
      {onBack && (
        <button type="button" className="bfh-onb__back" onClick={onBack}>
          ← Back
        </button>
      )}
    </div>
  )

  return (
    <div className="bfh-onb" role="dialog" aria-modal="true" aria-label="Set up Dual">
      <div className="bfh-onb__card" ref={trapRef}>
        <header className="bfh-onb__head">
          <div className="bfh-onb__brand">
            {/* The mark is already a dark badge with light artwork, so it is the
                badge. Putting it inside a second ink square would sit one on
                the other. It animates only here, on the first step. */}
            {step === 0 ? (
              <AnimatedLogo size={36} />
            ) : (
              <img src="/favicon.svg" alt="" width="36" height="36" />
            )}
            <span className="bfh-onb__brandtext">
              <span className="bfh-onb__brandname">Dual</span>
              <span className="bfh-onb__brandtag">Dual Finance</span>
            </span>
          </div>

          <Dots count={steps.length} step={step} />

          <span className="bfh-onb__step">
            Step {step + 1} of {steps.length}: {steps[step]}
          </span>
          <h1 className="bfh-onb__title">{heading}</h1>
          <p className="bfh-onb__sub">{sub}</p>
        </header>

        <div className="bfh-onb__body" key={step} data-back={back ? 'true' : 'false'}>
          {/* ---- 01 Mode ---- */}
          {step === 0 && (
            <form className="bfh-onb__panel" onSubmit={saveMode}>
              <div className="bfh-onb__options" role="radiogroup" aria-label="What Dual is for">
                {MODE_OPTIONS.map((option) => {
                  const { Icon } = option
                  const selected = mode === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className="bfh-onb__option"
                      data-selected={selected ? 'true' : 'false'}
                      onClick={() => setMode(option.id)}
                    >
                      <span className="bfh-onb__radio" aria-hidden="true" />
                      <Icon size={14} stroke={1.5} aria-hidden="true" className="bfh-onb__optionicon" />
                      <span className="bfh-onb__optionbody">
                        <span className="bfh-onb__optionname">{option.title}</span>
                        <span className="bfh-onb__optiondesc">{option.body}</span>
                        {option.recommended && (
                          <span className="bfh-onb__badge">Recommended</span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
              {footer(null)}
            </form>
          )}

          {/* ---- 02 Setup ---- */}
          {step === 1 && (
            <form className="bfh-onb__panel" onSubmit={saveSetup}>
              {needsUser && (
                <label className="bfh-onb__field" htmlFor="onboard-username">
                  <span className="bfh-onb__label">Your name</span>
                  <input
                    id="onboard-username"
                    className="bfh-onb__input"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Your first name"
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                  />
                  <span className="bfh-onb__hint">This is how Dual will greet you.</span>
                </label>
              )}

              {needsBusiness && (
                <label className="bfh-onb__field" htmlFor="onboard-name">
                  <span className="bfh-onb__label">Business name</span>
                  <input
                    id="onboard-name"
                    className="bfh-onb__input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your business or freelance name"
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus={!needsUser}
                  />
                </label>
              )}

              {currencyField}
              {error && <span className="bfh-onb__error">{error}</span>}
              {footer(() => goTo(0, true))}
            </form>
          )}

          {/* ---- 03 Cash ---- */}
          {step === 2 && (
            <form className="bfh-onb__panel" onSubmit={saveBalance}>
              {needsBusiness && (
                <label className="bfh-onb__field" htmlFor="onboard-balance">
                  <span className="bfh-onb__label">
                    {mode === 'both' ? 'Business cash' : 'Opening cash balance'}
                  </span>
                  <span className="bfh-onb__prefixwrap">
                    <span className="bfh-onb__prefix" aria-hidden="true">
                      {chosen.symbol}
                    </span>
                    <input
                      id="onboard-balance"
                      className="bfh-onb__input bfh-onb__input--prefixed"
                      type="number"
                      step="0.01"
                      min="0"
                      value={balance}
                      onChange={(e) => setBalance(e.target.value)}
                      placeholder="0.00"
                      // eslint-disable-next-line jsx-a11y/no-autofocus
                      autoFocus
                    />
                  </span>
                </label>
              )}

              {needsUser && (
                <label className="bfh-onb__field" htmlFor="onboard-personal-balance">
                  <span className="bfh-onb__label">
                    {mode === 'both' ? 'Personal savings' : 'Current savings'}
                  </span>
                  <span className="bfh-onb__prefixwrap">
                    <span className="bfh-onb__prefix" aria-hidden="true">
                      {chosen.symbol}
                    </span>
                    <input
                      id="onboard-personal-balance"
                      className="bfh-onb__input bfh-onb__input--prefixed"
                      type="number"
                      step="0.01"
                      min="0"
                      value={personalBalance}
                      onChange={(e) => setPersonalBalance(e.target.value)}
                      placeholder="0"
                      // eslint-disable-next-line jsx-a11y/no-autofocus
                      autoFocus={!needsBusiness}
                    />
                  </span>
                </label>
              )}

              {/* Skipping is a line of text rather than a third button: it is
                  the quiet option, and giving it equal weight would suggest the
                  number matters less than it does. */}
              <button type="button" className="bfh-onb__skip" onClick={() => goTo(3)}>
                Skip for now. You can set this in Settings later.
              </button>

              {footer(() => goTo(1, true))}
            </form>
          )}

          {/* ---- 04 Assistant, only when both sides were asked for ---- */}
          {step === 3 && assistantStep === 3 && (
            <form
              className="bfh-onb__panel"
              onSubmit={(e) => {
                e.preventDefault()
                goTo(4)
              }}
            >
              <ul className="bfh-onb__features">
                {ASSISTANT_FEATURES.map((feature) => {
                  const Icon = feature.icon
                  return (
                    <li key={feature.label} className="bfh-onb__feature">
                      <span className="bfh-onb__featureicon" aria-hidden="true">
                        <Icon size={14} stroke={1.5} />
                      </span>
                      <span className="bfh-onb__featurebody">
                        <span className="bfh-onb__featurename">{feature.label}</span>
                        <span className="bfh-onb__featuredesc">{feature.sub}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>

              {!isMobile && (
                <p className="bfh-onb__shortcut">
                  <IconKeyboard size={12} stroke={1.5} aria-hidden="true" />
                  Open it anytime with <kbd className="bfh-onb__kbd">{shortcutLabel()}</kbd>
                </p>
              )}

              <button type="button" className="bfh-onb__try" onClick={openAssistant}>
                Try it now
              </button>

              {footer(() => goTo(2, true))}
            </form>
          )}

          {/* ---- Ready ---- */}
          {step === readyStep && step >= 3 && (
            <div className="bfh-onb__panel bfh-onb__panel--done">
              <span className="bfh-onb__tick" aria-hidden="true">
                <IconCheck size={24} stroke={2} />
              </span>

              <p className="bfh-onb__donehead">All set.</p>
              <p className="bfh-onb__donesub">
                {mode === 'business' && 'Your business dashboard is ready.'}
                {mode === 'personal' && 'Your personal finance dashboard is ready.'}
                {mode === 'both' && 'Business and personal, both ready.'}
              </p>

              <dl className="bfh-onb__summary">
                {needsUser && (
                  <div>
                    <dt className="bfh-onb__label">You</dt>
                    <dd>{userName.trim() || 'Not set'}</dd>
                  </div>
                )}
                {needsBusiness && (
                  <div>
                    <dt className="bfh-onb__label">Business</dt>
                    <dd>{name.trim() || 'Not set'}</dd>
                  </div>
                )}
                <div>
                  <dt className="bfh-onb__label">Currency</dt>
                  <dd>
                    {chosen.code} · {chosen.symbol}
                  </dd>
                </div>
                {needsBusiness && (
                  <div>
                    <dt className="bfh-onb__label">Business cash</dt>
                    <dd>
                      {balance === ''
                        ? 'Not set'
                        : formatAmount(Number(balance) || 0, chosen.symbol)}
                    </dd>
                  </div>
                )}
                {needsUser && (
                  <div>
                    <dt className="bfh-onb__label">Savings</dt>
                    <dd>
                      {personalBalance === ''
                        ? 'Not set'
                        : formatAmount(Number(personalBalance) || 0, chosen.symbol)}
                    </dd>
                  </div>
                )}
              </dl>

              <div className="bfh-onb__foot">
                {mode === 'both' ? (
                  <>
                    <button
                      type="button"
                      className="bfh-onb__cta"
                      onClick={() => finish('business')}
                      disabled={saving}
                    >
                      Open Business →
                    </button>
                    <button
                      type="button"
                      className="bfh-onb__cta bfh-onb__cta--ghost"
                      onClick={() => finish('personal')}
                      disabled={saving}
                    >
                      Open Personal →
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="bfh-onb__cta"
                    onClick={() => finish(startProfile)}
                    disabled={saving}
                  >
                    {mode === 'personal' ? 'Open Personal →' : 'Open Business →'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {assistantOpen && <AIAssistant onClose={closeAssistant} />}
    </div>
  )
}
