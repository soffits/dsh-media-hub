/**
 * Two viewers in one room, in a real DSH with the plugin linked in, driven
 * through two separate Chromium contexts (two signed-in browsers). Then the
 * hub: a search through a stand-in source command, "watch together now" opening
 * a room listing every episode while only a window is cached, the watch
 * log, deleting from the library, a slow source answering after a newer
 * click (only the latest results show, a spinner meanwhile), and the rolling
 * cache: a jump to an uncached episode, watched episodes behind dropped.
 * The ready gate: an episode switch with one browser's network throttled
 * (CDP) holds both until both can play, then starts them together.
 * The page's tabs (Watching, Library, Discover), the source and category
 * pickers and their state in the URL, the browser's memory and back button.
 *
 * Boots a throwaway DSH home unless DSH_URL (a sign-in URL with ?token=)
 * and DSH_HOME of an already running throwaway DSH are given. Never point
 * it at a DSH home people use.
 *
 * Link: an address looked up through a stand-in yt-dlp, fetched in the chosen
 * quality with every call routed by the `proxies` setting (to a proxy that is
 * down, so the thumbnail fails closed and the library falls back to a frame).
 *
 * Env: CHROME_PATH (default `chromium` on PATH), SCREENSHOT_DIR (optional).
 */
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, webkit } from 'playwright-core'
import { createWatchLog } from '../../src/watchlog.js'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const screenshots = process.env.SCREENSHOT_DIR
const DEAD_PROXY = 'socks5h://127.0.0.1:9'
const sleep = ms => new Promise(done => setTimeout(done, ms))
const log = (...args) => console.log('·', ...args)

async function bootDsh() {
  if (process.env.DSH_URL && process.env.DSH_HOME) return { url: process.env.DSH_URL, home: process.env.DSH_HOME, stop: async () => {} }
  const root = mkdtempSync(join(tmpdir(), 'media-hub-dsh-'))
  // The stand-in source command answers as `fanqie` (the default source entry) on DSH's PATH; its episodes are copies of a short test video.
  const bin = join(root, 'bin')
  mkdirSync(bin)
  symlinkSync(join(repo, 'test/fixtures/fake-source.mjs'), join(bin, 'fanqie'))
  // and as `bookfetch` (the default book source), answering its book searches.
  symlinkSync(join(repo, 'test/fixtures/fake-source.mjs'), join(bin, 'bookfetch'))
  // and as `yt-dlp`, for Link: recorded answers, the sample video as every download.
  symlinkSync(join(repo, 'test/fixtures/fake-yt-dlp.mjs'), join(bin, 'yt-dlp'))
  const sample = join(root, 'sample.mp4')
  makeVideo(sample, 20)
  // A placeholder key keeps DSH's first-run "Get started" screen away; nothing in the test calls a model.
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_SOURCE_SAMPLE: sample, FAKE_YTDLP_SAMPLE: sample, FAKE_YTDLP_LOG: join(root, 'yt-dlp-calls.jsonl'), FAKE_SOURCE_DELAY_MS: '2500', FAKE_SOURCE_SLOW_KIND: 'drama', FAKE_SOURCE_SLOW_MS: '3000', DSH_HOME: join(root, 'home'), DSH_TELEMETRY_DISABLED: '1', DEEPSEEK_API_KEY: 'sk-placeholder' }
  execFileSync('dsh', ['plugin', '--profile', 'web', 'add', `link:${repo}`], { env, cwd: root, stdio: 'ignore' })
  // The page draws with the shared kit (client.js injects `uiKit` and waits for it), so the kit is installed at the version this checkout is built against.
  const kitVersion = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')).devDependencies['@soffits/dsh-ui-kit']
  execFileSync('dsh', ['plugin', '--profile', 'web', 'add', `@soffits/dsh-ui-kit@${kitVersion}`], { env, cwd: root, stdio: 'ignore' })
  // Every outbound request and yt-dlp call goes to a proxy that is down: nothing in the test reaches the network.
  writeFileSync(join(env.DSH_HOME, 'profiles/web/cordis.patch.yml'), JSON.stringify([{ id: 'media-hub', config: { proxies: [{ url: DEAD_PROXY, hosts: ['*'] }] } }]))
  const port = 40000 + Math.floor(Math.random() * 20000)
  const child = spawn('dsh', ['--profile', 'web', '--no-open', '--host', '127.0.0.1', '--port', String(port)], { env, cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
  let output = ''
  const url = await new Promise((done, fail) => {
    const timer = setTimeout(() => fail(new Error('DSH did not start in 120 s')), 120_000)
    const read = (chunk) => {
      output += chunk
      const match = /(http:\/\/127\.0\.0\.1:\d+\/\?token=\S+)/.exec(output)
      if (match) {
        clearTimeout(timer)
        done(match[1])
      }
    }
    child.stdout.on('data', read)
    child.stderr.on('data', read)
  })
  return {
    url,
    home: env.DSH_HOME,
    stop: async () => {
      process.kill(-child.pid, 'SIGTERM')
      await new Promise(done => child.once('exit', done))
      rmSync(root, { recursive: true, force: true })
    },
  }
}

function makeVideo(path, seconds, tone = 440) {
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', `testsrc2=size=640x360:rate=25:duration=${seconds}`,
    '-f', 'lavfi', '-i', `sine=frequency=${tone}:duration=${seconds}`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
    '-movflags', '+faststart', path,
  ])
}

function makeEpisodes(home) {
  const show = join(home, 'media-hub', 'library', 'Test show')
  mkdirSync(show, { recursive: true })
  for (const n of [1, 2, 3]) makeVideo(join(show, `Episode ${n}.mp4`), 90, 300 + n * 100)
  writeFileSync(join(show, 'Episode 1.srt'), '1\n00:00:00,000 --> 00:01:30,000\nSubtitle line, episode 1\n')
  return show
}

/** A signed-in browser: its own context with DSH's cookie. */
async function viewer(browser, signIn, origin, name, device = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...device })
  // The name the sign-in plugin (dsh-oidc) would report for this browser.
  await context.route('**/_dsh-oidc/session', route => route.fulfill({ json: { name } }))
  const page = await context.newPage()
  const requests = []
  page.on('request', request => requests.push(request.url()))
  page.on('pageerror', error => log('page error:', error.message))
  // A page that throws while rendering is caught by DSH's slot and only logged; the test must not pass over it.
  const crashes = []
  page.on('console', (message) => { if (message.type() === 'error' && /crashed/.test(message.text())) crashes.push(message.text()) })
  // What the page says on its sync socket, with the time it said it.
  const sent = []
  page.on('websocket', ws => ws.on('framesent', frame => sent.push({ at: Date.now(), payload: String(frame.payload) })))
  await page.goto(signIn)
  await page.waitForLoadState('networkidle').catch(() => {})
  // DSH's first-run notice.
  await page.getByRole('button', { name: 'Continue' }).click({ timeout: 5000 }).catch(() => {})
  return {
    context,
    page,
    crashes,
    requests,
    sent,
    open: async (room) => {
      // A link from before the rename (?videosync=) still opens the room.
      await page.goto(`${origin}/?videosync=${room}`)
      await page.waitForSelector('.vsync-media', { timeout: 60_000 })
      await sleep(1500)
      await dismissDialogs(page)
    },
  }
}

/** A top tab of the page (Watching, Library, Discover); Watching may carry the count of open rooms. */
async function openTab(page, name) {
  const role = { name: new RegExp(`^${name}( \\d+)?$`) }
  await page.locator('.vsync-pageTabs').getByRole('tab', role).click()
  await page.locator('.vsync-pageTabs').getByRole('tab', { ...role, selected: true }).waitFor({ timeout: 5000 })
}

const params = page => Object.fromEntries(new URL(page.url()).searchParams)

/** Open every open room's close confirmation in turn until none is left (from the Watching tab). */
async function closeRooms(page) {
  await openTab(page, 'Watching')
  for (;;) {
    const close = page.locator('.vsync-row button[aria-label="Close room"]').first()
    if (await close.count() === 0) break
    await close.click()
    await page.locator('.vsync-confirm').getByRole('button', { name: 'Close room' }).click()
    await sleep(500)
  }
}

/** Close DSH's own dialogs of a fresh home (no model account yet) by their icon-only close button. */
async function dismissDialogs(page) {
  for (const dialog of await page.getByRole('dialog').all()) {
    await dialog.locator('button').filter({ hasNotText: /\S/ }).first().click({ timeout: 2000 }).catch(() => {})
  }
}

/** Both players' positions at the same instant (each extrapolated to a shared time). */
async function positions(a, b) {
  const read = page => page.evaluate(() => {
    const video = document.querySelector('video.vsync-media')
    return { time: video.currentTime, paused: video.paused, rate: video.playbackRate, at: Date.now(), src: video.currentSrc }
  })
  const [x, y] = await Promise.all([read(a.page), read(b.page)])
  const at = Math.max(x.at, y.at)
  const project = s => s.time + (s.paused ? 0 : (at - s.at) / 1000 * s.rate)
  return { a: x, b: y, drift: project(y) - project(x) }
}

async function until(what, check, timeoutMs = 10_000) {
  const end = Date.now() + timeoutMs
  let last
  while (Date.now() < end) {
    last = await check()
    if (last.ok) return last
    await sleep(200)
  }
  throw new Error(`timed out: ${what} (last: ${JSON.stringify(last)})`)
}

/** Record when the page's player starts playing (its `playing` events), by wall clock: both browsers run on this machine. */
const recordStarts = page => page.evaluate(() => {
  const video = document.querySelector('video.vsync-media')
  window.vsyncStarts = []
  // A muted play that only makes the browser load (the player's prime) is not a start.
  video.addEventListener('playing', () => { if (!video.muted) window.vsyncStarts.push({ at: Date.now(), src: video.currentSrc, time: video.currentTime }) })
})
const startsOn = (page, pattern) => page.evaluate(source => window.vsyncStarts.filter(start => new RegExp(source).test(start.src)), pattern.source)

/**
 * The ready gate: Alice jumps to episode 3 (episode 2 is already preloading, which is why the test jumps over it) while Bob's line is throttled. Neither plays before Bob is ready,
 * the waiting room lists both, "start without" shows after the timeout, and both start within 0.3 s of each other.
 */
async function readyGate({ a, b }) {
  const cdp = await b.context.newCDPSession(b.page)
  await cdp.send('Network.enable')
  const throttle = kbps => cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: kbps * 1024, uploadThroughput: 1024 * 1024 })
  await throttle(8)
  for (const v of [a, b]) await recordStarts(v.page)
  const clicked = Date.now()
  assert.equal(await b.page.locator('video.vsync-preload').count(), 1, 'the next episode is loading in the background')
  await a.page.locator('.vsync-episode').nth(2).click()
  const episode2 = /\/2\/Episode%203\.mp4$/
  // Alice is ready at once; the room waits for Bob, and her player stays paused.
  await a.page.locator('.vsync-wait').waitFor({ timeout: 5000 })
  await until('Alice is ready, Bob loading', async () => {
    const states = await a.page.locator('.vsync-waitMember').evaluateAll(rows => rows.map(row => row.dataset.wait))
    return { ok: states.includes('ready') && states.includes('loading'), states }
  }, 10_000)
  assert.equal((await positions(a, b)).a.paused, true, 'Alice holds while Bob loads')
  await shot(a.page, 'wait-loading')
  // Bob's own socket shares his slow line with the video, so his view follows a little later.
  const told = await until('B was told about the switch', async () => {
    const texts = await b.page.locator('.vsync-toast').allTextContents()
    return { ok: texts.some(text => /switched to Episode 3/.test(text)), texts }
  }, 15_000)
  log('B toasts:', told.texts)
  await b.page.locator('.vsync-wait').waitFor({ timeout: 15_000 })
  await shot(b.page, 'wait-loading-bob')
  await a.page.locator('.vsync-wait button').waitFor({ timeout: 15_000 })
  assert.match(await a.page.locator('.vsync-wait button').textContent(), /Start without Bob/)
  await b.page.locator('.vsync-wait button').first().waitFor({ timeout: 15_000 })
  assert.deepEqual(await b.page.locator('.vsync-wait button').allTextContents(), ['Tap to keep loading'], 'Bob is not offered to start without himself, only to keep loading')
  assert.equal((await startsOn(a.page, episode2)).length, 0, 'Alice has not started')
  await shot(a.page, 'wait-start-without')
  // Bob's line gets better; he becomes ready and both start together.
  await throttle(300)
  const started = await until('both started episode 3', async () => {
    const [x, y] = [await startsOn(a.page, episode2), await startsOn(b.page, episode2)]
    return { ok: x.length > 0 && y.length > 0, x, y }
  }, 60_000)
  const readyAt = b.sent.find(frame => frame.at > clicked && frame.payload.includes('"op":"ready"'))?.at
  assert.ok(readyAt, 'Bob said he was ready')
  const [startA, startB] = [started.x[0].at, started.y[0].at]
  log('ready gate: Bob ready', readyAt - clicked, 'ms after the click; Alice started', startA - readyAt, 'ms after, Bob', startB - readyAt, 'ms after; apart', Math.abs(startA - startB), 'ms')
  assert.ok(startA > readyAt && startB > readyAt, 'nobody started before Bob was ready')
  assert.ok(Math.abs(startA - startB) < 300, `started ${Math.abs(startA - startB)} ms apart`)
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  await cdp.detach()
}

/** Move a player without telling the page, like a decoder hiccup would. */
const silentJump = (page, by) => page.evaluate((by) => {
  const video = document.querySelector('video.vsync-media')
  const swallow = event => event.stopImmediatePropagation()
  video.addEventListener('seeking', swallow, { capture: true, once: true })
  video.currentTime += by
}, by)

const shot = async (page, name) => {
  if (!screenshots) return
  await dismissDialogs(page)
  mkdirSync(screenshots, { recursive: true })
  await page.screenshot({ path: join(screenshots, `${name}.png`) })
  log('screenshot', join(screenshots, `${name}.png`))
}

/**
 * Chips and Search while the source answers slowly (drama searches take 3 s, audiobooks are quick):
 * a spinner shows, the newest click wins however late the older answer lands, and repeating a click asks nothing new.
 */
async function loadingFlows({ a }) {
  const asked = []
  a.page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.endsWith('/api/search')) asked.push(url.searchParams.get('kind'))
  })
  const titles = () => a.page.locator('.vsync-results > .vsync-card .vsync-cardHead .vsync-rowTitle').allTextContents()
  await openTab(a.page, 'Discover')
  await a.page.locator('.vsync-searchField').fill('测试')
  await a.page.locator('.vsync-search button[type=submit]').click()
  await a.page.locator('.vsync-skeleton').waitFor({ timeout: 5000 })
  assert.equal(await a.page.locator('.vsync-search button[type=submit]').isDisabled(), true, 'Search is disabled while its own request runs')
  assert.equal(await a.page.locator('.vsync-chip[aria-selected=true]').getAttribute('data-loading'), 'true', 'the active chip shows it is loading')
  await shot(a.page, 'search-loading')
  // Another chip meanwhile: its quick answer shows, and the slow one landing later does not replace it.
  await a.page.getByRole('tab', { name: 'Audiobooks' }).click()
  await until('the audiobook results show', async () => ({ ok: (await titles()).join() === '测试有声书', titles: await titles() }), 10_000)
  assert.equal(await a.page.locator('.vsync-skeleton').count(), 0)
  await sleep(3800)
  assert.deepEqual(await titles(), ['测试有声书'], 'the stale drama answer did not replace the audiobook results')
  // The same chip twice in a row asks once.
  const before = asked.filter(kind => kind === 'drama').length
  const dramaChip = a.page.getByRole('tab', { name: 'Short dramas' })
  await dramaChip.click()
  await dramaChip.click()
  await a.page.locator('.vsync-skeleton').waitFor({ timeout: 2000 })
  await until('the drama results show', async () => ({ ok: (await titles()).join() === '测试短剧,测试短剧第二季', titles: await titles() }), 10_000)
  assert.equal(asked.filter(kind => kind === 'drama').length - before, 1, 'a repeated click did not ask again')
  log('loading: spinner shown, only the newest results rendered, repeated chip click ignored')
  await pagingFlows({ a })
}

/**
 * The rolling cache with a 12-episode show (window: 5 ahead, 1 behind): every episode is listed, only a window is on disk;
 * a jump to an uncached episode shows "preparing" and fetches it first; watched episodes more than one behind are deleted.
 */
async function rollingFlows({ a, b, home }) {
  const folder = join(home, 'media-hub', 'library', '长剧测试')
  const onDisk = () => (existsSync(folder) ? readdirSync(folder).filter(name => name.endsWith('.mp4')).map(name => Number.parseInt(name, 10)).sort((x, y) => x - y) : [])
  await openTab(a.page, 'Discover')
  await a.page.locator('.vsync-searchField').fill('长剧')
  await a.page.locator('.vsync-search button[type=submit]').click()
  await a.page.waitForSelector('.vsync-card', { timeout: 30_000 })
  await until('the result shows its episode count', async () => ({ ok: /12 episodes/.test(await a.page.locator('.vsync-results > .vsync-card .vsync-rowMeta').first().textContent()) }), 30_000)
  await a.page.getByRole('button', { name: 'Watch', exact: true }).click()
  await a.page.waitForSelector('.vsync-media', { timeout: 60_000 })
  assert.equal(await a.page.locator('.vsync-episode').count(), 12, 'every episode is listed')
  const room = (await a.page.evaluate(() => fetch('media-hub/api/rooms').then(r => r.json()))).rooms.find(r => r.title === '长剧测试')
  await b.open(room.id)
  await until('the window is on disk: episodes 1 to 6', async () => ({ ok: onDisk().join() === '1,2,3,4,5,6', files: onDisk() }), 60_000)
  await until('the other six are marked not cached', async () => ({ ok: (await a.page.locator('.vsync-episode[data-cached=false]').count()) === 6 }), 10_000)
  await a.page.evaluate(() => document.querySelector('video.vsync-media').play())
  await shot(a.page, 'rolling-room')

  // Jump to episode 10: shown as preparing, fetched first, B follows.
  await a.page.locator('.vsync-episode').nth(9).click()
  assert.match(await a.page.locator('.vsync-overlay').textContent(), /Preparing/)
  await until('episode 10 is on disk', async () => ({ ok: onDisk().includes(10), files: onDisk() }), 30_000)
  await until('both players are on episode 10', async () => {
    const p = await positions(a, b)
    return { ok: /\/9\//.test(p.a.src) && /\/9\//.test(p.b.src), p }
  }, 30_000)
  await until('episodes 11 and 12 follow', async () => ({ ok: onDisk().includes(11) && onDisk().includes(12), files: onDisk() }), 30_000)
  assert.ok(!onDisk().includes(7) && !onDisk().includes(8) && !onDisk().includes(9), 'the episodes skipped over were not fetched')

  // Watch 10 and 11 to their ends: 10 falls out of the window and its file is deleted; the room still lists it, marked watched.
  for (const index of [9, 10]) {
    await until(`episode ${index + 1} is playing`, async () => ({ ok: (await a.page.locator('.vsync-episode[aria-current=true] .vsync-episodeNo').textContent()) === String(index + 1) }), 20_000)
    await until(`episode ${index + 1} has loaded`, async () => ({ ok: await a.page.evaluate(() => Number.isFinite(document.querySelector('video.vsync-media').duration)) }), 20_000)
    await a.page.evaluate(() => { const v = document.querySelector('video.vsync-media'); v.currentTime = v.duration - 1.5 })
    await sleep(500)
  }
  await until('episode 10 is deleted from disk', async () => ({ ok: !onDisk().includes(10), files: onDisk() }), 20_000)
  const ten = a.page.locator('.vsync-episode').nth(9)
  await until('episode 10 shows as watched and not cached', async () => ({ ok: await ten.getAttribute('data-cached') === 'false' && await ten.getAttribute('data-watch') === 'watched' }), 10_000)
  log('rolling: jump fetched first, watched episode behind deleted; on disk', onDisk().join(','))
  await shot(a.page, 'rolling-room-after')

  await a.page.locator('.vsync-bar .vsync-icon').first().click()
  await openTab(a.page, 'Library')
  await a.page.waitForSelector('.vsync-show')
  const row = a.page.locator('.vsync-show', { hasText: '长剧测试' })
  await until('the library row says how much is cached', async () => {
    const meta = await row.locator('.vsync-rowMuted').first().textContent()
    return { ok: /cached \d+ of 12/.test(meta), meta }
  }, 10_000)
  await row.locator('.vsync-expand').click()
  await row.locator('.vsync-subrow').first().waitFor()
  assert.equal(await row.locator('.vsync-subrow').count(), 12)
  assert.equal(await row.locator('.vsync-subrow[data-cached=false]').count(), 12 - onDisk().length)
  await shot(a.page, 'rolling-library')

  // Download all (offline): the rest comes down, the row says offline.
  await row.getByRole('button', { name: 'More' }).click()
  await a.page.getByRole('menuitem', { name: 'Download all (offline)' }).click()
  await row.locator('.vsync-confirm').getByRole('button', { name: 'Download all (offline)' }).click()
  await until('every episode is on disk', async () => ({ ok: onDisk().length === 12, files: onDisk() }), 60_000)
  await until('the row says offline', async () => ({ ok: /offline/.test(await row.locator('.vsync-rowMuted').first().textContent()) }), 10_000)
  log('offline: the whole show is on disk')
}

/**
 * Search results as cards: cover (served by the host, loaded), score, popularity, episodes, status, tags; Details lists every field
 * and the related works. No browser contacts the source's CDN. A second signed-in browser sees the same covers.
 */
async function coverFlows({ a, b, origin }) {
  const card = a.page.locator('.vsync-results > .vsync-card').first()
  const covers = await a.page.evaluate(() => [...document.querySelectorAll('.vsync-results > .vsync-card img.vsync-cover')].map(img => ({ src: img.src, loaded: img.complete && img.naturalWidth > 0 })))
  assert.equal(covers.length, 2)
  await until('covers loaded', async () => {
    const state = await a.page.evaluate(() => [...document.querySelectorAll('.vsync-results > .vsync-card img.vsync-cover')].map(img => img.complete && img.naturalWidth > 0))
    return { ok: state.length === 2 && state.every(Boolean), state }
  }, 15_000)
  for (const { src } of covers) assert.match(new URL(src).pathname, /\/media-hub\/covers\/[0-9a-f]{32}$/)
  const glance = await card.locator('.vsync-rowMeta').textContent()
  assert.match(glance, /3\.7M plays/)
  assert.match(glance, /3 episodes/)
  assert.match(glance, /complete/)
  assert.equal((await card.locator('.vsync-score').textContent()).trim(), '★ 8.6')
  assert.deepEqual(await card.locator('.vsync-tag').allTextContents(), ['奇幻爱情', '都市', '总裁'])
  // Details: all the fields, and the other season as a card with its relation.
  await card.getByRole('button', { name: 'Details' }).click()
  await card.locator('.vsync-facts').waitFor({ timeout: 15_000 })
  assert.deepEqual(await card.locator('.vsync-facts dt').allTextContents(), ['Heat', 'Cast', 'Duration', 'Region'])
  await card.locator('.vsync-related').first().waitFor()
  assert.deepEqual(await card.locator('.vsync-relatedList .vsync-cardHead .vsync-rowTitle').allTextContents(), ['测试短剧第二季', '另一个改编'])
  assert.deepEqual(await card.locator('.vsync-relatedList .vsync-badge').allTextContents(), ['Season', 'Related'])
  await shot(a.page, 'search-details')
  // Details never nest: related works are plain rows, with no card and no Details toggle of their own.
  assert.equal(await card.locator('.vsync-details .vsync-card, .vsync-details .vsync-metaButton, .vsync-details [aria-expanded]').count(), 0, 'a Details view holds no other Details toggle')
  // A related work opens as the focused work (its URL in the page's state), one level deep; back control and browser back return.
  const seasonTwoId = '7600000000000000005'
  await card.locator('.vsync-related', { hasText: '测试短剧第二季' }).getByRole('button').click()
  const focus = a.page.locator('.vsync-focus')
  await focus.locator('.vsync-card .vsync-details .vsync-related').first().waitFor({ timeout: 15_000 })
  assert.equal(params(a.page)['vs-work'], seasonTwoId)
  assert.deepEqual(await focus.locator('.vsync-card > .vsync-cardBody > .vsync-cardHead .vsync-rowTitle').allTextContents(), ['测试短剧第二季'])
  assert.equal(await focus.locator('.vsync-details .vsync-card, .vsync-details .vsync-metaButton').count(), 0)
  assert.equal(await a.page.locator('.vsync-search-view').isHidden(), true, 'the focused work replaces the search view')
  await shot(a.page, 'work-focus')
  // From there the related list leads one step on, and back control goes back one step at a time.
  await focus.locator('.vsync-related', { hasText: '测试短剧' }).getByRole('button').click()
  await until('the first season is focused', async () => ({ ok: params(a.page)['vs-work'] === '7600000000000000001' && (await focus.locator('.vsync-card > .vsync-cardBody > .vsync-cardHead .vsync-rowTitle').allTextContents()).join() === '测试短剧' }))
  await focus.getByRole('button', { name: 'Back' }).click()
  await until('back control returns to season two', async () => ({ ok: params(a.page)['vs-work'] === seasonTwoId, p: params(a.page) }))
  await a.page.reload()
  await a.page.locator('.vsync-focus .vsync-card').waitFor({ timeout: 20_000 })
  await dismissDialogs(a.page)
  assert.equal(params(a.page)['vs-work'], seasonTwoId, 'a refresh keeps the focused work')
  await a.page.goBack()
  await until('the browser back button leaves the focused work', async () => ({ ok: params(a.page)['vs-work'] === undefined && await a.page.locator('.vsync-focus').count() === 0, p: params(a.page) }))
  await a.page.goForward()
  await a.page.locator('.vsync-focus .vsync-card').waitFor({ timeout: 20_000 })
  await a.page.locator('.vsync-focus').getByRole('button', { name: 'Back' }).click()
  await until('back control after a refresh leaves the focused work', async () => ({ ok: params(a.page)['vs-work'] === undefined && await a.page.locator('.vsync-focus').count() === 0, p: params(a.page) }))
  await a.page.locator('.vsync-searchField').fill('测试')
  await a.page.locator('.vsync-search button[type=submit]').click()
  await a.page.waitForSelector('.vsync-results > .vsync-card', { timeout: 30_000 })
  // The second browser searches too and gets the covers from the host's cache.
  await b.page.goto(origin)
  await sleep(1500)
  await dismissDialogs(b.page)
  await b.page.getByText('Media', { exact: true }).first().click()
  await b.page.waitForSelector('.vsync-pageTabs', { timeout: 15_000 })
  await openTab(b.page, 'Discover')
  await b.page.locator('.vsync-searchField').fill('测试')
  await b.page.locator('.vsync-search button[type=submit]').click()
  await until('the second browser sees the covers', async () => {
    const state = await b.page.evaluate(() => [...document.querySelectorAll('.vsync-results > .vsync-card img.vsync-cover')].map(img => img.complete && img.naturalWidth > 0))
    return { ok: state.length === 2 && state.every(Boolean), state }
  }, 30_000)
  await shot(b.page, 'search-results-second-browser')
  const outside = [...a.requests, ...b.requests].filter(url => new URL(url).origin !== origin && !url.startsWith('data:') && !url.startsWith('blob:'))
  assert.deepEqual(outside, [], 'no browser contacted anything but DSH')
  await b.page.goto(origin)
  log('covers: cards with cover, popularity, episodes, status, tags; details with fields and related; no request left DSH')
}

/**
 * The tabs and the pickers: Watching is the default, every place is in the URL (a refresh, the back button and a pasted link keep it),
 * Discover lists the configured source and Link with the source's own categories, and the last choice is remembered per browser.
 */
async function tabFlows({ a, origin }) {
  const tab = name => a.page.locator('.vsync-pageTabs').getByRole('tab', { name, exact: true })
  const selected = async () => (await a.page.locator('.vsync-pageTabs [role=tab][aria-selected=true]').allTextContents()).join()
  const place = async () => ({ tab: await selected(), source: await a.page.locator('.vsync-segment [aria-selected=true]').textContent().catch(() => null), kind: await a.page.locator('.vsync-picker .vsync-chip[aria-selected=true]').textContent().catch(() => null) })

  // Watching is the default; nothing is playing and nothing started, so it says so and points at the other tabs.
  assert.equal(await selected(), 'Watching')
  assert.deepEqual(params(a.page), {}, 'the default place leaves the URL alone')
  await a.page.locator('.vsync-emptyState').waitFor({ timeout: 10_000 })
  assert.match(await a.page.locator('.vsync-emptyState').textContent(), /Nothing is playing/)
  await shot(a.page, 'tab-watching-empty')

  // Library: the shows; Watching's content is gone.
  await tab('Library').click()
  await a.page.waitForSelector('.vsync-show', { timeout: 15_000 })
  assert.deepEqual(params(a.page), { 'vs-tab': 'library' })
  assert.equal(await a.page.locator('.vsync-emptyState').count(), 0)
  await shot(a.page, 'tab-library')

  // Discover: All sources first (every category once), the configured sources, then Link; under Fanqie its own categories, from the config; no categories under Link.
  await tab('Discover').click()
  await a.page.locator('.vsync-segment').waitFor()
  assert.deepEqual(await a.page.locator('.vsync-segment [role=tab]').allTextContents(), ['All sources', 'Fanqie', 'Books', 'Link'])
  assert.deepEqual(await a.page.locator('.vsync-picker .vsync-chip').allTextContents(), ['Short dramas', 'Audiobooks', 'Novels', 'Ebooks', 'Papers'])
  await until('the URL names the source and category', async () => ({ ok: params(a.page)['vs-kind'] === 'drama', p: params(a.page) }))
  assert.deepEqual(params(a.page), { 'vs-tab': 'discover', 'vs-source': 'all', 'vs-kind': 'drama' })
  await a.page.locator('.vsync-segment').getByRole('tab', { name: 'Fanqie' }).click()
  assert.deepEqual(await a.page.locator('.vsync-picker .vsync-chip').allTextContents(), ['Short dramas', 'Audiobooks', 'Novels'])
  assert.deepEqual(params(a.page), { 'vs-tab': 'discover', 'vs-source': 'fanqie', 'vs-kind': 'drama' })
  await shot(a.page, 'tab-discover')
  await a.page.getByRole('tab', { name: 'Audiobooks' }).click()
  assert.equal(params(a.page)['vs-kind'], 'audio')
  await a.page.locator('.vsync-segment').getByRole('tab', { name: 'Link' }).click()
  assert.deepEqual(params(a.page), { 'vs-tab': 'discover', 'vs-source': 'link' })
  assert.equal(await a.page.locator('.vsync-picker .vsync-chip').count(), 0, 'Link has no categories')
  assert.equal(await a.page.locator('.vsync-searchField').getAttribute('placeholder'), 'Paste a link to a video or playlist')
  await shot(a.page, 'tab-discover-link')
  await a.page.locator('.vsync-searchField').fill('not a link')
  await a.page.locator('.vsync-search button[type=submit]').click()
  assert.match(await a.page.locator('.vsync-error').textContent(), /Paste the address/)
  await a.page.locator('.vsync-searchField').fill('')
  await a.page.locator('.vsync-segment').getByRole('tab', { name: 'Fanqie' }).click()
  assert.equal(params(a.page)['vs-kind'], 'audio', 'a source comes back on the category it had')

  // A web address typed into a source's search box moves to Link, keeping the text.
  const address = 'https://video.example/watch/abcdefghijk'
  await a.page.locator('.vsync-searchField').fill(address)
  await until('the Link source is picked', async () => ({ ok: (await place()).source === 'Link', place: await place() }))
  assert.equal(await a.page.locator('.vsync-searchField').inputValue(), address)
  await a.page.locator('.vsync-searchField').fill('')
  await a.page.locator('.vsync-segment').getByRole('tab', { name: 'Fanqie' }).click()

  // A refresh keeps the place; so does a link to it; the back button walks the tabs.
  await a.page.reload()
  await a.page.waitForSelector('.vsync-pageTabs', { timeout: 20_000 })
  assert.deepEqual(await place(), { tab: 'Discover', source: 'Fanqie', kind: 'Audiobooks' })
  await a.page.goBack()
  await until('back goes to the Library tab', async () => ({ ok: (await selected()) === 'Library', sel: await selected() }))
  await a.page.goBack()
  await until('back goes to the Watching tab', async () => ({ ok: (await selected()) === 'Watching', sel: await selected() }))
  await a.page.goto(`${origin}/?vs-tab=library`)
  await a.page.waitForSelector('.vsync-show', { timeout: 20_000 })
  assert.equal(await selected(), 'Library', 'a link opens the page on its tab')

  // Without parameters it starts on Watching; Discover returns to what this browser used last.
  await a.page.goto(origin)
  await sleep(1500)
  await dismissDialogs(a.page)
  await a.page.getByText('Media', { exact: true }).first().click()
  await a.page.waitForSelector('.vsync-pageTabs', { timeout: 15_000 })
  assert.equal(await selected(), 'Watching')
  await tab('Discover').click()
  await a.page.locator('.vsync-segment').waitFor()
  await until('the last source and category are back', async () => ({ ok: JSON.stringify(await place()) === JSON.stringify({ tab: 'Discover', source: 'Fanqie', kind: 'Audiobooks' }), place: await place() }))
  assert.deepEqual(params(a.page), { 'vs-tab': 'discover', 'vs-source': 'fanqie', 'vs-kind': 'audio' })
  // A source that is not there falls back to the remembered one.
  await a.page.goto(`${origin}/?vs-tab=discover&vs-source=gone&vs-kind=nope`)
  await a.page.locator('.vsync-segment').waitFor({ timeout: 20_000 })
  await dismissDialogs(a.page)
  await until('an unknown source falls back', async () => ({ ok: (await place()).source === 'Fanqie', place: await place() }))
  assert.equal(params(a.page)['vs-source'], 'fanqie')
  // The following flows start from Fanqie's first category.
  await a.page.getByRole('tab', { name: 'Short dramas' }).click()
  await tab('Library').click()
  await a.page.waitForSelector('.vsync-show')
  log('tabs: default, URL state, refresh, back, link, remembered source and category')
}

/**
 * Books: an Ebooks search under All sources through the stand-in book source, the filter row, a download in a
 * chosen format onto the shelf, saving it to the device (an attachment with its type and name), the shelf in the
 * Library tab (shared by everyone here: this DSH has no sign-in plugin, so it has one owner), and deleting it.
 */
async function bookFlows({ a, b, signIn, origin }) {
  const page = a.page
  await page.goto(`${origin}/?vs-tab=discover&vs-source=all&vs-kind=ebook`)
  await page.locator('.vsync-filters').waitFor({ timeout: 20_000 })
  await dismissDialogs(page)
  await page.locator('.vsync-searchField').fill('pride')
  await page.locator('.vsync-search button[type=submit]').click()
  const cards = page.locator('.vsync-results > .vsync-book')
  await until('three books', async () => ({ ok: await cards.count() === 3, n: await cards.count() }), 20_000)
  const pride = cards.filter({ hasText: 'Pride and Prejudice' })
  assert.match(await pride.locator('.vsync-rowMeta').textContent(), /Jane Austen.*1813.*English.*Test Gutenberg/)
  assert.deepEqual(await pride.locator('.vsync-tag').allTextContents(), ['EPUB · 300B', 'TXT · 700B'])
  await shot(page, 'books-results')

  // The hub filters what the source answered: Chinese leaves one book; a size cap drops the large one.
  await page.locator('.vsync-filter').filter({ hasText: 'Language' }).locator('select').selectOption('zh')
  await until('one Chinese book', async () => ({ ok: await cards.count() === 1, titles: await cards.locator('.vsync-rowTitle').allTextContents() }), 20_000)
  assert.deepEqual(await cards.locator('.vsync-rowTitle').allTextContents(), ['红楼梦'])
  await page.locator('.vsync-filter').filter({ hasText: 'Language' }).locator('select').selectOption('')
  await page.locator('.vsync-filter').filter({ hasText: 'Size' }).locator('select').selectOption('5')
  await until('the large book is left out', async () => ({ ok: await cards.count() === 2, titles: await cards.locator('.vsync-rowTitle').allTextContents() }), 20_000)
  assert.ok(!(await cards.locator('.vsync-rowTitle').allTextContents()).includes('Moby Dick'))

  // Download the txt: it lands on the shelf, then Save hands the file over as an attachment.
  await pride.locator('select.vsync-pick').selectOption('txt')
  await pride.getByRole('button', { name: 'Add to shelf' }).click()
  const save = pride.getByRole('link', { name: 'Download to device (TXT)' })
  await save.waitFor({ timeout: 20_000 })
  const href = await save.getAttribute('href')
  const file = await a.context.request.get(new URL(href, origin).href)
  assert.equal(file.status(), 200)
  assert.equal(file.headers()['content-type'], 'text/plain; charset=utf-8')
  assert.match(file.headers()['content-disposition'], /^attachment; filename="Pride and Prejudice.txt"/)
  assert.equal(await file.text(), 'Pride and Prejudice\nJane Austen\n')
  const [download] = await Promise.all([page.waitForEvent('download'), save.click()])
  assert.equal(download.suggestedFilename(), 'Pride and Prejudice.txt')
  await shot(page, 'books-downloaded')

  // My books, on both browsers (one owner here); delete empties it.
  await page.goto(`${origin}/?vs-tab=library`)
  await dismissDialogs(page)
  // A book on the shelf is a library card like a show.
  const shelf = page.locator('.vsync-show').filter({ has: page.locator('.vsync-badge', { hasText: 'Book' }) })
  await shelf.first().waitFor({ timeout: 20_000 })
  assert.deepEqual(await shelf.locator('.vsync-rowTitle').allTextContents(), ['Pride and Prejudice'])
  assert.match(await shelf.locator('.vsync-rowMeta').textContent(), /Jane Austen.*TXT/)
  await iosSaveFlows({ signIn, origin })
  await shot(page, 'books-shelf')
  if (screenshots) {
    await page.setViewportSize({ width: 390, height: 844 })
    await shot(page, 'books-shelf-phone')
    await page.goto(`${origin}/?vs-tab=discover&vs-source=all&vs-kind=ebook`)
    // On a phone the filters fold behind one button.
    const toggle = page.locator('.vsync-filterToggle')
    await toggle.waitFor({ timeout: 20_000 })
    await dismissDialogs(page)
    assert.equal(await page.locator('.vsync-filters').isVisible(), false)
    await toggle.click()
    await page.locator('.vsync-filters').waitFor({ timeout: 5000 })
    await shot(page, 'books-discover-phone')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${origin}/?vs-tab=library`)
    await shelf.first().waitFor({ timeout: 20_000 })
    await sleep(1500)
    await dismissDialogs(page)
  }
  await shelf.getByRole('button', { name: 'More' }).click()
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
  await shelf.locator('.vsync-confirm').getByRole('button', { name: 'Delete' }).click()
  await until('the book is off the shelf', async () => ({ ok: await shelf.count() === 0 }), 10_000)
  // The flows after this one start from Fanqie's short dramas, remembered by this browser.
  await page.goto(`${origin}/?vs-tab=discover&vs-source=fanqie&vs-kind=drama`)
  await page.locator('.vsync-segment').waitFor({ timeout: 20_000 })
  await page.goto(`${origin}/?vs-tab=library`)
  await page.waitForSelector('.vsync-show', { timeout: 20_000 })
  log('books: all-sources search, filters, download, save as attachment, shelf on both browsers, delete')
}

/**
 * The page in the viewer's language: a browser set to each shipped language (one per locale/<tag>.json) sees the
 * sidebar entry, the tabs and the default source's name in it. The words are read from the locale files.
 */
async function languageFlows({ browser, signIn, origin }) {
  const words = tag => JSON.parse(readFileSync(join(repo, 'locale', `${tag}.json`), 'utf8')).ui
  for (const tag of readdirSync(join(repo, 'locale')).map(name => name.replace(/\.json$/, ''))) {
    const ui = words(tag)
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: tag })
    const page = await context.newPage()
    await page.goto(signIn)
    await page.waitForLoadState('networkidle').catch(() => {})
    await dismissDialogs(page)
    await page.goto(`${origin}/?vs-tab=discover&vs-source=fanqie&vs-kind=drama`)
    await page.locator('.vsync-pageTabs').waitFor({ timeout: 20_000 })
    await dismissDialogs(page)
    assert.deepEqual(await page.locator('.vsync-pageTabs [role=tab]').allTextContents(), [ui['tab.watching'], ui['tab.library'], ui['tab.discover']], tag)
    assert.equal(await page.getByText(ui.panel, { exact: true }).count() > 0, true, `${tag}: sidebar entry`)
    assert.ok((await page.locator('.vsync-seg').allTextContents()).includes(ui['source.name.fanqie']), `${tag}: source name`)
    await shot(page, `language-${tag}`)
    await context.close()
  }
  log('languages: the page follows the viewer\'s language for every locale file')
}

/** The Watching tab with something to continue: the started show, newest first, continuing it opens a room. */
async function watchingFlows({ a }) {
  await closeRooms(a.page)
  // The show watched last is the Watching tab's card; its button picks up at the episode it stopped.
  const card = a.page.locator('.vsync-cc').filter({ hasText: '测试短剧' })
  await card.waitFor({ timeout: 10_000 })
  await shot(a.page, 'tab-watching')
  await card.getByRole('button', { name: 'Continue · episode 2' }).click()
  await a.page.waitForSelector('.vsync-media', { timeout: 60_000 })
  // A room opened to watch alone is unlisted, so it is closed from inside, which also returns to the page.
  await a.page.locator('.vsync-bar').getByRole('button', { name: 'Close room' }).click()
  await a.page.locator('.vsync-bar .vsync-confirm').getByRole('button', { name: 'Close room' }).click()
  await openTab(a.page, 'Library')
  await a.page.waitForSelector('.vsync-show')
  log('watching: the card continues the show in a room, which closes from inside')
}

/** Sorting and "Load more": a search whose source has a second page, sorted by plays, the page added below without repeats. */
async function pagingFlows({ a }) {
  const titles = () => a.page.locator('.vsync-results > .vsync-card .vsync-cardHead .vsync-rowTitle').allTextContents()
  await a.page.locator('.vsync-searchField').fill('分页')
  await a.page.locator('.vsync-search button[type=submit]').click()
  await until('the first page shows', async () => ({ ok: (await titles()).join() === '分页甲,分页乙', titles: await titles() }), 15_000)
  await a.page.getByRole('button', { name: 'Most played' }).click()
  assert.deepEqual(await titles(), ['分页乙', '分页甲'], 'sorted by plays')
  await a.page.getByRole('button', { name: 'Load more' }).click()
  await until('the second page is added', async () => ({ ok: (await titles()).length === 3, titles: await titles() }), 15_000)
  assert.deepEqual(await titles(), ['分页乙', '分页丙', '分页甲'], 'the new page is sorted in')
  assert.equal(await a.page.getByRole('button', { name: 'Load more' }).count(), 0, 'no more pages')
  await a.page.getByRole('button', { name: 'Default' }).click()
  assert.deepEqual(await titles(), ['分页甲', '分页乙', '分页丙'])
  await a.page.locator('.vsync-searchField').fill('')
  log('paging: sort by plays, load more adds a page without repeats')
}

/**
 * Link: an address is looked up through yt-dlp and shows as one work with a
 * quality choice; watching it fetches episodes in that quality into a show,
 * every yt-dlp call takes the configured proxy, the thumbnail fails closed
 * through the dead proxy, and the library falls back to a frame of the file.
 */
async function linkFlows({ a, home }) {
  const calls = () => readFileSync(join(dirname(home), 'yt-dlp-calls.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line))
  await a.page.goto(`${new URL(a.page.url()).origin}/?vs-tab=discover&vs-source=link`)
  await a.page.locator('.vsync-segment').waitFor({ timeout: 20_000 })
  await dismissDialogs(a.page)
  // A lookup that fails (the address fails, and the proxy it goes through is down) says why in words, never a bare status.
  await a.page.locator('.vsync-searchField').fill('https://video.example/fail')
  await a.page.locator('.vsync-search button[type=submit]').click()
  await a.page.locator('.vsync-error').waitFor({ timeout: 20_000 })
  assert.match(await a.page.locator('.vsync-error').textContent(), /connection this site goes through isn't working/)
  await a.page.locator('.vsync-searchField').fill('https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG')
  await a.page.locator('.vsync-search button[type=submit]').click()
  const card = a.page.locator('.vsync-results .vsync-card')
  await card.waitFor({ timeout: 20_000 })
  assert.match(await card.locator('.vsync-rowTitle').textContent(), /Billboard/)
  assert.match(await card.locator('.vsync-rowMeta').textContent(), /3 episodes.*12:35/)
  assert.deepEqual(await card.locator('select.vsync-quality option').allTextContents(), ['Auto', '1080p', '720p', '480p', '360p', 'Audio only'])
  await until('the thumbnail fails closed: the placeholder shows', async () => ({ ok: await card.locator('.vsync-coverEmpty').count() === 1 }), 20_000)
  await shot(a.page, 'link-result')
  await card.locator('select.vsync-quality').selectOption('480')
  await card.getByRole('button', { name: 'Watch', exact: true }).click()
  await a.page.waitForSelector('.vsync-media', { timeout: 60_000 })
  assert.equal(await a.page.locator('.vsync-episode').count(), 3, 'every video of the playlist is an episode')
  await until('the first episode plays', async () => ({ ok: await a.page.evaluate(() => { const video = document.querySelector('video'); return video !== null && video.readyState >= 2 }) }), 60_000)
  const downloads = calls().filter(args => args.includes('--playlist-items'))
  assert.ok(downloads.length > 0, 'an episode was downloaded')
  assert.equal(downloads[0][downloads[0].indexOf('-S') + 1], 'res:480,vcodec:h264,acodec:aac', 'in the chosen quality')
  assert.ok(calls().every(args => args[args.indexOf('--proxy') + 1] === DEAD_PROXY), 'every yt-dlp call took the proxy')
  await shot(a.page, 'link-room')
  await a.page.goto(`${new URL(a.page.url()).origin}/?vs-tab=library`)
  await a.page.locator('.vsync-show').first().waitFor({ timeout: 20_000 })
  await dismissDialogs(a.page)
  const poster = a.page.locator('.vsync-show', { hasText: 'Billboard' }).locator('img.vsync-poster')
  await until('the show\'s poster is a frame of its episode', async () => ({ ok: await poster.evaluate(img => img.complete && img.naturalWidth > 0).catch(() => false) }), 30_000)
  await shot(a.page, 'link-library')
  await closeRooms(a.page)
  log('link: failure in words, lookup, quality, proxy on every call, thumbnail failed closed, frame poster')
}

/** Search → watch together now, the room listing every episode, the watch log, deleting from the library. */
async function hubFlows({ a, b, origin, home, show }) {
  await loadingFlows({ a })
  // Search the (stand-in) Fanqie source.
  await a.page.locator('.vsync-searchField').fill('测试')
  await a.page.locator('.vsync-search button[type=submit]').click()
  await a.page.waitForSelector('.vsync-card', { timeout: 30_000 })
  await until('the result shows its episode count', async () => {
    const meta = await a.page.locator('.vsync-results > .vsync-card .vsync-rowMeta').first().textContent()
    return { ok: /3 episodes/.test(meta), meta }
  }, 30_000)
  const results = await a.page.locator('.vsync-results > .vsync-card .vsync-cardHead .vsync-rowTitle').allTextContents()
  assert.deepEqual(results, ['测试短剧', '测试短剧第二季'])
  await shot(a.page, 'search-results')
  await coverFlows({ a, b, origin })

  // Watch: the room opens at once; its player waits for episode 1.
  await a.page.getByRole('button', { name: 'Watch', exact: true }).first().click()
  await a.page.waitForSelector('.vsync-media', { timeout: 60_000 })
  const roomId = await until('the room has opened', async () => {
    const rooms = await a.page.evaluate(() => fetch('media-hub/api/rooms').then(r => r.json()))
    const room = rooms.rooms.find(r => r.title === '测试短剧')
    return { ok: room !== undefined, id: room?.id }
  }, 10_000)
  await b.open(roomId.id)
  await until('both play episode 1', async () => {
    const p = await positions(a, b)
    return { ok: p.a.src !== '' && p.b.src !== '', p }
  }, 60_000)
  await a.page.evaluate(() => document.querySelector('video.vsync-media').play())
  await until('all three episodes are cached', async () => {
    const meta = await a.page.locator('.vsync-episode[data-cached=false]').count()
    return { ok: meta === 0 && await a.page.locator('.vsync-episode').count() === 3, meta }
  }, 60_000)
  await sleep(1500)
  assert.equal(await a.page.locator('.vsync-episodeTitle').first().textContent(), '第1集', 'episodes carry the source\'s own titles')
  assert.match(await a.page.locator('.vsync-nextSeason').textContent(), /测试短剧第二季/, 'the next season is offered')
  await a.page.locator('.vsync-sideTabs').getByRole('tab', { name: 'About' }).click()
  await a.page.locator('.vsync-about .vsync-related').first().waitFor({ timeout: 10_000 })
  assert.match(await a.page.locator('.vsync-about').textContent(), /测试短剧/)
  assert.equal(await a.page.locator('.vsync-about .vsync-metaButton, .vsync-about .vsync-card').count(), 0)
  await shot(a.page, 'room-about')
  await a.page.locator('.vsync-sideTabs').getByRole('tab', { name: 'Episodes' }).click()
  await shot(a.page, 'fanqie-room')
  // Watch episode 1 to its end, so the log has a finished episode.
  await a.page.evaluate(() => { const v = document.querySelector('video.vsync-media'); v.currentTime = v.duration - 1.5 })
  await until('the room moved on to episode 2', async () => {
    const current = await b.page.locator('.vsync-episode[aria-current=true] .vsync-episodeNo').textContent()
    return { ok: current === '2', current }
  }, 20_000)
  // Episode 2 was loading in the background: the page swapped that element in instead of loading it at the switch.
  for (const v of [a, b]) {
    await until('the preloaded episode is the one on screen', async () => ({ ok: await v.page.evaluate(() => document.querySelector('video.vsync-media')?.dataset.swapped === 'true') }), 10_000)
  }
  // Everyone had episode 2 ready, so the server scheduled the switch for the end of episode 1: nobody waited at a gate for it.
  const switchedAt = Date.now()
  await sleep(1500)
  assert.ok(b.sent.some(frame => frame.payload.includes('"op":"nextready"')), 'a viewer said the next episode was ready')
  assert.deepEqual(b.sent.filter(frame => frame.at > switchedAt - 800 && frame.payload.includes('"op":"ready"')), [], 'the switch needed no ready gate')
  await until('episode 1 is marked watched in the room', async () => {
    const mark = await b.page.locator('.vsync-episode').first().getAttribute('data-watch')
    return { ok: mark === 'watched', mark }
  }, 10_000)
  await sleep(1500)
  await shot(b.page, 'fanqie-room-watched')
  await b.page.goto(origin)

  // The watch log, read the way the assistant's history action reads it.
  const logFile = join(home, 'media-hub', 'watch-log.jsonl')
  assert.ok(existsSync(logFile), 'watch log written')
  const types = new Set(readFileSync(logFile, 'utf8').trim().split('\n').map(line => JSON.parse(line).type))
  for (const type of ['room.opened', 'viewer.joined', 'episode.started', 'episode.finished', 'viewer.left']) assert.ok(types.has(type), `log has ${type}`)
  const history = await createWatchLog({ file: logFile, logger: console }).history()
  const drama = history.find(entry => entry.title === '测试短剧')
  log('history:', JSON.stringify(drama))
  assert.deepEqual(drama.episodesFinished, [1])
  assert.deepEqual(drama.with.sort(), ['Alice', 'Bob'])

  // Back on the page: rooms block deleting their show; close the room (unlisted, since it was opened to watch alone), then delete.
  await a.page.locator('.vsync-bar').getByRole('button', { name: 'Close room' }).click()
  await a.page.locator('.vsync-bar .vsync-confirm').getByRole('button', { name: 'Close room' }).click()
  await openTab(a.page, 'Library')
  await a.page.waitForSelector('.vsync-show')
  await until('library shows both posters', async () => {
    const posters = await a.page.locator('.vsync-show img.vsync-poster').count()
    return { ok: posters >= 2, posters }
  }, 20_000)
  const dramaMeta = await a.page.locator('.vsync-show', { hasText: '测试短剧' }).locator('.vsync-rowMeta').first().textContent()
  log('library row:', dramaMeta)
  assert.match(dramaMeta, /watched 1\/3/)
  assert.match(dramaMeta, /continue from ep 2/)
  const shownRow = a.page.locator('.vsync-show', { hasText: '测试短剧' })
  const library = await a.page.evaluate(async () => (await fetch('media-hub/api/library')).json())
  const cover = library.shows.find(one => one.name === '测试短剧')?.work?.cover
  assert.ok(cover, 'the show keeps its work\'s cover')
  assert.equal(new URL(await shownRow.locator('img.vsync-poster').first().getAttribute('src'), origin).href, new URL(cover, `${origin}/media-hub/`).href, 'the library row shows the source cover')
  assert.match(await shownRow.locator('.vsync-rowMeta').first().textContent(), /★ 8\.6/)
  await shownRow.locator('.vsync-detailsToggle').click()
  await shownRow.locator('.vsync-showDetails .vsync-related').first().waitFor({ timeout: 10_000 })
  assert.equal(await shownRow.locator('.vsync-showDetails .vsync-metaButton, .vsync-showDetails .vsync-card').count(), 0)
  await shot(a.page, 'library-details')
  // Following from the row's menu: the row says so, and nothing is news yet.
  await shownRow.getByRole('button', { name: 'More' }).click()
  await a.page.getByRole('menuitem', { name: 'Follow', exact: true }).click()
  await until('the row says it is followed', async () => ({ ok: /Following/.test(await shownRow.locator('.vsync-rowMeta').first().textContent()) }), 10_000)
  await shownRow.locator('.vsync-showDetails .vsync-related', { hasText: '测试短剧第二季' }).getByRole('button').click()
  await a.page.locator('.vsync-focus .vsync-card').waitFor({ timeout: 15_000 })
  assert.equal(params(a.page)['vs-tab'], 'discover', 'a related work opens in Discover')
  // The first season is in the library, so its row in the related list says so instead of offering it again; the card offers to continue, not to save.
  await a.page.locator('.vsync-focus .vsync-related', { hasText: '测试短剧' }).first().waitFor({ timeout: 15_000 })
  await until('the related first season is marked as in the library', async () => ({ ok: await a.page.locator('.vsync-focus .vsync-related .vsync-badgeHere').count() > 0 }))
  await a.page.locator('.vsync-focus').getByRole('button', { name: 'Back' }).click()
  await openTab(a.page, 'Library')
  await a.page.waitForSelector('.vsync-show')
  await a.page.locator('.vsync-show', { hasText: '测试短剧' }).locator('.vsync-expand').click()
  await a.page.waitForSelector('.vsync-subrow[data-watch=watched]')
  await sleep(300)
  await shot(a.page, 'library')

  // The deletion countdown: start it by hand, see it on the row, keep the show instead.
  const dramaRow = a.page.locator('.vsync-show', { hasText: '测试短剧' })
  await dramaRow.getByRole('button', { name: 'More' }).click()
  await a.page.getByRole('menuitem', { name: 'Delete in 7 days' }).click()
  await dramaRow.locator('.vsync-rowMeta .vsync-metaButton').waitFor({ timeout: 10_000 })
  assert.equal(await dramaRow.locator('.vsync-rowMeta .vsync-metaButton').textContent(), 'deletes in 7 days')
  await dramaRow.locator('.vsync-rowMeta .vsync-metaButton').click()
  await shot(a.page, 'library-countdown')
  await a.page.getByRole('menuitem', { name: 'Keep', exact: true }).click()
  await until('the show is kept', async () => {
    const meta = await dramaRow.locator('.vsync-rowMuted').first().textContent()
    return { ok: /kept/.test(meta) && await dramaRow.locator('.vsync-rowMeta .vsync-metaButton').count() === 0, meta }
  }, 10_000)
  const actions = readFileSync(logFile, 'utf8').trim().split('\n').map(line => JSON.parse(line)).filter(line => line.type.startsWith('library.') && line.by)
  assert.deepEqual(actions.map(line => [line.type, line.by]), [['library.countdownStarted', 'Alice'], ['library.kept', 'Alice']])

  const testShow = a.page.locator('.vsync-show', { hasText: 'Test show' })
  await testShow.getByRole('button', { name: 'More' }).click()
  await a.page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
  await testShow.locator('.vsync-error').waitFor()
  await watchingFlows({ a })
  // One episode of the downloaded show, then the whole test show.
  const drama2 = a.page.locator('.vsync-show', { hasText: '测试短剧' })
  await drama2.locator('.vsync-expand').click()
  await drama2.locator('.vsync-subrow').nth(2).hover()
  await drama2.locator('.vsync-subrowDelete').nth(2).click()
  await shot(a.page, 'library-confirm')
  await drama2.locator('.vsync-confirm').getByRole('button', { name: 'Delete' }).click()
  await until('the episode is no longer cached', async () => ({ ok: await drama2.locator('.vsync-subrow[data-cached=false]').count() === 1 && await drama2.locator('.vsync-subrow').count() === 3 }), 10_000)
  await testShow.getByRole('button', { name: 'More' }).click()
  await a.page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
  await testShow.locator('.vsync-confirm').getByRole('button', { name: 'Delete' }).click()
  await until('the test show is deleted', async () => ({ ok: !existsSync(show) && await a.page.locator('.vsync-show', { hasText: 'Test show' }).count() === 0 }), 10_000)
  log('library: episode and show deleted')
}

/** An iPhone held upright and on its side: touch, no hover, three device pixels per CSS pixel. */
const IPHONE = {
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 3,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
}
const IPHONE_SIDEWAYS = { width: 814, height: 572 }

/**
 * The page installed to an iPhone's home screen. A shelf book there is either not on this device (Download to
 * device, with progress) or on it (Save to other apps, Open in Safari), and that state survives a reload. The
 * page never navigates to the file, and the tap that opens the share sheet never waits on a fetch (iOS refuses
 * the sheet once the tap's moment has passed).
 */
async function iosSaveFlows({ signIn, origin }) {
  // WebKit, the engine every iPhone browser runs: its fetch, streams, Cache Storage and share rules are the ones that count here.
  // With a profile on disk, as an installed app has: Cache Storage of a throwaway WebKit session is dropped at every navigation.
  const safari = await webkit.launchPersistentContext(mkdtempSync(join(tmpdir(), 'media-hub-webkit-')), IPHONE)
  const phone = await viewer({ newContext: async () => safari }, signIn, origin, 'Carol')
  const page = phone.page
  await phone.context.addInitScript(() => {
    const realMatch = window.matchMedia.bind(window)
    window.matchMedia = query => (query === '(display-mode: standalone)' ? { matches: true, media: query, addEventListener() {}, removeEventListener() {} } : realMatch(query))
    window.__events = []
    const realFetch = window.fetch.bind(window)
    window.fetch = (input, init) => {
      if (String(input?.url ?? input).includes('/shelf/file')) window.__events.push('fetch')
      return realFetch(input, init)
    }
    document.addEventListener('click', () => window.__events.push('tap'), true)
    navigator.canShare = () => true
    navigator.share = async ({ files }) => {
      // Like iOS: the sheet opens only if nothing was fetched since the tap that asked for it.
      const events = window.__events
      if (events.lastIndexOf('fetch') > events.lastIndexOf('tap')) throw new DOMException('not allowed', 'NotAllowedError')
      events.push(...await Promise.all(files.map(async one => `share:${one.name}:${await one.text()}`)))
    }
  })
  const events = () => page.evaluate(() => window.__events)
  const shared = 'share:Pride and Prejudice.txt:Pride and Prejudice\nJane Austen\n'
  const shelf = page.locator('.vsync-show').filter({ hasText: /Pride and Prejudice|变成软糯魔女/ })
  const open = async () => {
    await page.goto(`${origin}/?vs-tab=library`)
    await shelf.first().waitFor({ timeout: 20_000 })
    await dismissDialogs(page)
  }
  // The layout follows the panel's own width: phone-narrow upright, wider on its side, and phone-narrow again
  // on its side with a side bar open (the panel squeezed to phone width in a wide window).
  const within = () => page.locator('.vsync-page').getAttribute('data-within')
  const laidOut = async (label, narrow) => until(`the ${label} layout`, async () => ({ ok: (await within()).split(' ').includes('640') === narrow, within: await within() }), 5000)
  const squeeze = width => page.evaluate((px) => { document.querySelector('.vsync-page').style.maxWidth = px === null ? '' : `${px}px` }, width)
  // Each way, with a title long enough to show how it shares the row with the actions.
  const shots = async (name) => {
    if (screenshots) await shelf.locator('.vsync-rowTitle').evaluate((node) => { node.textContent = '变成软糯魔女？不对是钢筋大运！一部名字很长很长的小说' })
    await laidOut('upright', true)
    await shot(page, `${name}-phone`)
    await page.setViewportSize(IPHONE_SIDEWAYS)
    await laidOut('sideways', false)
    await shot(page, `${name}-phone-sideways`)
    await squeeze(442)
    await laidOut('sideways beside a side bar', true)
    await shot(page, `${name}-phone-sideways-sidebar`)
    await squeeze(null)
    await page.setViewportSize(IPHONE.viewport)
    await laidOut('upright', true)
  }

  // Not on this device: one action, Download to device.
  await open()
  const at = page.url()
  await shots('books-not-on-device')
  await shelf.getByRole('button', { name: 'Download to device (TXT)' }).click()
  await shelf.getByRole('button', { name: 'Save to other apps' }).waitFor({ timeout: 10_000 })
  assert.deepEqual(await events(), ['tap', 'fetch'])
  await shots('books-on-device')

  // On this device: Save to other apps opens the share sheet from the tap itself.
  await shelf.getByRole('button', { name: 'Save to other apps' }).click()
  await until('the book reaches the share sheet', async () => ({ ok: (await events()).includes(shared), events: await events() }), 10_000)
  assert.deepEqual(await events(), ['tap', 'fetch', 'tap', shared], 'the sharing tap fetched nothing')
  assert.equal(page.url(), at, 'the installed page did not navigate to the file')
  const inSafari = await shelf.getByRole('link', { name: 'Open in Safari' }).getAttribute('href')
  assert.match(inSafari, /^x-safari-http:\/\/127\.0\.0\.1:\d+\/api\/media-hub\/shelf\/file\?entry=/)

  // The copy outlasts a reload, and the share sheet still opens without a fetch.
  await open()
  await shelf.getByRole('button', { name: 'Save to other apps' }).waitFor({ timeout: 10_000 })
  await shelf.getByRole('button', { name: 'Save to other apps' }).click()
  await until('the kept copy reaches the share sheet', async () => ({ ok: (await events()).includes(shared), events: await events() }), 10_000)
  assert.deepEqual(await events(), ['tap', shared], 'a kept copy is shared without fetching it again')

  // Remove from this device: back to Download to device.
  await shelf.getByRole('button', { name: 'More' }).click()
  await page.getByRole('menuitem', { name: 'Remove from this device' }).click()
  await shelf.getByRole('button', { name: 'Download to device (TXT)' }).waitFor({ timeout: 10_000 })

  // From a Discover card: added to the shelf, brought to the device, shared.
  await page.goto(`${origin}/?vs-tab=discover&vs-source=all&vs-kind=ebook`)
  await page.locator('.vsync-searchField').waitFor({ timeout: 20_000 })
  await dismissDialogs(page)
  await page.locator('.vsync-searchField').fill('moby')
  await page.locator('.vsync-search button[type=submit]').click()
  const moby = page.locator('.vsync-results > .vsync-book').filter({ hasText: 'Moby Dick' })
  await moby.locator('select.vsync-pick').selectOption('txt')
  await moby.getByRole('button', { name: 'Add to shelf', exact: true }).click()
  await moby.getByRole('button', { name: 'Download to device (TXT)' }).click({ timeout: 30_000 })
  await moby.getByRole('button', { name: 'Save to other apps' }).waitFor({ timeout: 30_000 })
  await page.evaluate(() => { window.__events.length = 0 })
  await moby.getByRole('button', { name: 'Save to other apps' }).click()
  await until('the book reaches the share sheet from its Discover card', async () => ({ ok: (await events()).some(event => event.startsWith('share:Moby Dick.txt:Moby Dick')), events: await events() }), 10_000)
  await shot(page, 'books-discover-on-device-phone')
  await open()
  const mobyOnShelf = page.locator('.vsync-show').filter({ hasText: 'Moby Dick' })
  await mobyOnShelf.getByRole('button', { name: 'More' }).click()
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
  await mobyOnShelf.locator('.vsync-confirm').getByRole('button', { name: 'Delete' }).click()
  await until('the large book is off the shelf', async () => ({ ok: await mobyOnShelf.count() === 0 }), 10_000)
  assert.deepEqual(phone.crashes, [])
  await safari.close()
}

async function main() {
  const dsh = await bootDsh()
  const origin = new URL(dsh.url).origin
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || execFileSync('sh', ['-c', 'command -v chromium']).toString().trim(),
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  })
  try {
    const show = makeEpisodes(dsh.home)
    const a = await viewer(browser, dsh.url, origin, 'Alice')
    const b = await viewer(browser, dsh.url, origin, 'Bob')

    await a.page.goto(origin)
    await sleep(1500)
    await dismissDialogs(a.page)
    await a.page.getByText('Media', { exact: true }).first().click()
    await a.page.waitForSelector('.vsync-pageTabs', { timeout: 15_000 })
    await tabFlows({ a, origin })
    await bookFlows({ a, b, signIn: dsh.url, origin })
    await languageFlows({ browser, signIn: dsh.url, origin })
    await shot(a.page, 'home')
    const created = await a.page.evaluate(async (path) => {
      const response = await fetch('api/media-hub/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: 'local', path, by: 'Alice' }) })
      return response.json()
    }, show)
    assert.ok(created.room?.id, JSON.stringify(created))
    const room = created.room.id
    log('room', room, created.room.title, `${created.room.episodes} episodes`)

    await a.open(room)
    // A room starts as one person's own; Watch together opens it to others.
    await a.page.getByRole('button', { name: 'Watch together' }).click()
    await b.open(room)
    await until('both players loaded', async () => {
      const p = await positions(a, b)
      return { ok: p.a.src !== '' && p.b.src !== '', p }
    }, 60_000)
    await until('both viewers listed', async () => {
      const names = await a.page.locator('.vsync-avatarStack').getAttribute('aria-label')
      return { ok: /Alice/.test(names) && /Bob/.test(names), names }
    })
    await shot(a.page, 'room-paused')

    // Play from A reaches B.
    await a.page.evaluate(() => document.querySelector('video.vsync-media').play())
    await until('B plays after A pressed play', async () => {
      const p = await positions(a, b)
      return { ok: !p.b.paused, p }
    })
    const toast = await until('B was told who played', async () => {
      const texts = await b.page.locator('.vsync-toast').allTextContents()
      return { ok: texts.some(text => /Alice pressed play/.test(text)), texts }
    }, 3000)
    log('B toasts:', toast.texts)
    await sleep(500)
    await shot(b.page, 'room-playing')
    await sleep(3500)
    let p = await positions(a, b)
    log('playing: drift', p.drift.toFixed(3), 's')
    assert.ok(Math.abs(p.drift) < 0.3, `drift while playing ${p.drift}`)

    // Pause from B reaches A at the same spot.
    await b.page.evaluate(() => document.querySelector('video.vsync-media').pause())
    p = await until('A paused after B paused', async () => {
      const q = await positions(a, b)
      return { ok: q.a.paused && Math.abs(q.drift) < 0.3, ...q }
    })
    log('paused: A at', p.a.time.toFixed(2), 'B at', p.b.time.toFixed(2))

    // Seek from B moves A.
    await b.page.evaluate(() => { document.querySelector('video.vsync-media').currentTime = 42 })
    p = await until('A followed B\'s seek', async () => {
      const q = await positions(a, b)
      return { ok: Math.abs(q.a.time - 42) < 0.3, ...q }
    })
    log('seek: A at', p.a.time.toFixed(2))
    await a.page.evaluate(() => document.querySelector('video.vsync-media').play())
    await until('both playing again', async () => {
      const q = await positions(a, b)
      return { ok: !q.a.paused && !q.b.paused, ...q }
    })
    await sleep(3000)

    // Small drift is pulled back by rate.
    await silentJump(b.page, 1)
    const nudged = await until('B slows down to let A catch up', async () => {
      const q = await positions(a, b)
      return { ok: Math.abs(q.b.rate - 0.95) < 1e-6, ...q }
    }, 5000)
    log('drift 1 s: B rate', nudged.b.rate, 'drift', nudged.drift.toFixed(2))
    p = await until('drift back under 0.3 s', async () => {
      const q = await positions(a, b)
      return { ok: Math.abs(q.drift) < 0.25 && q.b.rate === 1, ...q }
    }, 40_000)
    log('drift corrected by rate:', p.drift.toFixed(3), 's')

    // Large drift is fixed by a seek.
    await silentJump(b.page, 6)
    p = await until('B seeks back after a 6 s jump', async () => {
      const q = await positions(a, b)
      return { ok: Math.abs(q.drift) < 0.3, ...q }
    }, 8000)
    log('drift corrected by seek:', p.drift.toFixed(3), 's')

    // Episode switch from A's episode list reaches B, through the ready gate.
    await dismissDialogs(a.page)
    await readyGate({ a, b })
    p = await until('B switched to episode 3', async () => {
      const q = await positions(a, b)
      return { ok: /\/2\/Episode%203\.mp4$/.test(q.b.src) && q.b.time < 10 && !q.b.paused, ...q }
    }, 20_000)
    log('episode switch: B on', decodeURIComponent(p.b.src.split('/').pop()))
    await shot(b.page, 'room-episode-2')
    await sleep(3000)
    p = await positions(a, b)
    assert.ok(Math.abs(p.drift) < 0.3, `drift after switch ${p.drift}`)

    // A dropped connection keeps B playing; it resyncs when back.
    await b.context.setOffline(true)
    await a.page.evaluate(() => { document.querySelector('video.vsync-media').currentTime = 60 })
    await sleep(3000)
    const offline = await positions(a, b)
    log('B offline: paused', offline.b.paused, 'B at', offline.b.time.toFixed(1), 'A at', offline.a.time.toFixed(1))
    assert.equal(offline.b.paused, false, 'B kept playing while offline')
    await b.context.setOffline(false)
    p = await until('B resynced after reconnecting', async () => {
      const q = await positions(a, b)
      return { ok: Math.abs(q.drift) < 0.3 && !q.b.paused, ...q }
    }, 30_000)
    log('reconnect: drift', p.drift.toFixed(3), 's')

    // The room list.
    await a.page.locator('.vsync-bar .vsync-icon').first().click()
    await openTab(a.page, 'Watching')
    await a.page.waitForSelector('.vsync-row')
    await sleep(500)
    await until('the open room lists who is in it', async () => {
      const who = await a.page.locator('.vsync-roomCard .vsync-avatarStack').first().getAttribute('aria-label')
      return { ok: who === 'Bob', who }
    })
    await until('the room card previews the episode now playing', async () => ({ ok: await a.page.locator('.vsync-roomCard img.vsync-preview').count() > 0 }), 20_000)
    assert.equal((await a.page.locator('.vsync-tabCount').textContent()).trim(), '1', 'the Watching tab counts the open room')
    await shot(a.page, 'rooms-list')

    await hubFlows({ a, b, origin, home: dsh.home, show })
    await rollingFlows({ a, b, home: dsh.home })

    await linkFlows({ a, home: dsh.home })

    assert.deepEqual([...a.crashes, ...b.crashes], [], 'no page crashed while rendering')
    console.log('two-browser test passed')
  } finally {
    await browser.close()
    await dsh.stop()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
