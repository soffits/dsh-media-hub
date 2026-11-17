import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sortModes, sortResults, updatedAt } from '../web/sort.js'

const a = { id: 'a', popularity: { count: 100 }, meta: [{ key: 'updated', value: '2026-11-01' }] }
const b = { id: 'b', popularity: { count: 900 }, meta: [{ key: 'updated', value: '2026.11.10' }] }
const c = { id: 'c', popularity: null, meta: [] }
const d = { id: 'd', popularity: { count: 900 }, meta: [] }

test('results sort by plays or by when they were updated; the source order is the default and breaks ties', () => {
  assert.deepEqual(sortResults([a, b, c], 'default').map(r => r.id), ['a', 'b', 'c'])
  assert.deepEqual(sortResults([a, b, c], 'plays').map(r => r.id), ['b', 'a', 'c'])
  assert.deepEqual(sortResults([c, a, b], 'newest').map(r => r.id), ['b', 'a', 'c'])
  assert.deepEqual(sortResults([d, b], 'plays').map(r => r.id), ['d', 'b'], 'a tie keeps the source order')
  assert.deepEqual(sortResults([a, b], 'nonsense').map(r => r.id), ['a', 'b'])
})

test('an order is offered only when at least two results can be told apart by it', () => {
  assert.deepEqual(sortModes([a, b, c]), ['default', 'plays', 'newest'])
  assert.deepEqual(sortModes([a, c]), ['default'])
  assert.deepEqual(sortModes([c, d, b]), ['default', 'plays'])
  assert.equal(updatedAt({ meta: [{ key: 'updated', value: 'yesterday' }] }), null)
})
