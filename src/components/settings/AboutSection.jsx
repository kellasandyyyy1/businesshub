import { IconDownload, IconInfoCircle } from '@tabler/icons-react'
import { useState } from 'react'

import IosInstallSheet from '../IosInstallSheet'
import { usePWAInstall } from '../../hooks/usePWAInstall'

// Mac reports "MacIntel"; everything else gets Ctrl.
const MOD = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl'

const SHORTCUTS = [
  [`${MOD} K`, 'Ask anything'],
  [`${MOD} N`, 'Add transaction'],
  ['/', 'Focus search on this page'],
  ['Esc', 'Close any modal or panel'],
]

export default function AboutSection({ version }) {
  const { canInstall, isInstalled, isIOS, triggerInstall } = usePWAInstall()
  const [iosOpen, setIosOpen] = useState(false)

  return (
    <div className="bfh-settings__body">
      <h2 className="bfh-panel__title">About</h2>

      <div className="bfh-about__head">
        <div className="bfh-about__name">Dual Finance</div>
        <span className="bfh-chip">v{version}</span>
      </div>

      <p className="bfh-settings__note">
        Financial management for small businesses, freelancers, and agencies. Everything runs in
        this browser. No server, no account, and no data leaves the device.
      </p>

      <section className="bfh-shortcuts">
        <h3 className="bfh-datablock__title">Keyboard shortcuts</h3>
        <dl>
          {SHORTCUTS.map(([keys, label]) => (
            <div key={keys}>
              <dt>
                <kbd className="bfh-kbd">{keys}</kbd>
              </dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Only one of these can be true, and on a browser that cannot install
          at all none of them are. So nothing is shown rather than a button
          that would do nothing. */}
      {(isInstalled || canInstall || isIOS) && (
        <div className="bfh-installrow">
          {isInstalled ? (
            <span className="bfh-installrow__done">✓ Installed</span>
          ) : canInstall ? (
            <button type="button" className="bfh-btn-ghost bfh-btn-ghost--solid" onClick={triggerInstall}>
              <IconDownload size={14} stroke={1.5} aria-hidden="true" />
              <span>Install app</span>
            </button>
          ) : (
            <button
              type="button"
              className="bfh-btn-ghost bfh-btn-ghost--solid"
              onClick={() => setIosOpen(true)}
            >
              <IconInfoCircle size={14} stroke={1.5} aria-hidden="true" />
              <span>How to install</span>
            </button>
          )}
        </div>
      )}

      {iosOpen && <IosInstallSheet onClose={() => setIosOpen(false)} />}

      <p className="bfh-micro bfh-about__credit">
        Developed by{' '}
        <a
          className="bfh-about__link"
          href="https://seb.kelas.site"
          target="_blank"
          rel="noreferrer"
        >
          Seb
        </a>
      </p>
    </div>
  )
}
