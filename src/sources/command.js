/**
 * A source that is a command line tool. The plugin knows nothing about the
 * site behind it: it runs the configured command with the verbs below and
 * reads JSON back. The protocol is documented in docs/source-protocol.md.
 *
 *   <command> search --kind <kind> --limit <n> [--offset <n>] --json -- <query>
 *   <command> info --json -- <id>
 *   <command> download --id=<id> --episodes <A-B | A- | A> --output <dir> --json   (video and audio kinds)
 *   <command> download --id=<id> --format <ext> --output <dir> --json               (book kinds: one file)
 *   <command> cover --output <file> -- <url>      (optional: fetch a cover image)
 *
 * search and info print one JSON document on stdout; download prints one
 * JSON object per line (events) and a last `result`. stderr is free text for
 * people; its last line is the error message when a command fails.
 * Whatever network policy the command's own launcher enforces (a proxy it
 * requires, for example) holds for the source, since nothing here talks to
 * the site.
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { access, constants, mkdir, rm, stat } from 'node:fs/promises'
import { basename, delimiter, isAbsolute, join } from 'node:path'

const SEARCH_LIMIT = 12
const QUERY_TIMEOUT_MS = 60_000
const COVER_TIMEOUT_MS = 30_000
const MAX_OUTPUT = 16 * 1024 * 1024
const ID = /^[^\s\0]{1,200}$/

const sourceError = (code, message) => Object.assign(new Error(message), { code })
const text = value => (typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '')
const numberOrNull = value => (Number.isFinite(value) ? value : null)

const STATUSES = new Set(['finished', 'ongoing', 'stopped'])
const COVER_URL = /^https?:\/\/[^\s]{1,2000}$/
const MAX_TAGS = 12
const MAX_META = 16
const MAX_RELATED = 30

const countOrNull = value => (Number.isInteger(value) && value >= 0 ? value : null)

/** A file format name as sources write it: `epub`, `txt`, `pdf`, `azw3`... */
export const FORMAT = /^[a-z0-9]{1,8}$/
const MAX_FORMATS = 12
const YEAR = value => (Number.isInteger(value) && value > 0 && value < 10000 ? value : null)

/** `[{ format, bytes }]` the work can be downloaded as, each format once. */
function formatsOf(raw) {
  if (!Array.isArray(raw)) return []
  const seen = new Set()
  const out = []
  for (const row of raw) {
    const format = text(row?.format).toLowerCase().replace(/^\./, '')
    if (!FORMAT.test(format) || seen.has(format)) continue
    seen.add(format)
    out.push({ format, bytes: countOrNull(row.bytes) })
    if (out.length === MAX_FORMATS) break
  }
  return out
}

/** How many people watched, read or follow it, and what the count counts (`label`: plays, readers, listeners, heat, followers, or the source's own word). */
function popularityOf(raw) {
  if (raw === null || typeof raw !== 'object' || !(raw.count >= 0) || !Number.isFinite(raw.count)) return null
  const label = text(raw.label)
  return label === '' ? null : { count: Math.round(raw.count), label, text: text(raw.text) }
}

/** `{ key, label, value }` rows a source adds for what the protocol has no field for. */
function metaOf(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map(row => (row !== null && typeof row === 'object' ? { key: text(row.key), label: text(row.label), value: text(row.value) } : null))
    .filter(row => row !== null && row.label !== '' && row.value !== '')
    .slice(0, MAX_META)
}

/** The optional descriptive fields a search hit and an info document share. */
function factsOf(raw) {
  return {
    cover: COVER_URL.test(text(raw.cover)) ? text(raw.cover) : null,
    popularity: popularityOf(raw.popularity),
    status: STATUSES.has(text(raw.status)) ? text(raw.status) : '',
    tags: Array.isArray(raw.tags) ? raw.tags.map(text).filter(Boolean).slice(0, MAX_TAGS) : [],
    latest: text(raw.latest),
    meta: metaOf(raw.meta),
    year: YEAR(raw.year),
    language: text(raw.language).slice(0, 35),
    publisher: text(raw.publisher),
    origin: text(raw.origin),
    formats: formatsOf(raw.formats),
    bytes: countOrNull(raw.bytes),
  }
}

/** One search hit as the panel shows it, or null when it is not a usable work. */
function resultOf(raw, kindIds) {
  if (raw === null || typeof raw !== 'object') return null
  const id = text(raw.id)
  const kind = text(raw.kind)
  if (!ID.test(id) || (kindIds !== null && !kindIds.has(kind))) return null
  return { id, title: text(raw.title), kind, author: text(raw.author), score: numberOrNull(raw.score), blurb: text(raw.blurb).replace(/\s+/g, ' '), episodes: countOrNull(raw.episode_count), ...factsOf(raw) }
}

/** The `search` document into results; hits of kinds the source did not declare are dropped. */
export function parseSearch(document, kinds) {
  if (!Array.isArray(document?.results)) throw sourceError('source_failed', 'the search answer has no results list')
  const kindIds = new Set(kinds.map(kind => kind.id))
  return document.results.map(raw => resultOf(raw, kindIds)).filter(result => result !== null)
}

/** Where the next page of results starts, when the source says: a whole number past this page's start. */
export function nextOffset(document, offset = 0) {
  return Number.isInteger(document?.next) && document.next > offset ? document.next : null
}

/** The `info` document into one result; `episodes` is how many the work lists, `episodeTitles` their titles in order, `related` its other seasons and linked works. */
export function parseInfo(document) {
  const id = text(document?.id)
  if (!ID.test(id)) throw sourceError('source_failed', 'the source returned no work')
  const listed = Array.isArray(document.episodes) ? document.episodes.length : 0
  const related = (Array.isArray(document.related) ? document.related : [])
    .map(raw => { const work = resultOf(raw, null); return work === null ? null : { ...work, relation: text(raw.relation) } })
    .filter(work => work !== null && work.id !== id)
    .slice(0, MAX_RELATED)
  const episodeTitles = Array.isArray(document.episodes) ? document.episodes.map(episode => text(episode?.title)) : []
  return { ...resultOf(document, null), id, episodes: listed > 0 ? listed : null, episodeTitles, related }
}

/** Whether `command` names an executable file, on the PATH or by path. */
export async function commandExists(command, path = process.env.PATH ?? '') {
  const candidates = isAbsolute(command) ? [command] : path.split(delimiter).filter(Boolean).map(dir => join(dir, command))
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK)
      return true
    } catch {
      // Not in this folder.
    }
  }
  return false
}

function sha256Of(path) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(path).on('data', chunk => hash.update(chunk)).on('error', reject).on('end', () => resolve(hash.digest('hex')))
  })
}

/**
 * Run the command in its own process group, so a cancel stops the whole
 * chain (a launcher, an interpreter, ffmpeg).
 */
function run(argv, { signal, timeoutMs, onStdoutLine, cwd, env } = {}) {
  return new Promise((resolve, reject) => {
    const [command, ...args] = argv
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], detached: true, cwd, env: { ...process.env, ...env } })
    let stdout = ''
    let stderr = ''
    let pending = ''
    let oversized = false
    const stop = () => { try { process.kill(-child.pid, 'SIGTERM') } catch { /* already gone */ } }
    const timer = timeoutMs ? setTimeout(stop, timeoutMs) : null
    signal?.addEventListener('abort', stop, { once: true })
    child.stdout.on('data', (chunk) => {
      if (onStdoutLine === undefined) {
        stdout += chunk
        if (stdout.length > MAX_OUTPUT) { oversized = true; stop() }
        return
      }
      pending += chunk
      const lines = pending.split('\n')
      pending = lines.pop()
      for (const line of lines) onStdoutLine(line)
    })
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-8000) })
    child.on('error', (error) => {
      if (timer) clearTimeout(timer)
      reject(error.code === 'ENOENT' ? sourceError('unavailable', `${command} is not installed`) : error)
    })
    child.on('close', (code) => {
      if (timer) clearTimeout(timer)
      signal?.removeEventListener('abort', stop)
      if (onStdoutLine !== undefined && pending.trim() !== '') onStdoutLine(pending)
      resolve({ code, stdout, stderr, oversized })
    })
  })
}

/** One stdout line as a JSON object, or null for anything else (a command may print other text). */
function parseLine(line) {
  try {
    const event = JSON.parse(line)
    return event !== null && typeof event === 'object' ? event : null
  } catch {
    return null
  }
}

/**
 * A file the command reports as done must be in the folder with the size and
 * sha256 it said; one that is not is removed, so the next run fetches it again.
 * @returns {Promise<{ ok: boolean, name: string }>}
 */
async function verify(dir, event, label, logger) {
  const name = typeof event.name === 'string' ? event.name : ''
  if (name === '' || basename(name) !== name || name.startsWith('.')) return { ok: false, name }
  const path = join(dir, name)
  try {
    const intact = (await stat(path)).size === event.bytes && (typeof event.sha256 !== 'string' || await sha256Of(path) === event.sha256)
    if (intact) return { ok: true, name }
    await rm(path, { force: true })
    logger.warn('%s: %s does not match what the command reported; removed', label, name)
  } catch (error) {
    if (error.code !== 'ENOENT') logger.warn('%s: could not check %s: %s', label, name, error.message)
    else logger.warn('%s: %s was reported done but is not there', label, name)
  }
  return { ok: false, name }
}

const lastLine = text => text.trim().split('\n').filter(Boolean).pop() ?? ''

/** The search filters a source can be asked for, by config name, and the flags they become. */
export const FILTERS = Object.freeze(['language', 'format', 'year'])

/** Search flags for the filters this source said it understands; the hub filters the answer itself as well. */
export function filterArgs({ language = '', format = '', yearFrom = null, yearTo = null } = {}, understood = []) {
  const args = []
  if (understood.includes('language') && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/.test(language)) args.push('--language', language)
  if (understood.includes('format') && FORMAT.test(format)) args.push('--format', format)
  if (understood.includes('year')) {
    if (YEAR(yearFrom) !== null) args.push('--year-from', String(yearFrom))
    if (YEAR(yearTo) !== null) args.push('--year-to', String(yearTo))
  }
  return args
}

/**
 * @param {{ id: string, label: string, kinds: { id: string, label: string }[], command: string[], env?: Record<string, string> }} definition
 * @param {{ logger: { warn: Function }, cwd: string }} options - cwd: where the command runs (`<stateDir>/<id>`), so a file it writes into its working folder never lands in DSH's own
 * @returns {import('./index.js').Source}
 */
export function createCommandSource(definition, { logger, cwd }) {
  const { id: sourceId, label, kinds, command, env = {}, filters: understood = [] } = definition
  const kindIds = new Set(kinds.map(kind => kind.id))
  // Messages for logs and errors use one plain name; the page picks the viewer's language from `label` itself.
  const name = () => (typeof label === 'string' ? label : (label?.en ?? Object.values(label ?? {})[0])) || sourceId

  async function workDir() {
    await mkdir(cwd, { recursive: true })
    return cwd
  }

  async function query(args) {
    const { code, stdout, stderr, oversized } = await run([...command, ...args], { timeoutMs: QUERY_TIMEOUT_MS, cwd: await workDir(), env })
    if (oversized) throw sourceError('source_failed', `${name()}: the answer is too large`)
    if (code !== 0) throw sourceError('source_failed', `${name()}: ${lastLine(stderr) || `exit ${code}`}`)
    try {
      return JSON.parse(stdout)
    } catch {
      throw sourceError('source_failed', `${name()}: the answer is not JSON`)
    }
  }

  return {
    id: sourceId,
    label: label || sourceId,
    kinds,
    filters: understood,
    available: () => commandExists(command[0]),

    /** @returns {{ results: object[], next: number | null }} `next` is the offset of the following page when the source offers one. */
    async search(textQuery, { kind = kinds[0]?.id, limit = SEARCH_LIMIT, offset = 0, filters = {} } = {}) {
      if (!kindIds.has(kind)) throw sourceError('invalid', `${name()} has no kind ${kind}`)
      const q = String(textQuery ?? '').trim()
      if (q === '') return { results: [], next: null }
      const paging = offset > 0 ? ['--offset', String(offset)] : []
      const document = await query(['search', '--kind', kind, '--limit', String(limit), ...paging, ...filterArgs(filters, understood), '--json', '--', q])
      // A search is for one kind; a hit of another kind belongs to that kind's own search.
      return { results: parseSearch(document, kinds).filter(result => result.kind === kind), next: nextOffset(document, offset) }
    },

    async info(id) {
      if (!ID.test(String(id))) throw sourceError('invalid', `not a ${name()} id`)
      return parseInfo(await query(['info', '--json', '--', String(id)]))
    },

    /** Fetch a cover image into `file` through the command, which keeps its own network policy. Rejects when the command has no `cover` verb or cannot fetch it. */
    async cover(url, file) {
      if (!COVER_URL.test(String(url))) throw sourceError('invalid', 'not a cover url')
      const { code, stderr } = await run([...command, 'cover', '--output', file, '--', String(url)], { timeoutMs: COVER_TIMEOUT_MS, cwd: await workDir(), env })
      if (code !== 0) throw sourceError('source_failed', `${name()}: ${lastLine(stderr) || `exit ${code}`}`)
    },

    async download({ id, dir, from = 1, to = null, signal, onEpisode, onStart }) {
      if (!ID.test(String(id))) throw sourceError('invalid', `not a ${name()} id`)
      const failed = []
      let result = null
      let checking = Promise.resolve()
      const episodes = to === null ? `${from}-` : from === to ? String(from) : `${from}-${to}`
      const onLine = (line) => {
        const event = parseLine(line)
        if (event?.event === 'start' && Number.isInteger(event.number)) {
          onStart?.(event.number)
          onEpisode?.()
        } else if (event?.event === 'done') {
          // Each finished file is checked against the size and hash the command reports, in order as they come.
          checking = checking.then(() => verify(dir, event, name(), logger)).then((file) => {
            if (file.ok) onEpisode?.()
            else failed.push(file.name)
          })
        } else if (event?.event === 'failed' && typeof event.name === 'string') failed.push(event.name)
        else if (event?.event === 'result') result = event
      }
      const argv = [...command, 'download', `--id=${String(id)}`, '--episodes', episodes, '--output', dir, '--json']
      const { code, stderr } = await run(argv, { signal, cwd: await workDir(), env, onStdoutLine: onLine })
      await checking
      onEpisode?.()
      if (signal?.aborted) return { failed }
      if (code !== 0 && failed.length === 0) {
        logger.warn('%s download %s ended with %s: %s', name(), id, code, lastLine(stderr))
        throw sourceError('source_failed', `${name()}: ${lastLine(stderr) || `exit ${code}`}`)
      }
      if (code === 0 && result === null) throw sourceError('source_failed', `${name()}: the download ended without a result`)
      return { failed }
    },

    /**
     * Download one work of a book kind as one file in `format` into `dir`.
     * @returns {Promise<{ name: string, bytes: number, sha256: string }>} the file, checked against what the command reported
     */
    async downloadFile({ id, format, dir, signal }) {
      if (!ID.test(String(id))) throw sourceError('invalid', `not a ${name()} id`)
      if (!FORMAT.test(String(format))) throw sourceError('invalid', `not a format: ${format}`)
      await mkdir(dir, { recursive: true })
      const reported = []
      let result = null
      const onLine = (line) => {
        const event = parseLine(line)
        if (event?.event === 'done') reported.push(event)
        else if (event?.event === 'result') result = event
      }
      const argv = [...command, 'download', `--id=${String(id)}`, '--format', String(format), '--output', dir, '--json']
      const { code, stderr } = await run(argv, { signal, cwd: await workDir(), env, onStdoutLine: onLine })
      if (signal?.aborted) throw sourceError('cancelled', `${name()}: cancelled`)
      if (code !== 0) throw sourceError('source_failed', `${name()}: ${lastLine(stderr) || `exit ${code}`}`)
      if (result === null || reported.length === 0) throw sourceError('source_failed', `${name()}: the download ended without a file`)
      const event = reported[reported.length - 1]
      const file = await verify(dir, event, name(), logger)
      if (!file.ok) throw sourceError('source_failed', `${name()}: the file did not arrive whole`)
      return { name: file.name, bytes: event.bytes, sha256: typeof event.sha256 === 'string' ? event.sha256 : await sha256Of(join(dir, file.name)) }
    },
  }
}
