import assert from 'node:assert/strict'
import { chmodSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { createCommandSource, parseInfo, parseSearch } from '../src/sources/command.js'
import { commandExists } from '../src/sources/process.js'
import { createProxies } from '../src/proxy.js'
import { createSources, describeSources } from '../src/sources/index.js'
import { quietLogger, tempDir } from './helpers.js'

const FAKE = fileURLToPath(new URL('./fixtures/fake-source.mjs', import.meta.url))
const KINDS = [{ id: 'drama', label: 'Short dramas' }, { id: 'audio', label: 'Audiobooks' }]
const ID = '7600000000000000001'
const LONG_ID = '7600000000000000004'

const stub = (t, extra = {}) => createCommandSource({ id: 'stub', label: 'Stub', kinds: KINDS, command: [FAKE], ...extra }, { logger: quietLogger, cwd: join(tempDir(t), 'work') })

test('search documents become results; hits of undeclared kinds and unusable ones are dropped', () => {
  const document = {
    results: [
      { id: '1', title: '总裁是我前女友', author: '某公司', kind: 'drama', score: 8, blurb: '年少相爱 \n 多年后重逢。' },
      { id: '2', title: '某小说', author: '某人', kind: 'novel', score: 7 },
      { id: '', title: 'no id', kind: 'drama' },
      null,
      { id: 3, title: '初尝玫瑰！', kind: 'audio', score: 'bad' },
    ],
  }
  const bare = { cover: null, url: null, duration: null, popularity: null, status: '', tags: [], latest: '', meta: [], episodes: null, year: null, language: '', publisher: '', origin: '', formats: [], bytes: null }
  assert.deepEqual(parseSearch(document, KINDS), [
    { id: '1', title: '总裁是我前女友', author: '某公司', kind: 'drama', score: 8, blurb: '年少相爱 多年后重逢。', ...bare },
    { id: '3', title: '初尝玫瑰！', author: '', kind: 'audio', score: null, blurb: '', ...bare },
  ])
  assert.throws(() => parseSearch({}, KINDS), { code: 'source_failed' })
})

test('the optional descriptive fields are read when well formed and ignored when not', () => {
  const [full, junk] = parseSearch({
    results: [
      {
        id: '1', kind: 'drama', title: 'x', cover: 'https://cdn.example/c.heic', episode_count: 60, status: 'finished', latest: '第60集',
        popularity: { count: 36670.4, label: 'plays', text: '3.6万' }, tags: ['都市', '', 5, '总裁'],
        meta: [{ key: 'cast', label: 'Cast', value: 'A,B' }, { label: 'Empty', value: '' }, { key: 'k', value: 'no label' }, 'junk'],
      },
      { id: '2', kind: 'drama', cover: 'ftp://x/c.jpg', episode_count: -1, status: 'weird', popularity: { count: -5, label: 'plays' }, tags: 'no', meta: 'no' },
    ],
  }, KINDS)
  assert.deepEqual(
    [full.cover, full.episodes, full.status, full.latest, full.popularity, full.tags, full.meta],
    ['https://cdn.example/c.heic', 60, 'finished', '第60集', { count: 36670, label: 'plays', text: '3.6万' }, ['都市', '5', '总裁'], [{ key: 'cast', label: 'Cast', value: 'A,B' }]],
  )
  assert.deepEqual([junk.cover, junk.episodes, junk.status, junk.popularity, junk.tags, junk.meta], [null, null, '', null, [], []])
  assert.equal(parseSearch({ results: [{ id: '1', kind: 'drama', popularity: { count: 3, label: '' } }] }, KINDS)[0].popularity, null)
})

test('an info document becomes one result whose episode count is the length of its list', () => {
  const info = parseInfo({ id: '9', title: '初尝玫瑰！', kind: 'drama', author: '云景文化', status: 'finished', score: 8.2, blurb: '温薏成长于书香家庭。', episodes: [{ number: 1, title: '第1集' }, { number: 2, title: '第2集' }] })
  assert.deepEqual(info, { id: '9', title: '初尝玫瑰！', kind: 'drama', author: '云景文化', status: 'finished', episodes: 2, episodeTitles: ['第1集', '第2集'], score: 8.2, blurb: '温薏成长于书香家庭。', cover: null, url: null, duration: null, popularity: null, tags: [], latest: '', meta: [], year: null, language: '', publisher: '', origin: '', formats: [], bytes: null, related: [] })
  assert.equal(parseInfo({ id: '9', title: 'x', episode_count: 40 }).episodes, null, 'a count without a list is not an episode list')
  assert.throws(() => parseInfo({ title: 'no id' }), { code: 'source_failed' })
})

test('related works keep their relation and facts; the work itself and unusable ones are left out', () => {
  const { related } = parseInfo({
    id: '9', title: '第一季', kind: 'drama',
    related: [
      { id: '10', title: '第二季', kind: 'drama', relation: 'season', episode_count: 200, cover: 'https://cdn.example/b.heic' },
      { id: '9', title: 'itself', kind: 'drama' },
      { id: '11', title: '有声书', kind: 'audio' },
      { title: 'no id' },
    ],
  })
  assert.deepEqual(related.map(w => [w.id, w.relation, w.episodes, w.cover]), [['10', 'season', 200, 'https://cdn.example/b.heic'], ['11', '', null, null]])
})

test('the command source drives the command: search, info, download into a folder in order', async (t) => {
  const source = stub(t)
  assert.equal(await source.available(), true)
  assert.deepEqual((await source.search('测试')).results.map(r => [r.title, r.kind]), [['测试短剧', 'drama'], ['测试短剧第二季', 'drama']])
  assert.deepEqual((await source.search('测试', { kind: 'audio' })).results.map(r => r.kind), ['audio'])
  await assert.rejects(source.search('x', { kind: 'novel' }), { code: 'invalid' })
  assert.deepEqual(await source.search('   '), { results: [], next: null })
  assert.equal((await source.info(ID)).episodes, 3)
  await assert.rejects(source.info('7600000000000000009'), { code: 'source_failed', message: /Stub: error: no such work/ })

  const dir = join(tempDir(t), 'show')
  let calls = 0
  const result = await source.download({ id: ID, dir, onEpisode: () => { calls += 1 } })
  assert.deepEqual(result, { failed: [] })
  assert.deepEqual(readdirSync(dir).sort(), ['01 第1集.mp4', '02 第2集.mp4', '03 第3集.mp4'])
  assert.ok(calls >= 3)
})

test('a download of a range fetches only those episodes and says which one it is on', async (t) => {
  const source = stub(t)
  const dir = join(tempDir(t), 'show')
  const started = []
  await source.download({ id: LONG_ID, dir, from: 4, to: 6, onStart: n => started.push(n) })
  assert.deepEqual(readdirSync(dir).sort(), ['04 第4集.mp4', '05 第5集.mp4', '06 第6集.mp4'])
  assert.deepEqual(started, [4, 5, 6])
  await source.download({ id: LONG_ID, dir, from: 6, to: 8, onStart: n => started.push(n) })
  assert.deepEqual(started, [4, 5, 6, 7, 8], 'finished files are skipped, the rest of the range is fetched')
  await source.download({ id: LONG_ID, dir, from: 12 })
  assert.equal(readdirSync(dir).includes('12 第12集.mp4'), true)
})

test('fixed arguments and environment from the configuration reach the command', async (t) => {
  const source = stub(t, { command: [FAKE, '--proxy', 'x'], env: { FAKE_SOURCE_EPISODES: '5' } })
  assert.equal((await source.info(ID)).episodes, 5)
})

test('the command runs in its own folder, not in the host\'s', async (t) => {
  const stateDir = tempDir(t)
  const [source] = createSources([{ id: 'stub', label: 'Stub', kinds: KINDS, command: [FAKE], env: {} }], { stateDir, logger: quietLogger })
  await source.info(ID)
  assert.deepEqual(readdirSync(join(stateDir, 'stub')), [])
})

test('a cancelled download stops the command', async (t) => {
  const source = stub(t, { env: { FAKE_SOURCE_DELAY_MS: '400' } })
  const dir = join(tempDir(t), 'show')
  const controller = new AbortController()
  setTimeout(() => controller.abort(), 600)
  await source.download({ id: ID, dir, signal: controller.signal })
  assert.ok(readdirSync(dir).filter(name => name.endsWith('.mp4')).length < 3)
})

test('an episode the command reports failed comes back as failed; the others stay', async (t) => {
  const source = stub(t, { env: { FAKE_SOURCE_FAIL: '2' } })
  const dir = join(tempDir(t), 'show')
  assert.deepEqual(await source.download({ id: ID, dir }), { failed: ['02 第2集.mp4'] })
  assert.deepEqual(readdirSync(dir).sort(), ['01 第1集.mp4', '03 第3集.mp4'])
})

test('a file whose hash is not the one reported is removed and counted as failed', async (t) => {
  const source = stub(t, { env: { FAKE_SOURCE_BAD_HASH: '2' } })
  const dir = join(tempDir(t), 'show')
  assert.deepEqual(await source.download({ id: ID, dir }), { failed: ['02 第2集.mp4'] })
  assert.deepEqual(readdirSync(dir).sort(), ['01 第1集.mp4', '03 第3集.mp4'])
})

test('a command that fails, prints no JSON or ends without a result is a source failure', async (t) => {
  const script = (body) => {
    const path = join(tempDir(t), 'cmd.sh')
    writeFileSync(path, `#!/bin/sh\n${body}\n`)
    chmodSync(path, 0o755)
    return path
  }
  const dir = join(tempDir(t), 'show')
  const failing = stub(t, { command: [script('echo "login expired" >&2; exit 3')] })
  await assert.rejects(failing.info(ID), { code: 'source_failed', message: 'Stub: login expired' })
  await assert.rejects(failing.download({ id: ID, dir }), { code: 'source_failed', message: 'Stub: login expired' })
  const text = stub(t, { command: [script('echo hello')] })
  await assert.rejects(text.info(ID), { message: 'Stub: the answer is not JSON' })
  await assert.rejects(text.download({ id: ID, dir }), { message: 'Stub: the download ended without a result' })
  const noisy = stub(t, { command: [script('echo "{\\"event\\": \\"result\\"}"; echo some text; echo 42')] })
  assert.deepEqual(await noisy.download({ id: ID, dir }), { failed: [] })
})

test('ids and kinds are checked before the command runs', async (t) => {
  const source = stub(t)
  await assert.rejects(source.info('a b'), { code: 'invalid' })
  await assert.rejects(source.download({ id: '', dir: tempDir(t) }), { code: 'invalid' })
})

test('sources are listed in order, then Link; ids may not repeat or take an id of the hub\'s own; one without its program is hidden', async (t) => {
  const definition = id => ({ id, label: id, kinds: KINDS, command: [FAKE], env: {} })
  const link = { ytDlp: 'surely-not-yt-dlp-here', proxies: createProxies([]), maxHeight: 1080 }
  const sources = createSources([definition('one'), definition('two')], { stateDir: tempDir(t), logger: quietLogger, link })
  assert.deepEqual(sources.map(s => s.id), ['one', 'two', 'link'], 'Link comes last')
  assert.throws(() => createSources([definition('one'), definition('one')], { stateDir: tempDir(t), logger: quietLogger, link }), /twice/)
  assert.throws(() => createSources([{ ...definition('empty'), kinds: [] }], { stateDir: tempDir(t), logger: quietLogger, link }), /no kinds/)
  assert.throws(() => createSources([definition('link')], { stateDir: tempDir(t), logger: quietLogger, link }), /reserved/)
  const missing = createSources([definition('one'), { ...definition('gone'), command: ['surely-not-a-command-here'] }], { stateDir: tempDir(t), logger: quietLogger, link })
  assert.deepEqual((await describeSources(missing)).map(s => s.id), ['one'])
  assert.equal(await commandExists('surely-not-a-command-here'), false)
  assert.equal(await commandExists('node'), true)
})

test('the cover verb writes the picture where asked and its failure is the last stderr line', async (t) => {
  const dir = tempDir(t)
  const source = stub(t)
  const url = 'https://cdn.invalid/novel-pic/7600000000000000001~tplv-600.heic'
  await source.cover(url, join(dir, 'c.img'))
  assert.equal(readFileSync(join(dir, 'c.img')).subarray(1, 4).toString(), 'PNG')
  await assert.rejects(source.cover('file:///etc/passwd', join(dir, 'x.img')), { code: 'invalid' })
  const failing = stub(t, { env: { FAKE_SOURCE_COVER_FAIL: '1' } })
  await assert.rejects(failing.cover(url, join(dir, 'y.img')), { code: 'source_failed', message: /Stub: error: cover cdn is unreachable/ })
})

test('a source that has more pages says where the next one starts, and is asked from there', async (t) => {
  const { nextOffset } = await import('../src/sources/command.js')
  assert.equal(nextOffset({ next: 20 }, 10), 20)
  assert.equal(nextOffset({ next: 10 }, 10), null, 'a next that does not move on ends the list')
  assert.equal(nextOffset({ next: 'x' }), null)
  assert.equal(nextOffset({}), null)
  const source = stub(t)
  const first = await source.search('分页')
  assert.deepEqual([first.results.map(r => r.title), first.next], [['分页甲', '分页乙'], 2])
  const second = await source.search('分页', { offset: 2 })
  assert.deepEqual([second.results.map(r => r.title), second.next], [['分页丙'], null])
})
