/**
 * The plugin's routes on DSH's web server, all under /media-hub:
 *
 *   GET    /media-hub/web/<file>               the page's browser modules and styles (web/), the sync math
 *   GET    /media-hub/media/<room>/<i>/<file>  an episode (Range), or an HLS playlist and its segments
 *   GET    /media-hub/subs/<room>/<i>/<n>.vtt  a subtitle track
 *   GET    /media-hub/covers/<key>             a picture: a work's cover, a show's poster, a room's frame (src/covers.js)
 *   GET    /media-hub/api/rooms                open rooms
 *   DELETE /media-hub/api/rooms/<id>           close a room
 *   POST   /media-hub/api/rooms/<id>/together  open a room someone watches alone to others
 *   GET    /media-hub/api/rooms/<id>/danmaku/<i>   { items: [{ time, text, likes }], at }: a room item's danmaku
 *   GET    /media-hub/api/rooms/<id>/comments[?cursor=]   { total, items, next, at }: the comments on a room's work
 *   POST   /media-hub/api/rooms/<id>/quality   { quality }: fetch the show in another quality from the next episode
 *   GET    /media-hub/api/rooms/<id>/work      the details of the work a room's show came from:
 *   GET    /media-hub/api/library              shows, sizes, free space
 *   GET    /media-hub/api/library/episodes?path=
 *   DELETE /media-hub/api/library?path=[&episode=][&by=]   delete a show or one episode
 *   POST   /media-hub/api/library/rename|keep|countdown|retry|cancel   { path, name?, by? }
 *   POST   /media-hub/api/follow               { source, id, follow }: follow a work (an empty show when it is new), or stop
 *   POST   /media-hub/api/library/seen         { path }: the news of a followed show (new season, new episodes) was seen
 *   POST   /media-hub/api/library/pin           { path, pinned, by? }: keep the whole show offline, or back to the rolling cache
 *   GET    /media-hub/api/settings             { label, presence }: the sidebar entry's configured name, which parts of Watching show
 *   GET    /media-hub/api/locales              { <tag>: { <key>: text } }: the page's words, one table per locale/<tag>.json
 *   GET    /media-hub/api/sources              searchable sources, their kinds (with media) and filters
 *   GET    /media-hub/api/trending?source=&kind=   { trending: [{ source, at, lists }], loading }: what the sources put forward, from the saved copy (asked again in the background when old); source `all` merges every source with the kind
 *   GET    /media-hub/api/search?source=&q=&kind=[&offset=][&language=&format=&yearFrom=&yearTo=&maxMb=]   { results, next, failed? }; source `all` asks every source with the kind
 *   WS     /media-hub/ws?room=<id>             the room's sync channel (src/hub.js)
 *
 * Every request passes `connection.admit`, the check DSH applies to its own
 * API (Host/Origin fence, then the signed browser cookie), and must come
 * from an owner: every browser DSH's login lets in. What acts for a person
 * (looking up and fetching a work, opening a room, the shelf) lives under
 * DSH's own /api instead, where the sign-in plugin says who is asking
 * (src/person-routes.js, src/shelf-routes.js).
 */
import { createReadStream, existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { PREFIX } from './delivery.js'
import { parseFilters } from './filters.js'
import { LOCALE_DIR, readWords } from './locales.js'
import { VENDORED } from './vendored.js'

export const ROUTE = `/${PREFIX}`
export const WS_PATH = `${ROUTE}/ws`

export const SECURITY_HEADERS = Object.freeze({
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
})

const MEDIA_TYPES = Object.freeze({
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.m4s': 'video/iso.segment',
  '.aac': 'audio/aac',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.vtt': 'text/vtt; charset=utf-8',
  '.jpg': 'image/jpeg',
})

const WEB_TYPES = Object.freeze({ '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' })

/** Browser files outside web/, by the name they are served under; everything in web/ is served by its own name. */
const here = fileURLToPath(new URL('.', import.meta.url))
const WEB_DIR = resolve(here, '../web')
/** The modules that also run in the browser, by the name they are served under. `here` is src/ or dist/ (the built entries), both one level below the plugin's folder. */
export const MODULES = Object.freeze({
  'sync.js': resolve(here, '../src/sync.js'),
  'formats.js': resolve(here, '../src/formats.js'),
  'i18n.js': resolve(here, '../src/i18n.js'),
  'captions.js': resolve(here, '../src/captions.js'),
})

/** A package's browser build the page loads (VENDORED): next to the built entries, else from the package (a source checkout). */
function vendoredFile(name) {
  const built = resolve(here, '../dist', name)
  if (existsSync(built)) return built
  const { pkg, file } = VENDORED[name]
  return resolve(dirname(createRequire(import.meta.url).resolve(`${pkg}/package.json`)), file)
}

/** The file behind /media-hub/web/<name>, or undefined. */
export function webFile(name) {
  if (Object.hasOwn(VENDORED, name)) return vendoredFile(name)
  if (MODULES[name] !== undefined) return MODULES[name]
  return /^[a-z0-9-]+\.(js|css)$/.test(name) ? resolve(WEB_DIR, name) : undefined
}

/**
 * Admit one request as the owner.
 * @returns {{ ok: true } | { ok: false, status: 401 | 403 }}
 */
export function admitOwner(connection, request) {
  const admission = connection.admit(request)
  if ('rejection' in admission) return { ok: false, status: admission.rejection }
  if (admission.peer?.principal?.kind !== 'owner') return { ok: false, status: 403 }
  return { ok: true }
}

/**
 * One byte window from a Range header, or why not.
 * @returns {{ kind: 'absent' } | { kind: 'window', start: number, end: number } | { kind: 'unsatisfiable' }}
 */
export function resolveRange(header, size) {
  if (typeof header !== 'string' || header.trim() === '') return { kind: 'absent' }
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim())
  if (match === null || size <= 0) return { kind: 'unsatisfiable' }
  const [, rawStart, rawEnd] = match
  if (rawStart === '') {
    const suffix = Number(rawEnd)
    if (rawEnd === '' || !(suffix > 0)) return { kind: 'unsatisfiable' }
    return { kind: 'window', start: Math.max(0, size - suffix), end: size - 1 }
  }
  const start = Number(rawStart)
  const end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1)
  if (start >= size || end < start) return { kind: 'unsatisfiable' }
  return { kind: 'window', start, end }
}

/**
 * What to send of a file of `size` bytes for a Range header: the status, the bytes and their headers.
 * @returns {{ status: 416, headers: object } | { status: 200 | 206, start: number, end: number, headers: object }}
 */
export function rangePlan(header, size) {
  const range = resolveRange(header, size)
  if (range.kind === 'unsatisfiable') return { status: 416, headers: { 'content-range': `bytes */${size}` } }
  const start = range.kind === 'window' ? range.start : 0
  const end = range.kind === 'window' ? range.end : size - 1
  const headers = { 'content-length': String(size === 0 ? 0 : end - start + 1), ...(range.kind === 'window' ? { 'content-range': `bytes ${start}-${end}/${size}` } : {}) }
  return { status: range.kind === 'window' ? 206 : 200, start, end, headers }
}

/** Serve one file with Range support. */
export async function sendFile(req, res, path, type = MEDIA_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream') {
  let info
  try {
    info = await stat(path)
  } catch {
    return sendText(res, 404, 'Not found.')
  }
  if (!info.isFile()) return sendText(res, 404, 'Not found.')
  const plan = rangePlan(req.headers.range, info.size)
  res.writeHead(plan.status, { ...SECURITY_HEADERS, 'cache-control': 'private, no-store', 'accept-ranges': 'bytes', 'content-type': type, ...plan.headers })
  if (plan.status === 416 || req.method === 'HEAD' || info.size === 0) {
    res.end()
    return
  }
  const stream = createReadStream(path, { start: plan.start, end: plan.end })
  stream.on('error', () => res.destroy())
  res.on('close', () => stream.destroy())
  stream.pipe(res)
}

export function sendText(res, status, text) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'content-type': 'text/plain; charset=utf-8' }).end(`${text}\n`)
}

export function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, { ...SECURITY_HEADERS, 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) }).end(body)
}

/** A path under `root` named by a relative URL path, or null when it would leave it. */
export function within(root, rel) {
  const target = resolve(root, rel)
  const back = relative(root, target)
  if (back === '' || back === '..' || back.startsWith(`..${sep}`) || isAbsolute(back)) return null
  return target
}

const MAX_BODY = 64 * 1024

/** Who did a library action, for the watch log (attribution only). */
const byOf = body => (typeof body?.by === 'string' ? body.by.slice(0, 40) : null)

/** Only the named fields of a request body. */
export const pick = (body, keys) => Object.fromEntries(keys.filter(key => body?.[key] !== undefined).map(key => [key, body[key]]))

async function readJson(req) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) throw Object.assign(new Error('request body too large'), { status: 413 })
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  } catch {
    throw Object.assign(new Error('request body is not JSON'), { status: 400 })
  }
}

/**
 * The page's JSON API under /media-hub/api: method, path (a `:name` segment is a parameter) and the answer, sent as JSON.
 * Each answer gets the hub, the path's parameters, `query(name)`, `body()` (the JSON body) and the page's settings.
 */
export const API = Object.freeze([
  ['GET', 'rooms', async ({ hub }) => ({ rooms: await hub.listRooms() })],
  ['GET', 'rooms/:room/work', ({ hub, params }) => hub.roomWork(params.room)],
  ['GET', 'rooms/:room/danmaku/:index', ({ hub, params }) => hub.roomDanmaku(params.room, Number(params.index))],
  ['GET', 'rooms/:room/comments', ({ hub, params, query }) => hub.roomComments(params.room, query('cursor'))],
  ['POST', 'rooms/:room/quality', async ({ hub, params, body }) => hub.roomQuality(params.room, String((await body()).quality ?? ''))],
  ['POST', 'rooms/:room/together', ({ hub, params }) => hub.watchTogether(params.room)],
  ['DELETE', 'rooms/:room', ({ hub, params }) => hub.closeRoom(params.room)],
  ['GET', 'library', ({ hub }) => hub.library()],
  ['GET', 'library/episodes', async ({ hub, query }) => ({ episodes: await hub.episodes(query('path')) })],
  ['DELETE', 'library', ({ hub, query }) => (query('episode')
    ? hub.removeEpisode(query('path'), query('episode'), query('by') || null)
    : hub.removeShow(query('path'), query('by') || null))],
  ['POST', 'library/rename', async ({ hub, body }) => { const input = await body(); return hub.renameShow(input.path, input.name, byOf(input)) }],
  ['POST', 'library/keep', async ({ hub, body }) => { const input = await body(); return hub.keepShow(input.path, byOf(input)) }],
  ['POST', 'library/countdown', async ({ hub, body }) => { const input = await body(); return hub.countdownShow(input.path, byOf(input)) }],
  ['POST', 'library/retry', async ({ hub, body }) => hub.retryDownload((await body()).path)],
  ['POST', 'library/pin', async ({ hub, body }) => { const input = await body(); return hub.pinShow(input.path, input.pinned === true, byOf(input)) }],
  ['POST', 'library/seen', async ({ hub, body }) => hub.dismissNews((await body()).path)],
  ['POST', 'library/cancel', async ({ hub, body }) => hub.cancelDownload((await body()).path)],
  ['POST', 'follow', async ({ hub, body }) => hub.followWork(pick(await body(), ['source', 'id', 'follow']))],
  ['GET', 'settings', ({ settings }) => settings()],
  ['GET', 'locales', ({ localeDir, logger }) => readWords(localeDir, logger)],
  ['GET', 'sources', async ({ hub }) => ({ sources: await hub.sources() })],
  ['GET', 'trending', ({ hub, query }) => hub.trending(query('source'), query('kind'))],
  ['GET', 'search', ({ hub, query }) => hub.search(query('source'), query('q'), query('kind') || undefined, Math.max(0, Number.parseInt(query('offset'), 10) || 0), parseFilters(query))],
].map(([method, path, answer]) => ({ method, segments: path.split('/'), answer })))

/** The API route for a method and the path's segments after `api`, with its parameters, or null. */
function matchApi(method, parts) {
  for (const route of API) {
    if (route.method !== method || route.segments.length !== parts.length) continue
    const params = {}
    if (route.segments.every((segment, n) => (segment.startsWith(':') ? (params[segment.slice(1)] = parts[n]) !== undefined : segment === parts[n]))) return { answer: route.answer, params }
  }
  return null
}

/**
 * HTTP status for a service error code. A source that failed is 424 (the
 * request depended on a site that said no), never a gateway status: proxies
 * in front of DSH (Cloudflare among them) replace a 502's body with their own
 * page, and the page would lose the reason.
 */
export const STATUS = Object.freeze({ points: 402, invalid: 400, empty: 400, not_found: 404, unsupported: 501, outside: 403, in_use: 409, exists: 409, no_space: 507, source_failed: 424, unavailable: 503 })

export const statusOf = error => error?.status ?? STATUS[error?.code] ?? 500

/** The JSON body of a failed request: its code, the reason a page has words for, and a message for logs and the tool. */
export const errorBody = error => ({ error: { code: error?.code ?? 'error', ...(error?.reason ? { reason: error.reason } : {}), ...(error?.points ? { points: error.points } : {}), message: error?.message ?? String(error) } })

/**
 * The HTTP handler for everything under /media-hub.
 * @param {{ connection: object, service: () => object | undefined }} options - `service` answers the running room service
 */
export function createHandler({ connection, service, settings = () => ({ label: '', presence: {} }), localeDir = LOCALE_DIR, logger }) {
  return async (req, res) => {
    const admitted = admitOwner(connection, req)
    if (!admitted.ok) return sendText(res, admitted.status, admitted.status === 401 ? 'Sign in to DSH first.' : 'Forbidden.')
    const url = new URL(req.url ?? '/', 'http://media-hub.invalid')
    const hub = service()
    if (hub === undefined) return sendText(res, 503, 'The media hub is starting.')
    try {
      let parts
      try {
        parts = url.pathname.slice(ROUTE.length + 1).split('/').map(decodeURIComponent)
      } catch {
        return sendText(res, 400, 'Bad address.')
      }
      if (parts[0] === 'web' && parts.length === 2 && req.method === 'GET') {
        const file = webFile(parts[1])
        const body = file === undefined ? null : await readFile(file).catch(() => null)
        if (body === null) return sendText(res, 404, 'Not found.')
        res.writeHead(200, { ...SECURITY_HEADERS, 'cache-control': 'no-cache', 'content-type': WEB_TYPES[extname(file)], 'content-length': body.length }).end(body)
        return
      }
      if (parts[0] === 'covers' && parts.length === 2 && req.method === 'GET') {
        const cover = await hub.coverFile(parts[1])
        if (cover === null) return sendText(res, 404, 'Not found.')
        return sendFile(req, res, cover.file, cover.type)
      }
      if (parts[0] === 'media' && parts.length >= 4 && (req.method === 'GET' || req.method === 'HEAD')) {
        const item = hub.mediaFile(parts[1], Number(parts[2]))
        if (item === undefined) return sendText(res, 404, 'Not found.')
        const rest = parts.slice(3).join('/')
        if (item.kind === 'hls') {
          const target = within(dirname(item.file), rest)
          return target === null ? sendText(res, 404, 'Not found.') : sendFile(req, res, target)
        }
        return sendFile(req, res, item.file)
      }
      if (parts[0] === 'subs' && parts.length === 4 && req.method === 'GET') {
        const file = hub.subtitleFile(parts[1], Number(parts[2]), Number.parseInt(parts[3], 10))
        return file === undefined ? sendText(res, 404, 'Not found.') : sendFile(req, res, file, MEDIA_TYPES['.vtt'])
      }
      if (parts[0] === 'api') {
        const found = matchApi(req.method, parts.slice(1))
        if (found !== null) {
          const query = name => url.searchParams.get(name) ?? ''
          return sendJson(res, 200, await found.answer({ hub, params: found.params, query, body: () => readJson(req), settings, localeDir, logger }))
        }
      }
      return sendText(res, 404, 'Not found.')
    } catch (error) {
      if (!res.headersSent) sendJson(res, statusOf(error), errorBody(error))
      else res.destroy()
    }
  }
}

/** Refuse an upgrade before any WebSocket handshake. */
export function refuseUpgrade(socket, status) {
  const text = { 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found' }[status] ?? 'Error'
  socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
}
