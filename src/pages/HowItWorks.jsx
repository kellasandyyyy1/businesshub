import {
  IconArrowRight,
  IconArrowsExchange,
  IconBuilding,
  IconBulb,
  IconChartPie,
  IconDeviceLaptop,
  IconDownload,
  IconFileInvoice,
  IconKeyboard,
  IconLayoutDashboard,
  IconMessageCircle,
  IconPlus,
  IconReportAnalytics,
  IconScale,
  IconSparkles,
  IconTableExport,
  IconTarget,
  IconTrendingDown,
  IconTrendingUp,
  IconUser,
  IconUsers,
  IconWaveSine,
} from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'

import { PROFILE_HOME } from '../config/nav'
import { useProfile } from '../context/ProfileContext'

/**
 * The plain-language explainer for someone opening BFH for the first time.
 *
 * It reads nothing from Dexie and writes nothing back, so it renders the same
 * whether the database is full or empty. The only live thing on it is the
 * footer, which puts you in a profile rather than only describing one.
 */

/* The icons match the sidebar exactly, so a name here and the same name in the
   nav always carry the same mark. */
const BUSINESS_SECTIONS = [
  {
    icon: IconLayoutDashboard,
    name: 'Dashboard',
    body: 'Your home screen. Cash balance, revenue, expenses, profit, and anything that needs your attention — all in one place.',
  },
  {
    icon: IconArrowsExchange,
    name: 'Transactions',
    body: 'Every peso in and out. Add income and expenses here. Search, filter, and tap any row to see the full details.',
  },
  {
    icon: IconTrendingUp,
    name: 'Income',
    body: 'See where your business revenue comes from — by client and category.',
  },
  {
    icon: IconTrendingDown,
    name: 'Expenses',
    body: 'See where your money goes. Tracks spending, recurring costs, and compares to your budgets.',
  },
  {
    icon: IconFileInvoice,
    name: 'Invoices',
    body: 'Create and send invoices to clients. Track which are paid, unpaid, or overdue. Never lose track of money owed to you.',
  },
  {
    icon: IconUsers,
    name: 'Clients',
    body: 'A profile for every client — revenue, outstanding balance, and full transaction history.',
  },
  {
    icon: IconChartPie,
    name: 'Budgets',
    body: "Set a spending limit per category. BFH warns you when you're getting close so you don't overspend.",
  },
  {
    icon: IconWaveSine,
    name: 'Cash Flow',
    body: 'Shows your current cash and projects what it will look like in the next 30, 60, or 90 days.',
  },
  {
    icon: IconReportAnalytics,
    name: 'Reports',
    body: 'Download professional financial reports — profit and loss, expense summary, revenue breakdown — as PDF or spreadsheet.',
  },
  {
    icon: IconBulb,
    name: 'Insights',
    body: 'BFH reads your data and tells you what it means in plain English. Client concentration risk, margin trends, spending patterns.',
  },
  {
    icon: IconTableExport,
    name: 'Export',
    body: 'Download your data as a spreadsheet — weekly, monthly, or any custom period.',
  },
]

const PERSONAL_SECTIONS = [
  {
    icon: IconLayoutDashboard,
    name: 'Dashboard',
    body: 'Your personal home screen. Take-home income, spending, savings rate, and goals progress at a glance.',
  },
  {
    icon: IconArrowsExchange,
    name: 'Transactions',
    body: 'Every personal peso in and out — salary, food, transport, subscriptions, and anything else.',
  },
  {
    icon: IconTrendingUp,
    name: 'Income',
    body: 'See all your income sources — salary, freelance, investments, and owner draws from your business.',
  },
  {
    icon: IconTrendingDown,
    name: 'Expenses',
    body: 'Track personal spending by category. See recurring costs and where your money actually goes each month.',
  },
  {
    icon: IconTarget,
    name: 'Goals',
    body: 'Set savings targets — emergency fund, vacation, gadget, anything. BFH tracks progress and tells you how much to save per month to hit your deadline.',
  },
  {
    icon: IconScale,
    name: 'Net Worth',
    body: 'Add your assets (savings, investments, property) and liabilities (loans, credit cards). See your real financial position as one number.',
  },
]

const AI_FEATURES = [
  {
    icon: IconMessageCircle,
    title: 'Ask in plain English or Taglish',
    body: 'Magkano ang gastos ko this month? How much did I earn from clients?',
  },
  {
    icon: IconPlus,
    title: 'Add transactions by typing',
    body: "Say 'log 3000 Meralco bill' — it fills the form pre-populated.",
  },
  {
    icon: IconSparkles,
    title: 'Get smart insights',
    body: 'Automatically detects overdue invoices, budget warnings, client concentration risk, and cash runway.',
  },
]

const TIPS = [
  {
    title: 'Set your business name and opening balance',
    body: 'Go to Settings → Business and fill in your business name and how much cash the business currently has.',
  },
  {
    title: 'Add your last 30 days of business transactions',
    body: 'The more history you add, the smarter BFH gets. Start with this month and work backwards.',
  },
  {
    title: 'Create your first invoice',
    body: "If you bill clients, create an invoice now. BFH tracks when it's paid and adds it to your cash flow projections.",
  },
  {
    title: 'Switch to Personal and set your goals',
    body: "Tap Personal in the sidebar. Add a savings goal — emergency fund, vacation, or anything you're working towards.",
  },
  {
    title: 'Try the AI assistant',
    body: "Press Cmd+K and ask 'how much did I spend this month?' — it reads your real data and answers instantly.",
  },
]

function SectionList({ rows }) {
  return (
    <ul className="bfh-howto__list">
      {rows.map((section) => {
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
  )
}

export default function HowItWorks() {
  const navigate = useNavigate()
  const { switchProfile, isPersonal } = useProfile()

  // Arriving in a profile beats reading about it, so the button does both.
  const go = (profile) => {
    switchProfile(profile)
    navigate(PROFILE_HOME[profile])
  }

  // The add form opens on whichever side is currently open, the same way every
  // other entry point reaches it.
  const addTransaction = () =>
    navigate(isPersonal ? '/personal/transactions?new=1' : '/transactions?new=1')

  return (
    <div className="bfh-page bfh-howto">
      {/* ---- Hero ---- */}
      <section className="bfh-block bfh-howto__hero">
        <span className="bfh-howto__tag">How it works</span>
        <h1 className="bfh-howto__headline">
          One app for your business and personal finances.
        </h1>
        <p className="bfh-howto__subline">
          BFH tracks where your money comes from, where it goes, and tells you what it means — for
          both your business and your life.
        </p>

        <div className="bfh-howto__pills">
          <span className="bfh-howto__pill">
            <IconBuilding size={12} stroke={1.5} aria-hidden="true" />
            Business mode
          </span>
          <span className="bfh-howto__pill">
            <IconUser size={12} stroke={1.5} aria-hidden="true" />
            Personal mode
          </span>
        </div>
      </section>

      <hr className="bfh-howto__rule" />

      {/* ---- Two modes ---- */}
      <section className="bfh-block">
        <span className="bfh-howto__tag">Two modes, one app</span>
        <h2 className="bfh-howto__subtitle bfh-howto__subtitle--spaced">
          Switch between Business and Personal anytime.
        </h2>

        <div className="bfh-howto__modes">
          {/* The one inverted card on the page — the whole emphasis budget. */}
          <article className="bfh-howto__mode bfh-howto__mode--invert">
            <IconBuilding size={20} stroke={1.5} aria-hidden="true" className="bfh-howto__modeicon" />
            <h3 className="bfh-howto__modetitle">Business</h3>
            <p className="bfh-howto__modebody">
              Track revenue, expenses, invoices, and clients. Get reports and insights on how your
              business is performing.
            </p>
            <ul className="bfh-howto__modelist">
              <li>Invoices &amp; clients</li>
              <li>Budgets &amp; cash flow</li>
              <li>P&amp;L reports</li>
              <li>AI financial insights</li>
            </ul>
          </article>

          <article className="bfh-card bfh-howto__mode">
            <IconUser size={20} stroke={1.5} aria-hidden="true" className="bfh-howto__modeicon" />
            <h3 className="bfh-howto__modetitle">Personal</h3>
            <p className="bfh-howto__modebody">
              Track your take-home income, spending habits, savings goals, and total net worth.
            </p>
            <ul className="bfh-howto__modelist">
              <li>Income &amp; expenses</li>
              <li>Savings goals</li>
              <li>Net worth tracking</li>
              <li>Spending breakdown</li>
            </ul>
          </article>
        </div>

        <p className="bfh-howto__aside">
          <IconArrowsExchange size={13} stroke={1.5} aria-hidden="true" />
          Switch between modes anytime from the sidebar — your data stays separate.
        </p>
      </section>

      <hr className="bfh-howto__rule" />

      {/* ---- What each section does ---- */}
      <section className="bfh-block">
        <span className="bfh-howto__tag">What each section does</span>
        <h2 className="bfh-howto__subtitle">Here&rsquo;s what every page is for.</h2>

        <span className="bfh-howto__sublabel">Business mode</span>
        <SectionList rows={BUSINESS_SECTIONS} />

        <span className="bfh-howto__sublabel bfh-howto__sublabel--gap">Personal mode</span>
        <SectionList rows={PERSONAL_SECTIONS} />
      </section>

      <hr className="bfh-howto__rule" />

      {/* ---- AI assistant ---- */}
      <section className="bfh-block">
        <span className="bfh-howto__tag">AI assistant</span>
        <h2 className="bfh-howto__subtitle">Ask BFH anything. In English or Filipino.</h2>
        <p className="bfh-howto__body">
          BFH has a built-in AI that knows your finances. Ask questions, get plain-language answers,
          or just say &lsquo;add 500 sa food ko&rsquo; and it opens the form for you.
        </p>

        <ul className="bfh-howto__list">
          {AI_FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <li key={feature.title} className="bfh-howto__row">
                <span className="bfh-howto__iconbox" aria-hidden="true">
                  <Icon size={16} stroke={1.5} />
                </span>
                <span className="bfh-howto__rowbody">
                  <span className="bfh-howto__rowname">{feature.title}</span>
                  <span className="bfh-howto__rowdesc">{feature.body}</span>
                </span>
              </li>
            )
          })}
        </ul>

        <p className="bfh-howto__aside">
          <IconKeyboard size={13} stroke={1.5} aria-hidden="true" />
          Open anytime with Cmd+K or the chat button.
        </p>

        <p className="bfh-howto__note">
          <IconArrowsExchange size={11} stroke={1.5} aria-hidden="true" />
          The AI assistant works in both Business and Personal modes.
        </p>
      </section>

      <hr className="bfh-howto__rule" />

      {/* ---- Business meets personal ---- */}
      <section className="bfh-block">
        <span className="bfh-howto__tag">Business meets personal</span>
        <h2 className="bfh-howto__subtitle">
          Pay yourself from the business — recorded on both sides.
        </h2>
        <p className="bfh-howto__body">
          When you pay yourself an owner draw or salary from the business, BFH records it as an
          expense on the business side and income on your personal side — automatically. No double
          entry.
        </p>

        <div className="bfh-howto__flow">
          <div className="bfh-howto__flowbox">
            <span className="bfh-howto__flowlabel">Business</span>
            <span className="bfh-howto__flowvalue">Owner draw ₱45,000</span>
            <span className="bfh-howto__flownote">Recorded as expense</span>
          </div>

          <IconArrowRight
            size={16}
            stroke={1.5}
            aria-hidden="true"
            className="bfh-howto__flowarrow"
          />

          <div className="bfh-howto__flowbox bfh-howto__flowbox--invert">
            <span className="bfh-howto__flowlabel">BFH</span>
            <span className="bfh-howto__flowvalue">Auto-links</span>
            <span className="bfh-howto__flownote">both sides</span>
          </div>

          <IconArrowRight
            size={16}
            stroke={1.5}
            aria-hidden="true"
            className="bfh-howto__flowarrow"
          />

          <div className="bfh-howto__flowbox">
            <span className="bfh-howto__flowlabel">Personal</span>
            <span className="bfh-howto__flowvalue">Income ₱45,000</span>
            <span className="bfh-howto__flownote">Recorded as income</span>
          </div>
        </div>
      </section>

      <hr className="bfh-howto__rule" />

      {/* ---- Your data ---- */}
      <section className="bfh-block">
        <span className="bfh-howto__tag">Your data</span>
        <h2 className="bfh-howto__subtitle">Everything stays on your device. Both modes.</h2>

        <div className="bfh-howto__pair">
          <article className="bfh-card bfh-howto__step">
            <IconDeviceLaptop size={20} stroke={1.5} aria-hidden="true" className="bfh-howto__stepicon" />
            <h3 className="bfh-howto__steptitle">Stored on this device</h3>
            <p className="bfh-howto__body">
              All business and personal data is saved in your browser. No account, no cloud, no
              server. No one else can see it.
            </p>
          </article>

          <article className="bfh-card bfh-howto__step">
            <IconDownload size={20} stroke={1.5} aria-hidden="true" className="bfh-howto__stepicon" />
            <h3 className="bfh-howto__steptitle">Export anytime</h3>
            <p className="bfh-howto__body">
              Export everything as a spreadsheet or JSON backup from Settings → Data. Business and
              personal data export separately.
            </p>
          </article>
        </div>
      </section>

      <hr className="bfh-howto__rule" />

      {/* ---- Tips ---- */}
      <section className="bfh-block">
        <span className="bfh-howto__tag">Tips to get started</span>
        <h2 className="bfh-howto__subtitle bfh-howto__subtitle--spaced">Do these first.</h2>

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
        <h2 className="bfh-howto__ctahead">Ready?</h2>
        <p className="bfh-howto__body">
          Start with your business or jump into personal — both take under 2 minutes to set up.
        </p>

        <div className="bfh-howto__actions">
          <button
            type="button"
            className="bfh-btn-primary bfh-btn-primary--inline"
            onClick={() => go('business')}
          >
            Go to Business
          </button>
          <button
            type="button"
            className="bfh-btn-ghost bfh-btn-ghost--solid"
            onClick={() => go('personal')}
          >
            Go to Personal
          </button>
          <button
            type="button"
            className="bfh-btn-ghost bfh-btn-ghost--solid"
            onClick={addTransaction}
          >
            Add first transaction
          </button>
        </div>
      </section>
    </div>
  )
}
