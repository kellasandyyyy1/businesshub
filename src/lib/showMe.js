/**
 * Show me: take the person to the exact spot an app map entry names, and
 * point at it.
 *
 * Only ever called from a tap. The assistant answers with a card; nothing
 * here runs on its own.
 */

import { navAnchor } from './appMap'

const WAIT_MS = 1500
const POLL_MS = 60
const HIGHLIGHT_MS = 2500

const OTHER = { business: 'personal', personal: 'business' }

/**
 * Whether the entry can be reached from where the person is.
 *   { ok: true }
 *   { ok: false, reason: 'switch', side }  on the other side; switch first
 *   { ok: false, reason: 'off', side }     that side is switched off in Active modes
 */
export function availability(entry, profile, activeMode) {
  if (!entry) return { ok: false, reason: 'off', side: profile }
  if (entry.needsBoth && activeMode !== 'both') {
    return { ok: false, reason: 'off', side: OTHER[activeMode] ?? 'personal' }
  }
  if (entry.mode === 'both' || entry.mode === profile) return { ok: true }
  if (activeMode !== 'both' && activeMode !== entry.mode) return { ok: false, reason: 'off', side: entry.mode }
  return { ok: false, reason: 'switch', side: entry.mode }
}

/** The route the entry opens on the loaded side, or null to stay put. */
export function routeFor(entry, profile) {
  if (entry.routes) return entry.routes[profile] ?? Object.values(entry.routes)[0]
  return entry.route ?? null
}

const pathOf = (route) => route.split('?')[0]

/** On screen, not hidden, and not parked off-canvas like the phone sidebar. */
function visible(el) {
  if (el.checkVisibility && !el.checkVisibility()) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth
}

const findVisible = (selector) => [...document.querySelectorAll(selector)].find(visible) ?? null

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Polls until `find` returns something, or the wait runs out. */
async function waitFor(find) {
  const until = Date.now() + WAIT_MS
  for (;;) {
    const found = find()
    if (found || Date.now() >= until) return found
    await sleep(POLL_MS)
  }
}

export function highlight(el) {
  // A collapsed section opens first, or there would be nothing to point at.
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (node.tagName === 'DETAILS' && !node.open) node.open = true
  }
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  // Marked by an attribute as well as the class: a NavLink re-rendering after
  // a profile switch rewrites className, but leaves attributes it never set.
  el.classList.remove('help-highlight')
  el.removeAttribute('data-help-highlight')
  // Restart the pulse if it was already running from a previous tap.
  void el.offsetWidth
  el.classList.add('help-highlight')
  el.setAttribute('data-help-highlight', '')
  clearTimeout(el._helpTimer)
  el._helpTimer = setTimeout(() => {
    el.classList.remove('help-highlight')
    el.removeAttribute('data-help-highlight')
  }, HIGHLIGHT_MS)
}

/**
 * Opens the entry's route and highlights its target.
 *
 * A page entry points at its nav item. Where that is not on screen, a phone
 * with the page in the More drawer, the page's own heading stands in.
 * `onArrive` runs once the route is open, before the wait, so the caller can
 * move the assistant panel out of the way.
 *
 * @returns true when something was highlighted, false when the target never
 *   appeared (the caller says "Opened the page").
 */
export async function showMe(entry, { navigate, profile, onArrive } = {}) {
  if (!entry) return false
  const route = routeFor(entry, profile)
  if (route) navigate(route)
  onArrive?.()

  const anchor = entry.kind === 'page' && route ? navAnchor(pathOf(route)) : entry.anchor
  const onRoute = () => !route || window.location.pathname === pathOf(route)

  const target = await waitFor(() => {
    if (!onRoute()) return null
    return (
      findVisible(`[data-help-id="${anchor}"]`) ??
      (entry.kind === 'page' ? findVisible('.bfh-main h1') : null)
    )
  })

  if (!target) return false
  highlight(target)
  return true
}

export default showMe
