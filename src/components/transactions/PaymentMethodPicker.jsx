import { IconPlus, IconX } from '@tabler/icons-react'
import { useEffect, useId, useRef, useState } from 'react'

import { useToast } from '../../context/ToastContext'
import { addMethod } from '../../lib/methodStore'

/** Values that are not a method id. */
export const KEEP = '__keep'
const ADD = '__add'

/**
 * The payment method on a transaction, chosen from the list in Settings →
 * Payment methods. The same select as Client above it; its last option adds a
 * method in place — the field turns into a name box with Add and ✕, and the new
 * method is saved to Settings and picked in one go.
 *
 *   value    a method id, '' for none, or KEEP for an older entry whose label
 *            should stay as it is (free text, or a method since removed)
 *   keep     the label KEEP stands for, when there is one
 */
export default function PaymentMethodPicker({ value, onChange, methods, keep }) {
  const id = useId()
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [note, setNote] = useState(null)
  const input = useRef(null)
  const select = useRef(null)

  const list = methods ?? []
  // null while the list loads, so the empty state never flashes up first.
  const empty = methods !== null && list.length === 0

  useEffect(() => {
    if (adding) input.current?.focus()
  }, [adding])

  const close = (focusSelect = true) => {
    setAdding(false)
    setName('')
    if (focusSelect) requestAnimationFrame(() => select.current?.focus())
  }

  const add = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      const { method, existed } = await addMethod(trimmed)
      onChange(method.id)
      setNote(existed ? 'That one already exists.' : null)
      if (!existed) toast.success(`${method.name} added to payment methods`)
      close()
    } catch {
      toast.error("Couldn't save. Try again.")
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      // Inside the transaction form, Enter here adds the method — it must not
      // submit the whole transaction.
      e.preventDefault()
      add()
    } else if (e.key === 'Escape') {
      // Esc closes this row, not the sheet behind it.
      e.preventDefault()
      e.stopPropagation()
      close()
    }
  }

  return (
    <div className="bfh-formfield bfh-pmpicker">
      <label className="bfh-fieldlabel" htmlFor={adding ? `${id}-name` : id}>
        Payment method
      </label>

      {adding ? (
        <div className="bfh-pmpicker__add">
          <input
            ref={input}
            id={`${id}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="e.g. GCash, BDO card, Cash"
            autoComplete="off"
            aria-describedby={`${id}-hint`}
          />
          <button type="button" className="bfh-btn-primary bfh-btn-primary--inline" onClick={add} disabled={!name.trim()}>
            <IconPlus size={14} stroke={1.75} aria-hidden="true" />
            Add
          </button>
          <button type="button" className="bfh-iconaction bfh-pmpicker__cancel" aria-label="Cancel adding a payment method" onClick={() => close()}>
            <IconX size={16} stroke={1.75} aria-hidden="true" />
          </button>
          <span className="bfh-sr" id={`${id}-hint`}>
            Saved to Settings, Payment methods. Enter adds it, Escape cancels.
          </span>
        </div>
      ) : empty && !keep ? (
        // Nothing to choose from yet: the field itself is the way to add one.
        <button type="button" id={id} ref={select} className="bfh-pmpicker__empty" onClick={() => setAdding(true)}>
          <span>No payment methods yet</span>
          <span className="bfh-pmpicker__emptyadd">
            <IconPlus size={14} stroke={1.75} aria-hidden="true" />
            Add one
          </span>
        </button>
      ) : (
        <select
          id={id}
          ref={select}
          value={value}
          onChange={(e) => {
            setNote(null)
            if (e.target.value === ADD) setAdding(true)
            else onChange(e.target.value)
          }}
        >
          <option value="">No payment method</option>
          {keep && <option value={KEEP}>{keep}</option>}
          {list.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
          <option disabled>──────────</option>
          <option value={ADD}>+ Add payment method</option>
        </select>
      )}

      {note && !adding && (
        <span className="bfh-fieldhint" role="status">
          {note}
        </span>
      )}
    </div>
  )
}
