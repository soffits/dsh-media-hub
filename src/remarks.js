/**
 * What people said about a work on its site, read-only: the danmaku of each
 * episode and the comments on the work, from its source's `danmaku` and
 * `comments` verbs (docs/source-protocol.md).
 *
 * They are facts from a slow outside source, so each is a stamped copy kept
 * with the show (`<show>/.source/`, which goes wherever the show goes and
 * with it when it is deleted): a page gets the copy at once, and a copy older
 * than its age limit is asked for again in the background. Only a missing
 * copy waits for the source. One request per copy at a time, shared by
 * whoever asks meanwhile. Later pages of comments are read through from the
 * source and not kept: the copy is what the room opens on.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { writeJson } from './json-file.js'

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS
export const REMARKS_DIR = '.source'

/**
 * @param {object} options
 * @param {(id: string) => object | undefined} options.source - a source by id
 * @param {{ warn: Function }} options.logger
 * @param {() => number} [options.now]
 * @param {number} [options.danmakuMaxAgeMs] - danmaku settle soon after an episode is out, so a day
 * @param {number} [options.commentsMaxAgeMs] - comments keep coming, so an hour
 */
export function createRemarks({ source, logger, now = Date.now, danmakuMaxAgeMs = DAY_MS, commentsMaxAgeMs = HOUR_MS }) {
  const flying = new Map()

  async function read(file) {
    try {
      const copy = JSON.parse(await readFile(file, 'utf8'))
      return Number.isFinite(copy?.at) ? copy : null
    } catch {
      return null
    }
  }

  async function keep(file, value) {
    await writeJson(file, value)
  }

  /** Ask the source and keep the answer, once per file at a time. */
  function fetchInto(file, ask) {
    if (!flying.has(file)) {
      const run = (async () => {
        const copy = { ...await ask(), at: now() }
        await keep(file, copy)
        return copy
      })().finally(() => flying.delete(file))
      flying.set(file, run)
    }
    return flying.get(file)
  }

  /** The copy at `file`: at once when there is one (asked for again in the background when old), else from the source. */
  async function copyOf(file, maxAgeMs, ask) {
    const copy = await read(file)
    if (copy === null) return fetchInto(file, ask)
    if (now() - copy.at > maxAgeMs) fetchInto(file, ask).catch(error => logger.warn('media hub: could not refresh %s: %s', file, error.message))
    return copy
  }

  /** The source of a show's work, when it offers `verb` for the work's kind. */
  function offering(work, verb) {
    const found = work?.source ? source(work.source) : undefined
    return found !== undefined && typeof found.offers === 'function' && found.offers(work.kind, verb) ? found : null
  }

  return {
    /** Which of the verbs a show's source offers for its work: `{ danmaku, comments }`. */
    offered: work => ({ danmaku: offering(work, 'danmaku') !== null, comments: offering(work, 'comments') !== null }),

    /**
     * The danmaku of episode `number` of a show: `{ items: [{ time, text, likes }], at }`.
     * @param {string} show - the show's folder
     * @param {{ source: string, id: string, kind: string }} work - where the show came from (its notes' `source`)
     */
    async danmaku(show, work, number) {
      const found = offering(work, 'danmaku')
      if (found === null) return { items: [], at: null }
      return copyOf(join(show, REMARKS_DIR, 'danmaku', `${number}.json`), danmakuMaxAgeMs, async () => ({ items: await found.danmaku(work.id, number, work.kind) }))
    },

    /** The comments on a show's work: the kept first page, or with `cursor` the page after it from the source. */
    async comments(show, work, cursor = '') {
      const found = offering(work, 'comments')
      if (found === null) return { total: 0, items: [], next: null, at: null }
      if (cursor !== '') return { ...await found.comments(work.id, work.kind, { cursor }), at: now() }
      return copyOf(join(show, REMARKS_DIR, 'comments.json'), commentsMaxAgeMs, () => found.comments(work.id, work.kind))
    },
  }
}
