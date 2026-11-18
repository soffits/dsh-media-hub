import { execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:http'
import WebSocket, { WebSocketServer } from 'ws'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** A temporary folder removed after the test file. */
export function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'media-hub-test-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

export const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
    execFileSync('ffprobe', ['-version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

/**
 * A short test video.
 * @param {string} path
 * @param {{ seconds?: number, faststart?: boolean, codec?: string, extra?: string[] }} [options]
 */
export function makeVideo(path, { seconds = 2, faststart = true, codec = 'libx264', extra = [] } = {}) {
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', `testsrc2=size=160x90:rate=10:duration=${seconds}`,
    '-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds}`,
    '-c:v', codec, ...(codec === 'libx264' ? ['-pix_fmt', 'yuv420p'] : []), '-c:a', 'aac', '-shortest',
    ...(faststart ? ['-movflags', '+faststart'] : []),
    ...extra,
    path,
  ])
}

/** A fake DSH connection that admits requests carrying `cookie: ok`. */
export const fakeConnection = {
  admit(request) {
    if (request.headers.cookie === 'ok') return { peer: { principal: { kind: 'owner' } } }
    if (request.headers.cookie === 'guest') return { peer: { principal: { kind: 'guest' } } }
    return { rejection: 401 }
  },
}

export const quietLogger = { info() {}, warn() {} }

/** A loopback server whose sockets join `service` rooms. */
export async function socketServer(t, service) {
  const wss = new WebSocketServer({ noServer: true })
  const server = createServer()
  server.on('upgrade', (req, socket, head) => {
    const room = new URL(req.url, 'http://x').searchParams.get('room')
    wss.handleUpgrade(req, socket, head, ws => service.attach(ws, room))
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  t.after(() => {
    wss.close()
    server.close()
  })
  return room => `ws://127.0.0.1:${server.address().port}/media-hub/ws?room=${room}`
}

/** A viewer socket that keeps every message and can wait for one. */
export async function viewer(url, clientId, name) {
  const ws = new WebSocket(url)
  const messages = []
  const waiting = []
  ws.on('message', (data) => {
    const message = JSON.parse(String(data))
    messages.push(message)
    for (const wait of [...waiting]) {
      if (wait.match(message)) {
        waiting.splice(waiting.indexOf(wait), 1)
        wait.resolve(message)
      }
    }
  })
  await once(ws, 'open')
  ws.send(JSON.stringify({ t: 'hello', clientId, name }))
  return {
    ws,
    messages,
    send: message => ws.send(JSON.stringify(message)),
    next(match) {
      const found = messages.find(match)
      if (found) {
        messages.splice(messages.indexOf(found), 1)
        return Promise.resolve(found)
      }
      return new Promise(resolve => waiting.push({ match: m => { if (!match(m)) return false; messages.splice(messages.indexOf(m), 1); return true }, resolve }))
    },
  }
}

/**
 * The points plugin's `points` service as the hub sees it (@soffits/dsh-points): `players` maps a person to their
 * balance; `buy` stands for the person's yes in the plugin's dialog. Every call is in `calls`.
 */
export function fakePoints(players) {
  const shop = {}
  const tickets = []
  const calls = []
  const held = (person, key) => tickets.find(t => t.person === person && t.item === key && !t.used)
  return {
    enabled: true,
    shop,
    calls,
    players,
    async ticketFor(person, item, { source }) {
      calls.push(['ticketFor', person, item.key, source])
      if (!(person in players)) return null
      shop[item.key] = item
      const ticket = held(person, item.key)
      if (ticket) return { ticket: ticket.id }
      throw Object.assign(new Error(`${item.key} needs a ticket`), { code: 'points', status: 402, points: { item: item.key, source } })
    },
    async use(person, ticket, source) {
      calls.push(['use', person, ticket.ticket, source])
      const found = tickets.find(t => t.id === ticket.ticket)
      if (shop[found.item].uses !== 0) found.used = source
    },
    buy(person, key, source) {
      calls.push(['buy', person, key, source])
      players[person] -= shop[key].cost
      tickets.push({ id: `t${tickets.length + 1}`, person, item: key, source, used: false })
    },
  }
}
