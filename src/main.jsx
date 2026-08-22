import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'
import App from './App.jsx'
import { AssistantActionsProvider } from './context/AssistantActionsContext.jsx'
import { BreakpointProvider } from './context/BreakpointContext.jsx'
import { initDb } from './db/db.js'

// Open (and, on a first run, seed) IndexedDB before the app paints, so pages
// never have to render an "is the database ready?" state.
initDb()
  .catch((err) => {
    console.error('Failed to open the local database', err)
  })
  .finally(() => {
    createRoot(document.getElementById('root')).render(
      <StrictMode>
        <BreakpointProvider>
          <AssistantActionsProvider>
            <App />
          </AssistantActionsProvider>
        </BreakpointProvider>
      </StrictMode>,
    )
  })
