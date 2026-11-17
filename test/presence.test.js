import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_STEPS, parseAnnotation, parsePicks, pendingRatings, ratingLine, safeRecap } from '../src/presence.js'

const DAY = 86_400_000
const NOW = Date.parse('2026-11-17T20:00:00Z')
const iso = ms => new Date(ms).toISOString()

test('"How was it?" asks about shows finished or removed in the last two weeks, newest first, until this person answers', () => {
  const shows = [
    { path: '/lib/a', name: 'a', work: { title: 'Show A' }, watchedAt: NOW - 2 * DAY },
    { path: '/lib/b', name: 'b', watchedAt: null },
    { path: '/lib/old', name: 'old', watchedAt: NOW - 30 * DAY },
  ]
  const events = [
    { type: 'library.deleted', show: '/lib/gone', title: 'Gone', at: iso(NOW - 3600_000) },
    { type: 'library.deleted', show: '/lib/rated', title: 'Rated', at: iso(NOW - DAY) },
    { type: 'rating', show: '/lib/rated', rating: 'fine', person: 'p1', at: iso(NOW - DAY / 2) },
  ]
  const pending = pendingRatings({ shows, events, person: 'p1', now: NOW })
  assert.deepEqual(pending.map(ask => [ask.show, ask.title, ask.why]), [['/lib/gone', 'Gone', 'removed'], ['/lib/a', 'Show A', 'finished']])
  // Another person's answer doesn't answer for them.
  assert.equal(pendingRatings({ shows, events, person: 'p2', now: NOW }).length, 3)
})

test('a show removed and fetched again is not asked about as removed', () => {
  const shows = [{ path: '/lib/a', name: 'a', watchedAt: null }]
  const events = [{ type: 'library.deleted', show: '/lib/a', title: 'A', at: iso(NOW - DAY) }]
  assert.deepEqual(pendingRatings({ shows, events, person: 'p', now: NOW }), [])
})

test('a rating is one of the offered answers and carries who gave it', () => {
  const person = { key: 'k', name: 'Ana' }
  assert.deepEqual(ratingLine({ show: '/lib/a', title: 'A', rating: 'loved' }, person), { show: '/lib/a', title: 'A', rating: 'loved', person: 'k', by: 'Ana' })
  assert.throws(() => ratingLine({ show: '/lib/a', rating: 'great' }, person), { code: 'invalid_arguments' })
  assert.throws(() => ratingLine({ rating: 'fine' }, person), { code: 'invalid_arguments' })
})

test('an annotation keeps a recap with what it covers and at most three steps; null clears, a missing field stays', () => {
  assert.deepEqual(parseAnnotation({}), {})
  assert.deepEqual(parseAnnotation({ recap: null, steps: [] }), { recap: null, steps: null })
  assert.deepEqual(parseAnnotation({ recap: { text: ' So far. ', upTo: 6 } }), { recap: { text: 'So far.', upTo: 6 } })
  assert.throws(() => parseAnnotation({ recap: { text: 'x', upTo: 0 } }), { code: 'invalid_arguments' })
  assert.deepEqual(parseAnnotation({ steps: [{ label: 'Download the next 20', prompt: { en: 'Fetch episodes 8-27', zh: '下载第8到27集' } }, { id: 'ask', label: { fr: 'Demander' } }] }).steps, [
    { kind: 'step', id: 'step-1', label: 'Download the next 20', payload: { prompt: { en: 'Fetch episodes 8-27', zh: '下载第8到27集' } } },
    { kind: 'step', id: 'ask', label: { fr: 'Demander' } },
  ])
  assert.throws(() => parseAnnotation({ steps: Array.from({ length: MAX_STEPS + 1 }, () => ({ label: 'x' })) }), { code: 'invalid_arguments' })
  assert.throws(() => parseAnnotation({ steps: [{ label: '' }] }), { code: 'invalid_arguments' })
  assert.throws(() => parseAnnotation({ steps: [{ id: 'a', label: 'x' }, { id: 'a', label: 'y' }] }), { code: 'invalid_arguments' })
})

test('a recap shows only to viewers past the episodes it covers', () => {
  const recap = { text: 'So far', upTo: 6 }
  assert.equal(safeRecap(recap, 6), recap)
  assert.equal(safeRecap(recap, 5), null)
  assert.equal(safeRecap(null, 10), null)
})

test('picks keep only works of a configured source with a reason, once each', () => {
  const has = id => id === 'src'
  const picks = parsePicks({
    picks: [
      { work: { source: 'src', id: '1', title: 'One', kind: 'drama', year: 2026, score: 8.5, scoreLabel: 'Rated' }, why: 'Season 1 is on your list.' },
      { work: { source: 'src', id: '1', title: 'One again' }, why: 'dup' },
      { work: { source: 'other', id: '2', title: 'Two' }, why: 'no such source' },
      { work: { source: 'src', id: '3', title: 'Three' }, why: '' },
      { work: { source: 'src', id: '4', title: 'Four', score: 'high' }, why: 'Because.' },
    ],
  }, has)
  assert.deepEqual(picks.map(pick => [pick.work.id, pick.why]), [['1', 'Season 1 is on your list.'], ['4', 'Because.']])
  assert.equal(picks[0].work.year, 2026)
  assert.equal(picks[1].work.score, null)
  assert.throws(() => parsePicks({}, has))
})
