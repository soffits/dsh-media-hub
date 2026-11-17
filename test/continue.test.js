import assert from 'node:assert/strict'
import { test } from 'node:test'
import { continueWatching } from '../web/continue.js'

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
