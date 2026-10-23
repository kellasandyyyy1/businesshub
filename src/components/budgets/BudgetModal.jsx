import { IconCheck, IconX } from '@tabler/icons-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { categoryIcon } from '../../config/categoryIcons'
import { BUDGET_PERIODS, db } from '../../db/db'
import { addBudget } from '../../db/queries'
import { useProfile } from '../../context/ProfileContext'
import { OWNER_DRAW_CATEGORY } from '../../db/defaults'
import { useToast } from '../../context/ToastContext'
import useDismiss from '../../hooks/useDismiss'
import useFocusTrap from '../../hooks/useFocusTrap'
import { PERIOD_WORD, budgetKey, budgetWindow, inBudget, spendForBudget } from '../../lib/budget'
import { formatCurrency, shiftDays } from '../../lib/format'
import { removeWithUndo } from '../../lib/softDelete'
import { short } from '../../lib/toastCopy'

const PERIOD_LABELS = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' }
const PER = { monthly: 'a month', quarterly: 'a quarter', yearly: 'a year' }
const MONTHS_IN = { monthly: 1, quarterly: 3, yearly: 12 }

/** A suggestion people would actually type: to the nearest 100, 500 or 1,000. */
function roundTo(value, up = false) {
  // Finer for small amounts. A ₱149 subscription is not "about ₱100".
  const step = value >= 20000 ? 1000 : value >= 5000 ? 500 : value >= 1000 ? 100 : 10
  return (up ? Math.ceil(value / step) : Math.round(value / step)) * step
}

const labelFor = (name) => (/budget/i.test(name) ? short(name) : `${short(name)} budget`)

/**
 * Adding or editing a budget, in the order people think about it: what to
 * limit, how much, and over what period. Picking a category is enough to name
 * it, and the form shows what that category has actually been costing, so the
 * limit is chosen against real spending rather than guessed.
 */
export default function BudgetModal({ budget, categories, categoryIcons = {}, budgets = [], expenses = [], symbol, onClose }) {
  const [form, setForm] = useState(() => ({
    name: budget?.name ?? '',
    category: budget?.category ?? '',
    amount: budget?.amount ? String(budget.amount) : '',
    period: budget?.period ?? 'monthly',
    match: budget?.match ?? '',
  }))
  // Whole category, or only the payments in it that mention a word.
  const [narrow, setNarrow] = useState(() => Boolean(budget?.match))
  const [errors, setErrors] = useState({})
  // The category list folds to the one picked, so on a phone the amount is
  // not pushed off the screen by fifteen chips.
  const [choosing, setChoosing] = useState(() => !budget?.category)
  const amountField = useRef(null)
  const trapRef = useFocusTrap()
  const toast = useToast()
  const [closing, dismiss] = useDismiss(onClose)
  const { profile } = useProfile()
  const isEdit = Boolean(budget?.id)
  const today = new Date().toISOString().slice(0, 10)
  const money = (v) => formatCurrency(v, symbol)

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dismiss])

  // Only expenses have budgets; income categories would never be spent against,
  // and an owner draw is pay, not spending to keep in check.
  const options = categories.filter((c) => c.type === 'expense' && c.name !== OWNER_DRAW_CATEGORY)
  // The other budgets, by exactly what they watch. Two may share a category
  // as long as they watch different payments in it.
  const others = budgets.filter((b) => b.id !== budget?.id)
  const takenKeys = new Set(others.map(budgetKey))
  const wholeTaken = new Set(others.filter((b) => !b.match).map((b) => b.category))
  const draft = { category: form.category, match: narrow ? form.match : '' }

  // Words worth offering: the payees this category has actually been paid to.
  const payees = useMemo(() => {
    if (!form.category) return []
    const counts = new Map()
    for (const t of expenses) {
      if (t.category !== form.category) continue
      const name = String(t.description ?? '').trim()
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
      .filter((name) => !takenKeys.has(budgetKey({ category: form.category, match: name })))
      .slice(0, 5)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, form.category, budgets])

  // What the chosen category has cost: the average month over the last three
  // full months, and what is already spent in the period being set.
  const history = useMemo(() => {
    if (!form.category) return null
    const monthStart = `${today.slice(0, 7)}-01`
    const threeBack = new Date(`${monthStart}T00:00:00Z`)
    threeBack.setUTCMonth(threeBack.getUTCMonth() - 3)
    const span = [threeBack.toISOString().slice(0, 10), shiftDays(monthStart, -1)]
    const lastThree = spendForBudget(expenses, draft, span)
    // A whole category averages over all three months, quiet ones included. One
    // payee. A subscription. Averages over the months it was actually
    // charged, so a plan started last month is not read as half its price.
    const charged = new Set(
      expenses
        .filter((t) => t.date >= span[0] && t.date <= span[1] && inBudget(t, draft))
        .map((t) => t.date.slice(0, 7)),
    ).size
    const monthly = lastThree / (draft.match ? Math.max(charged, 1) : 3)
    return {
      monthly,
      typical: monthly * MONTHS_IN[form.period],
      soFar: spendForBudget(expenses, draft, budgetWindow(form.period, today)),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, form.category, form.period, form.match, narrow, today])

  const amount = Number(form.amount)
  const hasAmount = form.amount !== '' && amount > 0

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((x) => ({ ...x, [key]: undefined }))
  }

  const pickCategory = (name) => {
    setForm((f) => ({ ...f, category: name }))
    setErrors((x) => ({ ...x, category: undefined }))
    setChoosing(false)
    // A category whose whole budget is taken can still hold narrower ones.
    if (wholeTaken.has(name)) setNarrow(true)
    // Straight on to the next question.
    requestAnimationFrame(() => amountField.current?.focus({ preventScroll: true }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const next = {}
    if (!form.category) next.category = 'Pick what this budget is for'
    else if (narrow && !form.match.trim()) next.match = 'Type the word to look for, e.g. Claude'
    else if (takenKeys.has(budgetKey(draft))) {
      if (narrow) next.match = `There is already a budget for “${form.match.trim()}” in ${form.category}`
      else next.category = `${form.category} already has a whole-category budget. Pick “Only some payments” to add another`
    }
    if (!hasAmount) next.amount = 'Enter how much you can spend'
    setErrors(next)
    if (Object.keys(next).length) return

    const record = {
      // Named after what it watches unless the user gave it a name of its own.
      name: form.name.trim() || (narrow ? form.match.trim() : form.category),
      category: form.category,
      match: narrow ? form.match.trim() : '',
      amount,
      period: form.period,
    }

    try {
      if (isEdit) await db.budgets.update(budget.id, record)
      else await addBudget(profile, record)
    } catch {
      toast.error("Couldn't save. Try again.")
      return
    }
    toast.success(`${labelFor(record.name)} ${isEdit ? 'updated' : 'created'}`)
    dismiss()
  }

  // Straight away, no second tap. The toast that follows carries Undo.
  const remove = async () => {
    dismiss()
    await removeWithUndo(toast, 'budgets', budget.id, `${labelFor(budget.name)} removed`, 'Budget restored')
  }

  const suggestions =
    history && history.typical > 0
      ? [...new Set([roundTo(history.typical), roundTo(history.typical * 1.1, true)])].filter((v) => v > 0)
      : []
  const use = hasAmount && history ? history.soFar / amount : null
  // What the hint calls the money being watched.
  const watching = narrow && form.match.trim() ? `“${form.match.trim()}”` : form.category

  return (
    <div
      className="bfh-modal bfh-sheet"
      data-state={closing ? 'closing' : 'open'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bfh-budgetsheet-title"
    >
      <button type="button" className="bfh-modal__backdrop" aria-label="Close" onClick={dismiss} />

      <form className="bfh-modal__panel" ref={trapRef} onSubmit={onSubmit} noValidate>
        <header className="bfh-sheet__head">
          <h2 id="bfh-budgetsheet-title" className="bfh-sheet__title">
            {isEdit ? 'Edit budget' : 'New budget'}
          </h2>
          <button type="button" className="bfh-sheet__close" aria-label="Close" onClick={dismiss}>
            <IconX size={16} stroke={1.75} aria-hidden="true" />
          </button>
        </header>

        <div className="bfh-sheet__body">
          {/* 1. What it limits */}
          <div className="bfh-formfield" data-invalid={errors.category ? 'true' : undefined}>
            <span className="bfh-fieldlabel" id="bfh-budget-cat">
              What do you want to keep an eye on?
            </span>
            {options.length === 0 ? (
              <p className="bfh-fieldhint">Add an expense category in Settings first.</p>
            ) : !choosing && form.category ? (
              <div className="bfh-budgetpicked">
                {(() => {
                  const Icon = categoryIcon(categoryIcons[form.category])
                  return (
                    <span className="bfh-budgetcat" aria-checked="true" role="radio">
                      <span className="bfh-budgetcat__icon" aria-hidden="true">
                        <Icon size={15} stroke={1.5} />
                      </span>
                      <span className="bfh-budgetcat__name">{form.category}</span>
                    </span>
                  )
                })()}
                <button type="button" className="bfh-btn-text" onClick={() => setChoosing(true)}>
                  Change
                </button>
              </div>
            ) : (
              <div className="bfh-budgetcats" role="radiogroup" aria-labelledby="bfh-budget-cat">
                {options.map((c) => {
                  const Icon = categoryIcon(categoryIcons[c.name] ?? c.icon)
                  const selected = form.category === c.name
                  const already = others.some((b) => b.category === c.name)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className="bfh-budgetcat"
                      data-taken={already || undefined}
                      onClick={() => pickCategory(c.name)}
                    >
                      <span className="bfh-budgetcat__icon" aria-hidden="true">
                        {selected ? <IconCheck size={15} stroke={2.25} /> : <Icon size={15} stroke={1.5} />}
                      </span>
                      <span className="bfh-budgetcat__name">{c.name}</span>
                      {already && <span className="bfh-budgetcat__note">Has a budget</span>}
                    </button>
                  )
                })}
              </div>
            )}
            {errors.category && <span className="bfh-formerror">{errors.category}</span>}
          </div>

          {/* 1b. All of it, or some of it */}
          {form.category && (
            <div className="bfh-formfield" data-invalid={errors.match ? 'true' : undefined}>
              <span className="bfh-fieldlabel" id="bfh-budget-scope">
                What counts
              </span>
              <div className="bfh-segment bfh-segment--fill" role="radiogroup" aria-labelledby="bfh-budget-scope">
                {[
                  { value: false, label: 'Whole category' },
                  { value: true, label: 'Only some payments' },
                ].map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    role="radio"
                    className="bfh-segment__option"
                    aria-checked={narrow === o.value}
                    onClick={() => {
                      setNarrow(o.value)
                      setErrors((x) => ({ ...x, match: undefined, category: undefined }))
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              {narrow && (
                <>
                  <input
                    value={form.match}
                    onChange={set('match')}
                    placeholder="Payments that mention… e.g. Claude"
                    autoComplete="off"
                    aria-label="Only count payments that mention"
                  />
                  {payees.length > 0 && (
                    <div className="bfh-budgetform__suggest" aria-label="From your payments">
                      {payees.map((p) => (
                        <button
                          key={p}
                          type="button"
                          className="bfh-choicechip"
                          aria-pressed={form.match.trim().toLowerCase() === p.toLowerCase()}
                          onClick={() => {
                            setForm((f) => ({ ...f, match: p }))
                            setErrors((x) => ({ ...x, match: undefined }))
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                  <span className="bfh-fieldhint">
                    Counts {form.category} payments whose description or note mentions this word.
                  </span>
                </>
              )}
              {errors.match && <span className="bfh-formerror">{errors.match}</span>}
            </div>
          )}

          {/* 2. How much, over what */}
          <div className="bfh-formfield">
            <span className="bfh-fieldlabel" id="bfh-budget-period">
              Reset every
            </span>
            <div className="bfh-segment bfh-segment--fill" role="radiogroup" aria-labelledby="bfh-budget-period">
              {BUDGET_PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  className="bfh-segment__option"
                  aria-checked={form.period === p}
                  onClick={() => setForm((f) => ({ ...f, period: p }))}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          <label className="bfh-formfield" data-invalid={errors.amount ? 'true' : undefined}>
            <span className="bfh-fieldlabel">Spend up to {PER[form.period]}</span>
            <span className="bfh-moneyfield bfh-budgetform__amount">
              <span className="bfh-moneyfield__symbol" aria-hidden="true">
                {symbol}
              </span>
              <input
                ref={amountField}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0"
                value={form.amount}
                onChange={set('amount')}
                aria-describedby="bfh-budget-hint"
              />
            </span>
            {errors.amount && <span className="bfh-formerror">{errors.amount}</span>}
          </label>

          {/* What the category has really been costing, to set the limit by. */}
          <div className="bfh-budgetform__hint" id="bfh-budget-hint" role="status">
            {!history ? (
              <p>Pick a category to see what it usually costs.</p>
            ) : history.typical > 0 ? (
              <>
                <p>
                  You usually spend about <strong>{money(roundTo(history.typical))}</strong> {PER[form.period]} on{' '}
                  {watching}.
                </p>
                <div className="bfh-budgetform__suggest">
                  {suggestions.map((value, i) => (
                    <button
                      key={value}
                      type="button"
                      className="bfh-choicechip"
                      aria-pressed={amount === value}
                      onClick={() => {
                        setForm((f) => ({ ...f, amount: String(value) }))
                        setErrors((x) => ({ ...x, amount: undefined }))
                      }}
                    >
                      {i === 0 ? 'Match it' : 'A little room'} · {money(value)}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p>No spending on {watching} in the last three months to go by.</p>
            )}
            {use !== null && history.soFar > 0 && (
              <p className="bfh-budgetform__sofar" data-over={use >= 1 || undefined}>
                {money(history.soFar)} already spent {PERIOD_WORD[form.period]},{' '}
                {use >= 1 ? 'over this limit already' : `${Math.round(use * 100)}% of it`}.
              </p>
            )}
          </div>

          {/* 3. Its name. Optional, the category is a fine one */}
          <label className="bfh-formfield">
            <span className="bfh-fieldlabel">
              Name <span className="bfh-fieldlabel__optional">optional</span>
            </span>
            <input
              value={form.name}
              onChange={set('name')}
              placeholder={form.category || 'e.g. Ads spend'}
              autoComplete="off"
            />
          </label>
        </div>

        <footer className="bfh-sheet__foot">
          {isEdit && (
            <button type="button" className="bfh-btn-text bfh-goalform__delete" onClick={remove}>
              Delete budget
            </button>
          )}
          <button type="button" className="bfh-btn-text" onClick={dismiss}>
            Cancel
          </button>
          <button type="submit" className="bfh-btn-primary bfh-sheet__submit">
            {isEdit ? 'Save changes' : 'Create budget'}
          </button>
        </footer>
      </form>
    </div>
  )
}
