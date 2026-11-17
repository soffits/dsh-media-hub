/**
 * The media hub: rooms (src/hub.js), the library (src/shows.js), downloads
 * from sources (src/downloads.js, src/sources/) and the watch log
 * (src/watchlog.js, src/journal.js), wired together. The HTTP routes and
 * the agent tool talk only to this.
 */
import { spawn } from 'node:child_process'
import { statfs, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createCache } from './cache.js'
import { createBooks } from './books.js'
import { createCovers } from './covers.js'
import { applyFilters, interleave } from './filters.js'
import { createDownloads } from './downloads.js'
import { createRoomService } from './hub.js'
import { createJournal } from './journal.js'
import { cleanName, createLibrary } from './shows.js'
import { ALL_SOURCES, EPISODE_BYTES, describeSources } from './sources/index.js'
import { LOG_NAME, createWatchLog } from './watchlog.js'
import { createFollows, dueFollows, nextCheckAt, seenAtStart } from './follow.js'
import { snapshotOf } from './work.js'

const HOUR_MS = 3_600_000
/** Between two backfill requests to a source (one work at a time). */
const BACKFILL_PAUSE_MS = 30_000
/** Downloads stop being started when the disk has less than this left. */
const MIN_FREE_BYTES = 1e9

/** No converter configured: only the formats sources have are offered. */
const NO_CONVERTER = Object.freeze({ command: '', available: async () => false })

const hubError = (code, message) => Object.assign(new Error(message), { code })

/**
 * @param {object} options - as createRoomService, plus:
 * @param {object[]} options.sources - see src/sources/index.js
 * @param {number} options.autoDeleteDays
 * @param {string[]} [options.notifyCommand] - run with a JSON line on stdin when a followed work gets a new season or episodes
 * @param {{ pauseMs?: number, random?: () => number }} [options.follow] - pacing of the checks of followed works (tests)
 * @param {number} [options.backfillPauseMs] - pause between asking a source for the details of shows saved without them
 * @param {number} options.coverCacheBytes - the most disk cover pictures may use
 * @param {{ ahead: number, behind: number, capBytes: number }} options.cache - the rolling cache's window (episodes ahead of and behind where people are) and its cap in bytes (0 for none)
 */
export function createMediaHub(options) {
  const { stateDir, libraryRoots, logger, now = Date.now } = options
  const backfillPause = options.backfillPauseMs ?? BACKFILL_PAUSE_MS
  const sources = new Map(options.sources.map(source => [source.id, source]))
  const covers = createCovers({ dir: join(stateDir, 'covers'), capBytes: options.coverCacheBytes, logger }, id => sources.get(id))
  const log = createWatchLog({ file: join(stateDir, LOG_NAME), now, logger })
  const books = createBooks({ dir: join(stateDir, 'books'), sources, capBytes: options.books?.capBytes ?? 0, converter: options.books?.converter ?? NO_CONVERTER, covers, logger, now })
  let rooms
  let cache
  const downloads = createDownloads({
    stateDir,
    sources,
    have: dir => library.cachedNumbers(dir),
    hasSpace: async () => {
      const disk = await statfs(libraryRoots[0]).catch(() => null)
      return disk === null || disk.bavail * disk.bsize >= MIN_FREE_BYTES
    },
    onFiles,
    logger,
    now,
  })
  const library = createLibrary({
    roots: libraryRoots,
    stateDir,
    autoDeleteDays: options.autoDeleteDays,
    tools: options.tools,
    inUse: path => rooms.usesPath(path),
    download: path => downloads.state(path),
    forget: path => downloads.cancel(path),
    record: (type, fields) => log.append(type, fields),
    logger,
    now,
  })
  rooms = createRoomService({
    ...options,
    watchOf: (item, show) => library.watchOfItem(show, item),
    directory: path => library.directory(path),
    focus: (show, change) => { cache.refresh(show, change).catch(() => {}) },
    observe: createJournal({ log, library, now }),
  })
  cache = createCache({ library, downloads, rooms, window: options.cache, logger })
  library.onChange((show) => {
    rooms.refreshShow(show)
    cache.refresh(show).catch(() => {})
  })
  const sweepTimer = setInterval(() => {
    library.sweep().catch(() => {})
    cache.enforce().catch(() => {})
  }, HOUR_MS)

  /** Episodes landed in a downloading show, or its download ended: rooms on it follow the files. */
  async function onFiles(job) {
    await rooms.syncShow(job.dir)
    if (job.status === 'failed') rooms.failWaiting(job.dir, job.error ?? 'the download failed')
    await cache.enforce()
  }

  /** Shows saved before their work's details were kept get them once, one request at a time with a pause; a failure is not retried until someone refreshes. */
  let backfilling = false
  async function backfill() {
    if (backfilling) return
    backfilling = true
    try {
      for (const path of library.withoutWork()) {
        const entry = library.workSource(path)
        if (!sources.has(entry?.source)) continue
        try {
          library.setWork(path, snapshotOf(await source(entry.source).info(entry.id), now()))
        } catch (error) {
          library.noteWorkFailed(path)
          logger.warn('no details for %s from %s: %s', path, entry.source, error.message)
        }
        await new Promise(done => backfillTimer = setTimeout(done, backfillPause))
      }
    } finally {
      backfilling = false
    }
  }
  let backfillTimer

  /** Tell whoever is listening (the configured command) about news of a followed work; failures are only logged. */
  function notify(event) {
    const [command, ...args] = options.notifyCommand ?? []
    if (command === undefined) return
    try {
      const child = spawn(command, args, { stdio: ['pipe', 'ignore', 'ignore'] })
      child.on('error', error => logger.warn('notify command failed: %s', error.message))
      child.stdin.on('error', () => {})
      child.stdin.end(`${JSON.stringify({ ...event, at: now() })}\n`)
    } catch (error) {
      logger.warn('notify command failed: %s', error.message)
    }
  }

  const followStart = (info, at = now()) => ({ since: at, seen: seenAtStart(info.id, info), checkedAt: at, nextAt: nextCheckAt(at, (options.follow?.random ?? Math.random)()) })

  /** An empty show for a work: its details and episode list, nothing on disk. */
  async function adoptEmpty(sourceId, item) {
    if (!(item.episodes > 0)) throw hubError('empty', `${item.title || item.id} has no episodes yet`)
    const dir = await folderFor(sourceId, item)
    await library.adopt(dir, { source: sourceId, id: item.id, kind: item.kind, episodes: item.episodes, title: item.title })
    library.setWork(dir, snapshotOf(item, now()))
    return dir
  }

  const follows = createFollows({
    library,
    source: id => sources.get(id),
    refreshed: ({ path, info }) => library.setWork(path, snapshotOf(info, now())),
    async addSeason(sourceId, season, { path, group }) {
      const info = await source(sourceId).info(season.id)
      const dir = await adoptEmpty(sourceId, info)
      library.mark(path, { group })
      library.mark(dir, { group, newSeason: { at: now(), from: library.workSource(path)?.title ?? '' } })
      library.setFollow(dir, followStart(info))
      return dir
    },
    record: (type, fields) => log.append(type, fields),
    notify,
    logger,
    now,
    ...options.follow,
  })

  /** A show's work with its pictures as routes of this plugin. */
  const withCovers = show => (show.work && show.source?.source ? { ...show, work: covers.decorate(show.source.source, show.work) } : show)

  function source(id) {
    const found = sources.get(id)
    if (found === undefined) throw hubError('not_found', `no source ${String(id)}`)
    return found
  }

  /** A library folder for a work from a source: its title, or title plus id when another show has that name. */
  async function folderFor(sourceId, item) {
    const name = cleanName(item.title)
    for (const candidate of [name, `${name} (${item.id})`]) {
      const path = join(libraryRoots[0], candidate)
      const exists = await stat(path).then(() => true, () => false)
      const shows = (await library.list()).shows
      const owner = shows.find(show => show.path === path)
      if (!exists || (owner?.source?.source === sourceId && owner.source.id === item.id)) return path
    }
    throw hubError('exists', `${name} is already in the library`)
  }

  return {
    async load() {
      await library.load()
      await books.load()
      await rooms.load()
      await downloads.load()
      await library.sweep()
      await cache.refreshActive()
      backfillTimer = setTimeout(() => backfill().catch(() => {}), backfillPause)
      follows.start()
    },

    // ---------------------------------------------------------- rooms

    /**
     * Open a room. A library show continues where its viewers stopped unless
     * `start` says otherwise.
     */
    async createRoom(input) {
      let start = input.start ?? null
      if (input.source === 'local' && start === null && typeof input.path === 'string') {
        const show = library.showPath(input.path)
        if (show !== null) start = await library.resumeFrom(show)
      }
      if (input.source === 'local' && typeof input.path === 'string') follows.opened(library.showPath(input.path))
      return rooms.createRoom({ ...input, start })
    },
    waitReady: (...args) => rooms.waitReady(...args),
    room: id => rooms.room(id),
    /** Open rooms with a preview of what plays: the show's cover and a frame of the episode now on. */
    async listRooms() {
      return Promise.all(rooms.listRooms().map(async ({ file, ...room }) => {
        const show = room.show === null ? null : withCovers({ source: library.workSource(room.show), work: library.workOf(room.show) })
        return { ...room, cover: show?.work?.cover ?? null, frame: file === null ? null : await library.frame(room.show ?? file, file, room.duration) }
      }))
    },
    closeRoom: id => rooms.closeRoom(id),
    attach: (ws, id) => rooms.attach(ws, id),
    mediaFile: (...args) => rooms.mediaFile(...args),
    subtitleFile: (...args) => rooms.subtitleFile(...args),
    linkFor: id => rooms.linkFor(id),
    sweep: () => rooms.sweep(),
    pruneCache: days => rooms.pruneCache(days),

    // ---------------------------------------------------------- library

    async library() {
      const list = await library.list()
      return { ...list, shows: list.shows.map(withCovers) }
    },
    /** The details of the work a room's show came from, or null. */
    roomWork(id) {
      const room = rooms.listRooms().find(entry => entry.id === id)
      if (room === undefined) throw hubError('not_found', 'no such room')
      return { work: room.show === null ? null : withCovers({ source: library.workSource(room.show), work: library.workOf(room.show) }).work ?? null, source: library.workSource(room.show)?.source ?? null, id: library.workSource(room.show)?.id ?? null }
    },
    /** Ask the show's source for its work's details again (by hand: the library never repeats it by itself). */
    async refreshWork(path) {
      const show = library.showPath(path)
      const entry = show === null ? null : library.workSource(show)
      if (entry === null || !sources.has(entry.source)) throw hubError('not_found', 'this show did not come from a source')
      library.setWork(show, snapshotOf(await source(entry.source).info(entry.id), now()))
      return withCovers({ source: entry, work: library.workOf(show) }).work
    },
    episodes: path => library.episodes(path),
    removeShow: (path, by) => library.remove(path, { by }),
    removeEpisode: (path, name, by) => library.removeEpisode(path, name, { by }),
    renameShow: (path, name, by) => library.rename(path, name, { by }),
    keepShow: (path, by) => library.keep(path, { by }),
    countdownShow: (path, by) => library.countdown(path, { by }),
    thumbFile: name => library.thumbFile(name),
    sweepLibrary: () => library.sweep(),

    // ---------------------------------------------------------- shelves

    /** Each person's books (src/books.js); the shelf routes key them by person. */
    books,

    // ---------------------------------------------------------- sources

    sources: () => describeSources([...sources.values()]),
    /**
     * Search one source, or with `ALL_SOURCES` every available source that has `kind`, at once. Each result
     * carries the source it came from; under all sources a failing source is reported in `failed` and the others still answer.
     */
    async search(sourceId, query, kind, offset = 0, filters = {}) {
      const ask = async (one) => {
        const { results, next } = await one.search(query, { kind, offset, filters })
        return { results: applyFilters(results, filters).map(work => ({ ...covers.decorate(one.id, work), source: one.id })), next }
      }
      if (sourceId !== ALL_SOURCES) return ask(source(sourceId))
      const candidates = []
      for (const one of sources.values()) {
        if (one.kinds.some(entry => entry.id === kind) && await one.available()) candidates.push(one)
      }
      const answers = await Promise.allSettled(candidates.map(one => ask(one)))
      const failed = answers.flatMap((answer, index) => (answer.status === 'rejected' ? [{ source: candidates[index].id, message: answer.reason?.message ?? String(answer.reason) }] : []))
      if (candidates.length > 0 && failed.length === candidates.length) throw hubError('source_failed', failed.map(entry => entry.message).join('; '))
      return { results: interleave(answers.map(answer => (answer.status === 'fulfilled' ? answer.value.results : []))), next: null, failed }
    },
    info: async (sourceId, id) => ({ ...covers.decorate(sourceId, await source(sourceId).info(id)), source: sourceId }),
    coverFile: key => covers.file(key),

    /**
     * Put a work from a source into the library. `watch` opens a room on it
     * at once (its episode shows as preparing until it is fetched); either
     * way only the rolling cache's window is downloaded, unless `all` keeps
     * the whole show offline.
     * @param {{ source: string, id: string, watch?: boolean, all?: boolean, by?: string }} input
     */
    async fetch({ source: sourceId, id, watch = false, all = false, by = '' }) {
      const item = await source(sourceId).info(id)
      if (!(item.episodes > 0)) throw hubError('empty', `${item.title || id} has no episodes`)
      const disk = await statfs(libraryRoots[0]).catch(() => null)
      if (disk !== null && disk.bavail * disk.bsize < MIN_FREE_BYTES) throw hubError('no_space', 'the library disk is almost full; delete something first')
      const dir = await folderFor(sourceId, item)
      await library.adopt(dir, { source: sourceId, id: item.id, kind: item.kind, episodes: item.episodes, title: item.title }, { pinned: all })
      library.setWork(dir, snapshotOf(item, now()))
      let room = null
      if (watch) room = (await rooms.createRoom({ source: 'local', path: dir, title: item.title, by, start: await library.resumeFrom(dir) })).room
      else await cache.refresh(dir, { retry: true })
      const count = all ? item.episodes : Math.min(item.episodes, options.cache.ahead + 1)
      return { path: dir, title: item.title, episodes: item.episodes, estimate: count * (EPISODE_BYTES[item.kind] ?? EPISODE_BYTES.drama), room, download: downloads.state(dir) }
    },

    /**
     * Follow a work, or stop following it. A work not in the library is added as an empty show; the host then looks for its
     * next season (and more episodes) now and then, and adds a new season by itself.
     */
    async followWork({ source: sourceId, id, follow = true }) {
      const found = (await library.list()).shows.find(show => show.source?.source === sourceId && show.source.id === id)
      if (!follow) {
        if (found) library.setFollow(found.path, null)
        return { path: found?.path ?? null, follow: false }
      }
      if (found) {
        if (!found.follow) library.setFollow(found.path, followStart({ ...(found.work ?? {}), id }, now()))
        return { path: found.path, follow: true }
      }
      const info = await source(sourceId).info(id)
      const dir = await adoptEmpty(sourceId, info)
      library.setFollow(dir, followStart(info))
      return { path: dir, follow: true }
    },
    /** The checks of followed works, for tests and for the agent: one show now, or whatever is due. */
    checkFollow: path => follows.check(path),
    sweepFollows: () => follows.sweep(),
    followsDue: at => dueFollows(library.follows(), at),
    /** Someone has seen what a check found for a show: its new season or new episodes. */
    dismissNews: path => library.dismiss(path),

    /** Keep a show's every episode on disk, or go back to the rolling cache. */
    async pinShow(path, pinned, by) {
      const answer = await library.pin(path, pinned, { by })
      await cache.refresh(answer.path, { retry: true })
      return answer
    },

    /** Start a show's download again after it failed. */
    async retryDownload(path) {
      const show = library.showPath(path)
      if (show === null || downloads.job(show) === undefined) throw hubError('not_found', 'no download for this show')
      downloads.retry(show)
      await cache.refresh(show, { retry: true })
      return { download: downloads.state(show) }
    },

    async cancelDownload(path) {
      const show = library.showPath(path)
      if (show !== null) await downloads.cancel(show)
      return { cancelled: resolve(path) }
    },

    /** A download someone waits on to watch: its state and, once open, its room. */
    download: path => {
      const show = library.showPath(path)
      return show === null ? null : downloads.state(show)
    },

    // ---------------------------------------------------------- watch log

    history: opts => log.history(opts),
    logFile: log.file,

    async dispose() {
      clearInterval(sweepTimer)
      clearTimeout(backfillTimer)
      follows.stop()
      await books.dispose()
      await downloads.dispose()
      await rooms.dispose()
      await library.settleThumbs()
      await library.flush()
      await log.flush()
    },
  }
}
