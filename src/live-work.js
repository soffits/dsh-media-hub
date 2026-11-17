import { snapshotOf } from './work.js'

const DAY_MS = 86_400_000
/** Whether the saved copy already says what the source just said (its `at` aside) and is under a day old, so saving again would only rewrite the notes. */
const sameAs = (saved, work, at) => saved != null && at - saved.at < DAY_MS && JSON.stringify({ ...saved, at: 0 }) === JSON.stringify({ ...work, at: 0 })

/**
 * A show's work as its source says it now. The source is asked every time the
 * work is shown; nothing is remembered between asks except what is in flight
 * (two readers of one work share one request). The copy saved with the show is
 * an offline fallback: refreshed after every answer, used (flagged `offline`,
 * its `at` saying when it was taken) only when the source can't answer in
 * time, and no other reader trusts it.
 *
 * @param {object} options
 * @param {(id: string) => object | undefined} options.source - a source by id
 * @param {(path: string, work: object) => void} options.keep - save the fallback copy
 * @param {number} [options.waitMs] - how long a reader waits for the source before showing the saved copy (the request goes on and refreshes the copy)
 * @param {number} [options.parallel] - requests to sources at once
 * @param {() => number} [options.now]
 * @param {{ warn: Function }} options.logger
 */
export function createLiveWork({ source, keep, waitMs = 8000, parallel = 4, now = Date.now, logger }) {
  const flying = new Map()
  const queue = []
  let running = 0

  function turn() {
    while (running < parallel && queue.length > 0) {
      running += 1
      queue.shift()()
    }
  }
  const limited = task => new Promise((resolve, reject) => {
    queue.push(() => task().then(resolve, reject).finally(() => { running -= 1; turn() }))
    turn()
  })

  function ask(path, entry) {
    const { source: sourceId, id } = entry.source
    const key = `${sourceId}\n${id}`
    if (!flying.has(key)) {
      const request = limited(() => source(sourceId).info(id, { person: entry.source.person }))
        .then((info) => {
          const work = snapshotOf(info, now())
          if (!sameAs(entry.work, work, now())) keep(path, work)
          return work
        })
        .finally(() => flying.delete(key))
      request.catch(() => {})
      flying.set(key, request)
    }
    return flying.get(key)
  }

  const offline = entry => (entry.work ? { ...entry.work, offline: true } : null)

  /** The work of a show's notes, live, or its saved copy flagged `offline`. */
  return async function read(path, entry) {
    const found = entry.source?.source ? source(entry.source.source) : undefined
    if (found === undefined) return entry.work ?? null
    let timer
    const late = new Promise((resolve) => { timer = setTimeout(() => resolve(null), waitMs) })
    try {
      return (await Promise.race([ask(path, entry), late])) ?? offline(entry)
    } catch (error) {
      logger.warn('no live details for %s from %s: %s', path, entry.source.source, error.message)
      return offline(entry)
    } finally {
      clearTimeout(timer)
    }
  }
}
