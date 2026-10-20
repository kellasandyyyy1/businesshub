import { IconPlus, IconTargetArrow } from '@tabler/icons-react'
import { useState } from 'react'

import BudgetCard from '../components/budgets/BudgetCard'
import EmptyState from '../components/EmptyState'
import BudgetModal from '../components/budgets/BudgetModal'
import useAssistantPrefill from '../hooks/useAssistantPrefill'
import useBudgetsData from '../hooks/useBudgets'
import useSettings from '../hooks/useSettings'
import { formatCurrency } from '../lib/format'

export default function Budgets() {
  const data = useBudgetsData()
  const { symbol } = useSettings()
  const [editing, setEditing] = useState(null) // null | {} | budget
  useAssistantPrefill('SET_BUDGET', (record) => setEditing(record?.id ? record : { prefill: record }))

  if (!data) return <div className="bfh-page" />

  const { totals } = data
  const stats = [
    { label: 'Total budgeted', value: totals.budgeted },
    { label: 'Total spent', value: totals.spent },
    { label: 'Remaining', value: totals.remaining },
  ]

  return (
    <div className="bfh-page">
      <div className="bfh-block bfh-tabbar">
        <div>
          <h1 className="bfh-pagetitle">Budgets</h1>
          <div className="bfh-micro">Each budget measured over its own period</div>
        </div>
        <button
          type="button"
          className="bfh-btn-primary bfh-btn-primary--inline"
          onClick={() => setEditing({})}
        >
          <IconPlus size={14} stroke={1.75} aria-hidden="true" />
          <span>Add budget</span>
        </button>
      </div>

      <div className="bfh-block">
        <div className="bfh-summary bfh-summary--3">
          {stats.map((stat) => (
            <div className="bfh-summary__cell" key={stat.label}>
              <span className="bfh-micro">{stat.label}</span>
              <span className="bfh-summary__value bfh-summary__value--lg">
                {formatCurrency(stat.value, symbol)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bfh-block bfh-budgets">
        {data.budgets.map((budget) => (
          <BudgetCard
            key={budget.id}
            budget={budget}
            iconName={data.categoryIcons[budget.category]}
            symbol={symbol}
            onEdit={setEditing}
          />
        ))}

        {data.budgets.length === 0 && (
          <EmptyState
            icon={IconTargetArrow}
            heading="No budgets set"
            body="A budget caps what a category can spend over a month, quarter, or year."
            actionLabel="Set first budget"
            onAction={() => setEditing({})}
          />
        )}
      </div>

      {editing && (
        <BudgetModal
          key={editing.id ?? 'new'}
          budget={editing.id ? editing : (editing.prefill ?? null)}
          categories={data.categories}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
