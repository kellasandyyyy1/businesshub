const router = require('express').Router()
const db = require('../db')
const { sendPush } = require('../push')

/* The privacy note in the brief says the log keeps "the type only (not the
   content)", while the table has a `title` column. Both are honoured: the
   column stays, but by default it records the notification type rather than
   the client's wording, so no invoice number or peso figure is ever written to
   disk. Set LOG_TITLES=true to store the real title instead. */
const LOG_TITLES = process.env.LOG_TITLES === 'true'

const findRecent = db.prepare(`
  SELECT id FROM notification_log
  WHERE device_id = ? AND type = ?
    AND sent_at >= datetime('now', '-1 day')
`)
const findSubscription = db.prepare('SELECT * FROM subscriptions WHERE device_id = ?')
const removeSubscription = db.prepare('DELETE FROM subscriptions WHERE device_id = ?')
const writeLog = db.prepare('INSERT INTO notification_log (device_id, type, title) VALUES (?, ?, ?)')

/* A device that has not opted in cannot be pushed to, so the only abuse worth
   guarding is a flood of /notify calls filling the log table.

   This has to be a burst allowance rather than a minimum gap: the client fires
   one request per condition the moment it loads, so several arrive back to back
   and every one of them is legitimate. Thirty a minute leaves that whole batch
   room to breathe while capping anything running in a loop. */
const buckets = new Map()
const WINDOW_MS = 60_000
const BURST = 30

function rateLimited(deviceId) {
  const now = Date.now()
  const hits = (buckets.get(deviceId) ?? []).filter((t) => now - t < WINDOW_MS)
  if (hits.length >= BURST) {
    buckets.set(deviceId, hits)
    return true
  }
  hits.push(now)
  buckets.set(deviceId, hits)
  if (buckets.size > 5000) buckets.clear()
  return false
}

/** Body: { deviceId, type, title, body, link } */
router.post('/', async (req, res) => {
  const { deviceId, type, title, body, link } = req.body || {}
  if (!deviceId || !type || !title) {
    return res.status(400).json({ error: 'Missing fields' })
  }

  if (rateLimited(String(deviceId))) {
    return res.status(429).json({ ok: true, skipped: true, reason: 'rate limited' })
  }

  // One push per condition type per device per day. The client can call this on
  // every load without the user ever seeing the same alert twice.
  if (findRecent.get(String(deviceId), String(type))) {
    return res.json({ ok: true, skipped: true, reason: 'already sent today' })
  }

  const sub = findSubscription.get(String(deviceId))
  if (!sub) return res.status(404).json({ error: 'No subscription found' })

  const result = await sendPush(sub, {
    title,
    body: body || '',
    link: link || '/',
    type,
    icon: '/icons/icon-192.png',
    // A notification badge is masked to a square silhouette; the wordmark used
    // here before came out illegible.
    badge: '/icons/icon-96.png',
  })

  if (result.expired) {
    removeSubscription.run(String(deviceId))
    return res.status(410).json({ error: 'Subscription expired' })
  }

  if (!result.ok) {
    return res.status(502).json({ error: result.error })
  }

  writeLog.run(String(deviceId), String(type), LOG_TITLES ? String(title) : String(type))
  res.json({ ok: true })
})

module.exports = router
