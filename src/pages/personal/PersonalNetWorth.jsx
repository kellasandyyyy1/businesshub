import { IconPlus, IconScale } from '@tabler/icons-react'
import { useMemo, useState } from 'react'

import Delta from '../../components/Delta'
import EmptyState from '../../components/EmptyState'
import SignalBadge from '../../components/SignalBadge'
import NetWorthColumn from '../../components/personal/NetWorthColumn'
import NetWorthModal from '../../components/personal/NetWorthModal'
import useAssistantPrefill from '../../hooks/useAssistantPrefill'
import useNetWorthItems from '../../hooks/useNetWorth'
import useSettings from '../../hooks/useSettings'
import { formatCurrency, percentChange, timeAgo } from '../../lib/format'
import { netWorthSummary, splitByType } from '../../lib/netWorth'
import { NET_WORTH_MILESTONES } from '../../lib/notifications'
import { netWorthHistory } from '../../lib/personalReports'

export default function PersonalNetWorth() {
  const items = useNetWorthItems()
  const { symbol } = useSettings()
  // null when closed; otherwise the row being edited, or { type } for a new one.
  const [editing, setEditing] = useState(null)
  useAssistantPrefill('UPDATE_NET_WORTH', (record) =>
    setEditing(record?.id ? record : { type: record?.type, prefill: record }),
  )

  const summary = useMemo(() => netWorthSummary(items ?? []), [items])
  const split = useMemo(() => splitByType(items ?? []), [items])
  const today = new Date().toISOString().slice(0, 10)
  const history = useMemo(() => netWorthHistory(items ?? [], today), [items, today])

  if (!items) return <div className="bfh-page" />

  const open = (type) => setEditing({ type })

  // Last month's position, for the change beside the total, and the round
  // number crossed since then, shown once, in the month it happens.
  const previous = history.length > 1 ? history[history.length - 2].net : null
  const milestone =
    previous === null
      ? null
      : NET_WORTH_MILESTONES.filter((m) => previous < m && summary.net >= m).pop() ?? null

  return (
    <div className="bfh-page">
      <div className="bfh-block bfh-personalhead">
        <h1 className="bfh-personalhead__title">Net Worth</h1>
        <button
          type="button"
          className="bfh-btn-primary bfh-btn-primary--inline"
          onClick={() => open('asset')}
        >
          <IconPlus size={14} stroke={1.75} aria-hidden="true" />
          Add asset or debt
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bfh-block">
          <EmptyState
            icon={IconScale}
            heading="Track your net worth"
            body="Add what you own (savings, investments, property) and what you owe. Dual subtracts one from the other to show where you stand."
            actionLabel="Get started"
            onAction={() => open('asset')}
          />
        </div>
      ) : (
        <>
          <div className="bfh-block">
            <section className="bfh-card bfh-nwsummary">
              <span className="bfh-micro">Your net worth</span>

              <div className="bfh-nwsummary__value">
                <span className="bfh-nwsummary__figure">
                  {formatCurrency(summary.net, symbol)}
                </span>
                {milestone && <SignalBadge tone="pos">Passed {formatCurrency(milestone, symbol)}</SignalBadge>}
              </div>
              <Delta
                value={previous === null ? null : percentChange(summary.net, previous)}
                goodWhen="up"
                label="since last month"
                emptyLabel="nothing earlier to compare"
              />

              {/* What the figure means, in one line, for anyone meeting the
                  term for the first time. Owing more than you own is a fact,
                  said plainly rather than shown as an error. */}
              <p className="bfh-nwsummary__explain">
                {summary.net < 0
                  ? `You owe ${formatCurrency(-summary.net, symbol)} more than you own.`
                  : `What you own minus what you owe.`}
              </p>

              <dl className="bfh-flow bfh-nwsummary__flow">
                <div className="bfh-flow__row">
                  <dt>You own</dt>
                  <dd>
                    <span className="bfh-flow__track" aria-hidden="true">
                      <span className="bfh-flow__fill" style={{ width: `${(summary.assets / Math.max(summary.assets, summary.liabilities, 1)) * 100}%` }} />
                    </span>
                    <span className="bfh-flow__value">{formatCurrency(summary.assets, symbol)}</span>
                  </dd>
                </div>
                <div className="bfh-flow__row">
                  <dt>You owe</dt>
                  <dd>
                    <span className="bfh-flow__track" aria-hidden="true">
                      <span
                        className="bfh-flow__fill"
                        data-tone="secondary"
                        style={{ width: `${(summary.liabilities / Math.max(summary.assets, summary.liabilities, 1)) * 100}%` }}
                      />
                    </span>
                    <span className="bfh-flow__value">{formatCurrency(summary.liabilities, symbol)}</span>
                  </dd>
                </div>
              </dl>

              <span className="bfh-nwsummary__updated">Last updated {timeAgo(summary.updatedAt)}</span>
            </section>
          </div>

          <div className="bfh-block bfh-nwsplit">
            <NetWorthColumn
              eyebrow="Assets"
              title="What you own"
              hint="Cash, savings, investments, property: anything you could sell or spend."
              type="asset"
              items={split.assets}
              total={summary.assets}
              symbol={symbol}
              addLabel="Add"
              onAdd={() => open('asset')}
              onEdit={setEditing}
            />
            <NetWorthColumn
              eyebrow="Liabilities"
              title="What you owe"
              hint="Loans, credit cards and other debts. Nothing here is good news."
              type="liability"
              items={split.liabilities}
              total={summary.liabilities}
              symbol={symbol}
              addLabel="Add"
              onAdd={() => open('liability')}
              onEdit={setEditing}
            />
          </div>
        </>
      )}

      {editing && (
        <NetWorthModal
          key={editing.id ?? `new-${editing.type}`}
          item={editing.id ? editing : (editing.prefill ?? null)}
          defaultType={editing.type}
          symbol={symbol}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
