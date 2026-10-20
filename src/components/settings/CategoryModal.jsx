import { useEffect, useRef, useState } from 'react'

import ICONS, { categoryIcon } from '../../config/categoryIcons'
import { db } from '../../db/db'
import { addCategory } from '../../db/queries'
import { useToast } from '../../context/ToastContext'
import { short } from '../../lib/toastCopy'
import useFocusTrap from '../../hooks/useFocusTrap'

/** The icons worth offering first, by what the category is for. */
const SUGGESTED = {
  income: ['trending-up', 'coin', 'building-bank', 'briefcase', 'users', 'repeat', 'gift', 'home'],
  expense: [
    'shopping-bag',
    'car',
    'home',
    'heart-rate-monitor',
    'device-tv',
    'bolt',
    'receipt-tax',
    'credit-card',
    'tools-kitchen-2',
    'wifi',
    'apps',
    'dots',
  ],
}

const ALL_ICONS = Object.keys(ICONS)

export default function CategoryModal({ category, profile, defaultType, existing = [], onClose }) {
  const [name, setName] = useState(category?.name ?? '')
  const [type, setType] = useState(category?.type ?? defaultType ?? 'expense')
  const [icon, setIcon] = useState(category?.icon ?? 'dots')
  const [showAll, setShowAll] = useState(false)
  const [error, setError] = useState(null)
  const firstField = useRef(null)
  const trapRef = useFocusTrap()
  const toast = useToast()
  const isEdit = Boolean(category?.id)

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

  const icons = showAll ? ALL_ICONS : (SUGGESTED[type] ?? SUGGESTED.expense)

  const onSubmit = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('Name is required')

    const clash = existing.some(
      (c) => c.id !== category?.id && c.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (clash) return setError('That category already exists')

    try {
      if (isEdit) await db.categories.update(category.id, { name: trimmed, type, icon })
      else await addCategory(profile, { name: trimmed, type, icon, isDefault: false })
    } catch {
      toast.error("Couldn't save. Try again.")
      return undefined
    }

    toast.success(`${short(trimmed)} category ${isEdit ? 'updated' : 'added'}`)
    onClose()
    return undefined
  }

  return (
    <div
      className="bfh-modal"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Edit category' : 'Add category'}
    >
      <button type="button" className="bfh-modal__backdrop" aria-label="Close" onClick={onClose} />

      <form className="bfh-modal__panel" ref={trapRef} onSubmit={onSubmit}>
        <header className="bfh-modal__head">
          <h2 className="bfh-panel__title">{isEdit ? 'Edit category' : 'Add category'}</h2>
          {/* Stated, not chosen: a category belongs to the profile it was made
              in, and moving one would strand the rows already filed under it. */}
          <span className="bfh-catrow__badge">
            {profile === 'personal' ? 'Personal' : 'Business'}
          </span>
        </header>

        <div className="bfh-form">
          <div className="bfh-formfield bfh-formfield--wide">
            <span className="bfh-micro">Type</span>
            <div className="bfh-toggle" role="group" aria-label="Category type">
              {['income', 'expense'].map((option) => (
                <button
                  key={option}
                  type="button"
                  className="bfh-toggle__option"
                  aria-pressed={type === option}
                  onClick={() => setType(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <label className="bfh-formfield bfh-formfield--wide">
            <span className="bfh-micro">Name</span>
            <input
              ref={firstField}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
            />
            {error && <span className="bfh-formerror">{error}</span>}
          </label>

          <div className="bfh-formfield bfh-formfield--wide">
            <span className="bfh-micro">Icon</span>
            <div className="bfh-iconpicker" role="group" aria-label="Category icon">
              {icons.map((name_) => {
                const Icon = categoryIcon(name_)
                return (
                  <button
                    key={name_}
                    type="button"
                    className="bfh-iconpicker__option"
                    aria-pressed={icon === name_}
                    aria-label={name_}
                    onClick={() => setIcon(name_)}
                  >
                    <Icon size={15} stroke={1.5} aria-hidden="true" />
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              className="bfh-micro bfh-link bfh-iconpicker__more"
              onClick={() => setShowAll((open) => !open)}
            >
              {showAll ? 'Show fewer icons' : 'More icons'}
            </button>
          </div>
        </div>

        <footer className="bfh-modal__foot">
          <button type="button" className="bfh-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="bfh-btn-primary">
            Save category
          </button>
        </footer>
      </form>
    </div>
  )
}
