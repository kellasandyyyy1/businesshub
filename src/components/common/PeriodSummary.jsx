import { usePeriod } from '../../context/PeriodContext'
import Delta from '../Delta'
import { formatCurrency } from '../../lib/format'
import EmptyPeriod from './EmptyPeriod'

/**
 * The first thing on a dashboard: one plain-language answer to "how am I
 * doing?" for the selected window, the figure that matters most, a sentence
 * that explains it, and money in against money out as two bars you can
 * compare at a glance. Everything below it is detail.
 *
 * The headline stays ink. `delta` ({ value, goodWhen }) adds the change under
 * it, and `sentenceTone: 'warn'` puts an amber dot before the sentence when
 * more went out than came in, the words themselves stay grey.
 *
 * When the window is empty it says so, and offers the two ways forward: add
 * something, or look further back.
 */
export default function PeriodSummary({
  headline,
  headlineLabel,
  sentence,
  inLabel,
  outLabel,
  moneyIn,
  moneyOut,
  symbol,
  empty,
  hasHistory,
  addTo,
  note,
  delta,
  sentenceTone,
}) {
  const { period } = usePeriod()

  if (empty) {
    return (
      <EmptyPeriod
        hasHistory={hasHistory}
        newBody="Add your first income or expense and this page will show where your money comes from and where it goes."
        addTo={addTo}
        note={note}
      />
    )
  }

  const scale = Math.max(moneyIn, moneyOut, 1)

  return (
    <section className="bfh-card bfh-summarycard" aria-label={`Summary, last ${period.name}`}>
      <div className="bfh-micro">Last {period.name}</div>

      <p className="bfh-summarycard__headline">
        <span className="bfh-summarycard__figure">{headline}</span>
        <span className="bfh-summarycard__figurelabel">{headlineLabel}</span>
      </p>
      {delta && (
        <Delta
          value={delta.value}
          goodWhen={delta.goodWhen}
          label={`vs previous ${period.name}`}
          emptyLabel="nothing earlier to compare"
        />
      )}
      <p className="bfh-summarycard__sentence">
        {sentenceTone ? (
          <span className="bfh-signote">
            <span className={`dot dot-${sentenceTone}`} aria-hidden="true" />
            <span>{sentence}</span>
          </span>
        ) : (
          sentence
        )}
      </p>

      <dl className="bfh-flow">
        <div className="bfh-flow__row">
          <dt>{inLabel}</dt>
          <dd>
            <span className="bfh-flow__track" aria-hidden="true">
              <span className="bfh-flow__fill" style={{ width: `${(moneyIn / scale) * 100}%` }} />
            </span>
            <span className="bfh-flow__value">{formatCurrency(moneyIn, symbol)}</span>
          </dd>
        </div>
        <div className="bfh-flow__row">
          <dt>{outLabel}</dt>
          <dd>
            <span className="bfh-flow__track" aria-hidden="true">
              <span
                className="bfh-flow__fill"
                data-tone="secondary"
                style={{ width: `${(moneyOut / scale) * 100}%` }}
              />
            </span>
            <span className="bfh-flow__value">{formatCurrency(moneyOut, symbol)}</span>
          </dd>
        </div>
      </dl>
    </section>
  )
}
