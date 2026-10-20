import {
  IconAlertTriangle,
  IconArrowRight,
  IconBuilding,
  IconCircleCheck,
  IconInfoCircle,
  IconUser,
} from '@tabler/icons-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import GoalsStrip from '../components/personal/GoalsStrip'
import { PROFILE_HOME } from '../config/nav'
import { useProfile } from '../context/ProfileContext'
import useOverviewData from '../hooks/useOverview'
import useSettings from '../hooks/useSettings'
import { formatCurrency } from '../lib/format'
import { monthLabel } from '../lib/personalReports'
import { combinedOverview } from '../lib/overview'

const signed = (value, symbol) => `${value < 0 ? '−' : ''}${formatCurrency(Math.abs(value), symbol)}`

/**
 * What a reader should notice first, worked out from the figures rather than
 * left for them to spot: problems ahead of good news, and no more than three.
 */
function highlightsFor(view, symbol) {
  const { business, personal, transfers } = view
  const list = []

  if (personal.leftOver < 0) {
    list.push({
      tone: 'warn',
      text: `Personal spending is ${formatCurrency(-personal.leftOver, symbol)} ahead of what came in this month.`,
      action: { label: 'See personal spending', profile: 'personal', to: '/personal/expenses' },
    })
  }
  if (business.profit < 0) {
    list.push({
      tone: 'warn',
      text: `The business has spent ${formatCurrency(-business.profit, symbol)} more than it brought in this month.`,
      action: { label: 'See business expenses', profile: 'business', to: '/expenses' },
    })
  }
  if (transfers === 0 && personal.income === 0 && business.cash > 0) {
    list.push({
      tone: 'info',
      text: 'You have not paid yourself from the business yet this month, and no personal income is recorded.',
    })
  } else if (transfers > 0) {
    list.push({
      tone: 'info',
      text: `You paid yourself ${formatCurrency(transfers, symbol)} from the business this month.`,
    })
  }
  if (business.profit > 0) {
    list.push({
      tone: 'good',
      text: `The business is ${formatCurrency(business.profit, symbol)} in profit this month.`,
    })
  }
  if (personal.saved > 0) {
    list.push({
      tone: 'good',
      text: `You have kept ${formatCurrency(personal.saved, symbol)} of your personal income this month.`,
    })
  }

  const order = { warn: 0, info: 1, good: 2 }
  return list.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 3)
}

const TONE_ICONS = { warn: IconAlertTriangle, info: IconInfoCircle, good: IconCircleCheck }

/** Came in against went out, as two bars on one scale. */
function Flow({ rows, symbol }) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <dl className="bfh-ovflow">
      {rows.map((row) => (
        <div className="bfh-ovflow__row" key={row.label}>
          <dt>{row.label}</dt>
          <dd>{formatCurrency(row.value, symbol)}</dd>
          <span className="bfh-ovflow__track" aria-hidden="true">
            <span
              className="bfh-ovflow__fill"
              data-kind={row.kind}
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </span>
        </div>
      ))}
    </dl>
  )
}

/** One side of the books: the month's result first, then how it came about. */
function SideCard({ icon: Icon, title, resultLabel, result, verdict, rows, action, onAction, symbol }) {
  return (
    <section className="bfh-card bfh-ovside">
      <header className="bfh-ovside__head">
        <span className="bfh-ovside__icon" aria-hidden="true">
          <Icon size={16} stroke={1.5} />
        </span>
        <h2 className="bfh-ovside__title">{title}</h2>
        <span className="bfh-ovside__verdict" data-negative={result < 0 || undefined}>
          {verdict}
        </span>
      </header>

      <div className="bfh-ovside__result">
        <span className="bfh-ovside__label">{resultLabel}</span>
        <span className="bfh-ovside__figure">{signed(result, symbol)}</span>
      </div>

      <Flow rows={rows} symbol={symbol} />

      <button type="button" className="bfh-btn-outline bfh-ovside__action" onClick={onAction}>
        {action}
        <IconArrowRight size={15} stroke={1.75} aria-hidden="true" />
      </button>
    </section>
  )
}

export default function Overview() {
  const data = useOverviewData()
  const { symbol } = useSettings()
  const { switchProfile } = useProfile()
  const navigate = useNavigate()

  const today = new Date().toISOString().slice(0, 10)
  const view = useMemo(() => combinedOverview(data ?? {}, today), [data, today])

  if (!data) return <div className="bfh-page" />

  // Leaving for one side means being in it when you arrive, so the switch and
  // the navigation happen together.
  const go = (profile, to = PROFILE_HOME[profile]) => {
    switchProfile(profile)
    navigate(to)
  }

  const personalWorth = view.worth.assets - view.worth.liabilities
  const parts = [
    { key: 'business', label: 'Business cash', value: view.business.cash },
    { key: 'personal', label: 'Personal net worth', value: personalWorth },
  ]
  const positive = parts.reduce((total, p) => total + Math.max(p.value, 0), 0)
  const highlights = highlightsFor(view, symbol)
  const month = monthLabel(today.slice(0, 7)).split(' ')[0]

  return (
    <div className="bfh-page bfh-ovpage">
      <div className="bfh-block bfh-pagehead">
        <div>
          <h1 className="bfh-pagehead__title">Complete picture</h1>
          <p className="bfh-pagehead__sub">Your business and personal money, side by side.</p>
        </div>
      </div>

      {/* The one number: everything you have, and what it is made of. */}
      <div className="bfh-block">
        <section className="bfh-card bfh-ovhero" aria-labelledby="bfh-ovhero-label">
          <span className="bfh-micro" id="bfh-ovhero-label">
            Everything you have
          </span>
          <span className="bfh-ovhero__figure">{signed(view.combinedNetWorth, symbol)}</span>
          <p className="bfh-ovhero__context">
            Cash in the business plus what you own personally, less what you owe.
          </p>

          {positive > 0 && (
            <span className="bfh-ovhero__bar" aria-hidden="true">
              {parts
                .filter((p) => p.value > 0)
                .map((p) => (
                  <span
                    key={p.key}
                    className="bfh-ovhero__segment"
                    data-kind={p.key}
                    style={{ flexGrow: p.value / positive }}
                  />
                ))}
            </span>
          )}

          <dl className="bfh-ovhero__parts">
            {parts.map((p) => (
              <div className="bfh-ovhero__part" key={p.key}>
                <dt>
                  <span className="bfh-ovhero__swatch" data-kind={p.key} aria-hidden="true" />
                  {p.label}
                </dt>
                <dd>
                  {signed(p.value, symbol)}
                  {positive > 0 && p.value > 0 && (
                    <span className="bfh-ovhero__share">{Math.round((p.value / positive) * 100)}%</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {highlights.length > 0 && (
        <div className="bfh-block">
          <section className="bfh-ovnotes" aria-labelledby="bfh-ovnotes-title">
            <h2 className="bfh-ovsection__title" id="bfh-ovnotes-title">
              What stands out in {month}
            </h2>
            <ul className="bfh-ovnotes__list">
              {highlights.map((note) => {
                const Icon = TONE_ICONS[note.tone]
                return (
                  <li key={note.text} className="bfh-ovnote" data-tone={note.tone}>
                    <Icon className="bfh-ovnote__icon" size={18} stroke={1.75} aria-hidden="true" />
                    <span className="bfh-ovnote__body">
                      <span className="bfh-ovnote__text">{note.text}</span>
                      {note.action && (
                        <button
                          type="button"
                          className="bfh-ovnote__action"
                          onClick={() => go(note.action.profile, note.action.to)}
                        >
                          {note.action.label}
                          <IconArrowRight size={14} stroke={1.75} aria-hidden="true" />
                        </button>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      )}

      <div className="bfh-block">
        <h2 className="bfh-ovsection__title">{month} so far</h2>
        <div className="bfh-ovsides">
          <SideCard
            icon={IconBuilding}
            title="Business"
            resultLabel="Profit"
            result={view.business.profit}
            verdict={view.business.profit < 0 ? 'At a loss' : view.business.profit > 0 ? 'In profit' : 'Break-even'}
            rows={[
              { label: 'Revenue', value: view.business.revenue, kind: 'in' },
              { label: 'Expenses', value: view.business.expenses, kind: 'out' },
            ]}
            action="Open business"
            onAction={() => go('business')}
            symbol={symbol}
          />
          <SideCard
            icon={IconUser}
            title="Personal"
            resultLabel="Left over"
            result={view.personal.leftOver}
            verdict={view.personal.leftOver < 0 ? 'Overspent' : view.personal.leftOver > 0 ? 'Saving' : 'Even'}
            rows={[
              { label: 'Take-home', value: view.personal.income, kind: 'in' },
              { label: 'Spent', value: view.personal.expenses, kind: 'out' },
            ]}
            action="Open personal"
            onAction={() => go('personal')}
            symbol={symbol}
          />
        </div>
      </div>

      <div className="bfh-block">
        <GoalsStrip goals={data.goals} symbol={symbol} today={today} />
      </div>
    </div>
  )
}
