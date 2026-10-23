import {
  IconArrowBackUp,
  IconArrowRight,
  IconArrowsExchange,
  IconBell,
  IconBuilding,
  IconBulb,
  IconChartPie,
  IconChevronDown,
  IconChevronRight,
  IconDeviceLaptop,
  IconFileInvoice,
  IconLayoutDashboard,
  IconLayoutGrid,
  IconMessageCircle,
  IconPlus,
  IconReportAnalytics,
  IconScale,
  IconTableExport,
  IconTarget,
  IconTrendingDown,
  IconTrendingUp,
  IconUser,
  IconUsers,
  IconWallet,
  IconWaveSine,
} from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAssistantActions } from '../context/AssistantActionsContext'
import { useProfile } from '../context/ProfileContext'

/**
 * How Dual works, kept short: three ideas, the pages of whichever side you are
 * reading about, how to talk to the assistant, and a few things worth knowing
 * folded away until asked for. Every page row opens that page.
 */

const PAGES = {
  business: [
    { Icon: IconLayoutDashboard, name: 'Dashboard', line: 'Profit, cash and what needs attention.', to: '/' },
    { Icon: IconArrowsExchange, name: 'Transactions', line: 'Every peso in and out.', to: '/transactions' },
    { Icon: IconTrendingUp, name: 'Income', line: 'Where revenue comes from.', to: '/income' },
    { Icon: IconTrendingDown, name: 'Expenses', line: 'Where the money goes.', to: '/expenses' },
    { Icon: IconFileInvoice, name: 'Invoices', line: 'Bill clients, see who has paid.', to: '/invoices' },
    { Icon: IconUsers, name: 'Clients', line: 'What each client pays and owes.', to: '/clients' },
    { Icon: IconChartPie, name: 'Budgets', line: 'Limits per category, with warnings.', to: '/budgets' },
    { Icon: IconWaveSine, name: 'Cash flow', line: 'Your cash, 30 days to a year ahead.', to: '/cashflow' },
    { Icon: IconReportAnalytics, name: 'Reports', line: 'Profit and loss and more, as PDF or Excel.', to: '/reports' },
    { Icon: IconBulb, name: 'Insights', line: 'What your numbers are telling you.', to: '/insights' },
    { Icon: IconTableExport, name: 'Export', line: 'Any record as a spreadsheet.', to: '/export' },
  ],
  personal: [
    { Icon: IconLayoutDashboard, name: 'Dashboard', line: 'What came in, went out, and was kept.', to: '/personal' },
    { Icon: IconArrowsExchange, name: 'Transactions', line: 'Every personal peso in and out.', to: '/personal/transactions' },
    { Icon: IconTrendingUp, name: 'Income', line: 'Salary, side work, owner draws.', to: '/personal/income' },
    { Icon: IconTrendingDown, name: 'Expenses', line: 'Spending by category, and what repeats.', to: '/personal/expenses' },
    { Icon: IconTarget, name: 'Goals', line: 'Save towards a target, with a monthly plan.', to: '/personal/goals' },
    { Icon: IconScale, name: 'Net worth', line: 'What you own minus what you owe.', to: '/personal/net-worth' },
    { Icon: IconReportAnalytics, name: 'Reports', line: 'Spending, savings and more, by period.', to: '/personal/reports' },
  ],
}

const BASICS = [
  { Icon: IconPlus, title: 'Record it', body: 'Tap + to add money in or out. Pick a category and how it was paid.' },
  { Icon: IconLayoutDashboard, title: 'See where you stand', body: 'Each page leads with one number and a sentence on what it means.' },
  { Icon: IconTarget, title: 'Plan ahead', body: 'Budgets, goals and cash flow show what is coming before it arrives.' },
]

const SIGNALS = [
  { tone: 'pos', label: 'Good news', example: 'Paid, goal reached, spending down' },
  { tone: 'warn', label: 'Worth a look', example: 'Due soon, near a budget limit' },
  { tone: 'neg', label: 'Needs action', example: 'Overdue, over budget, low cash' },
]

const ASK = [
  'How much did I spend this month?',
  'Magkano ang kinita ko ngayong buwan?',
  'Add 500 for lunch, paid with GCash',
]

const FAQ = [
  {
    Icon: IconArrowBackUp,
    q: 'Deleted something by mistake?',
    a: 'Tap Undo on the message that appears. You have five seconds.',
  },
  {
    Icon: IconArrowsExchange,
    q: 'Paying yourself from the business?',
    a: 'Record it as an Owner Draw and tick "also record as personal income". Dual books both sides at once.',
  },
  {
    Icon: IconWallet,
    q: 'Using GCash, Maya or a card?',
    a: 'Set your payment methods once in Settings → Payment methods. Each transaction picks from that list.',
  },
  {
    Icon: IconBell,
    q: 'Where do warnings show up?',
    a: 'The bell at the top, and on the page they concern. Turn on push in Settings → Notifications to get them on your phone.',
  },
  {
    Icon: IconDeviceLaptop,
    q: 'Where is my data kept?',
    a: 'Only on this device. No account, no cloud. Download a backup from Settings → Data to keep a copy.',
  },
]

export default function HowItWorks() {
  const navigate = useNavigate()
  const { switchProfile, isPersonal, activeMode } = useProfile()
  const { openAssistant } = useAssistantActions()
  const [side, setSide] = useState(isPersonal ? 'personal' : 'business')
  const shortcut = /mac|iphone|ipad/i.test(globalThis.navigator?.platform ?? '') ? '⌘K' : 'Ctrl+K'

  // Arriving in a profile beats reading about it, so opening a page does both.
  const open = (profile, to) => {
    switchProfile(profile)
    navigate(to)
  }

  // Modes the user has not set up are offered as a short how-to instead.
  const sides = activeMode === 'both' ? ['business', 'personal'] : [activeMode]
  const other = activeMode === 'personal' ? 'Business' : activeMode === 'business' ? 'Personal' : null

  return (
    <div className="bfh-page bfh-how">
      <header className="bfh-block bfh-how__hero">
        <h1 className="bfh-how__title">How Dual works</h1>
        <p className="bfh-how__lead">
          Your business and personal money in one place, kept apart, and explained in plain words.
        </p>
      </header>

      {/* ---- Three ideas ---- */}
      <section className="bfh-block" aria-labelledby="bfh-how-basics">
        <h2 className="bfh-how__h2" id="bfh-how-basics">
          The basics
        </h2>
        <ol className="bfh-how__basics">
          {BASICS.map(({ Icon, title, body }, i) => (
            <li key={title} className="bfh-card bfh-how__basic">
              <span className="bfh-how__basicnum" aria-hidden="true">
                {i + 1}
              </span>
              <Icon className="bfh-how__basicicon" size={20} stroke={1.5} aria-hidden="true" />
              <h3 className="bfh-how__basictitle">{title}</h3>
              <p className="bfh-how__basicbody">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---- Pages, one side at a time ---- */}
      <section className="bfh-block" aria-labelledby="bfh-how-pages">
        <div className="bfh-how__headrow">
          <h2 className="bfh-how__h2" id="bfh-how-pages">
            What each page is for
          </h2>
          {sides.length > 1 && (
            <div className="bfh-segment" role="tablist" aria-label="Mode">
              {sides.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  className="bfh-segment__option"
                  aria-selected={side === s}
                  aria-checked={side === s}
                  onClick={() => setSide(s)}
                >
                  {s === 'business' ? (
                    <IconBuilding size={14} stroke={1.75} aria-hidden="true" />
                  ) : (
                    <IconUser size={14} stroke={1.75} aria-hidden="true" />
                  )}
                  {s === 'business' ? 'Business' : 'Personal'}
                </button>
              ))}
            </div>
          )}
        </div>

        <ul className="bfh-card bfh-how__pages">
          {PAGES[sides.includes(side) ? side : sides[0]].map(({ Icon, name, line, to }) => (
            <li key={to}>
              <button
                type="button"
                className="bfh-how__page"
                onClick={() => open(sides.includes(side) ? side : sides[0], to)}
              >
                <span className="bfh-how__pageicon" aria-hidden="true">
                  <Icon size={16} stroke={1.5} />
                </span>
                <span className="bfh-how__pagebody">
                  <span className="bfh-how__pagename">{name}</span>
                  <span className="bfh-how__pageline">{line}</span>
                </span>
                <IconChevronRight className="bfh-how__pagechev" size={16} stroke={1.5} aria-hidden="true" />
              </button>
            </li>
          ))}
          {activeMode === 'both' && (
            <li>
              <button type="button" className="bfh-how__page" onClick={() => navigate('/overview')}>
                <span className="bfh-how__pageicon" aria-hidden="true">
                  <IconLayoutGrid size={16} stroke={1.5} />
                </span>
                <span className="bfh-how__pagebody">
                  <span className="bfh-how__pagename">Overview</span>
                  <span className="bfh-how__pageline">Business and personal side by side.</span>
                </span>
                <IconChevronRight className="bfh-how__pagechev" size={16} stroke={1.5} aria-hidden="true" />
              </button>
            </li>
          )}
        </ul>

        {other && (
          <p className="bfh-how__note">
            Want {other} too? Turn it on in{' '}
            <button type="button" className="bfh-how__link" onClick={() => navigate('/settings?section=appearance')}>
              Settings → Appearance
            </button>
            .
          </p>
        )}
      </section>

      {/* ---- Colour key ---- */}
      <section className="bfh-block" aria-labelledby="bfh-how-colours">
        <h2 className="bfh-how__h2" id="bfh-how-colours">
          Reading the colours
        </h2>
        <p className="bfh-how__sub">Dual is black and white. Colour only appears when something needs you.</p>
        <ul className="bfh-how__signals">
          {SIGNALS.map(({ tone, label, example }) => (
            <li key={tone} className="bfh-how__signal">
              <span className={`dot dot-${tone}`} aria-hidden="true" />
              <span className="bfh-how__signalbody">
                <span className={`bfh-how__signallabel sig-${tone}`}>{label}</span>
                <span className="bfh-how__signalex">{example}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- Assistant ---- */}
      <section className="bfh-block" aria-labelledby="bfh-how-ask">
        <div className="bfh-card bfh-how__ask">
          <div className="bfh-how__askhead">
            <span className="bfh-how__askicon" aria-hidden="true">
              <IconMessageCircle size={20} stroke={1.5} />
            </span>
            <div>
              <h2 className="bfh-how__h2" id="bfh-how-ask">
                Just ask
              </h2>
              <p className="bfh-how__sub">
                In English, Filipino or Taglish, typed or spoken. It shows you what it will save before anything is saved.
              </p>
            </div>
          </div>
          <ul className="bfh-how__examples" aria-label="Things to try">
            {ASK.map((q) => (
              <li key={q} className="bfh-how__example">
                &ldquo;{q}&rdquo;
              </li>
            ))}
          </ul>
          <div className="bfh-how__askfoot">
            <button type="button" className="bfh-btn-primary bfh-btn-primary--inline" onClick={openAssistant}>
              Open the assistant
              <IconArrowRight size={15} stroke={1.75} aria-hidden="true" />
            </button>
            <span className="bfh-how__kbd">
              or press <kbd>{shortcut}</kbd>
            </span>
          </div>
        </div>
      </section>

      {/* ---- Good to know, folded ---- */}
      <section className="bfh-block" aria-labelledby="bfh-how-faq">
        <h2 className="bfh-how__h2" id="bfh-how-faq">
          Good to know
        </h2>
        <div className="bfh-card bfh-how__faq">
          {FAQ.map(({ Icon, q, a }) => (
            <details key={q} className="bfh-how__qa">
              <summary>
                <Icon className="bfh-how__qaicon" size={16} stroke={1.5} aria-hidden="true" />
                <span>{q}</span>
                <IconChevronDown className="bfh-how__qachev" size={16} stroke={1.5} aria-hidden="true" />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ---- Start ---- */}
      <section className="bfh-block bfh-how__start">
        <button
          type="button"
          className="bfh-btn-primary bfh-btn-primary--inline"
          onClick={() => navigate(isPersonal ? '/personal/transactions?new=1' : '/transactions?new=1')}
        >
          <IconPlus size={15} stroke={1.75} aria-hidden="true" />
          Add a transaction
        </button>
        <span className="bfh-how__note">The quickest way to see Dual working is to give it something to show.</span>
      </section>
    </div>
  )
}
