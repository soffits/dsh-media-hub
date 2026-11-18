/**
 * Extras a person's points pay for. Watching stays free; with the points plugin (@soffits/dsh-points) installed,
 * two extras cost points for the people it plays with:
 *
 * - a new series: a series (more than one episode) the hub has never had, neither in the library nor in the watch
 *   log. Going on with a series, a rewatch, a film or a single video is never an extra;
 * - a binge night: starting to watch late at night (`night.from` to `night.to`, the host's clock). One ticket covers
 *   every start until `night.to`; a room already playing is never stopped.
 *
 * The points plugin keeps the shop, the tickets, the ledger and the dialog. The hub only says which action is an
 * extra, asks the plugin's `points` service for a ticket at that moment (which answers 402 with `{ item, source }`
 * for the page to offer), and records each use. Item names and descriptions come from the hub's locale files.
 */

export const EXTRAS = Object.freeze({
  newSeries: Object.freeze({ key: 'media:new_series', cost: 30, words: 'points.newSeries' }),
  bingeNight: Object.freeze({ key: 'media:binge_night', cost: 40, uses: 0, words: 'points.bingeNight' }),
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

/** `{ tag: text }` for one key of the locale tables, every language that has it. */
const wordsOf = (locales, key) => Object.fromEntries(Object.entries(locales).filter(([, ui]) => typeof ui[key] === 'string').map(([tag, ui]) => [tag, ui[key]]))

/**
 * @param {{ points: () => object | undefined, night: { from: string, to: string }, locales: () => Promise<object>, now?: () => number }} options
 *   points: the points plugin's service right now, if installed; locales: the hub's words (src/locales.js)
 */
export function createExtras({ points, night, locales, now = Date.now }) {
  /** The extra as the points plugin's item: its key, default price, terms and words in every language. */
  async function itemOf(extra) {
    const words = await locales()
    return {
      key: extra.key,
      cost: extra.cost,
      name: wordsOf(words, extra.words),
      about: wordsOf(words, `${extra.words}About`),
      ...(extra.uses === undefined ? {} : { uses: extra.uses }),
      ...(extra === EXTRAS.bingeNight ? { until: night.to } : {}),
    }
  }

  return {
    /** Whether any extra can cost points now: the points plugin is installed and has a ledger. */
    get enabled() { return points()?.enabled === true },
    /** Which extras an action needs now: `isNew` for a new series, `starts` when it starts watching. */
    wants({ isNew = false, starts = false }) {
      if (!this.enabled) return []
      return [...(isNew ? [EXTRAS.newSeries] : []), ...(starts && inNight(night, new Date(now())) ? [EXTRAS.bingeNight] : [])]
    },
    /** A purchase's source, the same on a retry: one per series, one binge ticket per night. */
    sourceOf(extra, subject) {
      return extra === EXTRAS.bingeNight ? `media:binge:${nightOf(night, new Date(now()))}` : `media:series:${subject}`
    },
    /**
     * The tickets `person` holds for every extra in `wants`, asked of the points plugin. Throws its `points` error
     * (402, `points: { item, source }`) for the first one missing; the page offers it and asks again.
     */
    async pay(person, wants, { subject = '' } = {}) {
      const service = points()
      if (service === undefined || wants.length === 0) return []
      const tickets = []
      for (const extra of wants) {
        const ticket = await service.ticketFor(person, await itemOf(extra), { source: this.sourceOf(extra, subject) })
        if (ticket !== null) tickets.push({ extra, ticket })
      }
      return tickets
    },
    /** Record each ticket's use for the action that went through: a series once, a binge ticket per room opened. */
    async use(person, tickets, { room, subject = '' }) {
      const service = points()
      if (service === undefined) return
      for (const { extra, ticket } of tickets) {
        await service.use(person, ticket, extra === EXTRAS.bingeNight ? `media:start:${room ?? subject}` : `media:series:${subject}`)
      }
    },
  }
}
