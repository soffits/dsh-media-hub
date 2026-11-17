import assert from 'node:assert/strict'
import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createCopies } from '../src/copies.js'
import { createDiscover } from '../src/discover.js'
import { parseTrending } from '../src/sources/command.js'

const logger = { warn() {} }
const settle = () => new Promise(resolve => setTimeout(resolve, 40))
const KINDS = [{ id: 'drama', media: 'video', trending: true }, { id: 'novel', media: 'book' }]

async function copiesAt(options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'copies-'))
  const changes = []
  const clock = { at: 1_000_000 }
  const copies = createCopies({ file: join(dir, 'discover.json'), changed: () => changes.push(clock.at), logger, now: () => clock.at, ...options })
  return { copies, changes, clock, file: join(dir, 'discover.json') }
}

test('a copy answers at once: nothing yet while the first ask runs, then the saved answer, asked again only when a day old', async () => {
  const { copies, changes, clock, file } = await copiesAt()
  let asked = 0
  const produce = async () => { asked += 1; return { n: asked } }
  const first = await copies.get('k', produce)
  assert.deepEqual([first.at, first.value, first.loading], [null, null, true])
  await settle(); await settle()
  assert.equal(changes.length, 1)
  const second = await copies.get('k', produce)
  assert.deepEqual([second.at, second.value, second.loading], [1_000_000, { n: 1 }, false])
  assert.equal(asked, 1)
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')).k.value, { n: 1 })
  clock.at += 86_400_000
  const old = await copies.get('k', produce)
  assert.deepEqual(old.value, { n: 1 }, 'the old copy stays on show while the new one is asked for')
  await settle(); await settle()
  assert.equal((await copies.get('k', produce)).value.n, 2)
})

test('one ask is shared by everyone looking meanwhile, and a failing ask is left alone for an hour with the old copy kept', async () => {
  const { copies, clock } = await copiesAt()
  let asked = 0
  let release
  const slow = () => { asked += 1; return new Promise((resolve) => { release = resolve }) }
  await Promise.all([copies.get('a', slow), copies.get('a', slow), copies.get('a', slow)])
  assert.equal(asked, 1)
  release('done')
  await settle(); await settle()
  clock.at += 86_400_000
  let fails = 0
  const failing = async () => { fails += 1; throw new Error('down') }
  await copies.get('a', failing)
  await settle(); await settle()
  const kept = await copies.get('a', failing)
  assert.equal(kept.value, 'done')
  assert.equal(fails, 1, 'not asked again inside the hour')
  clock.at += 3_600_000
  await copies.get('a', failing)
  assert.equal(fails, 2)
  const none = await copies.get('b', failing)
  await settle()
  assert.equal((await copies.get('b', failing)).failed, true)
  assert.equal(none.value, null)
})

test('copies survive a restart', async () => {
  const { copies, file } = await copiesAt()
  await copies.get('k', async () => 'kept')
  await settle(); await settle()
  const again = createCopies({ file, changed() {}, logger })
  assert.equal((await again.get('k', async () => 'new')).value, 'kept')
})

test('trending lists: several lists or one, labels as a string or per language, only works of the kind, no empty or repeated list', () => {
  const work = (id, kind = 'drama') => ({ id, title: `T${id}`, kind })
  const lists = parseTrending({ lists: [
    { id: 'hot', label: { en: 'Hot', zh: '热' }, results: [work('1'), work('2', 'novel'), { title: 'no id', kind: 'drama' }] },
    { id: 'new', label: 'New', results: [work('3')] },
    { id: 'new', label: 'Again', results: [work('4')] },
    { id: 'empty', results: [] },
  ] }, KINDS, 'drama')
  assert.deepEqual(lists.map(list => [list.id, list.label, list.results.map(result => result.id)]), [['hot', { en: 'Hot', zh: '热' }, ['1']], ['new', 'New', ['3']]])
  const single = parseTrending({ results: [work('9')] }, KINDS, 'drama')
  assert.deepEqual(single.map(list => [list.id, list.label]), [['trending', null]])
  assert.throws(() => parseTrending({}, KINDS, 'drama'))
})

function fakeHub({ recommend = true } = {}) {
  const asked = []
  const source = (id, trending) => ({
    id,
    kinds: KINDS,
    available: async () => true,
    ...(trending ? { trending: async (kind) => { asked.push(`${id}:${kind}`); return [{ id: 'hot', label: null, results: [{ id: `${id}-1`, title: 'A', kind }] }] } } : {}),
  })
  const sources = new Map([['fanqie', source('fanqie', true)], ['plain', source('plain', false)]])
  return { asked, sources, covers: { decorate: (id, work) => ({ ...work, cover: work.cover ? `/c/${id}` : null }) }, recommend }
}

test('Discover trending is the saved copy of each source that offers the kind; All merges them; a source without the verb shows nothing', async () => {
  const { copies } = await copiesAt()
  const hub = fakeHub()
  const discover = createDiscover({ copies, sources: hub.sources, covers: hub.covers, recommender: { command: [], env: {}, hasSource: () => true } })
  const first = await discover.trending('all', 'drama')
  assert.deepEqual([first.trending, first.loading], [[], true])
  await settle(); await settle()
  const second = await discover.trending('all', 'drama')
  assert.deepEqual(second.trending.map(entry => [entry.source, entry.lists[0].results[0].source]), [['fanqie', 'fanqie']])
  assert.deepEqual((await discover.trending('plain', 'drama')).trending, [])
  assert.deepEqual((await discover.trending('fanqie', 'novel')).trending, [], 'a kind that does not declare trending is not asked')
  assert.deepEqual(hub.asked, ['fanqie:drama'])
  await assert.rejects(discover.trending('nope', 'drama'), { code: 'not_found' })
})

test('Discover picks come from the recommender per source and kind, none without one configured', async () => {
  const { copies } = await copiesAt()
  const hub = fakeHub()
  const off = createDiscover({ copies, sources: hub.sources, covers: hub.covers, recommender: { command: [], env: {}, hasSource: () => true } })
  assert.deepEqual(await off.picks({ key: 'p' }, { source: 'fanqie', kind: 'drama' }), { picks: [], loading: false })
})

test('picks are asked of the recommender with the source, kind and language, kept as a copy, narrowed to the source and kind and shown at once', async () => {
  const { copies } = await copiesAt()
  const dir = await mkdtemp(join(tmpdir(), 'recommender-'))
  const script = join(dir, 'recommender.mjs')
  await writeFile(script, `#!/usr/bin/env node
const args = process.argv.slice(3)
const flag = name => (args.includes('--' + name) ? args[args.indexOf('--' + name) + 1] : undefined)
const work = (source, id, kind) => ({ source, id, title: 'W' + id, kind, episode_count: 12, cover: 'https://x/c.jpg' })
process.stdout.write(JSON.stringify({ picks: [
  { work: work(flag('source') ?? 'fanqie', '1', flag('kind') ?? 'drama'), why: 'in ' + flag('language') + ' for ' + flag('person') },
  { work: work('plain', '2', 'drama'), why: 'another source' },
  { work: work('fanqie', '3', 'novel'), why: 'another kind' },
  { work: work('gone', '4', 'drama'), why: 'not configured' },
] }))
`)
  await chmod(script, 0o755)
  const hub = fakeHub()
  const discover = createDiscover({ copies, sources: hub.sources, covers: hub.covers, recommender: { command: [process.execPath, script], env: {}, hasSource: id => hub.sources.has(id) } })
  const person = { key: 'p', id: 'sub-1' }
  const first = await discover.picks(person, { source: 'fanqie', kind: 'drama', language: 'en' })
  assert.deepEqual([first.picks, first.loading], [[], true])
  await settle(); await settle()
  const shown = await discover.picks(person, { source: 'fanqie', kind: 'drama', language: 'en' })
  assert.deepEqual(shown.picks.map(pick => [pick.work.source, pick.work.id, pick.why]), [['fanqie', '1', 'in en for sub-1']])
  assert.equal(shown.picks[0].work.episodes, 12)
  assert.equal(shown.picks[0].work.cover, '/c/fanqie')
  const unnarrowed = await discover.picks(person, { language: 'en' })
  await settle(); await settle()
  const watching = await discover.picks(person, { language: 'en' })
  assert.equal(unnarrowed.loading, true)
  assert.deepEqual(watching.picks.map(pick => pick.work.id), ['1', '2', '3'])
})
