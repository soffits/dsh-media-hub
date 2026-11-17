/**
 * What the hub asks of yt-dlp and reads back from it, for any site: progress
 * lines, why a run failed, and which subtitles to fetch. Pure, so recorded
 * output tests it.
 */
import { captionLanguage } from '../captions.js'
import { bestTag } from '../i18n.js'

/** yt-dlp's per-file progress as one JSON line on stdout; `format` is empty for a subtitle file. */
export const PROGRESS_ARGS = Object.freeze([
  '--progress', '--newline', '--progress-delta', '1',
  '--progress-template', 'download:{"event":"progress","format":"%(info.format_id|)s","downloaded":%(progress.downloaded_bytes|null)s,"total":%(progress.total_bytes,progress.total_bytes_estimate|null)s,"speed":%(progress.speed|null)s,"eta":%(progress.eta|null)s}',
])

const positive = value => (Number.isFinite(value) && value > 0 ? value : null)

/** A format's size: what the site announced, else its bitrate (kbit/s) over the video's length. */
export function sizeEstimate(format, duration) {
  const announced = positive(format?.filesize) ?? positive(format?.filesize_approx)
  if (announced !== null) return Math.round(announced)
  const rate = positive(format?.tbr) ?? (positive(format?.vbr) ?? 0) + (positive(format?.abr) ?? 0)
  return rate > 0 && positive(duration) !== null ? Math.round(rate * 125 * duration) : null
}

/**
 * One episode's download as a whole while its formats (a video and an audio
 * file) are fetched side by side: bytes, speed and time left summed over the
 * parts, each part's size as yt-dlp reports it once it runs, else as estimated.
 * @param {{ format: string, estimate: number | null }[]} parts
 * @param {(progress: { fraction: number | null, done: number, total: number | null, speed: number | null, eta: number | null }) => void} report
 */
export function createProgress(parts, report) {
  const state = new Map(parts.map(part => [String(part.format), { done: 0, total: part.estimate, speed: 0, finished: false }]))
  const emit = () => {
    const all = [...state.values()]
    const done = all.reduce((sum, part) => sum + part.done, 0)
    const total = all.every(part => part.total !== null) ? all.reduce((sum, part) => sum + Math.max(part.total, part.done), 0) : null
    const speed = all.reduce((sum, part) => sum + (part.finished ? 0 : part.speed), 0)
    report({
      fraction: total ? Math.min(1, done / total) : null,
      done,
      total,
      speed: speed > 0 ? speed : null,
      eta: speed > 0 && total ? Math.round(Math.max(0, total - done) / speed) : null,
    })
  }
  emit()
  return {
    /** Feed every progress line of every part's run. */
    event(event) {
      const part = event?.event === 'progress' ? state.get(String(event.format)) : undefined
      if (part === undefined) return
      part.done = positive(event.downloaded) ?? part.done
      part.total = positive(event.total) ?? part.total
      part.speed = positive(event.speed) ?? 0
      emit()
    },
    /** A part's file is complete: its size is what it fetched. */
    finished(format) {
      const part = state.get(String(format))
      if (part === undefined) return
      part.finished = true
      if (part.done > 0) part.total = part.done
      emit()
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
const listed = list => Object.entries(list ?? {}).filter(([tag, formats]) => hasText(formats) && captionLanguage(tag) !== null).map(([tag]) => tag)

/**
 * The captions to fetch for a video from its `-J` document: every track a
 * person made in a language that has a name, then, for the viewer's language
 * and the video's own where no such track covers it, a machine-made one
 * (yt-dlp lists those apart, as automatic captions). A machine translation
 * into any other language is never fetched.
 * @returns {{ tag: string, auto: boolean, original: boolean }[]}
 */
export function chooseCaptions(data, viewer) {
  const own = captionLanguage(data?.language)
  const made = listed(data?.subtitles)
  const machine = listed(data?.automatic_captions)
  const chosen = made.map(tag => ({ tag, auto: false }))
  for (const language of [captionLanguage(viewer), own]) {
    if (language === null || chosen.some(track => captionLanguage(track.tag) === language)) continue
    const tag = bestTag(machine.filter(candidate => captionLanguage(candidate) === language), language === own ? data.language : viewer)
    if (tag !== null) chosen.push({ tag, auto: true })
  }
  return chosen.map(track => ({ ...track, original: own !== null && captionLanguage(track.tag) === own }))
}

/** yt-dlp's arguments that write exactly the chosen captions as WebVTT. */
export function captionArgs(chosen) {
  if (chosen.length === 0) return []
  return ['--write-subs', '--write-auto-subs', '--sub-langs', chosen.map(track => escapeTag(track.tag)).join(','), '--sub-format', 'vtt/srt/ass/best', '--convert-subs', 'vtt']
}

/** `--sub-langs` takes regular expressions; a tag is matched as it is. */
const escapeTag = tag => `^${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`
