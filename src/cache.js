/**
 * The rolling cache: for every show from a source, keep the episodes people
 * are about to watch on disk and not much else.
 *
 * Every show lists all its episodes, but only a window around where people
 * are is cached: the episode they are on first, then the next `ahead`, and
 * at most `behind` just watched. Watched episodes that fall out of the
 * window are deleted (the watch log still marks them watched). A jump to an
 * episode that is not cached fetches it at once, first, and refills the
 * window around the new place. A pinned show ("Download all, offline") is
 * fetched whole and never trimmed. A cap on the whole cache gives up the
 * least recently watched episodes of unpinned shows, never one inside an
 * open room's window. The arithmetic is src/window.js; this wires it to
 * the library, the downloads and the rooms.
 */
import { pickEvictions, planCache, windowOf } from './window.js'

/**
 * @param {object} options
 * @param {ReturnType<import('./shows.js').createLibrary>} options.library
 * @param {ReturnType<import('./downloads.js').createDownloads>} options.downloads
 * @param {{ focusesOf: (path: string) => number[], syncShow: (path: string) => Promise<void> }} options.rooms
 * @param {{ ahead: number, behind: number, capBytes: number }} options.window - capBytes 0 means no cap
 * @param {{ warn: Function }} options.logger
 */
export function createCache({ library, downloads, rooms, window: size, logger }) {
  let chain = Promise.resolve()
  /** Run steps one after another: two refreshes at once would plan from the same stale picture. */
  const serial = step => {
    const result = chain.then(step)
    chain = result.catch(error => logger.warn('rolling cache: %s', error.message))
    return result
  }

  /** The episodes inside some open room's window, by show: nothing there is trimmed or given up. */
  async function protectedEpisodes() {
    const out = new Map()
    for (const path of await library.sourcedShows()) {
      const info = await library.cacheInfo(path)
      const set = new Set()
      for (const focus of rooms.focusesOf(path)) {
        const { first, last } = windowOf(focus, info.total, size)
        for (let n = first; n <= last; n++) set.add(n)
      }
      out.set(path, set)
    }
    return out
  }

  async function refreshShow(path, { retry = false } = {}) {
    const info = await library.cacheInfo(path)
    if (info === null) return
    const focuses = rooms.focusesOf(path)
    const hasRoom = focuses.length > 0
    const places = hasRoom ? focuses : (info.focus === null ? [] : [info.focus])
    // Going to an episode again is asking for it, even one deleted by hand.
    const skip = new Set([...info.skip].filter(n => !places.includes(n)))
    if (skip.size !== info.skip.size) await library.unskip(path, places)
    const plan = planCache({ total: info.total, focuses: places, cached: info.cached, finished: info.finished, skip, pinned: info.pinned, ...size })
    if (plan.trim.length > 0) {
      await library.dropEpisodes(path, plan.trim, { reason: 'watched' })
      await rooms.syncShow(path)
    }
    await downloads.want({ source: info.source.source, item: { id: info.source.id, title: info.source.title ?? '', kind: info.source.kind, episodes: info.total }, dir: path }, plan.want, { priority: hasRoom, retry })
  }

  async function enforceCap() {
    if (!(size.capBytes > 0)) return
    const protectedBy = await protectedEpisodes()
    const entries = (await library.cacheEntries()).map(entry => ({ ...entry, protected: protectedBy.get(entry.show)?.has(entry.n) === true }))
    const doomed = new Set(pickEvictions(entries, size.capBytes))
    if (doomed.size === 0) return
    const byShow = new Map()
    for (const entry of entries) if (doomed.has(entry.key)) byShow.set(entry.show, [...(byShow.get(entry.show) ?? []), entry.n])
    for (const [path, numbers] of byShow) {
      await library.dropEpisodes(path, numbers, { reason: 'cache full' })
      await rooms.syncShow(path)
    }
  }

  return {
    /** Plan one show again: after a room moved, a show was saved, something finished. `retry`: someone asked for an episode, so a failed download is tried again. */
    refresh: (path, options) => serial(async () => {
      await refreshShow(path, options)
      await enforceCap()
    }),

    /** Plan every show a room has open or that is kept offline (at start). */
    refreshActive: () => serial(async () => {
      for (const path of await library.sourcedShows()) {
        const info = await library.cacheInfo(path)
        if (info.pinned || rooms.focusesOf(path).length > 0) await refreshShow(path)
      }
      await enforceCap()
    }),

    enforce: () => serial(enforceCap),
  }
}
