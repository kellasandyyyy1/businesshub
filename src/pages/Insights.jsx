import { IconRefresh, IconSparkles } from '@tabler/icons-react'

import { AiError, AiLoading } from '../components/ai/AiStatus'
import useAiInsights from '../hooks/useAiInsights'
import useInsightsData from '../hooks/useInsights'
import useSettings from '../hooks/useSettings'
import { timeAgo } from '../lib/ai'
import { formatCurrency, formatFullDate } from '../lib/format'

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

  return (
    <div className="bfh-page">
      <div className="bfh-block bfh-insights__head">
        <div>
          <h1 className="bfh-pagetitle">What your data is telling you</h1>
          <div className="bfh-micro">
            {usingAi
              ? `Last updated ${timeAgo(ai.generatedAt)}`
              : `Updated ${formatFullDate(data.today)}`}
          </div>
        </div>

        <div className="bfh-insights__actions">
          <span className="bfh-aipill">
            <IconSparkles size={11} stroke={1.5} aria-hidden="true" />
            {usingAi ? 'AI-generated' : 'Computed on device'}
          </span>
          <button
            type="button"
            className="bfh-ghostaction"
            onClick={ai.regenerate}
            disabled={ai.status === 'loading'}
          >
            <IconRefresh size={12} stroke={1.5} aria-hidden="true" />
            Regenerate
          </button>
        </div>
      </div>

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
          {insights.length === 0 ? (
            <p className="bfh-empty">
              Not enough history yet. A few more months of entries and patterns will start to show.
            </p>
          ) : (
            <ul className="bfh-insights__list">
              {insights.map((insight, index) => (
                <li key={insight.id} className="bfh-insight">
                  <span className="bfh-insight__num">{String(index + 1).padStart(2, '0')}</span>
                  <div className="bfh-insight__body">
                    <h2 className="bfh-insight__title">{insight.title}</h2>
                    <p className="bfh-insight__text">{insight.body}</p>
                    <span className={insight.priority ? 'bfh-pill-invert' : 'bfh-chip'}>
                      {insight.tag}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="bfh-block">
        <div className="bfh-summary bfh-summary--3">
          <div className="bfh-summary__cell">
            <span className="bfh-micro">Avg invoice paid</span>
            <span className="bfh-summary__value">
              {stats.avgPaymentDays === null ? '—' : `${stats.avgPaymentDays} days`}
            </span>
          </div>
          <div className="bfh-summary__cell">
            <span className="bfh-micro">Top expense category</span>
            <span className="bfh-summary__value">{stats.topExpenseCategory ?? '—'}</span>
            <span className="bfh-micro">
              {formatCurrency(stats.topExpenseAmount, symbol)} over 90 days
            </span>
          </div>
          <div className="bfh-summary__cell">
            <span className="bfh-micro">Cash runway</span>
            <span className="bfh-summary__value">
              {stats.runwayMonths === null ? '—' : `${stats.runwayMonths.toFixed(1)} months`}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
