import { useEffect, useRef } from 'react'

import { useAssistantActions } from '../context/AssistantActionsContext'

/**
 * Picks up a draft the assistant handed over with "Edit" and opens this page's
 * form with it. Only the action `type` this page owns is taken; anything else
 * stays parked for the page it belongs to.
 */
export default function useAssistantPrefill(type, open) {
  const { pendingAction, clearAction } = useAssistantActions()
  const openRef = useRef(open)
  openRef.current = open

  useEffect(() => {
    if (pendingAction?.type !== type) return
    openRef.current(pendingAction.record ?? pendingAction.prefill)
    clearAction()
  }, [pendingAction, clearAction, type])
}
