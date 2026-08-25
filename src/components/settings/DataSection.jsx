import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCheck,
  IconDownload,
  IconFileImport,
} from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'

import { useProfile } from '../../context/ProfileContext'
import { db, putSetting } from '../../db/db'
import { ofProfile } from '../../db/queries'
import {
  buildPreview,
  collectExport,
  exportCounts,
  exportFilename,
  runImport,
  validateExport,
  warningFor,
} from '../../lib/dataExport'
import { clearAll, downloadJson } from '../../lib/backup'
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
            Every transaction, invoice, client, budget, goal, and setting on this device will be
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

const CHOICES = [
  { id: 'both', label: 'Both' },
  { id: 'business', label: 'Business only' },
  { id: 'personal', label: 'Personal only' },
]

const RESTORE_LABEL = {
  both: 'Restore everything →',
  business: 'Restore Business →',
  personal: 'Restore Personal →',
}

/**
 * What is in the file, before any of it is written.
 *
 * A restore replaces rather than merges, so the counts are shown first: the
 * only way to know a backup is the right one is to see what it holds.
 */
function PreviewModal({ parsed, preview, onClose, onDone }) {
  const [choice, setChoice] = useState(preview.hasBoth ? 'both' : preview.sections[0].profile)
  const [working, setWorking] = useState(false)
  const [failed, setFailed] = useState(null)
  const trapRef = useFocusTrap()

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !working) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, working])

  const restore = async () => {
    setWorking(true)
    setFailed(null)
    try {
      await runImport(db, parsed, choice)
      onDone(choice)
    } catch {
      setWorking(false)
      setFailed('Restore failed. Your existing data was not changed.')
    }
  }

  return (
    <div className="bfh-modal" role="dialog" aria-modal="true" aria-label="Restore from backup">
      <button
        type="button"
        className="bfh-modal__backdrop"
        aria-label="Close"
        onClick={() => !working && onClose()}
      />
      <div className="bfh-modal__panel bfh-restore" ref={trapRef}>
        <header className="bfh-restore__head">
          <h2 className="bfh-restore__title">Restore from backup</h2>
          <span className="bfh-micro">Exported {formatFullDate(preview.exportedAt.slice(0, 10))}</span>
        </header>

        <div className="bfh-restore__body">
          {preview.sections.map((section) => (
            <section key={section.profile} className="bfh-restore__section">
              <span className="bfh-micro">{section.label}</span>
              {section.counts.length === 0 ? (
                <p className="bfh-restore__empty">Nothing in this section.</p>
              ) : (
                <ul className="bfh-restore__counts">
                  {section.counts.map((row) => (
                    <li key={row.label}>
                      <span>{row.label}</span>
                      <span className="bfh-restore__count">{row.count.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          {preview.hasBoth && (
            <section className="bfh-restore__section">
              <span className="bfh-micro">Restore</span>
              <div className="bfh-restore__choices" role="radiogroup" aria-label="What to restore">
                {CHOICES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={choice === option.id}
                    className="bfh-restore__choice"
                    data-selected={choice === option.id ? 'true' : 'false'}
                    onClick={() => setChoice(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          <p className="bfh-restore__warn">
            <IconAlertTriangle size={13} stroke={1.5} aria-hidden="true" />
            {warningFor(choice)}
          </p>

          {failed && (
            <p className="bfh-restore__warn" role="alert">
              <IconAlertCircle size={13} stroke={1.5} aria-hidden="true" />
              {failed}
            </p>
          )}
        </div>

        <footer className="bfh-restore__foot">
          <button
            type="button"
            className="bfh-btn-ghost bfh-btn-ghost--solid"
            onClick={onClose}
            disabled={working}
          >
            Cancel
          </button>
          <button
            type="button"
            className="bfh-btn-primary bfh-restore__go"
            onClick={restore}
            disabled={working}
          >
            {working ? 'Restoring…' : RESTORE_LABEL[choice]}
          </button>
        </footer>
      </div>
    </div>
  )
}

export default function DataSection({ settings }) {
  const { activeMode } = useProfile()
  const showPersonal = activeMode === 'personal' || activeMode === 'both'

  const fileInput = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [pending, setPending] = useState(null)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)
  const [clearing, setClearing] = useState(false)

  // Live, so the strip and the button lines answer for what is there now —
  // including straight after a restore.
  const counts = useLiveQuery(() => exportCounts(db), [], null)
  const stats = useLiveQuery(async () => {
    const [transactions, clients, goals] = await Promise.all([
      db.transactions.count(),
      db.clients.filter(ofProfile('business')).count(),
      db.goals.filter(ofProfile('personal')).count(),
    ])
    return { transactions, clients, goals }
  }, [], null)

  useEffect(() => {
    if (!error) return undefined
    const timer = setTimeout(() => setError(null), 5000)
    return () => clearTimeout(timer)
  }, [error])

  useEffect(() => {
    if (!done) return undefined
    const timer = setTimeout(() => setDone(null), 4000)
    return () => clearTimeout(timer)
  }, [done])

  const runExport = async (mode) => {
    const payload = await collectExport(db, mode)
    downloadJson(exportFilename(mode), payload)
    await putSetting('lastExport', new Date().toISOString())
  }

  const readFile = async (file) => {
    if (!file) return
    setError(null)
    try {
      const parsed = JSON.parse(await file.text())
      const problem = validateExport(parsed)
      if (problem) return setError(problem)
      setPending({ parsed, preview: buildPreview(parsed) })
    } catch {
      setError('Could not read this file. Make sure it is a valid Dual backup.')
    }
    return undefined
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    readFile(e.dataTransfer.files?.[0])
  }

  const lastExport = settings.lastExport ? formatFullDate(settings.lastExport.slice(0, 10)) : null

  const line = (side, keys) =>
    counts
      ? keys
          .map(([table, one, many]) => {
            const n = counts[side][table] ?? 0
            return `${n} ${n === 1 ? one : many}`
          })
          .join(' · ')
      : 'counting…'

  const EXPORTS = [
    {
      mode: 'business',
      label: 'Business data',
      sub: line('business', [
        ['transactions', 'transaction', 'transactions'],
        ['clients', 'client', 'clients'],
        ['invoices', 'invoice', 'invoices'],
      ]),
    },
    showPersonal && {
      mode: 'personal',
      label: 'Personal data',
      sub: line('personal', [
        ['transactions', 'transaction', 'transactions'],
        ['goals', 'goal', 'goals'],
        ['netWorth', 'net worth item', 'net worth items'],
      ]),
    },
    {
      mode: 'all',
      label: 'Everything',
      sub: showPersonal ? 'Business + personal + settings' : 'Business data + settings',
    },
  ].filter(Boolean)

  return (
    <div className="bfh-settings__body">
      <h2 className="bfh-panel__title">Data</h2>

      <div className="bfh-datastats">
        <div>
          <span className="bfh-micro">Transactions</span>
          <span className="bfh-datastats__value">{stats?.transactions ?? '—'}</span>
        </div>
        <div>
          <span className="bfh-micro">Clients</span>
          <span className="bfh-datastats__value">{stats?.clients ?? '—'}</span>
        </div>
        <div>
          <span className="bfh-micro">Goals</span>
          <span className="bfh-datastats__value">{stats?.goals ?? '—'}</span>
        </div>
      </div>

      <section className="bfh-dataexport">
        <h3 className="bfh-datablock__title">Export your data</h3>
        <p className="bfh-settings__note">
          Download a backup of your financial data.
          {lastExport ? ` Last export ${lastExport}.` : ' Never exported.'}
        </p>

        <div className="bfh-dataexport__list">
          {EXPORTS.map((item) => (
            <button
              key={item.mode}
              type="button"
              className="bfh-exportrow"
              onClick={() => runExport(item.mode)}
            >
              <IconDownload size={14} stroke={1.5} aria-hidden="true" />
              <span className="bfh-exportrow__body">
                <span className="bfh-exportrow__label">{item.label}</span>
                <span className="bfh-exportrow__sub">{item.sub}</span>
              </span>
              <span className="bfh-exportrow__tag">JSON</span>
            </button>
          ))}
        </div>
      </section>

      <hr className="bfh-datarule" />

      <section className="bfh-dataexport">
        <h3 className="bfh-datablock__title">Restore from backup</h3>
        <p className="bfh-settings__note">Import a previously exported Dual backup file.</p>

        {error && (
          <p className="bfh-restore__warn bfh-restore__warn--inline" role="alert">
            <IconAlertCircle size={13} stroke={1.5} aria-hidden="true" />
            {error}
          </p>
        )}

        {done ? (
          <div className="bfh-restoredone" role="status">
            <IconCheck size={14} stroke={2} aria-hidden="true" />
            <span className="bfh-restoredone__body">
              <span className="bfh-restoredone__head">Data restored successfully.</span>
              <span className="bfh-restoredone__sub">
                {done === 'both'
                  ? 'Your business and personal data has been loaded.'
                  : `Your ${done === 'business' ? 'business' : 'personal'} data has been loaded.`}
              </span>
            </span>
          </div>
        ) : (
          <button
            type="button"
            className="bfh-dropzone"
            data-dragging={dragging ? 'true' : 'false'}
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <IconFileImport size={20} stroke={1.5} aria-hidden="true" />
            <span className="bfh-dropzone__head">Drop a .json file here</span>
            <span className="bfh-dropzone__sub">or click to choose</span>
          </button>
        )}

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => {
            readFile(e.target.files?.[0])
            // Cleared so choosing the same file twice still fires a change.
            e.target.value = ''
          }}
        />
      </section>

      <hr className="bfh-datarule" />

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

      {pending && (
        <PreviewModal
          parsed={pending.parsed}
          preview={pending.preview}
          onClose={() => setPending(null)}
          onDone={(choice) => {
            setPending(null)
            setDone(choice)
          }}
        />
      )}

      {clearing && <ClearModal onClose={() => setClearing(false)} />}
    </div>
  )
}
