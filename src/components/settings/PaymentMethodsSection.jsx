import { IconCheck, IconPencil, IconPlus, IconTrash, IconX } from '@tabler/icons-react'
import { useState } from 'react'

import PaymentMethodIcon from '../PaymentMethodIcon'
import { useToast } from '../../context/ToastContext'
import { putSetting } from '../../db/db'
import { renameMethod } from '../../lib/methodStore'
import { SUGGESTED_METHODS, matchMethod, methodId, paymentKind } from '../../lib/paymentMethods'

const SAVE_FAIL = "Couldn't save. Try again."

/**
 * How money moves in and out — the one list the transaction form picks from.
 * Each method shows its mark and how often it has been used; the switch decides
 * whether new entries can pick it. Renaming carries through to every entry that
 * used it. Deleting keeps those entries' name, shown as "Name · removed".
 */
export default function PaymentMethodsSection({ paymentMethods, methodUse }) {
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [renaming, setRenaming] = useState(null) // { id, value, error }
  const toast = useToast()

  const save = (next) => putSetting('paymentMethods', next)
  const exists = (value) => Boolean(matchMethod(value, paymentMethods))

  const toggle = async (target) => {
    try {
      await save(paymentMethods.map((m) => (m.id === target.id ? { ...m, active: !m.active } : m)))
    } catch {
      toast.error(SAVE_FAIL)
    }
  }

  const addNamed = async (value) => {
    const trimmed = value.trim()
    if (!trimmed) return setError('Give the method a name')
    if (exists(trimmed)) return setError(`${trimmed} is already on the list`)
    try {
      await save([...paymentMethods, { id: methodId(trimmed, paymentMethods.map((m) => m.id)), name: trimmed, active: true }])
    } catch {
      toast.error(SAVE_FAIL)
      return undefined
    }
    toast.success(`${trimmed} added to payment methods`)
    setName('')
    setError(null)
    return undefined
  }

  const add = (e) => {
    e.preventDefault()
    addNamed(name)
  }

  const remove = async (target) => {
    // The list is one setting, so Undo simply writes back the list as it was.
    const before = paymentMethods
    try {
      await save(paymentMethods.filter((m) => m.id !== target.id))
    } catch {
      toast.error(SAVE_FAIL)
      return
    }
    setError(null)
    toast.undo(`${target.name} removed from payment methods`, () => save(before).catch(() => toast.error(SAVE_FAIL)))
  }

  const commitRename = async () => {
    const value = renaming.value.trim()
    const target = paymentMethods.find((m) => m.id === renaming.id)
    if (!value || !target) return setRenaming(null)
    if (value === target.name) return setRenaming(null)
    const clash = matchMethod(value, paymentMethods)
    if (clash && clash.id !== target.id) return setRenaming({ ...renaming, error: 'That one already exists.' })
    try {
      await renameMethod(target.id, value)
    } catch {
      toast.error(SAVE_FAIL)
      return undefined
    }
    toast.success(`${target.name} renamed to ${value}`)
    setRenaming(null)
    return undefined
  }

  // A brand already on the list under another name — PayMaya for Maya — is not
  // offered again; generic kinds (Debit beside Credit Card) still are.
  const brandsHeld = new Set(paymentMethods.map((m) => paymentKind(m.name)).filter((k) => k.brand).map((k) => k.slug))
  const suggestions = SUGGESTED_METHODS.filter((s) => !exists(s) && !brandsHeld.has(paymentKind(s).slug))
  const activeCount = paymentMethods.filter((m) => m.active).length

  return (
    <div className="bfh-settings__body bfh-pmsection">
      <header className="bfh-pmsection__head">
        <h2 className="bfh-panel__title">Payment methods</h2>
        <p className="bfh-settings__note">
          The ways money moves in and out. Switch one off to hide it from new entries — past
          transactions keep it.
        </p>
      </header>

      {paymentMethods.length === 0 ? (
        <p className="bfh-empty bfh-pmsection__empty">No payment methods yet. Add the ones you use below.</p>
      ) : (
        <ul className="bfh-pmlist" aria-label={`${activeCount} of ${paymentMethods.length} methods offered`}>
          {paymentMethods.map((method) => {
            const used = methodUse[method.id] ?? 0
            const editingThis = renaming?.id === method.id
            return (
              <li key={method.id} className="bfh-pmrow" data-inactive={!method.active || undefined}>
                <PaymentMethodIcon name={editingThis ? renaming.value : method.name} />
                {editingThis ? (
                  <span className="bfh-pmrow__body">
                    <span className="bfh-pmrename">
                      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                      <input
                        autoFocus
                        value={renaming.value}
                        aria-label={`New name for ${method.name}`}
                        aria-invalid={renaming.error ? 'true' : undefined}
                        onChange={(e) => setRenaming({ ...renaming, value: e.target.value, error: null })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            commitRename()
                          } else if (e.key === 'Escape') {
                            setRenaming(null)
                          }
                        }}
                      />
                      <button type="button" className="bfh-iconaction" aria-label="Save name" onClick={commitRename}>
                        <IconCheck size={15} stroke={1.75} aria-hidden="true" />
                      </button>
                      <button type="button" className="bfh-iconaction" aria-label="Cancel rename" onClick={() => setRenaming(null)}>
                        <IconX size={15} stroke={1.75} aria-hidden="true" />
                      </button>
                    </span>
                    <span className={renaming.error ? 'bfh-formerror' : 'bfh-pmrow__meta'}>
                      {renaming.error ?? (used > 0 ? `Past entries will show the new name` : 'Not used yet')}
                    </span>
                  </span>
                ) : (
                  <span className="bfh-pmrow__body">
                    <span className="bfh-pmrow__name">{method.name}</span>
                    <span className="bfh-pmrow__meta">
                      {used > 0 ? `Used on ${used} transaction${used === 1 ? '' : 's'}` : 'Not used yet'}
                      {!method.active && ' · Hidden from new entries'}
                    </span>
                  </span>
                )}

                {!editingThis && (
                  <>
                    <button
                      type="button"
                      className="bfh-iconaction bfh-pmrow__delete"
                      onClick={() => setRenaming({ id: method.id, value: method.name, error: null })}
                      aria-label={`Rename ${method.name}`}
                    >
                      <IconPencil size={15} stroke={1.5} aria-hidden="true" />
                    </button>
                    {/* A used method can go too: its entries keep the name it had,
                        shown as "Name · removed". Undo brings it straight back. */}
                    <button
                      type="button"
                      className="bfh-iconaction bfh-pmrow__delete"
                      onClick={() => remove(method)}
                      aria-label={`Delete ${method.name}`}
                    >
                      <IconTrash size={15} stroke={1.5} aria-hidden="true" />
                    </button>
                  </>
                )}

                <button
                  type="button"
                  className="bfh-switch"
                  role="switch"
                  aria-checked={method.active}
                  aria-label={`Offer ${method.name} on new transactions`}
                  onClick={() => toggle(method)}
                >
                  <span className="bfh-switch__knob" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <form className="bfh-pmadd" onSubmit={add}>
        <label className="bfh-fieldlabel" htmlFor="bfh-pmadd-name">
          Add a method
        </label>
        <div className="bfh-pmadd__row">
          <span className="bfh-pmadd__field" data-error={error ? 'true' : undefined}>
            {/* The mark it will get, as you type — "gcash" turns into GCash's. */}
            <PaymentMethodIcon name={name} size={28} />
            <input
              id="bfh-pmadd-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
              placeholder="e.g. Maya Business"
              autoComplete="off"
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? 'bfh-pmadd-error' : undefined}
            />
          </span>
          <button type="submit" className="bfh-btn-primary bfh-btn-primary--inline">
            <IconPlus size={14} stroke={1.75} aria-hidden="true" />
            <span>Add</span>
          </button>
        </div>
        {error && (
          <span className="bfh-formerror" id="bfh-pmadd-error">
            {error}
          </span>
        )}

        {suggestions.length > 0 && (
          <div className="bfh-pmadd__suggest">
            <span className="bfh-fieldhint">Common in the Philippines</span>
            <div className="bfh-chiprow" role="group" aria-label="Quick add">
              {suggestions.map((s) => (
                <button key={s} type="button" className="bfh-choicechip bfh-pmchip" onClick={() => addNamed(s)}>
                  <PaymentMethodIcon name={s} size={20} />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
