import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { createLibrary } from '../src/shows.js'
import { quietLogger, tempDir } from './helpers.js'

const DAY = 86_400_000

function setup(t, overrides = {}) {
  const dir = tempDir(t)
  const root = join(dir, 'library')
  const show = join(root, 'Show')
  mkdirSync(show, { recursive: true })
  for (const n of [1, 2, 3]) writeFileSync(join(show, `0${n} 第${n}集.mp4`), 'x'.repeat(100 * n))
  writeFileSync(join(show, 'SHA256SUMS.txt'), 'aa  01 第1集.mp4\nbb  02 第2集.mp4\ncc  03 第3集.mp4\n')
  writeFileSync(join(root, 'Movie.mp4'), 'y'.repeat(50))
  writeFileSync(join(root, 'notes.txt'), 'not media')
  const state = { clock: 1_000 * DAY, used: new Set() }
  const library = createLibrary({
    roots: [root],
    stateDir: dir,
    autoDeleteDays: 7,
    tools: { ffmpeg: 'false' },
    inUse: path => state.used.has(path),
    download: () => null,
    forget: async () => {},
    logger: quietLogger,
    now: () => state.clock,
    ...overrides,
  })
  return { dir, root, show, state, library }
}

test('the list has shows with episodes, sizes, the total and free space', async (t) => {
  const { library, show, root } = setup(t)
  await library.load()
  const list = await library.list()
  const byName = Object.fromEntries(list.shows.map(s => [s.name, s]))
  assert.deepEqual(Object.keys(byName).sort(), ['Movie.mp4', 'Show'])
  assert.equal(byName.Show.path, show)
  assert.equal(byName.Show.episodes, 3)
  assert.ok(byName.Show.size >= 600)
  assert.equal(byName['Movie.mp4'].kind, 'file')
  assert.equal(list.total, byName.Show.size + 50)
  assert.ok(list.free > 0)
  assert.deepEqual((await library.episodes(show)).map(e => e.title), ['01 第1集', '02 第2集', '03 第3集'])
  await assert.rejects(library.episodes(join(root, '..')), { code: 'not_found' })
})

test('deleting: blocked while a room plays the show; an episode leaves the checksum list', async (t) => {
  const { library, show, state } = setup(t)
  await library.load()
  state.used.add(show)
  await assert.rejects(library.remove(show), { code: 'in_use' })
  await assert.rejects(library.removeEpisode(show, '02 第2集.mp4'), { code: 'in_use' })
  state.used.clear()
  await library.removeEpisode(show, '02 第2集.mp4')
  assert.equal(existsSync(join(show, '02 第2集.mp4')), false)
  assert.doesNotMatch(readFileSync(join(show, 'SHA256SUMS.txt'), 'utf8'), /第2集/)
  await assert.rejects(library.removeEpisode(show, '../Movie.mp4'), { code: 'invalid' })
  await library.remove(show)
  assert.equal(existsSync(show), false)
})

test('renaming moves the show and its notes; names stay inside the library', async (t) => {
  const { library, show, root } = setup(t)
  await library.load()
  await library.keep(show)
  const { path } = await library.rename(show, '  New name ')
  assert.equal(path, join(root, 'New name'))
  assert.equal((await library.list()).shows.find(s => s.name === 'New name').keep, true)
  await assert.rejects(library.rename(path, '../x'), { code: 'invalid' })
  assert.equal(existsSync(join(root, '..', 'x')), false)
  await assert.rejects(library.rename(path, 'Movie.mp4'), { code: 'exists' })
  assert.equal((await library.rename(join(root, 'Movie.mp4'), 'Film')).path, join(root, 'Film.mp4'))
})

test('watched to the end: the last episode, or all of them; deleted 7 days later unless kept or in use', async (t) => {
  const records = []
  const { library, show, state } = setup(t, { record: (type, fields) => records.push([type, fields.by ?? null]) })
  await library.load()
  const entry = async () => (await library.list()).shows.find(s => s.name === 'Show')
  assert.equal((await entry()).lastWatchedAt, null)
  await library.noteProgress(join(show, '01 第1集.mp4'), 30, 60)
  assert.equal((await entry()).watchedAt, null)
  assert.equal((await entry()).lastWatchedAt, state.clock)
  await library.noteProgress(join(show, '03 第3集.mp4'), 59, 60)
  const watched = await entry()
  assert.equal(watched.watchedAt, state.clock)
  assert.equal(watched.deletesAt, state.clock + 7 * DAY)

  // Keeping cancels the countdown; watching again doesn't bring it back, only an explicit start or a new finish.
  await library.keep(show, { by: 'Carol' })
  assert.equal((await entry()).deletesAt, null)
  state.clock += 2 * DAY
  await library.noteProgress(join(show, '02 第2集.mp4'), 40, 60)
  assert.equal((await entry()).deletesAt, null)
  await library.countdown(show, { by: 'Dana' })
  assert.equal((await entry()).deletesAt, state.clock + 7 * DAY)
  state.clock += 3 * DAY
  await library.countdown(show, { by: 'Dana' })
  assert.equal((await entry()).deletesAt, state.clock + 7 * DAY)
  state.clock += 1 * DAY
  await library.noteProgress(join(show, '03 第3集.mp4'), 59, 60)
  assert.equal((await entry()).deletesAt, state.clock + 7 * DAY, 'a new finish restarts the countdown')
  assert.deepEqual(records.map(r => r[0]), ['library.countdownStarted', 'library.kept', 'library.countdownStarted', 'library.countdownRestarted', 'library.countdownStarted'])
  assert.deepEqual(records.slice(1, 4).map(r => r[1]), ['Carol', 'Dana', 'Dana'])

  state.clock += 7 * DAY
  state.used.add(show)
  await library.sweep()
  assert.equal(existsSync(show), true)
  state.used.clear()
  await library.sweep()
  assert.equal(existsSync(show), false)
})

test('a show still downloading is not watched until its last episode is there', async (t) => {
  const { library, show } = setup(t)
  await library.load()
  await library.adopt(show, { source: 'stub', id: '1', kind: 'drama', episodes: 10 })
  for (const n of [1, 2, 3]) await library.noteFinished(join(show, `0${n} 第${n}集.mp4`))
  const entry = (await library.list()).shows.find(s => s.name === 'Show')
  assert.equal(entry.watchedAt, null)
  assert.equal(entry.finished, 3)
  assert.equal(entry.total, 10)
})

test('continuing: the episode they stopped in, or the next one when they reached its end', async (t) => {
  const { library, show } = setup(t)
  await library.load()
  assert.equal(await library.resumeFrom(show), null)
  await library.noteProgress(join(show, '02 第2集.mp4'), 42, 600)
  assert.deepEqual(await library.resumeFrom(show), { index: 1, position: 42, title: '02 第2集' })
  await library.noteProgress(join(show, '02 第2集.mp4'), 590, 600)
  assert.deepEqual(await library.resumeFrom(show), { index: 2, position: 0, title: '03 第3集' })
})
