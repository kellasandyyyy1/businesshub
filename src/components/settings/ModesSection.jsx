import { IconBuilding, IconCheck, IconLayoutColumns, IconUser } from '@tabler/icons-react'

import { useProfile } from '../../context/ProfileContext'
import { putSetting } from '../../db/db'

const OPTIONS = [
  {
    id: 'business',
    Icon: IconBuilding,
    title: 'Business',
    body: 'Revenue, invoices, expenses, and clients.',
  },
  {
    id: 'personal',
    Icon: IconUser,
    title: 'Personal',
    body: 'Spending, savings goals, and net worth.',
  },
  {
    id: 'both',
    Icon: IconLayoutColumns,
    title: 'Both',
    body: 'Switch between the two in one app.',
  },
]

/**
 * Which sides of the app are in use.
 *
 * Turning one off hides its navigation; it does not delete anything. The data
 * stays where it is and comes back the moment the side is turned on again,
 * which is what makes this safe to change on a whim.
 */
export default function ModesSection() {
  const { activeMode } = useProfile()

  return (
    <section className="bfh-modesetting">
      <h3 className="bfh-datablock__title">Active modes</h3>
      <p className="bfh-settings__note">
        What Dual is for. Turning a mode off hides it — nothing is deleted, and it all
        comes back if you turn it on again.
      </p>

      <div className="bfh-modepick" role="radiogroup" aria-label="Active modes">
        {OPTIONS.map(({ id, Icon, title, body }) => {
          const selected = activeMode === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              className="bfh-modepick__card"
              data-selected={selected ? 'true' : 'false'}
              onClick={() => putSetting('activeMode', id)}
            >
              <span className="bfh-modepick__circle" aria-hidden="true">
                {selected && <IconCheck size={10} stroke={2.5} />}
              </span>
              <Icon size={18} stroke={1.5} aria-hidden="true" className="bfh-modepick__icon" />
              <span className="bfh-modepick__body">
                <span className="bfh-modepick__title">{title}</span>
                <span className="bfh-modepick__desc">{body}</span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
