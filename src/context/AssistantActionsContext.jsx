import { createContext, useContext, useMemo, useState } from 'react'

/**
 * A one-slot handoff between the assistant and the rest of the app.
 *
 * The assistant never writes to the database. When it works out that someone is
 * describing a transaction, it parks the extracted fields here; whichever screen
 * owns the Add Transaction form picks them up, opens the form filled in, and
 * clears the slot. Saving stays a deliberate act by the person.
 */
const AssistantActionsContext = createContext({
  pendingAction: null,
  triggerAction: () => {},
  clearAction: () => {},
  assistantOpen: false,
  openAssistant: () => {},
  closeAssistant: () => {},
})

export function AssistantActionsProvider({ children }) {
  const [pendingAction, setPendingAction] = useState(null)
  // Whether the panel is showing lives here rather than in the shell, so a hint
  // on the dashboard or a button in onboarding can open it without either one
  // knowing where the panel is rendered.
  const [assistantOpen, setAssistantOpen] = useState(false)

  const value = useMemo(
    () => ({
      pendingAction,
      triggerAction: (action) => setPendingAction(action),
      clearAction: () => setPendingAction(null),
      assistantOpen,
      openAssistant: () => setAssistantOpen(true),
      closeAssistant: () => setAssistantOpen(false),
      toggleAssistant: () => setAssistantOpen((open) => !open),
    }),
    [pendingAction, assistantOpen],
  )

  return (
    <AssistantActionsContext.Provider value={value}>{children}</AssistantActionsContext.Provider>
  )
}

export const useAssistantActions = () => useContext(AssistantActionsContext)

export default AssistantActionsContext
