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

/** A template with its `{name}` slots filled. */
export const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''))

/**
 * Whether something has episodes to speak of: from two on. A film, one video or a single link has none,
 * so it gets no picker, no strip and no "Episode 1 of 1". `n` (1-based, optional) past the first means there are.
 */
export const hasEpisodes = (count, n = 1) => (Number.isInteger(count) && count > 1) || n > 1

/**
 * The button that picks up where someone is: "Join Ana · episode 7" or "Join Ana", "Continue · episode 7",
 * "Continue at 12:34", or "Play" for a single one not started yet.
 * @param {{ count: number | null, n: number, position?: number | null, at?: string, names?: string }} where -
 *   `count` episodes in all (null when unknown), `n` the 1-based one it continues at, `at` the position as read
 */
export function resumeLabel(t, { count, n, position = null, at = '', names = '' }) {
  const many = hasEpisodes(count, n)
  if (names) return fill(t(many ? 'continue.join' : 'continue.joinOne'), { names, n })
  if (many) return fill(t('continue.continue'), { n })
  return position > 5 ? fill(t('continue.continueAt'), { time: at }) : t('continue.play')
}

/** Where someone stopped, for a list line: "continue from ep 7 at 12:34", or "continue at 12:34" for a single one; null when there is nothing to say. */
export function stoppedText(t, { count, n, position = null, at = '' }) {
  if (hasEpisodes(count, n)) return fill(t(position > 5 ? 'library.continueFromAt' : 'library.continueFrom'), { n, time: at })
  return position > 5 ? fill(t('library.continueAt'), { time: at }) : null
}
