/**
 * Words for the descriptive fields of a search result (docs/source-protocol.md).
 * Sources send raw counts and codes; the page language decides how they read.
 * No DOM here: it also runs in Node.
 */

/** Counts a source may label that the panel has words for (`pop.<label>` in the locale files). */
export const POPULARITY_LABELS = Object.freeze(['plays', 'readers', 'listeners', 'viewers', 'followers', 'heat'])
/** `meta` keys the panel has a translated label for (`meta.<key>`). */
export const META_KEYS = Object.freeze(['heat', 'followers', 'cast', 'duration', 'updated', 'publisher', 'narrator', 'words', 'studio'])
export const STATUSES = Object.freeze(['finished', 'ongoing', 'stopped'])
export const RELATIONS = Object.freeze(['season', 'same-title', 'related'])

/** A count the way the page language writes it short, by Intl (36.7K, 3.7万, 36,7 k). */
export function formatCount(count, locale) {
  if (!Number.isFinite(count) || count < 0) return ''
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(count)
}

/** "36.7万次播放" / "36.7K plays": the count with what it counts, or null when there is no count. */
export function popularityText(t, popularity) {
  if (popularity === null || popularity === undefined) return null
  const number = formatCount(popularity.count, t.language)
  if (POPULARITY_LABELS.includes(popularity.label)) return t(`pop.${popularity.label}`).replace('{n}', number)
  return popularity.text || `${number} ${popularity.label}`
}

/** The label of a `meta` row: the panel's translation of its key, else the source's own label. */
export const metaLabel = (t, row) => (META_KEYS.includes(row.key) ? t(`meta.${row.key}`) : row.label)
