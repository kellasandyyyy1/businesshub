import { useEffect, useRef, useState } from 'react'

import { db } from '../../db/db'
import { BUSINESS_PROFILE, addClient } from '../../db/queries'
import useFocusTrap from '../../hooks/useFocusTrap'

const emptyClient = () => ({ name: '', company: '', email: '', phone: '', address: '', notes: '' })

export default function ClientModal({ client, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ ...emptyClient(), ...(client ?? {}) }))
  const [errors, setErrors] = useState({})
  const firstField = useRef(null)
  const trapRef = useFocusTrap()
  const isEdit = Boolean(client?.id)

  useEffect(() => {
    firstField.current?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setErrors({ name: 'Required' })
      return
    }

    const record = {
      name: form.name.trim(),
      company: form.company.trim() || form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      notes: form.notes.trim(),
    }

    if (isEdit) {
      await db.clients.update(client.id, record)
      onSaved?.(client.id)
    } else {
      const id = await addClient(BUSINESS_PROFILE, record)
      onSaved?.(id)
    }
    onClose()
  }

  return (
    <div
      className="bfh-modal"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Edit client' : 'Add client'}
    >
      <button type="button" className="bfh-modal__backdrop" aria-label="Close" onClick={onClose} />

      <form className="bfh-modal__panel" ref={trapRef} onSubmit={onSubmit}>
        <header className="bfh-modal__head">
          <h2 className="bfh-panel__title">{isEdit ? 'Edit client' : 'Add client'}</h2>
          <span className="bfh-micro">{isEdit ? `#${client.id}` : 'New client'}</span>
        </header>

        <div className="bfh-form">
          <label className="bfh-formfield">
            <span className="bfh-micro">Name</span>
            <input ref={firstField} value={form.name} onChange={set('name')} />
            {errors.name && <span className="bfh-formerror">{errors.name}</span>}
          </label>

          <label className="bfh-formfield">
            <span className="bfh-micro">Company</span>
            <input value={form.company} onChange={set('company')} />
          </label>

          <label className="bfh-formfield">
            <span className="bfh-micro">Email</span>
            <input type="email" value={form.email} onChange={set('email')} />
          </label>

          <label className="bfh-formfield">
            <span className="bfh-micro">Phone</span>
            <input value={form.phone} onChange={set('phone')} />
          </label>

          <label className="bfh-formfield bfh-formfield--wide">
            <span className="bfh-micro">Address</span>
            <input value={form.address} onChange={set('address')} />
          </label>

          <label className="bfh-formfield bfh-formfield--wide">
            <span className="bfh-micro">Notes</span>
            <textarea rows={3} value={form.notes} onChange={set('notes')} />
          </label>
        </div>

        <footer className="bfh-modal__foot">
          <button type="button" className="bfh-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="bfh-btn-primary">
            Save
          </button>
        </footer>
      </form>
    </div>
  )
}
