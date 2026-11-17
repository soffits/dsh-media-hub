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
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { captionLabel } from '../captions.js'
import { episodeNumber } from '../episodes.js'
import { isMedia } from '../library.js'
import { parseInfo } from './command.js'
import { accountView } from '../cookies.js'
import { proxyAnswers } from '../proxy.js'
import { commandExists, lastLine, parseLine, run } from './process.js'
import { runFfmpeg } from '../prepare.js'
import { PROGRESS_ARGS, captionArgs, chooseCaptions, createProgress, failureReason, sizeEstimate } from './ytdlp.js'

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
  if (quality === AUDIO) return ['-f', 'ba/b', '-S', 'acodec:aac']
  const height = quality === AUTO || !isQuality(quality) ? maxHeight : Math.min(Number(quality), maxHeight)
  return ['-f', 'bv*+ba/b', '-S', `res:${height},vcodec:h264,acodec:aac`]
}

/** An audio-only episode becomes an m4a file. */
const AUDIO_FILE = Object.freeze(['-x', '--audio-format', 'm4a'])
const MAX_STEM_BYTES = 100
/** Containers two fetched parts are merged into, in order of preference. */
const MERGED = Object.freeze(['mp4', 'mkv'])
/** Where an episode is fetched before it lands, inside the show's folder. */
export const INCOMING = '.incoming'

/** An episode's file name before its extension: its number, then its title as any file system takes it. */
export function episodeStem(number, title) {
  const clean = String(title ?? '').replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()
  let cut = ''
  for (const char of clean) {
    if (Buffer.byteLength(cut + char) > MAX_STEM_BYTES) break
    cut += char
  }
  const number3 = String(number).padStart(3, '0')
  return cut === '' ? number3 : `${number3} ${cut}`
}

/**
 * @param {{ ytDlp: string, ffmpeg?: string, proxies: ReturnType<import('../proxy.js').createProxies>, cookies: ReturnType<import('../cookies.js').createCookies>, maxHeight: number, cwd: string, logger: { warn: Function } }} options
 * @returns {import('./index.js').Source}
 */
export function createLinkSource({ ytDlp, ffmpeg = 'ffmpeg', proxies, cookies, maxHeight, cwd, logger }) {
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

  /**
   * One yt-dlp run on `url` for `person`, with the route and account of its page. `load` reads
   * an earlier run's document instead of the page, so the video is not looked up again.
   */
  async function ytdlp(url, args, { person = '', load = null, ...options } = {}) {
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
      const target = load === null ? ['--', url] : ['--load-info-json', load]
      const result = await run([ytDlp, '--no-warnings', '--no-playlist', '--proxy', proxy, ...session.args, ...args, ...target], { cwd: dir, ...options })
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

  /** A `-J` document, or why there is none. */
  async function lookUp(url, args, options) {
    const result = await ytdlp(url, ['-J', ...args], options)
    if (result.oversized) throw linkError('source_failed', 'the page lists too much to read', 'failed')
    if (result.code !== 0) throw await reasonOf(url, result)
    try {
      return { data: JSON.parse(result.stdout), account: result.account }
    } catch {
      throw linkError('source_failed', 'yt-dlp answered something that is not JSON', 'failed')
    }
  }

  /** The captions chosen for `language` into `dir` beside the episode's file-to-be; they never stop the episode. */
  async function fetchCaptions(url, { entry, load, work, dir, stem, language, person, signal }) {
    const chosen = chooseCaptions(entry, language)
    if (chosen.length === 0) return []
    const result = await ytdlp(url, ['--skip-download', ...captionArgs(chosen), '-o', join(work, 'captions')], { person, load, signal })
    if (result.code !== 0) logger.warn('link %s: captions: %s', url, lastLine(result.stderr))
    const placed = []
    for (const track of chosen) {
      const label = captionLabel(track)
      const target = join(dir, `${stem}.${label}.vtt`)
      if (await rename(join(work, `captions.${track.tag}.vtt`), target).then(() => true, () => false)) placed.push({ path: target, label })
    }
    return placed
  }

  /** The fetched parts as one file in `dir`: a single part as it is, a video and an audio file merged without re-encoding. */
  async function assemble(files, dir, stem) {
    if (files.length === 1) {
      const target = join(dir, `${stem}${extname(files[0])}`)
      await rename(files[0], target)
      return target
    }
    let last = null
    for (const ext of MERGED) {
      const target = join(dir, `${stem}.${ext}`)
      const part = join(dirname(files[0]), `merged.${ext}`)
      try {
        await runFfmpeg(['-y', ...files.flatMap(file => ['-i', file]), ...files.flatMap((_, n) => ['-map', String(n)]), '-c', 'copy', ...(ext === 'mp4' ? ['-movflags', '+faststart'] : []), part], { ffmpeg, duration: null })
        await rename(part, target)
        return target
      } catch (error) {
        last = error
      }
    }
    throw last
  }

  return {
    id: LINK_SOURCE,
    label: '',
    input: 'url',
    kinds: [{ id: 'video', label: '', media: 'video' }],
    filters: [],
    available: () => commandExists(ytDlp),

    /** The work at an address, read with the account `person` would use (so its qualities are what that account gets). */
    async info(url, { person = '' } = {}) {
      const { data, account } = await lookUp(String(url), ['--flat-playlist'], { person, timeoutMs: INFO_TIMEOUT_MS })
      const document = infoDocument(data, String(url), maxHeight)
      if (document.id.length > MAX_URL) throw linkError('invalid', 'the address is too long')
      if (document.episodes.length === 0) throw linkError('empty', 'there is no video at this address', 'not_found')
      return { ...parseInfo(document), qualities: document.qualities, account: accountView(account) }
    },

    /** The thumbnail, through the route of its own host or its page's. */
    async cover(url, file, { page = '' } = {}) {
      await proxies.download(url, file, { page, maxBytes: 2e6, timeoutMs: COVER_TIMEOUT_MS })
    },

    /**
     * Episodes `from`..`to` into `dir`, one file each, named by number, with the captions chosen for the viewer's
     * `language` beside them; episodes already there are skipped. Each episode is looked up once, then its formats
     * (a video and an audio file) are fetched side by side, so `onPartial` can hand over files that play while they
     * grow, and `onProgress` tells the episode's progress as a whole.
     */
    async download({ id, dir, from = 1, to = from, quality = AUTO, person = '', language = '', signal, onEpisode, onStart, onProgress, onPartial }) {
      await mkdir(dir, { recursive: true })
      const url = String(id)
      const failed = []
      let first = null
      for (let number = from; number <= to && !signal?.aborted; number++) {
        if ((await readdir(dir)).some(name => isMedia(name) && episodeNumber(name) === number)) continue
        onStart?.(number)
        const work = join(dir, INCOMING, String(number))
        try {
          await fetchEpisode(number, work)
        } catch (error) {
          if (signal?.aborted) break
          failed.push(String(number))
          first ??= error
          logger.warn('link download %s, episode %d: %s', url, number, error.message)
        } finally {
          await rm(work, { recursive: true, force: true })
        }
        onEpisode?.()
      }
      // Nothing landed: the reason is the site's or the route's, not a count of episodes.
      if (first !== null && failed.length === to - from + 1) throw first
      return { failed }

      async function fetchEpisode(number, work) {
        await rm(work, { recursive: true, force: true })
        await mkdir(work, { recursive: true })
        const { data } = await lookUp(url, [...formatArgs(quality, maxHeight), '--write-subs', '--playlist-items', String(number)], { person, signal, timeoutMs: INFO_TIMEOUT_MS })
        const entry = data._type === 'playlist' ? (data.entries ?? []).find(item => item !== null && typeof item === 'object') : data
        if (entry === undefined) throw failure('not_found')
        const load = join(work, 'info.json')
        await writeFile(load, JSON.stringify(entry))
        const stem = episodeStem(number, entry.title)
        const captions = await fetchCaptions(url, { entry, load, work, dir, stem, language, person, signal })
        try {
          const parts = Array.isArray(entry.requested_formats) && entry.requested_formats.length > 0 ? entry.requested_formats : [entry]
          const progress = createProgress(parts.map(part => ({ format: String(part.format_id), estimate: sizeEstimate(part, entry.duration) })), value => onProgress?.(number, value))
          const runs = parts.map((part, n) => ytdlp(url, [
            '-f', String(part.format_id), '--no-part', ...(quality === AUDIO ? AUDIO_FILE : []), ...PROGRESS_ARGS, '-o', join(work, `part${n}.%(ext)s`),
          ], { person, load, signal, onStdoutLine: (line) => { const event = parseLine(line); if (event !== null) progress.event(event) } }).then((result) => {
            if (result.code === 0) progress.finished(part.format_id)
            return result
          }))
          if (quality !== AUDIO) onPartial?.(number, { files: parts.map((part, n) => join(work, `part${n}.${part.ext}`)), subtitles: captions, growing: Promise.allSettled(runs) })
          const results = await Promise.all(runs)
          const broken = results.find(result => result.code !== 0)
          if (broken !== undefined) throw await reasonOf(url, broken)
          const names = (await readdir(work)).filter(name => /^part\d+\./.test(name)).sort()
          await assemble(names.map(name => join(work, name)), dir, stem)
        } catch (error) {
          for (const caption of captions) await rm(caption.path, { force: true })
          throw error
        }
      }
    },
  }
}
