import {
  IconArrowsExchange,
  IconBell,
  IconBulb,
  IconChartArea,
  IconDeviceLaptop,
  IconDownload,
  IconFileInvoice,
  IconLayoutDashboard,
  IconPlus,
  IconReportAnalytics,
  IconSparkles,
  IconTableExport,
  IconTargetArrow,
  IconTrendingDown,
  IconTrendingUp,
  IconUsers,
} from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'

/**
 * The plain-language explainer for someone opening BFH for the first time.
 *
 * Purely informational — it reads nothing from Dexie and writes nothing back,
 * so it renders identically whether the database is full or empty.
 */

const STEPS = [
  {
    number: '01',
    icon: IconPlus,
    title: 'Log your money',
    body: 'Every time money comes in or goes out, add a transaction. Takes 10 seconds. Just the amount, what it was, and the date.',
  },
  {
    number: '02',
    icon: IconSparkles,
    title: 'BFH figures it out',
    body: 'The app reads your transactions and builds your dashboard, charts, reports, and insights automatically. Nothing to set up.',
  },
  {
    number: '03',
    icon: IconBell,
    title: 'Get warned early',
    body: "BFH watches for problems — overdue invoices, budgets running low, cash getting tight — and tells you before it's too late.",
  },
]

/* The icons match the sidebar exactly, so a name on this page and the same name
   in the nav always carry the same mark. */
const SECTIONS = [
  {
    icon: IconLayoutDashboard,
    name: 'Dashboard',
    body: 'Your home screen. Shows your cash, revenue, expenses, profit, and anything that needs your attention — all in one place.',
  },
  {
    icon: IconArrowsExchange,
    name: 'Transactions',
    body: 'Every peso in and out. Add income and expenses here. You can search, filter, and click any transaction to see the full details.',
  },
  {
    icon: IconTrendingUp,
    name: 'Income',
    body: 'See where your money comes from — by client, by category, over time. Helps you spot your best revenue sources.',
  },
  {
    icon: IconTrendingDown,
    name: 'Expenses',
    body: 'See where your money goes. Tracks spending by category, shows recurring costs, and compares to your budgets.',
  },
  {
    icon: IconFileInvoice,
    name: 'Invoices',
    body: "Create and send invoices to clients. Track which ones are paid, unpaid, or overdue. Never lose track of money you're owed.",
  },
  {
    icon: IconUsers,
    name: 'Clients',
    body: "A profile for every client. See how much they've paid, what they owe, and their full transaction history.",
  },
  {
    icon: IconTargetArrow,
    name: 'Budgets',
    body: "Set a spending limit for each category. BFH warns you when you're getting close so you don't overspend.",
  },
  {
    icon: IconChartArea,
    name: 'Cash Flow',
    body: 'Shows your current cash and projects what it will look like in 30, 60, or 90 days based on your income and expenses.',
  },
  {
    icon: IconReportAnalytics,
    name: 'Reports',
    body: 'Download professional financial reports — profit and loss, expense summary, revenue breakdown — as PDF or Excel.',
  },
  {
    icon: IconBulb,
    name: 'Insights',
    body: 'BFH reads your data and tells you what it means in plain English. Things like: which client you rely on too much, or if your costs are quietly creeping up.',
  },
  {
    icon: IconTableExport,
    name: 'Export',
    body: 'Download your data as a spreadsheet anytime — by week, month, or any custom period you choose.',
  },
]

const TIPS = [
  {
    title: 'Set your opening balance',
    body: 'Go to Settings → Business and enter how much cash your business currently has. This gives BFH an accurate starting point.',
  },
  {
    title: 'Add your last 30 days of transactions',
    body: 'The more history you add, the smarter BFH gets. Start with this month and work backwards when you have time.',
  },
  {
    title: 'Create your first invoice',
    body: "If you bill clients, create an invoice now. BFH will track when it's paid and factor it into your cash flow automatically.",
  },
]

export default function HowItWorks() {
  const navigate = useNavigate()

  return (
    <div className="bfh-page bfh-howto">
      {/* ---- Hero ---- */}
      <section className="bfh-block bfh-howto__hero">
        <span className="bfh-howto__tag">How it works</span>
        <h1 className="bfh-howto__headline">Your business finances, finally simple.</h1>
        <p className="bfh-howto__subline">
          BFH tracks your money, spots problems early, and tells you what&rsquo;s happening —
          without the accounting degree.
        </p>
      </section>

      <hr className="bfh-howto__rule" />

      {/* ---- The basics ---- */}
      <section className="bfh-block">
        <span className="bfh-howto__tag">The basics</span>
        <h2 className="bfh-howto__subtitle">Three things. That&rsquo;s all.</h2>

        <div className="bfh-howto__steps">
          {STEPS.map((step) => {
            const Icon = step.icon
            return (
              <article key={step.number} className="bfh-card bfh-howto__step">
                <span className="bfh-howto__stepnum">{step.number}</span>
                <Icon size={22} stroke={1.5} aria-hidden="true" className="bfh-howto__stepicon" />
                <h3 className="bfh-howto__steptitle">{step.title}</h3>
                <p className="bfh-howto__body">{step.body}</p>
              </article>
            )
          })}
        </div>
      </section>

      <hr className="bfh-howto__rule" />

      {/* ---- What each section does ---- */}
      <section className="bfh-block">
        <span className="bfh-howto__tag">What each section does</span>
        <h2 className="bfh-howto__subtitle bfh-howto__subtitle--spaced">
          Eleven sections. Here&rsquo;s what each one is for.
        </h2>

        <ul className="bfh-howto__list">
          {SECTIONS.map((section) => {
            const Icon = section.icon
            return (
              <li key={section.name} className="bfh-howto__row">
                <span className="bfh-howto__iconbox" aria-hidden="true">
                  <Icon size={16} stroke={1.5} />
                </span>
                <span className="bfh-howto__rowbody">
                  <span className="bfh-howto__rowname">{section.name}</span>
                  <span className="bfh-howto__rowdesc">{section.body}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <hr className="bfh-howto__rule" />

      {/* ---- Your data ---- */}
      <section className="bfh-block">
        <span className="bfh-howto__tag">Your data</span>
        <h2 className="bfh-howto__subtitle">Everything stays on your device.</h2>

        <div className="bfh-howto__pair">
          <article className="bfh-card bfh-howto__step">
            <IconDeviceLaptop size={20} stroke={1.5} aria-hidden="true" className="bfh-howto__stepicon" />
            <h3 className="bfh-howto__steptitle">Stored on your device</h3>
            <p className="bfh-howto__body">
              All your transactions, invoices, and reports are saved directly on this device. No
              account needed. No cloud. No one else can see your data.
            </p>
          </article>

          <article className="bfh-card bfh-howto__step">
            <IconDownload size={20} stroke={1.5} aria-hidden="true" className="bfh-howto__stepicon" />
            <h3 className="bfh-howto__steptitle">Export anytime</h3>
            <p className="bfh-howto__body">
              You own your data. Export everything as a spreadsheet or JSON backup at any time from
              Settings → Data. Import it back if you ever need to restore.
            </p>
          </article>
        </div>
      </section>

      <hr className="bfh-howto__rule" />

      {/* ---- Tips ---- */}
      <section className="bfh-block">
        <span className="bfh-howto__tag">Tips to get started</span>
        <h2 className="bfh-howto__subtitle bfh-howto__subtitle--spaced">
          Do these three things first.
        </h2>

        <ol className="bfh-howto__tips">
          {TIPS.map((tip, index) => (
            <li key={tip.title} className="bfh-howto__tip">
              <span className="bfh-howto__tipnum" aria-hidden="true">
                {index + 1}
              </span>
              <span className="bfh-howto__rowbody">
                <span className="bfh-howto__rowname">{tip.title}</span>
                <span className="bfh-howto__rowdesc">{tip.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* ---- Call to action ---- */}
      <section className="bfh-block bfh-howto__cta">
        <h2 className="bfh-howto__ctahead">Ready to start?</h2>
        <p className="bfh-howto__body">Add your first transaction and BFH will do the rest.</p>

        <div className="bfh-howto__actions">
          {/* ?new=1 is how every other entry point opens the add form. */}
          <button
            type="button"
            className="bfh-btn-primary bfh-btn-primary--inline"
            onClick={() => navigate('/transactions?new=1')}
          >
            Add first transaction
          </button>
          <button
            type="button"
            className="bfh-btn-ghost bfh-btn-ghost--solid"
            onClick={() => navigate('/')}
          >
            Go to dashboard
          </button>
        </div>
      </section>
    </div>
  )
}
