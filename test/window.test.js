import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nextRun, pickEvictions, planCache, windowOf } from '../src/window.js'

const size = { ahead: 5, behind: 1 }
const set = (...numbers) => new Set(numbers)
const plan = (input) => planCache({ total: 40, focuses: [1], cached: set(), finished: set(), ...size, ...input })

test('the window is one behind to five ahead, clamped to the show', () => {
  assert.deepEqual(windowOf(10, 40, size), { first: 9, last: 15 })
  assert.deepEqual(windowOf(1, 40, size), { first: 1, last: 6 })
  assert.deepEqual(windowOf(39, 40, size), { first: 38, last: 40 })
  assert.deepEqual(windowOf(10, 40, { ahead: 10, behind: 0 }), { first: 10, last: 20 })
})

test('a fresh show fetches the current episode first, then the next five in order', () => {
  assert.deepEqual(plan({}).want, [1, 2, 3, 4, 5, 6])
  assert.deepEqual(plan({ focuses: [12] }).want, [12, 13, 14, 15, 16, 17])
  assert.deepEqual(plan({ focuses: [38] }).want, [38, 39, 40])
})

test('what is cached is not fetched again; the window refills as it moves', () => {
  assert.deepEqual(plan({ focuses: [3], cached: set(1, 2, 3, 4, 5, 6) }).want, [7, 8])
  assert.deepEqual(plan({ focuses: [3], cached: set(1, 2, 3, 4, 5, 6) }).trim, [])
})

test('watched episodes more than one behind are trimmed; unwatched ones and the one just behind stay', () => {
  const result = plan({ focuses: [5], cached: set(1, 2, 3, 4, 5, 6, 7, 8, 9, 10), finished: set(1, 2, 3, 4) })
  assert.deepEqual(result.trim, [1, 2, 3])
  assert.ok(result.protect.has(4) && result.protect.has(10) && !result.protect.has(3))
  // Skipped, never watched: left alone, the cap deals with them later.
  assert.deepEqual(plan({ focuses: [20], cached: set(1, 2), finished: set() }).trim, [])
})

test('a jump to an uncached episode fetches it first, before refilling around it', () => {
  const result = plan({ focuses: [25], cached: set(1, 2, 3, 4, 5, 6), finished: set(1, 2) })
  assert.deepEqual(result.want, [25, 26, 27, 28, 29, 30])
  assert.deepEqual(result.trim, [1, 2])
})

test('two rooms on one show: both windows count, the first focus is fetched first', () => {
  const result = plan({ focuses: [3, 20], cached: set(1, 2, 3, 4, 5, 6, 7, 8), finished: set(1, 2, 3, 4, 5) })
  assert.deepEqual(result.want, [20, 21, 22, 23, 24, 25])
  assert.deepEqual(result.trim, [1])
  assert.ok(result.protect.has(2) && result.protect.has(19) && result.protect.has(25))
})

test('hand-deleted episodes are not fetched again unless someone goes to them', () => {
  assert.deepEqual(plan({ focuses: [1], skip: set(3) }).want, [1, 2, 4, 5, 6])
  assert.deepEqual(plan({ focuses: [3], skip: set(3) }).want, [3, 4, 5, 6, 7, 8])
})

test('a pinned show fetches everything, from the focus on and then the start, and trims nothing', () => {
  const result = plan({ total: 8, focuses: [5], pinned: true, cached: set(1, 5), finished: set(1, 2, 3, 4) })
  assert.deepEqual(result.want, [6, 7, 8, 2, 3, 4])
  assert.deepEqual(result.trim, [])
  assert.deepEqual(plan({ total: 4, focuses: [], pinned: true }).want, [1, 2, 3, 4])
})

test('with nobody watching and nothing to continue, nothing is fetched', () => {
  assert.deepEqual(plan({ focuses: [] }).want, [])
})

test('over the cap, the least recently watched go first and a protected episode never goes', () => {
  const entry = (key, bytes, lastAt, isProtected = false) => ({ key, bytes, lastAt, protected: isProtected })
  const entries = [entry('a', 100, 5), entry('b', 100, 1), entry('c', 100, 3), entry('d', 100, 0, true)]
  assert.deepEqual(pickEvictions(entries, 1000), [])
  assert.deepEqual(pickEvictions(entries, 0), [])
  assert.deepEqual(pickEvictions(entries, 250), ['b', 'c'])
  assert.deepEqual(pickEvictions(entries, 50), ['b', 'c', 'a'])
})

test('the next run is the first missing episode and the ones directly after it', () => {
  assert.deepEqual(nextRun([5, 6, 7, 9], set(5)), [6, 7])
  assert.deepEqual(nextRun([9, 10, 4], set()), [9, 10])
  assert.equal(nextRun([1, 2], set(1, 2)), null)
})
