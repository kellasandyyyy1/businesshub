import { useRef, useState } from 'react'

import { putSetting } from '../../db/db'

const CURRENCIES = [
  { code: 'PHP', symbol: '₱', locale: 'en-PH' },
  { code: 'USD', symbol: '$', locale: 'en-US' },
  { code: 'SGD', symbol: 'S$', locale: 'en-SG' },
  { code: 'AUD', symbol: 'A$', locale: 'en-AU' },
]

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** What the picker will accept before anything is read. */
const MAX_UPLOAD_BYTES = 500 * 1024
/** What gets stored, after the canvas pass. Base64 runs about 4/3 of the bytes. */
const MAX_STORED_CHARS = Math.round(200 * 1024 * (4 / 3))
/** Enough for a 72px circle on a 3× screen, and nothing more. */
const AVATAR_PX = 256

/** "Broadheader" → "BR", "Reyes Creative" → "RC". */
function initials(name) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '—'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/**
 * Shrinks an uploaded picture to avatar size and squeezes the quality until it
 * fits the storage budget. A 4MB phone photo has no business sitting in
 * IndexedDB when it is only ever drawn at 72 pixels.
 */
function compressToAvatar(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onerror = () => reject(new Error('unreadable'))
    img.onload = () => {
      const scale = Math.min(1, AVATAR_PX / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)

      let quality = 0.85
      let out = canvas.toDataURL('image/jpeg', quality)
      while (out.length > MAX_STORED_CHARS && quality > 0.4) {
        quality -= 0.1
        out = canvas.toDataURL('image/jpeg', quality)
      }
      resolve(out)
    }
    img.src = dataUrl
  })
}

export default function BusinessSection({ settings }) {
  const fileInput = useRef(null)
  const [form, setForm] = useState(() => ({
    businessName: settings.businessName ?? '',
    currency: settings.currency ?? 'PHP',
    openingBalance: settings.openingBalance ?? '',
    // Stored as MM-DD; only the month is editable here.
    fiscalMonth: (settings.fiscalYearStart ?? '01-01').slice(0, 2),
    // `logo` is the key this used to be saved under; it is still read so an
    // existing picture survives the rename.
    avatar: settings.businessAvatar ?? settings.logo ?? null,
  }))
  const [status, setStatus] = useState(null)

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setStatus(null)
  }

  // The symbol is derived, never typed — which is what stops it drifting away
  // from the currency it belongs to.
  const active = CURRENCIES.find((c) => c.code === form.currency) ?? CURRENCIES[0]

  const readFile = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setStatus({ error: true, text: 'That file is not an image.' })
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setStatus({ error: true, text: 'Pictures must be under 500 KB.' })
      return
    }

    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const avatar = await compressToAvatar(reader.result)
        setForm((f) => ({ ...f, avatar }))
        setStatus(null)
      } catch {
        setStatus({ error: true, text: 'That image could not be read.' })
      }
    }
    reader.readAsDataURL(file)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.businessName.trim()) {
      setStatus({ error: true, text: 'Business name is required.' })
      return
    }

    await Promise.all([
      putSetting('businessName', form.businessName.trim()),
      putSetting('currency', active.code),
      putSetting('symbol', active.symbol),
      putSetting('locale', active.locale),
      putSetting('fiscalYearStart', `${form.fiscalMonth}-01`),
      putSetting('businessAvatar', form.avatar),
      // Kept in step so the sidebar keeps working either way.
      putSetting('logo', form.avatar),
      ...(form.openingBalance === ''
        ? []
        : [putSetting('openingBalance', Number(form.openingBalance) || 0)]),
    ])
    setStatus({ text: 'Saved' })
  }

  return (
    <form className="bfh-settings__body" onSubmit={save}>
      <h2 className="bfh-panel__title">Business</h2>

      {/* ---- Identity ---- */}
      <div className="bfh-identity">
        <div className="bfh-identity__avatar">
          <span className="bfh-avatarcircle">
            {form.avatar ? (
              <img src={form.avatar} alt="" />
            ) : (
              <span className="bfh-avatarcircle__initials">{initials(form.businessName)}</span>
            )}
          </span>

          <button
            type="button"
            className="bfh-identity__change"
            onClick={() => fileInput.current?.click()}
          >
            {form.avatar ? 'Change photo' : 'Add photo'}
          </button>

          {form.avatar && (
            <button
              type="button"
              className="bfh-identity__remove"
              onClick={() => setForm((f) => ({ ...f, avatar: null }))}
            >
              Remove
            </button>
          )}

          <input
            ref={fileInput}
            type="file"
            accept="image/png, image/jpeg"
            className="sr-only"
            onChange={(e) => readFile(e.target.files?.[0])}
          />
        </div>

        <label className="bfh-formfield bfh-identity__name">
          <span className="bfh-micro">Business name</span>
          <input value={form.businessName} onChange={set('businessName')} />
          <span className="bfh-fieldhint">Shown in invoices, reports, and the dashboard.</span>
        </label>
      </div>

      {/* ---- The rest ---- */}
      <div className="bfh-settingsgrid">
        <label className="bfh-formfield">
          <span className="bfh-micro">Currency</span>
          <select value={form.currency} onChange={set('currency')}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        </label>

        <label className="bfh-formfield">
          <span className="bfh-micro">Currency symbol</span>
          <span className="bfh-readonlyfield">
            <input value={active.symbol} readOnly tabIndex={-1} aria-readonly="true" />
            <span className="bfh-readonlyfield__tag">auto</span>
          </span>
        </label>

        <label className="bfh-formfield">
          <span className="bfh-micro">Opening cash balance</span>
          <span className="bfh-prefixfield">
            {/* The prefix follows the chosen currency rather than assuming pesos. */}
            <span className="bfh-prefixfield__symbol" aria-hidden="true">
              {active.symbol}
            </span>
            <input
              type="number"
              step="0.01"
              value={form.openingBalance}
              onChange={set('openingBalance')}
              placeholder="0"
            />
          </span>
        </label>

        <label className="bfh-formfield">
          <span className="bfh-micro">Financial year starts</span>
          <select value={form.fiscalMonth} onChange={set('fiscalMonth')}>
            {MONTHS.map((month, i) => (
              <option key={month} value={String(i + 1).padStart(2, '0')}>
                {month}
              </option>
            ))}
          </select>
        </label>
      </div>

      <footer className="bfh-settings__foot bfh-settings__foot--tight">
        <button type="submit" className="bfh-btn-primary bfh-btn-primary--inline">
          Save changes
        </button>
        {status && (
          <span className={status.error ? 'bfh-formerror' : 'bfh-micro'}>{status.text}</span>
        )}
      </footer>
    </form>
  )
}
