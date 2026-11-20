/**
 * The library: shows in the library folders (a folder of episodes, or one
 * file), what they hold, and what people did with them.
 *
 * Per show, `shows.json` in the state folder keeps what the files can't say:
 * where its source came from, how many episodes it will have, how far each
 * episode was watched and which to the end, where the viewers stopped,
 * whether it is kept. Progress is shared by everyone who watched together;
 * each viewer's own last stop is kept too, to show where it differs.
 * A show counts as watched when its last episode was watched to the end, or
 * every episode was. That starts a countdown: the show is deleted
 * `autoDeleteDays` later unless someone keeps it, or a room has it open; only
 * shows in the hub's own library folder, never in the user's other folders.
 * Keeping cancels the countdown; anyone can start it again, or restart it,
 * by hand. Watching the show again doesn't touch it; finishing it again
 * restarts it like a new finish.
 *
 * A show from a source lists all its episodes (src/episodes.js) but keeps
 * only some on disk: the rolling cache (src/cache.js) fetches and drops
 * episodes through `dropEpisodes` and `cacheInfo`, unless the show is
 * pinned (kept offline), which the cache never trims.
 */
import { mkdir, readFile, readdir, rename, rm, stat, statfs, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { episodeNumber, isSourced, keyOf, noteFor, numbersOf, slotsOf, titleOf } from './episodes.js'
import { codedError } from './errors.js'
import { createJsonSaver, readJson } from './json-file.js'
import { isAudio, isMedia, matchSubtitles, naturalSort } from './library.js'
import { dropPrepared, preparedBytes } from './prepare.js'
import { safeRecap } from './presence.js'
import { isNearEnd } from './watchlog.js'

const DAY_MS = 86_400_000
/** A viewer's own stop is worth showing when it is this far from the shared one. */
const STOP_DIFF_S = 30
/** Reaching the end again this long after the last finish counts as watching it again. */
const REFINISH_MS = 3_600_000
const MAX_NAME = 120
const SUMS = 'SHA256SUMS.txt'

/** A file or folder name someone typed: no path separators, no control characters, not hidden. */
export function cleanName(value) {
  const name = String(value ?? '').replace(/[\u0000-\u001f\u007f/\\]/g, '').trim().slice(0, MAX_NAME)
  if (name === '' || name.startsWith('.')) throw codedError('invalid', 'give a name')
  return name
}

/**
 * @param {object} options
 * @param {string[]} options.roots - library folders; the first one receives downloads
 * @param {string} options.stateDir
 * @param {number} options.autoDeleteDays - 0 keeps watched shows
 * @param {ReturnType<import('./covers.js').createCovers>} options.covers - makes the poster frame of a show's first episode
 * @param {(path: string) => boolean} options.inUse - whether an open room plays from this show
 * @param {(path: string) => object | null} options.download - the download state of a show folder
 * @param {(path: string) => void} options.forget - stop anything working on a show being removed
 * @param {(type: string, fields: object) => void} [options.record] - library actions for the watch log
 * @param {() => void} [options.changed] - told whenever the notes change or an episode file is deleted, so open pages re-read
 * @param {{ info: Function, warn: Function }} options.logger
 * @param {() => number} [options.now]
 */
/**
 * Seasons of one work sit together: a show with a `group` key goes next to the
 * first member of its group in the list (oldest season first), and says which
 * season it is and how many there are. Shows without a group keep their place.
 */
export function groupSeasons(shows) {
  const members = new Map()
  for (const show of shows) if (show.group) members.set(show.group, [...(members.get(show.group) ?? []), show])
  const placed = new Set()
  const ordered = []
  for (const show of shows) {
    if (!show.group) { ordered.push(show); continue }
    if (placed.has(show.group)) continue
    placed.add(show.group)
    const season = members.get(show.group).sort((a, b) => a.addedAt - b.addedAt)
    season.forEach((member, n) => { member.season = n + 1; member.seasons = season.length })
    ordered.push(...season)
  }
  shows.splice(0, shows.length, ...ordered)
}

export function createLibrary(options) {
  const { roots, stateDir, covers, inUse, download, forget, logger, now = Date.now } = options
  const metaFile = join(stateDir, 'shows.json')
  const cacheDir = join(stateDir, 'cache')
  let meta = {}
  const saver = createJsonSaver(metaFile, logger)
  const listeners = new Set()
  const changed = show => { for (const listener of listeners) listener(show) }

  async function load() {
    meta = (await readJson(metaFile, { logger })).value?.shows ?? {}
  }

  function save() {
    options.changed?.()
    return saver.save({ shows: meta })
  }

  const record = path => meta[path] ?? {}
  function update(path, patch) {
    meta[path] = { ...record(path), ...patch }
    save()
  }

  /** The absolute path of a show, if it is one directly inside a library folder. */
  function showPath(path) {
    if (typeof path !== 'string') return null
    const target = resolve(path)
    return roots.includes(dirname(target)) && !basename(target).startsWith('.') ? target : null
  }

  /** Sourced shows still inside a library folder: a record left from a folder no longer configured is kept but not managed. */
  const sourcedPaths = () => Object.keys(meta).filter(path => isSourced(meta[path]) && showPath(path) === path)

  function requireShow(path) {
    const target = showPath(path)
    if (target === null) throw codedError('not_found', 'not a show in the library')
    return target
  }

  /** The show folder or file an episode path belongs to, or null. */
  function showOf(episodePath) {
    if (typeof episodePath !== 'string') return null
    return showPath(episodePath) ?? showPath(dirname(episodePath))
  }

  /** Episode files of a show, in order, with sizes. */
  async function episodeFiles(path) {
    const info = await stat(path).catch(() => null)
    if (info === null) return null
    if (info.isFile()) return isMedia(basename(path)) ? [{ name: basename(path), size: info.size, mtimeMs: info.mtimeMs }] : null
    const files = []
    for (const name of naturalSort(await readdir(path).catch(() => []))) {
      if (!isMedia(name)) continue
      const file = await stat(join(path, name)).catch(() => null)
      if (file?.isFile()) files.push({ name, size: file.size, mtimeMs: file.mtimeMs })
    }
    return files
  }

  /** An episode file of a show folder, what was prepared from it and the subtitles beside it. */
  async function deleteEpisode(target, name) {
    await dropPrepared(cacheDir, join(target, name))
    await rm(join(target, name), { force: true })
    for (const sub of matchSubtitles(name, await readdir(target).catch(() => []))) await rm(join(target, sub.name), { force: true })
    await forgetSum(target, name)
    options.changed?.()
  }

  async function folderBytes(path) {
    const info = await stat(path).catch(() => null)
    if (info === null) return 0
    if (info.isFile()) return info.size
    let total = 0
    for (const name of await readdir(path).catch(() => [])) total += (await stat(join(path, name)).catch(() => null))?.size ?? 0
    return total
  }

  /** Take a deleted file out of the show's checksum list. */
  async function forgetSum(show, file) {
    const sums = join(show, SUMS)
    const text = await readFile(sums, 'utf8').catch(() => null)
    if (text !== null) await writeFile(sums, text.split('\n').filter(line => !line.endsWith(`  ${file}`) && !line.endsWith(` *${file}`)).join('\n'))
  }

  const note = (type, path, fields = {}) => options.record?.(type, { show: path, title: basename(path), ...fields })

  /** Only the hub's own library folder (the first root) is cleaned up on its own; the other folders are the user's. */
  const autoDeletes = path => options.autoDeleteDays > 0 && dirname(path) === roots[0]

  function deletesAt(path) {
    const { countdownFrom, keep } = record(path)
    if (!countdownFrom || keep || !autoDeletes(path)) return null
    return countdownFrom + options.autoDeleteDays * DAY_MS
  }

  /** How far one episode was watched: { finished, position, duration }, or null when never started. */
  function watchOf(episodePath) {
    const show = showOf(episodePath)
    if (show === null) return null
    const entry = record(show)
    const file = basename(episodePath)
    const key = keyOf(entry, file)
    const finished = (entry.finished ?? []).some(name => keyOf(entry, name) === key)
    const at = noteFor(entry, entry.progress, file)
    if (!finished && !(at?.position > 0)) return null
    return { finished, position: at?.position ?? null, duration: at?.duration ?? null }
  }

  /** How far a room item was watched: by episode number for a sourced show (it may not be on disk), else by file. */
  function watchOfItem(show, { slot, sourcePath }) {
    if (slot === undefined) return typeof sourcePath === 'string' ? watchOf(sourcePath) : null
    const entry = record(show)
    const finished = (entry.finished ?? []).some(name => episodeNumber(name) === slot)
    const at = Object.entries(entry.progress ?? {}).find(([name]) => episodeNumber(name) === slot)?.[1]
    if (!finished && !(at?.position > 0)) return null
    return { finished, position: at?.position ?? null, duration: at?.duration ?? null }
  }

  /** Viewers whose own last stop differs from the shared one: [{ viewer, index, title, position }]. */
  function otherStops(path, slots) {
    const entry = record(path)
    const shared = entry.resume
    const indexOf = file => slots.findIndex(slot => slot.key === keyOf(entry, file))
    return Object.entries(entry.stops ?? {})
      .filter(([, stop]) => indexOf(stop.file) >= 0 && (shared === undefined || stop.file !== shared.file || Math.abs(stop.position - shared.position) > STOP_DIFF_S))
      .map(([viewer, stop]) => ({ viewer, index: indexOf(stop.file), title: titleOf(stop.file), position: stop.position }))
  }

  /**
   * Where to continue a show: the episode the viewers stopped in and how far,
   * or the next one when they had reached its end.
   * @returns {{ index: number, position: number, title: string } | null}
   */
  function resumeFrom(path, slots) {
    const entry = record(path)
    const resume = entry.resume
    if (!resume) return null
    const index = slots.findIndex(slot => slot.key === keyOf(entry, resume.file))
    if (index < 0) return null
    if (isNearEnd(resume.position, resume.duration)) {
      return index + 1 < slots.length ? { index: index + 1, position: 0, title: slots[index + 1].title ?? '' } : null
    }
    return resume.position > 5 || index > 0 ? { index, position: resume.position, title: slots[index].title ?? titleOf(resume.file) } : null
  }

  /** The episode the rolling cache keeps in focus when no room is open: where the viewers stopped, the next one after an ending, the first for a show nobody started; null once the last one is watched. */
  function focusOf(path, slots) {
    const entry = record(path)
    const resume = entry.resume
    if (!resume) return 1
    const index = slots.findIndex(slot => slot.key === keyOf(entry, resume.file))
    if (index < 0) return 1
    if (isNearEnd(resume.position, resume.duration)) return index + 1 < slots.length ? slots[index + 1].n : null
    return slots[index].n
  }

  // ------------------------------------------------------------ views

  async function describe(path) {
    const info = await stat(path).catch(() => null)
    if (info === null) return null
    const files = await episodeFiles(path)
    const state = download(path)
    if ((files === null || files.length === 0) && state === null && !isSourced(record(path))) return null
    const names = (files ?? []).map(file => file.name)
    const entry = record(path)
    const slots = slotsOf(entry, files ?? [])
    if (names.length === 0 && state === null && !isSourced(entry)) return null
    const resume = resumeFrom(path, slots)
    const finished = slots.filter(slot => (entry.finished ?? []).some(name => keyOf(entry, name) === slot.key)).length
    return {
      path,
      name: basename(path),
      kind: info.isDirectory() ? 'folder' : 'file',
      media: names.length > 0 && names.every(isAudio) ? 'audio' : (entry.source?.kind === 'audio' ? 'audio' : 'video'),
      episodes: names.length,
      sourced: isSourced(entry),
      pinned: entry.pinned === true,
      total: entry.source?.episodes ?? null,
      size: await folderBytes(path),
      frame: files === null || files.length === 0 ? null : await covers.ofFrame(info.isFile() ? path : join(path, files[0].name)),
      source: entry.source ?? null,
      keep: entry.keep === true,
      watchedAt: entry.watchedAt ?? null,
      lastWatchedAt: entry.resume?.at ?? null,
      work: entry.work ?? null,
      follow: entry.follow ?? null,
      newSeason: entry.newSeason ?? null,
      newEpisodes: entry.newEpisodes ?? null,
      group: entry.group ?? null,
      autoDeletes: autoDeletes(path),
      deletesAt: deletesAt(path),
      resume,
      finished,
      // Written from outside (src/presence.js); the recap only once the viewers are past what it covers.
      recap: safeRecap(entry.recap ?? null, resume ? resume.index : finished),
      steps: entry.steps ?? null,
      stepsStarted: entry.stepsStarted ?? {},
      stops: otherStops(path, slots),
      inUse: inUse(path),
      download: state,
      addedAt: entry.addedAt ?? (info.birthtimeMs || info.mtimeMs),
    }
  }

  return {
    load,
    /** Resolves once the notes written so far are on disk. */
    flush: () => saver.settled(),
    showPath,
    showOf,
    resumeFrom: async path => resumeFrom(path, slotsOf(record(path), (await episodeFiles(path)) ?? [])),
    watchOf,
    watchOfItem,
    /** Called with a show's path whenever its watch progress changes. */
    onChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    /** Every show, newest first, with totals and the free space of the download folder's disk. */
    async list() {
      const paths = []
      for (const root of roots) {
        for (const name of await readdir(root).catch(() => [])) if (!name.startsWith('.')) paths.push(join(root, name))
      }
      const shows = (await Promise.all(paths.map(path => describe(path)))).filter(show => show !== null)
      shows.sort((a, b) => b.addedAt - a.addedAt)
      groupSeasons(shows)
      const disk = await statfs(roots[0]).catch(() => null)
      return {
        shows,
        total: shows.reduce((sum, show) => sum + show.size, 0),
        free: disk === null ? null : disk.bavail * disk.bsize,
        autoDeleteDays: options.autoDeleteDays,
      }
    },

    async episodes(path) {
      const target = requireShow(path)
      const slots = slotsOf(record(target), (await episodeFiles(target)) ?? [])
      return slots.map(slot => ({
        n: slot.n,
        name: slot.file?.name ?? null,
        title: slot.title,
        size: slot.file?.size ?? 0,
        cached: slot.file !== null,
        watch: watchOfItem(target, { slot: isSourced(record(target)) ? slot.n : undefined, sourcePath: slot.file ? join(target, slot.file.name) : null }),
      }))
    },

    /**
     * The episodes of a sourced show for a room: one per number, with the file and the subtitles beside it when it is on disk. Null for a show without a source.
     * @returns {Promise<{ n: number, title: string | null, path: string | null, subtitles: { path: string, label: string }[] }[] | null>}
     */
    async directory(path) {
      const target = showPath(path)
      if (target === null || !isSourced(record(target))) return null
      const names = await readdir(target).catch(() => [])
      return slotsOf(record(target), (await episodeFiles(target)) ?? []).map(slot => ({
        n: slot.n,
        title: slot.title,
        path: slot.file ? join(target, slot.file.name) : null,
        subtitles: slot.file ? matchSubtitles(slot.file.name, names).map(sub => ({ path: join(target, sub.name), label: sub.label })) : [],
      }))
    },

    /** Paths of the shows that came from a source. */
    async sourcedShows() {
      return sourcedPaths()
    },

    /** Forget that these episodes were deleted by hand. */
    async unskip(path, numbers) {
      update(path, { skip: (record(path).skip ?? []).filter(n => !numbers.includes(n)) })
    },

    /** The episode numbers on disk in a show folder. */
    async cachedNumbers(path) {
      return numbersOf(((await episodeFiles(path)) ?? []).map(file => file.name))
    },

    /** What the rolling cache needs to know about a show, or null for a show without a source. */
    async cacheInfo(path) {
      const target = showPath(path)
      if (target === null || !isSourced(record(target))) return null
      const entry = record(target)
      const files = (await episodeFiles(target)) ?? []
      const slots = slotsOf(entry, files)
      return {
        source: entry.source,
        total: entry.source.episodes,
        cached: numbersOf(files.map(file => file.name)),
        finished: numbersOf(entry.finished ?? []),
        skip: new Set(entry.skip ?? []),
        pinned: entry.pinned === true,
        focus: focusOf(target, slots),
      }
    },

    /** Every cached episode of the shows the cap counts (sourced, not pinned), with its bytes (the prepared copy included) and when it was last watched or fetched. */
    async cacheEntries() {
      const out = []
      for (const path of sourcedPaths()) {
        const entry = meta[path]
        if (entry.pinned === true) continue
        for (const file of (await episodeFiles(path)) ?? []) {
          const n = episodeNumber(file.name)
          if (n === null) continue
          const watchedAt = noteFor(entry, entry.progress, file.name)?.at ?? 0
          out.push({ key: `${path}\0${n}`, show: path, n, bytes: file.size + await preparedBytes(cacheDir, join(path, file.name)), lastAt: Math.max(watchedAt, file.mtimeMs) })
        }
      }
      return out
    },

    /** Delete cached episodes of a sourced show (watched, or pushed out by the cap); the show and what the viewers did stay. */
    async dropEpisodes(path, numbers, { reason }) {
      const target = requireShow(path)
      const gone = []
      for (const file of (await episodeFiles(target)) ?? []) {
        const n = episodeNumber(file.name)
        if (n === null || !numbers.includes(n)) continue
        await deleteEpisode(target, file.name)
        gone.push(n)
      }
      if (gone.length > 0) note('library.cacheDropped', target, { episodes: gone, reason })
      return gone
    },

    /** Keep a show's every episode on disk (or go back to the rolling cache). */
    async pin(path, pinned, { by = null } = {}) {
      const target = requireShow(path)
      if (!isSourced(record(target))) throw codedError('invalid', 'only a show from a source can be kept offline')
      update(target, { pinned })
      note(pinned ? 'library.pinned' : 'library.unpinned', target, { by })
      return { path: target, pinned }
    },

    /** Followed shows with when they were last checked and are next due. */
    follows: () => Object.entries(meta).filter(([, entry]) => entry.follow && isSourced(entry)).map(([path, entry]) => ({ path, follow: entry.follow, source: entry.source, group: entry.group ?? null })),
    /** Follow a show, or stop (null). `follow` is `{ since, seen, checkedAt, nextAt }`. */
    setFollow(path, follow) {
      update(path, { follow })
      changed(path)
    },
    /** What a check found: a new season (on the new show) or more episodes (on this one); cleared when someone looks. */
    mark: (path, patch) => update(path, patch),
    /** Keep what the outside writes about a show (src/presence.js parseAnnotation); new steps start unpressed. */
    annotate(path, annotation) {
      const target = requireShow(path)
      update(target, { ...annotation, ...(annotation.steps !== undefined ? { stepsStarted: {} } : {}) })
      return target
    },
    /** A suggested step was started; returns false for a step the show doesn't have. */
    stepStarted(path, id) {
      const target = requireShow(path)
      const entry = record(target)
      if (!(entry.steps ?? []).some(step => step.id === id)) return false
      update(target, { stepsStarted: { ...entry.stepsStarted, [id]: now() } })
      return true
    },
    dismiss: path => update(requireShow(path), { newSeason: null, newEpisodes: null }),
    /** More episodes in a show's work than it had: its total grows, the rolling cache takes it from there. */
    setEpisodes(path, episodes) {
      const entry = record(path)
      update(path, { source: { ...entry.source, episodes } })
      changed(path)
    },

    /** Fetch a sourced show's episodes in another quality (src/quality.js) from now on. */
    setQuality(path, quality) {
      const target = requireShow(path)
      const entry = record(target)
      if (!isSourced(entry)) throw codedError('invalid', 'this show has no source to fetch from')
      update(target, { source: { ...entry.source, quality } })
    },

    /** The saved (offline fallback) copy of a show's work, or null. */
    workOf: path => record(path).work ?? null,
    /** Which source and work id a show came from (`{ source, id, ... }`), or null. */
    workSource: path => (path === null || path === undefined ? null : record(path).source ?? null),
    /** The saved copy of a work, refreshed from its source: an offline fallback only, and no change of the show. */
    keepWork(path, work) {
      if (meta[path]) update(path, { work })
    },
    setWork(path, work) {
      update(path, { work })
    },

    /** Note a show coming from a source, before its files arrive. */
    async adopt(path, source, { pinned = false } = {}) {
      await mkdir(path, { recursive: true })
      update(path, { source, addedAt: record(path).addedAt ?? now(), ...(pinned ? { pinned: true } : {}) })
    },

    async remove(path, { by = null, reason = 'by hand' } = {}) {
      const target = requireShow(path)
      if (inUse(target)) throw codedError('in_use', 'a room is playing this show; close the room first')
      await forget(target)
      await rm(target, { recursive: true, force: true })
      delete meta[target]
      await save()
      note('library.deleted', target, { by, reason })
      return { removed: target }
    },

    async removeEpisode(path, name, { by = null } = {}) {
      const target = requireShow(path)
      if ((await stat(target)).isFile()) return this.remove(target, { by })
      if (inUse(target)) throw codedError('in_use', 'a room is playing this show; close the room first')
      const file = cleanName(name)
      if (!isMedia(file)) throw codedError('invalid', 'not an episode')
      await deleteEpisode(target, file)
      note('library.episodeDeleted', target, { episode: titleOf(file), by })
      const entry = record(target)
      // Deleted by hand: the rolling cache doesn't fetch it again unless someone goes to it.
      if (isSourced(entry) && episodeNumber(file) !== null) update(target, { skip: [...new Set([...(entry.skip ?? []), episodeNumber(file)])] })
      const left = await episodeFiles(target)
      if (!isSourced(entry) && left !== null && left.length === 0 && download(target) === null) return this.remove(target, { by })
      return { removed: join(target, file) }
    },

    async rename(path, name, { by = null } = {}) {
      const target = requireShow(path)
      if (inUse(target)) throw codedError('in_use', 'a room is playing this show; close the room first')
      if (download(target)?.active) throw codedError('in_use', 'this show is still downloading')
      const isFile = (await stat(target)).isFile()
      const clean = cleanName(name)
      const next = join(dirname(target), isFile && extname(clean) === '' ? `${clean}${extname(target)}` : clean)
      if (next === target) return { path: target }
      if (await stat(next).then(() => true, () => false)) throw codedError('exists', 'a show with that name is already in the library')
      await rename(target, next)
      if (meta[target] !== undefined) {
        meta[next] = meta[target]
        delete meta[target]
        await save()
      }
      note('library.renamed', next, { from: basename(target), by })
      return { path: next }
    },

    /** Keep a show: no countdown; it stays until someone deletes it. */
    async keep(path, { by = null } = {}) {
      const target = requireShow(path)
      update(target, { keep: true })
      note('library.kept', target, { by })
      return { path: target, keep: true, deletesAt: null }
    },

    /** Start the countdown now (or restart it): deleted `autoDeleteDays` from now unless kept. */
    async countdown(path, { by = null } = {}) {
      const target = requireShow(path)
      if (!(options.autoDeleteDays > 0)) throw codedError('invalid', 'automatic deleting is off')
      if (!autoDeletes(target)) throw codedError('invalid', 'shows outside the hub\'s own library are never deleted on their own')
      const restart = deletesAt(target) !== null
      update(target, { keep: false, countdownFrom: now() })
      note(restart ? 'library.countdownRestarted' : 'library.countdownStarted', target, { by, deletesAt: new Date(deletesAt(target)).toISOString() })
      return { path: target, keep: false, deletesAt: deletesAt(target) }
    },

    /** Where the viewers are in an episode; called as they watch. */
    async noteProgress(episodePath, position, duration, viewers = []) {
      const show = showOf(episodePath)
      if (show === null || !(position >= 0)) return
      const file = basename(episodePath)
      const entry = record(show)
      const stops = { ...entry.stops }
      for (const viewer of viewers) stops[viewer] = { file, position, at: now() }
      update(show, {
        resume: { file, position, duration: duration ?? null, at: now() },
        progress: { ...entry.progress, [file]: { position, duration: duration ?? entry.progress?.[file]?.duration ?? null, at: now() } },
        stops,
      })
      if (isNearEnd(position, duration)) await this.noteFinished(episodePath)
      else changed(show)
    },

    /** An episode was watched to its end; the show may now count as watched. */
    async noteFinished(episodePath) {
      const show = showOf(episodePath)
      if (show === null) return
      const entry = record(show)
      const finished = new Set(entry.finished ?? [])
      finished.add(basename(episodePath))
      const names = ((await episodeFiles(show)) ?? []).map(file => file.name)
      const keys = slotsOf(entry, ((await episodeFiles(show)) ?? [])).map(slot => slot.key)
      const done = new Set([...finished].map(name => keyOf(entry, name)))
      // A sourced show is watched through its source's list, whether or not the episodes are still on disk.
      const complete = isSourced(entry) || names.length >= (entry.source?.episodes ?? names.length)
      const lastDone = complete && keys.length > 0 && done.has(keys[keys.length - 1])
      const allDone = complete && keys.every(key => done.has(key))
      // Finishing the show starts its countdown; finishing it again later (a rewatch) restarts it. A kept show stays kept.
      const newFinish = (lastDone || allDone) && (!entry.watchedAt || now() - entry.watchedAt > REFINISH_MS)
      update(show, { finished: [...finished], ...(newFinish ? { watchedAt: now(), countdownFrom: now() } : {}) })
      if (newFinish && !entry.keep && autoDeletes(show)) note('library.countdownStarted', show, { by: null, reason: 'watched to the end', deletesAt: new Date(deletesAt(show)).toISOString() })
      changed(show)
    },

    /** Delete watched shows whose time has come, unless kept, open in a room or downloading. */
    async sweep() {
      for (const path of Object.keys(meta)) {
        const due = deletesAt(path)
        if (due === null || due > now() || inUse(path) || download(path)?.active) continue
        if (!(await stat(path).then(() => true, () => false))) {
          delete meta[path]
          save()
          continue
        }
        logger.info('deleting %s: its %d-day countdown ended', path, options.autoDeleteDays)
        await this.remove(path, { reason: 'countdown ended' }).catch(error => logger.warn('could not delete %s: %s', path, error.message))
      }
    },
  }
}

