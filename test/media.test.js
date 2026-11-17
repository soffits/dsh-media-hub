import assert from 'node:assert/strict'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, utimesSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { test } from 'node:test'
import { createDelivery } from '../src/delivery.js'
import { createMediaHub } from '../src/media.js'
import { isNearEnd } from '../src/watchlog.js'
import { makeVideo, quietLogger, socketServer, tempDir, viewer } from './helpers.js'

const tools = { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe', maxHeight: 1080, threads: 1 }
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
 * A source of `episodes` small files. `calls` records each run's range.
 * Gated, every episode waits for `next()`; otherwise they land at once.
 */
function stubSource(episodes = 3, { gated = false } = {}) {
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
        writeFileSync(join(dir, `.${name}.part`), `episode ${n}`)
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

  const watchThrough = async (index) => {
    a.send({ t: 'op', op: 'duration', index, duration: 100 })
    a.send({ t: 'op', op: 'play', position: 0 })
    await sleep(30)
    clock += 99_000
    a.send({ t: 'op', op: 'ended', from: index })
    await sleep(60)
  }
  await watchThrough(0)
  await until('episode 4 is fetched as the window moves', () => numbersIn(show).includes(4))
  assert.deepEqual(numbersIn(show), [1, 2, 3, 4], 'one behind stays')
  await watchThrough(1)
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

  const again = await hub.createRoom({ source: 'local', path: show, by: 'Alice', fromPanel: true })
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
  assert.deepEqual(hub.roomWork(saved.room.id).work.related.map(w => w.title), ['Next'])
  assert.equal(calls.length, 1, 'saving asked the source once')
  const [room] = await hub.listRooms()
  assert.match(room.cover, /^covers\/[0-9a-f]{32}$/)
  assert.equal('file' in room, false)
})

test('shows saved before details were kept get them once, one request at a time; a failure waits for a refresh by hand', async (t) => {
  const dir = tempDir(t)
  const calls = []
  const first = makeHub(dir, workSource(2, calls))
  await first.load()
  for (const id of ['1', 'bad', '2']) await first.fetch({ source: 'stub', id, watch: false })
  await first.dispose()
  // The notes as an older version left them: no details.
  const file = join(dir, 'state', 'shows.json')
  const notes = JSON.parse(readFileSync(file, 'utf8'))
  for (const entry of Object.values(notes.shows)) { delete entry.work; delete entry.workTriedAt }
  writeFileSync(file, JSON.stringify(notes))
  calls.length = 0
  const hub = makeHub(dir, workSource(2, calls, ['bad']), { backfillPauseMs: 30 })
  t.after(() => hub.dispose())
  await hub.load()
  await until('every show was asked once', () => calls.length === 3)
  await sleep(200)
  assert.deepEqual(calls.sort(), ['1', '2', 'bad'], 'one request per show, none repeated')
  const shows = (await hub.library()).shows
  assert.deepEqual(shows.filter(show => show.work).map(show => show.work.title).sort(), ['Show 1', 'Show 2'])
  const failed = shows.find(show => !show.work)
  await assert.rejects(hub.refreshWork(failed.path), /source is down/)
  assert.equal(calls.filter(id => id === 'bad').length, 2, 'only the refresh by hand asked again')
  const refreshed = await hub.refreshWork(shows.find(show => show.work).path)
  assert.equal(refreshed.title.startsWith('Show'), true)
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
