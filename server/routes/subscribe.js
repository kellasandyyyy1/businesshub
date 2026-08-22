const router = require('express').Router()
const db = require('../db')

const upsert = db.prepare(`
  INSERT INTO subscriptions (device_id, endpoint, p256dh, auth)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(device_id) DO UPDATE SET
    endpoint = excluded.endpoint,
    p256dh   = excluded.p256dh,
    auth     = excluded.auth
`)

const remove = db.prepare('DELETE FROM subscriptions WHERE device_id = ?')
const purgeLog = db.prepare('DELETE FROM notification_log WHERE device_id = ?')

/** Register a device, or refresh the endpoint the browser rotated. */
router.post('/', (req, res) => {
  const { deviceId, endpoint, p256dh, auth } = req.body || {}
  if (!deviceId || !endpoint || !p256dh || !auth) {
    return res.status(400).json({ error: 'Missing fields' })
  }
  upsert.run(String(deviceId), String(endpoint), String(p256dh), String(auth))
  res.json({ ok: true })
})

/** Unsubscribe. The send log goes too — nothing about the device should outlive it. */
router.delete('/', (req, res) => {
  const { deviceId } = req.body || {}
  if (deviceId) {
    remove.run(String(deviceId))
    purgeLog.run(String(deviceId))
  }
  res.json({ ok: true })
})

module.exports = router
