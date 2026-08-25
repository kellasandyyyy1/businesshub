import { IconCheck, IconSquarePlus, IconUpload, IconX } from '@tabler/icons-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

import useFocusTrap from '../hooks/useFocusTrap'

const STEPS = [
  {
    icon: IconUpload,
    label: 'Tap the Share button',
    sub: 'The box with an arrow pointing up at the bottom of Safari.',
  },
  {
    icon: IconSquarePlus,
    label: "Tap 'Add to Home Screen'",
    sub: 'Scroll down in the share sheet to find this option.',
  },
  {
    icon: IconCheck,
    label: "Tap 'Add'",
    sub: 'Dual will appear on your home screen like a native app.',
  },
]

/**
 * iOS never fires an install prompt, so the only honest thing an install button
 * can do there is explain the manual steps.
 */
export default function IosInstallSheet({ onClose }) {
  const trapRef = useFocusTrap()

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div className="bfh-exportsheet" role="dialog" aria-modal="true" aria-label="Install on iOS">
      <button
        type="button"
        className="bfh-moredrawer__backdrop"
        aria-label="Close"
        onClick={onClose}
      />

      <div className="bfh-exportsheet__panel" ref={trapRef}>
        <span className="bfh-moredrawer__handle" aria-hidden="true" />

        <div className="bfh-exportsheet__body">
          <header className="bfh-ledger__head">
            <h2 className="bfh-panel__title">Install on iPhone / iPad</h2>
            <button
              type="button"
              className="bfh-iconaction"
              onClick={onClose}
              aria-label="Close"
            >
              <IconX size={16} stroke={1.5} aria-hidden="true" />
            </button>
          </header>

          <p className="bfh-settings__note">
            Add Dual to your home screen for the best experience.
          </p>

          <ol className="bfh-iossheet__steps">
            {STEPS.map((step) => {
              const Icon = step.icon
              return (
                <li key={step.label} className="bfh-iossheet__step">
                  <span className="bfh-iossheet__icon" aria-hidden="true">
                    <Icon size={14} stroke={1.5} />
                  </span>
                  <span className="bfh-iossheet__body">
                    <span className="bfh-iossheet__label">{step.label}</span>
                    <span className="bfh-iossheet__sub">{step.sub}</span>
                  </span>
                </li>
              )
            })}
          </ol>

          <p className="bfh-iossheet__note">
            This only works in Safari. If you&rsquo;re using Chrome or Firefox on iOS, open this
            page in Safari first.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
