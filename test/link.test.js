import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { createCookies } from '../src/cookies.js'
import { createProxies } from '../src/proxy.js'
import { AUDIO, AUTO } from '../src/quality.js'
import { createLinkSource, episodeStem, formatArgs, qualityChoices } from '../src/sources/link.js'
import { quietLogger, tempDir } from './helpers.js'

const FAKE = fileURLToPath(new URL('./fixtures/fake-yt-dlp.mjs', import.meta.url))
const FAKE_FFMPEG = fileURLToPath(new URL('./fixtures/fake-ffmpeg.mjs', import.meta.url))
const VIDEO = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'
const PLAYLIST = 'https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG'

const CAPTIONED = 'https://www.youtube.com/watch?v=captioned'
const ERRORS = JSON.parse(readFileSync(new URL('./fixtures/yt-dlp/errors.json', import.meta.url), 'utf8'))

function link(t, { proxies = createProxies([]), cookies = createCookies([]), maxHeight = 720, logger = quietLogger } = {}) {
  const dir = tempDir()
  const log = join(dir, 'calls.jsonl')
  process.env.FAKE_YTDLP_LOG = log
  t.after(() => { for (const name of ['FAKE_YTDLP_LOG', 'FAKE_YTDLP_FAIL', 'FAKE_YTDLP_ERROR', 'FAKE_YTDLP_COOKIES']) delete process.env[name] })
  const source = createLinkSource({ ytDlp: FAKE, ffmpeg: FAKE_FFMPEG, proxies, cookies, maxHeight, cwd: join(dir, 'link'), logger })
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
  assert.equal(work.account, null, 'no cookies setting, no account')
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

test('a failure says why in a reason the page has words for, and yt-dlp\'s own words go to the log', async (t) => {
  const logged = []
  const { source } = link(t, { logger: { ...quietLogger, warn: (...args) => logged.push(args.join(' ')) } })
  await assert.rejects(source.info('https://video.example/fail'), { code: 'source_failed', reason: 'not_found' })
  assert.ok(logged.some(line => line.includes('Unsupported URL')), 'the detail is in the log')
  const reasons = { refused: 'blocked', signIn: 'sign_in', missing: 'not_found', proxyRefused: 'failed' }
  for (const [recorded, reason] of Object.entries(reasons)) {
    process.env.FAKE_YTDLP_ERROR = recorded
    const error = await source.info(VIDEO).catch(caught => caught)
    assert.equal(error.reason, reason, recorded)
    assert.ok(!error.message.includes('ERROR'), 'the message is the hub\'s, not yt-dlp\'s')
  }
  delete process.env.FAKE_YTDLP_ERROR
  await assert.rejects(source.info('file:///etc/passwd'), { code: 'invalid' })
  await assert.rejects(source.info('-o x'), { code: 'invalid' })
})

test('a proxy that does not answer is the reason, whatever yt-dlp printed', async (t) => {
  const proxies = createProxies([{ url: 'socks5h://127.0.0.1:1', hosts: ['*'] }])
  const { source } = link(t, { proxies })
  process.env.FAKE_YTDLP_ERROR = 'proxyRefused'
  await assert.rejects(source.info(VIDEO), { code: 'source_failed', reason: 'proxy_down' })
  const unreadable = createProxies([{ url: 'socks5h://127.0.0.1:1', hostsFile: join(tempDir(), 'missing.txt') }])
  await assert.rejects(link(t, { proxies: unreadable }).source.info(VIDEO), { reason: 'proxy_down' }, 'a hosts file that cannot be read fails closed')
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

test('a range of episodes lands as numbered files, each looked up once, and an episode that fails is reported', async (t) => {
  const { source, dir, calls } = link(t)
  const show = join(dir, 'show')
  const started = []
  assert.deepEqual(await source.download({ id: PLAYLIST, dir: show, from: 2, to: 3, onStart: n => started.push(n) }), { failed: [] })
  assert.deepEqual(readdirSync(show).filter(name => !name.startsWith('.')).sort(), ['002 Taylor Swift - Patient Zero (Official Music Video).mp4', '003 Tate McRae - Housewife (Official Video).mp4'])
  assert.deepEqual(started, [2, 3])
  const lookups = calls().filter(args => args.includes('-J'))
  assert.deepEqual(lookups.map(args => args[args.indexOf('--playlist-items') + 1]), ['2', '3'])
  assert.ok(calls().filter(args => !args.includes('-J')).every(args => args.includes('--load-info-json') && !args.includes(PLAYLIST)), 'the formats are fetched from the lookup, not by asking the site again')
  assert.deepEqual(readdirSync(join(show, '.incoming')), [], 'nothing is left of the parts')
  process.env.FAKE_YTDLP_FAIL = '1'
  assert.deepEqual(await source.download({ id: PLAYLIST, dir: show, from: 1, to: 1 }).catch(error => error.code), 'source_failed', 'nothing landed: yt-dlp\'s reason')
  process.env.FAKE_YTDLP_FAIL = '2'
  const { rmSync } = await import('node:fs')
  rmSync(show, { recursive: true })
  assert.deepEqual(await source.download({ id: PLAYLIST, dir: show, from: 1, to: 3 }), { failed: ['2'] })
})

test('a site\'s account is read from a private copy of its cookies, with its User-Agent, and the copy is gone afterwards', async (t) => {
  const dir = tempDir()
  const own = join(dir, 'own.txt')
  const shared = join(dir, 'shared.txt')
  writeFileSync(own, '# Netscape HTTP Cookie File\nown\n')
  writeFileSync(shared, '# Netscape HTTP Cookie File\nshared\n')
  const cookies = createCookies([{ hosts: ['youtube.com'], accounts: [{ person: 'p1', name: 'One', file: own, userAgent: 'Agent/1' }, { person: 'p2', name: 'Two', file: shared, share: true }] }])
  const { source, calls } = link(t, { cookies })
  process.env.FAKE_YTDLP_COOKIES = join(dir, 'seen.txt')
  const work = await source.info(VIDEO, { person: 'p1' })
  assert.deepEqual(work.account, { name: 'One' }, 'the page sees the account by name')
  assert.equal(readFileSync(join(dir, 'seen.txt'), 'utf8'), readFileSync(own, 'utf8'))
  const [args] = calls()
  assert.equal(args[args.indexOf('--user-agent') + 1], 'Agent/1')
  assert.ok(!existsSync(args[args.indexOf('--cookies') + 1]), 'the private copy is deleted after the run')
  assert.notEqual(args[args.indexOf('--cookies') + 1], own, 'yt-dlp never writes back into the account\'s file')
  assert.deepEqual((await source.info(VIDEO, { person: 'p3' })).account, { name: 'Two' }, 'someone without an account uses a shared one')
  assert.equal((await source.info(PLAYLIST.replace('youtube.com', 'video.example'))).account, null, 'a host no rule names gets no cookies')
  assert.ok(!calls()[2].includes('--cookies'))
})

test('a download fetches the video and the audio side by side as one progress, hands them over while they grow, then merges them', async (t) => {
  const { source, dir, calls } = link(t)
  const show = join(dir, 'show')
  const seen = []
  const partial = []
  await source.download({ id: CAPTIONED, dir: show, language: 'de', onProgress: (n, progress) => seen.push({ n, ...progress }), onPartial: (n, given) => partial.push({ n, ...given }) })
  const total = 1248309 + 8901496
  assert.deepEqual(seen[0], { n: 1, fraction: 0, done: 0, total, speed: null, eta: null }, 'the episode starts at 0 of its video and audio together')
  assert.equal(seen.at(-1).fraction, 1)
  assert.equal(seen.at(-1).done, total)
  assert.ok(seen.every((entry, n) => n === 0 || entry.done >= seen[n - 1].done), 'it only moves forward')
  const formats = calls().filter(args => args.includes('--load-info-json') && args.includes('-f')).map(args => args[args.indexOf('-f') + 1])
  assert.deepEqual(formats.sort(), ['140', '160'], 'one run per format')
  assert.equal(partial.length, 1)
  assert.deepEqual(partial[0].files.map(file => file.split('/').slice(-2).join('/')), ['1/part0.mp4', '1/part1.m4a'])
  assert.ok(partial[0].growing instanceof Promise)
  const stem = '001 Inside the Mind of a Master Procrastinator Tim Urban TED'
  assert.equal(readFileSync(join(show, `${stem}.mp4`), 'utf8'), 'format 160format 140', 'the parts merged into one file')
  assert.deepEqual(readdirSync(show).filter(name => name.endsWith('.vtt')).sort(), ['ar', 'de.auto', 'en.original', 'fr', 'zh-CN', 'zh-TW'].map(label => `${stem}.${label}.vtt`),
    'the captions people made, the viewer\'s language by machine where nobody made one, the video\'s own marked')
  assert.deepEqual(partial[0].subtitles.map(sub => sub.label), ['ar', 'zh-CN', 'zh-TW', 'en.original', 'fr', 'de.auto'])
})

test('audio only fetches m4a files, and nothing plays before they are complete', async (t) => {
  const { source, dir } = link(t)
  const partial = []
  await source.download({ id: VIDEO, dir: join(dir, 'show'), from: 1, to: 1, quality: AUDIO, onPartial: n => partial.push(n) })
  assert.deepEqual(readdirSync(join(dir, 'show')).filter(name => !name.startsWith('.')), ['001 Me at the zoo.m4a'])
  assert.deepEqual(partial, [])
})

test('a quality is a format choice: auto and heights above the limit stop at the limit, H.264 and AAC first', () => {
  assert.deepEqual(formatArgs(AUTO, 1080), ['-f', 'bv*+ba/b', '-S', 'res:1080,vcodec:h264,acodec:aac'])
  assert.deepEqual(formatArgs('720', 1080).slice(2, 4), ['-S', 'res:720,vcodec:h264,acodec:aac'])
  assert.deepEqual(formatArgs('2160', 1080).slice(2, 4), ['-S', 'res:1080,vcodec:h264,acodec:aac'])
  assert.deepEqual(formatArgs('', 1080).slice(2, 4), ['-S', 'res:1080,vcodec:h264,acodec:aac'], 'none chosen is auto')
  assert.deepEqual(formatArgs(AUDIO, 1080), ['-f', 'ba/b', '-S', 'acodec:aac'])
  assert.deepEqual(qualityChoices([{ height: 1080 }, { height: 720 }, { height: 720 }, { height: null }], 1080), [AUTO, '1080', '720', AUDIO])
})

test('an episode\'s file name is its number and its title, in any script, cut on a character', () => {
  assert.equal(episodeStem(7, 'A/B: C?'), '007 A B C')
  assert.equal(episodeStem(1, ''), '001')
  const long = episodeStem(2, '字'.repeat(60))
  assert.ok(Buffer.byteLength(long) <= 104 && long.endsWith('字'))
})

test('the thumbnail is fetched through the route of its page', async (t) => {
  const asked = []
  const proxies = { route: async () => '', download: async (url, file, options) => { asked.push({ url, page: options.page }) } }
  const { source } = link(t, { proxies })
  await source.cover('https://i.ytimg.example/1.jpg', join(tempDir(), 'x'), { page: VIDEO })
  assert.deepEqual(asked, [{ url: 'https://i.ytimg.example/1.jpg', page: VIDEO }])
})
