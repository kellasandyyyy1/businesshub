import { IconArrowLeft, IconPlus, IconSend, IconTrash, IconX } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useToast } from '../../context/ToastContext'
import { db } from '../../db/db'
import { BUSINESS_PROFILE, addInvoice } from '../../db/queries'
import { formatCurrency } from '../../lib/format'
import { computeTotals, issueDateOf, lineTotal, ratesOf } from '../../lib/invoice'

const TODAY = () => new Date().toISOString().slice(0, 10)
const blankItem = () => ({ description: '', quantity: '1', rate: '' })

/** Payment terms as people say them, counted from the invoice date. */
const TERMS = [
  { label: 'On receipt', days: 0 },
  { label: '7 days', days: 7 },
  { label: '15 days', days: 15 },
  { label: '30 days', days: 30 },
]

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function toForm(invoice, { invoiceNumber, taxRate, defaultClientId, defaultItems, defaultDueDate }) {
  if (!invoice) {
    return {
      clientId: defaultClientId ? String(defaultClientId) : '',
      invoiceNumber,
      issueDate: TODAY(),
      // Fifteen days is the usual term; 'due today' is rarely what anyone means.
      dueDate: defaultDueDate || addDays(TODAY(), 15),
      // A draft handed over by the assistant arrives with its line filled in.
      items: defaultItems?.length ? defaultItems : [blankItem()],
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
  defaultItems,
  defaultDueDate,
  defaultTaxRate,
  symbol,
  onClose,
}) {
  const [form, setForm] = useState(() =>
    toForm(invoice, {
      invoiceNumber: nextNumber,
      taxRate: defaultTaxRate,
      defaultClientId,
      defaultItems,
      defaultDueDate,
    }),
  )
  const [errors, setErrors] = useState({})
  const toast = useToast()
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
    if (!form.clientId) next.clientId = 'Choose who this invoice is for'
    if (!form.invoiceNumber.trim()) next.invoiceNumber = 'Give it a number'
    if (!form.dueDate) next.dueDate = 'Pick when it is due'
    if (!form.items.some((i) => i.description.trim() && lineTotal(i) > 0)) {
      next.items = 'Add at least one item with a name and a price'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = async (status) => {
    if (!validate()) {
      // On a phone the first problem is often off the bottom of the screen.
      requestAnimationFrame(() =>
        document
          .querySelector('.bfh-invform .bfh-formerror')
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
      )
      return
    }
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
      setErrors({ invoiceNumber: 'That number is already used by another invoice' })
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
    } catch (err) {
      // A clash on the number belongs under its field; anything else is a
      // failed write the user can simply retry.
      if (err?.name === 'ConstraintError') setErrors({ invoiceNumber: 'Already used' })
      else toast.error("Couldn't save. Try again.")
      return
    }
    const sentNow = status === 'sent' && (isNew || invoice.status === 'draft')
    const label = `Invoice ${record.invoiceNumber}`
    toast.success(sentNow ? `${label} sent` : isNew ? `${label} created` : `${label} updated`)
    onClose()
  }

  // Sending a draft is the common case; re-saving a sent invoice keeps it sent.
  const draftLabel = isNew || invoice.status === 'draft' ? 'Save draft' : 'Save changes'
  const draftStatus = isNew || invoice.status === 'draft' ? 'draft' : invoice.status
  const alreadySent = !isNew && invoice.status !== 'draft'
  const money = (v) => formatCurrency(v, symbol)

  return (
    <aside className="bfh-panel bfh-panel--wide bfh-invform" aria-label="Invoice editor">
      <header className="bfh-panel__head">
        <button type="button" className="bfh-panel__back" onClick={onClose}>
          <IconArrowLeft size={16} stroke={1.5} aria-hidden="true" />
          Invoices
        </button>
        <div className="bfh-invform__titles">
          <h2 className="bfh-panel__heading">{isNew ? 'New invoice' : 'Edit invoice'}</h2>
          <span className="bfh-invform__number">{form.invoiceNumber}</span>
        </div>
        <button
          type="button"
          className="bfh-sheet__close bfh-panel__close"
          onClick={onClose}
          aria-label="Close"
        >
          <IconX size={16} stroke={1.75} aria-hidden="true" />
        </button>
      </header>

      <div className="bfh-panel__body bfh-invform__body">
        {/* ---- 1. Who ---------------------------------------------------- */}
        <section className="bfh-invform__step">
          <h3 className="bfh-invform__steptitle">
            <span className="bfh-invform__stepnum">1</span>
            Who is it for?
          </h3>

          {clients.length === 0 ? (
            <p className="bfh-invform__hint">
              You have no clients yet.{' '}
              <Link className="bfh-invform__link" to="/clients" onClick={onClose}>
                Add your first client
              </Link>{' '}
              and come back to bill them.
            </p>
          ) : (
            <label className="bfh-formfield" data-invalid={errors.clientId ? 'true' : undefined}>
              <span className="bfh-fieldlabel">Client</span>
              <select value={form.clientId} onChange={set('clientId')}>
                <option value="">Choose a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company && c.company !== c.name ? `${c.company} — ${c.name}` : c.name}
                  </option>
                ))}
              </select>
              {errors.clientId && <span className="bfh-formerror">{errors.clientId}</span>}
            </label>
          )}
        </section>

        {/* ---- 2. What --------------------------------------------------- */}
        <section className="bfh-invform__step">
          <h3 className="bfh-invform__steptitle">
            <span className="bfh-invform__stepnum">2</span>
            What are you charging for?
          </h3>

          <ul className="bfh-invform__items">
            {form.items.map((item, index) => (
              // Line rows have no stable id of their own; position is the identity.
              // eslint-disable-next-line react/no-array-index-key
              <li className="bfh-invitem" key={index}>
                <label className="bfh-formfield bfh-invitem__desc">
                  <span className="bfh-fieldlabel">
                    {form.items.length > 1 ? `Item ${index + 1}` : 'Item or service'}
                  </span>
                  <input
                    value={item.description}
                    onChange={setItem(index, 'description')}
                    placeholder="e.g. Website design"
                    autoComplete="off"
                  />
                </label>

                <label className="bfh-formfield bfh-invitem__qty">
                  <span className="bfh-fieldlabel">Qty</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="1"
                    value={item.quantity}
                    onChange={setItem(index, 'quantity')}
                  />
                </label>

                <label className="bfh-formfield bfh-invitem__rate">
                  <span className="bfh-fieldlabel">Price each</span>
                  <span className="bfh-moneyfield">
                    <span className="bfh-moneyfield__symbol" aria-hidden="true">
                      {symbol}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      value={item.rate}
                      onChange={setItem(index, 'rate')}
                    />
                  </span>
                </label>

                <div className="bfh-invitem__foot">
                  <span className="bfh-invitem__sum">
                    {Number(item.quantity) || 0} × {money(Number(item.rate) || 0)} ={' '}
                    <strong>{money(lineTotal(item))}</strong>
                  </span>
                  {form.items.length > 1 && (
                    <button
                      type="button"
                      className="bfh-btn-text bfh-invitem__remove"
                      onClick={() => removeItem(index)}
                    >
                      <IconTrash size={14} stroke={1.5} aria-hidden="true" />
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <button type="button" className="bfh-btn-outline bfh-invform__additem" onClick={addItem}>
            <IconPlus size={15} stroke={1.75} aria-hidden="true" />
            Add another item
          </button>
          {errors.items && <span className="bfh-formerror">{errors.items}</span>}
        </section>

        {/* ---- 3. When --------------------------------------------------- */}
        <section className="bfh-invform__step">
          <h3 className="bfh-invform__steptitle">
            <span className="bfh-invform__stepnum">3</span>
            When should they pay?
          </h3>

          <div className="bfh-sheet__pair bfh-invform__dates">
            <label className="bfh-formfield">
              <span className="bfh-fieldlabel">Invoice date</span>
              <input type="date" value={form.issueDate} onChange={set('issueDate')} />
            </label>
            <label className="bfh-formfield" data-invalid={errors.dueDate ? 'true' : undefined}>
              <span className="bfh-fieldlabel">Due date</span>
              <input type="date" value={form.dueDate} min={form.issueDate} onChange={set('dueDate')} />
            </label>
          </div>

          <div className="bfh-chiprow" role="group" aria-label="Payment terms">
            {TERMS.map((term) => {
              const date = addDays(form.issueDate || TODAY(), term.days)
              return (
                <button
                  key={term.days}
                  type="button"
                  role="radio"
                  className="bfh-choicechip"
                  aria-checked={form.dueDate === date}
                  onClick={() => setForm((f) => ({ ...f, dueDate: date }))}
                >
                  {term.label}
                </button>
              )
            })}
          </div>
          {errors.dueDate && <span className="bfh-formerror">{errors.dueDate}</span>}

          <label className="bfh-formfield" data-invalid={errors.invoiceNumber ? 'true' : undefined}>
            <span className="bfh-fieldlabel">
              Invoice number <span className="bfh-fieldlabel__optional">filled in for you</span>
            </span>
            <input value={form.invoiceNumber} onChange={set('invoiceNumber')} />
            {errors.invoiceNumber && <span className="bfh-formerror">{errors.invoiceNumber}</span>}
          </label>
        </section>

        {/* ---- 4. Totals ------------------------------------------------- */}
        <section className="bfh-invform__step">
          <h3 className="bfh-invform__steptitle">
            <span className="bfh-invform__stepnum">4</span>
            Check the total
          </h3>

          <div className="bfh-invtotals">
            <div className="bfh-invtotals__row">
              <span>Subtotal</span>
              <span>{money(totals.subtotal)}</span>
            </div>

            <div className="bfh-invtotals__row">
              <label className="bfh-invtotals__rate">
                <span>Discount</span>
                <span className="bfh-invtotals__pct">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="100"
                    step="0.5"
                    value={form.discountRate}
                    onChange={set('discountRate')}
                    aria-label="Discount percent"
                  />
                  %
                </span>
              </label>
              <span>{totals.discount > 0 ? `−${money(totals.discount)}` : money(0)}</span>
            </div>

            <div className="bfh-invtotals__row">
              <label className="bfh-invtotals__rate">
                <span>Tax (VAT)</span>
                <span className="bfh-invtotals__pct">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="100"
                    step="0.5"
                    value={form.taxRate}
                    onChange={set('taxRate')}
                    aria-label="Tax percent"
                  />
                  %
                </span>
              </label>
              <span>+{money(totals.tax)}</span>
            </div>

            <div className="bfh-invtotals__row bfh-invtotals__row--grand">
              <span>Amount due</span>
              <span>{money(totals.total)}</span>
            </div>
          </div>

          <label className="bfh-formfield">
            <span className="bfh-fieldlabel">
              Note to client <span className="bfh-fieldlabel__optional">optional</span>
            </span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={set('notes')}
              placeholder="e.g. Bank details, or a thank-you"
            />
          </label>
        </section>
      </div>

      <footer className="bfh-panel__foot bfh-invform__foot">
        {/* Dual does not email anything. "Send" made it sound as though it
            would; this says what the button really does. */}
        <p className="bfh-invform__foothint">
          {alreadySent
            ? 'This invoice is already marked as sent.'
            : 'Mark it as sent once it is with your client — Dual then tracks when it is due.'}
        </p>
        <div className="bfh-invform__actions">
          <button type="button" className="bfh-btn-outline" onClick={() => save(draftStatus)}>
            {draftLabel}
          </button>
          {!alreadySent && (
            <button type="button" className="bfh-btn-primary" onClick={() => save('sent')}>
              <IconSend size={15} stroke={1.75} aria-hidden="true" />
              Mark as sent
            </button>
          )}
        </div>
      </footer>
    </aside>
  )
}
