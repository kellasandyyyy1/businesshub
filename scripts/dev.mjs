import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Starts the app and the push server together.
 *
 * Push needs a second process listening on 3001. Leaving that to memory meant
 * the notifications screen reported the server as unavailable whenever someone
 * ran only Vite — which looked like a broken feature rather than a process that
 * was never started.
 *
 * The push server is optional: if its dependencies or keys are missing it says
 * so and the app carries on without it, exactly as it does today.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const server = join(root, 'server')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const children = []

/**
 * `shell` is needed to launch npm.cmd on Windows, but must stay off for the
 * node binary — its path contains a space, and a shell would split it.
 */
function start(name, command, args, cwd, shell = false) {
  const child = spawn(command, args, { cwd, stdio: 'inherit', shell })
  child.on('error', (err) => console.error(`[${name}] failed to start: ${err.message}`))
  child.on('exit', (code) => {
    // Vite going down means the session is over; the push server going down is
    // survivable, so it only reports itself and leaves the app running.
    if (name === 'web') shutdown(code ?? 0)
    else if (code) console.error(`\n[push] exited with code ${code} — push notifications are off for this session.\n`)
  })
  children.push(child)
  return child
}

function shutdown(code) {
  for (const child of children) child.kill()
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

start('web', npm, ['run', 'dev:web'], root, process.platform === 'win32')

if (!existsSync(join(server, 'node_modules'))) {
  console.warn('\n[push] server/node_modules is missing — run "npm install" inside server/.\n')
} else if (!existsSync(join(server, '.env'))) {
  console.warn('\n[push] server/.env is missing — copy server/.env.example and add your VAPID keys.\n')
} else {
  start('push', process.execPath, ['index.js'], server)
}
