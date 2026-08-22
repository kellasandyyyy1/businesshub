import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'

import { putSetting } from '../../db/db'

export default function PaymentMethodsSection({ paymentMethods, methodUse }) {
  const [name, setName] = useState('')
  const [error, setError] = useState(null)

  const save = (next) => putSetting('paymentMethods', next)

  const toggle = (target) =>
    save(
      paymentMethods.map((m) => (m.name === target.name ? { ...m, active: !m.active } : m)),
    )

  const add = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('Name is required')
    if (paymentMethods.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) {
      return setError('That method already exists')
    }
    await save([...paymentMethods, { name: trimmed, active: true }])
    setName('')
    setError(null)
    return undefined
  }

  const remove = async (target) => {
    const used = methodUse[target.name] ?? 0
    if (used > 0) {
      setError(`${target.name} is used by ${used} transaction${used === 1 ? '' : 's'}`)
      return
    }
    await save(paymentMethods.filter((m) => m.name !== target.name))
    setError(null)
  }

  return (
    <div className="bfh-settings__body">
      <h2 className="bfh-panel__title">Payment methods</h2>
      <p className="bfh-settings__note">
        Inactive methods stay on past transactions but are not offered on new ones.
      </p>

      <ul className="bfh-catlist">
        {paymentMethods.map((method) => {
          const used = methodUse[method.name] ?? 0
          return (
            <li key={method.name} className="bfh-catrow">
              <span className="bfh-catrow__name">{method.name}</span>
              <span className="bfh-micro">
                {used > 0 ? `${used} use${used === 1 ? '' : 's'}` : 'unused'}
              </span>

              <button
                type="button"
                className="bfh-switch"
                role="switch"
                aria-checked={method.active}
                aria-label={`${method.name} active`}
                onClick={() => toggle(method)}
              >
                <span className="bfh-switch__knob" />
              </button>

              {used === 0 && (
                <button
                  type="button"
                  className="bfh-iconaction bfh-catrow__delete"
                  onClick={() => remove(method)}
                  aria-label={`Delete ${method.name}`}
                >
                  <IconTrash size={14} stroke={1.5} aria-hidden="true" />
                </button>
              )}
            </li>
          )
        })}
      </ul>

      <form className="bfh-addcat" onSubmit={add}>
        <span className="bfh-micro">Add method</span>
        <div className="bfh-addcat__row">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
            placeholder="e.g. Maya Business"
            aria-label="New payment method"
          />
          <button type="submit" className="bfh-btn-primary bfh-btn-primary--inline">
            <IconPlus size={14} stroke={1.75} aria-hidden="true" />
            <span>Add method</span>
          </button>
        </div>
        {error && <span className="bfh-formerror">{error}</span>}
      </form>
    </div>
  )
}
