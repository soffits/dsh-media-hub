/**
 * Downloads from sources into library folders, one at a time, saved in
 * `downloads.json` so they carry on after a restart.
 *
 * A job is one show with a *want list*: the episodes the rolling cache
 * (src/cache.js) wants on disk, in the order to fetch them. The runner takes
 * the first wanted episode that is not on disk yet and the ones directly
 * after it as one run for the source, and repeats until nothing is missing.
 * The want list changes while a run goes on (someone jumped, the window
 * moved): a run carries on only when the first wanted episode is the one it
 * fetches now or next, and is cut and restarted otherwise, so a jump is
 * fetched at once and an episode someone left (unless it is just ahead of
 * them) is not fetched on. A show with a room open goes before a show without one, and may
 * interrupt it; the interrupted job resumes afterwards.
 */
import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { nextRun } from './window.js'

const ACTIVE = new Set(['queued', 'running'])

/** How a show's episodes are fetched, from what its notes keep: quality, whose account, and the viewer's language (for captions). */
export const howOf = (source = {}) => ({ quality: source.quality ?? '', person: source.person ?? '', language: source.language ?? '' })

/** The episode a running job fetches now or next: the first one of its run from where it is that is not on disk, or null. */
function nextOfRun(job, onDisk) {
  const [from, to] = job.current ?? [0, -1]
  for (let n = job.at ?? from; n <= to; n++) if (!onDisk.has(n)) return n
  return null
}

const sourceError = (code, message) => Object.assign(new Error(message), { code })

/**
 * @param {object} options
 * @param {string} options.stateDir
 * @param {Map<string, object>} options.sources - by id
 * @param {(dir: string) => Promise<Set<number>>} options.have - the episode numbers on disk in a show folder
 * @param {() => Promise<boolean>} [options.hasSpace] - whether the disk has room for another episode
 * @param {(job: object) => Promise<void>} options.onFiles - episodes may have landed in job.dir, or the job ended
 * @param {(job: object, number: number, progress: object) => void} [options.onProgress] - how far an episode's download is
 * @param {(job: object, number: number, partial: object) => void} [options.onPartial] - an episode's files while they are still being fetched (a source's `onPartial`)
 * @param {{ info: Function, warn: Function }} options.logger
 * @param {() => number} [options.now]
 */
export function createDownloads({ stateDir, sources, have, hasSpace = async () => true, onFiles, onProgress = () => {}, onPartial = () => {}, logger, now = Date.now }) {
  const file = join(stateDir, 'downloads.json')
  const jobs = new Map()
  let running = null
  let disposed = false
  let saving = Promise.resolve()
  let notifying = Promise.resolve()

  function save() {
    const body = JSON.stringify({ jobs: [...jobs.values()].map(({ controller, current, at, ...job }) => job) }, null, 1)
    saving = saving.then(async () => {
      await writeFile(`${file}.part`, body)
      await rename(`${file}.part`, file)
    }).catch(error => logger.warn('could not save downloads: %s', error.message))
    return saving
  }

  function notify(job) {
    notifying = notifying.then(() => onFiles(job)).catch(error => logger.warn('after a download step: %s', error.message))
    return notifying
  }

  function next() {
    const queued = [...jobs.values()].filter(job => job.status === 'queued')
    queued.sort((a, b) => Number(b.priority) - Number(a.priority) || a.createdAt - b.createdAt)
    return queued[0]
  }

  function pump() {
    if (disposed) return
    const candidate = next()
    if (candidate === undefined) return
    if (running !== null) {
      // Someone is waiting on this one: the running download steps aside and resumes later.
      if (candidate.priority && !running.priority) running.controller.abort('yield')
      return
    }
    run(candidate)
  }

  async function run(job) {
    const source = sources.get(job.source)
    running = job
    job.status = 'running'
    job.error = null
    job.reason = null
    job.failed = []
    job.controller = new AbortController()
    const { signal } = job.controller
    save()
    try {
      if (source === undefined) throw sourceError('unavailable', `source ${job.source} is not available`)
      for (;;) {
        const range = nextRun(job.want, await have(job.dir))
        if (range === null || signal.aborted) break
        if (!(await hasSpace())) throw sourceError('no_space', 'the library disk is almost full; delete something first')
        job.current = range
        job.at = range[0]
        const result = await source.download({ ...howOf(job.how), id: job.id, dir: job.dir, from: range[0], to: range[1], signal, onStart: (n) => { job.at = n }, onEpisode: () => notify(job), onProgress: (n, progress) => onProgress(job, n, progress), onPartial: (n, partial) => onPartial(job, n, partial) })
        await notify(job)
        if (signal.aborted) break
        if (result.failed.length > 0) {
          job.failed = result.failed
          throw sourceError('source_failed', `${result.failed.length} episodes could not be downloaded`)
        }
      }
      if (signal.aborted) {
        if (signal.reason === 'yield') job.status = 'queued'
      } else {
        job.status = 'done'
      }
    } catch (error) {
      logger.warn('download of %s failed: %s', job.title, error.message)
      job.status = 'failed'
      job.error = error.message
      job.reason = error.reason ?? null
    } finally {
      delete job.controller
      delete job.current
      delete job.at
      running = null
      if (job.status === 'done') jobs.delete(job.dir)
      save()
      if (job.status === 'failed') await notify(job)
      pump()
    }
  }

  return {
    async load() {
      let data = { jobs: [] }
      try {
        data = JSON.parse(await readFile(file, 'utf8'))
      } catch (error) {
        if (error.code !== 'ENOENT') logger.warn('could not read %s: %s', file, error.message)
      }
      // A job without a want list is from before the rolling cache (the whole show): the cache plans the show again when someone needs it.
      for (const job of data.jobs ?? []) if (Array.isArray(job.want)) jobs.set(job.dir, { ...job, status: job.status === 'running' ? 'queued' : job.status })
      pump()
    },

    /**
     * Say which episodes of a show to have on disk, in the order to fetch
     * them (replacing any earlier list). A job that failed stays failed
     * unless `retry` is set: someone asked for an episode again.
     * @param {{ source: string, item: { id: string, title: string, kind: string, episodes: number | null, how?: object }, dir: string }} show - `how` as `howOf` gives it
     * @param {number[]} want
     * @param {{ priority?: boolean, retry?: boolean }} [options] - priority: a room is open on this show
     */
    async want({ source, item, dir }, want, { priority = false, retry = false } = {}) {
      let job = jobs.get(dir)
      if (job === undefined) {
        if (want.length === 0) return null
        job = { dir, source, id: item.id, title: item.title, kind: item.kind, episodes: item.episodes ?? null, status: 'queued', error: null, reason: null, failed: [], priority, want, createdAt: now() }
        jobs.set(dir, job)
      }
      job.how = howOf(item.how)
      job.want = want
      job.priority = priority
      const onDisk = await have(dir)
      const first = want.find(n => !onDisk.has(n))
      if (first === undefined) {
        // Nothing is missing: a running job has nothing left to fetch, a failed one is over.
        if (running === job) job.controller.abort('yield')
        else if (!ACTIVE.has(job.status) || job.status === 'failed') jobs.delete(dir)
        save()
        return null
      }
      if (job.status === 'failed' && retry) {
        job.status = 'queued'
        job.error = null
        job.reason = null
      }
      if (running === job && nextOfRun(job, onDisk) !== first) job.controller.abort('yield')
      save()
      pump()
      return job
    },

    /** What is happening to a show folder, or null when nothing is. */
    state(dir) {
      const job = jobs.get(dir)
      if (job === undefined) return null
      return { status: job.status, active: ACTIVE.has(job.status), total: job.episodes, error: job.error, reason: job.reason ?? null, failed: job.failed.length, source: job.source, wanted: job.want.length }
    },

    job: dir => jobs.get(dir),

    /** Start a failed job again. */
    retry(dir) {
      const job = jobs.get(dir)
      if (job === undefined) return null
      if (job.status === 'failed') {
        job.status = 'queued'
        job.error = null
        job.reason = null
      }
      save()
      pump()
      return job
    },

    /** Stop and forget a show's download. */
    async cancel(dir) {
      const job = jobs.get(dir)
      if (job === undefined) return
      jobs.delete(dir)
      job.controller?.abort('cancel')
      save()
      while (running === job) await new Promise(done => setTimeout(done, 50))
    },

    async dispose() {
      disposed = true
      running?.controller?.abort('stop')
      while (running !== null) await new Promise(done => setTimeout(done, 50))
      await saving
    },
  }
}
