import { IconArrowRight, IconChevronRight, IconMapPin } from '@tabler/icons-react'
import { Fragment } from 'react'

import { availability } from '../../lib/showMe'

const SIDE_WORD = { business: 'Business', personal: 'Personal' }

/** The path as a breadcrumb, each step its own word, the last one in ink. */
function Breadcrumb({ path }) {
  const steps = String(path ?? '').split(/\s*>\s*/).filter(Boolean)
  return (
    <span className="bfh-showme__path">
      {steps.map((step, i) => (
        <Fragment key={`${step}-${i}`}>
          {i > 0 && (
            <>
              <IconChevronRight className="bfh-showme__sep" size={11} stroke={2} aria-hidden="true" />
              <span className="sr-only"> then </span>
            </>
          )}
          <span className={i === steps.length - 1 ? 'bfh-showme__step bfh-showme__step--here' : 'bfh-showme__step'}>
            {step}
          </span>
        </Fragment>
      ))}
    </span>
  )
}

/**
 * What the one action on a place is, and why when it is not a plain Show me:
 * the place is on the other side (switch), or its side is switched off.
 */
function actionFor(entry, profile, activeMode, handlers) {
  const reach = availability(entry, profile, activeMode)
  const side = SIDE_WORD[reach.side]
  if (reach.ok) return { label: 'Show me', note: null, run: () => handlers.onShow(entry) }
  if (reach.reason === 'switch') {
    return {
      label: `Switch to ${side}`,
      note: `${entry.label} ${/s$/i.test(entry.label) ? 'are' : 'is'} in ${side} mode.`,
      run: () => handlers.onSwitch(reach.side, entry),
    }
  }
  return {
    label: 'Open Active modes',
    note: entry.needsBoth ? 'Needs Business and Personal both switched on.' : `${side} mode is off.`,
    run: () => handlers.onOpenModes(),
  }
}

/**
 * "Where is…?" answered as a card in the same family as the edit and delete
 * cards: an eyebrow, the place and its path, and one full-width action. When a
 * question has more than one right answer (up to three), each place is a row
 * to tap, the way "Which one?" lists records. Nothing moves until a tap.
 */
export default function ShowMeCard({ entries = [], profile, activeMode, onShow, onSwitch, onOpenModes }) {
  const places = entries.filter(Boolean).slice(0, 3)
  if (!places.length) return null
  const handlers = { onShow, onSwitch, onOpenModes }

  return (
    <section className="bfh-confirm__card bfh-showme" aria-label="Where to find it">
      <span className="bfh-confirm__eyebrow bfh-showme__eyebrow">
        <IconMapPin size={12} stroke={1.75} aria-hidden="true" />
        Where to find it
      </span>

      {places.length === 1 ? (
        (() => {
          const [entry] = places
          const action = actionFor(entry, profile, activeMode, handlers)
          return (
            <>
              <div className="bfh-showme__place">
                <span className="bfh-showme__label">{entry.label}</span>
                <Breadcrumb path={entry.path} />
                {action.note && <span className="bfh-showme__note">{action.note}</span>}
              </div>
              <div className="bfh-confirm__actions">
                <button type="button" className="bfh-confirm__save" onClick={action.run}>
                  {action.label}
                  <IconArrowRight size={13} stroke={2} aria-hidden="true" />
                </button>
              </div>
            </>
          )
        })()
      ) : (
        <ul className="bfh-recordcard__choices bfh-showme__choices">
          {places.map((entry) => {
            const action = actionFor(entry, profile, activeMode, handlers)
            return (
              <li key={entry.id}>
                <button type="button" className="bfh-recordcard__choice" onClick={action.run}>
                  <span className="bfh-recordcard__choicetext">
                    <span className="bfh-recordcard__choicetitle">{entry.label}</span>
                    <Breadcrumb path={entry.path} />
                    {action.note && <span className="bfh-showme__note">{action.note}</span>}
                  </span>
                  <span className="bfh-showme__go">
                    {action.label}
                    <IconChevronRight size={14} stroke={1.5} aria-hidden="true" />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
