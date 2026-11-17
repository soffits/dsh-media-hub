import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bufferedAhead, canStart, HAVE_ENOUGH_DATA, HAVE_FUTURE_DATA, LOAD_IDLE_MS, offerTap, PRIME_AFTER_MS, READY_AHEAD_S, shouldPrime, TAP_AFTER_MS } from '../web/readiness.js'

const media = (over = {}) => ({ readyState: HAVE_FUTURE_DATA, seeking: false, at: 0, duration: 90, ranges: [], loadIdleMs: 0, ...over })

test('buffered ahead counts only the range that holds the position', () => {
  assert.equal(bufferedAhead([[0, 2], [10, 20]], 1), 1)
  assert.equal(bufferedAhead([[0, 2], [10, 20]], 12), 8)
  assert.equal(bufferedAhead([[0, 2]], 5), 0)
  assert.equal(bufferedAhead([], 0), 0)
})

test('a desktop browser still fetching is ready with a few seconds buffered', () => {
  assert.equal(canStart(media({ ranges: [[0, 1]] })), false)
  assert.equal(canStart(media({ ranges: [[0, READY_AHEAD_S]] })), true)
})

test('near the end, what is left is enough', () => {
  assert.equal(canStart(media({ at: 89, ranges: [[85, 90]] })), true)
})

test('an element that can play and stopped fetching is ready, whatever it buffered (Safari on iOS)', () => {
  assert.equal(canStart(media({ ranges: [[0, 0.4]], loadIdleMs: LOAD_IDLE_MS })), true)
  assert.equal(canStart(media({ ranges: [], loadIdleMs: LOAD_IDLE_MS - 1 })), false)
})

test('HAVE_ENOUGH_DATA is ready at once', () => {
  assert.equal(canStart(media({ readyState: HAVE_ENOUGH_DATA })), true)
})

test('nothing below HAVE_FUTURE_DATA, or while seeking, is ready', () => {
  assert.equal(canStart(media({ readyState: 2, ranges: [[0, 60]], loadIdleMs: 60_000 })), false)
  assert.equal(canStart(media({ readyState: 1, loadIdleMs: 60_000 })), false)
  assert.equal(canStart(media({ readyState: HAVE_ENOUGH_DATA, seeking: true })), false)
})

test('a held player that cannot start is primed once, after a short wait', () => {
  const held = { heldMs: PRIME_AFTER_MS, ready: false, paused: true, loadIdleMs: LOAD_IDLE_MS, primed: false }
  assert.equal(shouldPrime(held), true)
  assert.equal(shouldPrime({ ...held, heldMs: PRIME_AFTER_MS - 1 }), false)
  assert.equal(shouldPrime({ ...held, ready: true }), false)
  assert.equal(shouldPrime({ ...held, paused: false }), false)
  assert.equal(shouldPrime({ ...held, primed: true }), false)
  assert.equal(shouldPrime({ ...held, loadIdleMs: LOAD_IDLE_MS - 1 }), false, 'a slow line that still loads is left alone')
})

test('the tap button comes after the prime had its chance', () => {
  assert.ok(TAP_AFTER_MS > PRIME_AFTER_MS)
  assert.equal(offerTap({ loadingMs: TAP_AFTER_MS - 1 }), false)
  assert.equal(offerTap({ loadingMs: TAP_AFTER_MS }), true)
})
