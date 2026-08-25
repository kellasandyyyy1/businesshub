import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import GoalsStrip from '../components/personal/GoalsStrip'
import { PROFILE_HOME } from '../config/nav'
import { useProfile } from '../context/ProfileContext'
import useOverviewData from '../hooks/useOverview'
import useSettings from '../hooks/useSettings'
import { formatCurrency } from '../lib/format'
import { combinedOverview } from '../lib/overview'

function Snapshot({ title, rows, action, onAction, symbol }) {
  return (
    <section className="bfh-card bfh-snapshot">
      <h2 className="bfh-snapshot__title">{title}</h2>

      <dl className="bfh-snapshot__list">
        {rows.map(([label, value]) => (
          <div className="bfh-snapshot__row" key={label}>
            <dt className="bfh-micro">{label}</dt>
            <dd className="bfh-snapshot__value">{formatCurrency(value, symbol)}</dd>
          </div>
        ))}
      </dl>

      <button type="button" className="bfh-micro bfh-link bfh-snapshot__action" onClick={onAction}>
        {action}
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
  const go = (profile) => {
    switchProfile(profile)
    navigate(PROFILE_HOME[profile])
  }

  return (
    <div className="bfh-page">
      <div className="bfh-block bfh-personalhead">
        <div>
          <h1 className="bfh-personalhead__title">Complete picture</h1>
          <p className="bfh-overview__sub">Business and personal combined.</p>
        </div>
      </div>

      <div className="bfh-block">
        <section className="bfh-card bfh-nwsummary">
          <span className="bfh-micro">Net worth</span>

          <div className="bfh-nwsummary__value">
            <span className="bfh-nwsummary__figure">
              {formatCurrency(view.combinedNetWorth, symbol)}
            </span>
            {view.combinedNetWorth < 0 && <span className="bfh-micro">(deficit)</span>}
          </div>

          <span className="bfh-micro bfh-nwsummary__updated">
            Your complete financial position
          </span>

          <div className="bfh-summary bfh-nwsummary__split">
            <div className="bfh-summary__cell">
              <span className="bfh-micro">Business cash</span>
              <span className="bfh-summary__value">
                {formatCurrency(view.business.cash, symbol)}
              </span>
            </div>
            <div className="bfh-summary__cell">
              <span className="bfh-micro">Personal net worth</span>
              <span className="bfh-summary__value">
                {formatCurrency(view.worth.assets - view.worth.liabilities, symbol)}
              </span>
            </div>
          </div>
        </section>
      </div>

      <div className="bfh-block bfh-nwsplit">
        <Snapshot
          title="Business"
          symbol={symbol}
          rows={[
            ['Cash balance', view.business.cash],
            ['Revenue this month', view.business.revenue],
            ['Expenses this month', view.business.expenses],
            ['Net profit', view.business.profit],
          ]}
          action="View business →"
          onAction={() => go('business')}
        />

        <Snapshot
          title="Personal"
          symbol={symbol}
          rows={[
            ['Take-home income', view.personal.income],
            ['Spent', view.personal.expenses],
            ['Saved', view.personal.saved],
            ['Left over', view.personal.leftOver],
          ]}
          action="View personal →"
          onAction={() => go('personal')}
        />
      </div>

      <div className="bfh-block">
        <p className="bfh-micro bfh-overview__transfers">
          {view.transfers > 0
            ? `You've paid yourself ${formatCurrency(view.transfers, symbol)} from the business this month.`
            : 'No owner draws this month.'}
        </p>
      </div>

      <div className="bfh-block">
        <GoalsStrip goals={data.goals} symbol={symbol} today={today} />
      </div>
    </div>
  )
}
