/**
 * Turns what happens in rooms (src/hub.js `observe`) into watch-log lines
 * and into the library's notes on each show (where the viewers stopped,
 * which episodes they finished).
 */
import { positionAt } from './room.js'
import { isNearEnd } from './watchlog.js'

/**
 * @param {{ log: ReturnType<import('./watchlog.js').createWatchLog>, library: object, now?: () => number }} options
 * @returns {(type: string, detail: object) => void}
 */
export function createJournal({ log, library, now = Date.now }) {
  /** Rooms whose current episode was already logged as started. */
  const started = new Map()

  const base = room => ({ room: room.id, title: room.title, show: room.showPath ?? null })
  const episodeOf = (room, index) => ({ index, title: room.items[index]?.title ?? '' })
  const durationOf = (room, index) => room.items[index]?.duration ?? null
  const fileOf = (room, index) => room.items[index]?.sourcePath ?? null

  function position(room, index, at, viewers) {
    if (viewers.length === 0) return
    const duration = durationOf(room, index)
    log.append('position', { ...base(room), episode: episodeOf(room, index), position: Math.round(at * 10) / 10, duration, viewers })
    const file = fileOf(room, index)
    if (file !== null) library.noteProgress(file, at, duration, viewers).catch(() => {})
    if (isNearEnd(at, duration)) finished(room, index, viewers)
  }

  /** Log an episode's end once per time it was started. */
  function finished(room, index, viewers) {
    const key = `${room.id}/${index}`
    if (started.get(`${key}/done`)) return
    started.set(`${key}/done`, true)
    log.append('episode.finished', { ...base(room), episode: episodeOf(room, index), duration: durationOf(room, index), viewers })
    const file = fileOf(room, index)
    if (file !== null) library.noteFinished(file).catch(() => {})
  }

  return (type, detail) => {
    const { room } = detail
    if (type === 'opened') {
      log.append('room.opened', { ...base(room), source: room.source, by: room.createdBy || null })
    } else if (type === 'closed') {
      position(room, room.index, detail.position, detail.viewers)
      log.append('room.closed', base(room))
      for (const key of [...started.keys()]) if (key.startsWith(`${room.id}/`)) started.delete(key)
    } else if (type === 'joined') {
      log.append('viewer.joined', { ...base(room), viewer: detail.viewer })
    } else if (type === 'left') {
      position(room, room.index, detail.position, [detail.viewer])
      log.append('viewer.left', { ...base(room), viewer: detail.viewer })
    } else if (type === 'progress') {
      position(room, room.index, detail.position, detail.viewers)
    } else if (type === 'op') {
      const { before, after, op, viewers } = detail
      if (after.index !== before.index) {
        const at = positionAt(before, detail.now ?? now())
        position(before, before.index, op === 'ended' ? Math.max(at, durationOf(before, before.index) ?? at) : at, viewers)
        if (op === 'ended') finished(before, before.index, viewers)
        started.delete(`${after.id}/${after.index}`)
        started.delete(`${after.id}/${after.index}/done`)
      } else if (op === 'ended') {
        finished(after, after.index, viewers)
      }
      const key = `${after.id}/${after.index}`
      if (after.playing && !started.get(key)) {
        started.set(key, true)
        log.append('episode.started', { ...base(after), episode: episodeOf(after, after.index), viewers })
      }
    }
  }
}
