require('dotenv').config()

const express = require('express')
const cors = require('cors')

for (const key of ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_EMAIL']) {
  if (!process.env[key]) {
    console.error(`Missing ${key}. Run "npm run keys" and fill in server/.env.`)
    process.exit(1)
  }
}

const app = express()

// A deployed client and a local dev client are usually both in play, so the
// origin list is comma-separated rather than a single value.
const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header at all means curl or a health check, not a browser.
      if (!origin || origins.includes(origin)) return callback(null, true)
      return callback(new Error('Origin not allowed'))
    },
  }),
)
app.use(express.json({ limit: '32kb' }))

app.use('/subscribe', require('./routes/subscribe'))
app.use('/notify', require('./routes/notify'))

app.get('/vapid-public-key', (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY })
})

app.get('/health', (req, res) => res.json({ ok: true }))

// CORS rejections and malformed JSON both land here; neither should take the
// process down or leak a stack trace to the caller.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err)
  const status = err.type === 'entity.parse.failed' ? 400 : 403
  res.status(status).json({ error: err.message })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`BFH push server running on ${PORT}`))
