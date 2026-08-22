import { useEffect, useRef, useState } from 'react'

import { db, putSetting } from '../../db/db'
import {
  backupSize,
  clearAll,
  downloadJson,
  exportAll,
  formatBytes,
  importAll,
} from '../../lib/backup'
import { formatFullDate } from '../../lib/format'
import useFocusTrap from '../../hooks/useFocusTrap'

/** Typing the word is the guard — no accidental double-click can clear a ledger. */
function ClearModal({ onClose }) {
  const [typed, setTyped] = useState('')
  const [working, setWorking] = useState(false)
  const input = useRef(null)
  const trapRef = useFocusTrap()

  useEffect(() => {
    input.current?.focus()
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const confirm = async () => {
    setWorking(true)
    await clearAll(db)
    // A hard reload is the honest way back: every hook is holding rows that
    // no longer exist.
    window.location.assign('/')
  }

  return (
    <div className="bfh-modal" role="dialog" aria-modal="true" aria-label="Clear all data">
      <button type="button" className="bfh-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="bfh-modal__panel" ref={trapRef}>
        <header className="bfh-modal__head">
          <h2 className="bfh-panel__title">Clear all data</h2>
          <span className="bfh-micro">Cannot be undone</span>
        </header>

        <div className="bfh-form">
          <p className="bfh-settings__note bfh-formfield--wide">
            Every transaction, invoice, client, budget, and setting on this device will be
            erased. Export a backup first if you might want any of it back.
          </p>
          <label className="bfh-formfield bfh-formfield--wide">
            <span className="bfh-micro">Type DELETE to confirm</span>
            <input
              ref={input}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
          </label>
        </div>

        <footer className="bfh-modal__foot">
          <button type="button" className="bfh-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="bfh-btn-danger"
            disabled={typed !== 'DELETE' || working}
            onClick={confirm}
          >
            {working ? 'Clearing…' : 'Clear everything'}
          </button>
        </footer>
      </div>
    </div>
  )
}

export default function DataSection({ settings }) {
  const fileInput = useRef(null)
  const [size, setSize] = useState(null)
  const [status, setStatus] = useState(null)
  const [clearing, setClearing] = useState(false)

  // Sizing the snapshot means building it, so it is done once on mount.
  useEffect(() => {
    let alive = true
    exportAll(db).then((payload) => {
      if (alive) setSize(backupSize(payload))
    })
    return () => {
      alive = false
    }
  }, [settings])

  const onExport = async () => {
    const payload = await exportAll(db)
    const stamp = new Date().toISOString().slice(0, 10)
    downloadJson(`business-finance-hub-${stamp}.json`, payload)
    await putSetting('lastExport', new Date().toISOString())
    setStatus({ text: 'Backup downloaded' })
  }

  const onImport = async (file) => {
    if (!file) return
    try {
      const payload = JSON.parse(await file.text())
      await importAll(db, payload)
      setStatus({ text: 'Data replaced — reloading' })
      window.location.assign('/')
    } catch (err) {
      setStatus({ error: true, text: err.message ?? 'That file could not be read.' })
    }
  }

  const lastExport = settings.lastExport ? formatFullDate(settings.lastExport.slice(0, 10)) : null

  return (
    <div className="bfh-settings__body">
      <h2 className="bfh-panel__title">Data</h2>

      <section className="bfh-datablock">
        <div>
          <h3 className="bfh-datablock__title">Export all data</h3>
          <p className="bfh-settings__note">
            One JSON file holding every table. Keep it somewhere safe — it is the only copy
            besides this browser.
          </p>
          <p className="bfh-micro">
            {lastExport ? `Last export ${lastExport}` : 'Never exported'} ·{' '}
            {size === null ? 'sizing…' : `about ${formatBytes(size)}`}
          </p>
        </div>
        <button type="button" className="bfh-ghostaction" onClick={onExport}>
          Export JSON
        </button>
      </section>

      <section className="bfh-datablock">
        <div>
          <h3 className="bfh-datablock__title">Import data</h3>
          <p className="bfh-settings__note">
            Restores a file made by Export. <strong>This will replace all current data.</strong>
          </p>
        </div>
        <button type="button" className="bfh-ghostaction" onClick={() => fileInput.current?.click()}>
          Choose file
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => onImport(e.target.files?.[0])}
        />
      </section>

      <section className="bfh-datablock bfh-datablock--danger">
        <div>
          <h3 className="bfh-datablock__title">Clear all data</h3>
          <p className="bfh-settings__note">
            Erases everything on this device and leaves the app empty. Sample data will not
            come back.
          </p>
        </div>
        <button type="button" className="bfh-btn-danger" onClick={() => setClearing(true)}>
          Clear all data
        </button>
      </section>

      {status && (
        <span className={status.error ? 'bfh-formerror' : 'bfh-micro'}>{status.text}</span>
      )}

      {clearing && <ClearModal onClose={() => setClearing(false)} />}
    </div>
  )
}
