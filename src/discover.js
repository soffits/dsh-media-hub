import { codedError } from './errors.js'
import { recommend } from './presence.js'
import { ALL_SOURCES } from './sources/index.js'

/**
 * What the Discover tab shows before a search (what each source itself puts forward, its `trending` verb, per
 * source and category, and under All sources each source's lists) and the Watching tab's picks (the recommender's). Everything is read from dated local copies
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
      if (one === undefined) throw codedError('not_found', `no source ${String(sourceId)}`)
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
     * A person's picks (the Watching tab). The recommender is given what every source's trending copy holds, so one
     * run a day serves all categories and asks the sources nothing more.
     * @returns {Promise<{ picks: object[], loading: boolean }>}
     */
    async picks(person, { language = '' } = {}) {
      if (recommender.command.length === 0) return { picks: [], loading: false }
      const copy = await copies.get(`picks|${person.key}|${language}`, async () => {
        const candidates = []
        for (const one of sources.values()) {
          if (typeof one.trending !== 'function' || !await one.available()) continue
          for (const entry of one.kinds.filter(kind => kind.trending === true)) {
            const trending = await copies.ensure(`trending|${one.id}|${entry.id}`, () => one.trending(entry.id))
            if (trending.value !== null) candidates.push({ source: one.id, kind: entry.id, lists: trending.value })
          }
        }
        return recommend(recommender, { person, language, candidates })
      })
      return { picks: (copy.value ?? []).map(pick => ({ ...pick, work: withCovers(sources.get(pick.work.source), pick.work) })), loading: copy.loading }
    },
  }
}
