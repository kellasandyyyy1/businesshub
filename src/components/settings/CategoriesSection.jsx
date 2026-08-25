import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'

import CategoryModal from './CategoryModal'
import { categoryIcon } from '../../config/categoryIcons'
import { useProfile } from '../../context/ProfileContext'
import { db } from '../../db/db'

const PROFILES = [
  { id: 'business', label: 'Business' },
  { id: 'personal', label: 'Personal' },
]

const TYPES = ['income', 'expense']

/**
 * The two charts of accounts, one profile at a time.
 *
 * The list is read here rather than taken from the page's settings data: that
 * copy follows whichever profile the app is in, and this screen has to show
 * either one regardless of which is open.
 */
export default function CategoriesSection({ categoryUse }) {
  const { profile } = useProfile()
  // Opens on the profile the user is actually in, which is the one they are
  // most likely to have come here to change.
  const [activeProfile, setActiveProfile] = useState(profile)
  const [activeType, setActiveType] = useState('expense')
  const [editing, setEditing] = useState(null) // null | {} | category
  const [error, setError] = useState(null)
  const [confirming, setConfirming] = useState(null)

  const rows = useLiveQuery(
    () =>
      db.categories
        .where('[profile+type]')
        .equals([activeProfile, activeType])
        .sortBy('name'),
    [activeProfile, activeType],
    [],
  )

  const remove = async (category) => {
    // Removing a category that transactions still point at would strand them:
    // the rows keep a name nothing in the list matches any more.
    const used = categoryUse?.[category.name] ?? 0
    if (used > 0) {
      setConfirming(null)
      setError(`${category.name} is used by ${used} transaction${used === 1 ? '' : 's'}`)
      return
    }
    await db.categories.delete(category.id)
    setConfirming(null)
    setError(null)
  }

  const profileLabel = activeProfile === 'personal' ? 'Personal' : 'Business'

  return (
    <div className="bfh-settings__body">
      <header className="bfh-cathead">
        <h2 className="bfh-panel__title">Categories</h2>
        <button
          type="button"
          className="bfh-btn-primary bfh-btn-primary--inline"
          onClick={() => setEditing({})}
        >
          <IconPlus size={14} stroke={1.75} aria-hidden="true" />
          Add category
        </button>
      </header>

      <div className="bfh-catprofiles" role="group" aria-label="Profile">
        {PROFILES.map((option) => (
          <button
            key={option.id}
            type="button"
            className="bfh-catprofile"
            aria-pressed={activeProfile === option.id}
            onClick={() => {
              setActiveProfile(option.id)
              setError(null)
              setConfirming(null)
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="bfh-tabs" role="tablist" aria-label="Category type">
        {TYPES.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            className="bfh-tab"
            aria-selected={activeType === id}
            onClick={() => {
              setActiveType(id)
              setError(null)
              setConfirming(null)
            }}
          >
            {id}
          </button>
        ))}
      </div>

      <p className="bfh-micro bfh-catshowing">
        Showing {profileLabel} {activeType} categories
      </p>

      {error && <p className="bfh-formerror">{error}</p>}

      {rows.length === 0 ? (
        <p className="bfh-empty">Nothing here yet. Add the first one.</p>
      ) : (
        <ul className="bfh-catlist">
          {rows.map((category) => {
            const Icon = categoryIcon(category.icon)
            // Anything the app did not ship is the user's to change.
            const isDefault = category.isDefault === true
            return (
              <li className="bfh-catrow" key={category.id}>
                <span className="bfh-catrow__icon" aria-hidden="true">
                  <Icon size={15} stroke={1.5} />
                </span>
                <span className="bfh-catrow__name">{category.name}</span>

                {isDefault ? (
                  <span className="bfh-catrow__badge">Default</span>
                ) : (
                  <>
                    <button
                      type="button"
                      className="bfh-iconaction"
                      aria-label={`Edit ${category.name}`}
                      onClick={() => setEditing(category)}
                    >
                      <IconPencil size={13} stroke={1.5} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="bfh-iconaction"
                      aria-label={
                        confirming === category.id
                          ? `Confirm delete ${category.name}`
                          : `Delete ${category.name}`
                      }
                      data-confirming={confirming === category.id ? 'true' : undefined}
                      onClick={() =>
                        confirming === category.id ? remove(category) : setConfirming(category.id)
                      }
                    >
                      <IconTrash size={13} stroke={1.5} aria-hidden="true" />
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {editing && (
        <CategoryModal
          key={editing.id ?? 'new'}
          category={editing.id ? editing : null}
          profile={activeProfile}
          defaultType={activeType}
          existing={rows}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
