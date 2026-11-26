/**
 * Shelves: the books each person fetched, as files they can download again.
 *
 * A book is one file per (source, work, format), kept under
 * `<dir>/files/<key>/` and shared by every shelf that holds it. A shelf entry
 * is one person's record of it (title, author, cover, when). Files are a
 * cache under `capBytes`: past it the least recently used go (never one
 * being fetched), and their entries stay on the shelf as `removed`, to be
 * fetched again with one tap. Deleting an entry deletes the file once no
 * shelf holds it.
 *
 * A format the source does not have is made with the converter (Calibre's
 * `ebook-convert`) from the best format it does have, when the converter is
 * installed; otherwise only the source's own formats are offered.
 *
 * `books.json` keeps the shelves and files; it is written whole, through a
 * temporary file, after every change. It also keeps who each shelf belongs
 * to (`people`: shelf key → the sign-in id and name last seen on it), learned
 * from the person's own requests, so the assistant can name a person whose
 * shelf is keyed by a hash it cannot compute.
 */
import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { isBlankBook } from './blank.js'
import { codedError } from './errors.js'
import { convertBase } from './formats.js'
import { createJsonSaver, readJson } from './json-file.js'
import { OWNER } from './people.js'
import { sha256Of } from './sha256.js'

export const BOOK_TYPES = Object.freeze({
  epub: 'application/epub+zip',
  pdf: 'application/pdf',
  txt: 'text/plain; charset=utf-8',
  azw3: 'application/vnd.amazon.ebook',
  mobi: 'application/x-mobipocket-ebook',
  fb2: 'application/x-fictionbook+xml',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  cbz: 'application/vnd.comicbook+zip',
  djvu: 'image/vnd.djvu',
})

const STATE_FILE = 'books.json'
const MAX_ENTRIES = 2000
const CONVERT_TIMEOUT_MS = 10 * 60_000
const CONCURRENCY = 2
const ENTRY = /^[0-9a-f-]{36}$/

export const fileKey = (source, id, format) => createHash('sha256').update(`${source}\n${id}\n${format}`).digest('hex').slice(0, 24)

/** A `Content-Disposition` that keeps the full name (any script) and gives older clients a plain fallback. */
export function attachment(name) {
  const fallback = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'book'
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

function runConverter(command, input, output) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [input, output], { stdio: ['ignore', 'ignore', 'pipe'], detached: true })
    let stderr = ''
    const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGTERM') } catch { /* gone */ } }, CONVERT_TIMEOUT_MS)
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-4000) })
    child.on('error', (error) => { clearTimeout(timer); reject(error) })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(codedError('convert_failed', `conversion failed: ${stderr.trim().split('\n').pop() || `exit ${code}`}`))
    })
  })
}

/**
 * @param {object} options
 * @param {string} options.dir - `<stateDir>/books`
 * @param {Map<string, object>} options.sources - by id; book downloads use `info` and `downloadFile`
 * @param {number} options.capBytes - the most disk book files may use; 0 for no limit
 * @param {{ command: string, available: () => Promise<boolean> }} options.converter
 * @param {{ register: (sourceId: string, url: string) => string | null }} options.covers
 * @param {{ warn: Function }} options.logger
 * @param {() => void} [options.changed] - told whenever the shelves change, so open pages re-read
 */
export function createBooks({ dir, sources, capBytes = 0, converter, covers, logger, changed = () => {}, now = Date.now }) {
  let state = { files: {}, shelves: {}, people: {} }
  const stateFile = join(dir, STATE_FILE)
  const saver = createJsonSaver(stateFile, logger)
  const running = new Map()
  const waiting = []
  let active = 0
  let disposed = false

  const save = () => {
    changed()
    return saver.save(state)
  }

  const shelf = person => (state.shelves[person] ??= [])
  const holders = key => Object.values(state.shelves).some(entries => entries.some(entry => entry.file === key))

  function describe(entry) {
    const file = state.files[entry.file]
    return {
      entry: entry.entry,
      source: entry.source,
      id: entry.id,
      format: entry.format,
      title: entry.title,
      author: entry.author,
      cover: entry.cover ? covers.ofSource(entry.source, entry.cover) : null,
      addedAt: entry.addedAt,
      state: file?.state ?? 'removed',
      error: file?.error ?? null,
      name: file?.name ?? null,
      bytes: file?.bytes ?? null,
      converted: file?.converted ?? false,
    }
  }

  async function usedBytes() {
    return Object.values(state.files).filter(file => file.state === 'ready').reduce((sum, file) => sum + (file.bytes ?? 0), 0)
  }

  /** Remove the least recently used ready files until the cap holds. */
  async function enforceCap() {
    if (!(capBytes > 0)) return
    let total = await usedBytes()
    const ready = Object.entries(state.files).filter(([key, file]) => file.state === 'ready' && !running.has(key)).sort(([, a], [, b]) => a.usedAt - b.usedAt)
    for (const [key, file] of ready) {
      if (total <= capBytes) break
      await rm(join(dir, 'files', key), { recursive: true, force: true })
      total -= file.bytes ?? 0
      state.files[key] = { ...file, state: 'removed', name: null }
    }
  }

  /** Fetch one file (download, convert when needed) into `files/<key>/`. */
  async function fetchFile(key, { source: sourceId, id, format }, signal) {
    const source = sources.get(sourceId)
    const work = await source.info(id)
    const native = (work.formats ?? []).some(entry => entry.format === format) || (work.formats ?? []).length === 0
    const scratch = join(dir, 'tmp', key)
    await rm(scratch, { recursive: true, force: true })
    await mkdir(scratch, { recursive: true })
    try {
      let name
      let converted = false
      if (native) {
        name = (await source.downloadFile({ id, format, dir: scratch, signal })).name
      } else {
        const base = convertBase(work.formats)
        if (base === null || !await converter.available()) throw codedError('unsupported', `${work.title || id} is not offered as ${format}`)
        const downloaded = (await source.downloadFile({ id, format: base, dir: scratch, signal })).name
        name = `${downloaded.slice(0, downloaded.length - extname(downloaded).length)}.${format}`
        await runConverter(converter.command, join(scratch, downloaded), join(scratch, name))
        await rm(join(scratch, downloaded), { force: true })
        converted = true
      }
      if (await isBlankBook(join(scratch, name), format)) throw codedError('empty', `${work.title || id} came back as ${format} with nothing to read in it; the source gave an empty book`)
      const target = join(dir, 'files', key)
      await rm(target, { recursive: true, force: true })
      await mkdir(join(dir, 'files'), { recursive: true })
      await rename(scratch, target)
      const path = join(target, name)
      return { name, bytes: (await stat(path)).size, sha256: await sha256Of(path), converted, title: work.title, author: work.author, cover: work.cover }
    } finally {
      await rm(scratch, { recursive: true, force: true })
    }
  }

  /** A ready file that vanished from disk is `removed` (fetched again with a tap); one with nothing to read is `failed`, and deleted. */
  async function checkReady(key, file) {
    const path = join(dir, 'files', key, file.name ?? '')
    if (!await stat(path).then(info => info.isFile(), () => false)) {
      state.files[key] = { ...file, state: 'removed', name: null }
    } else if (await isBlankBook(path, file.format ?? extname(path).slice(1))) {
      logger.warn('books: %s:%s kept an empty %s; removed it', file.source, file.id, file.format)
      await rm(join(dir, 'files', key), { recursive: true, force: true })
      state.files[key] = { ...file, state: 'failed', error: 'the saved book had nothing to read in it; fetch it again', name: null, bytes: null, sha256: null }
    }
  }

  function pump() {
    while (!disposed && active < CONCURRENCY && waiting.length > 0) {
      const { key, request } = waiting.shift()
      active += 1
      const controller = new AbortController()
      running.set(key, controller)
      fetchFile(key, request, controller.signal).then((got) => {
        state.files[key] = { ...state.files[key], state: 'ready', error: null, name: got.name, bytes: got.bytes, sha256: got.sha256, converted: got.converted, usedAt: now() }
        for (const entries of Object.values(state.shelves)) {
          for (const entry of entries) {
            if (entry.file !== key) continue
            entry.title ||= got.title ?? ''
            entry.author ||= got.author ?? ''
            entry.cover ||= got.cover ?? null
          }
        }
        return enforceCap().catch(error => logger.warn('books: could not keep the shelves under the cap: %s', error.message))
      }, (error) => {
        if (disposed) return
        logger.warn('books: %s:%s as %s failed: %s', request.source, request.id, request.format, error.message)
        state.files[key] = { ...state.files[key], state: 'failed', error: error.message }
      }).finally(() => {
        active -= 1
        running.delete(key)
        save()
        pump()
      })
    }
  }

  function start(key, request) {
    if (running.has(key) || waiting.some(job => job.key === key)) return
    state.files[key] = { ...state.files[key], source: request.source, id: request.id, format: request.format, state: 'fetching', error: null }
    waiting.push({ key, request })
    pump()
  }

  return {
    async load() {
      const { value } = await readJson(stateFile, { logger, valid: loaded => typeof loaded?.files === 'object' && loaded.files !== null && typeof loaded.shelves === 'object' && loaded.shelves !== null })
      if (value !== undefined) state = { people: {}, ...value }
      // A fetch cut by a restart starts again; a file that vanished from disk is marked removed.
      for (const [key, file] of Object.entries(state.files)) {
        if (file.state === 'fetching') start(key, file)
        else if (file.state === 'ready') await checkReady(key, file)
      }
      await rm(join(dir, 'tmp'), { recursive: true, force: true })
      await this.sweep()
    },

    /**
     * A folder under files/ that no record names and that is newer than the saved shelves is a fetch a crash cut off
     * before its save: deleted. An older one stays: its record was lost with a damaged shelves file, set aside to restore.
     */
    async sweep() {
      const savedAt = await stat(stateFile).then(info => info.mtimeMs, () => null)
      if (savedAt === null) return
      for (const name of await readdir(join(dir, 'files')).catch(() => [])) {
        if (state.files[name] !== undefined) continue
        const folder = join(dir, 'files', name)
        if (await stat(folder).then(info => info.mtimeMs > savedAt, () => false)) await rm(folder, { recursive: true, force: true })
      }
    },

    /**
     * Note who a verified person is, so their shelf can be found by name; saved only when it changed.
     * @param {{ key: string, id: string, name: string, verified: boolean }} person - from `personOf`
     */
    async seen(person) {
      if (!person.verified) return
      const known = state.people[person.key]
      if (known?.id === person.id && known?.name === person.name) return
      state.people[person.key] = { id: person.id, name: person.name }
      await save()
    },

    /**
     * The shelf key of a named person: their sign-in id, or the name they sign in with (any case), as seen on
     * their own requests. Without anyone seen and no one's shelf but the owner's, the single owner's shelf; an empty
     * name is the only person seen.
     */
    shelfOf(name = '') {
      const people = Object.entries(state.people)
      const known = people.map(([, person]) => (person.name ? `${person.name} (${person.id})` : person.id)).join(', ')
      if (people.length === 0) {
        if (Object.keys(state.shelves).every(key => key === OWNER)) return OWNER
        throw codedError('not_found', 'no shelf has been opened signed in since the hub learned names; ask the person to open the Books tab once')
      }
      const wanted = String(name).trim().normalize('NFKC').toLowerCase()
      if (wanted === '') {
        if (people.length === 1) return people[0][0]
        throw codedError('invalid', `name the person: ${known}`)
      }
      const byId = people.filter(([, person]) => person.id.toLowerCase() === wanted)
      const matches = byId.length > 0 ? byId : people.filter(([, person]) => person.name.normalize('NFKC').toLowerCase() === wanted)
      if (matches.length === 1) return matches[0][0]
      if (matches.length > 1) throw codedError('invalid', `${name} names several people; use their sign-in id: ${known}`)
      throw codedError('not_found', `no shelf known for ${name}; a person's shelf is known once they have opened it signed in. Known: ${known}`)
    },

    async list(person) {
      return {
        entries: shelf(person).map(describe).reverse(),
        usedBytes: await usedBytes(),
        capBytes,
        convert: await converter.available(),
      }
    },

    /**
     * Put a work on a person's shelf in `format` and fetch it unless the file is already here.
     * @param {string} person
     * @param {{ source: string, id: string, format: string, title?: string, author?: string, by?: string }} input
     */
    async add(person, { source: sourceId, id, format, title = '', author = '', by = '' }) {
      const source = sources.get(sourceId)
      if (source === undefined || typeof source.downloadFile !== 'function') throw codedError('not_found', `no source ${sourceId}`)
      if (typeof id !== 'string' || !/^[^\s\0]{1,200}$/.test(id)) throw codedError('invalid', 'not a work id')
      if (typeof format !== 'string' || !/^[a-z0-9]{1,8}$/.test(format)) throw codedError('invalid', 'not a format')
      const key = fileKey(sourceId, id, format)
      const entries = shelf(person)
      let entry = entries.find(one => one.file === key)
      if (entry === undefined) {
        if (entries.length >= MAX_ENTRIES) throw codedError('invalid', 'this shelf is full; delete some books first')
        entry = { entry: randomUUID(), file: key, source: sourceId, id, format, title: String(title).slice(0, 300), author: String(author).slice(0, 200), cover: null, addedAt: new Date(now()).toISOString(), by: String(by).slice(0, 80) }
        entries.push(entry)
      }
      const file = state.files[key]
      if (file?.state === 'ready') state.files[key] = { ...file, usedAt: now() }
      else start(key, { source: sourceId, id, format })
      await save()
      return describe(entry)
    },

    /** Fetch an entry's file again (it failed, or was removed to save space). */
    async retry(person, entryId) {
      const entry = shelf(person).find(one => one.entry === entryId)
      if (entry === undefined) throw codedError('not_found', 'not on this shelf')
      if (state.files[entry.file]?.state !== 'ready') start(entry.file, entry)
      await save()
      return describe(entry)
    },

    async remove(person, entryId) {
      const entries = shelf(person)
      const index = entries.findIndex(one => one.entry === entryId)
      if (index === -1) throw codedError('not_found', 'not on this shelf')
      const [entry] = entries.splice(index, 1)
      if (!holders(entry.file)) {
        running.get(entry.file)?.abort()
        const queued = waiting.findIndex(job => job.key === entry.file)
        if (queued !== -1) waiting.splice(queued, 1)
        delete state.files[entry.file]
        await rm(join(dir, 'files', entry.file), { recursive: true, force: true })
      }
      await save()
      return { removed: entryId }
    },

    /** The file behind a person's entry, when it is ready. */
    async file(person, entryId) {
      if (!ENTRY.test(String(entryId))) return null
      const entry = shelf(person).find(one => one.entry === entryId)
      const file = entry === undefined ? undefined : state.files[entry.file]
      if (file?.state !== 'ready' || !file.name) return null
      state.files[entry.file] = { ...file, usedAt: now() }
      save()
      return { path: join(dir, 'files', entry.file, file.name), name: file.name, type: BOOK_TYPES[entry.format] ?? 'application/octet-stream' }
    },

    async dispose() {
      disposed = true
      waiting.length = 0
      for (const controller of running.values()) controller.abort()
      await saver.settled()
    },
  }
}
