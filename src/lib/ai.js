/**
 * Groq API layer.
 *
 * In development the browser calls Groq directly with the key from .env. A
 * deployed build has no key to call with and goes through /api/groq instead,
 * which supplies it server-side — the key is never part of what ships to the
 * browser. Every caller handles a thrown error; nothing here takes the UI down.
 *
 * Financial data still never leaves the device except as the context string the
 * assistant is given for the question being asked.
 */

import { db } from '../db/db'
import { BUSINESS_PROFILE, ofProfile } from '../db/queries'
import { balanceOf, effectiveStatus } from './invoice'
import { budgetWindow, spendFor } from './budget'
import { detectRecurring } from './cashflow'
import { shiftDays } from './format'

/** Built before the profile split, so it reads the business side. */
const inProfile = ofProfile(BUSINESS_PROFILE)

export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

/* Groq retired the Llama chat models this app was built against — a request for
   one now comes back 404 `model_not_found`, which reads like a bad URL but is
   not. These are the current general-purpose models on the account. */
export const MODEL_FAST = 'openai/gpt-oss-20b' // auto-categorize
export const MODEL_DEFAULT = 'openai/gpt-oss-120b' // everything else

/** Roughly four characters to a token; the cap is deliberately conservative. */
const CONTEXT_CHAR_LIMIT = 10_000

/** Path of the serverless proxy that holds the key on a deployed site. */
export const GROQ_PROXY = '/api/groq'

/**
 * A key in the build environment is a development convenience only.
 *
 * Vite inlines anything prefixed VITE_ into the bundle, so on a deployed site
 * that key would be readable by anyone. Hosted builds therefore leave it unset
 * and talk to the proxy instead, which keeps the key server-side.
 */
const devKey = () => (import.meta.env.DEV ? import.meta.env.VITE_GROQ_API_KEY : undefined)

export function getApiKey() {
  const key = devKey()
  if (!key) throw new Error('NO_API_KEY')
  return key
}

/**
 * Whether the assistant is usable at all. In a hosted build the answer is
 * always yes from here — whether the proxy has a key is something only the
 * server knows, and it says so with a 503 the caller turns into a message.
 */
export function hasApiKey() {
  return Boolean(devKey()) || !import.meta.env.DEV
}

/** Attaches a machine-readable `code` so callers can branch without regexes. */
function aiError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

export async function callGroq({
  model = MODEL_DEFAULT,
  system,
  messages = [],
  maxTokens = 1000,
  temperature = 0.2,
  jsonMode = false,
  signal,
}) {
  // With a key on hand (development) the call goes straight out; without one
  // it goes through the proxy, which adds the key server-side.
  const apiKey = devKey()
  const direct = Boolean(apiKey)

  let response
  try {
    response = await fetch(direct ? GROQ_ENDPOINT : GROQ_PROXY, {
      method: 'POST',
      signal,
      headers: {
        ...(direct ? { Authorization: `Bearer ${apiKey}` } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, ...messages],
        max_tokens: maxTokens,
        temperature,
        /* These models think before they answer, and that thinking is billed
           against max_tokens. Left on the default effort the reasoning alone
           can exhaust a caller's budget and return an empty answer — which
           surfaces as `json_validate_failed` on the JSON calls. Low effort
           keeps the budget for the reply the caller actually asked for. */
        ...(model.startsWith('openai/gpt-oss') && { reasoning_effort: 'low' }),
        ...(jsonMode && { response_format: { type: 'json_object' } }),
      }),
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw aiError('NETWORK', 'Could not reach Groq.')
  }

  if (!response.ok) {
    // The proxy answers 503 when the deployment has no key configured.
    if (response.status === 503) throw aiError('NO_API_KEY', 'The assistant is not configured.')
    if (response.status === 401) throw aiError('INVALID_KEY', 'Invalid API key.')
    if (response.status === 429) throw aiError('RATE_LIMIT', 'Rate limit reached.')
    // The body may not be JSON at all on a gateway error.
    const detail = await response.json().catch(() => null)
    throw aiError('UNKNOWN', detail?.error?.message ?? `Groq API error (${response.status}).`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw aiError('PARSE', 'Groq returned no content.')
  return content
}

/** The user-facing sentence for any failure. Never leaks a stack trace. */
export function aiErrorMessage(error) {
  switch (error?.code) {
    case 'NO_API_KEY':
      return 'The assistant is not set up on this deployment.'
    case 'RATE_LIMIT':
      return 'Groq rate limit reached. Try again in a moment.'
    case 'INVALID_KEY':
      return 'Invalid API key. Check Settings → About.'
    case 'NETWORK':
      return 'Could not reach Groq. Check your connection.'
    case 'PARSE':
      return 'AI returned an unexpected response. Try again.'
    default:
      return 'Something went wrong. Try again.'
  }
}

/**
 * Models sometimes wrap JSON in prose or code fences despite instructions, so
 * the parser looks for the outermost object or array before giving up.
 */
export function parseJsonLoose(text) {
  const cleaned = String(text)
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.search(/[{[]/)
    const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'))
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1))
      } catch {
        throw aiError('PARSE', 'AI returned malformed JSON.')
      }
    }
    throw aiError('PARSE', 'AI returned malformed JSON.')
  }
}

/**
 * Splits a prose answer from the JSON block the model appends. Returns the
 * text unchanged when there is no parseable tail.
 */
/**
 * Some models fence the trailing JSON block. The closing fence falls after the
 * final brace and is dropped with the rest of the block, but the opening one
 * sits in the prose half of the split and would otherwise be left dangling
 * under the answer.
 */
const stripTrailingFence = (s) => s.replace(/\s*```[a-z]*\s*$/i, '').trim()

export function splitAnswerAndMeta(text) {
  const source = String(text).trim()
  const end = source.lastIndexOf('}')
  if (end === -1) return { answer: source, meta: null }

  // Walking back from the final brace and balancing depth finds the block's
  // real opening brace. Taking the *last* `{` instead would land inside a
  // nested object — `{"stats":[{…}]}` ends with two closers, not one.
  let depth = 0
  for (let i = end; i >= 0; i -= 1) {
    if (source[i] === '}') depth += 1
    else if (source[i] === '{') {
      depth -= 1
      if (depth === 0) {
        try {
          return {
            answer: stripTrailingFence(source.slice(0, i)),
            meta: JSON.parse(source.slice(i, end + 1)),
          }
        } catch {
          return { answer: source, meta: null }
        }
      }
    }
  }
  return { answer: source, meta: null }
}

/* -------------------------------------------------------------------------
   Financial context
   ------------------------------------------------------------------------- */

const money = (n) => Math.round(Number(n) || 0)

/**
 * A compact, structured text digest of the books. Amounts are plain numbers —
 * currency symbols only confuse the arithmetic the model has to do.
 */
export async function buildFinancialContext(months = 3) {
  const today = new Date().toISOString().slice(0, 10)
  const from = shiftDays(today, -Math.round(months * 30.4))

  const [transactions, clients, invoices, budgets, settings, categories] = await Promise.all([
    db.transactions.where('date').between(from, today, true, true).filter(inProfile).toArray(),
    db.clients.filter(inProfile).toArray(),
    db.invoices.filter(inProfile).toArray(),
    db.budgets.filter(inProfile).toArray(),
    db.settings.toArray(),
    db.categories.filter(inProfile).toArray(),
  ])

  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]))
  const allCleared = await db.transactions.where('status').equals('cleared').filter(inProfile).toArray()
  const currentCash =
    Number(settingsMap.openingBalance ?? 0) +
    allCleared
      .filter((t) => t.type === 'income' || t.type === 'expense')
      .reduce((total, t) => total + (t.type === 'income' ? t.amount : -t.amount), 0)

  const clientNames = Object.fromEntries(clients.map((c) => [c.id, c.company]))
  const lines = []

  lines.push(`BUSINESS: ${settingsMap.businessName ?? 'Unnamed'}`)
  lines.push(`CURRENCY: ${settingsMap.currency ?? 'PHP'} (all amounts are plain numbers)`)
  lines.push(`TODAY: ${today}`)
  lines.push(`CURRENT CASH: ${money(currentCash)}`)
  lines.push('')

  // ---- Monthly aggregates give the model the trend without the row noise.
  const byMonth = new Map()
  for (const t of transactions) {
    if (t.type === 'transfer') continue
    const month = t.date.slice(0, 7)
    const entry = byMonth.get(month) ?? { income: 0, expenses: 0 }
    if (t.type === 'income') entry.income += t.amount
    else entry.expenses += t.amount
    byMonth.set(month, entry)
  }
  lines.push('MONTHLY TOTALS (month, income, expenses, net):')
  for (const [month, v] of [...byMonth.entries()].sort()) {
    lines.push(`${month}, ${money(v.income)}, ${money(v.expenses)}, ${money(v.income - v.expenses)}`)
  }
  lines.push('')

  // ---- Category totals
  const byCategory = new Map()
  for (const t of transactions) {
    if (t.type !== 'expense') continue
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount)
  }
  lines.push('EXPENSE TOTALS BY CATEGORY (category, amount):')
  for (const [name, amount] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`${name}, ${money(amount)}`)
  }
  lines.push('')

  // ---- Clients
  lines.push('CLIENTS (company, revenue in period, outstanding):')
  for (const client of clients) {
    const revenue = transactions
      .filter((t) => t.clientId === client.id && t.type === 'income')
      .reduce((total, t) => total + t.amount, 0)
    const outstanding = invoices
      .filter(
        (i) =>
          i.clientId === client.id && !['paid', 'draft'].includes(effectiveStatus(i, today)),
      )
      .reduce((total, i) => total + balanceOf(i), 0)
    lines.push(`${client.company}, ${money(revenue)}, ${money(outstanding)}`)
  }
  lines.push('')

  // ---- Invoices
  lines.push('INVOICES (number, client, status, total, dueDate):')
  for (const invoice of invoices) {
    lines.push(
      `${invoice.invoiceNumber}, ${clientNames[invoice.clientId] ?? 'unassigned'}, ${effectiveStatus(invoice, today)}, ${money(invoice.total)}, ${invoice.dueDate}`,
    )
  }
  lines.push('')

  // ---- Budgets
  const allTransactions = await db.transactions.filter(inProfile).toArray()
  lines.push('BUDGETS (name, category, period, budgeted, spent this period):')
  for (const budget of budgets) {
    const spent = spendFor(allTransactions, budget.category, budgetWindow(budget.period, today))
    lines.push(
      `${budget.name}, ${budget.category}, ${budget.period}, ${money(budget.amount)}, ${money(spent)}`,
    )
  }
  lines.push('')

  // ---- Recurring costs
  const recurring = detectRecurring(allTransactions, today)
  if (recurring.length) {
    lines.push('DETECTED RECURRING EXPENSES (description, amount, every N days):')
    for (const item of recurring) {
      lines.push(`${item.description}, ${money(item.amount)}, ${item.cadence}`)
    }
    lines.push('')
  }

  lines.push('AVAILABLE CATEGORIES: ' + categories.map((c) => c.name).join('; '))
  lines.push('')

  // ---- Individual transactions last, so truncation drops detail, not shape.
  lines.push('TRANSACTIONS (date, description, amount, category, type) — newest first:')
  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date))
  const header = lines.join('\n')
  const detail = []
  let used = header.length

  for (const t of sorted) {
    const line = `${t.date}, ${t.description}, ${money(t.amount)}, ${t.category}, ${t.type}`
    if (used + line.length > CONTEXT_CHAR_LIMIT) {
      detail.push(`… ${sorted.length - detail.length} older transactions omitted for length`)
      break
    }
    used += line.length + 1
    detail.push(line)
  }

  return `${header}\n${detail.join('\n')}`
}

/**
 * Cheap signature of the data an AI answer was based on. When it changes, a
 * cached result is stale.
 */
export async function dataFingerprint() {
  const [transactions, invoices, clients, budgets] = await Promise.all([
    db.transactions.filter(inProfile).count(),
    db.invoices.filter(inProfile).count(),
    db.clients.filter(inProfile).count(),
    db.budgets.filter(inProfile).count(),
  ])
  const latest = await db.transactions.orderBy('createdAt').filter(inProfile).last()
  const latestInvoice = await db.invoices.orderBy('createdAt').filter(inProfile).last()
  return [
    transactions,
    invoices,
    clients,
    budgets,
    latest?.createdAt ?? '',
    latestInvoice?.createdAt ?? '',
  ].join('|')
}

/* -------------------------------------------------------------------------
   Cache
   ------------------------------------------------------------------------- */

export async function readAiCache(key) {
  return db.aiCache.where('key').equals(key).first()
}

export async function writeAiCache(key, value, dataHash) {
  const existing = await db.aiCache.where('key').equals(key).first()
  const row = { key, value, dataHash, generatedAt: new Date().toISOString() }
  if (existing) await db.aiCache.update(existing.id, row)
  else await db.aiCache.add(row)
  return row
}

/** Re-exported: it is a plain date formatter, and pages that have nothing to
 * do with the model need it too. */
export { timeAgo } from './format'

export const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000

export const isStale = (row, fingerprint) =>
  !row ||
  row.dataHash !== fingerprint ||
  Date.now() - new Date(row.generatedAt).getTime() > CACHE_MAX_AGE_MS
