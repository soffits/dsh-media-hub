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

test('the page asks for hls.js where the Host serves it, next to the player module', async () => {
  const { readFile, access } = await import('node:fs/promises')
  const { webFile } = await import('../src/http.js')
  const source = await readFile(new URL('../web/player.js', import.meta.url), 'utf8')
  const spec = /import\(new URL\('([^']+)', import\.meta\.url\)/.exec(source)?.[1]
  assert.ok(spec, 'player.js loads hls.js relative to its own address')
  const served = new URL(spec, 'http://dsh.invalid/media-hub/web/player.js')
  assert.equal(served.pathname, '/media-hub/web/hls.mjs')
  await access(webFile(served.pathname.split('/').pop()))
})
