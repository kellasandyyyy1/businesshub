import { IconChevronDown, IconX } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'

import { db } from '../../db/db'
import { BUSINESS_PROFILE, addClient, ofProfile } from '../../db/queries'
import { initialsOf } from '../../hooks/useClients'
import useDismiss from '../../hooks/useDismiss'
import { useToast } from '../../context/ToastContext'
import { short } from '../../lib/toastCopy'
import useFocusTrap from '../../hooks/useFocusTrap'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * A client saved without a company stores their own name in that field, so
 * lists always have something to show. Reading it back, that copy is blanked
 *, the form shows "no company", not the person's name a second time.
 */
function toForm(client) {
  const name = client?.name ?? ''
  const company = client?.company ?? ''
  return {
    name,
    company: company === name ? '' : company,
    email: client?.email ?? '',
    phone: client?.phone ?? '',
    address: client?.address ?? '',
    notes: client?.notes ?? '',
  }
}

/**
 * Adding or editing a client.
 *
 * Only the name is needed. Contact details come next because they are what
 * an invoice uses; address and notes are folded away until wanted. A small
 * preview shows the client as they will appear in the list.
 */
export default function ClientModal({ client, onClose, onSaved }) {
  const [form, setForm] = useState(() => toForm(client))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [showMore, setShowMore] = useState(() => Boolean(client?.address || client?.notes))
  const [closing, dismiss] = useDismiss(onClose)
  const firstField = useRef(null)
  const trapRef = useFocusTrap()
  const toast = useToast()
  const isEdit = Boolean(client?.id)

  const existing = useLiveQuery(() => db.clients.filter(ofProfile(BUSINESS_PROFILE)).toArray(), [], [])

  // Focus once the sheet has settled, and only where there is a keyboard,
  // on a phone it would raise the keyboard mid-animation.
  useEffect(() => {
    if (!window.matchMedia?.('(pointer: fine)').matches) return undefined
    const t = setTimeout(() => firstField.current?.focus(), 260)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dismiss])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const name = form.name.trim()
  const company = form.company.trim()
  // A gentle warning, not a block: two clients can share a name.
  const duplicate =
    name && existing.find((c) => c.id !== client?.id && c.name.trim().toLowerCase() === name.toLowerCase())

  const onSubmit = async (e) => {
    e.preventDefault()
    const next = {}
    if (!name) next.name = 'Add the name of the person or business you bill'
    if (form.email.trim() && !EMAIL.test(form.email.trim())) next.email = 'That email does not look right'
    setErrors(next)
    if (Object.keys(next).length) return

    setSaving(true)
    const record = {
      name,
      company: company || name,
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      notes: form.notes.trim(),
    }

    try {
      if (isEdit) {
        await db.clients.update(client.id, record)
        onSaved?.(client.id)
      } else {
        const id = await addClient(BUSINESS_PROFILE, record)
        onSaved?.(id)
      }
    } catch {
      toast.error("Couldn't save. Try again.")
      return
    }
    toast.success(isEdit ? `${short(record.name)} updated` : `${short(record.name)} added as a client`)
    dismiss()
  }

  return (
    <div
      className="bfh-modal bfh-sheet"
      data-state={closing ? 'closing' : 'open'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bfh-clientsheet-title"
    >
      <button type="button" className="bfh-modal__backdrop" aria-label="Close" onClick={dismiss} />

      <form className="bfh-modal__panel" ref={trapRef} onSubmit={onSubmit} noValidate>
        <header className="bfh-sheet__head">
          <h2 id="bfh-clientsheet-title" className="bfh-sheet__title">
            {isEdit ? 'Edit client' : 'New client'}
          </h2>
          <button type="button" className="bfh-sheet__close" aria-label="Close" onClick={dismiss}>
            <IconX size={16} stroke={1.75} aria-hidden="true" />
          </button>
        </header>

        <div className="bfh-sheet__body">
          {/* How this client will look in the list, filled in as you type. */}
          <div className="bfh-clientpreview" aria-hidden="true">
            <span className="bfh-avatar bfh-avatar--lg">{name ? initialsOf(company || name) : '?'}</span>
            <span className="bfh-clientpreview__body">
              <span className="bfh-clientpreview__name">{company || name || 'Client name'}</span>
              <span className="bfh-clientpreview__meta">
                {company && name ? name : form.email.trim() || form.phone.trim() || 'Contact details'}
              </span>
            </span>
          </div>

          <label className="bfh-formfield" data-invalid={errors.name ? 'true' : undefined}>
            <span className="bfh-fieldlabel">Name</span>
            <input
              ref={firstField}
              value={form.name}
              onChange={set('name')}
              placeholder="e.g. Maria Santos"
              autoComplete="name"
            />
            {errors.name ? (
              <span className="bfh-formerror">{errors.name}</span>
            ) : duplicate ? (
              <span className="bfh-fieldhint">You already have a client called {duplicate.name}.</span>
            ) : null}
          </label>

          <label className="bfh-formfield">
            <span className="bfh-fieldlabel">
              Company <span className="bfh-fieldlabel__optional">optional</span>
            </span>
            <input
              value={form.company}
              onChange={set('company')}
              placeholder="e.g. Santos Trading"
              autoComplete="organization"
            />
            <span className="bfh-fieldhint">Leave blank if you bill a person rather than a business.</span>
          </label>

          <div className="bfh-sheet__pair bfh-clientform__contact">
            <label className="bfh-formfield" data-invalid={errors.email ? 'true' : undefined}>
              <span className="bfh-fieldlabel">
                Email <span className="bfh-fieldlabel__optional">optional</span>
              </span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="off"
                value={form.email}
                onChange={set('email')}
                placeholder="name@company.com"
              />
              {errors.email && <span className="bfh-formerror">{errors.email}</span>}
            </label>

            <label className="bfh-formfield">
              <span className="bfh-fieldlabel">
                Phone <span className="bfh-fieldlabel__optional">optional</span>
              </span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={set('phone')}
                placeholder="0917 123 4567"
              />
            </label>
          </div>

          <button
            type="button"
            className="bfh-sheet__more"
            aria-expanded={showMore}
            onClick={() => setShowMore((v) => !v)}
          >
            <span>More details</span>
            <span className="bfh-sheet__morehint">Address, notes</span>
            <IconChevronDown size={16} stroke={1.5} aria-hidden="true" />
          </button>

          {showMore && (
            <div className="bfh-sheet__extra">
              <label className="bfh-formfield">
                <span className="bfh-fieldlabel">Address</span>
                <input
                  value={form.address}
                  onChange={set('address')}
                  placeholder="e.g. Unit 4, 123 Ayala Ave, Makati"
                  autoComplete="street-address"
                />
              </label>
              <label className="bfh-formfield">
                <span className="bfh-fieldlabel">Notes</span>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={set('notes')}
                  placeholder="Payment terms, who to contact, anything to remember"
                />
              </label>
            </div>
          )}
        </div>

        <footer className="bfh-sheet__foot">
          <button type="button" className="bfh-btn-text" onClick={dismiss}>
            Cancel
          </button>
          <button type="submit" className="bfh-btn-primary bfh-sheet__submit" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add client'}
          </button>
        </footer>
      </form>
    </div>
  )
}
