import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { createHandler, resolveRange, within } from '../src/http.js'
import { fakeConnection, tempDir } from './helpers.js'

test('Range headers resolve to one window', () => {
  assert.deepEqual(resolveRange(undefined, 100), { kind: 'absent' })
  assert.deepEqual(resolveRange('bytes=0-9', 100), { kind: 'window', start: 0, end: 9 })
  assert.deepEqual(resolveRange('bytes=90-', 100), { kind: 'window', start: 90, end: 99 })
  assert.deepEqual(resolveRange('bytes=-10', 100), { kind: 'window', start: 90, end: 99 })
  assert.deepEqual(resolveRange('bytes=50-500', 100), { kind: 'window', start: 50, end: 99 })
  assert.deepEqual(resolveRange('bytes=100-', 100), { kind: 'unsatisfiable' })
  assert.deepEqual(resolveRange('bytes=0-1,5-6', 100), { kind: 'unsatisfiable' })
  assert.deepEqual(resolveRange('bytes=9-1', 100), { kind: 'unsatisfiable' })
})

test('paths inside a folder are allowed, escapes are not', () => {
  assert.equal(within('/a/b', 'c/seg1.ts'), '/a/b/c/seg1.ts')
  assert.equal(within('/a/b', '../x'), null)
  assert.equal(within('/a/b', 'c/../../x'), null)
  assert.equal(within('/a/b', '/etc/passwd'), null)
  assert.equal(within('/a/b', '..foo'), '/a/b/..foo')
})

async function serve(t, service) {
  const server = createServer(createHandler({ connection: fakeConnection, service: () => service }))
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  t.after(() => server.close())
  const base = `http://127.0.0.1:${server.address().port}/media-hub/`
  return (path, init = {}) => fetch(new URL(path, base), { ...init, headers: { cookie: 'ok', ...init.headers } })
}

test('media is served only to admitted owners, with Range support', async (t) => {
  const dir = tempDir(t)
  const file = join(dir, 'ep1.mp4')
  writeFileSync(file, Buffer.from('0123456789abcdefghij'))
  const service = { mediaFile: (room, index) => (room === 'room1' && index === 0 ? { file, kind: 'file' } : undefined) }
  const get = await serve(t, service)

  assert.equal((await get('media/room1/0/ep1.mp4', { headers: { cookie: '' } })).status, 401)
  assert.equal((await get('media/room1/0/ep1.mp4', { headers: { cookie: 'guest' } })).status, 403)

  const whole = await get('media/room1/0/ep1.mp4')
  assert.equal(whole.status, 200)
  assert.equal(whole.headers.get('accept-ranges'), 'bytes')
  assert.equal(whole.headers.get('content-type'), 'video/mp4')
  assert.equal(await whole.text(), '0123456789abcdefghij')

  const part = await get('media/room1/0/ep1.mp4', { headers: { range: 'bytes=10-14' } })
  assert.equal(part.status, 206)
  assert.equal(part.headers.get('content-range'), 'bytes 10-14/20')
  assert.equal(await part.text(), 'abcde')

  const bad = await get('media/room1/0/ep1.mp4', { headers: { range: 'bytes=50-' } })
  assert.equal(bad.status, 416)
  assert.equal(bad.headers.get('content-range'), 'bytes */20')

  assert.equal((await get('media/room1/1/ep1.mp4')).status, 404)
  assert.equal((await get('media/other/0/ep1.mp4')).status, 404)
})

test('HLS segments resolve next to their playlist and cannot leave its folder', async (t) => {
  const dir = tempDir(t)
  mkdirSync(join(dir, 'show', 'seg'), { recursive: true })
  writeFileSync(join(dir, 'show', 'index.m3u8'), '#EXTM3U\n')
  writeFileSync(join(dir, 'show', 'seg', '1.ts'), 'segment')
  writeFileSync(join(dir, 'secret.txt'), 'secret')
  const get = await serve(t, { mediaFile: () => ({ file: join(dir, 'show', 'index.m3u8'), kind: 'hls' }) })
  const playlist = await get('media/r/0/index.m3u8')
  assert.equal(playlist.headers.get('content-type'), 'application/vnd.apple.mpegurl')
  assert.equal(await (await get('media/r/0/seg/1.ts')).text(), 'segment')
  assert.equal((await get('media/r/0/..%2Fsecret.txt')).status, 404)
})

test('the room API maps service errors to statuses, and a failed site is never a gateway status', async (t) => {
  const service = {
    listRooms: () => [{ id: 'a' }],
    closeRoom: (id) => {
      throw Object.assign(new Error(`no ${id}`), { code: 'not_found' })
    },
    search: async () => {
      throw Object.assign(new Error('the site refused the request'), { code: 'source_failed', reason: 'blocked' })
    },
    library: async () => [],
  }
  const get = await serve(t, service)
  assert.deepEqual(await (await get('api/rooms')).json(), { rooms: [{ id: 'a' }] })
  assert.equal((await get('api/rooms/zz', { method: 'DELETE' })).status, 404)
  const refused = await get('api/search?source=s&q=x')
  assert.equal(refused.status, 424, 'proxies in front of DSH replace a 502 with a page of their own')
  assert.deepEqual(await refused.json(), { error: { code: 'source_failed', reason: 'blocked', message: 'the site refused the request' } })
  assert.equal((await get('api/rooms', { method: 'POST', body: '{}' })).status, 404, 'opening a room acts for a person: under DSH\'s /api')
})

test('the player modules are served, nothing else from the package', async (t) => {
  const get = await serve(t, {})
  const module = await get('web/sync.js')
  assert.equal(module.status, 200)
  assert.match(module.headers.get('content-type'), /javascript/)
  assert.equal((await get('web/hls.mjs')).status, 200)
  assert.equal((await get('web/..%2Findex.js')).status, 404)
  assert.equal((await get('web/http.js')).status, 404)
})

test('covers are served only to admitted owners, as the picture type they are', async (t) => {
  const dir = tempDir(t)
  const file = join(dir, 'c.img')
  writeFileSync(file, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]))
  const key = 'a'.repeat(32)
  const get = await serve(t, { coverFile: async name => (name === key ? { file, type: 'image/png' } : null) })

  assert.equal((await get(`covers/${key}`, { headers: { cookie: '' } })).status, 401)
  assert.equal((await get(`covers/${key}`, { headers: { cookie: 'guest' } })).status, 403)
  assert.equal((await get(`covers/${'b'.repeat(32)}`)).status, 404)
  const ok = await get(`covers/${key}`)
  assert.equal(ok.status, 200)
  assert.equal(ok.headers.get('content-type'), 'image/png')
  assert.equal((await ok.arrayBuffer()).byteLength, 11)
})

test('the page gets the words the locale files hold now, not what they held when the plugin started', async (t) => {
  const localeDir = tempDir(t)
  writeFileSync(join(localeDir, 'en.json'), JSON.stringify({ meta: {}, ui: { hello: 'one' } }))
  const server = createServer(createHandler({ connection: fakeConnection, service: () => ({}), localeDir, logger: { warn() {} } }))
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  t.after(() => server.close())
  const words = async () => (await fetch(`http://127.0.0.1:${server.address().port}/media-hub/api/locales`, { headers: { cookie: 'ok' } })).json()
  assert.equal((await words()).en.hello, 'one')
  writeFileSync(join(localeDir, 'en.json'), JSON.stringify({ meta: {}, ui: { hello: 'two' } }))
  assert.equal((await words()).en.hello, 'two')
})

test('an address with a broken escape is a bad request, not a crash', async (t) => {
  const get = await serve(t, {})
  const response = await get('%E0%A4')
  assert.equal(response.status, 400)
})

test('every page API route reaches the hub method it names, with its arguments', async (t) => {
  const calls = []
  const hub = new Proxy({}, { get: (_, name) => (...args) => { calls.push([name, ...args]); return { from: name } } })
  const get = await serve(t, hub)
  const post = (path, body) => get(path, { method: 'POST', body: JSON.stringify(body) })
  const cases = [
    [() => get('api/rooms/r1/work'), ['roomWork', 'r1']],
    [() => get('api/rooms/r1/danmaku/3'), ['roomDanmaku', 'r1', 3]],
    [() => get('api/rooms/r1/comments?cursor=c'), ['roomComments', 'r1', 'c']],
    [() => post('api/rooms/r1/quality', { quality: 720 }), ['roomQuality', 'r1', '720']],
    [() => post('api/rooms/r1/together', {}), ['watchTogether', 'r1']],
    [() => get('api/rooms/r1', { method: 'DELETE' }), ['closeRoom', 'r1']],
    [() => get('api/library/episodes?path=p'), ['episodes', 'p']],
    [() => get('api/library?path=p&episode=e&by=Ann', { method: 'DELETE' }), ['removeEpisode', 'p', 'e', 'Ann']],
    [() => get('api/library?path=p', { method: 'DELETE' }), ['removeShow', 'p', null]],
    [() => post('api/library/rename', { path: 'p', name: 'n', by: 'Ann' }), ['renameShow', 'p', 'n', 'Ann']],
    [() => post('api/library/keep', { path: 'p' }), ['keepShow', 'p', null]],
    [() => post('api/library/countdown', { path: 'p', by: 'Ann' }), ['countdownShow', 'p', 'Ann']],
    [() => post('api/library/retry', { path: 'p' }), ['retryDownload', 'p']],
    [() => post('api/library/pin', { path: 'p', pinned: true }), ['pinShow', 'p', true, null]],
    [() => post('api/library/seen', { path: 'p' }), ['dismissNews', 'p']],
    [() => post('api/library/cancel', { path: 'p' }), ['cancelDownload', 'p']],
    [() => post('api/follow', { source: 's', id: 'i', follow: true, extra: 1 }), ['followWork', { source: 's', id: 'i', follow: true }]],
    [() => get('api/trending?source=s&kind=k'), ['trending', 's', 'k']],
  ]
  for (const [request, call] of cases) {
    calls.length = 0
    const response = await request()
    assert.equal(response.status, 200, call[0])
    assert.deepEqual(calls, [call])
  }
  assert.equal((await get('api/rooms/r1/work/more')).status, 404)
  assert.equal((await get('api/library/rename')).status, 404, 'a route answers only its own method')
})
