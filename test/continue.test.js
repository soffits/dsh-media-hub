import assert from 'node:assert/strict'
import { test } from 'node:test'
import { STRIP_MAX, continueSubject, continueWatching, currentEpisode, episodeStrip, stripCounts } from '../web/continue.js'

const show = (name, fields = {}) => ({ name, episodes: 3, sourced: false, watchedAt: null, inUse: false, resume: null, finished: 0, lastWatchedAt: null, ...fields })

test('lists started shows only: a resume point or a finished episode, not finished, not in a room', () => {
  const shows = [
    show('untouched'),
    show('resumed', { resume: { index: 1, position: 40 } }),
    show('one episode done', { finished: 1 }),
    show('all watched', { finished: 3, watchedAt: 1 }),
    show('in a room', { resume: { index: 0, position: 9 }, inUse: true }),
    show('nothing on disk', { episodes: 0, resume: { index: 0, position: 9 } }),
    show('rolling, nothing cached yet', { episodes: 0, sourced: true, finished: 2 }),
  ]
  assert.deepEqual(continueWatching(shows).map(s => s.name), ['resumed', 'one episode done', 'rolling, nothing cached yet'])
})

test('newest watched first; shows without a time keep the library order after the timed ones', () => {
  const shows = [
    show('a', { finished: 1 }),
    show('b', { finished: 1, lastWatchedAt: 100 }),
    show('c', { finished: 1 }),
    show('d', { finished: 1, lastWatchedAt: 300 }),
  ]
  assert.deepEqual(continueWatching(shows).map(s => s.name), ['d', 'b', 'a', 'c'])
})

test('the Continue card is about a room someone is in now, else the show watched last with its shared room', () => {
  const shows = [
    { path: '/a', name: 'a', episodes: 3, resume: { index: 1 }, finished: 1, lastWatchedAt: 1 },
    { path: '/b', name: 'b', episodes: 3, resume: { index: 0 }, finished: 0, lastWatchedAt: 5, inUse: true },
  ]
  const empty = { id: 'r1', show: '/b', members: [], index: 0 }
  const busy = { id: 'r2', show: '/a', members: ['Ana'], index: 2 }
  assert.deepEqual(continueSubject([empty, busy], shows), { room: busy, show: shows[0] })
  assert.deepEqual(continueSubject([empty], shows), { room: empty, show: shows[1] })
  assert.deepEqual(continueSubject([], shows), { room: null, show: shows[1] })
  assert.equal(continueSubject([], []), null)
  assert.equal(currentEpisode({ room: busy, show: shows[0] }), 3)
  assert.equal(currentEpisode({ room: null, show: shows[0] }), 2)
  assert.equal(currentEpisode({ room: null, show: { episodes: 4, finished: 4 } }), 4)
})

test('the strip shows a few watched episodes before the current one, then what is on disk and what is not', () => {
  const episodes = Array.from({ length: 40 }, (_, i) => ({ n: i + 1, cached: i >= 5 && i <= 11, watch: i < 6 ? { finished: true } : null }))
  const strip = episodeStrip(episodes, 7)
  assert.equal(strip.length, STRIP_MAX)
  assert.deepEqual(strip.slice(0, 9).map(item => item.state), ['done', 'done', 'done', 'done', 'done', 'done', 'current', 'ready', 'ready'])
  assert.equal(strip.at(-1).state, 'todo')
  assert.deepEqual(stripCounts(episodes, 7), { watched: 6, ahead: 5 })
  // Near the end the window stays full; a short show shows every episode.
  assert.equal(episodeStrip(episodes, 40).at(-1).n, 40)
  assert.equal(episodeStrip(episodes, 40).length, STRIP_MAX)
  assert.equal(episodeStrip(episodes.slice(0, 3), 2).length, 3)
})
