const webpush = require('web-push')

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
)

/**
 * Delivers one payload to one subscription.
 *
 * A 404 or 410 from the push service means the browser threw the subscription
 * away — the caller deletes the row rather than retrying forever.
 */
async function sendPush(subscription, payload) {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 12 },
    )
    return { ok: true }
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      return { ok: false, expired: true }
    }
    return { ok: false, error: err.body || err.message }
  }
}

module.exports = { sendPush }
