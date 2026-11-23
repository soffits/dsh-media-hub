import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { createDelivery } from '../src/delivery.js'
import { createRoomService } from '../src/hub.js'
import { hasFfmpeg, makeVideo, quietLogger, socketServer, tempDir, viewer } from './helpers.js'

const tools = { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe', maxHeight: 1080, threads: 1 }

function makeService(dir, overrides = {}) {
  return createRoomService({
    stateDir: join(dir, 'state'),
    libraryRoots: [join(dir, 'library')],
    delivery: createDelivery({ mode: 'origin' }),
    tools,
    webUrl: () => 'https://dsh.example.com/',
    lifetime: { emptyMinutes: 30, unopenedHours: 24 },
    logger: quietLogger,
    ...overrides,
  })
}

/** A show of `episodes` short videos in the library, ready to play as they are. */
function show(dir, name = 'Show', episodes = 1) {
  const path = join(dir, 'library', name)
  mkdirSync(path, { recursive: true })
  for (let n = 1; n <= episodes; n++) makeVideo(join(path, `0${n}.mp4`), { seconds: 1 })
  return path
}


test('two viewers see each other and follow each other\'s operations', { skip: !hasFfmpeg }, async (t) => {
  const dir = tempDir()
  const service = makeService(dir)
  await service.load()
  t.after(() => service.dispose())
  const { room } = await service.createRoom({ path: show(dir, 'Show', 2), by: 'Agent' })
  assert.equal(room.title, 'Show')
  assert.equal(room.episodes, 2)
  await service.waitReady(room.id, 0, 30_000)
  const url = await socketServer(t, service)

  const a = await viewer(url(room.id), 'a', 'Alice')
  await a.next(m => m.t === 'state')
  const b = await viewer(url(room.id), 'b', 'Bob')
  const both = await a.next(m => m.t === 'state' && m.members.length === 2)
  assert.deepEqual(both.members.map(m => m.name).sort(), ['Alice', 'Bob'])
  assert.equal(both.room.items[0].title, '01')

  // The room waits for both before it plays, and starts both at one time a little ahead.
  a.send({ t: 'op', op: 'play' })
  const waiting = await b.next(m => m.t === 'state' && m.room.last?.op === 'play')
  assert.equal(waiting.clock.playing, false)
  assert.deepEqual(waiting.members.map(m => m.wait), ['loading', 'loading'])
  a.send({ t: 'op', op: 'ready', gate: waiting.room.gate.id })
  await b.next(m => m.t === 'state' && m.members.find(x => x.name === 'Alice').wait === 'ready')
  b.send({ t: 'op', op: 'ready', gate: waiting.room.gate.id, rtt: 50 })
  const played = await a.next(m => m.t === 'state' && m.clock.playing)
  assert.equal(played.room.last.by, 'Alice')
  assert.equal(played.room.gate, null)
  assert.ok(played.clock.updatedAt > played.serverTime, 'the start lies ahead')

  b.send({ t: 'op', op: 'select', index: 1 })
  const switched = await a.next(m => m.t === 'state' && m.room.index === 1)
  assert.equal(switched.room.last.by, 'Bob')
  assert.equal(switched.room.last.op, 'select')

  b.send({ t: 'ping', id: 7, client: 123 })
  const pong = await b.next(m => m.t === 'pong')
  assert.equal(pong.client, 123)
  assert.equal(typeof pong.server, 'number')

  b.ws.close()
  const alone = await a.next(m => m.t === 'state' && m.members.length === 1)
  assert.equal(alone.members[0].name, 'Alice')
  a.ws.close()
})

test('a viewer that disconnects while the room waits for it is no longer waited for', { skip: !hasFfmpeg }, async (t) => {
  const dir = tempDir()
  const service = makeService(dir)
  await service.load()
  t.after(() => service.dispose())
  const { room } = await service.createRoom({ path: show(dir) })
  await service.waitReady(room.id, 0, 30_000)
  const url = await socketServer(t, service)
  const a = await viewer(url(room.id), 'a', 'Alice')
  const b = await viewer(url(room.id), 'b', 'Bob')
  const opened = await a.next(m => m.t === 'state' && m.members.length === 2)
  a.send({ t: 'op', op: 'play' })
  a.send({ t: 'op', op: 'ready', gate: opened.room.gate.id })
  const held = await a.next(m => m.t === 'state' && m.members.find(x => x.name === 'Alice').wait === 'ready')
  assert.equal(held.clock.playing, false)
  assert.equal(held.members.find(m => m.name === 'Bob').wait, 'loading')
  b.ws.close()
  const alone = await a.next(m => m.t === 'state' && m.clock.playing)
  assert.deepEqual(alone.members.map(m => m.name), ['Alice'])
  a.ws.close()
})

test('rooms survive a restart of the service; closed rooms end their sockets', { skip: !hasFfmpeg }, async (t) => {
  const dir = tempDir()
  const first = makeService(dir)
  await first.load()
  const { room } = await first.createRoom({ path: show(dir), title: 'Movie night' })
  await first.waitReady(room.id, 0, 30_000)
  await first.dispose()

  const second = makeService(dir)
  await second.load()
  t.after(() => second.dispose())
  assert.deepEqual(second.listRooms().map(r => [r.title, r.link]), [['Movie night', `https://dsh.example.com/?media-room=${room.id}`]])

  const url = await socketServer(t, second)
  const a = await viewer(url(room.id), 'a', 'Alice')
  await a.next(m => m.t === 'state')
  const closing = once(a.ws, 'close')
  second.closeRoom(room.id)
  const [code] = await closing
  assert.equal(code, 4410)
  assert.deepEqual(second.listRooms(), [])
})

test('the panel may only open what is in the library; the tool may open any path', async (t) => {
  const dir = tempDir()
  const service = makeService(dir)
  await service.load()
  t.after(() => service.dispose())
  await assert.rejects(service.createRoom({ source: 'local', path: '/etc', fromPanel: true }), { code: 'outside' })
  await assert.rejects(service.createRoom({ source: 'local', path: 'relative/path' }), { code: 'invalid' })
  await assert.rejects(service.createRoom({ source: 'local', path: join(dir, 'missing') }), { code: 'not_found' })
  await assert.rejects(service.createRoom({ source: 'vimeo' }), { code: 'invalid' })
})

test('R2 delivery refuses local rooms until it is built', async (t) => {
  const dir = tempDir()
  const service = makeService(dir, { delivery: createDelivery({ mode: 'r2' }) })
  await service.load()
  t.after(() => service.dispose())
  await assert.rejects(service.createRoom({ source: 'local', path: dir }), { code: 'unsupported' })
})

test('a local room prepares its episodes and serves them when ready', { skip: !hasFfmpeg && 'needs ffmpeg' }, async (t) => {
  const dir = tempDir()
  const show = join(dir, 'library', 'Show')
  mkdirSync(show, { recursive: true })
  makeVideo(join(show, '02.mp4'), { faststart: false })
  makeVideo(join(show, '01.mp4'))
  const service = makeService(dir)
  await service.load()
  t.after(() => service.dispose())
  const { room } = await service.createRoom({ source: 'local', path: show, fromPanel: true, by: 'Alice' })
  assert.equal(room.title, 'Show')
  await service.waitReady(room.id, 0, 30_000)
  await service.waitReady(room.id, 1, 30_000)
  const detail = service.room(room.id)
  assert.deepEqual(detail.items.map(i => [i.title, i.status]), [['01', 'ready'], ['02', 'ready']])
  assert.equal(service.mediaFile(room.id, 0).file, join(show, '01.mp4'))
  assert.notEqual(service.mediaFile(room.id, 1).file, join(show, '02.mp4'))
})

test('rooms close by themselves: 30 minutes after the last viewer left, or a day after creation when never opened', { skip: !hasFfmpeg }, async (t) => {
  const dir = tempDir()
  let clock = 1_000_000
  const service = makeService(dir, { now: () => clock })
  await service.load()
  t.after(() => service.dispose())
  const path = show(dir)
  const { room: unopened } = await service.createRoom({ path, title: 'Later' })
  const { room: used } = await service.createRoom({ path, title: 'Tonight' })
  const url = await socketServer(t, service)

  const a = await viewer(url(used.id), 'a', 'Alice')
  await a.next(m => m.t === 'state')
  clock += 2 * 3_600_000
  service.sweep()
  assert.deepEqual(service.listRooms().map(r => [r.title, r.members.length]), [['Tonight', 1], ['Later', 0]])

  a.ws.close()
  await new Promise(done => a.ws.once('close', done))
  await new Promise(done => setTimeout(done, 50))
  const empty = service.listRooms().find(r => r.title === 'Tonight')
  assert.equal(empty.opened, true)
  assert.equal(empty.emptySince, clock)

  clock += 29 * 60_000
  service.sweep()
  assert.deepEqual(service.listRooms().map(r => r.title).sort(), ['Later', 'Tonight'])
  clock += 60_000
  service.sweep()
  assert.deepEqual(service.listRooms().map(r => r.title), ['Later'])

  clock = 1_000_000 + 24 * 3_600_000 - 1
  service.sweep()
  assert.equal(service.listRooms().length, 1)
  clock += 1
  service.sweep()
  assert.deepEqual(service.listRooms(), [])
})

test('a room is one person\'s until they open it to others, where it stands', { skip: !hasFfmpeg }, async (t) => {
  const dir = tempDir()
  const service = makeService(dir)
  await service.load()
  t.after(() => service.dispose())
  const path = show(dir)
  const { room } = await service.createRoom({ path, by: 'Ann' })
  assert.equal(room.together, false)
  const url = await socketServer(t, service)
  const ann = await viewer(url(room.id), 'a', 'Ann')
  assert.equal((await ann.next(m => m.t === 'state')).room.together, false)
  assert.equal(service.watchTogether(room.id).room.together, true)
  const shared = await ann.next(m => m.t === 'state' && m.room.together)
  assert.equal(shared.room.index, 0, 'the same room, on the same episode')
  assert.equal(service.listRooms().find(entry => entry.id === room.id).together, true)
  assert.equal((await service.createRoom({ path, by: 'Agent', together: true })).room.together, true)
  assert.throws(() => service.watchTogether('nope'), { code: 'not_found' })
})

test('a frame that is JSON but not an object is answered with an error, and the room goes on', { skip: !hasFfmpeg }, async (t) => {
  const dir = tempDir()
  const service = makeService(dir)
  await service.load()
  t.after(() => service.dispose())
  const { room } = await service.createRoom({ path: show(dir), by: 'Agent' })
  const url = await socketServer(t, service)
  const a = await viewer(url(room.id), 'a', 'Alice')
  await a.next(m => m.t === 'state')
  for (const frame of ['null', '5', '"op"']) a.ws.send(frame)
  for (let n = 0; n < 3; n++) assert.equal((await a.next(m => m.t === 'error')).message, 'not an object')
  a.send({ t: 'ping', id: 1, client: 0 })
  assert.equal((await a.next(m => m.t === 'pong')).id, 1)
})
