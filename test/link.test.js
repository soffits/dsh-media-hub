import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { createProxies } from '../src/proxy.js'
import { AUDIO, AUTO, createLinkSource, formatArgs, qualityChoices } from '../src/sources/link.js'
import { quietLogger, tempDir } from './helpers.js'

const FAKE = fileURLToPath(new URL('./fixtures/fake-yt-dlp.mjs', import.meta.url))
const VIDEO = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'
const PLAYLIST = 'https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG'

function link(t, { proxies = createProxies([]), maxHeight = 720 } = {}) {
  const dir = tempDir(t)
  const log = join(dir, 'calls.jsonl')
  process.env.FAKE_YTDLP_LOG = log
  t.after(() => { delete process.env.FAKE_YTDLP_LOG; delete process.env.FAKE_YTDLP_FAIL })
  const source = createLinkSource({ ytDlp: FAKE, proxies, maxHeight, cwd: join(dir, 'link'), logger: quietLogger })
  const calls = () => readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line))
  return { source, dir, calls }
}

test('a video reads as a work of one episode with its thumbnail, length, uploader and the heights it has', async (t) => {
  const { source } = link(t)
  const work = await source.info(VIDEO)
  assert.equal(work.id, VIDEO)
  assert.equal(work.url, VIDEO)
  assert.equal(work.title, 'Me at the zoo')
  assert.equal(work.author, 'jawed')
  assert.equal(work.duration, 19)
  assert.equal(work.episodes, 1)
  assert.deepEqual(work.episodeTitles, ['Me at the zoo'])
  assert.match(work.cover, /^https:\/\/i\.ytimg\.com\//)
  assert.equal(work.popularity.label, 'plays')
  assert.deepEqual(work.meta, [{ key: 'site', label: 'Site', value: 'youtube.com' }])
  assert.deepEqual(work.qualities, [AUTO, '240', '144', AUDIO], 'the heights its recorded formats have')
})

test('a playlist reads as a work whose videos are its episodes, with their total length', async (t) => {
  const { source } = link(t)
  const work = await source.info(PLAYLIST)
  assert.equal(work.episodes, 3)
  assert.equal(work.episodeTitles[1], 'Taylor Swift - Patient Zero (Official Music Video)')
  assert.equal(work.duration, 232 + 313 + 210)
  assert.match(work.cover, /^https:\/\/i\.ytimg\.com\/vi\/hLOheGDwD_0\//, 'the largest playlist thumbnail')
  assert.deepEqual(work.qualities, [AUTO, '720', '480', '360', AUDIO], 'heights the hub plays without scaling down')
})

test('yt-dlp\'s own error is the message, and only web addresses reach it', async (t) => {
  const { source } = link(t)
  await assert.rejects(source.info('https://video.example/fail'), { code: 'source_failed', message: '[generic] Unsupported URL: https://video.example/fail' })
  await assert.rejects(source.info('file:///etc/passwd'), { code: 'invalid' })
  await assert.rejects(source.info('-o x'), { code: 'invalid' })
})

test('every call goes through the proxy the page\'s host is routed to, and direct (explicitly) otherwise', async (t) => {
  const proxies = createProxies([{ url: 'socks5h://127.0.0.1:1', hosts: ['video.example'] }])
  const { source, calls } = link(t, { proxies })
  await source.info('https://www.video.example/watch/1').catch(() => {})
  await source.info(VIDEO)
  const [proxied, direct] = calls()
  assert.equal(proxied[proxied.indexOf('--proxy') + 1], 'socks5h://127.0.0.1:1')
  assert.equal(direct[direct.indexOf('--proxy') + 1], '')
  assert.ok(direct.includes('--no-playlist'), 'a video inside a playlist plays alone')
  assert.deepEqual(direct.slice(-2), ['--', VIDEO], 'the address comes after the options')
})

test('a range of episodes lands as numbered files, and an episode that fails is reported', async (t) => {
  const { source, dir, calls } = link(t)
  const show = join(dir, 'show')
  const started = []
  assert.deepEqual(await source.download({ id: PLAYLIST, dir: show, from: 2, to: 3, onStart: n => started.push(n) }), { failed: [] })
  assert.deepEqual(readdirSync(show).filter(name => !name.startsWith('.')).sort(), ['002 Taylor Swift - Patient Zero (Official Music Video).mp4', '003 Tate McRae - Housewife (Official Video).mp4'])
  assert.deepEqual(started, [2, 3])
  const args = calls()[0]
  assert.equal(args[args.indexOf('--playlist-items') + 1], '2:3')
  assert.ok(args.includes(`temp:${join(show, '.incoming')}`), 'partial files stay out of the show')
  process.env.FAKE_YTDLP_FAIL = '1'
  assert.deepEqual(await source.download({ id: PLAYLIST, dir: show, from: 1, to: 1 }).catch(error => error.code), 'source_failed', 'nothing landed: yt-dlp\'s reason')
  process.env.FAKE_YTDLP_FAIL = '2'
  const { rmSync } = await import('node:fs')
  rmSync(show, { recursive: true })
  assert.deepEqual(await source.download({ id: PLAYLIST, dir: show, from: 1, to: 3 }), { failed: ['2'] })
})

test('audio only fetches m4a files', async (t) => {
  const { source, dir } = link(t)
  await source.download({ id: VIDEO, dir: join(dir, 'show'), from: 1, to: 1, quality: AUDIO })
  assert.deepEqual(readdirSync(join(dir, 'show')).filter(name => !name.startsWith('.')), ['001 Me at the zoo.m4a'])
})

test('a quality is a format choice: auto and heights above the limit stop at the limit, H.264 and AAC first', () => {
  assert.deepEqual(formatArgs(AUTO, 1080), ['-f', 'bv*+ba/b', '-S', 'res:1080,vcodec:h264,acodec:aac', '--merge-output-format', 'mp4'])
  assert.deepEqual(formatArgs('720', 1080).slice(2, 4), ['-S', 'res:720,vcodec:h264,acodec:aac'])
  assert.deepEqual(formatArgs('2160', 1080).slice(2, 4), ['-S', 'res:1080,vcodec:h264,acodec:aac'])
  assert.deepEqual(formatArgs('', 1080).slice(2, 4), ['-S', 'res:1080,vcodec:h264,acodec:aac'], 'none chosen is auto')
  assert.ok(formatArgs(AUDIO, 1080).includes('-x'))
  assert.deepEqual(qualityChoices([{ height: 1080 }, { height: 720 }, { height: 720 }, { height: null }], 1080), [AUTO, '1080', '720', AUDIO])
})

test('the thumbnail is fetched through the route of its page', async (t) => {
  const asked = []
  const proxies = { route: async () => '', download: async (url, file, options) => { asked.push({ url, page: options.page }) } }
  const { source } = link(t, { proxies })
  await source.cover('https://i.ytimg.example/1.jpg', join(tempDir(t), 'x'), { page: VIDEO })
  assert.deepEqual(asked, [{ url: 'https://i.ytimg.example/1.jpg', page: VIDEO }])
})
