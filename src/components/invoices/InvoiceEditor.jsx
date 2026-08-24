import { IconArrowLeft, IconTrash, IconX } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'

import { db } from '../../db/db'
import { BUSINESS_PROFILE, addInvoice } from '../../db/queries'
import { formatCurrency } from '../../lib/format'
import { computeTotals, issueDateOf, lineTotal, ratesOf } from '../../lib/invoice'

const TODAY = () => new Date().toISOString().slice(0, 10)
const blankItem = () => ({ description: '', quantity: '1', rate: '' })

function toForm(invoice, { invoiceNumber, taxRate, defaultClientId }) {
  if (!invoice) {
    return {
      clientId: defaultClientId ? String(defaultClientId) : '',
      invoiceNumber,
      issueDate: TODAY(),
      dueDate: TODAY(),
      items: [blankItem()],
      taxRate: String(taxRate),
      discountRate: '0',
      notes: '',
    }
  }
  const rates = ratesOf(invoice, taxRate)
  return {
    clientId: invoice.clientId ? String(invoice.clientId) : '',
    invoiceNumber: invoice.invoiceNumber,
    issueDate: issueDateOf(invoice),
    dueDate: invoice.dueDate,
    items: invoice.items.map((i) => ({
      description: i.description,
      quantity: String(i.quantity),
      rate: String(i.rate),
    })),
    taxRate: String(rates.taxRate),
    discountRate: String(rates.discountRate),
    notes: invoice.notes ?? '',
  }
}

export default function InvoiceEditor({
  invoice,
  clients,
  nextNumber,
  defaultClientId,
  defaultTaxRate,
  symbol,
  onClose,
}) {
  const [form, setForm] = useState(() =>
    toForm(invoice, { invoiceNumber: nextNumber, taxRate: defaultTaxRate, defaultClientId }),
  )
  const [errors, setErrors] = useState({})
  const isNew = !invoice?.id

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Recomputed on every keystroke — the totals are never stale.
  const totals = useMemo(
    () => computeTotals(form.items, form.taxRate, form.discountRate),
    [form.items, form.taxRate, form.discountRate],
  )

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const setItem = (index, key) => (e) =>
    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) => (i === index ? { ...item, [key]: e.target.value } : item)),
    }))

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, blankItem()] }))
  const removeItem = (index) =>
    setForm((f) => ({
      ...f,
      items: f.items.length > 1 ? f.items.filter((_, i) => i !== index) : f.items,
    }))

  const validate = () => {
    const next = {}
    if (!form.clientId) next.clientId = 'Pick a client'
    if (!form.invoiceNumber.trim()) next.invoiceNumber = 'Required'
    if (!form.dueDate) next.dueDate = 'Required'
    if (!form.items.some((i) => i.description.trim() && lineTotal(i) > 0)) {
      next.items = 'Add at least one line item with an amount'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = async (status) => {
    if (!validate()) return
    const now = new Date().toISOString()

    const record = {
      clientId: Number(form.clientId),
      invoiceNumber: form.invoiceNumber.trim(),
      status,
      items: form.items
        .filter((i) => i.description.trim() || lineTotal(i) > 0)
        .map((i) => ({
          description: i.description.trim(),
          quantity: Number(i.quantity) || 0,
          rate: Number(i.rate) || 0,
          amount: lineTotal(i),
        })),
      subtotal: totals.subtotal,
      tax: totals.tax,
      discount: totals.discount,
      total: totals.total,
      taxRate: Number(form.taxRate) || 0,
      discountRate: Number(form.discountRate) || 0,
      issueDate: form.issueDate,
      dueDate: form.dueDate,
      notes: form.notes.trim(),
    }

    // invoiceNumber is a unique index. Letting a clash reach Dexie aborts the
    // transaction, which the live query then rethrows during render — so the
    // check happens here, before anything is written.
    const clash = await db.invoices.where('invoiceNumber').equals(record.invoiceNumber).first()
    if (clash && clash.id !== invoice?.id) {
      setErrors({ invoiceNumber: 'Already used' })
      return
    }

    try {
      if (isNew) {
        await addInvoice(BUSINESS_PROFILE, {
          ...record,
          createdAt: now,
          sentAt: status === 'sent' ? now : null,
          paidAt: null,
          payments: [],
        })
      } else {
        await db.invoices.update(invoice.id, {
          ...record,
          // Stamp the send time the first time it actually goes out.
          sentAt: status === 'sent' ? (invoice.sentAt ?? now) : invoice.sentAt,
        })
      }
      onClose()
    } catch (err) {
      setErrors({ invoiceNumber: err?.name === 'ConstraintError' ? 'Already used' : 'Save failed' })
    }
  }

  // Sending a draft is the common case; re-saving a sent invoice keeps it sent.
  const draftLabel = isNew || invoice.status === 'draft' ? 'Save draft' : 'Save changes'
  const draftStatus = isNew || invoice.status === 'draft' ? 'draft' : invoice.status

  return (
    <aside className="bfh-panel bfh-panel--wide" aria-label="Invoice editor">
      <header className="bfh-panel__head">
        <button type="button" className="bfh-panel__back" onClick={onClose}>
          <IconArrowLeft size={16} stroke={1.5} aria-hidden="true" />
          Invoices
        </button>
        <h2 className="bfh-panel__heading">{isNew ? 'New invoice' : invoice.invoiceNumber}</h2>
        <button
          type="button"
          className="bfh-iconaction bfh-panel__close"
          onClick={onClose}
          aria-label="Close panel"
        >
          <IconX size={14} stroke={1.5} aria-hidden="true" />
        </button>
      </header>

      <div className="bfh-panel__body">
        <div className="bfh-form bfh-form--flush">
          <label className="bfh-formfield">
            <span className="bfh-micro">Client</span>
            <select value={form.clientId} onChange={set('clientId')}>
              <option value="">Select…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company}
                </option>
              ))}
            </select>
            {errors.clientId && <span className="bfh-formerror">{errors.clientId}</span>}
          </label>

          <label className="bfh-formfield">
            <span className="bfh-micro">Invoice #</span>
            <input value={form.invoiceNumber} onChange={set('invoiceNumber')} />
            {errors.invoiceNumber && <span className="bfh-formerror">{errors.invoiceNumber}</span>}
          </label>

          <label className="bfh-formfield">
            <span className="bfh-micro">Issue date</span>
            <input type="date" value={form.issueDate} onChange={set('issueDate')} />
          </label>

          <label className="bfh-formfield">
            <span className="bfh-micro">Due date</span>
            <input type="date" value={form.dueDate} onChange={set('dueDate')} />
            {errors.dueDate && <span className="bfh-formerror">{errors.dueDate}</span>}
          </label>
        </div>

        <div className="bfh-items">
          <div className="bfh-items__row bfh-items__row--head">
            <span className="bfh-micro">Description</span>
            <span className="bfh-micro">Qty</span>
            <span className="bfh-micro">Unit price</span>
            <span className="bfh-micro bfh-items__total">Total</span>
            <span />
          </div>

          {form.items.map((item, index) => (
            // Line rows have no stable id of their own; position is the identity.
            // eslint-disable-next-line react/no-array-index-key
            <div className="bfh-items__row" key={index}>
              <input
                value={item.description}
                onChange={setItem(index, 'description')}
                aria-label={`Line ${index + 1} description`}
                placeholder="Description"
              />
              <input
                type="number"
                min="0"
                step="1"
                value={item.quantity}
                onChange={setItem(index, 'quantity')}
                aria-label={`Line ${index + 1} quantity`}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.rate}
                onChange={setItem(index, 'rate')}
                aria-label={`Line ${index + 1} unit price`}
              />
              <span className="bfh-items__total">{formatCurrency(lineTotal(item), symbol)}</span>
              <button
                type="button"
                className="bfh-iconaction"
                onClick={() => removeItem(index)}
                aria-label={`Remove line ${index + 1}`}
                disabled={form.items.length === 1}
              >
                <IconTrash size={13} stroke={1.5} aria-hidden="true" />
              </button>
            </div>
          ))}

          <button type="button" className="bfh-additem" onClick={addItem}>
            + Add line item
          </button>
          {errors.items && <span className="bfh-formerror">{errors.items}</span>}
        </div>

        <div className="bfh-totals">
          <div className="bfh-totals__row">
            <span className="bfh-micro">Subtotal</span>
            <span className="bfh-totals__value">{formatCurrency(totals.subtotal, symbol)}</span>
          </div>

          <div className="bfh-totals__row">
            <label className="bfh-rate">
              <span className="bfh-micro">Discount %</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={form.discountRate}
                onChange={set('discountRate')}
              />
            </label>
            <span className="bfh-totals__value">−{formatCurrency(totals.discount, symbol)}</span>
          </div>

          <div className="bfh-totals__row">
            <label className="bfh-rate">
              <span className="bfh-micro">Tax %</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={form.taxRate}
                onChange={set('taxRate')}
              />
            </label>
            <span className="bfh-totals__value">{formatCurrency(totals.tax, symbol)}</span>
          </div>

          <div className="bfh-totals__row bfh-totals__row--grand">
            <span className="bfh-micro">Total</span>
            <span className="bfh-totals__grand">{formatCurrency(totals.total, symbol)}</span>
          </div>
        </div>

        <label className="bfh-formfield">
          <span className="bfh-micro">Notes</span>
          <textarea rows={3} value={form.notes} onChange={set('notes')} />
        </label>
      </div>

      <footer className="bfh-panel__foot">
        <button type="button" className="bfh-btn-ghost" onClick={() => save(draftStatus)}>
          {draftLabel}
        </button>
        <button type="button" className="bfh-btn-primary" onClick={() => save('sent')}>
          Send invoice
        </button>
      </footer>
    </aside>
  )
}
