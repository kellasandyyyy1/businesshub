import { IconArrowRight, IconRefresh, IconSparkles } from '@tabler/icons-react'
import { Link } from 'react-router-dom'

import { AiError, AiLoading } from '../components/ai/AiStatus'
import useAiInsights from '../hooks/useAiInsights'
import useInsightsData from '../hooks/useInsights'
import useSettings from '../hooks/useSettings'
import { timeAgo } from '../lib/ai'
import { formatCurrency, formatFullDate } from '../lib/format'

/**
 * Where each kind of insight is acted on. Matched on the tag's wording, since
 * the AI and the on-device rules name their tags differently ("INVOICE" and
 * "Getting paid" both mean the invoices page).
 */
const ACTIONS = [
  { match: /invoice|getting paid|receivable/i, to: '/invoices', label: 'Open invoices' },
  { match: /budget/i, to: '/budgets', label: 'See budgets' },
  { match: /cash|runway/i, to: '/cashflow', label: 'See cash flow' },
  { match: /client|concentration/i, to: '/clients', label: 'See clients' },
  { match: /expense|spending|recurring|cost/i, to: '/expenses', label: 'See expenses' },
  { match: /revenue|income|profit/i, to: '/income', label: 'See income' },
]
const actionFor = (tag) => ACTIONS.find((a) => a.match.test(tag ?? '')) ?? null

/** "CLIENT RISK" → "Client risk": a label, not a code. */
const sentenceCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '')

/** The model writes "PHP 28,000"; the rest of the app writes ₱28,000. */
const withSymbol = (text, symbol) => String(text ?? '').replace(/\bPHP\s?(?=\d)/g, symbol)

export default function Insights() {
  const data = useInsightsData()
  const ai = useAiInsights()
  const { symbol } = useSettings()

  if (!data) return <div className="bfh-page" />

  // The AI list is preferred when it exists; the rules engine keeps the page
  // useful when there is no key, no connection, or no answer yet.
  const usingAi = Boolean(ai.insights?.length)
  const insights = usingAi
    ? ai.insights.map((insight, index) => ({ ...insight, priority: index === 0 && insight.priority === 1 }))
    : data.insights

  const { stats } = data

  // Three facts, said as sentences rather than labels over numbers.
  const facts = [
    stats.avgPaymentDays !== null && {
      label: 'Getting paid',
      value: `${stats.avgPaymentDays} days`,
      text: 'is how long clients take to pay, on average.',
    },
    stats.topExpenseCategory && {
      label: 'Biggest cost',
      value: stats.topExpenseCategory,
      text: `${formatCurrency(stats.topExpenseAmount, symbol)} over the last 90 days.`,
    },
    stats.runwayMonths !== null && {
      label: 'Cash runway',
      value: `${stats.runwayMonths.toFixed(1)} months`,
      text: 'is how long your cash lasts at the current pace of spending.',
    },
  ].filter(Boolean)

  return (
    <div className="bfh-page bfh-insightspage">
      <div className="bfh-block bfh-pagehead">
        <div>
          <h1 className="bfh-pagehead__title">Insights</h1>
          <p className="bfh-pagehead__sub">
            What is worth your attention, worked out from your own numbers.
          </p>
        </div>
        <button
          type="button"
          className="bfh-btn-outline bfh-insightspage__refresh"
          onClick={ai.regenerate}
          disabled={ai.status === 'loading'}
        >
          <IconRefresh size={15} stroke={1.5} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {facts.length > 0 && (
        <div className="bfh-block">
          <section className="bfh-facts" aria-label="At a glance">
            {facts.map((fact) => (
              <div className="bfh-fact" key={fact.label}>
                <span className="bfh-micro">{fact.label}</span>
                <span className="bfh-fact__value">{fact.value}</span>
                <span className="bfh-fact__text">{fact.text}</span>
              </div>
            ))}
          </section>
        </div>
      )}

      {(ai.status === 'loading' || ai.error) && (
        <div className="bfh-block">
          {ai.status === 'loading' ? (
            <AiLoading label="Reading your books" />
          ) : (
            <AiError error={ai.error} onRetry={ai.regenerate} />
          )}
        </div>
      )}

      <div className="bfh-block">
        <section className="bfh-card bfh-insights">
          <header className="bfh-insights__top">
            <h2 className="bfh-panel__title">Things to look at</h2>
            <span className="bfh-insights__source">
              <IconSparkles size={13} stroke={1.5} aria-hidden="true" />
              {usingAi
                ? `Written by AI · updated ${timeAgo(ai.generatedAt)}`
                : `Worked out on this device · ${formatFullDate(data.today)}`}
            </span>
          </header>

          {insights.length === 0 ? (
            <p className="bfh-empty">
              Not enough history yet. A few more months of entries and patterns will start to show.
            </p>
          ) : (
            <ol className="bfh-insights__list">
              {insights.map((insight, index) => {
                const action = actionFor(insight.tag)
                return (
                  <li key={insight.id ?? index} className="bfh-insight" data-priority={insight.priority || undefined}>
                    <span className="bfh-insight__num">{index + 1}</span>
                    <div className="bfh-insight__body">
                      <div className="bfh-insight__labels">
                        {insight.priority && <span className="bfh-pill-invert">Most urgent</span>}
                        <span className="bfh-insight__tag">{sentenceCase(insight.tag)}</span>
                      </div>
                      <h3 className="bfh-insight__title">{withSymbol(insight.title, symbol)}</h3>
                      <p className="bfh-insight__text">{withSymbol(insight.body, symbol)}</p>
                      {action && (
                        <Link className="bfh-insight__action" to={action.to}>
                          {action.label}
                          <IconArrowRight size={14} stroke={1.75} aria-hidden="true" />
                        </Link>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
