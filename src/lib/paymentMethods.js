import {
  IconBrandMastercard,
  IconBrandPaypal,
  IconBrandVisa,
  IconBuildingBank,
  IconCash,
  IconChecks,
  IconCreditCard,
  IconDeviceMobile,
  IconWallet,
} from '@tabler/icons-react'

/**
 * What a payment method looks like.
 *
 * Methods are free text, so they are recognised by name: "GCash", "gcash
 * business" and "G-Cash" all read as GCash. Each kind has a plain icon; a
 * brand also has its real logo where one is on hand.
 */

/**
 * Logos supplied as images in public/svg-icon. Each says how it sits in the
 * square tile: an app icon fills it, a mark with white margins is zoomed past
 * them, and a wide wordmark is cropped to its symbol.
 */
const IMAGE_LOGOS = {
  gcash: { src: '/svg-icon/gcash.png', fit: 'cover' },
  maya: { src: '/svg-icon/paymaya.jpg', fit: 'cover', zoom: 1.35 },
  grabpay: { src: '/svg-icon/grabpay.jpg', fit: 'cover', zoom: 1.18 },
  gotyme: { src: '/svg-icon/gotyme.png', fit: 'cover', zoom: 1.2 },
  shopeepay: { src: '/svg-icon/shopeepay.webp', fit: 'cover', zoom: 1.12 },
  // The everyday kinds have pictures too; any card — debit or credit — shares one.
  cash: { src: '/svg-icon/cash.png', fit: 'contain', pad: true },
  bank: { src: '/svg-icon/banktransfer.png', fit: 'contain', pad: true },
  card: { src: '/svg-icon/debitcard.png', fit: 'contain', pad: true },
}

// Vector marks in src/assets/brands — any SVG dropped there is picked up by
// file name, and wins over an image logo of the same slug.
const SVG_LOGOS = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/brands/*.svg', { eager: true, query: '?url', import: 'default' })).map(
    ([path, url]) => [path.split('/').pop().replace(/\.svg$/, ''), { src: url, fit: 'contain' }],
  ),
)

const LOGOS = { ...IMAGE_LOGOS, ...SVG_LOGOS }

/** In match order: the first rule whose pattern fits the name wins. */
const KINDS = [
  { slug: 'gcash', brand: true, pattern: /g-?cash/i, label: 'E-wallet', Icon: IconDeviceMobile },
  { slug: 'maya', brand: true, pattern: /\b(pay)?maya\b/i, label: 'E-wallet', Icon: IconDeviceMobile },
  { slug: 'grabpay', brand: true, pattern: /grab\s?pay/i, label: 'E-wallet', Icon: IconDeviceMobile },
  { slug: 'shopeepay', brand: true, pattern: /shopee\s?pay/i, label: 'E-wallet', Icon: IconDeviceMobile },
  { slug: 'gotyme', brand: true, pattern: /go\s?tyme/i, label: 'Bank', Icon: IconBuildingBank },
  { slug: 'paypal', brand: true, pattern: /paypal/i, label: 'Online', Icon: IconBrandPaypal },
  { slug: 'visa', brand: true, pattern: /\bvisa\b/i, label: 'Card', Icon: IconBrandVisa },
  { slug: 'mastercard', brand: true, pattern: /master\s?card/i, label: 'Card', Icon: IconBrandMastercard },
  { slug: 'cash', pattern: /\bcash\b/i, label: 'Cash', Icon: IconCash },
  { slug: 'check', pattern: /\b(check|cheque)s?\b/i, label: 'Check', Icon: IconChecks },
  { slug: 'card', pattern: /card|credit|debit/i, label: 'Card', Icon: IconCreditCard },
  { slug: 'bank', pattern: /bank|transfer|instapay|pesonet|wire|deposit/i, label: 'Bank', Icon: IconBuildingBank },
  { slug: 'wallet', pattern: /wallet|e-?pay/i, label: 'E-wallet', Icon: IconDeviceMobile },
]

const OTHER = { slug: 'other', label: 'Other', Icon: IconWallet }

/** { slug, label, Icon, logo } — logo is { src, fit, … } only when the brand has one. */
export function paymentKind(name = '') {
  const kind = KINDS.find((k) => k.pattern.test(name)) ?? OTHER
  return { ...kind, logo: LOGOS[kind.slug] ?? null }
}

/** Common Philippine methods, offered as one-tap adds when they are missing. */
export const SUGGESTED_METHODS = ['GCash', 'Maya', 'GoTyme', 'GrabPay', 'ShopeePay', 'Debit Card', 'Check', 'PayPal']

/* -------------------------------------------------------------------------
   The saved list — Settings → Payment methods

   Stored as one setting, `paymentMethods`: [{ id, name, active }]. Each
   transaction keeps the method's `paymentMethodId` and a `paymentMethod` name
   snapshot, so history reads right after a rename (through the id) and after
   a delete (through the snapshot).
   ------------------------------------------------------------------------- */

/** What a household or business starts with before editing the list. */
export const DEFAULT_PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'GCash', 'PayMaya', 'GoTyme', 'Credit Card']

/** Names compare without case or stray spaces: "gcash " is GCash. */
export const methodKey = (name) => String(name ?? '').trim().toLowerCase()

const slug = (name) => methodKey(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'method'

/**
 * A stable id from the name. Deterministic, so a list read before it was ever
 * saved with ids gets the same ids the migration wrote; a clash with another
 * method's id gets a numbered suffix.
 */
export function methodId(name, taken = []) {
  const base = `pm-${slug(name)}`
  const used = new Set(taken)
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

/** The stored list with every entry carrying an id — older lists had none. */
export function withIds(list = []) {
  const ids = []
  return list
    .filter((m) => m && String(m.name ?? '').trim())
    .map((m) => {
      const id = m.id ?? methodId(m.name, ids)
      ids.push(id)
      return { id, name: String(m.name).trim(), active: m.active !== false }
    })
}

/** The list as Settings holds it, or the defaults when it was never edited. */
export function methodsFromSetting(value) {
  return withIds(Array.isArray(value) ? value : DEFAULT_PAYMENT_METHODS.map((name) => ({ name, active: true })))
}

/** Exact match first; a partial one only when it is the only candidate. */
export function matchMethod(text, methods = [], { partial = false } = {}) {
  const wanted = methodKey(text)
  if (!wanted) return null
  const exact = methods.find((m) => methodKey(m.name) === wanted)
  if (exact || !partial) return exact ?? null
  const close = methods.filter((m) => {
    const name = methodKey(m.name)
    return name.includes(wanted) || wanted.includes(name)
  })
  return close.length === 1 ? close[0] : null
}

/**
 * What a transaction's method reads as: the method's current name through its
 * id, "Name · removed" once the method is gone, or the old free text as typed.
 */
export function methodLabel(tx, methods = []) {
  if (!tx) return ''
  if (tx.paymentMethodId) {
    const found = methods.find((m) => m.id === tx.paymentMethodId)
    if (found) return found.name
    return tx.paymentMethod ? `${tx.paymentMethod} · removed` : ''
  }
  return tx.paymentMethod ?? ''
}

/**
 * The picker's order: most recently used in this profile first, then the rest
 * A–Z. There is no "default" method to put ahead of them — the most recent one
 * is what a new entry starts on.
 */
export function sortMethods(methods = [], lastUsed = {}) {
  return [...methods].sort((a, b) => {
    const la = lastUsed[a.id] ?? ''
    const lb = lastUsed[b.id] ?? ''
    if (la !== lb) return la < lb ? 1 : -1
    return a.name.localeCompare(b.name)
  })
}

/** The id and name snapshot a transaction carries for a picked method, or none. */
export const methodFields = (method) =>
  method ? { paymentMethodId: method.id, paymentMethod: method.name } : { paymentMethodId: null, paymentMethod: '' }
