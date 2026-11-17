import { interleave } from './filters.js'
import { PICKS_LIMIT, recommend } from './presence.js'
import { ALL_SOURCES } from './sources/index.js'

/** Picks shown under one source and category on Discover. */
export const DISCOVER_PICKS = 12

const notFound = message => Object.assign(new Error(message), { code: 'not_found' })

/**
 * What Discover shows before a search: what each source itself puts forward
 * (its `trending` verb) and the recommender's picks, per source and category,
 * and merged under All sources. Everything is read from dated local copies
 * (src/copies.js) and answers at once; a copy that is missing or about a day old
 * is asked for in the background, and open pages are told when it lands.
 *
 * @param {object} options
 * @param {ReturnType<import('./copies.js').createCopies>} options.copies
 * @param {Map<string, object>} options.sources
 * @param {{ decorate: Function }} options.covers
 * @param {{ command: string[], env: object, cwd: string, hasSource: (id: string) => boolean }} options.recommender
 */
export function createDiscover({ copies, sources, covers, recommender }) {
  /** The sources a request names: one, or under All the available ones that have the kind and the given ability. */
  async function sourcesFor(sourceId, kind, ability) {
    if (sourceId !== ALL_SOURCES) {
      const one = sources.get(sourceId)
      if (one === undefined) throw notFound(`no source ${String(sourceId)}`)
      return [one]
    }
    const found = []
    for (const one of sources.values()) {
      if (one.kinds.some(entry => entry.id === kind && ability(entry)) && await one.available()) found.push(one)
    }
    return found
  }

  const withCovers = (one, work) => ({ ...covers.decorate(one.id, work), source: one.id })

  return {
    /**
     * @returns {Promise<{ trending: { source: string, at: number, lists: object[] }[], loading: boolean }>} `loading`: some source has no copy yet
     */
    async trending(sourceId, kind) {
      const wanted = (await sourcesFor(sourceId, kind, entry => entry.trending === true))
        .filter(one => typeof one.trending === 'function' && one.kinds.some(entry => entry.id === kind && entry.trending === true))
      const copy = await Promise.all(wanted.map(one => copies.get(`trending|${one.id}|${kind}`, () => one.trending(kind))))
      return {
        trending: wanted.flatMap((one, index) => (copy[index].value === null ? [] : [{
          source: one.id,
          at: copy[index].at,
          lists: copy[index].value.map(list => ({ ...list, results: list.results.map(work => withCovers(one, work)) })),
        }])),
        loading: copy.some(entry => entry.loading),
      }
    },

    /**
     * A person's picks for a source and category (merged under All sources), or without either (the Watching tab).
     * @returns {Promise<{ picks: object[], loading: boolean }>}
     */
    async picks(person, { source: sourceId = '', kind = '', language = '' } = {}) {
      if (recommender.command.length === 0) return { picks: [], loading: false }
      const narrowed = sourceId !== ''
      const targets = narrowed ? await sourcesFor(sourceId, kind, () => true) : [null]
      const copy = await Promise.all(targets.map(one => copies.get(
        `picks|${person.key}|${one?.id ?? '*'}|${narrowed ? kind : '*'}|${language}`,
        () => recommend(recommender, { person, source: one?.id, kind: narrowed ? kind : undefined, language, limit: narrowed ? DISCOVER_PICKS : PICKS_LIMIT }),
      )))
      const lists = copy.map((entry, index) => (entry.value ?? []).filter(pick => targets[index] === null || (pick.work.source === targets[index].id && (kind === '' || pick.work.kind === kind))))
      return {
        picks: interleave(lists).map(pick => ({ ...pick, work: withCovers(sources.get(pick.work.source), pick.work) })).slice(0, narrowed ? DISCOVER_PICKS : PICKS_LIMIT),
        loading: copy.some(entry => entry.loading),
      }
    },
  }
}
