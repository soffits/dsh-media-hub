/**
 * Following a work: the host asks its source about it gently (once a day,
 * jittered, one request at a time with a pause, plus once when someone opens
 * the show) and notices a new season among its related works, and more
 * episodes of the season in progress. A new season is added to the library
 * as an empty show (nothing is downloaded until someone watches) and
 * followed in turn. The schedule and the diff are pure.
 */

export const DAY_MS = 86_400_000
/** A show someone opens is checked again only if the last check is older than this. */
export const OPEN_RECHECK_MS = 3_600_000
const JITTER = 0.1

/** When a followed show is next due: a day after the last check, give or take a tenth (`random` is in [0, 1)). */
export const nextCheckAt = (checkedAt, random) => checkedAt + Math.round(DAY_MS * (1 - JITTER + 2 * JITTER * random))

/** The followed shows due now, the longest overdue first. */
export function dueFollows(follows, now) {
  return follows.filter(({ follow }) => (follow.nextAt ?? 0) <= now).sort((a, b) => (a.follow.nextAt ?? 0) - (b.follow.nextAt ?? 0))
}

/** The works to remember when following begins: the show's own id and everything related to it now. */
export const seenAtStart = (id, work) => [...new Set([id, ...(work?.related ?? []).map(other => other.id)])]

/** Seasons in an `info` document that were not there before. */
export const newSeasons = (info, seen) => (info.related ?? []).filter(other => other.relation === 'season' && other.id !== info.id && !seen.includes(other.id))

/**
 * @param {object} deps
 * @param {{ follows: () => object[], setFollow: Function, mark: Function, setEpisodes: Function }} deps.library
 * @param {(sourceId: string) => { info: (id: string) => Promise<object> } | undefined} deps.source
 * @param {(show: { path: string, sourceId: string, info: object }) => void} deps.refreshed - keeps the show's saved details current
 * @param {(sourceId: string, info: object, from: { path: string, group: string }) => Promise<string>} deps.addSeason - adds a season to the library as an empty show, returns its path
 * @param {(type: string, fields: object) => void} deps.record - the watch log
 * @param {(event: object) => void} deps.notify
 */
export function createFollows({ library, source, refreshed, addSeason, record, notify, logger, now = Date.now, random = Math.random, pauseMs = 30_000, tickMs = 600_000 }) {
  let timer = null
  let busy = false
  const sleep = ms => new Promise(done => setTimeout(done, ms))

  /** Ask the source once about a followed show, and act on what changed. */
  async function check(path) {
    const entry = library.follows().find(item => item.path === path)
    const found = entry && source(entry.source.source)
    if (!found) return
    const checkedAt = now()
    try {
      const info = await found.info(entry.source.id)
      refreshed({ path, sourceId: entry.source.source, info })
      const seen = [...entry.follow.seen]
      const added = []
      for (const season of newSeasons(info, entry.follow.seen)) {
        seen.push(season.id)
        const seasonPath = await addSeason(entry.source.source, season, { path, group: entry.group ?? `${entry.source.source}:${entry.source.id}` })
        added.push([season, seasonPath])
        record('library.newSeason', { show: seasonPath, title: season.title, from: entry.source.title ?? '' })
        notify({ type: 'season', title: season.title, from: entry.source.title ?? '', show: seasonPath })
      }
      if (info.episodes > entry.source.episodes) {
        const more = info.episodes - entry.source.episodes
        library.setEpisodes(path, info.episodes)
        library.mark(path, { newEpisodes: { n: more, at: checkedAt } })
        record('library.newEpisodes', { show: path, title: entry.source.title ?? '', episodes: more })
        notify({ type: 'episodes', title: entry.source.title ?? '', episodes: more, show: path })
      }
      library.setFollow(path, { ...entry.follow, seen, checkedAt, nextAt: nextCheckAt(checkedAt, random()) })
      return added
    } catch (error) {
      logger.warn('could not check %s: %s', path, error.message)
      // Try again tomorrow, not in a loop.
      library.setFollow(path, { ...entry.follow, checkedAt, nextAt: nextCheckAt(checkedAt, random()) })
    }
  }

  /** The due shows, one at a time with a pause between. */
  async function sweep() {
    if (busy) return
    busy = true
    try {
      for (const { path } of dueFollows(library.follows(), now())) {
        await check(path)
        await sleep(pauseMs)
      }
    } finally {
      busy = false
    }
  }

  return {
    check,
    sweep,
    /** Someone opened a followed show: look once more unless it was looked at lately. */
    opened(path) {
      const entry = library.follows().find(item => item.path === path)
      if (entry && now() - (entry.follow.checkedAt ?? 0) > OPEN_RECHECK_MS) check(path).catch(() => {})
    },
    start() {
      timer = setInterval(() => { sweep().catch(() => {}) }, tickMs)
      timer.unref?.()
    },
    stop() { clearInterval(timer) },
  }
}
