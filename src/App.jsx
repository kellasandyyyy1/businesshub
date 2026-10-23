import { useLiveQuery } from 'dexie-react-hooks'
import { Suspense, lazy, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Outlet, Routes, Route } from 'react-router-dom'

import AppShell from './components/AppShell'
import Onboarding from './components/Onboarding'
import Overview from './pages/Overview'
import { PROFILE_HOME } from './config/nav'
import { useProfile } from './context/ProfileContext'
import Budgets from './pages/Budgets'
import CashFlow from './pages/CashFlow'
import ClientDetailPage from './pages/ClientDetailPage'
import Clients from './pages/Clients'
import Dashboard from './pages/Dashboard'
import Expenses from './pages/Expenses'
import HowItWorks from './pages/HowItWorks'
import Income from './pages/Income'
import Invoices from './pages/Invoices'
import Settings from './pages/Settings'
import Transactions from './pages/Transactions'
import PersonalDashboard from './pages/personal/PersonalDashboard'
import PersonalExpenses from './pages/personal/PersonalExpenses'
import PersonalGoals from './pages/personal/PersonalGoals'
import PersonalIncome from './pages/personal/PersonalIncome'
import PersonalNetWorth from './pages/personal/PersonalNetWorth'
import PersonalReports from './pages/personal/PersonalReports'
import PersonalTransactions from './pages/personal/PersonalTransactions'
import { db } from './db/db'

// Reports and Insights carry the heaviest logic and are the least visited;
// they load on demand rather than in the first bundle.
const Reports = lazy(() => import('./pages/Reports'))
const Insights = lazy(() => import('./pages/Insights'))
// Pulls in SheetJS, so it stays out of the first load.
const ExportCenter = lazy(() => import('./pages/Export'))

/**
 * A page belongs to one profile or the other, and reaching it from the wrong
 * one — by typing the path, or following an old bookmark — would show the other
 * profile's data under the wrong heading. These guard whole route subtrees, so
 * the pages themselves stay unaware there are two.
 */
function BusinessOnly() {
  const { isPersonal } = useProfile()
  return isPersonal ? <Navigate to={PROFILE_HOME.personal} replace /> : <Outlet />
}

function PersonalOnly() {
  const { isBusiness } = useProfile()
  return isBusiness ? <Navigate to={PROFILE_HOME.business} replace /> : <Outlet />
}

/** An unknown path lands on whichever profile is open, not always business. */
function ProfileHome() {
  const { profile } = useProfile()
  return <Navigate to={PROFILE_HOME[profile]} replace />
}

/** Undefined while loading, then true when the business has never been set up. */
function useNeedsOnboarding() {
  return useLiveQuery(async () => {
    const rows = await db.settings.toArray()
    const map = Object.fromEntries(rows.map((s) => [s.key, s.value]))
    return map.onboarded !== true && !map.businessName
  }, [])
}

/** How many times this browser has opened the app. Drives the one-time hints. */
function useOpenCount() {
  useEffect(() => {
    try {
      const count = Number(localStorage.getItem('dual-open-count') ?? '0')
      localStorage.setItem('dual-open-count', String(count + 1))
    } catch {
      // A browser refusing storage simply never shows the hints.
    }
  }, [])
}

export default function App() {
  useOpenCount()
  const initiallyNeedsOnboarding = useNeedsOnboarding()
  const [showOnboarding, setShowOnboarding] = useState(null)

  // Latched on first read. The underlying query is live, so without this the
  // overlay would dismiss itself the moment step 1 writes the business name —
  // taking steps 2 and 3 with it.
  useEffect(() => {
    if (initiallyNeedsOnboarding !== undefined && showOnboarding === null) {
      setShowOnboarding(initiallyNeedsOnboarding)
    }
  }, [initiallyNeedsOnboarding, showOnboarding])

  // Nothing renders until the answer is known, so the app never flashes the
  // dashboard on its way to the setup screen.
  if (showOnboarding === null) return null

  return (
    <BrowserRouter>
      {showOnboarding ? (
        <Onboarding onDone={() => setShowOnboarding(false)} />
      ) : (
      <Routes>
        <Route element={<AppShell />}>
          <Route element={<BusinessOnly />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/income" element={<Income />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/clients/:id" element={<ClientDetailPage />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/cashflow" element={<CashFlow />} />
            <Route
              path="/reports"
              element={
                <Suspense fallback={<div className="bfh-page" />}>
                  <Reports />
                </Suspense>
              }
            />
            <Route
              path="/export"
              element={
                <Suspense fallback={<div className="bfh-page" />}>
                  <ExportCenter />
                </Suspense>
              }
            />
            <Route
              path="/insights"
              element={
                <Suspense fallback={<div className="bfh-page" />}>
                  <Insights />
                </Suspense>
              }
            />
          </Route>

          <Route element={<PersonalOnly />}>
            <Route path="/personal" element={<PersonalDashboard />} />
            <Route path="/personal/transactions" element={<PersonalTransactions />} />
            <Route path="/personal/income" element={<PersonalIncome />} />
            <Route path="/personal/expenses" element={<PersonalExpenses />} />
            <Route path="/personal/goals" element={<PersonalGoals />} />
            <Route path="/personal/net-worth" element={<PersonalNetWorth />} />
            <Route path="/personal/reports" element={<PersonalReports />} />
            <Route path="/personal/budgets" element={<Budgets />} />
          </Route>

          {/* Neither profile owns these; both need them. */}
          <Route path="/overview" element={<Overview />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/settings" element={<Settings />} />
          {/* An unknown path would otherwise render nothing at all — not even
              the shell — so send it home. */}
          <Route path="*" element={<ProfileHome />} />
        </Route>
      </Routes>
      )}
    </BrowserRouter>
  )
}
