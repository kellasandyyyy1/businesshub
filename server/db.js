const path = require('node:path')
const Database = require('better-sqlite3')

// Kept beside the server file so a container with a mounted volume can point
// DB_PATH somewhere persistent without touching the code.
const db = new Database(process.env.DB_PATH || path.join(__dirname, 'bfh.db'))

db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id  TEXT NOT NULL UNIQUE,
    endpoint   TEXT NOT NULL,
    p256dh     TEXT NOT NULL,
    auth       TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notification_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id  TEXT NOT NULL,
    type       TEXT NOT NULL,
    title      TEXT NOT NULL,
    sent_at    TEXT DEFAULT (datetime('now'))
  );

  -- The dedupe lookup is the only hot query: one row per device per type per day.
  CREATE INDEX IF NOT EXISTS idx_log_dedupe ON notification_log (device_id, type, sent_at);
`)

module.exports = db
