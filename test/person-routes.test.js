import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPersonRoutes } from '../src/person-routes.js'

/** The routes over a stand-in hub, as DSH's Fetch layer calls them, with `who` signed in (or nobody). */
function routes(hub, who = null) {
  const list = createPersonRoutes({ hub: () => hub, identity: () => ({ current: () => who }) })
  return async (method, path, body) => {
    const route = list.find(entry => new URL(path, 'http://dsh.invalid').pathname === entry.path && entry.methods.includes(method))
    const response = await route.fetch(new Request(new URL(path, 'http://dsh.invalid'), { method, ...(body === undefined ? {} : { body }) }))
    return { status: response.status, body: await response.json() }
  }
}

test('looking up, fetching and opening a room act for the person signed in', async () => {
  const calls = []
  const hub = {
    info: async (source, id, asking) => { calls.push(['info', source, id, asking]); return { id } },
    fetch: async (input) => { calls.push(['fetch', input]); return { path: '/library/x' } },
    createRoom: async (input) => {
      if (input.path === '/bad') throw Object.assign(new Error('nope'), { code: 'invalid' })
      calls.push(['room', input])
      return { room: { id: 'new' } }
    },
  }
  const ask = routes(hub, { issuer: 'https://id.example', id: 'sub-1', name: 'Ann' })
  assert.deepEqual((await ask('GET', '/api/media-hub/info?source=link&id=https%3A%2F%2Fv.example%2F1&language=fr')).body, { id: 'https://v.example/1' })
  await ask('POST', '/api/media-hub/fetch', JSON.stringify({ source: 'link', id: 'u', watch: true, quality: '720', language: 'fr', by: 'Ann', person: 'someone-else' }))
  assert.deepEqual((await ask('POST', '/api/media-hub/rooms', JSON.stringify({ path: '/videos/Show', fromPanel: false }))).body, { room: { id: 'new' } })
  assert.deepEqual(calls, [
    ['info', 'link', 'https://v.example/1', { person: 'sub-1', language: 'fr' }],
    ['fetch', { source: 'link', id: 'u', watch: true, quality: '720', by: 'Ann', language: 'fr', person: 'sub-1' }],
    ['room', { path: '/videos/Show', fromPanel: true, person: 'sub-1' }],
  ], 'the person is who signed in, never what the body says')
  assert.equal((await ask('POST', '/api/media-hub/rooms', JSON.stringify({ path: '/bad' }))).status, 400)
  assert.equal((await ask('POST', '/api/media-hub/rooms', '{')).status, 400)
})

test('nobody signed in is nobody in particular, and a failed site keeps its reason under a status proxies pass on', async () => {
  const hub = { info: async (source, id, asking) => { throw Object.assign(new Error('the site wants a signed-in account'), { code: 'source_failed', reason: 'sign_in', asking }) } }
  const answer = await routes(hub)('GET', '/api/media-hub/info?source=link&id=u')
  assert.equal(answer.status, 424)
  assert.deepEqual(answer.body, { error: { code: 'source_failed', reason: 'sign_in', message: 'the site wants a signed-in account' } })
  assert.equal((await routes(undefined)('GET', '/api/media-hub/info?source=link&id=u')).status, 503)
})

test('an extra the person has no ticket for answers 402 with the item and purchase, for the points plugin to offer', async () => {
  const need = { item: 'media:new_series', source: 'media:series:link:u' }
  const hub = { fetch: async () => { throw Object.assign(new Error('media:new_series needs a ticket'), { code: 'points', status: 402, points: need }) } }
  const answer = await routes(hub, { id: 'sub-1' })('POST', '/api/media-hub/fetch', JSON.stringify({ source: 'link', id: 'u' }))
  assert.equal(answer.status, 402)
  assert.deepEqual(answer.body.error.points, need)
})
