import { IconChevronRight, IconPlus, IconRepeat } from '@tabler/icons-react'
import { useMemo, useState } from 'react'

import BudgetCard from '../components/budgets/BudgetCard'
import BudgetModal from '../components/budgets/BudgetModal'
import { categoryIcon } from '../config/categoryIcons'
import { OWNER_DRAW_CATEGORY } from '../db/defaults'
import SignalBadge from '../components/SignalBadge'
import { useProfile } from '../context/ProfileContext'
import useAssistantPrefill from '../hooks/useAssistantPrefill'
import useBudgetsData from '../hooks/useBudgets'
import useSettings from '../hooks/useSettings'
import { formatCurrency, formatDate, shiftDays } from '../lib/format'
import { budgetTone } from '../lib/signal'

/** Where a household or business usually starts, when there is no history to go by. */
const STARTERS = {
  personal: ['Food & Groceries', 'Transportation', 'Subscriptions', 'Entertainment', 'Shopping'],
  business: ['Marketing', 'Software & Subscriptions', 'Office & Rent', 'Meals & Entertainment', 'Travel & Transport'],
}

/** A limit people would type: the monthly cost rounded up to a tidy figure. */
const tidyUp = (value) => {
  const step = value >= 5000 ? 500 : value >= 1000 ? 100 : 50
  return Math.ceil(value / step) * step
}

/**
 * Budgets for whichever side is open. Business budgets cap what a category
 * can cost the business; personal ones do the same for the household. Both
 * pages list the charges that come back every month — Spotify, Netflix, a
 * gym — so any of them can be given its own limit in one tap.
 */
export default function Budgets() {
  const { profile, isPersonal } = useProfile()
  const data = useBudgetsData(profile)
  const { symbol } = useSettings()
  const [editing, setEditing] = useState(null) // null | {} | budget | { prefill }
  useAssistantPrefill('SET_BUDGET', (record) => setEditing(record?.id ? record : { prefill: record }))

  // First-run suggestions: the categories that actually cost the most over the
  // last three months, each with a limit near that — or common ones if
  // nothing has been spent yet.
  const starters = useMemo(() => {
    if (!data) return []
    const today = new Date().toISOString().slice(0, 10)
    const from = shiftDays(today, -90)
    const byCategory = new Map()
    for (const t of data.expenses) {
      if (t.date < from || t.category === OWNER_DRAW_CATEGORY) continue
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount)
    }
    const names = new Set(data.categories.filter((c) => c.type === 'expense').map((c) => c.name))
    const fromHistory = [...byCategory.entries()]
      .filter(([name]) => names.has(name))
      .sort((a, b) => b[1] - a[1])
      .map(([name, total]) => ({ name, monthly: total / 3 }))
    const fallback = STARTERS[profile]
      .filter((name) => names.has(name) && !byCategory.has(name))
      .map((name) => ({ name, monthly: 0 }))
    return [...fromHistory, ...fallback].slice(0, 4)
  }, [data, profile])

  if (!data) return <div className="bfh-page" />

  const startWith = (s) =>
    setEditing({
      prefill: { category: s.name, amount: s.monthly > 0 ? tidyUp(s.monthly) : '', period: 'monthly' },
    })

  const money = (v) => formatCurrency(v, symbol)
  const { totals, recurring } = data
  const stats = [
    { label: 'Budgeted', value: totals.budgeted },
    { label: 'Spent', value: totals.spent },
    { label: totals.remaining < 0 ? 'Over' : 'Left', value: Math.abs(totals.remaining) },
  ]

  // A ready-made budget for one repeating charge: its usual category, only the
  // payments that mention it, a monthly limit just above what it costs.
  const limitFor = (charge) =>
    setEditing({
      prefill: {
        name: charge.description,
        category: charge.category,
        match: charge.description,
        amount: tidyUp(charge.monthlyCost),
        period: 'monthly',
      },
    })

  return (
    <div className="bfh-page bfh-budgetspage">
      <div className="bfh-block bfh-pagehead">
        <div>
          <h1 className="bfh-pagehead__title">{isPersonal ? 'Personal budgets' : 'Budgets'}</h1>
          <p className="bfh-pagehead__sub">
            {isPersonal ? 'Limits for what you spend, and how close you are.' : 'Limits for what the business spends.'}
          </p>
        </div>
        {/* With nothing set yet, the starter list below is the way in, so a
            second "add" button up here would only repeat it. */}
        {data.budgets.length > 0 && (
          <button
            type="button"
            className="bfh-btn-primary bfh-btn-primary--inline bfh-budgetspage__add"
            onClick={() => setEditing({})}
          >
            <IconPlus size={14} stroke={1.75} aria-hidden="true" />
            <span>Add</span>
          </button>
        )}
      </div>

      {data.budgets.length > 0 && (
        <div className="bfh-block">
          <div className="bfh-summary bfh-summary--3">
            {stats.map((stat) => (
              <div className="bfh-summary__cell" key={stat.label}>
                <span className="bfh-micro">{stat.label}</span>
                <span className="bfh-summary__value bfh-summary__value--lg">{money(stat.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
          <section className="bfh-card bfh-budgetstart" aria-labelledby="bfh-budgetstart-title">
            <h2 className="bfh-budgetstart__title" id="bfh-budgetstart-title">
              Set your first budget
            </h2>
            <p className="bfh-budgetstart__sub">
              {starters.some((s) => s.monthly > 0)
                ? 'Where your money went over the last three months — tap one to put a limit on it.'
                : 'Pick something to keep an eye on. You can change the amount any time.'}
            </p>
            <ul className="bfh-budgetstart__list">
              {starters.map((s) => {
                const Icon = categoryIcon(data.categoryIcons[s.name])
                return (
                  <li key={s.name}>
                    <button type="button" className="bfh-budgetstart__row" onClick={() => startWith(s)}>
                      <span className="bfh-budgetstart__icon" aria-hidden="true">
                        <Icon size={17} stroke={1.5} />
                      </span>
                      <span className="bfh-budgetstart__body">
                        <span className="bfh-budgetstart__name">{s.name}</span>
                        <span className="bfh-budgetstart__meta">
                          {s.monthly > 0 ? `About ${money(s.monthly)} a month` : 'No spending yet'}
                        </span>
                      </span>
                      <IconChevronRight size={16} stroke={1.5} aria-hidden="true" className="bfh-budgetstart__chev" />
                    </button>
                  </li>
                )
              })}
            </ul>
            <button type="button" className="bfh-btn-outline bfh-budgetstart__other" onClick={() => setEditing({})}>
              <IconPlus size={15} stroke={1.75} aria-hidden="true" />
              Something else
            </button>
          </section>
        )}
      </div>

      {/* Charges that come back every month, each a tap away from a limit. */}
      <section className="bfh-block" aria-labelledby="bfh-recurring-title">
        <div className="bfh-card bfh-subs" data-empty={recurring.length === 0 || undefined}>
          <header className="bfh-subs__head">
            <span className="bfh-subs__icon" aria-hidden="true">
              <IconRepeat size={18} stroke={1.5} />
            </span>
            <div>
              <h2 className="bfh-subs__title" id="bfh-recurring-title">
                Repeating charges
              </h2>
              <p className="bfh-subs__sub">
                {recurring.length > 0
                  ? `${money(recurring.reduce((t, r) => t + r.monthlyCost, 0))} a month across ${recurring.length} — subscriptions, bills, anything that comes back.`
                  : 'Anything charged in two of the last three months shows up here — Spotify, Netflix, internet, rent.'}
              </p>
            </div>
          </header>

          {recurring.length > 0 && (
            <ul className="bfh-subs__list">
              {recurring.map((charge) => {
                const b = charge.budget
                const tone = b ? budgetTone(b.use, b) : null
                return (
                  <li key={charge.key} className="bfh-subs__row">
                    <span className="bfh-subs__avatar" aria-hidden="true">
                      {charge.description.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="bfh-subs__body">
                      <span className="bfh-subs__name">{charge.description}</span>
                      <span className="bfh-subs__meta">
                        {charge.category}
                        {charge.lastCharged ? ` · last ${formatDate(charge.lastCharged)}` : ''}
                      </span>
                    </span>
                    <span className="bfh-subs__cost">
                      {money(charge.monthlyCost)}
                      <span className="bfh-subs__per">/mo</span>
                    </span>
                    {b ? (
                      <button type="button" className="bfh-subs__limit" onClick={() => setEditing(b)}>
                        {tone === 'neg' ? (
                          <SignalBadge tone="neg">Over</SignalBadge>
                        ) : tone === 'warn' ? (
                          <SignalBadge tone="warn">Near limit</SignalBadge>
                        ) : (
                          <span>Limit {money(b.amount)}</span>
                        )}
                      </button>
                    ) : (
                      <button type="button" className="bfh-btn-outline bfh-subs__set" onClick={() => limitFor(charge)}>
                        Set a limit
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      {editing && (
        <BudgetModal
          key={editing.id ?? 'new'}
          budget={editing.id ? editing : (editing.prefill ?? null)}
          categories={data.categories}
          categoryIcons={data.categoryIcons}
          budgets={data.budgets}
          expenses={data.expenses}
          symbol={symbol}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
