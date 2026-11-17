/**
 * What the Watching tab offers beyond the library and the rooms, each one
 * switched in the `presence` setting:
 *
 *   ratings  "How was it?" for a show finished or removed lately, one tap into the watch log
 *   picks    works a recommender extension suggests, each with its reason (docs/recommender-protocol.md)
 *   recap    a summary without spoilers kept with a show, written from outside (the tool's `annotate`)
 *
 * and the suggested next steps kept with a show (also written through `annotate`), drawn by
 * @soffits/dsh-ui-actions. The parsing and choosing here is pure; createPicks runs the extension.
 */
import { run } from './sources/process.js'

/** The answers to "How was it?", in the order the page offers them. */
export const RATINGS = Object.freeze(['loved', 'fine', 'not-for-me', 'unfinished'])

/** A show is asked about for this long after it was finished or removed. */
export const RATE_WITHIN_DAYS = 14
/** At most this many questions at once. */
export const MAX_PENDING = 3

export const MAX_RECAP_CHARS = 1200
export const MAX_STEPS = 3
const STEP_ID = /^[a-z0-9][a-z0-9_-]{0,31}$/
const MAX_LABEL_CHARS = 120
const MAX_PROMPT_CHARS = 2000

export const PICKS_LIMIT = 6
const PICKS_TIMEOUT_MS = 60_000
const MAX_WHY_CHARS = 280

const badInput = message => Object.assign(new Error(message), { code: 'invalid_arguments' })

/**
 * Which finished or removed shows to ask this person about, newest first: library shows watched to the end and
 * `library.deleted` lines of the watch log within `days`, without a `rating` line of theirs for that show.
 * @param {{ shows: object[], events: object[], person: string, now: number, days?: number, limit?: number }} input
 * @returns {{ show: string, title: string, why: 'finished' | 'removed', at: number }[]}
 */
export function pendingRatings({ shows, events, person, now, days = RATE_WITHIN_DAYS, limit = MAX_PENDING }) {
  const since = now - days * 86_400_000
  const rated = new Set(events.filter(event => event.type === 'rating' && event.person === person).map(event => event.show))
  const asks = new Map()
  const offer = (show, title, why, at) => {
    if (typeof show !== 'string' || rated.has(show) || !(at >= since) || !(at <= now)) return
    const known = asks.get(show)
    if (known === undefined || known.at < at) asks.set(show, { show, title, why, at })
  }
  for (const show of shows) if (show.watchedAt) offer(show.path, show.work?.title ?? show.name, 'finished', show.watchedAt)
  for (const event of events) if (event.type === 'library.deleted') offer(event.show, event.title, 'removed', Date.parse(event.at))
  // A show removed and then fetched again is asked about as it is now.
  const present = new Set(shows.map(show => show.path))
  return [...asks.values()]
    .filter(ask => ask.why === 'finished' || !present.has(ask.show))
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
}

/** The rating line for the watch log, or an error naming what is wrong. */
export function ratingLine({ show, title, rating }, person) {
  if (!RATINGS.includes(rating)) throw badInput(`rating must be one of ${RATINGS.join(', ')}`)
  if (typeof show !== 'string' || show === '') throw badInput('rating needs the show')
  return { show, title: typeof title === 'string' ? title.slice(0, 200) : '', rating, person: person.key, by: person.name }
}

const textOrPerLanguage = (value, max) => {
  if (typeof value === 'string' && value.trim() !== '') return value.trim().slice(0, max)
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value).filter(([tag, text]) => /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(tag) && typeof text === 'string' && text.trim() !== '')
    if (entries.length > 0) return Object.fromEntries(entries.map(([tag, text]) => [tag, text.trim().slice(0, max)]))
  }
  return null
}

/**
 * What the outside writes about a show, checked: `recap` ({ text, upTo }: a summary of episodes 1 to upTo, shown
 * only to viewers past them) and `steps` (at most three suggested next steps, each { id?, label, prompt? }, label
 * and prompt a text or { <tag>: text }). A field left out stays as it is; null clears it.
 * @returns {{ recap?: object | null, steps?: object[] | null }}
 */
export function parseAnnotation({ recap, steps } = {}) {
  const out = {}
  if (recap === null) out.recap = null
  else if (recap !== undefined) {
    if (typeof recap?.text !== 'string' || recap.text.trim() === '') throw badInput('recap needs text')
    if (!Number.isInteger(recap.upTo) || recap.upTo < 1) throw badInput('recap needs upTo, the last episode it covers (1 or more)')
    out.recap = { text: recap.text.trim().slice(0, MAX_RECAP_CHARS), upTo: recap.upTo }
  }
  if (steps === null) out.steps = null
  else if (steps !== undefined) {
    if (!Array.isArray(steps) || steps.length > MAX_STEPS) throw badInput(`steps is a list of at most ${MAX_STEPS}`)
    out.steps = steps.map((step, n) => {
      const id = step?.id ?? `step-${n + 1}`
      if (typeof id !== 'string' || !STEP_ID.test(id)) throw badInput('a step id is lowercase letters, digits, - and _')
      const label = textOrPerLanguage(step?.label, MAX_LABEL_CHARS)
      if (label === null) throw badInput('a step needs a label that says the step')
      const prompt = textOrPerLanguage(step?.prompt, MAX_PROMPT_CHARS)
      return { kind: 'step', id, label, ...(prompt === null ? {} : { payload: { prompt } }) }
    })
    if (new Set(out.steps.map(step => step.id)).size !== out.steps.length) throw badInput('step ids repeat')
    if (out.steps.length === 0) out.steps = null
  }
  return out
}

/** A recap only for those past what it covers: `through` is how many episodes the show's viewers are past. */
export const safeRecap = (recap, through) => (recap && recap.upTo <= through ? recap : null)

/**
 * The picks a recommender answered, checked: only works of a configured source (so they can be watched and
 * followed), each with its reason.
 * @param {object} document - `{ picks: [{ work: { source, id, title, kind?, year?, score?, scoreLabel?, cover?, url? }, why }] }`
 * @param {(id: string) => boolean} hasSource
 */
export function parsePicks(document, hasSource, limit = PICKS_LIMIT) {
  if (!Array.isArray(document?.picks)) throw new Error('the recommender answered without a picks list')
  const out = []
  const seen = new Set()
  for (const pick of document.picks) {
    const work = pick?.work
    const why = typeof pick?.why === 'string' ? pick.why.trim().slice(0, MAX_WHY_CHARS) : ''
    if (typeof work?.source !== 'string' || !hasSource(work.source) || typeof work.id !== 'string' || work.id === '' || typeof work.title !== 'string' || why === '') continue
    const key = `${work.source}\0${work.id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      work: {
        source: work.source,
        id: work.id,
        title: work.title.slice(0, 200),
        kind: typeof work.kind === 'string' ? work.kind : null,
        year: Number.isInteger(work.year) ? work.year : null,
        score: Number.isFinite(work.score) ? work.score : null,
        scoreLabel: typeof work.scoreLabel === 'string' ? work.scoreLabel.slice(0, 40) : '',
        cover: typeof work.cover === 'string' ? work.cover : null,
        url: typeof work.url === 'string' ? work.url : null,
      },
      why,
    })
    if (out.length >= limit) break
  }
  return out
}

/**
 * Picks from the configured recommender command, asked at most once per `refreshMs` per person; a failure
 * is logged and shows no picks until the next try.
 * @param {{ command: string[], env?: object, cwd?: string, hasSource: (id: string) => boolean, decorate: (pick: object) => object, logger: object, now?: () => number, refreshMs?: number }} options
 */
export function createPicks({ command, env = {}, cwd, hasSource, decorate, logger, now = Date.now, refreshMs = 6 * 3_600_000 }) {
  const cached = new Map()
  async function ask(person) {
    const argv = [...command, 'recommend', '--json', '--limit', String(PICKS_LIMIT), ...(person.id ? ['--person', person.id] : [])]
    const result = await run(argv, { timeoutMs: PICKS_TIMEOUT_MS, cwd, env })
    if (result.code !== 0) throw new Error(`exit ${result.code}: ${result.stderr.trim().split('\n').pop() ?? ''}`)
    return parsePicks(JSON.parse(result.stdout), hasSource).map(decorate)
  }
  return {
    enabled: command.length > 0,
    /** @param {{ key: string, id: string }} person */
    async list(person) {
      if (command.length === 0) return []
      const entry = cached.get(person.key)
      if (entry && now() - entry.at < refreshMs) return entry.picks
      const picks = await ask(person).catch((error) => {
        logger.warn('the recommender gave no picks: %s', error.message)
        return []
      })
      cached.set(person.key, { at: now(), picks })
      return picks
    },
  }
}
