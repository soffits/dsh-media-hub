/**
 * Cover pictures for search results. A source names a cover by URL (often on
 * a CDN in a country the owner does not want browsers to contact), so the
 * browser never gets that URL: results carry `covers/<key>` and this module
 * fetches the picture through the source's `cover` verb, which keeps the
 * source's own network policy (a launcher routing through a proxy keeps
 * doing so, and fails closed when the proxy is down). There is no fallback
 * that fetches by itself: a source with no `cover` verb, or one that fails,
 * simply has no picture.
 *
 * Pictures are cached under `<stateDir>/covers/<key>.img`, at most `maxFileBytes`
 * each and `capBytes` together; past the cap the least recently shown go.
 */
import { createHash } from 'node:crypto'
import { mkdir, open, readdir, rename, rm, stat, utimes } from 'node:fs/promises'
import { join } from 'node:path'

const KEY = /^[0-9a-f]{32}$/
const FAILED_FOR_MS = 5 * 60_000
const MAX_REMEMBERED = 5000

/** The image type a browser will show, from the file's first bytes, or null. */
export function imageType(head) {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg'
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (head.length >= 4 && head.subarray(0, 4).toString('latin1') === 'GIF8') return 'image/gif'
  if (head.length >= 12 && head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  return null
}

export const coverKey = (sourceId, url) => createHash('sha256').update(`${sourceId}\n${url}`).digest('hex').slice(0, 32)

/**
 * @param {{ dir: string, capBytes?: number, maxFileBytes?: number, concurrency?: number, logger: { warn: Function }, now?: () => number }} options
 * @param {(sourceId: string) => { cover?: (url: string, file: string) => Promise<void> } | undefined} sourceOf
 */
export function createCovers({ dir, capBytes = 50e6, maxFileBytes = 2e6, concurrency = 3, logger, now = Date.now }, sourceOf) {
  /** key -> { sourceId, url }, so a request for a cover can be fetched when it is not cached yet. */
  const known = new Map()
  const inFlight = new Map()
  const failed = new Map()
  const waiting = []
  let running = 0

  const remember = (key, entry) => {
    known.delete(key)
    known.set(key, entry)
    if (known.size > MAX_REMEMBERED) known.delete(known.keys().next().value)
  }

  const pump = () => {
    while (running < concurrency && waiting.length > 0) {
      running += 1
      waiting.shift()().finally(() => { running -= 1; pump() })
    }
  }
  const queued = job => new Promise((resolve, reject) => { waiting.push(() => job().then(resolve, reject)); pump() })

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

  async function fetchOne(key, { sourceId, url }) {
    const source = sourceOf(sourceId)
    if (typeof source?.cover !== 'function') return false
    await mkdir(dir, { recursive: true })
    const partial = join(dir, `.${key}.part`)
    try {
      await source.cover(url, partial)
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
      logger.warn('cover %s from %s: %s', key, sourceId, error.message)
      return false
    } finally {
      await rm(partial, { force: true })
    }
  }

  return {
    /** The route a result's cover is served under; the URL itself stays here. */
    register(sourceId, url) {
      if (typeof url !== 'string' || url === '') return null
      const key = coverKey(sourceId, url)
      remember(key, { sourceId, url })
      return `covers/${key}`
    },

    /**
     * The cached picture for a key (fetching it first when needed), or null.
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
        inFlight.set(key, queued(() => fetchOne(key, entry)).finally(() => inFlight.delete(key)))
      }
      if (!await inFlight.get(key)) {
        failed.set(key, now() + FAILED_FOR_MS)
        return null
      }
      return cached()
    },

    /** Replace each result's cover URL (and those of its related works) with a route. */
    decorate(sourceId, work) {
      const covered = { ...work, cover: this.register(sourceId, work.cover) }
      if (Array.isArray(work.related)) covered.related = work.related.map(other => this.decorate(sourceId, other))
      return covered
    },
  }
}
