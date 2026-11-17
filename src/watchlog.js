/**
 * The watch log: an append-only JSON Lines file of what was watched, by
 * whom, and how far. One object per line, `at` an ISO time:
 *
 *   { type: 'room.opened',      room, title, source, show, by }
 *   { type: 'room.closed',      room, title, show }
 *   { type: 'viewer.joined',    room, title, show, viewer }
 *   { type: 'viewer.left',      room, title, show, viewer }
 *   { type: 'episode.started',  room, title, show, episode, viewers }
 *   { type: 'episode.finished', room, title, show, episode, viewers }
 *   { type: 'position',         room, title, show, episode, position, duration, viewers }
 *   { type: 'library.kept' | 'library.countdownStarted' | 'library.countdownRestarted'
 *         | 'library.deleted' | 'library.episodeDeleted' | 'library.renamed'
 *         | 'library.pinned' | 'library.unpinned' | 'library.cacheDropped' (episodes, reason), show, title, by, ... }
 *
 * `show` is the library path of a local show (null for YouTube), `title` the
 * room's title, `episode` { index, title }. `position` lines are written when
 * a viewer leaves, when the room moves to another episode, when it closes and
 * every few minutes while it plays, so the last one per viewer and episode
 * says where they stopped.
 */
import { appendFile, readFile } from 'node:fs/promises'

export const LOG_NAME = 'watch-log.jsonl'

/** Whether a position counts as having watched an episode: the last 10 % (credits), at most five minutes, at least three seconds. */
export function isNearEnd(position, duration) {
  if (!(duration > 0) || !(position >= 0)) return false
  return duration - position <= Math.min(300, Math.max(3, duration * 0.1))
}

/**
 * @param {{ file: string, now?: () => number, logger: { warn: Function } }} options
 */
export function createWatchLog({ file, now = Date.now, logger }) {
  let tail = Promise.resolve()

  function append(type, fields) {
    const line = `${JSON.stringify({ at: new Date(now()).toISOString(), type, ...fields })}\n`
    tail = tail.then(() => appendFile(file, line)).catch(error => logger.warn('could not write the watch log: %s', error.message))
    return tail
  }

  async function read() {
    await tail
    let text = ''
    try {
      text = await readFile(file, 'utf8')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    const events = []
    for (const line of text.split('\n')) {
      if (line.trim() === '') continue
      try {
        events.push(JSON.parse(line))
      } catch {
        // A line cut off by a crash; the rest of the log still counts.
      }
    }
    return events
  }

  /**
   * What was watched, newest first: one entry per show (or per room title
   * for YouTube), with the episodes finished, where each viewer stopped,
   * who watched and when.
   * @param {{ days?: number, limit?: number }} [options]
   */
  async function history({ days = 30, limit = 20 } = {}) {
    const since = now() - days * 86_400_000
    const shows = new Map()
    for (const event of await read()) {
      const at = Date.parse(event.at)
      if (!(at >= since) || event.title === undefined || event.type.startsWith('library.')) continue
      const key = event.show ?? `title:${event.title}`
      if (!shows.has(key)) shows.set(key, { title: event.title, show: event.show ?? null, firstAt: at, lastAt: at, viewers: new Set(), finished: new Map(), stopped: new Map() })
      const entry = shows.get(key)
      entry.lastAt = at
      entry.title = event.title
      for (const viewer of event.viewers ?? (event.viewer ? [event.viewer] : [])) entry.viewers.add(viewer)
      if (event.type === 'episode.finished') entry.finished.set(event.episode.index, event.episode.title)
      if (event.type === 'position' || event.type === 'episode.started' || event.type === 'episode.finished') {
        const position = event.type === 'position' ? event.position : event.type === 'episode.finished' ? event.duration ?? null : 0
        for (const viewer of event.viewers ?? []) {
          entry.stopped.set(viewer, { episode: event.episode.index + 1, episodeTitle: event.episode.title, position, finished: event.type === 'episode.finished', at: event.at })
        }
      }
    }
    return [...shows.values()]
      .sort((a, b) => b.lastAt - a.lastAt)
      .slice(0, limit)
      .map(entry => ({
        title: entry.title,
        show: entry.show,
        with: [...entry.viewers],
        from: new Date(entry.firstAt).toISOString(),
        to: new Date(entry.lastAt).toISOString(),
        episodesFinished: [...entry.finished.keys()].sort((a, b) => a - b).map(index => index + 1),
        stoppedAt: Object.fromEntries([...entry.stopped].map(([viewer, where]) => [viewer, { ...where, position: where.position === null ? null : Math.round(where.position) }])),
      }))
  }

  return { file, append, read, history, flush: () => tail }
}
