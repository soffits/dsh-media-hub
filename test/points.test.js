import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EXTRAS, createExtras, inNight, nightOf } from '../src/points.js'
import { fakePoints } from './helpers.js'

const NIGHT = { from: '01:00', to: '06:00' }
const at = (hh, mm = 0, day = 18) => new Date(2026, 10, day, hh, mm)
const LOCALES = {
  en: { 'points.newSeries': 'Start a new series', 'points.newSeriesAbout': 'New to the library', 'points.bingeNight': 'Binge night', 'points.bingeNightAbout': 'Until morning' },
  fr: { 'points.newSeries': 'Commencer une nouvelle série' },
}
const extras = (points, now = at(2)) => createExtras({ points: () => points, night: NIGHT, locales: async () => LOCALES, now: () => now.getTime() })

test('the night window may run past midnight; a night belongs to the evening it started', () => {
  assert.deepEqual([at(0, 59), at(1), at(5, 59), at(6), at(23)].map(d => inNight(NIGHT, d)), [false, true, true, false, false])
  const late = { from: '23:30', to: '06:00' }
  assert.deepEqual([at(23, 29), at(23, 30), at(2), at(6)].map(d => inNight(late, d)), [false, true, true, false])
  assert.equal(nightOf(late, at(2, 0, 18)), '2026-11-17')
  assert.equal(nightOf(late, at(23, 45, 17)), '2026-11-17')
  assert.equal(nightOf(NIGHT, at(2, 0, 18)), '2026-11-18', 'a window after midnight is that day\'s night')
})

test('without the points plugin, or with one that has no ledger, nothing is ever an extra', async () => {
  assert.deepEqual(extras(undefined).wants({ isNew: true, starts: true }), [])
  assert.deepEqual(await extras(undefined).pay('sub-1', [EXTRAS.newSeries]), [])
  assert.deepEqual(extras({ ...fakePoints({}), enabled: false }).wants({ isNew: true, starts: true }), [])
})

test('each extra is asked of the points plugin with its words, price and terms; a held ticket is used once per action', async () => {
  const points = fakePoints({ ann: 100 })
  const hub = extras(points)
  const wants = hub.wants({ isNew: true, starts: true })
  assert.deepEqual(wants, [EXTRAS.newSeries, EXTRAS.bingeNight])
  await assert.rejects(hub.pay('ann', wants, { subject: 'stub:42' }), error => error.status === 402
    && error.points.item === 'media:new_series' && error.points.source === 'media:series:stub:42')
  assert.deepEqual(points.shop['media:new_series'], { key: 'media:new_series', cost: 30,
    name: { en: 'Start a new series', fr: 'Commencer une nouvelle série' }, about: { en: 'New to the library' } })
  points.buy('ann', 'media:new_series', 'media:series:stub:42')
  await assert.rejects(hub.pay('ann', wants, { subject: 'stub:42' }), error => error.points.item === 'media:binge_night' && error.points.source === 'media:binge:2026-11-18')
  assert.deepEqual([points.shop['media:binge_night'].uses, points.shop['media:binge_night'].until], [0, '06:00'])
  points.buy('ann', 'media:binge_night', 'media:binge:2026-11-18')
  const tickets = await hub.pay('ann', wants, { subject: 'stub:42' })
  await hub.use('ann', tickets, { room: 'r1', subject: 'stub:42' })
  assert.deepEqual(points.calls.filter(c => c[0] === 'use').map(c => c[3]), ['media:series:stub:42', 'media:start:r1'])
})

test('someone the points plugin does not play with owes nothing', async () => {
  const points = fakePoints({})
  assert.deepEqual(await extras(points).pay('bo', [EXTRAS.newSeries]), [])
})
