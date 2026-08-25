import { IconMessageCircle } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { useAssistantActions } from '../context/AssistantActionsContext'
import { PeriodProvider } from '../context/PeriodContext'
import { useProfile } from '../context/ProfileContext'
import { useDevice } from '../context/BreakpointContext'
import useDocumentTitle from '../hooks/useDocumentTitle'
import { useIsCompact, useIsMobile } from '../hooks/useMediaQuery'
import { useNotifications } from '../hooks/useNotifications'
import { useThemeSync } from '../hooks/useTheme'
import AIAssistant from './ai/AIAssistant'
import BottomNav from './BottomNav'
import OfflineBar from './OfflineBar'
import ErrorBoundary from './ErrorBoundary'
import FAB from './FAB'
import MoreDrawer from './MoreDrawer'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function AppShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  // Keeps the stored theme on <html> for the whole app.
  useThemeSync()
  // Names the browser tab after whichever page is open.
  useDocumentTitle()
  const isCompact = useIsCompact()
  const isMobile = useIsMobile()
  // Below 1024px the bottom bar is the navigation, so the sidebar drawer no
  // longer opens; "More" covers what the five slots cannot.
  const { isDesktop } = useDevice()
  const { assistantOpen, openAssistant, closeAssistant, toggleAssistant } = useAssistantActions()
  // The form lives on whichever transactions page belongs to the open profile;
  // sending a personal user to /transactions would only bounce them back.
  const { isPersonal } = useProfile()
  const addTransactionPath = isPersonal ? '/personal/transactions?new=1' : '/transactions?new=1'
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  // Watches the conditions worth alerting on and asks the push backend to
  // deliver any that have crossed their threshold.
  useNotifications()

  // The manifest's "Add Transaction" shortcut lands here with ?action=; the
  // form itself lives on the transactions page, which already opens it on
  // ?new=1.
  useEffect(() => {
    if (params.get('action') !== 'add-transaction') return
    setParams({}, { replace: true })
    navigate(addTransactionPath, { replace: true })
  }, [params, setParams, navigate])

  // Tapping a notification while the app is already open should move the app,
  // not spawn a second window — the worker posts the destination back here.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined
    const onMessage = (event) => {
      if (event.data?.type === 'NAVIGATE' && event.data.link) navigate(event.data.link)
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [navigate])

  // The drawer only exists below 768px; leaving that breakpoint closes it so
  // it can never linger off-screen with the scrim still armed.
  useEffect(() => {
    if (!isMobile) setDrawerOpen(false)
  }, [isMobile])

  useEffect(() => {
    if (isDesktop) setMoreOpen(false)
  }, [isDesktop])

  // Global shortcuts. Typing in a field always wins, so "/" never steals a
  // character from a form.
  useEffect(() => {
    const isTyping = (target) =>
      target instanceof HTMLElement &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)

    const onKeyDown = (e) => {
      const meta = e.metaKey || e.ctrlKey

      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        toggleAssistant()
        return
      }

      if (meta && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        navigate(addTransactionPath)
        return
      }

      if (e.key === '/' && !meta && !isTyping(e.target)) {
        const search = document.querySelector('input[type="search"]')
        if (search) {
          e.preventDefault()
          search.focus()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate, toggleAssistant])

  useEffect(() => {
    if (!drawerOpen) return undefined
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen])

  return (
    <PeriodProvider>
      <div className="bfh-shell">
        <OfflineBar />

        <Sidebar
          collapsed={isCompact}
          open={drawerOpen}
          onNavigate={() => setDrawerOpen(false)}
          // The form lives on the transactions page; ?new=1 opens it there.
          onAddTransaction={() => {
            setDrawerOpen(false)
            navigate(addTransactionPath)
          }}
        />

        {isMobile && drawerOpen && (
          <button
            type="button"
            className="bfh-sidebar__scrim"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
          />
        )}

        <Topbar onOpenMenu={() => setDrawerOpen(true)} onAsk={openAssistant} />

        {/* Keying on the path remounts the blocks, so the entrance stagger
            replays on every navigation. */}
        <main className="bfh-main">
          {/* Keying on the path replays both the page fade and the block
              stagger on every navigation. */}
          <div className="bfh-pagefade" key={pathname}>
            <ErrorBoundary resetKey={pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>

        <button
          type="button"
          className="bfh-ai-fab"
          onClick={openAssistant}
          aria-label="Ask Dual"
          title="Ask Dual (Ctrl+K)"
        >
          <IconMessageCircle size={19} stroke={1.5} aria-hidden="true" />
        </button>

        <BottomNav onOpenMore={() => setMoreOpen(true)} moreOpen={moreOpen} />
        <FAB onClick={() => navigate(addTransactionPath)} />

        {moreOpen && <MoreDrawer onClose={() => setMoreOpen(false)} />}
        {assistantOpen && <AIAssistant onClose={closeAssistant} />}
      </div>
    </PeriodProvider>
  )
}
