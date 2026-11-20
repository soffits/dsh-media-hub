/**
 * Every picture the page shows: a work's cover, a show's poster, a room's
 * frame. One cache and one route (`covers/<key>`) for all of them, with the
 * ways to make one:
 *
 * - `source`: a picture a source names by URL, fetched by that source (its
 *   `cover`), which keeps the source's own network route: a command source
 *   runs its `cover` verb, Link fetches through the `proxies` setting. The
 *   browser never sees the URL, and nothing here fetches by itself: a source
 *   that can't simply has no picture.
 * - `frame`: a still of a local video (or an audio file's cover art), made
 *   with ffmpeg.
 *
 * A route is handed out at once and the picture made the first time someone
 * asks for it, at most `concurrency` at a time; one that could not be made is
 * not tried again for a while, and the page shows its next choice or a
 * placeholder. Pictures are kept under `<stateDir>/covers/<key>.img`, at most
 * `maxFileBytes` each and `capBytes` together; past the cap the least
 * recently shown go.
 */
import { createHash } from 'node:crypto'
import { mkdir, open, readdir, rename, rm, stat, utimes } from 'node:fs/promises'
import { join } from 'node:path'
import { isAudio } from './library.js'
import { createLimiter } from './limit.js'
import { runFfmpeg } from './prepare.js'

const KEY = /^[0-9a-f]{32}$/
const FAILED_FOR_MS = 5 * 60_000
const MAX_REMEMBERED = 5000
/** Poster frames are this tall; the page shows them at most about this size. */
const FRAME_HEIGHT = 180

/** The image type a browser will show, from the file's first bytes, or null. */
export function imageType(head) {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg'
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (head.length >= 4 && head.subarray(0, 4).toString('latin1') === 'GIF8') return 'image/gif'
  if (head.length >= 12 && head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  return null
}

const keyOf = (...parts) => createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 32)
export const coverKey = (sourceId, url) => keyOf(sourceId, url)

/** A still of `input` `at` seconds in (an audio file's cover art), as a JPEG `output`; a video too short for `at` gives its first frame. */
export async function grabFrame(input, output, at, { ffmpeg }) {
  const frame = ['-map', '0:V:0', '-frames:v', '1', '-vf', `scale=-2:${FRAME_HEIGHT}`, '-q:v', '5', '-f', 'image2', '-c:v', 'mjpeg', output]
  const attempts = isAudio(input) ? [['-y', '-i', input, ...frame]] : [['-y', '-ss', String(at), '-i', input, ...frame], ['-y', '-i', input, ...frame]]
  let failure
  for (const args of attempts) {
    try {
      await runFfmpeg(args, { ffmpeg, duration: null })
      return
    } catch (error) {
      failure = error
    }
  }
  throw failure
}

/**
 * @param {{ dir: string, capBytes?: number, maxFileBytes?: number, concurrency?: number, ffmpeg?: string, logger: { warn: Function }, now?: () => number }} options
 * @param {(sourceId: string) => { cover?: (url: string, file: string, context: { page: string }) => Promise<void> } | undefined} sourceOf
 */
export function createCovers({ dir, capBytes = 50e6, maxFileBytes = 2e6, concurrency = 3, ffmpeg = 'ffmpeg', logger, now = Date.now }, sourceOf) {
  /** key -> how to make it, so a request for a picture not cached yet can be made. */
  const known = new Map()
  const inFlight = new Map()
  const failed = new Map()

  const makers = {
    async source({ sourceId, url, page }, file) {
      const source = sourceOf(sourceId)
      if (typeof source?.cover !== 'function') throw new Error(`${sourceId} has no pictures`)
      await source.cover(url, file, { page })
    },
    frame: ({ file: input, at }, file) => grabFrame(input, file, at, { ffmpeg }),
  }

  const remember = (key, entry) => {
    known.delete(key)
    known.set(key, entry)
    if (known.size > MAX_REMEMBERED) known.delete(known.keys().next().value)
    return `covers/${key}`
  }

  const queued = createLimiter(concurrency)

  async function trim() {
    if (!(capBytes > 0)) return
    const files = []
    for (const name of await readdir(dir).catch(() => [])) {
      if (!name.endsWith('.img')) continue
      const info = await stat(join(dir, name)).catch(() => null)
      if (info !== null) files.push({ name, size: info.size, used: info.mtimeMs })
    }
    let total = files.reduce((sum, file) => sum + file.size, 0)
    for (const file of files.sort((a, b) => a.used - b.used)) {
      if (total <= capBytes) break
      await rm(join(dir, file.name), { force: true })
      total -= file.size
    }
  }

  async function make(key, entry) {
    await mkdir(dir, { recursive: true })
    const partial = join(dir, `.${key}.part`)
    try {
      await makers[entry.by](entry, partial)
      const info = await stat(partial)
      if (info.size === 0 || info.size > maxFileBytes) throw new Error(`the picture is ${info.size} bytes`)
      const handle = await open(partial, 'r')
      const head = Buffer.alloc(12)
      try { await handle.read(head, 0, 12, 0) } finally { await handle.close() }
      if (imageType(head) === null) throw new Error('the file is not a picture a browser shows')
      await rename(partial, join(dir, `${key}.img`))
      await trim()
      return true
    } catch (error) {
      logger.warn('picture %s (%s): %s', key, entry.by === 'source' ? entry.sourceId : entry.file, error.message)
      return false
    } finally {
      await rm(partial, { force: true })
    }
  }

  return {
    /** The route of a picture a source names by `url` (`page`: the work's own address, for the route a fetch takes); the URL itself stays here. */
    ofSource(sourceId, url, page = null) {
      if (typeof url !== 'string' || url === '') return null
      return remember(coverKey(sourceId, url), { by: 'source', sourceId, url, page: page ?? '' })
    },

    /** The route of a still of the media file `file`, `at` seconds in; a changed file gets a new one. */
    async ofFrame(file, at = 3) {
      const info = await stat(file).catch(() => null)
      if (info === null || !info.isFile()) return null
      return remember(keyOf('frame', file, info.size, info.mtimeMs, at), { by: 'frame', file, at })
    },

    /**
     * The cached picture for a key (making it first when needed), or null.
     * @returns {Promise<{ file: string, type: string } | null>}
     */
    async file(key) {
      if (!KEY.test(key)) return null
      const file = join(dir, `${key}.img`)
      const cached = async () => {
        const handle = await open(file, 'r').catch(() => null)
        if (handle === null) return null
        try {
          const head = Buffer.alloc(12)
          await handle.read(head, 0, 12, 0)
          const type = imageType(head)
          if (type === null) return null
          const time = new Date(now())
          await utimes(file, time, time).catch(() => {})
          return { file, type }
        } finally {
          await handle.close()
        }
      }
      const have = await cached()
      if (have !== null) return have
      const entry = known.get(key)
      if (entry === undefined || (failed.get(key) ?? 0) > now()) return null
      if (!inFlight.has(key)) {
        inFlight.set(key, queued(() => make(key, entry)).finally(() => inFlight.delete(key)))
      }
      if (!await inFlight.get(key)) {
        failed.set(key, now() + FAILED_FOR_MS)
        return null
      }
      return cached()
    },

    /** Replace a work's cover URL (and those of its related works) with a route. */
    decorate(sourceId, work) {
      const covered = { ...work, cover: this.ofSource(sourceId, work.cover, work.url) }
      if (Array.isArray(work.related)) covered.related = work.related.map(other => this.decorate(sourceId, other))
      return covered
    },

    /** Wait for the pictures being made, so nothing writes into the state folder after shutdown. */
    settle: () => Promise.allSettled([...inFlight.values()]),
  }
}
