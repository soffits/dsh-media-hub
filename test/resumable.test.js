import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ATTEMPTS, fetchResumable } from '../web/resumable.js'

const FILE = new TextEncoder().encode('0123456789abcdefghijklmnopqrstuvwxyz')

/** A server for FILE that honours Range and cuts each answer after `cut(call)` bytes (Infinity: sends all of it). */
function server(cut, { ranges = true } = {}) {
  const calls = []
  const fetch = async (link, init) => {
    const from = ranges ? Number(/bytes=(\d+)-/.exec(init.headers.range ?? '')?.[1] ?? 0) : 0
    calls.push(init.headers.range ?? null)
    const limit = cut(calls.length)
    // The bytes arrive, then the connection drops (or the file ends) at the next read.
    let sent = false
    const body = new ReadableStream({
      pull(controller) {
        const piece = FILE.slice(from, Math.min(FILE.length, from + limit))
        if (!sent && piece.length > 0) {
          sent = true
          return controller.enqueue(piece)
        }
        if (from + limit < FILE.length) return controller.error(new TypeError('Load failed'))
        return controller.close()
      },
    }, { highWaterMark: 0 })
    const headers = from > 0 ? { 'content-range': `bytes ${from}-${FILE.length - 1}/${FILE.length}`, 'content-type': 'text/plain; charset=utf-8' } : { 'content-length': String(FILE.length), 'content-type': 'text/plain; charset=utf-8' }
    return new Response(body, { status: from > 0 ? 206 : 200, headers })
  }
  return { fetch, calls }
}
const text = async blob => new TextDecoder().decode(await blob.arrayBuffer())
const pause = async () => {}

test('a file that arrives in one piece is fetched once, typed as the server typed it', async () => {
  const { fetch, calls } = server(() => Infinity)
  const seen = []
  const blob = await fetchResumable('/file', { fetch, pause, onProgress: fraction => seen.push(fraction) })
  assert.equal(await text(blob), new TextDecoder().decode(FILE))
  assert.equal(blob.type, 'text/plain')
  assert.deepEqual(calls, [null])
  assert.equal(seen.at(-1), 1)
})

test('a dropped connection carries on from the bytes already here', async () => {
  const { fetch, calls } = server(call => (call < 3 ? 10 : Infinity))
  const blob = await fetchResumable('/file', { fetch, pause })
  assert.equal(await text(blob), new TextDecoder().decode(FILE))
  assert.deepEqual(calls, [null, 'bytes=10-', 'bytes=20-'])
})

test('a server without Range support is read from the start again, not stitched wrongly', async () => {
  const { fetch, calls } = server(call => (call < 2 ? 10 : Infinity), { ranges: false })
  const blob = await fetchResumable('/file', { fetch, pause })
  assert.equal(await text(blob), new TextDecoder().decode(FILE))
  assert.equal(calls.length, 2)
})

test('a connection that never holds gives up after a few attempts, with the browser\'s error', async () => {
  const { fetch, calls } = server(() => 0)
  await assert.rejects(fetchResumable('/file', { fetch, pause }), /Load failed/)
  assert.equal(calls.length, ATTEMPTS)
})

test('a refusal is not asked again', async () => {
  let calls = 0
  const fetch = async () => { calls += 1; return new Response('no', { status: 404 }) }
  await assert.rejects(fetchResumable('/file', { fetch, pause, refusal: status => `refused ${status}` }), /refused 404/)
  assert.equal(calls, 1)
})
