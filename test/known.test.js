import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lookupWork } from '../web/known.js'

const library = { shows: [
  { path: '/lib/A', source: { source: 'fanqie', id: '1' }, resume: { index: 2 } },
  { path: '/lib/B', source: { source: 'other', id: '1' } },
  { path: '/lib/local', source: null },
] }
const rooms = [{ id: 'r1', show: '/lib/A' }, { id: 'r2', show: '/lib/local' }]

test('a work is found by source and id, with the room open on its show', () => {
  assert.deepEqual(lookupWork(library, rooms, 'fanqie', '1'), { show: library.shows[0], room: rooms[0] })
  assert.equal(lookupWork(library, rooms, 'other', '1').show.path, '/lib/B', 'the same id from another source is another work')
  assert.equal(lookupWork(library, rooms, 'other', '1').room, null)
})

test('an unknown work, or nothing loaded yet, is not in the library', () => {
  assert.deepEqual(lookupWork(library, rooms, 'fanqie', '2'), { show: null, room: null })
  assert.deepEqual(lookupWork(null, undefined, 'fanqie', '1'), { show: null, room: null })
})
