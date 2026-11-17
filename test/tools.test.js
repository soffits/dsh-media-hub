import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTool } from '../tools.js'

function fakeService() {
  const calls = []
  return {
    calls,
    listRooms: () => [{ id: 'r1' }],
    closeRoom: id => ({ closed: id }),
    createRoom: async (input) => {
      calls.push(input)
      if (input.source === 'local' && input.path === '/nope') throw Object.assign(new Error('/nope does not exist'), { code: 'not_found' })
      return { room: { id: 'r1' } }
    },
    waitReady: async () => { calls.push('wait') },
    room: () => ({ id: 'r1', title: 'Show', index: 0, link: 'https://dsh.example.com/?media-room=r1', items: [{ title: '01', status: 'ready', error: null }, { title: '02', status: 'preparing', error: null }] }),
    fetch: async (input) => {
      calls.push(input)
      return { title: 'Drama', path: '/lib/Drama', room: { id: 'r1' } }
    },
    logFile: '/state/watch-log.jsonl',
    history: async () => [{ title: 'Drama', show: '/lib/Drama', with: ['Dana', 'Carol'], from: '2026-11-16T01:00:00.000Z', to: '2026-11-16T02:00:00.000Z', episodesFinished: [1, 2, 3, 5], stoppedAt: { Carol: { episode: 6, position: 72, finished: false } } }],
  }
}

test('start opens a room, waits for the first local episode and returns the link', async () => {
  const service = fakeService()
  const tool = createTool({ getService: () => service, agentName: 'Helper' })
  const result = await tool.execute({ action: 'start', source: 'local', path: '/videos/Show' })
  assert.deepEqual(service.calls, [{ source: 'local', path: '/videos/Show', urls: undefined, title: undefined, by: 'Helper' }, 'wait'])
  assert.equal(result.link, 'https://dsh.example.com/?media-room=r1')
  assert.equal(result.episodes, 2)
  assert.equal(result.firstEpisode, 'ready')
})

test('errors come back as results; a missing service says it is starting', async () => {
  const tool = createTool({ getService: () => fakeService() })
  assert.deepEqual(await tool.execute({ action: 'start', source: 'local', path: '/nope' }), { ok: false, error: { code: 'not_found', message: '/nope does not exist' } })
  assert.equal((await tool.execute({ action: 'close' })).error.code, 'invalid_arguments')
  assert.equal((await createTool({ getService: () => undefined }).execute({ action: 'list' })).error.code, 'unavailable')
  assert.deepEqual(await tool.execute({ action: 'list' }), { ok: true, rooms: [{ id: 'r1' }] })
})

test('start from a source opens the room at once, rolling by default and the whole show offline on request', async () => {
  const service = fakeService()
  const tool = createTool({ getService: () => service, agentName: 'Helper', waitSeconds: 5 })
  const result = await tool.execute({ action: 'start', source: 'stub', id: '7600000000000000001' })
  assert.deepEqual(service.calls[0], { source: 'stub', id: '7600000000000000001', watch: true, all: false, by: 'Helper' })
  assert.equal(result.link, 'https://dsh.example.com/?media-room=r1')
  await tool.execute({ action: 'start', source: 'stub', id: '7600000000000000001', offline: true })
  assert.equal(service.calls.find(call => call.all === true)?.id, '7600000000000000001')
  assert.equal((await tool.execute({ action: 'start', source: 'stub' })).error.code, 'invalid_arguments')
})

test('history is a compact summary with the log path', async () => {
  const tool = createTool({ getService: () => fakeService() })
  assert.deepEqual(await tool.execute({ action: 'history' }), {
    ok: true,
    log: '/state/watch-log.jsonl',
    shows: [{ title: 'Drama', with: ['Dana', 'Carol'], from: '2026-11-16T01:00:00.000Z', to: '2026-11-16T02:00:00.000Z', finished: '1-3, 5', stopped: { Carol: 'ep 6 at 1:12' } }],
  })
})
