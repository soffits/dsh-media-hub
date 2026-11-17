import { snapshotOf } from './work.js'

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

/**
 * Keeps the copy of a source's work saved with each show fresh, lazily and
 * out of sight. Pages render from the saved copy at once and never wait on a
 * source; showing a show whose copy is missing or about a day old asks its
 * source in the background (`touch`), a few requests at a time, one request
 * shared by whoever asks meanwhile, and a source that failed is left alone for
 * an hour. The answer is saved with the time it was taken and shows on the
 * page's next look.
 *
 * @param {object} options
 * @param {(id: string) => { info: Function } | undefined} options.source - a source by id
 * @param {(path: string, work: object) => void} options.keep - save the copy
 * @param {number} [options.maxAgeMs] - how old a copy may be before it is asked for again
 * @param {number} [options.retryMs] - how long a failing work is left alone
 * @param {number} [options.parallel] - requests to sources at once
 * @param {() => number} [options.now]
 * @param {{ warn: Function }} options.logger
 */
export function createWorkRefresh({ source, keep, maxAgeMs = DAY_MS, retryMs = HOUR_MS, parallel = 2, now = Date.now, logger }) {
  const flying = new Set()
  const failedAt = new Map()
  const waiting = []
  let running = 0

  function pump() {
    while (running < parallel && waiting.length > 0) {
      running += 1
      waiting.shift()().finally(() => { running -= 1; pump() })
    }
  }

  /** Ask for a show's work again if its copy is missing or old. Returns at once. */
  return function touch(path, entry) {
    const sourceId = entry.source?.source
    const found = sourceId ? source(sourceId) : undefined
    if (found === undefined || (entry.work && now() - entry.work.at < maxAgeMs)) return
    const key = `${sourceId}\n${entry.source.id}`
    if (flying.has(key) || now() - (failedAt.get(key) ?? -Infinity) < retryMs) return
    flying.add(key)
    waiting.push(async () => {
      try {
        keep(path, snapshotOf(await found.info(entry.source.id, { person: entry.source.person }), now()))
        failedAt.delete(key)
      } catch (error) {
        failedAt.set(key, now())
        logger.warn('no details for %s from %s: %s', path, sourceId, error.message)
      } finally {
        flying.delete(key)
      }
    })
    pump()
  }
}
