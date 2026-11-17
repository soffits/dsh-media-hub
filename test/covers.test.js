import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { coverKey, createCovers, imageType } from '../src/covers.js'
import { createCommandSource } from '../src/sources/command.js'
import { hasFfmpeg, makeVideo, quietLogger, tempDir } from './helpers.js'

const FAKE = fileURLToPath(new URL('./fixtures/fake-source.mjs', import.meta.url))
const KINDS = [{ id: 'drama', label: 'Short dramas' }]
const url = n => `https://cdn.invalid/novel-pic/760000000000000000${n}~tplv-600.heic?x-signature=abc`

function setup(t, { env = {}, ...options } = {}) {
  const dir = tempDir(t)
  const log = join(dir, 'cover-calls.txt')
  const source = createCommandSource({ id: 'stub', label: 'Stub', kinds: KINDS, command: [FAKE], env: { FAKE_SOURCE_COVER_LOG: log, ...env } }, { logger: quietLogger, cwd: join(dir, 'work') })
  const covers = createCovers({ dir: join(dir, 'covers'), logger: quietLogger, ...options }, id => (id === 'stub' ? source : undefined))
  const calls = () => (existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean) : [])
  return { dir, covers, calls, files: () => readdirSync(join(dir, 'covers')).sort() }
}

test('a registered cover is a route; the browser never gets the URL, and the key is stable per source and URL', (t) => {
  const { covers } = setup(t)
  const route = covers.ofSource('stub', url(1))
  assert.match(route, /^covers\/[0-9a-f]{32}$/)
  assert.equal(route, covers.ofSource('stub', url(1)))
  assert.notEqual(route, covers.ofSource('stub', url(2)))
  assert.notEqual(route, covers.ofSource('other', url(1)))
  assert.equal(route.includes('cdn.invalid'), false)
  assert.equal(covers.ofSource('stub', ''), null)
  assert.equal(covers.ofSource('stub', undefined), null)
  const work = covers.decorate('stub', { id: '1', cover: url(1), related: [{ id: '2', cover: url(2) }, { id: '3', cover: null }] })
  assert.deepEqual([work.cover, work.related[0].cover, work.related[1].cover].map(c => c?.slice(0, 7) ?? null), ['covers/', 'covers/', null])
})

test('the picture is fetched through the source once, kept on disk and served from there', async (t) => {
  const { covers, calls, files } = setup(t)
  const key = covers.ofSource('stub', url(1)).slice('covers/'.length)
  const first = await covers.file(key)
  assert.equal(first.type, 'image/png')
  assert.deepEqual(calls(), [url(1)])
  const again = await covers.file(key)
  assert.equal(again.file, first.file)
  assert.deepEqual(calls(), [url(1)], 'the second request is served from the cache')
  assert.deepEqual(files(), [`${key}.img`], 'no partial file is left behind')
})

test('parallel requests for one cover fetch it once', async (t) => {
  const { covers, calls } = setup(t)
  const key = covers.ofSource('stub', url(1)).slice('covers/'.length)
  const answers = await Promise.all([covers.file(key), covers.file(key), covers.file(key)])
  assert.ok(answers.every(a => a !== null))
  assert.equal(calls().length, 1)
})

test('unknown keys, malformed keys and sources without a cover verb give nothing, and nothing else is tried', async (t) => {
  const { covers, calls } = setup(t)
  const realFetch = globalThis.fetch
  globalThis.fetch = () => { throw new Error('the host must not fetch pictures itself') }
  t.after(() => { globalThis.fetch = realFetch })
  assert.equal(await covers.file(coverKey('stub', url(9))), null, 'a key nobody registered')
  assert.equal(await covers.file('../../etc/passwd'), null)
  assert.equal(await covers.file('ZZ'), null)
  const key = covers.ofSource('gone', url(1)).slice('covers/'.length)
  assert.equal(await covers.file(key), null, 'the source is not there')
  const bare = createCovers({ dir: join(tempDir(t), 'covers'), logger: quietLogger }, () => ({ search: async () => ({ results: [], next: null }) }))
  const bareKey = bare.ofSource('x', url(1)).slice('covers/'.length)
  assert.equal(await bare.file(bareKey), null, 'the source has no cover verb')
  assert.deepEqual(calls(), [])
})

test('a failing source gives no picture, and is not asked again for a while', async (t) => {
  let now = 1_000_000
  const { covers, calls, files } = setup(t, { env: { FAKE_SOURCE_COVER_FAIL: '1' }, now: () => now })
  const key = covers.ofSource('stub', url(1)).slice('covers/'.length)
  assert.equal(await covers.file(key), null)
  assert.equal(await covers.file(key), null)
  assert.equal(calls().length, 1)
  now += 6 * 60_000
  assert.equal(await covers.file(key), null)
  assert.equal(calls().length, 2, 'asked again after the wait')
  assert.deepEqual(files(), [])
})

test('files that are too big or not pictures are dropped', async (t) => {
  for (const bytes of ['3000000', '40']) {
    const { covers, files } = setup(t, { env: { FAKE_SOURCE_COVER_BYTES: bytes } })
    const key = covers.ofSource('stub', url(1)).slice('covers/'.length)
    assert.equal(await covers.file(key), null, `${bytes} bytes of junk`)
    assert.deepEqual(files(), [])
  }
})

test('past the cap the least recently shown pictures go first', async (t) => {
  const { dir, covers, files } = setup(t, { capBytes: 1500 })
  const keys = [1, 2, 3].map(n => covers.ofSource('stub', url(n)).slice('covers/'.length))
  await covers.file(keys[0])
  await covers.file(keys[1])
  const old = new Date(Date.now() - 3_600_000)
  utimesSync(join(dir, 'covers', `${keys[0]}.img`), old, old)
  await covers.file(keys[2])
  assert.deepEqual(files(), [`${keys[1]}.img`, `${keys[2]}.img`].sort(), 'the oldest was removed (611 bytes each, cap 1500)')
})

test('a cached picture survives a restart and is served without knowing its URL', async (t) => {
  const { dir, covers } = setup(t)
  const key = covers.ofSource('stub', url(1)).slice('covers/'.length)
  await covers.file(key)
  const restarted = createCovers({ dir: join(dir, 'covers'), logger: quietLogger }, () => undefined)
  assert.equal((await restarted.file(key)).type, 'image/png')
})

test('picture types are told by their first bytes', () => {
  assert.equal(imageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg')
  assert.equal(imageType(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')])), 'image/webp')
  assert.equal(imageType(Buffer.from('GIF89a')), 'image/gif')
  assert.equal(imageType(Buffer.from('<svg xmlns=')), null)
  assert.equal(imageType(Buffer.from('ftypheic....')), null)
})

test('a still of a local video is a route made on first request; a changed file gets a new one, a missing file none', { skip: !hasFfmpeg }, async (t) => {
  const { covers, dir } = setup(t)
  const video = join(dir, '01 Episode.mp4')
  makeVideo(video, { seconds: 2 })
  const route = await covers.ofFrame(video, 1)
  assert.match(route, /^covers\/[0-9a-f]{32}$/)
  assert.equal((await covers.file(route.slice('covers/'.length)))?.type, 'image/jpeg')
  assert.equal(await covers.ofFrame(video, 1), route, 'the same file and time, the same picture')
  makeVideo(video, { seconds: 3 })
  assert.notEqual(await covers.ofFrame(video, 1), route)
  assert.equal(await covers.ofFrame(join(dir, 'gone.mp4')), null)
})

test('a still past the end of a short video is its first frame, and a file with no picture gives none', { skip: !hasFfmpeg }, async (t) => {
  const { covers, dir } = setup(t)
  const video = join(dir, 'short.mp4')
  makeVideo(video, { seconds: 1 })
  assert.equal((await covers.file((await covers.ofFrame(video, 30)).slice('covers/'.length)))?.type, 'image/jpeg')
  const text = join(dir, 'notes.mp4')
  writeFileSync(text, 'not a video')
  assert.equal(await covers.file((await covers.ofFrame(text)).slice('covers/'.length)), null)
})

test('a picture a source names is fetched with its work\'s page, for the route the fetch takes', async (t) => {
  const asked = []
  const covers = createCovers({ dir: join(tempDir(t), 'covers'), logger: quietLogger }, () => ({ cover: async (url, file, context) => { asked.push([url, context.page]); throw new Error('offline') } }))
  const work = covers.decorate('link', { id: 'x', cover: 'https://pictures.example/1.jpg', url: 'https://video.example/watch/1' })
  assert.equal(await covers.file(work.cover.slice('covers/'.length)), null)
  assert.deepEqual(asked, [['https://pictures.example/1.jpg', 'https://video.example/watch/1']])
})
