import { IconTableExport } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import ExportSheet from './ExportSheet'
import { useDevice } from '../../context/BreakpointContext'

/**
 * The contextual export shortcut used across pages.
 *
 * On a phone it opens the bottom sheet. On larger screens it either hands the
 * Export Center a pre-filled configuration, or — when the caller needs a
 * filter the Export Center cannot express, like a single client — exports
 * straight away via `onDirect`.
 */
export default function ExportButton({
  typeId,
  label = 'Export',
  period = 'this-month',
  from,
  to,
  clientId,
  onDirect,
  className = 'bfh-ghostaction',
}) {
  const { isMobile } = useDevice()
  const navigate = useNavigate()
  const [sheetOpen, setSheetOpen] = useState(false)

  const open = () => {
    if (isMobile) {
      setSheetOpen(true)
      return
    }
    if (onDirect) {
      onDirect()
      return
    }
    const query = new URLSearchParams({ type: typeId })
    if (from && to) {
      query.set('from', from)
      query.set('to', to)
    } else {
      query.set('period', period)
    }
    navigate(`/export?${query.toString()}`)
  }

  return (
    <>
      <button type="button" className={className} onClick={open}>
        <IconTableExport size={12} stroke={1.5} aria-hidden="true" />
        {label}
      </button>

      {sheetOpen && (
        <ExportSheet
          typeId={typeId}
          defaultPreset={period}
          clientId={clientId}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  )
}
