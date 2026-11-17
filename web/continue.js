/** Which library shows "continue watching" lists, and in what order. Pure. */

/** Shows someone has started and not finished, no room is playing, most recently watched first. */
export function continueWatching(shows) {
  const started = shows.filter(show => !show.watchedAt && !show.inUse && (show.episodes > 0 || show.sourced) && (show.resume || show.finished > 0))
  // Array.prototype.sort is stable: shows without a time keep the library's order (newest added first).
  return started.sort((a, b) => (b.lastWatchedAt ?? 0) - (a.lastWatchedAt ?? 0))
}
