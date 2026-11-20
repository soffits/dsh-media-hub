/**
 * `GET /api/media-hub/events`: a Server-Sent Events stream with one notice,
 * `{ "type": "change", "what": ["library", ...] }`, whenever something a page
 * shows changed (src/changes.js). A Fetch route under DSH's `/api`, so DSH
 * admits the browser first, like the shelf's.
 */
import { SECURITY_HEADERS } from './http.js'
import { json } from './person-routes.js'

export const EVENTS_PATH = '/api/media-hub/events'
const HEARTBEAT_MS = 25_000

/** @param {{ hub: () => { listenChanges: Function } | undefined }} options */
export function createEventsRoute({ hub }) {
  return {
    path: EVENTS_PATH,
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async (request) => {
      const current = hub()
      if (current === undefined) return json(503, { error: { code: 'unavailable', message: 'The media hub is starting.' } })
      const encoder = new TextEncoder()
      let stop = () => {}
      const stream = new ReadableStream({
        start(controller) {
          const write = (chunk) => {
            try {
              controller.enqueue(encoder.encode(chunk))
            } catch {
              stop()
            }
          }
          write('retry: 5000\n: open\n\n')
          const unlisten = current.listenChanges(what => write(`data: ${JSON.stringify({ type: 'change', what })}\n\n`))
          const beat = setInterval(() => write(': beat\n\n'), HEARTBEAT_MS)
          stop = () => { unlisten(); clearInterval(beat) }
          request.signal?.addEventListener('abort', () => {
            stop()
            try { controller.close() } catch { /* already closed */ }
          }, { once: true })
        },
        cancel() { stop() },
      })
      return new Response(stream, { status: 200, headers: { ...SECURITY_HEADERS, 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'private, no-cache, no-transform', 'x-accel-buffering': 'no' } })
    },
  }
}
