/**
 * What the page does for the person asking: exact Fetch routes under DSH's
 * `/api`, where a `requestIdentity` provider says who that is. A work is
 * looked up and fetched with that person's account for its site (the
 * `cookies` setting), and a room they open uses it for everyone in it.
 *
 *   GET  /api/media-hub/info?source=&id=[&language=]   a work's details, with the account its site would be read with
 *   POST /api/media-hub/fetch   { source, id, watch, together, all, quality, language, by }: into the library (the rolling cache's window, or the whole show with `all`), or watch now (`together`: open to others at once)
 *   POST /api/media-hub/rooms   { path, title, by, start }: open a room on a library show
 *   GET  /api/media-hub/ratings                { pending }: finished or removed shows to ask this person about
 *   POST /api/media-hub/ratings  { show, title, rating }: their answer, into the watch log
 *   GET  /api/media-hub/picks[?source=&kind=&language=]   { picks, loading }: the recommender's picks for this person, from the saved copy; narrowed to a source and kind for Discover
 *   POST /api/media-hub/steps    { path, id }: a show's suggested step was started
 *
 * `language` is the viewer's, for choosing subtitles.
 */
import { STATUS, errorBody } from './http.js'
import { personOf } from './people.js'

export const PERSON_PATH = '/api/media-hub'

export const HEADERS = Object.freeze({ 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' })

export const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...HEADERS, 'content-type': 'application/json; charset=utf-8' } })
export const failure = error => json(error?.status ?? STATUS[error?.code] ?? 500, errorBody(error))

/** A request's JSON body, an empty object for none. */
export async function body(request) {
  try {
    const value = await request.json()
    return value !== null && typeof value === 'object' ? value : {}
  } catch {
    throw Object.assign(new Error('request body is not JSON'), { status: 400 })
  }
}

const pick = (value, keys) => Object.fromEntries(keys.filter(key => value?.[key] !== undefined).map(key => [key, value[key]]))
const text = value => (typeof value === 'string' ? value : '')
/** The extras the person said yes to buying (src/points.js), by item key. */
const buying = value => (Array.isArray(value) ? value.filter(key => typeof key === 'string').slice(0, 4) : [])

/**
 * @param {{ hub: () => object | undefined, identity: () => object | undefined }} options
 *   hub: the running media hub; identity: the requestIdentity service right now, if any
 */
export function createPersonRoutes({ hub, identity }) {
  const handle = fn => async (request) => {
    const current = hub()
    if (current === undefined) return json(503, { error: { code: 'unavailable', message: 'The media hub is starting.' } })
    try {
      return json(200, await fn(request, current, personOf(identity())))
    } catch (error) {
      return failure(error)
    }
  }
  const param = (request, name) => new URL(request.url).searchParams.get(name) ?? ''

  return [
    {
      path: `${PERSON_PATH}/info`,
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: handle((request, current, person) => current.info(param(request, 'source'), param(request, 'id'), { person: person.id, language: param(request, 'language') })),
    },
    {
      path: `${PERSON_PATH}/fetch`,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: handle(async (request, current, person) => {
        const input = await body(request)
        return current.fetch({ ...pick(input, ['source', 'id', 'watch', 'together', 'all', 'quality', 'by']), language: text(input.language), person: person.id, buy: buying(input.buy) })
      }),
    },
    {
      path: `${PERSON_PATH}/rooms`,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: handle(async (request, current, person) => {
        const input = await body(request)
        return current.createRoom({ ...pick(input, ['path', 'title', 'by', 'start']), fromPanel: true, person: person.id, buy: buying(input.buy) })
      }),
    },
    {
      path: `${PERSON_PATH}/ratings`,
      methods: ['GET', 'POST'],
      requestBody: 'buffered',
      fetch: handle(async (request, current, person) => (request.method === 'GET'
        ? { pending: await current.pendingRatings(person) }
        : current.rate(await body(request), person))),
    },
    {
      path: `${PERSON_PATH}/picks`,
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: handle((request, current, person) => current.picks(person, { source: param(request, 'source'), kind: param(request, 'kind'), language: param(request, 'language') })),
    },
    {
      path: `${PERSON_PATH}/steps`,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: handle(async (request, current, person) => {
        const input = await body(request)
        return current.startStep(text(input.path), text(input.id), person)
      }),
    },
  ]
}
