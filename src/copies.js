import { createJsonSaver, readJson } from './json-file.js'

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

/**
 * Dated local copies of what outside sources and the recommender answer, for
 * pages that must never wait on them (what a source trends, a person's picks).
 * `get` answers at once with the saved copy and its time (`at`, null when there
 * is none yet); when the copy is missing or about a day old it asks in the
 * background (`produce`), a few asks at a time, one shared by whoever looks
 * meanwhile. A failing ask is left alone for an hour, and the old copy stays
 * on show. The new answer is saved and `changed()` tells open pages to look
 * again. No timer: an ask starts only because someone looked.
 *
 * @param {object} options
 * @param {string} options.file - where the copies are kept (JSON)
 * @param {() => void} options.changed - a copy was refreshed
 * @param {{ warn: Function }} options.logger
 * @param {number} [options.maxAgeMs]
 * @param {number} [options.retryMs]
 * @param {number} [options.parallel] - asks at once; one that is made from other copies (`ensure`) waits for them, so keep it above the number of such asks that can run together
 * @param {() => number} [options.now]
 */
export function createCopies({ file, changed, logger, maxAgeMs = DAY_MS, retryMs = HOUR_MS, parallel = 4, now = Date.now }) {
  /** @type {Map<string, { at: number, value: unknown }>} */
  const copies = new Map()
  /** @type {Map<string, Promise<void>>} */
  const flying = new Map()
  const failedAt = new Map()
  const waiting = []
  let running = 0
  const saver = createJsonSaver(file, logger)
  const loaded = readJson(file, { logger }).then(({ value }) => { for (const [key, copy] of Object.entries(value ?? {})) copies.set(key, copy) })

  function save() {
    return saver.save(Object.fromEntries(copies))
  }

  function pump() {
    while (running < parallel && waiting.length > 0) {
      running += 1
      waiting.shift()().finally(() => { running -= 1; pump() })
    }
  }

  function ask(key, produce) {
    let settled
    flying.set(key, new Promise((resolve) => { settled = resolve }))
    waiting.push(async () => {
      try {
        copies.set(key, { at: now(), value: await produce() })
        failedAt.delete(key)
        await save()
        changed()
      } catch (error) {
        failedAt.set(key, now())
        logger.warn('no new copy of %s: %s', key, error.message)
        changed()
      } finally {
        flying.delete(key)
        settled()
      }
    })
    pump()
  }

  return {
    /**
     * Like `get`, but a missing copy is waited for (the first ask), for what another copy is made from; an old one still answers at once.
     * @param {string} key
     * @param {() => Promise<unknown>} produce
     */
    async ensure(key, produce) {
      const first = await this.get(key, produce)
      if (first.value !== null || !flying.has(key)) return first
      await flying.get(key)
      return this.get(key, produce)
    },

    /**
     * @param {string} key
     * @param {() => Promise<unknown>} produce - the outside answer, asked only when the copy is missing or old
     * @returns {Promise<{ at: number | null, value: unknown, loading: boolean }>} `loading`: no copy yet and one is on its way; `failed`: no copy and the last ask failed
     */
    async get(key, produce) {
      await loaded
      const copy = copies.get(key)
      const old = copy === undefined || now() - copy.at >= maxAgeMs
      if (old && !flying.has(key) && now() - (failedAt.get(key) ?? -Infinity) >= retryMs) ask(key, produce)
      return { at: copy?.at ?? null, value: copy?.value ?? null, loading: copy === undefined && flying.has(key), failed: copy === undefined && failedAt.has(key) }
    },
  }
}
