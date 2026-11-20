import assert from 'node:assert/strict'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, utimesSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { test } from 'node:test'
import { createDelivery } from '../src/delivery.js'
import { createMediaHub } from '../src/media.js'
import { isNearEnd } from '../src/watchlog.js'
import { fileURLToPath } from 'node:url'
import { fakePoints, hasFfmpeg, makeVideo, quietLogger, socketServer, tempDir, viewer } from './helpers.js'

const tools = { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe', maxHeight: 1080, threads: 1 }
const HELD_FFMPEG = fileURLToPath(new URL('./fixtures/held-ffmpeg.mjs', import.meta.url))
const sleep = ms => new Promise(done => setTimeout(done, ms))

/** Wait until `check()` is truthy. */
async function until(what, check, timeoutMs = 5000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    if (await check()) return
    await sleep(20)
  }
  assert.fail(`timed out: ${what}`)
}

const numbered = n => `${String(n).padStart(2, '0')} 第${n}集.mp4`

/**
 * A source of `episodes` small files (copies of `video` when given). `calls` records each run's range.
 * Gated, every episode waits for `next()`; otherwise they land at once.
 */
function stubSource(episodes = 3, { gated = false, video = null } = {}) {
  let release = null
  const calls = []
  const source = {
    id: 'stub',
    label: 'Stub',
    kinds: [{ id: 'drama', label: 'Short dramas' }],
    available: async () => true,
    search: async q => ({ results: [{ id: '42', title: `Result for ${q}`, kind: 'drama', score: 9 }], next: null }),
    info: async id => ({ id, title: id === '42' ? 'Stub show' : `Stub show ${id}`, kind: 'drama', episodes }),
    async download({ dir, from = 1, to = null, signal, onEpisode, onStart }) {
      calls.push([from, to ?? episodes])
      mkdirSync(dir, { recursive: true })
      for (let n = from; n <= Math.min(to ?? episodes, episodes); n++) {
        const name = numbered(n)
        if (existsSync(join(dir, name))) continue
        onStart?.(n)
        if (gated) await new Promise((done) => { release = done; signal?.addEventListener('abort', done, { once: true }) }).finally(() => { release = null })
        if (signal?.aborted) return { failed: [] }
        writeFileSync(join(dir, `.${name}.part`), video ?? `episode ${n}`)
        renameSync(join(dir, `.${name}.part`), join(dir, name))
        appendFileSync(join(dir, 'SHA256SUMS.txt'), `${'0'.repeat(64)}  ${name}\n`)
        onEpisode()
      }
      return { failed: [] }
    },
  }
  /** Let the episode being waited on land. */
  const next = async () => {
    await until('an episode is waiting', () => release !== null)
    release()
  }
  return { source, calls, next }
}

const cacheOptions = { ahead: 2, behind: 1, capBytes: 0 }

/** Watch episode `index` of a room to its end; `pass(ms)` moves the hub's clock. */
async function watchThrough(a, index, pass) {
  a.send({ t: 'op', op: 'duration', index, duration: 100 })
  a.send({ t: 'op', op: 'play', position: 0 })
  await sleep(30)
  pass(99_000)
  a.send({ t: 'op', op: 'ended', from: index })
  await sleep(60)
}

function makeHub(dir, source, overrides = {}) {
  return createMediaHub({
    stateDir: join(dir, 'state'),
    libraryRoots: [join(dir, 'state', 'library')],
    delivery: createDelivery({ mode: 'origin' }),
    tools,
    webUrl: () => 'https://dsh.example.com/',
    lifetime: { emptyMinutes: 30, unopenedHours: 24 },
    autoDeleteDays: 7,
    sources: [source],
    cache: cacheOptions,
    logger: quietLogger,
    fetchTitle: async id => `Title of ${id}`,
    ...overrides,
  })
}

const filesOf = path => readdirSync(path).filter(name => name.endsWith('.mp4')).sort()
const numbersIn = path => filesOf(path).map(name => Number.parseInt(name, 10))

test('watch now: the room opens at once with every episode listed, the one being watched is fetched first; its show cannot be deleted while open', async (t) => {
  const dir = tempDir(t)
  const stub = stubSource(5, { gated: true })
  const hub = makeHub(dir, stub.source)
  await hub.load()
  t.after(() => hub.dispose())
  assert.deepEqual((await hub.sources()).map(s => s.id), ['stub'])
  assert.equal((await hub.search('stub', 'x')).results[0].title, 'Result for x')

  const fetched = await hub.fetch({ source: 'stub', id: '42', watch: true, by: 'Alice' })
  assert.equal(fetched.room.title, 'Stub show')
  assert.equal(fetched.room.episodes, 5)
  assert.equal(fetched.room.createdBy, 'Alice')
  assert.equal(fetched.room.preparing, 1, 'only the episode being watched shows as preparing')
  const show = fetched.path
  await until('the first run is on its way', () => stub.calls.length === 1)
  assert.deepEqual(stub.calls[0], [1, 3], 'episode 1 and the two after it, as one run')

  let library = await hub.library()
  assert.deepEqual(library.shows.map(s => [s.name, s.episodes, s.total, s.sourced, s.pinned, s.download.status]), [['Stub show', 0, 5, true, false, 'running']])
  await stub.next()
  await until('episode 1 is on disk', () => numbersIn(show).includes(1))
  await stub.next()
  await stub.next()
  await until('the window is cached', () => numbersIn(show).length === 3)
  await until('the download is over', async () => (await hub.library()).shows[0].download === null)
  library = await hub.library()
  assert.deepEqual(library.shows.map(s => [s.episodes, s.total]), [[3, 5]])
  assert.deepEqual(numbersIn(show), [1, 2, 3])
  assert.equal(hub.room(fetched.room.id).items.length, 5)

  await assert.rejects(hub.removeShow(show), { code: 'in_use' })
  hub.closeRoom(fetched.room.id)
  await hub.removeEpisode(show, numbered(1))
  await hub.removeShow(show)
  assert.equal(existsSync(show), false)
  assert.deepEqual((await hub.library()).shows, [])
})

test('a download job saved before the rolling cache is dropped at start, not run', async (t) => {
  const dir = tempDir(t)
  mkdirSync(join(dir, 'state'), { recursive: true })
  writeFileSync(join(dir, 'state', 'downloads.json'), JSON.stringify({ jobs: [{ dir: join(dir, 'state', 'library', 'Old'), source: 'stub', id: '42', title: 'Old', kind: 'drama', episodes: 3, status: 'running', priority: false, createdAt: 1 }] }))
  const stub = stubSource(3)
  const hub = makeHub(dir, stub.source)
  await hub.load()
  t.after(() => hub.dispose())
  await sleep(100)
  assert.deepEqual(stub.calls, [])
})

test('save to library fetches only the window; the episode list names every episode, cached or not', async (t) => {
  const dir = tempDir(t)
  const stub = stubSource(12)
  const hub = makeHub(dir, stub.source)
  await hub.load()
  t.after(() => hub.dispose())
  const saved = await hub.fetch({ source: 'stub', id: '42', watch: false })
  assert.equal(saved.room, null)
  assert.equal(saved.estimate, 3 * 15e6, 'the estimate is for the window, not the whole show')
  await until('the window is on disk', () => existsSync(saved.path) && numbersIn(saved.path).length === 3)
  assert.deepEqual(stub.calls, [[1, 3]])
  const entry = (await hub.library()).shows[0]
  assert.deepEqual([entry.episodes, entry.total, entry.pinned, entry.sourced], [3, 12, false, true])
  const episodes = await hub.episodes(saved.path)
  assert.equal(episodes.length, 12)
  assert.deepEqual(episodes.filter(e => e.cached).map(e => e.n), [1, 2, 3])
  assert.equal(episodes[5].title, null)
  assert.equal(episodes[5].size, 0)
})

test('the window rolls with the room: watched episodes more than one behind are deleted, the next ones are fetched, the watch log still counts them', async (t) => {
  const dir = tempDir(t)
  const stub = stubSource(12)
  let clock = Date.parse('2026-11-16T20:00:00Z')
  const hub = makeHub(dir, stub.source, { now: () => clock })
  await hub.load()
  t.after(() => hub.dispose())
  const { path: show } = await hub.fetch({ source: 'stub', id: '42', watch: false })
  await until('the window is on disk', () => existsSync(show) && numbersIn(show).length === 3)
  const { room } = await hub.createRoom({ source: 'local', path: show, by: 'Alice', fromPanel: true })
  assert.equal(room.episodes, 12)
  const url = await socketServer(t, hub)
  const a = await viewer(url(room.id), 'a', 'Alice')
  await a.next(m => m.t === 'state')

  const pass = (ms) => { clock += ms }
  await watchThrough(a, 0, pass)
  await until('episode 4 is fetched as the window moves', () => numbersIn(show).includes(4))
  assert.deepEqual(numbersIn(show), [1, 2, 3, 4], 'one behind stays')
  await watchThrough(a, 1, pass)
  await until('episode 1 is deleted and 5 fetched', () => !numbersIn(show).includes(1) && numbersIn(show).includes(5))
  assert.deepEqual(numbersIn(show), [2, 3, 4, 5])
  assert.doesNotMatch(readFileSync(join(show, 'SHA256SUMS.txt'), 'utf8'), /第1集/)
  assert.match(readFileSync(join(show, 'SHA256SUMS.txt'), 'utf8'), /第2集/)

  const episodes = await hub.episodes(show)
  assert.equal(episodes[0].cached, false)
  assert.equal(episodes[0].watch.finished, true, 'still marked watched after its file is gone')
  const entry = (await hub.library()).shows[0]
  assert.equal(entry.finished, 2)
  assert.equal(entry.episodes, 4)
  assert.ok(readFileSync(hub.logFile, 'utf8').includes('"library.cacheDropped"'))
  const state = await a.next(m => m.t === 'state' && m.room.items[0].cached === false)
  assert.equal(state.room.items[0].status, 'remote')
  assert.equal(state.room.items[0].src, null)
  assert.equal(state.room.items.length, 12)

  // Jump far ahead: the episode itself comes first, then the ones after it; the skipped ones are not watched, so they stay.
  const before = stub.calls.length
  a.send({ t: 'op', op: 'select', index: 9 })
  await until('episodes 10 to 12 are fetched', () => [10, 11, 12].every(n => numbersIn(show).includes(n)))
  assert.deepEqual(stub.calls[before], [10, 12], 'the jump target leads the run')
  await until('episode 2 (watched) is trimmed, the unwatched ones stay', () => !numbersIn(show).includes(2))
  assert.deepEqual(numbersIn(show), [3, 4, 5, 10, 11, 12])
  a.ws.close()
})

test('a jump while an earlier run is in flight cuts it and fetches the jump target first', async (t) => {
  const dir = tempDir(t)
  const stub = stubSource(12, { gated: true })
  const hub = makeHub(dir, stub.source)
  await hub.load()
  t.after(() => hub.dispose())
  const { room, path: show } = await hub.fetch({ source: 'stub', id: '42', watch: true })
  await until('the first run waits on episode 1', () => stub.calls.length === 1)
  const url = await socketServer(t, hub)
  const a = await viewer(url(room.id), 'a', 'Alice')
  await a.next(m => m.t === 'state')
  a.send({ t: 'op', op: 'select', index: 8 })
  await until('the run was cut and restarted at episode 9', () => stub.calls.length === 2)
  assert.deepEqual(stub.calls[1], [9, 11])
  const state = await a.next(m => m.t === 'state' && m.room.index === 8)
  assert.equal(state.room.items[8].status, 'preparing', 'shown as preparing until the file lands')
  await stub.next()
  await until('episode 9 landed first', () => numbersIn(show).includes(9))
  assert.deepEqual(numbersIn(show), [9])
  await stub.next()
  await stub.next()
  await until('the rest of the window', () => numbersIn(show).length === 3)
  a.ws.close()
})

/**
 * Episodes that take long to prepare (a codec browsers do not play, encoded by a stand-in ffmpeg that holds), and
 * what that ffmpeg was asked: `started()` and `stopped()` list the episode numbers.
 */
function heldEncoding(t, dir) {
  const video = join(dir, 'mpeg4.mp4')
  makeVideo(video, { seconds: 1, codec: 'mpeg4' })
  const log = join(dir, 'ffmpeg.log')
  writeFileSync(log, '')
  const previous = process.env.HELD_FFMPEG_LOG
  process.env.HELD_FFMPEG_LOG = log
  t.after(() => { process.env.HELD_FFMPEG_LOG = previous })
  const lines = kind => readFileSync(log, 'utf8').split('\n').filter(line => line.startsWith(`${kind} `)).map(line => Number.parseInt(line.slice(kind.length + 1), 10))
  return { video: readFileSync(video), tools: { ...tools, ffmpeg: HELD_FFMPEG }, started: () => lines('start'), stopped: () => lines('stop') }
}

test('replaying an episode the cache deleted fetches it again and plays it at once, whatever else is being prepared', { skip: !hasFfmpeg }, async (t) => {
  const dir = tempDir(t)
  const held = heldEncoding(t, dir)
  const stub = stubSource(12, { video: held.video })
  let clock = Date.parse('2026-11-16T20:00:00Z')
  const hub = makeHub(dir, stub.source, { tools: held.tools, now: () => clock })
  await hub.load()
  t.after(() => hub.dispose())
  const { room, path: show } = await hub.fetch({ source: 'stub', id: '42', watch: true })
  const url = await socketServer(t, hub)
  const a = await viewer(url(room.id), 'a', 'Alice')
  await a.next(m => m.t === 'state')
  await until('episode 1 plays', () => hub.room(room.id).items[0].status === 'ready')
  for (const index of [0, 1, 2]) await watchThrough(a, index, (ms) => { clock += ms })
  await until('episodes 1 and 2 are deleted as watched', () => numbersIn(show)[0] === 3)
  await until('episode 4 plays and the next one is being prepared', () => hub.room(room.id).items[3].status === 'ready' && held.started().includes(5))

  a.send({ t: 'op', op: 'select', index: 0 })
  await until('episode 1 is on disk again', () => numbersIn(show).includes(1))
  await until('episode 1 plays again', () => hub.room(room.id).items[0].status === 'ready')
  assert.equal(hub.mediaFile(room.id, 0).kind, 'hls')
  await until('what was prepared for where the room was is stopped', () => held.stopped().includes(4) && held.stopped().includes(5))
  a.ws.close()
})

test('a jump many episodes ahead fetches and plays the episode at once; the ones left behind stop, the ones after it follow one at a time', { skip: !hasFfmpeg }, async (t) => {
  const dir = tempDir(t)
  const held = heldEncoding(t, dir)
  const stub = stubSource(20, { video: held.video })
  const hub = makeHub(dir, stub.source, { tools: held.tools })
  await hub.load()
  t.after(() => hub.dispose())
  const { room, path: show } = await hub.fetch({ source: 'stub', id: '42', watch: true })
  const url = await socketServer(t, hub)
  const a = await viewer(url(room.id), 'a', 'Alice')
  await a.next(m => m.t === 'state')
  await until('episode 1 plays and episode 2 is being prepared', () => hub.room(room.id).items[0].status === 'ready' && held.started().includes(2))
  assert.equal(held.started().includes(3), false, 'one episode ahead at a time')

  a.send({ t: 'op', op: 'select', index: 15 })
  await until('the jump target leads a new run', () => stub.calls.some(([from]) => from === 16))
  await until('episode 16 plays', () => hub.room(room.id).items[15].status === 'ready')
  await until('episodes 1 and 2 are no longer prepared', () => held.stopped().includes(1) && held.stopped().includes(2))
  await until('episode 17 is prepared next', () => held.started().includes(17))
  assert.equal(held.started().includes(18), false, 'one episode ahead at a time')
  assert.deepEqual(numbersIn(show).filter(n => n > 3), [16, 17, 18])
  a.ws.close()
})

test('a show kept offline is fetched whole and never trimmed; going back to rolling trims what was watched', async (t) => {
  const dir = tempDir(t)
  const stub = stubSource(6)
  const hub = makeHub(dir, stub.source)
  await hub.load()
  t.after(() => hub.dispose())
  const { path: show } = await hub.fetch({ source: 'stub', id: '42', watch: false, all: true })
  await until('every episode is on disk', () => existsSync(show) && numbersIn(show).length === 6)
  assert.equal((await hub.library()).shows[0].pinned, true)
  assert.equal((await hub.library()).shows[0].download, null)

  const { room } = await hub.createRoom({ source: 'local', path: show, by: 'Alice', fromPanel: true, start: { index: 4, position: 0 } })
  const url = await socketServer(t, hub)
  const a = await viewer(url(room.id), 'a', 'Alice')
  await a.next(m => m.t === 'state')
  for (const index of [4]) {
    a.send({ t: 'op', op: 'duration', index, duration: 100 })
    a.send({ t: 'op', op: 'play', position: 0 })
    await sleep(30)
    a.send({ t: 'op', op: 'ended', from: index })
  }
  a.send({ t: 'op', op: 'select', index: 0 })
  await sleep(300)
  assert.deepEqual(numbersIn(show), [1, 2, 3, 4, 5, 6], 'pinned: nothing is trimmed')

  await hub.pinShow(show, false)
  await until('the watched episode is trimmed once the show rolls again', () => !numbersIn(show).includes(5))
  assert.deepEqual(numbersIn(show), [1, 2, 3, 4, 6])
  a.ws.close()
})

test('an episode deleted by hand stays gone until someone goes to it', async (t) => {
  const dir = tempDir(t)
  const stub = stubSource(8)
  const hub = makeHub(dir, stub.source)
  await hub.load()
  t.after(() => hub.dispose())
  const { path: show } = await hub.fetch({ source: 'stub', id: '42', watch: false })
  await until('the window is on disk', () => existsSync(show) && numbersIn(show).length === 3)
  await hub.removeEpisode(show, numbered(2))
  await hub.pinShow(show, false)
  await sleep(200)
  assert.deepEqual(numbersIn(show), [1, 3], 'not fetched again by a refresh')
  const { room } = await hub.createRoom({ source: 'local', path: show, by: 'Alice', fromPanel: true })
  const url = await socketServer(t, hub)
  const a = await viewer(url(room.id), 'a', 'Alice')
  await a.next(m => m.t === 'state')
  a.send({ t: 'op', op: 'select', index: 1 })
  await until('going to it fetches it again', () => numbersIn(show).includes(2))
  a.ws.close()
})

test('over the cap, the least recently watched episodes of unpinned shows go first, but never one in an open room\'s window; kept shows do not count', async (t) => {
  const dir = tempDir(t)
  const stub = stubSource(6)
  const first = makeHub(dir, stub.source)
  await first.load()
  const a = await first.fetch({ source: 'stub', id: '1', watch: false })
  const b = await first.fetch({ source: 'stub', id: '2', watch: false })
  const kept = await first.fetch({ source: 'stub', id: '3', watch: false, all: true })
  await until('every show is on disk', () => [a, b].every(show => existsSync(show.path) && numbersIn(show.path).length === 3) && numbersIn(kept.path).length === 6)
  const { room } = await first.createRoom({ source: 'local', path: a.path, by: 'Alice', fromPanel: true, start: { index: 4, position: 0 } })
  await until('the room is on episode 5 and its window is fetched', () => [5, 6].every(n => numbersIn(a.path).includes(n)))
  const old = new Date('2026-11-01T00:00:00Z')
  for (const name of filesOf(b.path)) utimesSync(join(b.path, name), old, old)
  await first.dispose()

  // A new start with a small cap: only the window around the open room stays of the unpinned shows.
  const hub = makeHub(dir, stub.source, { cache: { ...cacheOptions, capBytes: 10 } })
  await hub.load()
  t.after(() => hub.dispose())
  assert.equal(hub.room(room.id).index, 4)
  assert.deepEqual(numbersIn(a.path), [5, 6])
  assert.deepEqual(numbersIn(b.path), [])
  assert.deepEqual(numbersIn(kept.path), [1, 2, 3, 4, 5, 6])
  const rows = Object.fromEntries((await hub.library()).shows.map(show => [show.name, [show.episodes, show.total, show.pinned]]))
  assert.deepEqual(rows, { 'Stub show 1': [2, 6, false], 'Stub show 2': [0, 6, false], 'Stub show 3': [6, 6, true] })
})

test('the least recently watched goes first when the cap is only a little exceeded', async (t) => {
  const dir = tempDir(t)
  const stub = stubSource(4)
  const first = makeHub(dir, stub.source)
  await first.load()
  const a = await first.fetch({ source: 'stub', id: '1', watch: false })
  const b = await first.fetch({ source: 'stub', id: '2', watch: false })
  await until('both shows are on disk', () => [a, b].every(show => existsSync(show.path) && numbersIn(show.path).length === 3))
  const old = new Date('2026-11-01T00:00:00Z')
  const older = new Date('2026-10-01T00:00:00Z')
  utimesSync(join(a.path, numbered(1)), old, old)
  utimesSync(join(b.path, numbered(2)), older, older)
  await first.dispose()
  // Six files of 9 bytes ("episode N"), a cap of 45 keeps five: the oldest one goes.
  const hub = makeHub(dir, stub.source, { cache: { ...cacheOptions, capBytes: 45 } })
  await hub.load()
  t.after(() => hub.dispose())
  assert.deepEqual(numbersIn(a.path), [1, 2, 3])
  assert.deepEqual(numbersIn(b.path), [1, 3])
})

test('the watch log records who watched what and where they stopped; history sums it up; reopening continues', async (t) => {
  const dir = tempDir(t)
  const stub = stubSource(2)
  let clock = Date.parse('2026-11-16T20:00:00Z')
  const hub = makeHub(dir, stub.source, { now: () => clock })
  await hub.load()
  t.after(() => hub.dispose())
  const show = join(dir, 'state', 'library', 'Show')
  mkdirSync(show, { recursive: true })
  makeVideo(join(show, '01.mp4'))
  makeVideo(join(show, '02.mp4'))
  const { room } = await hub.createRoom({ source: 'local', path: show, by: 'Alice', fromPanel: true })
  const url = await socketServer(t, hub)
  const a = await viewer(url(room.id), 'a', 'Alice')
  const b = await viewer(url(room.id), 'b', 'Carol')
  /** Both report ready once the episode is prepared; the room then starts after its lead. */
  const bothReady = async (index) => {
    const state = await a.next(m => m.t === 'state' && m.room.index === index && m.room.items.every(item => item.status === 'ready') && m.members.length === 2)
    a.send({ t: 'op', op: 'duration', index, duration: 100 })
    for (const v of [a, b]) v.send({ t: 'op', op: 'ready', gate: state.room.gate.id })
    await a.next(m => m.t === 'state' && m.room.gate === null)
  }
  a.send({ t: 'op', op: 'play', position: 0 })
  await bothReady(0)
  clock += 99_000
  a.send({ t: 'op', op: 'ended', from: 0 })
  await bothReady(1)
  clock += 30_000
  b.ws.close()
  await sleep(50)
  clock += 40_000
  a.ws.close()
  await sleep(50)
  hub.closeRoom(room.id)
  await sleep(50)

  const lines = readFileSync(hub.logFile, 'utf8').trim().split('\n').map(line => JSON.parse(line))
  const types = lines.map(line => line.type)
  for (const type of ['room.opened', 'viewer.joined', 'episode.started', 'episode.finished', 'position', 'viewer.left', 'room.closed']) assert.ok(types.includes(type), type)
  const history = await hub.history()
  assert.equal(history.length, 1)
  assert.equal(history[0].title, 'Show')
  assert.deepEqual(history[0].with.sort(), ['Alice', 'Carol'])
  assert.deepEqual(history[0].episodesFinished, [1])
  assert.equal(history[0].stoppedAt.Carol.episode, 2)
  assert.ok(Math.abs(history[0].stoppedAt.Carol.position - 30) <= 1)

  // As the page's person route asks: the path alone, no source.
  const again = await hub.createRoom({ path: show, by: 'Alice', fromPanel: true })
  const reopened = hub.room(again.room.id)
  assert.equal(reopened.index, 1)

  // Watched marks: episode 1 watched, episode 2 partly, shared by both; Carol left earlier than the shared spot.
  const c = await viewer(url(again.room.id), 'c', 'Alice')
  const state = await c.next(m => m.t === 'state')
  assert.equal(state.room.items[0].watch.finished, true)
  assert.equal(state.room.items[1].watch.finished, false)
  assert.ok(Math.abs(state.room.items[1].watch.position - 70) <= 1)
  const episodes = await hub.episodes(show)
  assert.deepEqual(episodes.map(e => e.watch?.finished ?? null), [true, false])
  const entry = (await hub.library()).shows[0]
  assert.equal(entry.finished, 1)
  assert.deepEqual(entry.stops.map(stop => [stop.viewer, stop.index, Math.round(stop.position)]), [['Carol', 1, 30]])
  c.ws.close()
})

test('watched means from 90 %, at most five minutes and at least three seconds before the end', () => {
  assert.equal(isNearEnd(55, 60), true)
  assert.equal(isNearEnd(50, 60), false)
  assert.equal(isNearEnd(3600 - 299, 3600), true)
  assert.equal(isNearEnd(3600 - 400, 3600), false)
  assert.equal(isNearEnd(6, 10), false)
  assert.equal(isNearEnd(10, null), false)
})

test('search and info answers carry cover routes, never the source\'s picture URLs', async (t) => {
  const dir = tempDir(t)
  const cdn = 'https://cdn.invalid/novel-pic/1~x.heic?x-signature=abc'
  const source = {
    ...stubSource(3).source,
    search: async () => ({ results: [{ id: '1', title: 'A', kind: 'drama', cover: cdn }, { id: '2', title: 'B', kind: 'drama', cover: null }], next: null }),
    info: async () => ({ id: '1', title: 'A', kind: 'drama', episodes: 3, cover: cdn, related: [{ id: '3', title: 'A2', kind: 'drama', relation: 'season', cover: cdn.replace('1~', '3~') }] }),
    cover: async (url, file) => writeFileSync(file, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2])),
  }
  const hub = makeHub(dir, source)
  await hub.load()
  t.after(() => hub.dispose())
  const { results } = await hub.search('stub', 'x')
  const info = await hub.info('stub', '1')
  const wire = JSON.stringify([results, info])
  assert.equal(wire.includes('cdn.invalid'), false)
  assert.match(results[0].cover, /^covers\/[0-9a-f]{32}$/)
  assert.equal(results[1].cover, null)
  assert.equal(info.cover, results[0].cover)
  assert.match(info.related[0].cover, /^covers\/[0-9a-f]{32}$/)
  const picture = await hub.coverFile(results[0].cover.slice('covers/'.length))
  assert.equal(picture.type, 'image/jpeg')
  assert.ok(existsSync(join(dir, 'state', 'covers')))
})

const workSource = (episodes, calls, down = []) => ({
  ...stubSource(episodes).source,
  info: async (id) => {
    calls.push(id)
    if (down.includes(id)) throw new Error('source is down')
    return {
      id, title: `Show ${id}`, kind: 'drama', episodes, score: 8.1, blurb: 'About it', tags: ['t'], cover: `https://cdn.invalid/${id}.heic`,
      episodeTitles: Array.from({ length: episodes }, (_, i) => `Title ${i + 1}`),
      related: [{ id: '77', title: 'Next', kind: 'drama', relation: 'season', cover: 'https://cdn.invalid/77.heic' }],
    }
  },
  cover: async (url, file) => writeFileSync(file, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2])),
})

test('a show saved from a source keeps its work\'s details, covers as routes; episodes and rooms use the real titles', async (t) => {
  const dir = tempDir(t)
  const calls = []
  const hub = makeHub(dir, workSource(3, calls))
  await hub.load()
  t.after(() => hub.dispose())
  const saved = await hub.fetch({ source: 'stub', id: '42', watch: true })
  const show = (await hub.library()).shows[0]
  assert.deepEqual([show.work.title, show.work.score, show.work.blurb, show.work.episodeTitles], ['Show 42', 8.1, 'About it', ['Title 1', 'Title 2', 'Title 3']])
  assert.match(show.work.cover, /^covers\/[0-9a-f]{32}$/)
  assert.match(show.work.related[0].cover, /^covers\/[0-9a-f]{32}$/)
  assert.equal(JSON.stringify(show).includes('cdn.invalid'), false)
  assert.deepEqual((await hub.episodes(saved.path)).map(e => e.title), ['Title 1', 'Title 2', 'Title 3'])
  assert.deepEqual((await hub.roomWork(saved.room.id)).work.related.map(w => w.title), ['Next'])
  assert.equal(calls.length, 1, 'saving asked the source once; the library list never does')
  const [room] = await hub.listRooms()
  assert.match(room.cover, /^covers\/[0-9a-f]{32}$/)
  assert.equal('file' in room, false)
})

test('pages read a work\'s saved copy at once; a missing or day-old copy is asked of its source in the background, once, and a failing source is left alone', async (t) => {
  const dir = tempDir(t)
  const calls = []
  const down = []
  let title = 'Show 1'
  let clock = 1_000
  const base = workSource(2, calls, down)
  const source = { ...base, info: async (id) => { const work = await base.info(id); await sleep(80); return { ...work, title } } }
  const hub = makeHub(dir, source, { now: () => clock })
  await hub.load()
  t.after(() => hub.dispose())
  const saved = await hub.fetch({ source: 'stub', id: '1', watch: false })
  title = 'Show 1 (renamed)'
  calls.length = 0
  clock += 1000
  let listed = Date.now()
  assert.equal((await hub.library()).shows[0].work.title, 'Show 1', 'a fresh copy: shown, no source asked')
  assert.equal(calls.length, 0)
  clock += 25 * 3_600_000
  listed = Date.now()
  assert.equal((await hub.library()).shows[0].work.title, 'Show 1', 'an old copy shows at once')
  assert.ok(Date.now() - listed < 60, 'without waiting for the source')
  await hub.library()
  assert.equal(calls.length, 1, 'one request, shared by the readers meanwhile')
  await until('the answer lands', async () => (await hub.library()).shows[0].work.title === 'Show 1 (renamed)')
  const stamp = (await hub.library()).shows[0].work.at
  assert.equal(stamp, clock, 'stamped with when it was fetched')
  assert.equal((await hub.roomWork((await hub.fetch({ source: 'stub', id: '1', watch: true })).room.id)).work.title, 'Show 1 (renamed)')
  calls.length = 0
  down.push('1')
  clock += 25 * 3_600_000
  await hub.library()
  await until('the failing source was asked', async () => calls.length === 1)
  await sleep(120)
  await hub.library()
  clock += 60_000
  await hub.library()
  await sleep(120)
  assert.equal(calls.length, 1, 'a failing source is left alone for a while')
  assert.equal((await hub.library()).shows[0].work.title, 'Show 1 (renamed)', 'the old copy stays')
  void saved
})

test('open pages are told when the notes change: a watch-state write, a refreshed copy', async (t) => {
  const dir = tempDir(t)
  let clock = 1_000
  const hub = makeHub(dir, workSource(2, []), { changeIntervalMs: 10, now: () => clock })
  await hub.load()
  t.after(() => hub.dispose())
  const saved = await hub.fetch({ source: 'stub', id: '1', watch: false })
  await sleep(60)
  const heard = []
  hub.listenChanges(what => heard.push(...what))
  await hub.keepShow(saved.path, 'me')
  await until('a watch-state write is announced', async () => heard.includes('library'))
  heard.length = 0
  clock += 25 * 3_600_000
  await hub.library()
  await until('the background refresh of the copy is announced', async () => heard.includes('library'))
})

test('two works with one title get two folders in the library, whatever their ids look like', async (t) => {
  const dir = tempDir(t)
  const source = { ...workSource(1, []), info: async id => ({ id, title: 'Same title', kind: 'drama', episodes: 1, episodeTitles: [], related: [] }) }
  const hub = makeHub(dir, source)
  await hub.load()
  t.after(() => hub.dispose())
  const first = await hub.fetch({ source: 'stub', id: 'https://video.example/watch/1', watch: false })
  const second = await hub.fetch({ source: 'stub', id: 'https://video.example/watch/2', watch: false })
  assert.notEqual(first.path, second.path)
  assert.deepEqual([dirname(first.path), dirname(second.path)], [join(dir, 'state', 'library'), join(dir, 'state', 'library')], 'both directly in the library')
  assert.match(basename(second.path), /^Same title \([0-9a-f]{8}\)$/)
})

test('saving a work already in the library reuses its show: one folder, no second copy', async (t) => {
  const dir = tempDir(t)
  const hub = makeHub(dir, workSource(3, []))
  await hub.load()
  t.after(() => hub.dispose())
  const first = await hub.fetch({ source: 'stub', id: '42', watch: false })
  const again = await hub.fetch({ source: 'stub', id: '42', watch: false })
  const all = await hub.fetch({ source: 'stub', id: '42', watch: false, all: true })
  assert.deepEqual([again.path, all.path], [first.path, first.path])
  const shows = (await hub.library()).shows
  assert.equal(shows.length, 1)
  assert.equal(shows[0].pinned, true, 'asking for all of it keeps the one show offline')
})

test('a room waiting on a download sees its progress, plays the episode while it downloads with the captions beside it, and keeps playing it when the file lands; fetched with the account of whoever opened the room', { skip: !hasFfmpeg }, async (t) => {
  const dir = tempDir(t)
  const sample = join(dir, 'sample.mp4')
  makeVideo(sample, { seconds: 1 })
  // What a site sends while it is fetched: fragments readable from the start, a key frame every two seconds.
  const part = join(dir, 'part0.mp4')
  makeVideo(part, { seconds: 14, faststart: false, extra: ['-g', '20', '-movflags', 'frag_keyframe+empty_moov'] })
  const asked = []
  let release = null
  const source = {
    id: 'stub',
    label: 'Stub',
    kinds: [{ id: 'video', label: 'Video' }],
    available: async () => true,
    info: async id => ({ id, title: 'Talk', kind: 'video', episodes: 1 }),
    async download({ dir: show, from, person, language, onStart, onProgress, onPartial, onEpisode }) {
      asked.push({ person, language })
      mkdirSync(show, { recursive: true })
      onStart?.(from)
      onProgress?.(from, { fraction: 0, done: 0, total: 2000, speed: null, eta: null })
      onProgress?.(from, { fraction: 0.5, done: 1000, total: 2000, speed: 500, eta: 2 })
      const caption = join(show, '01 Talk.fr.vtt')
      writeFileSync(caption, 'WEBVTT\n\n00:00.000 --> 00:00.500\nBonjour\n')
      const complete = new Promise((done) => { release = done })
      onPartial?.(from, { files: [part], subtitles: [{ path: caption, label: 'fr' }], growing: complete })
      await complete
      writeFileSync(join(show, '01 Talk.mp4'), readFileSync(sample))
      onEpisode()
      return { failed: [] }
    },
  }
  const hub = makeHub(dir, source, { cache: { ahead: 0, behind: 0, capBytes: 0 } })
  await hub.load()
  t.after(async () => { release?.(); await hub.dispose() })
  const fetched = await hub.fetch({ source: 'stub', id: 'talk', watch: true, by: 'Ann', person: 'sub-ann', language: 'fr' })
  const room = fetched.room.id
  await until('the half-way point reaches the room', () => hub.room(room).items[0].progress?.fraction === 0.5)
  assert.deepEqual(hub.room(room).items[0].progress, { step: 'download', fraction: 0.5, done: 1000, total: 2000, speed: 500, eta: 2 })
  assert.deepEqual(asked, [{ person: 'sub-ann', language: 'fr' }], 'the show keeps whose account and the viewer\'s language')
  await until('the episode plays before its download ends', () => hub.room(room).items[0].status === 'ready', 15000)
  assert.equal(hub.mediaFile(room, 0).kind, 'hls')
  assert.equal(hub.room(room).items[0].progress, null)
  assert.deepEqual(hub.room(room).items[0].subtitles, ['fr'])
  release()
  await until('the file lands', () => existsSync(join(fetched.path, '01 Talk.mp4')))
  await sleep(300)
  assert.equal(hub.room(room).items[0].status, 'ready', 'the room keeps playing what it plays')
  assert.equal(hub.mediaFile(room, 0).kind, 'hls')

  hub.closeRoom(room)
  await hub.removeEpisode(fetched.path, '01 Talk.mp4')
  assert.deepEqual(readdirSync(fetched.path).filter(name => !name.startsWith('.') && name !== 'SHA256SUMS.txt'), [], 'its subtitles go with the episode')
  const again = await hub.createRoom({ path: fetched.path, fromPanel: true, by: 'Bo', person: 'sub-bo' })
  await until('the episode is fetched again for the new room', () => asked.length === 2)
  assert.equal(asked[1].person, 'sub-bo', 'a room fetches with the account of the person who opened it')
  release()
  hub.closeRoom(again.room.id)
})

test('a download that fails says why to the room waiting on it and to the library', async (t) => {
  const dir = tempDir(t)
  const source = {
    id: 'stub',
    label: 'Stub',
    kinds: [{ id: 'video', label: 'Video' }],
    available: async () => true,
    info: async id => ({ id, title: 'Locked', kind: 'video', episodes: 1 }),
    async download() {
      throw Object.assign(new Error('the site wants a signed-in account'), { code: 'source_failed', reason: 'sign_in' })
    },
  }
  const hub = makeHub(dir, source)
  await hub.load()
  t.after(() => hub.dispose())
  const fetched = await hub.fetch({ source: 'stub', id: 'locked', watch: true, by: 'Ann' })
  await until('the episode shows as failed', () => hub.room(fetched.room.id).items[0].status === 'failed')
  assert.equal(hub.room(fetched.room.id).items[0].reason, 'sign_in')
  const [show] = (await hub.library()).shows
  assert.equal(show.download.reason, 'sign_in')
})

test('with the points plugin, starting a series new to the hub is an extra; going on with it, a later season of it or a film is not', async (t) => {
  const dir = tempDir(t)
  const points = fakePoints({ ann: 100 })
  const calls = []
  const films = { ...workSource(1, calls), id: 'films' }
  const plain = workSource(3, calls)
  // 42 and 77 are two seasons of one series, each listing the other; 50 and 51 stand alone
  const series = { ...plain, info: async id => ({ ...(await plain.info(id)), related: { 42: [{ id: '77', title: 'Next', relation: 'season' }], 77: [{ id: '42', title: 'First', relation: 'season' }] }[id] ?? [] }) }
  const hub = makeHub(dir, series, { sources: [series, films], points: () => points, bingeNight: { from: '00:00', to: '00:01' } })
  await hub.load()
  t.after(() => hub.dispose())
  await assert.rejects(hub.fetch({ source: 'stub', id: '42', person: 'ann' }), error => error.code === 'points' && error.points.item === 'media:new_series')
  assert.equal((await hub.library()).shows.length, 0, 'nothing is saved before the yes')
  points.buy('ann', 'media:new_series', 'media:series:stub:42')
  await hub.fetch({ source: 'stub', id: '42', watch: false, person: 'ann' })
  await hub.fetch({ source: 'stub', id: '42', watch: false, person: 'ann' })        // going on with it
  await hub.fetch({ source: 'stub', id: '77', watch: false, person: 'ann' })        // 42's next season (related, relation season)
  await hub.fetch({ source: 'films', id: '9', watch: false, person: 'ann' })        // one episode
  await hub.fetch({ source: 'stub', id: '50', watch: false })                       // nobody signed in
  await assert.rejects(hub.fetch({ source: 'stub', id: '51', watch: false, person: 'ann' }), error => error.code === 'points')
  assert.deepEqual(points.calls.filter(c => c[0] === 'buy' || c[0] === 'use').map(c => [c[0], c.at(-1)]),
    [['buy', 'media:series:stub:42'], ['use', 'media:series:stub:42']])
  assert.equal(points.players.ann, 70)
})

test('late at night, starting to watch is a binge night: one ticket for the whole night, used per room; a room is never stopped', async (t) => {
  const dir = tempDir(t)
  const points = fakePoints({ ann: 100 })
  const films = { ...workSource(1, []), id: 'films' }
  const hub = makeHub(dir, films, { sources: [films], points: () => points, bingeNight: { from: '01:00', to: '06:00' }, now: () => new Date(2026, 10, 18, 2, 0).getTime() })
  await hub.load()
  t.after(() => hub.dispose())
  const saved = await hub.fetch({ source: 'films', id: '9', watch: false, person: 'ann' })     // saving isn't watching
  await assert.rejects(hub.createRoom({ source: 'local', path: saved.path, person: 'ann' }), error => error.points?.item === 'media:binge_night')
  points.buy('ann', 'media:binge_night', 'media:binge:2026-11-18')
  const first = await hub.createRoom({ source: 'local', path: saved.path, person: 'ann' })
  const second = await hub.createRoom({ source: 'local', path: saved.path, person: 'ann' })
  await hub.createRoom({ source: 'local', path: saved.path })                                    // the assistant's tool: nobody in particular
  const calls = points.calls.filter(c => c[0] === 'buy' || c[0] === 'use').map(c => [c[0], c.at(-1)])
  assert.deepEqual(calls, [['buy', 'media:binge:2026-11-18'], ['use', `media:start:${first.room.id}`], ['use', `media:start:${second.room.id}`]])
  assert.equal(points.players.ann, 60)
})

test('a saved show outside the library folders is left alone: the hub still starts and the cache cap still runs', async (t) => {
  const dir = tempDir(t)
  mkdirSync(join(dir, 'state'), { recursive: true })
  const outside = join(dir, 'removed-root', 'Old show')
  writeFileSync(join(dir, 'state', 'shows.json'), JSON.stringify({ shows: { [outside]: { source: { source: 'stub', id: '7', kind: 'drama', episodes: 3 }, pinned: true } } }))
  const warnings = []
  const logger = { info() {}, warn: (...args) => warnings.push(args.join(' ')) }
  const hub = makeHub(dir, stubSource(3).source, { cache: { ...cacheOptions, capBytes: 1e9 }, logger })
  t.after(() => hub.dispose())
  await hub.load()
  assert.deepEqual((await hub.library()).shows, [])
  const fetched = await hub.fetch({ source: 'stub', id: '42' })
  await until('the window is cached', () => numbersIn(fetched.path).length === 3)
  await hub.fetch({ source: 'stub', id: '43' })
  assert.deepEqual(warnings, [])
})
