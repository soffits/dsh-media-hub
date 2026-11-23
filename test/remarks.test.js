import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { createDelivery } from '../src/delivery.js'
import { createMediaHub } from '../src/media.js'
import { AUTO, heightChoices } from '../src/quality.js'
import { createCommandSource, parseComments, parseDanmaku } from '../src/sources/command.js'
import { quietLogger, tempDir } from './helpers.js'

const FAKE = fileURLToPath(new URL('./fixtures/fake-source.mjs', import.meta.url))
const ID = '7600000000000000001'
const KINDS = [{ id: 'drama', label: 'Short dramas', danmaku: true, comments: true }, { id: 'audio', label: 'Audiobooks' }]
const sleep = ms => new Promise(done => setTimeout(done, ms))

async function until(what, check, timeoutMs = 5000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    if (await check()) return
    await sleep(20)
  }
  assert.fail(`timed out: ${what}`)
}

function fakeSource(t, log, delayMs = 5) {
  return createCommandSource({ id: 'stub', label: 'Stub', kinds: KINDS, command: [FAKE], env: { FAKE_SOURCE_LOG: log, FAKE_SOURCE_EPISODES: '6', FAKE_SOURCE_DELAY_MS: String(delayMs) } }, { logger: quietLogger, cwd: join(tempDir(), 'work') })
}

const logOf = log => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [])

test('a source offers qualities only when there is a choice; heights come best first after auto', () => {
  assert.deepEqual(heightChoices(['720', '1080', '1080', 'x', '90']), [AUTO, '1080', '720'])
  assert.deepEqual(heightChoices(['1080']), [], 'one height is no choice')
  assert.deepEqual(heightChoices(undefined), [])
})

test('danmaku answers become the asked episode\'s items in time order; unusable ones are dropped', () => {
  const lines = [
    { episode: 1, items: [{ time: 1, text: 'one' }] },
    { episode: 2, items: [{ time: 9, text: '  late\n one ' }, { time: 2, text: 'early', likes: 3 }, { time: -1, text: 'bad' }, { time: 4, text: '' }, { text: 'no time' }] },
  ]
  assert.deepEqual(parseDanmaku(lines, 2), [{ time: 2, text: 'early', likes: 3 }, { time: 9, text: 'late one', likes: 0 }])
  assert.throws(() => parseDanmaku([{ episode: 1 }], 1), { code: 'source_failed' })
})

test('comments answers keep who wrote what and when, and where the next page starts', () => {
  const page = parseComments({ total: 3, items: [{ id: 'a', user: { name: 'Ann' }, text: 'Great', created: '2026-11-16T16:43:38Z', likes: 4, replies: 1, rating: 10 }, { id: 'b', text: '' }, { text: 'no id' }], next_cursor: 'abc' })
  assert.deepEqual(page, { total: 3, items: [{ id: 'a', name: 'Ann', text: 'Great', created: '2026-11-16T16:43:38.000Z', likes: 4, replies: 1, rating: 10 }], next: 'abc' })
  assert.equal(parseComments({ items: [] , next_cursor: 'abc' }).next, null, 'an empty page ends the list')
})

test('the command source asks for danmaku, comments and a quality only where its kinds offer them', async (t) => {
  const log = join(tempDir(), 'log')
  const source = fakeSource(t, log)
  assert.deepEqual((await source.info(ID)).qualities, [AUTO, '1080', '720'])
  assert.deepEqual(await source.danmaku(ID, 2, 'drama'), [{ time: 1.5, text: '来了', likes: 0 }, { time: 3, text: '第2集 好看', likes: 2 }])
  const first = await source.comments(ID, 'drama')
  assert.deepEqual([first.items.map(item => item.name), first.next, first.total], [['观众1', '观众2'], 'c2', 4])
  assert.deepEqual((await source.comments(ID, 'drama', { cursor: 'c2' })).items.map(item => item.id), ['c3', 'c4'])
  await assert.rejects(source.danmaku(ID, 1, 'audio'), { code: 'invalid' })
  await assert.rejects(source.comments(ID, 'audio'), { code: 'invalid' })
  await source.download({ id: ID, dir: join(tempDir(), 'show'), from: 1, to: 1, quality: '720' })
  await source.download({ id: ID, dir: join(tempDir(), 'other'), from: 1, to: 1, quality: AUTO })
  assert.deepEqual(logOf(log), ['danmaku 2', 'comments first', 'comments c2', '1@720', '1'])
})

function makeHub(dir, source) {
  return createMediaHub({
    stateDir: join(dir, 'state'),
    libraryRoots: [join(dir, 'state', 'library')],
    delivery: createDelivery({ mode: 'origin' }),
    tools: { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe', maxHeight: 1080, threads: 1 },
    webUrl: () => 'https://dsh.example.com/',
    lifetime: { emptyMinutes: 30, unopenedHours: 24 },
    autoDeleteDays: 7,
    sources: [source],
    cache: { ahead: 2, behind: 1, capBytes: 0 },
    logger: quietLogger,
    fetchTitle: async id => `Title of ${id}`,
  })
}

test('a room reads its episode\'s danmaku and its work\'s comments from copies kept with the show, asked again once old', async (t) => {
  const dir = tempDir()
  const log = join(dir, 'log')
  const hub = makeHub(dir, fakeSource(t, log))
  await hub.load()
  t.after(() => hub.dispose())
  const { room, path } = await hub.fetch({ source: 'stub', id: ID, watch: true, by: 'Ann' })
  const work = hub.roomWork(room.id)
  assert.deepEqual([work.danmaku, work.comments, work.quality, work.work.qualities], [true, true, AUTO, [AUTO, '1080', '720']])

  const danmaku = await hub.roomDanmaku(room.id, 0)
  assert.deepEqual(danmaku.items.map(item => item.text), ['来了', '第1集 好看'])
  await until('the next episode\'s danmaku is ready too', () => existsSync(join(path, '.source', 'danmaku', '2.json')))
  assert.deepEqual((await hub.roomDanmaku(room.id, 0)).items, danmaku.items)
  assert.deepEqual(logOf(log).filter(line => line.startsWith('danmaku')), ['danmaku 1', 'danmaku 2'], 'the kept copy answers the second time')

  const comments = await hub.roomComments(room.id)
  assert.deepEqual([comments.items.length, comments.next], [2, 'c2'])
  assert.deepEqual((await hub.roomComments(room.id, 'c2')).items.map(item => item.id), ['c3', 'c4'])
  await hub.roomComments(room.id)
  assert.equal(logOf(log).filter(line => line.startsWith('comments')).length, 2, 'the first page comes from the copy, later pages from the source')

  const kept = join(path, '.source', 'comments.json')
  const copy = JSON.parse(readFileSync(kept, 'utf8'))
  writeFileSync(kept, JSON.stringify({ ...copy, at: copy.at - 2 * 3_600_000 }))
  assert.equal((await hub.roomComments(room.id)).items.length, 2, 'an old copy still answers at once')
  await until('an old copy is asked for again in the background', () => logOf(log).filter(line => line === 'comments first').length === 2)
})

test('picking a quality in a room fetches what lies ahead again in it, for everyone; the episode being watched stays', async (t) => {
  const dir = tempDir()
  const log = join(dir, 'log')
  const hub = makeHub(dir, fakeSource(t, log, 150))
  await hub.load()
  t.after(() => hub.dispose())
  const { room, path } = await hub.fetch({ source: 'stub', id: ID, watch: true, by: 'Ann' })
  const onDisk = () => readdirSync(path).filter(name => name.endsWith('.mp4')).length
  await until('the first episode is on disk, the next still coming', () => existsSync(join(path, '01 第1集.mp4')))
  await assert.rejects(hub.roomQuality(room.id, '480'), { code: 'invalid' })
  assert.deepEqual(await hub.roomQuality(room.id, '720'), { quality: '720' }, 'a download under way does not hold the change up')
  assert.equal(hub.roomWork(room.id).quality, '720')
  await until('the episodes ahead come again in the new quality', () => logOf(log).at(-1) === '2-3@720' && onDisk() === 3)
  assert.equal(existsSync(join(path, '01 第1集.mp4')), true)
})
