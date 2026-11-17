/**
 * Extras a person's points pay for (docs/points-protocol.md). Watching stays free; a points extension, when one is
 * set, can price two extras for the people it keeps points for:
 *
 * - a new series: a series (more than one episode) the hub has never had, neither in the library nor in the watch
 *   log. Going on with a series, a rewatch, a film or a single video is never an extra;
 * - a binge night: starting to watch late at night (`night.from` to `night.to`, the host's clock). One ticket covers
 *   every start until `night.to`; a room already playing is never stopped.
 *
 * The extension keeps the shop, the tickets and who plays: the hub registers its two items with default prices,
 * asks whether the person holds a ticket at the moment of the action, buys one only when the page says yes, and
 * records each use. A person the extension doesn't know answers `recorded: false` and sees no change.
 */
import { run as runProcess } from './sources/process.js'

export const EXTRAS = Object.freeze({
  newSeries: Object.freeze({ key: 'media:new_series', name: 'Start a new series', cost: 30,
    about: 'Begin watching a series that is new to the library; going on with one stays free' }),
  bingeNight: Object.freeze({ key: 'media:binge_night', name: 'Binge night', cost: 40, uses: 0,
    about: 'Start watching late at night, as often as you like, until morning' }),
})

const CLOCK = /^([01]?\d|2[0-3]):([0-5]\d)$/
const minutes = text => { const [, h, m] = CLOCK.exec(text); return Number(h) * 60 + Number(m) }

/** Whether `date` (the host's clock) falls in the night window `{ from, to }`, which may run past midnight. */
export function inNight(night, date) {
  const now = date.getHours() * 60 + date.getMinutes()
  const from = minutes(night.from)
  const to = minutes(night.to)
  return from <= to ? now >= from && now < to : now >= from || now < to
}

/** The local date a night belongs to (the evening it started), as YYYY-MM-DD: one binge ticket per night. */
export function nightOf(night, date) {
  const evening = new Date(date)
  if (minutes(night.from) > minutes(night.to) && date.getHours() * 60 + date.getMinutes() < minutes(night.to)) evening.setDate(evening.getDate() - 1)
  const pad = n => String(n).padStart(2, '0')
  return `${evening.getFullYear()}-${pad(evening.getMonth() + 1)}-${pad(evening.getDate())}`
}

const pointsError = (need) => Object.assign(new Error(`${need.name} costs ${need.cost} points`), { code: 'points', status: 402, points: need })

/**
 * @param {{ command: string[], env?: object, night: { from: string, to: string } }} config
 * @param {{ logger: { warn: Function }, now?: () => number, run?: Function }} options
 */
export function createPoints(config, { logger, now = Date.now, run = runProcess }) {
  const enabled = config.command.length > 0
  const registered = new Set()

  async function ask(args) {
    const { code, stdout, stderr } = await run([...config.command, ...args, '--json'], { timeoutMs: 20000, env: config.env })
    const line = stdout.trim().split('\n').filter(Boolean).pop() ?? ''
    if (code !== 0) throw Object.assign(new Error(`points extension failed: ${stderr.trim().split('\n').pop() ?? code}`), { code: 'unavailable' })
    return JSON.parse(line)
  }

  /** The item's terms as the extension's options; the binge ticket lasts to the night's end. */
  function itemArgs(extra) {
    const args = ['--name', extra.name, '--cost', String(extra.cost), '--about', extra.about]
    if (extra.uses !== undefined) args.push('--uses', String(extra.uses))
    if (extra === EXTRAS.bingeNight) args.push('--until', config.night.to)
    return args
  }

  async function register(person) {
    if (registered.has(person)) return true
    for (const extra of Object.values(EXTRAS)) {
      const answer = await ask(['shop', person, 'register', extra.key, ...itemArgs(extra)])
      if (answer.recorded === false) return false
    }
    registered.add(person)
    return true
  }

  return {
    enabled,
    /** Which extras an action needs now: `isNew` for a new series, `starts` when it starts watching. */
    wants({ isNew = false, starts = false }) {
      if (!enabled) return []
      return [...(isNew ? [EXTRAS.newSeries] : []), ...(starts && inNight(config.night, new Date(now())) ? [EXTRAS.bingeNight] : [])]
    },
    /** A purchase's source, the same on a retry: one per series, one binge ticket per night. */
    sourceOf(extra, subject) {
      return extra === EXTRAS.bingeNight ? `media:binge:${nightOf(config.night, new Date(now()))}` : `media:series:${subject}`
    },
    /**
     * Make sure `person` holds a ticket for every extra in `wants`, buying the ones named in `buy`. Throws a
     * `points` error (402) with the first missing one: item, name, cost, balance, gap, affordable, pending.
     * Returns the tickets to use once the action went through.
     */
    async pay(person, wants, { buy = [], subject = '' } = {}) {
      if (!enabled || wants.length === 0 || !person) return []
      try {
        if (!(await register(person))) return []
        const tickets = []
        for (const extra of wants) {
          const source = this.sourceOf(extra, subject)
          let answer = await ask(['check', person, extra.key])
          if (answer.recorded === false) return []
          if (!answer.valid && buy.includes(extra.key) && answer.quote.affordable) {
            await ask(['buy', person, extra.key, '--source', source])
            answer = await ask(['check', person, extra.key])
          }
          if (!answer.valid) {
            const q = answer.quote
            throw pointsError({ item: extra.key, name: q.name, cost: q.cost, balance: q.balance, gap: q.gap, affordable: q.affordable, pending: answer.pending })
          }
          tickets.push({ extra, ticket: answer.ticket.id })
        }
        return tickets
      } catch (error) {
        if (error.code === 'points') throw error
        // An extension that fails never stops anyone watching: the action goes through, the log says why.
        logger.warn('points: %s', error.message)
        return []
      }
    },
    /** Record each ticket's use for the action that went through: a series once, a binge ticket per room opened. */
    async use(person, tickets, { room, subject = '' }) {
      for (const { extra, ticket } of tickets) {
        const on = extra === EXTRAS.bingeNight ? `media:start:${room ?? subject}` : `media:series:${subject}`
        await ask(['use', person, ticket, '--source', on]).catch(error => logger.warn('points: %s', error.message))
      }
    },
  }
}
