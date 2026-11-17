/**
 * Link: any web address yt-dlp can read (a video, or a playlist whose videos
 * become episodes) as a source like the others. Its work id is the page's
 * address; `info` asks `yt-dlp -J`, `download` fetches episodes into the
 * show's folder named by number, so the library, the rolling cache and rooms
 * treat it like any show from a source. Every call takes the proxy the
 * `proxies` setting gives the page's host; the thumbnail is fetched through
 * the same route.
 *
 * Quality is how episodes are fetched: `auto` (the best up to the hub's
 * `maxHeight`, H.264 and AAC first, so the file plays as it is), a height
 * cap, or `audio` only.
 */
import { mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { episodeNumber } from '../episodes.js'
import { parseInfo } from './command.js'
import { commandExists, lastLine, parseLine, run } from './process.js'

export const LINK_SOURCE = 'link'
export const AUTO = 'auto'
export const AUDIO = 'audio'
/** Heights offered when the formats are not known yet (a playlist); a video offers the ones it has. */
const HEIGHTS = Object.freeze([2160, 1440, 1080, 720, 480, 360])
export const isQuality = value => value === AUTO || value === AUDIO || (/^\d{3,4}$/.test(String(value)) && Number(value) >= 144)

const INFO_TIMEOUT_MS = 120_000
const COVER_TIMEOUT_MS = 30_000
const MAX_BLURB = 1000
const MAX_URL = 200

const linkError = (code, message) => Object.assign(new Error(message), { code })
const isWebAddress = (value) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

/** The largest thumbnail yt-dlp lists, or its `thumbnail`. */
function thumbnailOf(data) {
  if (typeof data.thumbnail === 'string') return data.thumbnail
  const listed = (Array.isArray(data.thumbnails) ? data.thumbnails : []).filter(entry => typeof entry?.url === 'string')
  return listed.sort((a, b) => (a.width ?? 0) - (b.width ?? 0)).pop()?.url ?? null
}

const seconds = value => (Number.isFinite(value) && value > 0 ? Math.round(value) : null)

/** The heights a person may pick, best first, never above what the hub plays without scaling down. */
export function qualityChoices(formats, maxHeight) {
  const known = Array.isArray(formats) ? formats.map(format => format?.height).filter(height => Number.isInteger(height) && height > 0) : []
  const heights = (known.length > 0 ? [...new Set(known)] : HEIGHTS).filter(height => height <= maxHeight && height >= 144).sort((a, b) => b - a)
  return [AUTO, ...heights.map(String), AUDIO]
}

/** yt-dlp's `-J` document as a protocol `info` document. */
export function infoDocument(data, url, maxHeight) {
  const page = typeof data.webpage_url === 'string' && isWebAddress(data.webpage_url) ? data.webpage_url : url
  const entries = data._type === 'playlist' ? (data.entries ?? []).filter(entry => entry !== null && typeof entry === 'object') : [data]
  const durations = entries.map(entry => seconds(entry.duration))
  const site = data.webpage_url_domain ?? new URL(page).hostname
  return {
    id: page,
    url: page,
    kind: 'video',
    title: data.title ?? data.id ?? page,
    author: data.uploader ?? data.channel ?? data.playlist_uploader ?? '',
    blurb: typeof data.description === 'string' ? data.description.slice(0, MAX_BLURB) : '',
    cover: thumbnailOf(data) ?? thumbnailOf(entries[0] ?? {}),
    duration: durations.every(Boolean) ? durations.reduce((sum, value) => sum + value, 0) : null,
    popularity: Number.isFinite(data.view_count) ? { count: data.view_count, label: 'plays' } : null,
    tags: Array.isArray(data.tags) ? data.tags : [],
    meta: [{ key: 'site', label: 'Site', value: site }],
    episodes: entries.map((entry, index) => ({ number: index + 1, title: entry.title ?? '' })),
    qualities: qualityChoices(data._type === 'playlist' ? null : data.formats, maxHeight),
  }
}

/** yt-dlp's format choice for a quality. */
export function formatArgs(quality, maxHeight) {
  if (quality === AUDIO) return ['-f', 'ba/b', '-S', 'acodec:aac', '-x', '--audio-format', 'm4a']
  const height = quality === AUTO || !isQuality(quality) ? maxHeight : Math.min(Number(quality), maxHeight)
  return ['-f', 'bv*+ba/b', '-S', `res:${height},vcodec:h264,acodec:aac`, '--merge-output-format', 'mp4']
}

/**
 * @param {{ ytDlp: string, proxies: ReturnType<import('../proxy.js').createProxies>, maxHeight: number, cwd: string, logger: { warn: Function } }} options
 * @returns {import('./index.js').Source}
 */
export function createLinkSource({ ytDlp, proxies, maxHeight, cwd, logger }) {
  async function workDir() {
    await mkdir(cwd, { recursive: true })
    return cwd
  }

  async function ytdlp(url, args, options = {}) {
    if (!isWebAddress(url)) throw linkError('invalid', 'not a web address')
    const proxy = await proxies.route(url)
    return run([ytDlp, '--no-warnings', '--no-playlist', '--proxy', proxy, ...args, '--', url], { cwd: await workDir(), ...options })
  }

  return {
    id: LINK_SOURCE,
    label: '',
    input: 'url',
    kinds: [{ id: 'video', label: '', media: 'video' }],
    filters: [],
    available: () => commandExists(ytDlp),

    async info(url) {
      const { code, stdout, stderr, oversized } = await ytdlp(String(url), ['-J', '--flat-playlist'], { timeoutMs: INFO_TIMEOUT_MS })
      if (oversized) throw linkError('source_failed', 'the page lists too much to read')
      if (code !== 0) throw linkError('source_failed', lastLine(stderr).replace(/^ERROR:\s*/, '') || `yt-dlp exit ${code}`)
      let data
      try {
        data = JSON.parse(stdout)
      } catch {
        throw linkError('source_failed', 'yt-dlp answered something that is not JSON')
      }
      const document = infoDocument(data, String(url), maxHeight)
      if (document.id.length > MAX_URL) throw linkError('invalid', 'the address is too long')
      if (document.episodes.length === 0) throw linkError('empty', 'there is no video at this address')
      return { ...parseInfo(document), qualities: document.qualities }
    },

    /** The thumbnail, through the route of its own host or its page's. */
    async cover(url, file, { page = '' } = {}) {
      await proxies.download(url, file, { page, maxBytes: 2e6, timeoutMs: COVER_TIMEOUT_MS })
    },

    /** Episodes `from`..`to` into `dir`, one file each, named by number; yt-dlp skips the ones already there. */
    async download({ id, dir, from = 1, to = from, quality = AUTO, signal, onEpisode, onStart }) {
      await mkdir(dir, { recursive: true })
      const onLine = (line) => {
        const event = parseLine(line)
        if (!Number.isInteger(event?.number)) return
        if (event.event === 'start') onStart?.(event.number)
        onEpisode?.()
      }
      const number = '%(playlist_index|1)'
      const args = [
        ...formatArgs(quality, maxHeight),
        '-i', '--no-mtime', '--no-progress',
        '-P', `home:${dir}`, '-P', `temp:${join(dir, '.incoming')}`,
        '-o', `${number}03d %(title).100B.%(ext)s`,
        '--playlist-items', `${from}:${to}`,
        '--print', `before_dl:{"event":"start","number":${number}s}`,
        '--print', `after_move:{"event":"done","number":${number}s}`,
      ]
      const { code, stderr } = await ytdlp(String(id), args, { signal, onStdoutLine: onLine })
      onEpisode?.()
      if (signal?.aborted) return { failed: [] }
      const have = new Set((await readdir(dir)).map(episodeNumber).filter(n => n !== null))
      const failed = []
      for (let n = from; n <= to; n++) if (!have.has(n)) failed.push(String(n))
      if (failed.length > 0) logger.warn('link download %s ended with %s: %s', id, code, lastLine(stderr))
      // Nothing landed: the reason is yt-dlp's, not a count of episodes.
      if (code !== 0 && failed.length === to - from + 1) throw linkError('source_failed', lastLine(stderr).replace(/^ERROR:\s*/, '') || `yt-dlp exit ${code}`)
      return { failed }
    },
  }
}
