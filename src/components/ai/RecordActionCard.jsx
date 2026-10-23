import { IconCheck, IconChevronRight, IconPencil, IconTrash, IconX } from '@tabler/icons-react'
import { useEffect, useState } from 'react'

import { formatCurrency, formatDate } from '../../lib/format'
import { ENTITY_WORD } from '../../lib/recordCards'
import { signedLabel } from '../../lib/txDisplay'

/** How long the done line stays before the card folds away, as with add. */
const DONE_HOLD_MS = 1500

const VALUE_WORD = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  cleared: 'Cleared',
  pending: 'Pending',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
}

const dayLabel = (iso) => (iso === new Date().toISOString().slice(0, 10) ? 'Today' : formatDate(iso))

/** One side of a before → after row, worded the way the record's page shows it. */
function formatValue(row, value, record, symbol) {
  if (value === null || value === undefined || value === '') return 'None'
  if (row.kind === 'signed') {
    const n = Number(value) || 0
    return signedLabel(record.type === 'expense' ? -n : n, symbol)
  }
  if (row.kind === 'money') return formatCurrency(Number(value) || 0, symbol)
  if (row.kind === 'date') return formatDate(value)
  return VALUE_WORD[value] ?? String(value)
}

function figureLabel(figure, symbol) {
  if (!figure) return null
  return figure.signed ? signedLabel(figure.value, symbol) : formatCurrency(figure.value, symbol)
}

/** The record as one line: what it is, its date, and its figure. */
function Identity({ view, symbol }) {
  const meta = [view.date && dayLabel(view.date), ...view.meta].filter(Boolean).join(' · ')
  return (
    <div className="bfh-confirm__details">
      <span className="bfh-confirm__body">
        <span className="bfh-confirm__name">{view.title}</span>
        {meta && <span className="bfh-confirm__meta">{meta}</span>}
      </span>
      {view.figure && <span className="bfh-confirm__amount">{figureLabel(view.figure, symbol)}</span>}
    </div>
  )
}

/**
 * An edit or delete the assistant understood, shown before anything changes.
 *
 * Three shapes: a "Which one?" list when the request matched several records,
 * an edit card with a before → after row for each changed field and nothing
 * else, and a delete card showing the whole record so the person can check it
 * is the right one. The delete button is the ordinary ink button; the trash
 * mark in the header says what it does.
 *
 * `card.status`: choosing → pending → saving → saved, or dismissed, or error.
 */
export default function RecordActionCard({ card, symbol, canOpenForm, onPick, onConfirm, onOpenForm, onDismiss }) {
  const { status } = card
  const [folded, setFolded] = useState(false)

  useEffect(() => {
    if (status !== 'saved') return undefined
    const timer = setTimeout(() => setFolded(true), DONE_HOLD_MS)
    return () => clearTimeout(timer)
  }, [status])

  const isDelete = card.type === 'DELETE_RECORD'
  const noun = ENTITY_WORD[card.entity] ?? 'Record'
  const eyebrow = `${isDelete ? 'Delete' : 'Edit'} ${noun.toLowerCase()}`
  const collapsed = status === 'dismissed' || folded
  const busy = status === 'saving'

  return (
    <div className="bfh-confirm" data-state={collapsed ? 'collapsed' : status} aria-hidden={collapsed || undefined}>
      <div className="bfh-confirm__inner">
        <section className="bfh-confirm__card bfh-recordcard" aria-label={eyebrow}>
          {status === 'saved' ? (
            <p className="bfh-confirm__saved" role="status">
              <IconCheck size={16} stroke={2} aria-hidden="true" />
              {isDelete ? `${noun} deleted.` : 'Changes saved.'}
            </p>
          ) : (
            <>
              <header className="bfh-confirm__head">
                <span className="bfh-confirm__eyebrow bfh-recordcard__eyebrow">
                  {isDelete ? (
                    <IconTrash size={12} stroke={1.75} aria-hidden="true" />
                  ) : (
                    <IconPencil size={12} stroke={1.75} aria-hidden="true" />
                  )}
                  {eyebrow}
                </span>
                <button
                  type="button"
                  className="bfh-confirm__close"
                  onClick={() => onDismiss(card.id)}
                  disabled={busy}
                  aria-label={isDelete ? 'Cancel, keep it' : 'Cancel, change nothing'}
                >
                  <IconX size={13} stroke={1.75} aria-hidden="true" />
                </button>
              </header>

              {status === 'choosing' ? (
                <>
                  <p className="bfh-recordcard__ask">Which one?</p>
                  <ul className="bfh-recordcard__choices">
                    {card.candidates.map(({ record, view }) => (
                      <li key={record.id}>
                        <button type="button" className="bfh-recordcard__choice" onClick={() => onPick(card, record)}>
                          <span className="bfh-recordcard__choicetext">
                            <span className="bfh-recordcard__choicetitle">{view.title}</span>
                            <span className="bfh-recordcard__choicemeta">
                              {[figureLabel(view.figure, symbol), view.date && dayLabel(view.date)].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                          <IconChevronRight size={14} stroke={1.5} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <Identity view={card.view} symbol={symbol} />

                  {!isDelete && card.diff?.length > 0 && (
                    <dl className="bfh-recordcard__diff">
                      {card.diff.map((row) => (
                        <div className="bfh-recordcard__row" key={row.field}>
                          <dt>{row.label}</dt>
                          <dd>
                            <s className="bfh-recordcard__before">
                              <span className="sr-only">was </span>
                              {formatValue(row, row.before, card.record, symbol)}
                            </s>
                            <span className="bfh-recordcard__arrow" aria-hidden="true">→</span>
                            <span className="bfh-recordcard__after">
                              <span className="sr-only">becomes </span>
                              {formatValue(row, row.after, card.record, symbol)}
                            </span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {card.warnings?.map((note) => (
                    <p className="bfh-confirm__note" key={note}>
                      {note}
                    </p>
                  ))}
                  {card.problem && <p className="bfh-confirm__note bfh-confirm__note--warn">{card.problem}</p>}
                  {status === 'error' && (
                    <p className="bfh-confirm__note bfh-confirm__note--warn" role="alert">
                      Could not {isDelete ? 'delete' : 'save'}. Try again.
                    </p>
                  )}

                  <div className="bfh-confirm__actions">
                    {busy ? (
                      <span className="bfh-confirm__saving" role="status">
                        {isDelete ? 'Deleting' : 'Saving'}
                        <span className="bfh-assist__dots" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </span>
                      </span>
                    ) : (
                      <>
                        <button type="button" className="bfh-confirm__edit" onClick={() => onDismiss(card.id)}>
                          Cancel
                        </button>
                        {!isDelete && canOpenForm && (
                          <button type="button" className="bfh-confirm__edit" onClick={() => onOpenForm(card)}>
                            Edit
                          </button>
                        )}
                        {!card.problem && (
                          <button type="button" className="bfh-confirm__save" onClick={() => onConfirm(card)}>
                            {isDelete ? (
                              <IconTrash size={13} stroke={2} aria-hidden="true" />
                            ) : (
                              <IconCheck size={13} stroke={2} aria-hidden="true" />
                            )}
                            {isDelete ? 'Delete' : 'Save changes'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
