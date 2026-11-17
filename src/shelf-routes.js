/**
 * The shelf's routes: exact Fetch routes under DSH's `/api`, so DSH admits
 * the browser first and a `requestIdentity` provider knows who is asking.
 * Every answer is about the asking person's own shelf.
 *
 *   GET  /api/media-hub/shelf                 the person's books, disk use, whether conversion is on
 *   POST /api/media-hub/shelf/add             { source, id, format, title?, author? }
 *   POST /api/media-hub/shelf/retry           { entry }
 *   POST /api/media-hub/shelf/remove          { entry }
 *   GET  /api/media-hub/shelf/file?entry=     the file, as an attachment (Range)
 */
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { attachment } from './books.js'
import { resolveRange } from './http.js'
import { personOf } from './people.js'
import { HEADERS, body, failure, json } from './person-routes.js'

export const SHELF_PATH = '/api/media-hub/shelf'

/** A file as a Fetch response, with Range support. */
export async function fileResponse(request, { path, name, type }) {
  const info = await stat(path).catch(() => null)
  if (info === null || !info.isFile()) return json(404, { error: { code: 'not_found', message: 'the file is gone' } })
  const range = resolveRange(request.headers.get('range'), info.size)
  const headers = { ...HEADERS, 'content-type': type, 'content-disposition': attachment(name), 'accept-ranges': 'bytes' }
  if (range.kind === 'unsatisfiable') return new Response(null, { status: 416, headers: { ...headers, 'content-range': `bytes */${info.size}` } })
  const start = range.kind === 'window' ? range.start : 0
  const end = range.kind === 'window' ? range.end : info.size - 1
  headers['content-length'] = String(info.size === 0 ? 0 : end - start + 1)
  if (range.kind === 'window') headers['content-range'] = `bytes ${start}-${end}/${info.size}`
  const stream = request.method === 'HEAD' || info.size === 0 ? null : Readable.toWeb(createReadStream(path, { start, end }))
  return new Response(stream, { status: range.kind === 'window' ? 206 : 200, headers })
}

/**
 * @param {{ books: () => object | undefined, identity: () => object | undefined }} options
 *   books: the running shelves; identity: the requestIdentity service right now, if any
 */
export function createShelfRoutes({ books, identity }) {
  const handle = fn => async (request) => {
    const shelves = books()
    if (shelves === undefined) return json(503, { error: { code: 'unavailable', message: 'The shelf is starting.' } })
    try {
      return await fn(request, shelves, personOf(identity()))
    } catch (error) {
      return failure(error)
    }
  }
  const param = (request, name) => new URL(request.url).searchParams.get(name) ?? ''

  return [
    { path: SHELF_PATH, methods: ['GET'], requestBody: 'buffered', fetch: handle(async (request, shelves, person) => json(200, { ...await shelves.list(person.key), person: { name: person.name, verified: person.verified } })) },
    {
      path: `${SHELF_PATH}/add`,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: handle(async (request, shelves, person) => {
        const input = await body(request)
        return json(200, { entry: await shelves.add(person.key, { source: input.source, id: input.id, format: input.format, title: input.title, author: input.author, by: person.name }) })
      }),
    },
    { path: `${SHELF_PATH}/retry`, methods: ['POST'], requestBody: 'buffered', fetch: handle(async (request, shelves, person) => json(200, { entry: await shelves.retry(person.key, (await body(request)).entry) })) },
    { path: `${SHELF_PATH}/remove`, methods: ['POST'], requestBody: 'buffered', fetch: handle(async (request, shelves, person) => json(200, await shelves.remove(person.key, (await body(request)).entry))) },
    {
      path: `${SHELF_PATH}/file`,
      methods: ['GET', 'HEAD'],
      requestBody: 'buffered',
      fetch: handle(async (request, shelves, person) => {
        const file = await shelves.file(person.key, param(request, 'entry'))
        return file === null ? json(404, { error: { code: 'not_found', message: 'not on your shelf, or not downloaded yet' } }) : fileResponse(request, file)
      }),
    },
  ]
}
