/**
 * Text for people in their language, without naming any language in code: words live in
 * `locale/<tag>.json`, one file per language, and a text that config gives per language is a
 * `{ <tag>: text }` map. Pure; runs in Node and in the browser (served as `i18n.js`).
 */

/** The language every lookup ends at, and the table every other locale file is checked against. */
export const BASE = 'en'

/** A BCP 47-style tag as DSH accepts it (`en`, `zh`, `pt-BR`, `zh-Hant-TW`). */
export const TAG = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i

/** The tags to try for `tag`, most specific first: the tag, each shorter prefix, then the base. */
export function chain(tag) {
  const parts = String(tag ?? '').toLowerCase().split('-').filter(Boolean)
  const tags = parts.map((_, i) => parts.slice(0, parts.length - i).join('-'))
  return tags.includes(BASE) ? tags : [...tags, BASE]
}

/**
 * The text for `tag` from a string or a `{ <tag>: text }` map: the exact tag, then its primary
 * subtag, then the base language, else the map's first text. Tags compare case-insensitively.
 */
export function pick(value, tag) {
  if (typeof value === 'string') return value
  if (value === null || typeof value !== 'object') return ''
  const byTag = new Map(Object.entries(value).map(([key, text]) => [key.toLowerCase(), text]))
  for (const candidate of chain(tag)) {
    const text = byTag.get(candidate)
    if (typeof text === 'string' && text !== '') return text
  }
  return Object.values(value).find(text => typeof text === 'string' && text !== '') ?? ''
}

/**
 * The languages a language filter offers, one per primary subtag: the viewer's own, the one picked,
 * then every language the results are in. Taken from the data, so no language is listed in code.
 */
export function languageChoices(viewer, results, picked = '') {
  const codes = [viewer, picked, ...results.map(result => result.language)]
    .filter(code => typeof code === 'string' && code !== '')
    .map(code => chain(code).at(-2) ?? BASE)
  return [...new Set(codes)]
}

/** A tag's likely full form (language, script, region), or null for what is not a tag. */
export function localeOf(tag) {
  try {
    return new Intl.Locale(tag).maximize()
  } catch {
    return null
  }
}

/** The listed tag that best stands for `wanted`: the same tag, else the same language and script, else the same language. */
export function bestTag(tags, wanted) {
  if (!wanted) return null
  const target = localeOf(wanted)
  let best = null
  let score = 0
  for (const tag of tags) {
    const locale = localeOf(tag)
    const value = tag.toLowerCase() === wanted.toLowerCase() ? 3
      : locale && target && locale.language === target.language && locale.script === target.script ? 2
        : locale && target && locale.language === target.language ? 1 : 0
    if (value > score) [best, score] = [tag, value]
  }
  return best
}
