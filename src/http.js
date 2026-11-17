/**
 * The plugin's routes on DSH's web server, all under /media-hub:
 *
 *   GET    /media-hub/web/<file>               the page's browser modules and styles (web/), the sync math
 *   GET    /media-hub/media/<room>/<i>/<file>  an episode (Range), or an HLS playlist and its segments
 *   GET    /media-hub/subs/<room>/<i>/<n>.vtt  a subtitle track
 *   GET    /media-hub/thumbs/<key>.jpg         a show's poster frame
 *   GET    /media-hub/covers/<key>             a search result's cover, fetched through its source and cached
 *   GET    /media-hub/api/rooms                open rooms
 *   POST   /media-hub/api/rooms                create a room
 *   DELETE /media-hub/api/rooms/<id>           close a room
 *   GET    /media-hub/api/rooms/<id>/work      the details of the work a room's show came from
 *   GET    /media-hub/api/library              shows, sizes, free space
 *   GET    /media-hub/api/library/episodes?path=
 *   DELETE /media-hub/api/library?path=[&episode=][&by=]   delete a show or one episode
 *   POST   /media-hub/api/library/rename|keep|countdown|retry|cancel   { path, name?, by? }
 *   POST   /media-hub/api/follow               { source, id, follow }: follow a work (an empty show when it is new), or stop
 *   POST   /media-hub/api/library/seen         { path }: the news of a followed show (new season, new episodes) was seen
 *   POST   /media-hub/api/library/refresh      { path }: ask the show's source for its work's details again
 *   POST   /media-hub/api/library/pin           { path, pinned, by? }: keep the whole show offline, or back to the rolling cache
 *   GET    /media-hub/api/settings             { label }: the sidebar entry's configured name
 *   GET    /media-hub/api/locales              { <tag>: { <key>: text } }: the page's words, one table per locale/<tag>.json
 *   GET    /media-hub/api/sources              searchable sources, their kinds (with media) and filters
 *   GET    /media-hub/api/search?source=&q=&kind=[&offset=][&language=&format=&yearFrom=&yearTo=&maxMb=]   { results, next, failed? }; source `all` asks every source with the kind
 *   GET    /media-hub/api/info?source=&id=
 *   POST   /media-hub/api/fetch                { source, id, watch, all, by }: into the library (the rolling cache's window, or the whole show with `all`), or watch now
 *   WS     /media-hub/ws?room=<id>             the room's sync channel (src/hub.js)
 *
 * Every request passes `connection.admit`, the check DSH applies to its own
 * API (Host/Origin fence, then the signed browser cookie), and must come
 * from an owner: every browser DSH's login lets in.
 */
import { createReadStream, existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { PREFIX } from './delivery.js'
import { parseFilters } from './filters.js'
import { readLocales } from './locales.js'

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
const LOCALE_DIR = resolve(here, '../locale')
/** The modules that also run in the browser, by the name they are served under. `here` is src/ or dist/ (the built entries), both one level below the plugin's folder. */
export const MODULES = Object.freeze({
  'sync.js': resolve(here, '../src/sync.js'),
  'youtube-url.js': resolve(here, '../src/youtube-url.js'),
  'formats.js': resolve(here, '../src/formats.js'),
  'i18n.js': resolve(here, '../src/i18n.js'),
})

/** hls.js's browser build: next to the built entries, else from the package (a source checkout). */
function hlsFile() {
  const built = resolve(here, '../dist/hls.mjs')
  return existsSync(built) ? built : resolve(dirname(createRequire(import.meta.url).resolve('hls.js/package.json')), 'dist/hls.mjs')
}

/** The file behind /media-hub/web/<name>, or undefined. */
export function webFile(name) {
  if (name === 'hls.mjs') return hlsFile()
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

/** Serve one file with Range support. */
export async function sendFile(req, res, path, type = MEDIA_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream') {
  let info
  try {
    info = await stat(path)
  } catch {
    return sendText(res, 404, 'Not found.')
  }
  if (!info.isFile()) return sendText(res, 404, 'Not found.')
  const size = info.size
  const range = resolveRange(req.headers.range, size)
  const headers = { ...SECURITY_HEADERS, 'cache-control': 'private, no-store', 'accept-ranges': 'bytes', 'content-type': type }
  if (range.kind === 'unsatisfiable') {
    res.writeHead(416, { ...headers, 'content-range': `bytes */${size}` }).end()
    return
  }
  const start = range.kind === 'window' ? range.start : 0
  const end = range.kind === 'window' ? range.end : size - 1
  const status = range.kind === 'window' ? 206 : 200
  if (range.kind === 'window') headers['content-range'] = `bytes ${start}-${end}/${size}`
  headers['content-length'] = String(size === 0 ? 0 : end - start + 1)
  res.writeHead(status, headers)
  if (req.method === 'HEAD' || size === 0) {
    res.end()
    return
  }
  const stream = createReadStream(path, { start, end })
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
const pick = (body, keys) => Object.fromEntries(keys.filter(key => body?.[key] !== undefined).map(key => [key, body[key]]))

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

/** HTTP status for a service error code. */
const STATUS = Object.freeze({ invalid: 400, empty: 400, not_found: 404, unsupported: 501, outside: 403, in_use: 409, exists: 409, no_space: 507, source_failed: 502, unavailable: 503 })

/**
 * The HTTP handler for everything under /media-hub.
 * @param {{ connection: object, service: () => object | undefined }} options - `service` answers the running room service
 */
export function createHandler({ connection, service, label = () => '', localeDir = LOCALE_DIR, logger }) {
  /** Read once per start: the files ship with the plugin. */
  let locales
  return async (req, res) => {
    const admitted = admitOwner(connection, req)
    if (!admitted.ok) return sendText(res, admitted.status, admitted.status === 401 ? 'Sign in to DSH first.' : 'Forbidden.')
    const url = new URL(req.url ?? '/', 'http://media-hub.invalid')
    const parts = url.pathname.slice(ROUTE.length + 1).split('/').map(decodeURIComponent)
    const hub = service()
    if (hub === undefined) return sendText(res, 503, 'The media hub is starting.')
    try {
      if (parts[0] === 'web' && parts.length === 2 && req.method === 'GET') {
        const file = webFile(parts[1])
        const body = file === undefined ? null : await readFile(file).catch(() => null)
        if (body === null) return sendText(res, 404, 'Not found.')
        res.writeHead(200, { ...SECURITY_HEADERS, 'content-type': WEB_TYPES[extname(file)], 'content-length': body.length }).end(body)
        return
      }
      if (parts[0] === 'thumbs' && parts.length === 2 && req.method === 'GET') {
        const file = hub.thumbFile(parts[1])
        return file === null ? sendText(res, 404, 'Not found.') : sendFile(req, res, file)
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
        const route = `${req.method} ${parts.slice(1).join('/')}`
        const query = name => url.searchParams.get(name) ?? ''
        if (route === 'GET rooms') return sendJson(res, 200, { rooms: await hub.listRooms() })
        if (req.method === 'GET' && parts[1] === 'rooms' && parts.length === 4 && parts[3] === 'work') return sendJson(res, 200, hub.roomWork(parts[2]))
        if (route === 'POST rooms') return sendJson(res, 200, await hub.createRoom({ ...pick(await readJson(req), ['source', 'path', 'urls', 'title', 'by', 'start']), fromPanel: true }))
        if (req.method === 'DELETE' && parts[1] === 'rooms' && parts.length === 3) return sendJson(res, 200, hub.closeRoom(parts[2]))
        if (route === 'GET library') return sendJson(res, 200, await hub.library())
        if (route === 'GET library/episodes') return sendJson(res, 200, { episodes: await hub.episodes(query('path')) })
        if (route === 'DELETE library') {
          const by = query('by') || null
          return sendJson(res, 200, query('episode') ? await hub.removeEpisode(query('path'), query('episode'), by) : await hub.removeShow(query('path'), by))
        }
        if (route === 'POST library/rename') { const body = await readJson(req); return sendJson(res, 200, await hub.renameShow(body.path, body.name, byOf(body))) }
        if (route === 'POST library/keep') { const body = await readJson(req); return sendJson(res, 200, await hub.keepShow(body.path, byOf(body))) }
        if (route === 'POST library/countdown') { const body = await readJson(req); return sendJson(res, 200, await hub.countdownShow(body.path, byOf(body))) }
        if (route === 'POST library/retry') return sendJson(res, 200, await hub.retryDownload((await readJson(req)).path))
        if (route === 'POST library/pin') { const body = await readJson(req); return sendJson(res, 200, await hub.pinShow(body.path, body.pinned === true, byOf(body))) }
        if (route === 'POST follow') return sendJson(res, 200, await hub.followWork(pick(await readJson(req), ['source', 'id', 'follow'])))
        if (route === 'POST library/seen') return sendJson(res, 200, hub.dismissNews((await readJson(req)).path))
        if (route === 'POST library/refresh') return sendJson(res, 200, { work: await hub.refreshWork((await readJson(req)).path) })
        if (route === 'POST library/cancel') return sendJson(res, 200, await hub.cancelDownload((await readJson(req)).path))
        if (route === 'GET settings') return sendJson(res, 200, { label: label() })
        if (route === 'GET locales') return sendJson(res, 200, await (locales ??= readLocales(localeDir, logger)))
        if (route === 'GET sources') return sendJson(res, 200, { sources: await hub.sources() })
        if (route === 'GET search') return sendJson(res, 200, await hub.search(query('source'), query('q'), query('kind') || undefined, Math.max(0, Number.parseInt(query('offset'), 10) || 0), parseFilters(query)))
        if (route === 'GET info') return sendJson(res, 200, await hub.info(query('source'), query('id')))
        if (route === 'POST fetch') return sendJson(res, 200, await hub.fetch(pick(await readJson(req), ['source', 'id', 'watch', 'all', 'by'])))
      }
      return sendText(res, 404, 'Not found.')
    } catch (error) {
      const status = error?.status ?? STATUS[error?.code] ?? 500
      if (!res.headersSent) sendJson(res, status, { error: { code: error?.code ?? 'error', message: error?.message ?? String(error) } })
      else res.destroy()
    }
  }
}

/** Refuse an upgrade before any WebSocket handshake. */
export function refuseUpgrade(socket, status) {
  const text = { 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found' }[status] ?? 'Error'
  socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
}
