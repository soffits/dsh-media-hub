import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createEventStreams, createNotices } from '@soffits/dsh-plugin-sdk/host'
import { apply } from '../index.js'
import { Config } from '../src/config.js'
import { createEventsRoute } from '../src/events-route.js'

const sleep = ms => new Promise(done => setTimeout(done, ms))

test('the events route streams a notice per batch of changes and stops with the request', async () => {
  const changes = createNotices({ spacingMs: 10 })
  const route = createEventsRoute({ hub: () => ({ listenChanges: changes.listen }), streams: createEventStreams() })
  const abort = new AbortController()
  const response = await route.fetch({ signal: abort.signal })
  assert.equal(response.headers.get('content-type'), 'text/event-stream; charset=utf-8')
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  assert.match((await reader.read()).value, /: open/)
  changes.notify('shelf')
  changes.notify('library')
  assert.equal((await reader.read()).value, 'data: {"type":"change","what":["shelf","library"]}\n\n')
  abort.abort()
  assert.equal((await reader.read()).done, true)
  assert.equal((await createEventsRoute({ hub: () => undefined, streams: createEventStreams() }).fetch({})).status, 503)
  changes.close()
})

test('an open events stream ends when the plugin unloads', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'media-hub-life-'))
  const disposers = []
  const routes = []
  const logger = { info() {}, warn() {}, error() {}, debug() {} }
  const ctx = {
    logger: () => logger,
    provide() {},
    get: () => undefined,
    effect(execute) { disposers.push(execute()) },
    connection: { fetch: { register: route => { routes.push(route); return async () => {} } } },
    webServer: { register: () => () => {}, registerUpgrade: () => () => {} },
  }
  try {
    apply(ctx, new Config({ stateDir: dir }))
    const events = routes.find(route => route.path === '/api/media-hub/events')
    let response
    for (let wait = 0; wait < 200; wait++) {
      response = await events.fetch({})
      if (response.status === 200) break
      await sleep(20)
    }
    assert.equal(response.status, 200, 'the hub started')
    const reader = response.body.getReader()
    await reader.read()
    for (const dispose of disposers.reverse()) await dispose()
    const next = await Promise.race([reader.read(), sleep(1000).then(() => 'still open')])
    assert.equal(next.done, true, 'the page reconnects to the next instance instead of hanging on this one')
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 5 })
  }
})
