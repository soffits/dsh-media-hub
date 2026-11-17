/** What the Watching tab offers to continue, and the Continue card's episode strip. Pure. */

/** Shows someone has started and not finished, most recently watched first. */
export function startedShows(shows) {
  const started = shows.filter(show => !show.watchedAt && (show.episodes > 0 || show.sourced) && (show.resume || show.finished > 0))
  // Array.prototype.sort is stable: shows without a time keep the library's order (newest added first).
  return started.sort((a, b) => (b.lastWatchedAt ?? 0) - (a.lastWatchedAt ?? 0))
}

/** Shows someone has started and not finished, no room is playing, most recently watched first. */
export const continueWatching = shows => startedShows(shows).filter(show => !show.inUse)

/**
 * What the Continue card is about: a shared room someone is in now (with the library show it plays, if any),
 * else the show watched last (with its shared room, if one is open), else null.
 * @param {object[] | undefined} rooms - shared rooms
 * @param {object[]} shows - library shows
 * @returns {{ room: object | null, show: object | null } | null}
 */
export function continueSubject(rooms, shows) {
  const busy = (rooms ?? []).find(room => room.members.length > 0)
  if (busy) return { room: busy, show: shows.find(show => show.path === busy.show) ?? null }
  const [show] = startedShows(shows)
  if (show === undefined) return null
  return { room: (rooms ?? []).find(room => room.show === show.path) ?? null, show }
}

/** The episode (1-based) the card offers: where the room is, else where the show's viewers stopped, else the one after the last finished. */
export function currentEpisode({ room, show }) {
  if (room) return room.index + 1
  if (show?.resume) return show.resume.index + 1
  const total = show?.total ?? show?.episodes ?? 1
  return Math.min(Math.max(1, total), (show?.finished ?? 0) + 1)
}

/** How many segments the strip shows at most, and how many of them come before the current one. */
export const STRIP_MAX = 18
const STRIP_BEFORE = 6

/**
 * The strip's segments around the current episode: watched (`done`), `current`, on disk (`ready`), or not yet (`todo`).
 * @param {{ n: number, cached: boolean, watch: { finished: boolean } | null }[]} episodes - the show's episodes in order
 * @param {number} current - 1-based
 */
export function episodeStrip(episodes, current, max = STRIP_MAX) {
  const start = Math.max(0, Math.min(current - 1 - STRIP_BEFORE, episodes.length - max))
  return episodes.slice(start, start + max).map(episode => ({
    n: episode.n,
    state: episode.n === current ? 'current' : episode.watch?.finished ? 'done' : episode.cached ? 'ready' : 'todo',
  }))
}

/** What the strip's note says: episodes watched, and how many after the current one are on disk. */
export function stripCounts(episodes, current) {
  return {
    watched: episodes.filter(episode => episode.watch?.finished).length,
    ahead: episodes.filter(episode => episode.n > current && episode.cached).length,
  }
}
