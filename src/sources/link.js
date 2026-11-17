/**
 * Link: any web address yt-dlp can read (a video, or a playlist whose videos
 * become episodes) as a source like the others. Its work id is the page's
 * address; `info` asks `yt-dlp -J`, `download` fetches episodes into the
 * show's folder named by number, with their subtitles beside them, so the
 * library, the rolling cache and rooms treat it like any show from a source.
 * Every call takes the proxy the `proxies` setting gives the page's host and
 * the account the `cookies` setting gives the person it runs for; the
 * thumbnail is fetched through the same route. A failure says why in a
 * reason the page has words for; yt-dlp's own words go to the log.
 *
 * Quality is how episodes are fetched: `auto` (the best up to the hub's
 * `maxHeight`, H.264 and AAC first, so the file plays as it is), a height
 * cap, or `audio` only.
 */
import { mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { episodeNumber } from '../episodes.js'
import { isMedia } from '../library.js'
import { parseInfo } from './command.js'
import { accountView } from '../cookies.js'
import { proxyAnswers } from '../proxy.js'
import { commandExists, lastLine, parseLine, run } from './process.js'
import { PROGRESS_ARGS, createProgress, failureReason, startTemplate, subtitleArgs, subtitleLanguages } from './ytdlp.js'

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

/** What the log and the tool read for each reason; the page shows its own words. */
const REASON_TEXT = Object.freeze({
  blocked: 'the site refused the request',
  sign_in: 'the site wants a signed-in account',
  not_found: 'there is nothing to play at this address',
  proxy_down: 'the proxy for this site is not answering',
  failed: 'the site did not give the video',
})

const linkError = (code, message, reason) => Object.assign(new Error(message), { code, ...(reason ? { reason } : {}) })
const failure = reason => linkError('source_failed', REASON_TEXT[reason], reason)
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
 * @param {{ ytDlp: string, proxies: ReturnType<import('../proxy.js').createProxies>, cookies: ReturnType<import('../cookies.js').createCookies>, maxHeight: number, cwd: string, logger: { warn: Function } }} options
 * @returns {import('./index.js').Source}
 */
export function createLinkSource({ ytDlp, proxies, cookies, maxHeight, cwd, logger }) {
  async function workDir() {
    await mkdir(cwd, { recursive: true })
    return cwd
  }

  /** The route and account for a page, or the reason there is none. */
  async function access(url, person) {
    if (!isWebAddress(url)) throw linkError('invalid', 'not a web address')
    let proxy
    try {
      proxy = await proxies.route(url)
    } catch (error) {
      logger.warn('link %s: %s', url, error.message)
      throw failure('proxy_down')
    }
    let account
    try {
      account = await cookies.account(url, person)
    } catch (error) {
      logger.warn('link %s: %s', url, error.message)
      throw failure('failed')
    }
    return { proxy, account }
  }

  /** One yt-dlp run on `url` for `person`; a failed run becomes its reason. */
  async function ytdlp(url, args, { person = '', ...options } = {}) {
    const { proxy, account } = await access(url, person)
    const dir = await workDir()
    let session
    try {
      session = await cookies.use(account, dir)
    } catch (error) {
      logger.warn('link %s: %s', url, error.message)
      throw failure('sign_in')
    }
    try {
      const result = await run([ytDlp, '--no-warnings', '--no-playlist', '--proxy', proxy, ...session.args, ...args, '--', url], { cwd: dir, ...options })
      return { ...result, proxy, account }
    } finally {
      await session.done()
    }
  }

  /** The reason a run failed: a proxy that does not answer, else what yt-dlp printed. Its words go to the log. */
  async function reasonOf(url, { code, stderr, proxy }) {
    const reason = proxy !== '' && !(await proxyAnswers(proxy)) ? 'proxy_down' : failureReason(stderr)
    logger.warn('link %s failed (%s): %s', url, reason, lastLine(stderr) || `exit ${code}`)
    return failure(reason)
  }

  return {
    id: LINK_SOURCE,
    label: '',
    input: 'url',
    kinds: [{ id: 'video', label: '', media: 'video' }],
    filters: [],
    available: () => commandExists(ytDlp),

    /**
     * The work at an address, read with the account `person` would use (so its qualities are what that account gets).
     * `language` is the viewer's, for choosing generated subtitles.
     */
    async info(url, { person = '', language = '' } = {}) {
      // yt-dlp lists a video's subtitles only when asked to write them (-J writes nothing).
      const result = await ytdlp(String(url), ['-J', '--flat-playlist', '--write-subs', '--write-auto-subs'], { person, timeoutMs: INFO_TIMEOUT_MS })
      if (result.oversized) throw linkError('source_failed', 'the page lists too much to read', 'failed')
      if (result.code !== 0) throw await reasonOf(url, result)
      let data
      try {
        data = JSON.parse(result.stdout)
      } catch {
        throw linkError('source_failed', 'yt-dlp answered something that is not JSON', 'failed')
      }
      const document = infoDocument(data, String(url), maxHeight)
      if (document.id.length > MAX_URL) throw linkError('invalid', 'the address is too long')
      if (document.episodes.length === 0) throw linkError('empty', 'there is no video at this address', 'not_found')
      return { ...parseInfo(document), qualities: document.qualities, account: accountView(result.account), subtitles: subtitleLanguages(data, language) }
    },

    /** The thumbnail, through the route of its own host or its page's. */
    async cover(url, file, { page = '' } = {}) {
      await proxies.download(url, file, { page, maxBytes: 2e6, timeoutMs: COVER_TIMEOUT_MS })
    },

    /**
     * Episodes `from`..`to` into `dir`, one file each, named by number, with their subtitles; yt-dlp skips the ones already there.
     * `subtitles` is the language list `info` chose (null when unknown, then `language`'s), `person` whose account to use.
     */
    async download({ id, dir, from = 1, to = from, quality = AUTO, person = '', subtitles = null, language = '', signal, onEpisode, onStart, onProgress }) {
      await mkdir(dir, { recursive: true })
      const progress = createProgress((number, value) => onProgress?.(number, value))
      const onLine = (line) => {
        const event = parseLine(line)
        if (event === null) return
        progress.event(event)
        if (!Number.isInteger(event.number)) return
        if (event.event === 'start') onStart?.(event.number)
        onEpisode?.()
      }
      const number = '%(playlist_index|1)'
      const args = [
        ...formatArgs(quality, maxHeight),
        ...subtitleArgs(subtitles, language),
        '-i', '--no-mtime', ...PROGRESS_ARGS,
        '-P', `home:${dir}`, '-P', `temp:${join(dir, '.incoming')}`,
        '-o', `${number}03d %(title).100B.%(ext)s`,
        '--playlist-items', `${from}:${to}`,
        '--print', startTemplate(number),
        '--print', `after_move:{"event":"done","number":${number}s}`,
      ]
      const result = await ytdlp(String(id), args, { person, signal, onStdoutLine: onLine })
      onEpisode?.()
      if (signal?.aborted) return { failed: [] }
      const have = new Set((await readdir(dir)).filter(isMedia).map(episodeNumber).filter(n => n !== null))
      const failed = []
      for (let n = from; n <= to; n++) if (!have.has(n)) failed.push(String(n))
      // Nothing landed: the reason is the site's or the route's, not a count of episodes.
      if (result.code !== 0 && failed.length === to - from + 1) throw await reasonOf(id, result)
      if (failed.length > 0) logger.warn('link download %s ended with %s: %s', id, result.code, lastLine(result.stderr))
      return { failed }
    },
  }
}
