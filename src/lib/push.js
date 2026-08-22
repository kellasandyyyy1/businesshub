/**
 * Web Push, client side.
 *
 * The backend this talks to stores push subscriptions and nothing else. Every
 * figure in a notification is computed here, from IndexedDB, and handed over as
 * a plain string moments before delivery.
 */

const BACKEND = import.meta.env.VITE_PUSH_BACKEND_URL

const DEVICE_KEY = 'bfh-device-id'
const ENABLED_KEY = 'bfh-push-enabled'

/** Push needs all three: a worker to receive it, a manager to subscribe, and permission to show it. */
export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** Without a backend URL there is nowhere to register, so the feature stays hidden. */
export function isPushConfigured() {
  return Boolean(BACKEND)
}

/** Notification.permission === 'denied' can only be undone in browser settings. */
export function isPushBlocked() {
  return isPushSupported() && Notification.permission === 'denied'
}

export function isPushEnabled() {
  try {
    return localStorage.getItem(ENABLED_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * A stable id for this browser profile. It is the only thing the backend knows
 * about the user — a random UUID tied to no account and no name.
 */
function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

async function getVapidKey() {
  const res = await fetch(`${BACKEND}/vapid-public-key`)
  if (!res.ok) throw new Error('Could not reach the push server')
  const { key } = await res.json()
  if (!key) throw new Error('Push server has no VAPID key configured')
  return key
}

/** The subscribe call wants raw bytes, and VAPID keys travel as URL-safe base64. */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

/**
 * Registers the worker, asks for permission, and files the subscription with
 * the backend. Resolves to a reason rather than throwing, so the settings
 * toggle can say what went wrong.
 */
export async function subscribeToPush() {
  if (!isPushConfigured()) return { ok: false, reason: 'unconfigured' }
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, reason: 'denied' }

  try {
    // Whichever worker is already registered handles push — in production
    // that is the generated /sw.js, which imports the push handlers; in dev the
    // plugin serves its own worker under a different name. Registering a fixed
    // path would miss the dev one and fail.
    const reg =
      (await navigator.serviceWorker.getRegistration()) ??
      (await navigator.serviceWorker.register('/sw.js'))
    await navigator.serviceWorker.ready

    // Reuse whatever the browser already holds; subscribing twice with the same
    // key returns the same object, but reading it first avoids the round trip.
    const existing = await reg.pushManager.getSubscription()
    const subscription =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(await getVapidKey()),
      }))

    const sub = subscription.toJSON()
    const res = await fetch(`${BACKEND}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: getDeviceId(),
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      }),
    })
    if (!res.ok) return { ok: false, reason: 'server' }

    localStorage.setItem(ENABLED_KEY, 'true')
    return { ok: true }
  } catch {
    return { ok: false, reason: 'server' }
  }
}

export async function unsubscribeFromPush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (reg) {
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
    }
    await fetch(`${BACKEND}/subscribe`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: getDeviceId() }),
    })
  } catch {
    // The local flag still clears — the backend drops the row on the next 410.
  }
  localStorage.removeItem(ENABLED_KEY)
}

/**
 * Asks the backend to deliver one notification. Safe to call on every load: the
 * server sends at most one push per type per day and answers 410 once the
 * browser has discarded the subscription.
 */
export async function triggerPush({ type, title, body, link }) {
  if (!isPushEnabled() || !isPushConfigured()) return

  try {
    const res = await fetch(`${BACKEND}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: getDeviceId(), type, title, body, link }),
    })
    // 410 (expired) and 404 (row already gone) both mean this device is no
    // longer reachable, so stop claiming push is on.
    if (res.status === 410 || res.status === 404) localStorage.removeItem(ENABLED_KEY)
  } catch {
    // Offline or the server is down. Push is an extra, never a dependency.
  }
}
