import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DRIFT, clockOffset, correction, expectedPosition, preloadDue } from '../src/sync.js'

test('expected position moves with the clock only while playing', () => {
  const base = { position: 10, rate: 1, updatedAt: 1000, duration: null }
  assert.equal(expectedPosition({ ...base, playing: false }, 5000), 10)
  assert.equal(expectedPosition({ ...base, playing: true }, 5000), 14)
  assert.equal(expectedPosition({ ...base, playing: true, rate: 1.5 }, 3000), 13)
})

test('expected position stops at the end and never goes below zero', () => {
  assert.equal(expectedPosition({ position: 58, rate: 1, updatedAt: 0, playing: true, duration: 60 }, 10_000), 60)
  assert.equal(expectedPosition({ position: 5, rate: 1, updatedAt: 1000, playing: true, duration: null }, 0), 5)
})

test('clock offset takes the sample with the shortest round trip', () => {
  // Server is 5000 ms ahead. The slow sample is skewed by an asymmetric path.
  const samples = [
    { sent: 0, received: 400, server: 5300 },
    { sent: 1000, received: 1040, server: 6020 },
    { sent: 2000, received: 2200, server: 7050 },
  ]
  assert.deepEqual(clockOffset(samples), { offset: 5000, rtt: 40 })
  assert.equal(clockOffset([]), null)
})

test('a slow, uneven 250 ms round trip still gives an offset within half of it', () => {
  const trueOffset = -123_456
  const samples = [0, 1, 2, 3].map((n) => {
    const sent = n * 1000
    const up = 100 + n * 10
    const down = 150 - n * 10
    return { sent, received: sent + up + down, server: sent + up + trueOffset }
  })
  const { offset, rtt } = clockOffset(samples)
  assert.ok(Math.abs(offset - trueOffset) <= rtt / 2)
})

test('drift under 0.3 s is ignored', () => {
  assert.equal(correction({ local: 10.2, expected: 10, rate: 1 }).action, 'none')
  assert.equal(correction({ local: 9.75, expected: 10, rate: 1 }).action, 'none')
})

test('drift of 0.3 to 2 s nudges the rate by about 5 % toward the room', () => {
  const behind = correction({ local: 9, expected: 10, rate: 1 })
  assert.equal(behind.action, 'rate')
  assert.ok(Math.abs(behind.rate - (1 + DRIFT.nudge)) < 1e-9)
  const ahead = correction({ local: 11.5, expected: 10, rate: 1.25 })
  assert.equal(ahead.action, 'rate')
  assert.ok(Math.abs(ahead.rate - 1.25 * (1 - DRIFT.nudge)) < 1e-9)
})

test('a player catching up keeps nudging until it is close, then stops', () => {
  assert.equal(correction({ local: 9.8, expected: 10, rate: 1, nudging: true }).action, 'rate')
  assert.equal(correction({ local: 9.95, expected: 10, rate: 1, nudging: true }).action, 'none')
})

test('drift over 2 s seeks to the room', () => {
  assert.deepEqual(correction({ local: 30, expected: 10, rate: 1 }), { action: 'seek', to: 10, rate: 1, drift: 20 })
  assert.equal(correction({ local: 7.9, expected: 10, rate: 1 }).action, 'seek')
})

test('the next episode preloads for a short episode at once, and for a long one in its last half minute', () => {
  assert.equal(preloadDue({ duration: 90, position: 0 }), true)
  assert.equal(preloadDue({ duration: 1500, position: 600 }), false)
  assert.equal(preloadDue({ duration: 1500, position: 1470 }), true)
  assert.equal(preloadDue({ duration: 1500, position: 1469 }), false)
  assert.equal(preloadDue({ duration: NaN, position: 0 }), false, 'nothing is known of an episode that has not loaded')
  assert.equal(preloadDue({ duration: null, position: 0 }), false)
})
