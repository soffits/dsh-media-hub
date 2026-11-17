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

test('the room API maps service errors to statuses', async (t) => {
  const service = {
    listRooms: () => [{ id: 'a' }],
    createRoom: async (input) => {
      if (input.path === '/bad') throw Object.assign(new Error('nope'), { code: 'invalid' })
      return { room: { id: 'new', fromPanel: input.fromPanel } }
    },
    closeRoom: (id) => {
      throw Object.assign(new Error(`no ${id}`), { code: 'not_found' })
    },
    library: async () => [],
  }
  const get = await serve(t, service)
  assert.deepEqual(await (await get('api/rooms')).json(), { rooms: [{ id: 'a' }] })
  const created = await get('api/rooms', { method: 'POST', body: JSON.stringify({ path: '/videos/Show', fromPanel: false }) })
  assert.deepEqual(await created.json(), { room: { id: 'new', fromPanel: true } })
  const bad = await get('api/rooms', { method: 'POST', body: JSON.stringify({ path: '/bad' }) })
  assert.equal(bad.status, 400)
  assert.equal((await get('api/rooms/zz', { method: 'DELETE' })).status, 404)
  assert.equal((await get('api/rooms', { method: 'POST', body: '{' })).status, 400)
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
