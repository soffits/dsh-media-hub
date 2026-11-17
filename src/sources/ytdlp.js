/**
 * What the hub asks of yt-dlp and reads back from it, for any site: progress
 * lines, why a run failed, and which subtitles to fetch. Pure, so recorded
 * output tests it.
 */
import { bestTag, localeOf } from '../i18n.js'

/** yt-dlp's per-file progress as one JSON line on stdout; `format` is empty for a subtitle file. */
export const PROGRESS_ARGS = Object.freeze([
  '--progress', '--newline', '--progress-delta', '1',
  '--progress-template', 'download:{"event":"progress","format":"%(info.format_id|)s","downloaded":%(progress.downloaded_bytes|null)s,"total":%(progress.total_bytes,progress.total_bytes_estimate|null)s,"speed":%(progress.speed|null)s,"eta":%(progress.eta|null)s}',
])

/** What `before_dl` prints for an episode: its number and the formats it is made of, with their sizes when known. */
export const startTemplate = number => `before_dl:{"event":"start","number":${number}s,"formats":%(requested_formats.:.format_id|null)j,"sizes":%(requested_formats.:.filesize,filesize_approx|null)j,"size":%(filesize,filesize_approx|null)s}`

const positive = value => (Number.isFinite(value) && value > 0 ? value : null)

/**
 * Follows one run's events and reports each episode's download as a whole:
 * a video fetched as separate video and audio files counts both, by the
 * sizes yt-dlp announced; without sizes, the file being fetched stands for it.
 * @param {(number: number, progress: { fraction: number | null, done: number, total: number | null, speed: number | null, eta: number | null }) => void} report
 */
export function createProgress(report) {
  let current = null
  return {
    /** Feed every parsed stdout event. */
    event(event) {
      if (event.event === 'start' && Number.isInteger(event.number)) {
        const formats = Array.isArray(event.formats) ? event.formats.map(String) : []
        const sizes = Array.isArray(event.sizes) ? event.sizes.map(positive) : []
        current = { number: event.number, formats, sizes: sizes.length > 0 && sizes.every(Boolean) ? sizes : null, size: positive(event.size) }
        report(current.number, { fraction: 0, done: 0, total: current.sizes ? current.sizes.reduce((a, b) => a + b, 0) : current.size, speed: null, eta: null })
        return
      }
      if (event.event !== 'progress' || current === null || !event.format) return
      const downloaded = positive(event.downloaded) ?? 0
      const fileTotal = positive(event.total)
      const at = current.formats.indexOf(String(event.format))
      let done = downloaded
      let total = fileTotal
      if (current.sizes && at >= 0) {
        done = current.sizes.slice(0, at).reduce((a, b) => a + b, 0) + downloaded
        total = current.sizes.reduce((a, b) => a + b, 0)
      }
      report(current.number, {
        fraction: total ? Math.min(1, done / total) : null,
        done,
        total,
        speed: positive(event.speed),
        eta: Number.isFinite(event.eta) && event.eta >= 0 ? Math.round(event.eta) : null,
      })
    },
  }
}

/** Why a run failed, as a reason the page has words for. */
export const REASONS = Object.freeze(['blocked', 'sign_in', 'not_found', 'proxy_down', 'failed'])

/** HTTP statuses a site answers when it refuses a client, wants an account or has nothing there. */
const REFUSED = new Set([403, 412, 429, 451])
const MISSING = new Set([404, 410])

/**
 * The reason in yt-dlp's error output. yt-dlp has no machine-readable error,
 * so this reads only what its shared layers print for every site: the HTTP
 * status of a failed request, the hint to pass cookies that its
 * login-required error carries, and its unsupported-address error.
 */
export function failureReason(stderr) {
  const status = Number(/HTTP Error (\d{3})/.exec(stderr)?.[1])
  if (status === 401 || /--cookies\b/.test(stderr)) return 'sign_in'
  if (REFUSED.has(status)) return 'blocked'
  if (MISSING.has(status) || /\bUnsupported URL\b/.test(stderr)) return 'not_found'
  return 'failed'
}

/** Subtitle formats the hub turns into WebVTT. */
const TEXT_FORMATS = new Set(['vtt', 'srt', 'ass', 'ssa'])
const hasText = formats => (Array.isArray(formats) ? formats : []).some(format => TEXT_FORMATS.has(String(format?.ext)))

/**
 * The subtitle languages to fetch for a video from its `-J` document: every
 * language with subtitles of its own (in a text format), and the generated
 * ones for the viewer's language and the video's own when no such subtitles
 * cover them. Null when the document lists none (a playlist's entries).
 */
export function subtitleLanguages(data, viewer) {
  if (data?.subtitles === undefined && data?.automatic_captions === undefined) return null
  const own = Object.entries(data.subtitles ?? {}).filter(([, formats]) => hasText(formats)).map(([tag]) => tag)
  const generated = Object.entries(data.automatic_captions ?? {}).filter(([, formats]) => hasText(formats)).map(([tag]) => tag)
  const wanted = [...own]
  for (const language of [viewer, data.language]) {
    if (!language || bestTag(own, language)) continue
    const tag = bestTag(generated, language)
    if (tag && !wanted.includes(tag)) wanted.push(tag)
  }
  return wanted
}

/** yt-dlp's subtitle arguments: the languages chosen, or for an unknown list (a playlist's entries) whatever there is in the viewer's language. */
export function subtitleArgs(languages, viewer) {
  const convert = ['--sub-format', 'vtt/srt/ass/best', '--convert-subs', 'vtt']
  if (Array.isArray(languages)) return languages.length === 0 ? [] : ['--write-subs', '--write-auto-subs', '--sub-langs', languages.map(escapeTag).join(','), ...convert]
  const primary = localeOf(viewer)?.language
  return primary ? ['--write-subs', '--write-auto-subs', '--sub-langs', `^${primary}(-.*)?$`, ...convert] : []
}

/** `--sub-langs` takes regular expressions; a tag is matched as it is. */
const escapeTag = tag => `^${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`
