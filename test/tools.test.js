import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTool, historyView } from '../tools.js'

function fakeService() {
  const calls = []
  return {
    calls,
    listRooms: () => [{ id: 'r1' }],
    closeRoom: id => ({ closed: id }),
    createRoom: async (input) => {
      calls.push(input)
      if (input.path === '/nope') throw Object.assign(new Error('/nope does not exist'), { code: 'not_found' })
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
  assert.deepEqual(service.calls, [{ path: '/videos/Show', title: undefined, by: 'Helper', together: true }, 'wait'])
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
  assert.deepEqual(service.calls[0], { source: 'stub', id: '7600000000000000001', watch: true, together: true, all: false, quality: '', by: 'Helper' })
  assert.equal(result.link, 'https://dsh.example.com/?media-room=r1')
  await tool.execute({ action: 'start', source: 'stub', id: '7600000000000000001', offline: true })
  assert.equal(service.calls.find(call => call.all === true)?.id, '7600000000000000001')
  assert.equal((await tool.execute({ action: 'start', source: 'stub' })).error.code, 'invalid_arguments')
})

test('start from a link takes its address as the work and passes the quality', async () => {
  const service = fakeService()
  const tool = createTool({ getService: () => service, agentName: 'Helper' })
  await tool.execute({ action: 'start', source: 'link', url: 'https://video.example/watch/1', quality: '720' })
  assert.deepEqual(service.calls, [{ source: 'link', id: 'https://video.example/watch/1', watch: true, together: true, all: false, quality: '720', by: 'Helper' }, 'wait'])
  assert.match((await tool.execute({ action: 'start', source: 'link', id: 'x' })).error.message, /needs url/)
})

test('history is a compact summary with the log path', async () => {
  const tool = createTool({ getService: () => fakeService() })
  assert.deepEqual(await tool.execute({ action: 'history' }), {
    ok: true,
    log: '/state/watch-log.jsonl',
    shows: [{ title: 'Drama', with: ['Dana', 'Carol'], from: '2026-11-16T01:00:00.000Z', to: '2026-11-16T02:00:00.000Z', finished: '1-3, 5', stopped: { Carol: 'ep 6 at 1:12' } }],
  })
})

test('the history speaks of a single video without episodes', () => {
  const base = { title: 'A talk', with: ['Ana'], from: '2026-11-16T01:00:00.000Z', to: '2026-11-16T02:00:00.000Z', episodes: 1 }
  assert.deepEqual(historyView({ ...base, episodesFinished: [], stoppedAt: { Ana: { episode: 1, position: 754, finished: false } } }).stopped, { Ana: 'at 12:34' })
  const done = historyView({ ...base, episodesFinished: [1], stoppedAt: { Ana: { episode: 1, position: 900, finished: true } } })
  assert.equal(done.finished, 'yes')
  assert.deepEqual(done.stopped, { Ana: 'finished' })
  assert.deepEqual(historyView({ ...base, episodes: 9, episodesFinished: [1, 2], stoppedAt: { Ana: { episode: 3, position: 60, finished: false } } }).stopped, { Ana: 'ep 3 at 1:00' })
})

test('shelf lists a named person\'s books, and adds one first when given source, id and format', async () => {
  const calls = []
  const entries = [{ entry: 'e1', title: 'Book', author: 'A', format: 'epub', source: 'lib', id: 'w1', state: 'ready', error: null, bytes: 10, converted: false }]
  const books = {
    shelfOf: (name) => {
      calls.push(['shelfOf', name])
      if (name === 'nobody') throw Object.assign(new Error('no shelf known for nobody'), { code: 'not_found' })
      return 'key-ann'
    },
    add: async (key, input) => { calls.push(['add', key, input]); return { title: 'Book 2', format: 'pdf', state: 'fetching' } },
    list: async (key) => { calls.push(['list', key]); return { entries, usedBytes: 10 } },
  }
  const tool = createTool({ getService: () => ({ books }), agentName: 'Helper' })
  assert.deepEqual(await tool.execute({ action: 'shelf', person: 'Ann' }), { ok: true, person: 'Ann', used: 10, books: [{ title: 'Book', author: 'A', format: 'epub', source: 'lib', id: 'w1', state: 'ready', bytes: 10 }] })
  const added = await tool.execute({ action: 'shelf', person: 'Ann', source: 'lib', id: 'w2', format: 'PDF', title: 'Book 2' })
  assert.deepEqual(added.added, { title: 'Book 2', format: 'pdf', state: 'fetching' })
  assert.deepEqual(calls.find(call => call[0] === 'add'), ['add', 'key-ann', { source: 'lib', id: 'w2', format: 'pdf', title: 'Book 2', by: 'Helper' }])
  assert.equal((await tool.execute({ action: 'shelf', person: 'Ann', id: 'w2' })).error.code, 'invalid_arguments')
  assert.equal((await tool.execute({ action: 'shelf', person: 'nobody' })).error.code, 'not_found')
})
