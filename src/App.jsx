import { useLiveQuery } from 'dexie-react-hooks'
import { Suspense, lazy, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'

import AppShell from './components/AppShell'
import Onboarding from './components/Onboarding'
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
import { db } from './db/db'

// Reports and Insights carry the heaviest logic and are the least visited;
// they load on demand rather than in the first bundle.
const Reports = lazy(() => import('./pages/Reports'))
const Insights = lazy(() => import('./pages/Insights'))
// Pulls in SheetJS, so it stays out of the first load.
const ExportCenter = lazy(() => import('./pages/Export'))

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
      const count = Number(localStorage.getItem('bfh-open-count') ?? '0')
      localStorage.setItem('bfh-open-count', String(count + 1))
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
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/settings" element={<Settings />} />
          {/* An unknown path would otherwise render nothing at all — not even
              the shell — so send it home. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      )}
    </BrowserRouter>
  )
}
