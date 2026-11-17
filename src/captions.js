/**
 * Captions for any source: which language a track is in, which tracks are
 * worth fetching, and which one a viewer starts with. Pure; runs in Node and
 * in the browser (served as `captions.js`).
 *
 * A track is known by its label: a language tag, then optional marks, as in
 * `ep1.zh-Hans.auto.vtt` (label `zh-Hans.auto`). `auto` marks a track made by
 * a machine (speech recognition or translation), `original` one in the
 * video's own language. Labels that name no language (`forced`, a site's own
 * code) stay as they are and are never chosen for anyone.
 */
import { BASE, bestTag } from './i18n.js'

export const MARKS = Object.freeze(['auto', 'original'])

const known = new Intl.DisplayNames([BASE], { type: 'language', fallback: 'none' })

/** The language a tag names (`jpn` → `ja`, `en-orig` → `en`), or null when it names none. */
export function captionLanguage(tag) {
  try {
    const { language } = new Intl.Locale(tag)
    return language === 'und' || known.of(language) === undefined ? null : language
  } catch {
    return null
  }
}

/** A track's label from its tag and marks. */
export const captionLabel = ({ tag, auto = false, original = false }) => [tag, ...(auto ? ['auto'] : []), ...(original ? ['original'] : [])].join('.')

/** What a label says: its tag, the language it names (or null), and its marks. */
export function parseCaption(label) {
  const parts = String(label ?? '').split('.')
  const marks = new Set()
  while (parts.length > 1 && MARKS.includes(parts.at(-1))) marks.add(parts.pop())
  const tag = parts.join('.')
  return { tag, language: captionLanguage(tag), auto: marks.has('auto'), original: marks.has('original') }
}

/**
 * The track a viewer starts with, as an index into `labels`, or -1 for none: one in the viewer's
 * language (a person's own over a machine's), else one in the video's own language that no machine
 * translated, else none. A machine translation into a third language is never started.
 */
export function defaultCaption(labels, viewer) {
  const tracks = labels.map(parseCaption)
  const wanted = captionLanguage(viewer)
  const pickFrom = (list) => {
    if (list.length === 0) return -1
    const tag = bestTag(list.map(track => track.tag), viewer) ?? list[0].tag
    return tracks.indexOf(list.find(track => track.tag === tag))
  }
  if (wanted !== null) {
    const mine = tracks.filter(track => track.language === wanted)
    const at = pickFrom(mine.filter(track => !track.auto))
    if (at >= 0) return at
    const machine = pickFrom(mine)
    if (machine >= 0) return machine
  }
  const own = tracks.filter(track => track.original && track.language !== null)
  return tracks.indexOf(own.find(track => !track.auto) ?? own[0])
}

/** A track's name for the picker: its language in that language (日本語, English), else its label as it is. */
export function captionName(label) {
  const track = parseCaption(label)
  if (track.language === null) return track.tag
  try {
    return new Intl.DisplayNames([track.tag], { type: 'language', fallback: 'none' }).of(track.tag)
      ?? new Intl.DisplayNames([track.language], { type: 'language', fallback: 'none' }).of(track.language) ?? track.tag
  } catch {
    return track.tag
  }
}
