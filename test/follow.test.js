import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { DAY_MS, dueFollows, newSeasons, nextCheckAt, seenAtStart } from '../src/follow.js'
import { groupSeasons } from '../src/shows.js'
import { createMediaHub } from '../src/media.js'
import { createDelivery } from '../src/delivery.js'
import { quietLogger, tempDir } from './helpers.js'

const sleep = ms => new Promise(done => setTimeout(done, ms))
async function until(what, check, timeoutMs = 5000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    if (await check()) return
    await sleep(20)
  }
  assert.fail(`timed out: ${what}`)
}

test('the next check is a day after the last, give or take a tenth', () => {
  assert.equal(nextCheckAt(1000, 0), 1000 + DAY_MS * 0.9)
  assert.equal(nextCheckAt(1000, 0.5), 1000 + DAY_MS)
  assert.equal(nextCheckAt(1000, 0.999999) <= 1000 + DAY_MS * 1.1, true)
})

test('the due shows are those whose time has come, the longest overdue first', () => {
  const follows = [{ path: 'a', follow: { nextAt: 300 } }, { path: 'b', follow: { nextAt: 100 } }, { path: 'c', follow: { nextAt: 900 } }, { path: 'd', follow: {} }]
  assert.deepEqual(dueFollows(follows, 500).map(item => item.path), ['d', 'b', 'a'])
})

test('a season is new when it is related as a season and was not there when following began', () => {
  const info = { id: '1', related: [{ id: '2', relation: 'season' }, { id: '3', relation: 'related' }, { id: '4', relation: 'season' }, { id: '1', relation: 'season' }] }
  assert.deepEqual(seenAtStart('1', { related: [{ id: '2' }] }), ['1', '2'])
  assert.deepEqual(newSeasons(info, ['1', '2']).map(season => season.id), ['4'])
})

test('seasons of one work sit together, oldest first, and know their number', () => {
  const shows = [{ path: 'x', addedAt: 50 }, { path: 's2', group: 'g', addedAt: 40 }, { path: 'y', addedAt: 30 }, { path: 's1', group: 'g', addedAt: 10 }]
  groupSeasons(shows)
  assert.deepEqual(shows.map(show => show.path), ['x', 's1', 's2', 'y'])
  assert.deepEqual(shows.filter(show => show.group).map(show => [show.season, show.seasons]), [[1, 2], [2, 2]])
})

function stub({ seasons = [], episodes = 3 } = {}) {
  const calls = []
  const state = { related: seasons, episodes }
  return {
    calls,
    state,
    source: {
      id: 'stub', label: 'Stub', kinds: [{ id: 'drama', label: 'D' }],
      available: async () => true,
      search: async () => ({ results: [], next: null }),
      info: async (id) => {
        calls.push(id)
        const base = { id, kind: 'drama', author: 'a', status: 'ongoing' }
        if (id === '1') return { ...base, title: 'Show', episodes: state.episodes, related: state.related, episodeTitles: [] }
        return { ...base, title: `Show season ${id}`, episodes: 2, related: [], episodeTitles: [] }
      },
      cover: async () => {},
      async download() { return { failed: [] } },
    },
  }
}

function makeHub(dir, source, overrides = {}) {
  return createMediaHub({
    stateDir: join(dir, 'state'),
    libraryRoots: [join(dir, 'state', 'library')],
    delivery: createDelivery({ mode: 'origin' }),
    tools: { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe', ytDlp: 'yt-dlp', maxHeight: 1080, threads: 1 },
    webUrl: () => 'https://dsh.example.com/',
    lifetime: { emptyMinutes: 30, unopenedHours: 24 },
    autoDeleteDays: 7,
    sources: [source],
    cache: { ahead: 2, behind: 1, capBytes: 0 },
    logger: quietLogger,
    fetchTitle: async id => id,
    backfillPauseMs: 1e9,
    follow: { pauseMs: 1, tickMs: 1e9, random: () => 0.5 },
    ...overrides,
  })
}

test('following a new work adds an empty show; a season that appears later is added by itself, grouped, followed, with news and a log line', async (t) => {
  const dir = tempDir(t)
  const { source, state, calls } = stub()
  const note = join(dir, 'notified.jsonl')
  const hub = makeHub(dir, source, { notifyCommand: [process.execPath, '-e', `require('fs').appendFileSync(${JSON.stringify(note)}, require('fs').readFileSync(0, 'utf8'))`] })
  await hub.load()
  t.after(() => hub.dispose())
  const followed = await hub.followWork({ source: 'stub', id: '1' })
  let shows = (await hub.library()).shows
  assert.equal(shows.length, 1)
  assert.deepEqual([shows[0].path, shows[0].episodes, shows[0].total, !!shows[0].follow], [followed.path, 0, 3, true], 'an empty show with its episode list')
  assert.equal(calls.length, 1)

  // Nothing is asked again before it is due.
  await hub.sweepFollows()
  assert.equal(calls.length, 1)

  // A season appears; the next daily check finds it (the check is brought forward here by hand).
  state.related = [{ id: '2', title: 'Show season 2', kind: 'drama', relation: 'season' }]
  await hub.checkFollow(followed.path)
  await until('the new season is in the library', async () => (await hub.library()).shows.length === 2)
  shows = (await hub.library()).shows
  const added = shows.find(show => show.path !== followed.path)
  assert.deepEqual([added.group, shows[0].group, !!added.follow, added.newSeason?.from], [shows[0].group, added.group, true, 'Show'])
  assert.deepEqual(shows.map(show => show.season), [1, 2], 'the seasons sit together, oldest first')
  assert.equal(added.episodes, 0, 'nothing was downloaded')
  await until('the news was passed on', () => existsSync(note))
  assert.equal(JSON.parse(readFileSync(note, 'utf8')).type, 'season')
  const logged = readFileSync(join(dir, 'state', 'watch-log.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line)).filter(line => line.type === 'library.newSeason')
  assert.deepEqual(logged.map(line => line.title), ['Show season 2'])

  // The same season is not news twice; seeing the news clears it.
  await hub.checkFollow(followed.path)
  assert.equal((await hub.library()).shows.length, 2)
  await hub.dismissNews(added.path)
  assert.equal((await hub.library()).shows.find(show => show.path === added.path).newSeason, null)
})

test('more episodes of the season in progress grow the show and are noted; stopping stops the checks', async (t) => {
  const dir = tempDir(t)
  const { source, state, calls } = stub()
  const hub = makeHub(dir, source)
  await hub.load()
  t.after(() => hub.dispose())
  const { path } = await hub.followWork({ source: 'stub', id: '1' })
  state.episodes = 5
  await hub.checkFollow(path)
  const show = (await hub.library()).shows[0]
  assert.deepEqual([show.total, show.newEpisodes.n], [5, 2])
  await hub.followWork({ source: 'stub', id: '1', follow: false })
  const before = calls.length
  await hub.checkFollow(path)
  assert.equal(calls.length, before, 'a show no longer followed is not asked about')
})

test('a failing check is not retried in a loop: the next try is a day on', async (t) => {
  const dir = tempDir(t)
  const stubbed = stub()
  const hub = makeHub(dir, stubbed.source)
  await hub.load()
  t.after(() => hub.dispose())
  const { path } = await hub.followWork({ source: 'stub', id: '1' })
  stubbed.source.info = async () => { throw new Error('source is down') }
  await hub.checkFollow(path)
  const [entry] = hub.followsDue(Date.now())
  assert.equal(entry, undefined, 'it is not due again right away')
})
