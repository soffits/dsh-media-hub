import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clearNav, hasNavParams, pickKind, pickSource, readMemory, readNav, remember, takesUrl, withAll, writeNav } from '../web/nav.js'

const fanqie = { id: 'fanqie', label: 'Fanqie', kinds: [{ id: 'drama', label: 'Short dramas' }, { id: 'audio', label: 'Audiobooks' }] }
const other = { id: 'tube', label: 'Tube', kinds: [{ id: 'video', label: 'Videos' }] }
const link = { id: 'link', label: 'Link', input: 'url', kinds: [{ id: 'video', label: '' }] }

function storage() {
  const items = new Map()
  return { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) }
}

test('the tab defaults to Watching and an unknown tab falls back to it', () => {
  assert.deepEqual(readNav(''), { tab: 'watching', source: null, kind: null, work: null })
  assert.equal(readNav('?vs-tab=nonsense').tab, 'watching')
  assert.deepEqual(readNav('?vs-tab=discover&vs-source=fanqie&vs-kind=audio&vs-work=77'), { tab: 'discover', source: 'fanqie', kind: 'audio', work: '77' })
})

test('writing keeps other parameters, leaves out the default tab, and only Discover carries source and category', () => {
  assert.equal(writeNav('?other=1&vs-tab=library', { tab: 'watching', source: 'fanqie', kind: 'drama' }), '?other=1')
  assert.equal(writeNav('', { tab: 'library', source: 'fanqie', kind: 'drama' }), '?vs-tab=library')
  assert.equal(writeNav('?x=1', { tab: 'discover', source: 'fanqie', kind: 'audio' }), '?x=1&vs-tab=discover&vs-source=fanqie&vs-kind=audio')
  assert.equal(writeNav('', { tab: 'discover', source: 'link', kind: null }), '?vs-tab=discover&vs-source=link')
  assert.equal(writeNav('', { tab: 'watching', source: null, kind: null }), '')
  assert.equal(writeNav('', { tab: 'discover', source: 'fanqie', kind: 'drama', work: '77' }), '?vs-tab=discover&vs-source=fanqie&vs-kind=drama&vs-work=77')
  assert.equal(writeNav('', { tab: 'library', source: 'fanqie', kind: 'drama', work: '77' }), '?vs-tab=library', 'a work belongs to Discover')
  assert.equal(writeNav('', { tab: 'discover', source: null, kind: null, work: '77' }), '?vs-tab=discover', 'a work needs its source')
})

test('writing then reading gives the place back; leaving the page clears only its own parameters, the room link', () => {
  const nav = { tab: 'discover', source: 'fanqie', kind: 'audio', work: '77' }
  assert.deepEqual(readNav(writeNav('?media-room=abc', nav)), nav)
  assert.equal(clearNav('?media-room=abc&vs-tab=library&vs-source=a'), '?media-room=abc')
  assert.equal(hasNavParams('?media-room=abc'), false)
  assert.equal(hasNavParams('?media-room=abc&vs-kind=audio'), true)
})

test('All sources leads with the categories of the searchable sources; Link takes an address and is not searched', () => {
  const sources = withAll([fanqie, other, link], 'All')
  assert.deepEqual(sources.map(s => s.id), ['all', 'fanqie', 'tube', 'link'])
  assert.deepEqual(sources[0].kinds.map(k => k.id), ['drama', 'audio', 'video'])
  assert.deepEqual(withAll([fanqie, link], 'All').map(s => s.id), ['fanqie', 'link'], 'one searchable source needs no All')
  assert.ok(takesUrl(link) && !takesUrl(fanqie))
})

test('the source: the URL first, then the one used last, then the first; a source that is gone is skipped', () => {
  const sources = [fanqie, other, link]
  assert.equal(pickSource(sources, 'tube', 'fanqie').id, 'tube')
  assert.equal(pickSource(sources, null, 'tube').id, 'tube')
  assert.equal(pickSource(sources, 'gone', 'also-gone').id, 'fanqie')
  assert.equal(pickSource([], null, null), null)
})

test('the category: the URL first, then the one used last for that source, then its first; Link has none', () => {
  assert.equal(pickKind(fanqie, 'audio', 'drama'), 'audio')
  assert.equal(pickKind(fanqie, null, 'audio'), 'audio')
  assert.equal(pickKind(fanqie, 'nope', 'nope'), 'drama')
  assert.equal(pickKind(link, 'video', 'video'), null)
  assert.equal(pickKind(null, null, null), null)
})

test('the last source and category are remembered per browser, a category per source', () => {
  const store = storage()
  assert.deepEqual(readMemory(store), { source: null, kinds: {} })
  remember(store, { source: 'fanqie', kind: 'audio' })
  remember(store, { source: 'tube', kind: 'video' })
  remember(store, { source: 'link', kind: null })
  assert.deepEqual(readMemory(store), { source: 'link', kinds: { fanqie: 'audio', tube: 'video' } })
})

test('memory survives broken storage', () => {
  const broken = { getItem: () => '{not json', setItem: () => { throw new Error('full') } }
  assert.deepEqual(readMemory(broken), { source: null, kinds: {} })
  assert.doesNotThrow(() => remember(broken, { source: 'fanqie', kind: 'drama' }))
  assert.deepEqual(readMemory(null), { source: null, kinds: {} })
})

test('All sources comes first with every category once, only when there are several sources', () => {
  const a = { id: 'a', label: 'A', kinds: [{ id: 'drama', label: 'Dramas', media: 'video' }, { id: 'novel', label: 'Novels', media: 'book' }] }
  const b = { id: 'b', label: 'B', kinds: [{ id: 'ebook', label: 'Ebooks', media: 'book' }, { id: 'novel', label: 'Other novels', media: 'book' }] }
  const [all, ...rest] = withAll([a, b], 'All')
  assert.deepEqual([all.id, all.kinds.map(kind => kind.label)], ['all', ['Dramas', 'Novels', 'Ebooks']])
  assert.deepEqual(rest, [a, b])
  assert.deepEqual(withAll([a], 'All'), [a])
})
