import assert from 'node:assert/strict'
import { test } from 'node:test'
import { playsHlsNatively } from '../web/hls-engine.js'

const maybe = { canPlayType: () => 'maybe' }
const never = { canPlayType: () => '' }

test('Chromium says maybe to HLS but fails a growing playlist, so it gets hls.js', () => {
  assert.equal(playsHlsNatively(maybe, { webkit: false, mse: true }), false)
})

test('WebKit plays HLS itself, also where it has Media Source', () => {
  assert.equal(playsHlsNatively(maybe, { webkit: true, mse: true }), true)
  assert.equal(playsHlsNatively(maybe, { webkit: true, mse: false }), true)
})

test('a browser with no Media Source but native HLS uses it, and one with neither plays nothing natively', () => {
  assert.equal(playsHlsNatively(maybe, { webkit: false, mse: false }), true)
  assert.equal(playsHlsNatively(never, { webkit: false, mse: false }), false)
  assert.equal(playsHlsNatively(never, { webkit: true, mse: true }), false)
})
