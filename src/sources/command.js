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
 *   <command> danmaku --episodes <n> --json -- <id>                    (kinds with `danmaku`)
 *   <command> comments --limit <n> [--cursor <c>] --json -- <id>       (kinds with `comments`)
 *
 * search and info print one JSON document on stdout; download prints one
 * JSON object per line (events) and a last `result`. stderr is free text for
 * people; its last line is the error message when a command fails.
 * Whatever network policy the command's own launcher enforces (a proxy it
 * requires, for example) holds for the source, since nothing here talks to
 * the site.
 */
import { mkdir, rm, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { codedError } from '../errors.js'
import { BASE, pick } from '../i18n.js'
import { heightChoices, isHeight } from '../quality.js'
import { sha256Of } from '../sha256.js'
import { commandExists, lastLine, parseLine, run } from './process.js'

const SEARCH_LIMIT = 12
const TRENDING_LIMIT = 20
const QUERY_TIMEOUT_MS = 60_000
const COVER_TIMEOUT_MS = 30_000
const ID = /^[^\s\0]{1,200}$/

const text = value => (typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '')
const numberOrNull = value => (Number.isFinite(value) ? value : null)

const STATUSES = new Set(['finished', 'ongoing', 'stopped'])
/** A web address a source may name: a cover picture, the work's page. */
const WEB_URL = /^https?:\/\/[^\s]{1,2000}$/
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
    cover: WEB_URL.test(text(raw.cover)) ? text(raw.cover) : null,
    url: WEB_URL.test(text(raw.url)) ? text(raw.url) : null,
    duration: Number.isFinite(raw.duration) && raw.duration > 0 ? Math.round(raw.duration) : null,
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
export function resultOf(raw, kindIds) {
  if (raw === null || typeof raw !== 'object') return null
  const id = text(raw.id)
  const kind = text(raw.kind)
  if (!ID.test(id) || (kindIds !== null && !kindIds.has(kind))) return null
  return { id, title: text(raw.title), kind, author: text(raw.author), score: numberOrNull(raw.score), blurb: text(raw.blurb).replace(/\s+/g, ' '), episodes: countOrNull(raw.episode_count), ...factsOf(raw) }
}

/** The `search` document into results; hits of kinds the source did not declare are dropped. */
export function parseSearch(document, kinds) {
  if (!Array.isArray(document?.results)) throw codedError('source_failed', 'the search answer has no results list')
  const kindIds = new Set(kinds.map(kind => kind.id))
  return document.results.map(raw => resultOf(raw, kindIds)).filter(result => result !== null)
}

const MAX_LISTS = 6

/** A label the source gives: a string, or { <language tag>: text }; null when there is none. */
function labelOf(value) {
  if (typeof value === 'string' && value.trim() !== '') return value.trim()
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value).filter(([tag, words]) => typeof tag === 'string' && typeof words === 'string' && words.trim() !== '')
    if (entries.length > 0) return Object.fromEntries(entries.map(([tag, words]) => [tag, words.trim()]))
  }
  return null
}

/**
 * The `trending` document into lists `{ id, label, results }` of one kind: `lists`, or a single list as `results`
 * (label null: the page says "Trending"). A list without usable works is left out.
 */
export function parseTrending(document, kinds, kind) {
  const kindIds = new Set(kinds.map(entry => entry.id))
  const raw = Array.isArray(document?.lists) ? document.lists : (Array.isArray(document?.results) ? [{ id: 'trending', results: document.results }] : null)
  if (raw === null) throw codedError('source_failed', 'the trending answer has no lists')
  const seen = new Set()
  return raw.slice(0, MAX_LISTS).flatMap((list, index) => {
    const results = Array.isArray(list?.results) ? list.results.map(item => resultOf(item, kindIds)).filter(result => result !== null && result.kind === kind) : []
    const id = text(list?.id) || `list-${index + 1}`
    if (results.length === 0 || seen.has(id)) return []
    seen.add(id)
    return [{ id, label: labelOf(list?.label), results }]
  })
}

/** Where the next page of results starts, when the source says: a whole number past this page's start. */
export function nextOffset(document, offset = 0) {
  return Number.isInteger(document?.next) && document.next > offset ? document.next : null
}

/**
 * The `info` document into one result; `episodes` is how many the work lists, `episodeTitles` their titles in order,
 * `related` its other seasons and linked works, `qualities` the choices its listed heights give (none for one height).
 */
export function parseInfo(document) {
  const id = text(document?.id)
  if (!ID.test(id)) throw codedError('source_failed', 'the source returned no work')
  const listed = Array.isArray(document.episodes) ? document.episodes.length : 0
  const related = (Array.isArray(document.related) ? document.related : [])
    .map(raw => { const work = resultOf(raw, null); return work === null ? null : { ...work, relation: text(raw.relation) } })
    .filter(work => work !== null && work.id !== id)
    .slice(0, MAX_RELATED)
  const episodeTitles = Array.isArray(document.episodes) ? document.episodes.map(episode => text(episode?.title)) : []
  return { ...resultOf(document, null), id, episodes: listed > 0 ? listed : null, episodeTitles, related, qualities: heightChoices(document.qualities) }
}

const MAX_DANMAKU = 5000
const MAX_DANMAKU_TEXT = 100
const MAX_COMMENT_TEXT = 4000
const MAX_CURSOR = 2000
export const COMMENTS_PAGE = 20

/** A count a source gives, or 0. */
const count = value => (Number.isInteger(value) && value >= 0 ? value : 0)

/** The `danmaku` answer (one JSON object per line, one line per episode) into episode `number`'s items `{ time, text, likes }`, in time order. */
export function parseDanmaku(lines, number) {
  const found = lines.find(line => line?.episode === number) ?? (lines.length === 1 ? lines[0] : null)
  if (!Array.isArray(found?.items)) throw codedError('source_failed', 'the danmaku answer has no items')
  return found.items
    .map(raw => ({ time: Number.isFinite(raw?.time) && raw.time >= 0 ? raw.time : null, text: text(raw?.text).replace(/\s+/g, ' ').slice(0, MAX_DANMAKU_TEXT), likes: count(raw?.likes) }))
    .filter(item => item.time !== null && item.text !== '')
    .sort((a, b) => a.time - b.time)
    .slice(0, MAX_DANMAKU)
}

const ISO_TIME = value => (typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null)

/** The `comments` document into `{ total, items, next }`: each comment `{ id, name, text, created, likes, replies, rating }`, `next` the cursor of the following page or null. */
export function parseComments(document) {
  if (!Array.isArray(document?.items)) throw codedError('source_failed', 'the comments answer has no items')
  const items = document.items
    .map(raw => ({
      id: text(raw?.id),
      name: text(raw?.user?.name ?? raw?.name),
      text: text(raw?.text).slice(0, MAX_COMMENT_TEXT),
      created: ISO_TIME(raw?.created),
      likes: count(raw?.likes),
      replies: count(raw?.replies),
      rating: Number.isFinite(raw?.rating) ? raw.rating : null,
    }))
    .filter(item => item.id !== '' && item.text !== '')
  const next = text(document.next_cursor ?? document.next)
  return { total: countOrNull(document.total), items, next: next !== '' && next.length <= MAX_CURSOR && items.length > 0 ? next : null }
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
  const name = () => pick(label, BASE) || sourceId

  async function workDir() {
    await mkdir(cwd, { recursive: true })
    return cwd
  }

  async function answer(args) {
    const { code, stdout, stderr, oversized } = await run([...command, ...args], { timeoutMs: QUERY_TIMEOUT_MS, cwd: await workDir(), env })
    if (oversized) throw codedError('source_failed', `${name()}: the answer is too large`)
    if (code !== 0) throw codedError('source_failed', `${name()}: ${lastLine(stderr) || `exit ${code}`}`)
    return stdout
  }

  async function query(args) {
    const stdout = await answer(args)
    try {
      return JSON.parse(stdout)
    } catch {
      throw codedError('source_failed', `${name()}: the answer is not JSON`)
    }
  }

  /** Whether a kind of this source declares an optional verb (`danmaku`, `comments`). */
  const offers = (kind, verb) => kinds.some(entry => entry.id === kind && entry[verb] === true)
  const checkId = (id) => {
    if (!ID.test(String(id))) throw codedError('invalid', `not a ${name()} id`)
  }

  return {
    id: sourceId,
    label: label ?? '',
    kinds,
    filters: understood,
    available: () => commandExists(command[0]),

    /** @returns {{ results: object[], next: number | null }} `next` is the offset of the following page when the source offers one. */
    async search(textQuery, { kind = kinds[0]?.id, limit = SEARCH_LIMIT, offset = 0, filters = {} } = {}) {
      if (!kindIds.has(kind)) throw codedError('invalid', `${name()} has no kind ${kind}`)
      const q = String(textQuery ?? '').trim()
      if (q === '') return { results: [], next: null }
      const paging = offset > 0 ? ['--offset', String(offset)] : []
      const document = await query(['search', '--kind', kind, '--limit', String(limit), ...paging, ...filterArgs(filters, understood), '--json', '--', q])
      // A search is for one kind; a hit of another kind belongs to that kind's own search.
      return { results: parseSearch(document, kinds).filter(result => result.kind === kind), next: nextOffset(document, offset) }
    },

    /** What the site itself puts forward for a kind that declares `trending`: lists of works, in the site's order. */
    async trending(kind, { limit = TRENDING_LIMIT } = {}) {
      if (!kinds.some(entry => entry.id === kind && entry.trending === true)) throw codedError('invalid', `${name()} has no trending list for ${kind}`)
      return parseTrending(await query(['trending', '--kind', kind, '--limit', String(limit), '--json']), kinds, kind)
    },

    async info(id) {
      if (!ID.test(String(id))) throw codedError('invalid', `not a ${name()} id`)
      return parseInfo(await query(['info', '--json', '--', String(id)]))
    },

    /** Fetch a cover image into `file` through the command, which keeps its own network policy. Rejects when the command has no `cover` verb or cannot fetch it. */
    async cover(url, file) {
      if (!WEB_URL.test(String(url))) throw codedError('invalid', 'not a cover url')
      const { code, stderr } = await run([...command, 'cover', '--output', file, '--', String(url)], { timeoutMs: COVER_TIMEOUT_MS, cwd: await workDir(), env })
      if (code !== 0) throw codedError('source_failed', `${name()}: ${lastLine(stderr) || `exit ${code}`}`)
    },

    offers,

    /** The danmaku of episode `number` of a work of a kind that declares `danmaku`: `[{ time, text, likes }]`. */
    async danmaku(id, number, kind) {
      checkId(id)
      if (!offers(kind, 'danmaku') || !Number.isInteger(number) || number < 1) throw codedError('invalid', `${name()} has no danmaku for this`)
      const lines = (await answer(['danmaku', '--episodes', String(number), '--json', '--', String(id)])).split('\n').map(parseLine).filter(line => line !== null)
      return parseDanmaku(lines, number)
    },

    /** A page of the comments on a work of a kind that declares `comments`; `cursor` continues where an earlier page's `next` left off. */
    async comments(id, kind, { cursor = '', limit = COMMENTS_PAGE } = {}) {
      checkId(id)
      if (!offers(kind, 'comments')) throw codedError('invalid', `${name()} has no comments for this`)
      const paging = cursor === '' ? [] : ['--cursor', String(cursor).slice(0, MAX_CURSOR)]
      return parseComments(await query(['comments', '--limit', String(limit), ...paging, '--json', '--', String(id)]))
    },

    async download({ id, dir, from = 1, to = null, quality = '', signal, onEpisode, onStart, onPartial }) {
      if (!ID.test(String(id))) throw codedError('invalid', `not a ${name()} id`)
      const failed = []
      let result = null
      let checking = Promise.resolve()
      /** Episodes whose files are handed over while they grow: settled when the episode is done or failed, or the run ends. */
      const growing = new Map()
      const settle = (number) => {
        growing.get(number)?.()
        growing.delete(number)
      }
      const episodes = to === null ? `${from}-` : from === to ? String(from) : `${from}-${to}`
      const onLine = (line) => {
        const event = parseLine(line)
        if (event?.event === 'start' && Number.isInteger(event.number)) {
          onStart?.(event.number)
          onEpisode?.()
        } else if (event?.event === 'partial' && Number.isInteger(event.number) && !growing.has(event.number)) {
          const names = Array.isArray(event.files) ? event.files.filter(file => typeof file === 'string' && file !== '' && basename(file) === file) : []
          if (names.length === 0) return
          const until = new Promise(done => growing.set(event.number, done))
          onPartial?.(event.number, { files: names.map(file => join(dir, file)), subtitles: [], growing: until })
        } else if (event?.event === 'done') {
          if (Number.isInteger(event.number)) settle(event.number)
          // Each finished file is checked against the size and hash the command reports, in order as they come.
          checking = checking.then(() => verify(dir, event, name(), logger)).then((file) => {
            if (file.ok) onEpisode?.()
            else failed.push(file.name)
          })
        } else if (event?.event === 'failed' && typeof event.name === 'string') {
          if (Number.isInteger(event.number)) settle(event.number)
          failed.push(event.name)
        }
        else if (event?.event === 'result') result = event
      }
      const argv = [...command, 'download', `--id=${String(id)}`, '--episodes', episodes, ...(isHeight(quality) ? ['--quality', String(quality)] : []), '--output', dir, '--json']
      const { code, stderr } = await run(argv, { signal, cwd: await workDir(), env, onStdoutLine: onLine })
      for (const number of [...growing.keys()]) settle(number)
      await checking
      onEpisode?.()
      if (signal?.aborted) return { failed }
      if (code !== 0 && failed.length === 0) {
        logger.warn('%s download %s ended with %s: %s', name(), id, code, lastLine(stderr))
        throw codedError('source_failed', `${name()}: ${lastLine(stderr) || `exit ${code}`}`)
      }
      if (code === 0 && result === null) throw codedError('source_failed', `${name()}: the download ended without a result`)
      return { failed }
    },

    /**
     * Download one work of a book kind as one file in `format` into `dir`.
     * @returns {Promise<{ name: string, bytes: number, sha256: string }>} the file, checked against what the command reported
     */
    async downloadFile({ id, format, dir, signal }) {
      if (!ID.test(String(id))) throw codedError('invalid', `not a ${name()} id`)
      if (!FORMAT.test(String(format))) throw codedError('invalid', `not a format: ${format}`)
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
      if (signal?.aborted) throw codedError('cancelled', `${name()}: cancelled`)
      if (code !== 0) throw codedError('source_failed', `${name()}: ${lastLine(stderr) || `exit ${code}`}`)
      if (result === null || reported.length === 0) throw codedError('source_failed', `${name()}: the download ended without a file`)
      const event = reported[reported.length - 1]
      const file = await verify(dir, event, name(), logger)
      if (!file.ok) throw codedError('source_failed', `${name()}: the file did not arrive whole`)
      return { name: file.name, bytes: event.bytes, sha256: typeof event.sha256 === 'string' ? event.sha256 : await sha256Of(join(dir, file.name)) }
    },
  }
}
