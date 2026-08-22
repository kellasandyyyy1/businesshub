import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'

import ICONS, { categoryIcon } from '../../config/categoryIcons'
import { db } from '../../db/db'

const ICON_NAMES = Object.keys(ICONS)

export default function CategoriesSection({ categories, categoryUse }) {
  const [tab, setTab] = useState('expense')
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(ICON_NAMES[0])
  const [error, setError] = useState(null)

  const rows = categories.filter((c) => c.type === tab)

  const add = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('Name is required')
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      return setError('That category already exists')
    }

    await db.categories.add({
      name: trimmed,
      type: tab,
      icon,
      custom: true,
      createdAt: new Date().toISOString(),
    })
    setName('')
    setError(null)
    return undefined
  }

  const remove = async (category) => {
    // Removing a category that transactions still point at would orphan them.
    const used = categoryUse[category.name] ?? 0
    if (used > 0) {
      setError(`${category.name} is used by ${used} transaction${used === 1 ? '' : 's'}`)
      return
    }
    await db.categories.delete(category.id)
    setError(null)
  }

  return (
    <div className="bfh-settings__body">
      <h2 className="bfh-panel__title">Categories</h2>

      <div className="bfh-tabs" role="tablist" aria-label="Category type">
        {['income', 'expense'].map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            className="bfh-tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id)
              setError(null)
            }}
          >
            {id}
          </button>
        ))}
      </div>

      <ul className="bfh-catlist">
        {rows.map((category) => {
          const Icon = categoryIcon(category.icon)
          return (
            <li key={category.id} className="bfh-catrow">
              <Icon size={14} stroke={1.5} aria-hidden="true" />
              <span className="bfh-catrow__name">{category.name}</span>
              {!category.custom && <span className="bfh-chip">Default</span>}
              {category.custom && (
                <button
                  type="button"
                  className="bfh-iconaction bfh-catrow__delete"
                  onClick={() => remove(category)}
                  aria-label={`Delete ${category.name}`}
                >
                  <IconTrash size={14} stroke={1.5} aria-hidden="true" />
                </button>
              )}
            </li>
          )
        })}
        {rows.length === 0 && <p className="bfh-empty">No {tab} categories yet.</p>}
      </ul>

      <form className="bfh-addcat" onSubmit={add}>
        <span className="bfh-micro">Add {tab} category</span>

        <div className="bfh-addcat__row">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
            placeholder="Category name"
            aria-label="New category name"
          />
          <button type="submit" className="bfh-btn-primary bfh-btn-primary--inline">
            <IconPlus size={14} stroke={1.75} aria-hidden="true" />
            <span>Add category</span>
          </button>
        </div>

        <div className="bfh-iconpicker" role="radiogroup" aria-label="Category icon">
          {ICON_NAMES.map((key) => {
            const Icon = ICONS[key]
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={icon === key}
                aria-label={key}
                className="bfh-iconpicker__option"
                onClick={() => setIcon(key)}
              >
                <Icon size={16} stroke={1.5} aria-hidden="true" />
              </button>
            )
          })}
        </div>

        {error && <span className="bfh-formerror">{error}</span>}
      </form>
    </div>
  )
}
