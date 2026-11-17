import assert from 'node:assert/strict'
import test from 'node:test'
import { createChanges } from '../src/changes.js'
import { createEventsRoute } from '../src/events-route.js'

const sleep = ms => new Promise(done => setTimeout(done, ms))

test('changes are gathered for a moment and told once, by kind, at most every interval', async () => {
  const changes = createChanges({ intervalMs: 40 })
  const heard = []
  const stop = changes.listen(what => heard.push(what))
  changes.notify('library')
  changes.notify('library')
  changes.notify('rooms')
  await sleep(80)
  assert.deepEqual(heard, [['library', 'rooms']])
  for (let n = 0; n < 5; n++) { changes.notify('library'); await sleep(5) }
  await sleep(100)
  assert.equal(heard.length, 3, 'a burst is a leading notice and one more, not one per change')
  stop()
  changes.notify('rooms')
  await sleep(80)
  assert.equal(heard.length, 3, 'nothing after stopping')
  changes.close()
})

test('the events route streams a notice per change and stops with the request', async () => {
  const changes = createChanges({ intervalMs: 10 })
  const route = createEventsRoute({ hub: () => ({ listenChanges: changes.listen }) })
  const abort = new AbortController()
  const response = await route.fetch({ signal: abort.signal })
  assert.equal(response.headers.get('content-type'), 'text/event-stream; charset=utf-8')
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  assert.match((await reader.read()).value, /: open/)
  changes.notify('shelf')
  assert.equal((await reader.read()).value, 'data: {"type":"change","what":["shelf"]}\n\n')
  abort.abort()
  assert.equal((await reader.read()).done, true)
  assert.equal((await createEventsRoute({ hub: () => undefined }).fetch({})).status, 503)
  changes.close()
})
