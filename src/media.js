/**
 * The media hub: rooms (src/hub.js), the library (src/shows.js), downloads
 * from sources (src/downloads.js, src/sources/) and the watch log
 * (src/watchlog.js, src/journal.js), wired together. The HTTP routes and
 * the assistant's tool talk only to this.
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
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
import { AUTO, isQuality } from './quality.js'
import { createRemarks } from './remarks.js'
import { LOG_NAME, createWatchLog } from './watchlog.js'
import { createFollows, dueFollows, nextCheckAt, seenAtStart } from './follow.js'
import { parseAnnotation, pendingRatings, ratingLine } from './presence.js'
import { createExtras } from './points.js'
import { LOCALE_DIR, readLocales } from './locales.js'
import { snapshotOf } from './work.js'
import { createChanges } from './changes.js'
import { createCopies } from './copies.js'
import { createDiscover } from './discover.js'
import { createWorkRefresh } from './work-refresh.js'

const HOUR_MS = 3_600_000
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
 * @param {number} [options.changeIntervalMs] - the most often open pages are told of changes
 * @param {number} [options.workMaxAgeMs] - how old the saved copy of a source's work may get before it is asked for again in the background
 * @param {number} [options.discoverMaxAgeMs] - the same for what Discover shows: a source's trending lists and the recommender's picks
 * @param {number} options.coverCacheBytes - the most disk cover pictures may use
 * @param {{ command: string[], env?: object }} [options.recommender] - where picks come from (src/presence.js)
 * @param {() => object | undefined} [options.points] - the points plugin's service right now, if installed (src/points.js)
 * @param {{ from: string, to: string }} [options.bingeNight] - starting to watch in this window is a binge night
 * @param {{ ahead: number, behind: number, capBytes: number }} options.cache - the rolling cache's window (episodes ahead of and behind where people are) and its cap in bytes (0 for none)
 */
export function createMediaHub(options) {
  const { stateDir, libraryRoots, logger, now = Date.now } = options
  const sources = new Map(options.sources.map(source => [source.id, source]))
  const covers = createCovers({ dir: join(stateDir, 'covers'), capBytes: options.coverCacheBytes, ffmpeg: options.tools.ffmpeg, logger }, id => sources.get(id))
  const log = createWatchLog({ file: join(stateDir, LOG_NAME), now, logger })
  const changes = createChanges({ intervalMs: options.changeIntervalMs })
  const points = createExtras({ points: options.points ?? (() => undefined), night: options.bingeNight ?? { from: '01:00', to: '06:00' }, locales: () => readLocales(LOCALE_DIR, logger), now })
  const books = createBooks({ changed: () => changes.notify('shelf'), dir: join(stateDir, 'books'), sources, capBytes: options.books?.capBytes ?? 0, converter: options.books?.converter ?? NO_CONVERTER, covers, logger, now })
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
    onProgress: (job, number, progress) => { rooms.downloadProgress(job.dir, number, progress); changes.notify('library') },
    onPartial: (job, number, partial) => rooms.streamEpisode(job.dir, number, partial),
    logger,
    now,
  })
  const remarks = createRemarks({ source: id => sources.get(id), logger, now })
  const refreshWork = createWorkRefresh({ source: id => sources.get(id), keep: (path, work) => library.keepWork(path, work), maxAgeMs: options.workMaxAgeMs, logger, now })
  const library = createLibrary({
    changed: () => changes.notify('library'),
    roots: libraryRoots,
    stateDir,
    autoDeleteDays: options.autoDeleteDays,
    covers,
    inUse: path => rooms.usesPath(path),
    download: path => downloads.state(path),
    forget: path => downloads.cancel(path),
    record: (type, fields) => log.append(type, fields),
    logger,
    now,
  })
  const journal = createJournal({ log, library, now })
  rooms = createRoomService({
    ...options,
    watchOf: (item, show) => library.watchOfItem(show, item),
    directory: path => library.directory(path),
    focus: (show, change) => { cache.refresh(show, change).catch(() => {}) },
    observe: (type, detail) => {
      journal(type, detail)
      if (type !== 'progress') changes.notify('rooms')
    },
  })
  cache = createCache({ library, downloads, rooms, window: options.cache, logger })
  library.onChange((show) => {
    rooms.refreshShow(show)
    cache.refresh(show).catch(() => {})
  })
  const copies = createCopies({ file: join(stateDir, 'discover.json'), changed: () => changes.notify('discover'), maxAgeMs: options.discoverMaxAgeMs, logger, now })
  const discover = createDiscover({
    copies,
    sources,
    covers,
    recommender: { command: options.recommender?.command ?? [], env: options.recommender?.env ?? {}, cwd: stateDir, hasSource: id => sources.has(id) },
  })
  const sweepTimer = setInterval(() => {
    library.sweep().catch(error => logger.warn('library sweep: %s', error.message))
    cache.enforce().catch(() => {})
  }, HOUR_MS)

  /** The show folder a room plays from (null for plain files). */
  function roomShow(id) {
    const room = rooms.listRooms().find(entry => entry.id === id)
    if (room === undefined) throw hubError('not_found', 'no such room')
    return room.show
  }

  /** Episodes landed in a downloading show, or its download ended: rooms on it follow the files. */
  async function onFiles(job) {
    changes.notify('library')
    await rooms.syncShow(job.dir)
    if (job.status === 'failed') rooms.failWaiting(job.dir, job.error ?? 'the download failed', job.reason ?? null)
    await cache.enforce()
  }

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

  /** A show's source and its saved work; a copy missing or about a day old is asked for again in the background (src/work-refresh.js), never waited for. */
  const shownEntry = (show) => {
    const entry = { source: library.workSource(show), work: library.workOf(show) }
    refreshWork(show, entry)
    return entry
  }

  /** A show's work with its pictures as routes of this plugin. */
  const withCovers = show => (show.work && show.source?.source ? { ...show, work: covers.decorate(show.source.source, show.work) } : show)

  function source(id) {
    const found = sources.get(id)
    if (found === undefined) throw hubError('not_found', `no source ${String(id)}`)
    return found
  }

  /** A library folder for a work from a source: its title, or title plus a short mark of its id (ids may be addresses) when another show has that name. */
  /**
   * Whether a series is new here: neither it nor any of its seasons (`related`, relation `season`) was ever had, in the
   * library now (by source and id) or anywhere in the watch log (by the folder it would have). Going on with a series,
   * a later season included, is never new.
   */
  async function isNewSeries(sourceId, item) {
    if (!(item.episodes > 1)) return false
    const works = [item, ...(item.related ?? []).filter(other => other.relation === 'season' && other.id)]
    const inLibrary = new Set((await library.list()).shows.filter(show => show.source).map(show => `${show.source.source}\n${show.source.id}`))
    const logged = new Set((await log.read()).map(event => event.show).filter(Boolean))
    return !works.some(work => inLibrary.has(`${sourceId}\n${work.id}`) || foldersFor(sourceId, work).some(path => logged.has(path)))
  }

  /** The folders a work may get in the library: its clean title, or that with a mark when the title is taken. */
  function foldersFor(sourceId, work) {
    const name = cleanName(work.title ?? '')
    const mark = createHash('sha256').update(`${sourceId}\n${work.id}`).digest('hex').slice(0, 8)
    return [name, `${name} (${mark})`].map(candidate => join(libraryRoots[0], candidate))
  }

  async function folderFor(sourceId, item) {
    for (const path of foldersFor(sourceId, item)) {
      const exists = await stat(path).then(() => true, () => false)
      const shows = (await library.list()).shows
      const owner = shows.find(show => show.path === path)
      if (!exists || (owner?.source?.source === sourceId && owner.source.id === item.id)) return path
    }
    throw hubError('exists', `${cleanName(item.title)} is already in the library`)
  }

  return {
    async load() {
      await library.load()
      await books.load()
      await rooms.load()
      await downloads.load()
      await library.sweep().catch(error => logger.warn('library sweep: %s', error.message))
      await cache.refreshActive().catch(() => {})
      follows.start()
    },

    // ---------------------------------------------------------- rooms

    /**
     * Open a room. A library show continues where its viewers stopped unless
     * `start` says otherwise.
     */
    async createRoom(input) {
      // Opening a room starts watching: late at night that is a binge night for a person whose points price it.
      const person = typeof input.person === 'string' ? input.person : ''
      const tickets = await points.pay(person, points.wants({ starts: true }))
      let start = input.start ?? null
      // A room on a library show continues where its viewers stopped, however it was asked for (page, person route, tool).
      if (start === null && typeof input.path === 'string') {
        const show = library.showPath(input.path)
        if (show !== null) start = await library.resumeFrom(show)
      }
      if (typeof input.path === 'string') follows.opened(library.showPath(input.path))
      // A room fetches with the account of the person who opened it, for everyone in it.
      const show = typeof input.path === 'string' ? library.showPath(input.path) : null
      const from = show === null ? null : library.workSource(show)
      if (from && typeof input.person === 'string' && from.person !== input.person) library.mark(show, { source: { ...from, person: input.person } })
      const opened = await rooms.createRoom({ ...input, start })
      await points.use(person, tickets, { room: opened.room?.id })
      return opened
    },
    watchTogether: id => rooms.watchTogether(id),
    waitReady: (...args) => rooms.waitReady(...args),
    room: id => rooms.room(id),
    /** Open rooms with a preview of what plays: the show's cover and a frame of the episode now on. */
    async listRooms() {
      return Promise.all(rooms.listRooms().map(async ({ file, ...room }) => {
        const show = room.show === null ? null : withCovers({ source: library.workSource(room.show), work: library.workOf(room.show) })
        return { ...room, cover: show?.work?.cover ?? null, frame: file === null ? null : await covers.ofFrame(file, room.duration > 30 ? Math.round(room.duration / 10) : 3) }
      }))
    },
    closeRoom: id => rooms.closeRoom(id),
    attach: (ws, id) => rooms.attach(ws, id),
    mediaFile: (...args) => rooms.mediaFile(...args),
    subtitleFile: (...args) => rooms.subtitleFile(...args),
    linkFor: id => rooms.linkFor(id),
    sweep: () => rooms.sweep(),
    pruneCache: days => rooms.pruneCache(days),

    // ---------------------------------------------------------- presence (src/presence.js)

    /** Finished or removed shows this person hasn't said how they found. */
    async pendingRatings(person) {
      const [list, events] = await Promise.all([library.list(), log.read()])
      return pendingRatings({ shows: list.shows, events, person: person.key, now: now() })
    },
    async rate(input, person) {
      await log.append('rating', ratingLine(input, person))
      changes.notify('library')
      return { ok: true }
    },
    trending: (sourceId, kind) => discover.trending(sourceId, kind),
    picks: (person, narrow) => discover.picks(person, narrow),
    /** Keep a recap or suggested steps with a show (the tool's annotate). */
    annotate(path, input) {
      const show = library.annotate(path, parseAnnotation(input))
      return { ok: true, show }
    },
    async startStep(path, id, person) {
      const show = library.showPath(path)
      if (show === null || !library.stepStarted(show, id)) throw hubError('not_found', 'no such step')
      await log.append('step.started', { show, title: library.workOf(show)?.title ?? '', step: id, person: person.key, by: person.name })
      return { ok: true }
    },

    // ---------------------------------------------------------- library

    async library() {
      const list = await library.list()
      for (const show of list.shows) if (show.source?.source) refreshWork(show.path, { source: show.source, work: show.work })
      return { ...list, shows: list.shows.map(withCovers) }
    },
    /**
     * The details of the work a room's show came from (or null), the quality its episodes are fetched in, and which of
     * the work's danmaku and comments its source offers.
     */
    roomWork(id) {
      const show = roomShow(id)
      const from = library.workSource(show)
      return {
        work: show === null ? null : withCovers(shownEntry(show)).work ?? null,
        source: from?.source ?? null,
        id: from?.id ?? null,
        quality: from?.quality || AUTO,
        ...remarks.offered(from),
      }
    },
    /** The danmaku of a room's item, from the copy kept with its show; the next episode's is made ready meanwhile. */
    async roomDanmaku(id, index) {
      const show = roomShow(id)
      const from = library.workSource(show)
      const number = rooms.slotOf(id, index)
      if (from === null || number === undefined) return { items: [], at: null }
      const answer = await remarks.danmaku(show, from, number)
      if (number < (from.episodes ?? 0)) remarks.danmaku(show, from, number + 1).catch(error => logger.warn('media hub: danmaku of %s episode %d: %s', show, number + 1, error.message))
      return answer
    },
    /** The comments on a room's work: the kept first page, or the page after `cursor`. */
    roomComments(id, cursor = '') {
      const show = roomShow(id)
      const from = library.workSource(show)
      return from === null ? { total: 0, items: [], next: null, at: null } : remarks.comments(show, from, cursor)
    },
    /** Fetch a room's show in one of the qualities its work offers, from the episodes after the one it is on. */
    async roomQuality(id, quality) {
      const show = roomShow(id)
      const offered = show === null ? [] : library.workOf(show)?.qualities ?? []
      if (!isQuality(quality) || !offered.includes(quality)) throw hubError('invalid', 'the show is not offered in this quality')
      await cache.requality(show, quality)
      return { quality }
    },
    episodes: path => library.episodes(path),
    removeShow: (path, by) => library.remove(path, { by }),
    removeEpisode: (path, name, by) => library.removeEpisode(path, name, { by }),
    renameShow: (path, name, by) => library.rename(path, name, { by }),
    keepShow: (path, by) => library.keep(path, { by }),
    countdownShow: (path, by) => library.countdown(path, { by }),
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
        if (typeof one.search === 'function' && one.kinds.some(entry => entry.id === kind) && await one.available()) candidates.push(one)
      }
      const answers = await Promise.allSettled(candidates.map(one => ask(one)))
      const failed = answers.flatMap((answer, index) => (answer.status === 'rejected' ? [{ source: candidates[index].id, message: answer.reason?.message ?? String(answer.reason) }] : []))
      if (candidates.length > 0 && failed.length === candidates.length) throw hubError('source_failed', failed.map(entry => entry.message).join('; '))
      return { results: interleave(answers.map(answer => (answer.status === 'fulfilled' ? answer.value.results : []))), next: null, failed }
    },
    /** A work's details; `person` and `language` say who asks (their account for its site) and in which language (subtitles). */
    info: async (sourceId, id, asking = {}) => ({ ...covers.decorate(sourceId, await source(sourceId).info(id, asking)), source: sourceId }),
    coverFile: key => covers.file(key),

    /**
     * Put a work from a source into the library. `watch` opens a room on it
     * at once, for the asker alone unless `together` (its episode shows as preparing until it is fetched); either
     * way only the rolling cache's window is downloaded, unless `all` keeps
     * the whole show offline. The show keeps how its episodes are fetched: the `quality` a source offers a choice of (Link),
     * whose account (`person`, the one asking) and the viewer's `language`, for the captions chosen with each episode.
     * @param {{ source: string, id: string, watch?: boolean, all?: boolean, quality?: string, by?: string, person?: string, language?: string }} input
     */
    async fetch({ source: sourceId, id, watch = false, together = false, all = false, quality = '', by = '', person = '', language = '' }) {
      const item = await source(sourceId).info(id, { person, language })
      if (!(item.episodes > 0)) throw hubError('empty', `${item.title || id} has no episodes`)
      const dir = await folderFor(sourceId, item)
      const subject = `${sourceId}:${item.id}`
      const isNew = points.enabled && await isNewSeries(sourceId, item)
      const disk = await statfs(libraryRoots[0]).catch(() => null)
      if (disk !== null && disk.bavail * disk.bsize < MIN_FREE_BYTES) throw hubError('no_space', 'the library disk is almost full; delete something first')
      const tickets = await points.pay(person, points.wants({ isNew, starts: watch }), { subject })
      const how = { ...(isQuality(quality) ? { quality } : {}), person, language }
      await library.adopt(dir, { source: sourceId, id: item.id, kind: item.kind, episodes: item.episodes, title: item.title, ...how }, { pinned: all })
      library.setWork(dir, snapshotOf(item, now()))
      let room = null
      if (watch) room = (await rooms.createRoom({ source: 'local', path: dir, title: item.title, by, person, together, start: await library.resumeFrom(dir) })).room
      else await cache.refresh(dir, { retry: true })
      await points.use(person, tickets, { room: room?.id, subject })
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
    /** The checks of followed works, for tests and for the assistant: one show now, or whatever is due. */
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

    /** Be told (with the kinds of what changed: `library`, `rooms`, `shelf`) when something a page shows changes; returns a way to stop. */
    listenChanges: listener => changes.listen(listener),

    async dispose() {
      changes.close()
      clearInterval(sweepTimer)
      follows.stop()
      await books.dispose()
      await downloads.dispose()
      await rooms.dispose()
      await covers.settle()
      await library.flush()
      await log.flush()
    },
  }
}
