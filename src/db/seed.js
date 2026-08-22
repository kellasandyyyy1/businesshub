/**
 * Sample data for a first run — a Philippine agency ("Broadheader") with six
 * months of books. Amounts are in PHP. Values are deterministic (no random
 * numbers) so the dashboard looks the same on every fresh install.
 */

const SEED_TODAY = '2026-08-21'

/** ISO date `n` days before the seed's "today". */
function daysAgo(n) {
  const d = new Date(`${SEED_TODAY}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

/** ISO date `n` days after the seed's "today". */
const daysAhead = (n) => daysAgo(-n)

const stamp = (isoDate) => new Date(`${isoDate}T09:00:00Z`).toISOString()

/* -------------------------------------------------------------------------
   Categories — name plus the Tabler icon each one renders with
   ------------------------------------------------------------------------- */

export const CATEGORIES = [
  // Income
  { name: 'Client Payments', type: 'income', icon: 'cash' },
  { name: 'Retainers', type: 'income', icon: 'repeat' },
  { name: 'Consulting', type: 'income', icon: 'briefcase' },
  { name: 'Interest Income', type: 'income', icon: 'percentage' },
  // Expense
  { name: 'Software & Subscriptions', type: 'expense', icon: 'device-laptop' },
  { name: 'Office & Rent', type: 'expense', icon: 'building' },
  { name: 'Utilities', type: 'expense', icon: 'bolt' },
  { name: 'Internet & Comms', type: 'expense', icon: 'wifi' },
  { name: 'Travel & Transport', type: 'expense', icon: 'car' },
  { name: 'Meals & Entertainment', type: 'expense', icon: 'tools-kitchen-2' },
  { name: 'Salaries & Contractors', type: 'expense', icon: 'users' },
  { name: 'Marketing', type: 'expense', icon: 'speakerphone' },
  { name: 'Taxes & Government', type: 'expense', icon: 'receipt-tax' },
  { name: 'Equipment', type: 'expense', icon: 'device-desktop' },
  { name: 'Bank Fees', type: 'expense', icon: 'building-bank' },
  { name: 'Professional Services', type: 'expense', icon: 'scale' },
]

/* -------------------------------------------------------------------------
   Clients
   ------------------------------------------------------------------------- */

const CLIENTS = [
  {
    name: 'Maria Santos',
    email: 'maria.santos@acmecorp.ph',
    phone: '+63 917 245 8831',
    company: 'Acme Corp Philippines',
    notes: 'Longest-running retainer. Net 30, pays by BPI transfer.',
  },
  {
    name: 'Ramon dela Cruz',
    email: 'r.delacruz@globe.com.ph',
    phone: '+63 2 7730 1000',
    company: 'Globe Telecom',
    notes: 'Enterprise procurement — PO required before every invoice. Net 45.',
  },
  {
    name: 'Angela Reyes',
    email: 'angela@reyesstudio.co',
    phone: '+63 928 776 4410',
    company: 'Reyes Creative Studio',
    notes: 'Freelance overflow work, billed hourly at PHP 1,800/hr.',
  },
  {
    name: 'Kevin Tan',
    email: 'kevin@sakayph.io',
    phone: '+63 906 331 2277',
    company: 'SakayPH (startup)',
    notes: 'Seed-stage. Discounted rate in exchange for a case study.',
  },
]

/* -------------------------------------------------------------------------
   Transactions — six months of fixed monthly costs plus variable entries
   ------------------------------------------------------------------------- */

const GCASH = 'GCash'
const BPI = 'BPI Transfer'
const CARD = 'BDO Credit Card'
const CASH = 'Cash'

/** Recurring costs booked in each of the last six months. */
const MONTHLY_EXPENSES = [
  {
    description: 'Office rent — Cebu IT Park',
    amount: 38000,
    category: 'Office & Rent',
    paymentMethod: BPI,
    dayOffset: 2,
  },
  {
    description: 'Meralco electricity',
    amount: 6480,
    category: 'Utilities',
    paymentMethod: GCASH,
    dayOffset: 6,
  },
  {
    description: 'PLDT Fibr business plan',
    amount: 3499,
    category: 'Internet & Comms',
    paymentMethod: CARD,
    dayOffset: 8,
  },
  {
    description: 'Contractor payout — 2 designers',
    amount: 62000,
    category: 'Salaries & Contractors',
    paymentMethod: BPI,
    dayOffset: 14,
  },
  {
    description: 'Adobe Creative Cloud + Figma seats',
    amount: 7250,
    category: 'Software & Subscriptions',
    paymentMethod: CARD,
    dayOffset: 18,
  },
  {
    description: 'BIR percentage tax remittance',
    amount: 9800,
    category: 'Taxes & Government',
    paymentMethod: BPI,
    dayOffset: 24,
  },
]

/** Variable entries. `month` is 0 for the current month, 5 for six months back. */
const VARIABLE_TRANSACTIONS = [
  // month 5
  { month: 5, day: 4, type: 'income', description: 'Acme Corp — monthly retainer', amount: 145000, category: 'Retainers', clientCompany: 'Acme Corp Philippines', paymentMethod: BPI },
  { month: 5, day: 12, type: 'income', description: 'Globe Telecom — campaign microsite, milestone 1', amount: 210000, category: 'Client Payments', clientCompany: 'Globe Telecom', paymentMethod: BPI },
  { month: 5, day: 19, type: 'expense', description: 'Grab rides — client pitch week', amount: 4120, category: 'Travel & Transport', paymentMethod: GCASH },
  { month: 5, day: 22, type: 'expense', description: 'Team lunch — project kickoff', amount: 5380, category: 'Meals & Entertainment', paymentMethod: CASH },

  // month 4
  { month: 4, day: 3, type: 'income', description: 'Acme Corp — monthly retainer', amount: 145000, category: 'Retainers', clientCompany: 'Acme Corp Philippines', paymentMethod: BPI },
  { month: 4, day: 9, type: 'income', description: 'Reyes Creative Studio — 40 hrs overflow design', amount: 72000, category: 'Consulting', clientCompany: 'Reyes Creative Studio', paymentMethod: GCASH },
  { month: 4, day: 16, type: 'expense', description: 'Facebook Ads — SakayPH launch support', amount: 18500, category: 'Marketing', paymentMethod: CARD },
  { month: 4, day: 21, type: 'expense', description: 'MacBook Air M4 — new hire', amount: 78990, category: 'Equipment', paymentMethod: CARD },
  { month: 4, day: 27, type: 'expense', description: 'BPI account maintenance fee', amount: 350, category: 'Bank Fees', paymentMethod: BPI },

  // month 3
  { month: 3, day: 5, type: 'income', description: 'Acme Corp — monthly retainer', amount: 145000, category: 'Retainers', clientCompany: 'Acme Corp Philippines', paymentMethod: BPI },
  { month: 3, day: 11, type: 'income', description: 'Globe Telecom — campaign microsite, milestone 2', amount: 210000, category: 'Client Payments', clientCompany: 'Globe Telecom', paymentMethod: BPI },
  { month: 3, day: 17, type: 'income', description: 'SakayPH — brand system (discounted)', amount: 95000, category: 'Client Payments', clientCompany: 'SakayPH (startup)', paymentMethod: BPI },
  { month: 3, day: 20, type: 'expense', description: 'Cebu to Manila flights, 2 pax', amount: 11740, category: 'Travel & Transport', paymentMethod: CARD },
  { month: 3, day: 26, type: 'expense', description: 'Accountant — quarterly filing', amount: 15000, category: 'Professional Services', paymentMethod: BPI },
  { month: 3, day: 28, type: 'transfer', description: 'Transfer to BPI savings — tax reserve', amount: 50000, category: 'Bank Fees', paymentMethod: BPI },

  // month 2
  { month: 2, day: 4, type: 'income', description: 'Acme Corp — monthly retainer', amount: 145000, category: 'Retainers', clientCompany: 'Acme Corp Philippines', paymentMethod: BPI },
  { month: 2, day: 10, type: 'income', description: 'Reyes Creative Studio — 26 hrs overflow design', amount: 46800, category: 'Consulting', clientCompany: 'Reyes Creative Studio', paymentMethod: GCASH },
  { month: 2, day: 15, type: 'expense', description: 'Notion + Linear + Vercel annual', amount: 21400, category: 'Software & Subscriptions', paymentMethod: CARD },
  { month: 2, day: 23, type: 'expense', description: 'Client dinner — Globe account team', amount: 8900, category: 'Meals & Entertainment', paymentMethod: CARD },

  // month 1
  { month: 1, day: 3, type: 'income', description: 'Acme Corp — monthly retainer', amount: 145000, category: 'Retainers', clientCompany: 'Acme Corp Philippines', paymentMethod: BPI },
  { month: 1, day: 8, type: 'income', description: 'Globe Telecom — campaign microsite, final milestone', amount: 180000, category: 'Client Payments', clientCompany: 'Globe Telecom', paymentMethod: BPI },
  { month: 1, day: 13, type: 'income', description: 'BPI business savings interest', amount: 1240, category: 'Interest Income', paymentMethod: BPI },
  { month: 1, day: 19, type: 'expense', description: 'Google Ads — inbound retainer leads', amount: 24000, category: 'Marketing', paymentMethod: CARD },
  { month: 1, day: 25, type: 'expense', description: 'Grab + fuel — site visits', amount: 5630, category: 'Travel & Transport', paymentMethod: GCASH },

  // month 0 (current)
  { month: 0, day: 4, type: 'income', description: 'Acme Corp — monthly retainer', amount: 145000, category: 'Retainers', clientCompany: 'Acme Corp Philippines', paymentMethod: BPI },
  { month: 0, day: 9, type: 'income', description: 'SakayPH — Q3 design retainer', amount: 60000, category: 'Retainers', clientCompany: 'SakayPH (startup)', paymentMethod: BPI, status: 'pending' },
  { month: 0, day: 12, type: 'expense', description: 'Coworking day passes — offsite', amount: 3600, category: 'Office & Rent', paymentMethod: GCASH },
  { month: 0, day: 15, type: 'expense', description: 'SSS / PhilHealth / Pag-IBIG remittance', amount: 12480, category: 'Taxes & Government', paymentMethod: BPI, status: 'pending' },
]

/** Day-zero offset for a month index: 0 = this month, 5 = six months back. */
const monthAnchor = (monthIndex) => monthIndex * 30

function buildTransactions(clientIdByCompany) {
  const rows = []

  for (let month = 0; month < 6; month += 1) {
    for (const fixed of MONTHLY_EXPENSES) {
      const date = daysAgo(monthAnchor(month) + fixed.dayOffset)
      rows.push({
        date,
        description: fixed.description,
        amount: fixed.amount,
        type: 'expense',
        category: fixed.category,
        clientId: null,
        status: 'cleared',
        notes: '',
        receiptUrl: null,
        paymentMethod: fixed.paymentMethod,
        createdAt: stamp(date),
      })
    }
  }

  for (const entry of VARIABLE_TRANSACTIONS) {
    const date = daysAgo(monthAnchor(entry.month) + entry.day)
    rows.push({
      date,
      description: entry.description,
      amount: entry.amount,
      type: entry.type,
      category: entry.category,
      clientId: entry.clientCompany ? clientIdByCompany[entry.clientCompany] : null,
      status: entry.status ?? 'cleared',
      notes: '',
      receiptUrl: null,
      paymentMethod: entry.paymentMethod,
      createdAt: stamp(date),
    })
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date))
}

/* -------------------------------------------------------------------------
   Invoices
   ------------------------------------------------------------------------- */

const VAT_RATE = 0.12

function invoiceTotals(items, discount) {
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.rate, 0)
  const taxable = subtotal - discount
  const tax = Math.round(taxable * VAT_RATE * 100) / 100
  return { subtotal, discount, tax, total: taxable + tax }
}

const INVOICE_DRAFTS = [
  {
    invoiceNumber: 'BH-2026-001',
    company: 'Globe Telecom',
    status: 'paid',
    createdDaysAgo: 168,
    dueDaysAgo: 123,
    sentDaysAgo: 166,
    paidDaysAgo: 130,
    items: [{ description: 'Campaign microsite — milestone 1 (design)', quantity: 1, rate: 210000 }],
    notes: 'PO #GT-448120. Net 45.',
  },
  {
    invoiceNumber: 'BH-2026-002',
    company: 'Acme Corp Philippines',
    status: 'paid',
    createdDaysAgo: 150,
    dueDaysAgo: 120,
    sentDaysAgo: 150,
    paidDaysAgo: 128,
    items: [{ description: 'Monthly design retainer — 60 hrs', quantity: 1, rate: 145000 }],
    notes: 'Net 30, BPI transfer.',
  },
  {
    invoiceNumber: 'BH-2026-003',
    company: 'Reyes Creative Studio',
    status: 'paid',
    createdDaysAgo: 126,
    dueDaysAgo: 96,
    sentDaysAgo: 125,
    paidDaysAgo: 111,
    items: [{ description: 'Overflow design support', quantity: 40, rate: 1800 }],
    notes: 'Billed hourly.',
  },
  {
    invoiceNumber: 'BH-2026-004',
    company: 'SakayPH (startup)',
    status: 'paid',
    createdDaysAgo: 96,
    dueDaysAgo: 66,
    sentDaysAgo: 95,
    paidDaysAgo: 73,
    items: [
      { description: 'Brand system — logo, type, color', quantity: 1, rate: 85000 },
      { description: 'Brand guidelines document', quantity: 1, rate: 25000 },
    ],
    discount: 15000,
    notes: 'Startup rate in exchange for a published case study.',
  },
  {
    invoiceNumber: 'BH-2026-005',
    company: 'Globe Telecom',
    status: 'overdue',
    createdDaysAgo: 72,
    dueDaysAgo: 27,
    sentDaysAgo: 71,
    items: [{ description: 'Campaign microsite — milestone 3 (build QA)', quantity: 1, rate: 165000 }],
    notes: 'Chased twice; procurement says the payment run is 15 Sep.',
  },
  {
    invoiceNumber: 'BH-2026-006',
    company: 'Acme Corp Philippines',
    status: 'sent',
    createdDaysAgo: 18,
    dueDaysAhead: 12,
    sentDaysAgo: 18,
    items: [{ description: 'Monthly design retainer — 60 hrs', quantity: 1, rate: 145000 }],
    notes: 'Net 30.',
  },
  {
    invoiceNumber: 'BH-2026-007',
    company: 'SakayPH (startup)',
    status: 'viewed',
    createdDaysAgo: 11,
    dueDaysAhead: 19,
    sentDaysAgo: 10,
    items: [{ description: 'Q3 product design retainer', quantity: 1, rate: 60000 }],
    notes: 'Opened twice — follow up if unpaid by month end.',
  },
  {
    invoiceNumber: 'BH-2026-008',
    company: 'Reyes Creative Studio',
    status: 'draft',
    createdDaysAgo: 2,
    dueDaysAhead: 28,
    items: [{ description: 'Overflow design support', quantity: 26, rate: 1800 }],
    notes: 'Waiting on the final hour count from Angela.',
  },
]

function buildInvoices(clientIdByCompany) {
  return INVOICE_DRAFTS.map((draft) => {
    const { subtotal, discount, tax, total } = invoiceTotals(draft.items, draft.discount ?? 0)
    return {
      clientId: clientIdByCompany[draft.company],
      invoiceNumber: draft.invoiceNumber,
      status: draft.status,
      items: draft.items.map((i) => ({ ...i, amount: i.quantity * i.rate })),
      subtotal,
      tax,
      discount,
      total,
      dueDate: draft.dueDaysAhead ? daysAhead(draft.dueDaysAhead) : daysAgo(draft.dueDaysAgo),
      notes: draft.notes,
      createdAt: stamp(daysAgo(draft.createdDaysAgo)),
      sentAt: draft.sentDaysAgo ? stamp(daysAgo(draft.sentDaysAgo)) : null,
      paidAt: draft.paidDaysAgo ? stamp(daysAgo(draft.paidDaysAgo)) : null,
    }
  })
}

/* -------------------------------------------------------------------------
   Budgets and settings
   ------------------------------------------------------------------------- */

const BUDGETS = [
  { name: 'Contractor payroll', category: 'Salaries & Contractors', amount: 70000, period: 'monthly' },
  { name: 'Office & utilities', category: 'Office & Rent', amount: 50000, period: 'monthly' },
  { name: 'Software stack', category: 'Software & Subscriptions', amount: 10000, period: 'monthly' },
  { name: 'Marketing spend', category: 'Marketing', amount: 60000, period: 'quarterly' },
  { name: 'Equipment refresh', category: 'Equipment', amount: 240000, period: 'yearly' },
]

const SETTINGS = [
  { key: 'businessName', value: 'Broadheader' },
  { key: 'currency', value: 'PHP' },
  { key: 'symbol', value: '₱' },
  { key: 'locale', value: 'en-PH' },
  { key: 'taxRate', value: VAT_RATE },
  { key: 'fiscalYearStart', value: '01-01' },
  { key: 'theme', value: 'system' },
  { key: 'invoicePrefix', value: 'BH-2026-' },
  { key: 'seededAt', value: SEED_TODAY },
]

/* ------------------------------------------------------------------------- */

/** Populates every table. Runs once, inside a single transaction. */
export async function seedDatabase(db) {
  await db.transaction(
    'rw',
    db.transactions,
    db.clients,
    db.invoices,
    db.budgets,
    db.categories,
    db.settings,
    async () => {
      const createdAt = stamp(daysAgo(180))

      await db.categories.bulkAdd(CATEGORIES.map((c) => ({ ...c, createdAt })))

      const clientIds = await db.clients.bulkAdd(
        CLIENTS.map((c) => ({ ...c, createdAt })),
        { allKeys: true },
      )
      const clientIdByCompany = Object.fromEntries(
        CLIENTS.map((c, i) => [c.company, clientIds[i]]),
      )

      await db.transactions.bulkAdd(buildTransactions(clientIdByCompany))
      await db.invoices.bulkAdd(buildInvoices(clientIdByCompany))
      await db.budgets.bulkAdd(BUDGETS.map((b) => ({ ...b, createdAt })))
      await db.settings.bulkAdd(SETTINGS)
    },
  )
}

export default seedDatabase
