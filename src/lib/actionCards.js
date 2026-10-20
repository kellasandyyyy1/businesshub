/**
 * Everything the assistant can offer to write, as confirmation cards.
 *
 * The model proposes; this module decides what the proposal actually means
 * against the books on this device. Each action type has three parts:
 *
 *   prepare — checks the model's fields against real data (categories that
 *             exist, a goal or client by that name, the side being switched
 *             on) and returns a card. Anything that cannot be saved as it
 *             stands gets a `problem`, which turns the card's main button into
 *             "finish it in the form" instead of saving a guess.
 *   save    — writes it through the same helpers the app's own forms use, so a
 *             confirmed card and a filled-in form produce identical rows.
 *   edit    — where the full form lives and what to fill it with.
 *
 * Amounts are always stored unsigned; direction lives in `type`, as it does
 * everywhere else in this database.
 */

import { OWNER_DRAW_CATEGORY } from '../db/defaults'
import { db } from '../db/db'
import {
  BUSINESS_PROFILE,
  addBudget,
  addClient,
  addGoal,
  addInvoice,
  addNetWorthEntry,
  addTransactionWithDraw,
  ofProfile,
} from '../db/queries'
import { contributeToGoal } from '../hooks/useGoals'
import { normalizeAction, resolveCategory } from './assistantAction'
import { computeTotals, nextInvoiceNumber } from './invoice'
import { ASSET_CATEGORIES, LIABILITY_CATEGORIES, fallbackCategory } from './netWorth'
import { isComplete, saveTransactionDirect } from './saveTransaction'

export const CARD_TYPES = new Set([
  'ADD_TRANSACTION',
  'UPDATE_GOAL',
  'ADD_SAVINGS_ENTRY',
  'SET_BUDGET',
  'ADD_INVOICE',
  'ADD_CLIENT',
  'ADD_TRANSFER',
  'UPDATE_NET_WORTH',
])

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const todayISO = () => new Date().toISOString().slice(0, 10)
const isoDate = (value) => (ISO_DATE.test(value ?? '') ? value : null)
const text = (value) => String(value ?? '').trim()
const positive = (value) => {
  const n = Math.abs(Number(value))
  return Number.isFinite(n) && n > 0 ? n : 0
}
const sameName = (a, b) => text(a).toLowerCase() === text(b).toLowerCase()

/** An exact name first, then one that contains the other — "travel" finds "Travel fund". */
function findByName(rows, name, key = 'name') {
  const wanted = text(name).toLowerCase()
  if (!wanted) return null
  return (
    rows.find((r) => sameName(r[key], wanted)) ??
    rows.find((r) => {
      const have = text(r[key]).toLowerCase()
      return have && (have.includes(wanted) || wanted.includes(have))
    }) ??
    null
  )
}

function addDays(iso, days) {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Which side of the books each type writes to. A transfer touches both. */
const SIDE = {
  UPDATE_GOAL: 'personal',
  ADD_SAVINGS_ENTRY: 'personal',
  UPDATE_NET_WORTH: 'personal',
  SET_BUDGET: 'business',
  ADD_INVOICE: 'business',
  ADD_CLIENT: 'business',
  ADD_TRANSFER: 'both',
}

const SIDE_WORD = { business: 'Business', personal: 'Personal' }

function sideProblem(type, activeMode) {
  const side = SIDE[type]
  if (!side || activeMode === 'both') return null
  if (side === 'both') return 'Transfers need both Business and Personal switched on.'
  if (side !== activeMode) return `${SIDE_WORD[side]} is switched off on this device.`
  return null
}

/* ---- Prepare ---------------------------------------------------------------- */

/**
 * Turns the model's raw actions into cards. Reads only the tables the actions
 * in hand need. `ctx` carries the loaded profile, which sides are switched on,
 * the loaded profile's categories, and the settings.
 */
export async function prepareCards(actions, ctx) {
  const types = new Set(actions.map((a) => a?.type))
  const load = (cond, fn) => (cond ? fn() : Promise.resolve([]))

  const [goals, budgets, clients, netWorth, businessCategories] = await Promise.all([
    load(types.has('UPDATE_GOAL') || types.has('ADD_SAVINGS_ENTRY'), () =>
      db.goals.filter(ofProfile('personal')).toArray(),
    ),
    load(types.has('SET_BUDGET'), () => db.budgets.filter(ofProfile(BUSINESS_PROFILE)).toArray()),
    load(types.has('ADD_INVOICE') || types.has('ADD_CLIENT'), () =>
      db.clients.filter(ofProfile(BUSINESS_PROFILE)).toArray(),
    ),
    load(types.has('UPDATE_NET_WORTH'), () => db.netWorth.filter(ofProfile('personal')).toArray()),
    load(types.has('SET_BUDGET'), () => db.categories.filter(ofProfile(BUSINESS_PROFILE)).toArray()),
  ])
  const data = { goals, budgets, clients, netWorth, businessCategories }

  const stamp = Date.now()
  return actions
    .map((action) => (CARD_TYPES.has(action?.type) ? PREPARE[action.type](action.prefill ?? {}, ctx, data, action) : null))
    .filter(Boolean)
    .map((card, i) => {
      const problem = card.problem ?? sideProblem(card.type, ctx.activeMode)
      return { ...card, problem, id: `${stamp}-${i}`, status: 'pending' }
    })
}

const PREPARE = {
  ADD_TRANSACTION(_, ctx, __, action) {
    const prefill = normalizeAction(action, ctx.categories, ctx.methods)
    if (!prefill) return null
    const problem = isComplete(prefill)
      ? null
      : Number(prefill.amount) > 0
        ? 'No matching category — pick one in the form.'
        : 'No amount found — add it in the form.'
    return { type: 'ADD_TRANSACTION', prefill: { ...prefill, profile: ctx.profile }, problem }
  },

  UPDATE_GOAL(p, _, { goals }) {
    const name = text(p.name)
    const target = positive(p.targetAmount ?? p.target)
    const existing = name ? (goals.find((g) => sameName(g.name, name)) ?? null) : null
    return {
      type: 'UPDATE_GOAL',
      existing,
      prefill: {
        name: existing?.name ?? name,
        target,
        current: existing ? Number(existing.current) || 0 : positive(p.currentAmount ?? p.current),
        // An update that names no deadline keeps the one already set.
        deadline: isoDate(p.deadline) ?? existing?.deadline ?? null,
        notes: existing?.notes ?? '',
      },
      problem: !name ? 'No goal name found — add it in the form.' : !target ? 'No target amount found — add it in the form.' : null,
    }
  },

  ADD_SAVINGS_ENTRY(p, _, { goals }) {
    const amount = positive(p.amount)
    const goal = findByName(goals, p.goalName)
    return {
      type: 'ADD_SAVINGS_ENTRY',
      existing: goal,
      prefill: {
        goalName: goal?.name ?? text(p.goalName),
        amount,
        date: isoDate(p.date) ?? todayISO(),
      },
      problem: !amount
        ? 'No amount found.'
        : !goal
          ? `No goal called “${text(p.goalName) || 'that'}” yet — create it first.`
          : null,
    }
  },

  SET_BUDGET(p, _, { budgets, businessCategories }) {
    const category = resolveCategory(p.category, businessCategories, 'expense')
    const amount = positive(p.limit ?? p.amount)
    const period = ['monthly', 'quarterly', 'yearly'].includes(p.period) ? p.period : 'monthly'
    const existing = category
      ? (budgets.find((b) => sameName(b.category, category) && b.period === period) ?? null)
      : null
    return {
      type: 'SET_BUDGET',
      existing,
      prefill: { name: existing?.name ?? category, category, amount, period },
      problem: !category
        ? `No business category matches “${text(p.category)}” — pick one in the form.`
        : !amount
          ? 'No limit found — add it in the form.'
          : null,
    }
  },

  ADD_INVOICE(p, ctx, { clients }) {
    const client = findByName(clients, p.clientName) ?? findByName(clients, p.clientName, 'company')
    const rate = positive(p.amount)
    const taxRate = Math.round((Number(ctx.settings?.taxRate ?? 0.12) || 0) * 10000) / 100
    const totals = computeTotals([{ quantity: 1, rate }], taxRate, 0)
    const issueDate = todayISO()
    return {
      type: 'ADD_INVOICE',
      existing: client,
      prefill: {
        clientId: client?.id ?? null,
        clientName: client ? client.company || client.name : text(p.clientName),
        description: text(p.description) || 'Services',
        rate,
        taxRate,
        ...totals,
        issueDate,
        dueDate: isoDate(p.dueDate) ?? addDays(issueDate, 14),
      },
      problem: !client
        ? `No client named “${text(p.clientName)}” yet — add them first, or pick one in the form.`
        : !rate
          ? 'No amount found — add it in the form.'
          : null,
    }
  },

  ADD_CLIENT(p, _, { clients }) {
    const name = text(p.name)
    const duplicate = name ? clients.find((c) => sameName(c.name, name)) : null
    return {
      type: 'ADD_CLIENT',
      prefill: {
        name,
        company: text(p.company) || name,
        email: text(p.email),
        phone: text(p.phone),
      },
      problem: !name
        ? 'No client name found — add it in the form.'
        : duplicate
          ? `${duplicate.name} is already a client.`
          : null,
    }
  },

  ADD_TRANSFER(p) {
    const amount = positive(p.amount)
    return {
      type: 'ADD_TRANSFER',
      prefill: {
        amount,
        date: isoDate(p.date) ?? todayISO(),
        notes: text(p.notes),
      },
      problem: amount ? null : 'No amount found — add it in the form.',
    }
  },

  UPDATE_NET_WORTH(p, _, { netWorth }) {
    const type = p.entryType === 'liability' ? 'liability' : 'asset'
    const name = text(p.label ?? p.name)
    const amount = positive(p.value ?? p.amount)
    const known = type === 'liability' ? LIABILITY_CATEGORIES : ASSET_CATEGORIES
    const existing = name ? (netWorth.find((e) => e.type === type && sameName(e.name, name)) ?? null) : null
    const category =
      existing?.category ??
      known.find((c) => sameName(c, p.category)) ??
      known.find((c) => text(p.category) && c.toLowerCase().includes(text(p.category).toLowerCase().split(' ')[0])) ??
      fallbackCategory(type)
    return {
      type: 'UPDATE_NET_WORTH',
      existing,
      prefill: { type, name: existing?.name ?? name, category, amount },
      problem: !name ? 'No name found — add it in the form.' : !amount ? 'No value found — add it in the form.' : null,
    }
  },
}

/* ---- Save ------------------------------------------------------------------- */

export async function saveCard(card) {
  const { prefill, existing } = card
  switch (card.type) {
    case 'ADD_TRANSACTION':
      return saveTransactionDirect(prefill, prefill.profile)

    case 'UPDATE_GOAL':
      if (existing) {
        return db.goals.update(existing.id, { target: prefill.target, deadline: prefill.deadline })
      }
      return addGoal('personal', {
        name: prefill.name,
        target: prefill.target,
        current: prefill.current,
        deadline: prefill.deadline,
        notes: '',
      })

    case 'ADD_SAVINGS_ENTRY':
      // Moves the goal forward and files the contribution under Savings, the
      // same two writes the Goals page makes.
      return contributeToGoal(existing, prefill.amount, prefill.date)

    case 'SET_BUDGET':
      if (existing) return db.budgets.update(existing.id, { amount: prefill.amount })
      return addBudget(BUSINESS_PROFILE, {
        name: prefill.name,
        category: prefill.category,
        amount: prefill.amount,
        period: prefill.period,
      })

    case 'ADD_INVOICE': {
      // Numbered at the moment of saving, so two cards confirmed in a row
      // cannot both claim the same number.
      const [invoices, prefixRow] = await Promise.all([
        db.invoices.toArray(),
        db.settings.where('key').equals('invoicePrefix').first(),
      ])
      const now = new Date().toISOString()
      return addInvoice(BUSINESS_PROFILE, {
        clientId: prefill.clientId,
        invoiceNumber: nextInvoiceNumber(invoices, prefixRow?.value ?? 'INV-'),
        status: 'draft',
        items: [{ description: prefill.description, quantity: 1, rate: prefill.rate, amount: prefill.rate }],
        subtotal: prefill.subtotal,
        tax: prefill.tax,
        discount: prefill.discount,
        total: prefill.total,
        taxRate: prefill.taxRate,
        discountRate: 0,
        issueDate: prefill.issueDate,
        dueDate: prefill.dueDate,
        notes: '',
        createdAt: now,
        sentAt: null,
        paidAt: null,
        payments: [],
      })
    }

    case 'ADD_CLIENT':
      return addClient(BUSINESS_PROFILE, { ...prefill, address: '', notes: '' })

    case 'ADD_TRANSFER':
      // The linked pair the transaction form writes when "also record as
      // personal income" is ticked: a business expense under Owner Draw and
      // the matching personal income, each pointing at the other.
      return addTransactionWithDraw(
        {
          date: prefill.date,
          description: prefill.notes || 'Owner draw',
          amount: prefill.amount,
          type: 'expense',
          category: OWNER_DRAW_CATEGORY,
          status: 'cleared',
          paymentMethod: '',
          notes: prefill.notes,
          clientId: null,
          receiptUrl: null,
        },
        { alsoPersonal: true },
      )

    case 'UPDATE_NET_WORTH':
      if (existing) {
        return db.netWorth.update(existing.id, {
          amount: prefill.amount,
          updatedAt: new Date().toISOString(),
        })
      }
      return addNetWorthEntry('personal', { ...prefill, notes: '' })

    default:
      throw new Error(`Unknown action type: ${card.type}`)
  }
}

/* ---- Edit in the full form -------------------------------------------------- */

/**
 * Where a card's full form lives: the side it belongs to, the page, and the
 * action that page picks up to open its form filled in. Null when there is no
 * form that would help — a deposit toward a goal that exists is complete.
 */
export function editTarget(card, loadedProfile) {
  const { prefill, existing } = card
  switch (card.type) {
    case 'ADD_TRANSACTION':
      return {
        side: loadedProfile,
        path: loadedProfile === 'personal' ? '/personal/transactions' : '/transactions',
        action: { type: 'ADD_TRANSACTION', prefill },
      }
    case 'ADD_TRANSFER':
      return {
        side: BUSINESS_PROFILE,
        path: '/transactions',
        action: {
          type: 'ADD_TRANSACTION',
          prefill: {
            description: prefill.notes || 'Owner draw',
            amount: prefill.amount,
            type: 'expense',
            category: OWNER_DRAW_CATEGORY,
            date: prefill.date,
            notes: prefill.notes,
            status: 'cleared',
          },
        },
      }
    case 'UPDATE_GOAL':
      return {
        side: 'personal',
        path: '/personal/goals',
        action: { type: 'UPDATE_GOAL', record: existing ? { ...existing, target: prefill.target, deadline: prefill.deadline } : prefill },
      }
    case 'ADD_SAVINGS_ENTRY':
      if (existing) return null
      // No such goal yet: start one with this deposit as its first savings.
      return {
        side: 'personal',
        path: '/personal/goals',
        action: { type: 'UPDATE_GOAL', record: { name: prefill.goalName, current: prefill.amount } },
      }
    case 'SET_BUDGET':
      return {
        side: BUSINESS_PROFILE,
        path: '/budgets',
        action: { type: 'SET_BUDGET', record: existing ? { ...existing, amount: prefill.amount } : prefill },
      }
    case 'ADD_INVOICE':
      return {
        side: BUSINESS_PROFILE,
        path: '/invoices',
        action: {
          type: 'ADD_INVOICE',
          record: {
            presetClientId: prefill.clientId,
            presetItems: [{ description: prefill.description, quantity: '1', rate: prefill.rate ? String(prefill.rate) : '' }],
            presetDueDate: prefill.dueDate,
          },
        },
      }
    case 'ADD_CLIENT':
      return { side: BUSINESS_PROFILE, path: '/clients', action: { type: 'ADD_CLIENT', record: prefill } }
    case 'UPDATE_NET_WORTH':
      return {
        side: 'personal',
        path: '/personal/net-worth',
        action: { type: 'UPDATE_NET_WORTH', record: existing ? { ...existing, amount: prefill.amount } : prefill },
      }
    default:
      return null
  }
}

/* ---- Navigation --------------------------------------------------------------- */

const ROUTES = {
  '/goals': { personal: '/personal/goals' },
  '/net-worth': { personal: '/personal/net-worth' },
  '/budgets': { business: '/budgets' },
  '/invoices': { business: '/invoices' },
  '/clients': { business: '/clients' },
  '/reports': { business: '/reports', personal: '/personal/reports' },
  '/transactions': { business: '/transactions', personal: '/personal/transactions' },
  '/income': { business: '/income', personal: '/personal/income' },
  '/expenses': { business: '/expenses', personal: '/personal/expenses' },
  '/cashflow': { business: '/cashflow' },
  '/dashboard': { business: '/', personal: '/personal' },
}

/**
 * The real path for a NAVIGATE action, and the side it needs. Pages that exist
 * on both sides stay on the loaded one; a one-sided page names its side so the
 * caller can switch to it first.
 */
export function navigateTarget(route, loadedProfile) {
  const entry = ROUTES[route]
  if (!entry) return null
  if (entry[loadedProfile]) return { side: loadedProfile, path: entry[loadedProfile] }
  const [side, path] = Object.entries(entry)[0]
  return { side, path }
}
