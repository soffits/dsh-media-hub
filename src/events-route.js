/**
 * `GET /api/media-hub/events`: a Server-Sent Events stream with one notice,
 * `{ "type": "change", "what": ["library", ...] }`, whenever something a page
 * shows changed (the hub's notices). A Fetch route under DSH's `/api`, so DSH
 * admits the browser first, like the shelf's.
 */
import { json } from './person-routes.js'

export const EVENTS_PATH = '/api/media-hub/events'

/**
 * @param {{ hub: () => { listenChanges: Function } | undefined, streams: ReturnType<import('@soffits/dsh-host-kit').createEventStreams> }} options
 *   streams: the open event streams, ended when the plugin unloads
 */
export function createEventsRoute({ hub, streams }) {
  return {
    path: EVENTS_PATH,
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async (request) => {
      const current = hub()
      if (current === undefined) return json(503, { error: { code: 'unavailable', message: 'The media hub is starting.' } })
      return streams.respond(request, ({ send }) => current.listenChanges(what => send({ type: 'change', what })))
    },
  }
}
