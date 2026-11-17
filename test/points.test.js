import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { test } from 'node:test'
import { EXTRAS, createPoints, inNight, nightOf } from '../src/points.js'
import { pointsExtension, quietLogger } from './helpers.js'

const NIGHT = { from: '01:00', to: '06:00' }
const at = (hh, mm = 0, day = 18) => new Date(2026, 10, day, hh, mm)

test('the night window may run past midnight; a night belongs to the evening it started', () => {
  assert.deepEqual([at(0, 59), at(1), at(5, 59), at(6), at(23)].map(d => inNight(NIGHT, d)), [false, true, true, false, false])
  const late = { from: '23:30', to: '06:00' }
  assert.deepEqual([at(23, 29), at(23, 30), at(2), at(6)].map(d => inNight(late, d)), [false, true, true, false])
  assert.equal(nightOf(late, at(2, 0, 18)), '2026-11-17')
  assert.equal(nightOf(late, at(23, 45, 17)), '2026-11-17')
  assert.equal(nightOf(NIGHT, at(2, 0, 18)), '2026-11-18', 'a window after midnight is that day\'s night')
})

test('no extension: nothing is ever an extra', async () => {
  const points = createPoints({ command: [], night: NIGHT }, { logger: quietLogger, now: () => at(2).getTime() })
  assert.deepEqual(points.wants({ isNew: true, starts: true }), [])
  assert.deepEqual(await points.pay('sub-1', [EXTRAS.newSeries]), [])
})

test('an extra is offered with its price, bought only on yes, then used once per action', async (t) => {
  const ext = pointsExtension(t, { ann: 45 }, NIGHT)
  const points = createPoints(ext.config, { logger: quietLogger, now: () => at(2).getTime() })
  const wants = points.wants({ isNew: true, starts: true })
  assert.deepEqual(wants, [EXTRAS.newSeries, EXTRAS.bingeNight])
  await assert.rejects(points.pay('ann', wants, { subject: 'stub:42' }), (error) => {
    assert.equal(error.code, 'points')
    assert.deepEqual(error.points, { item: 'media:new_series', name: 'Start a new series', cost: 30, balance: 45, gap: 0, affordable: true, pending: false })
    return true
  })
  assert.equal(ext.state().tickets.length, 0, 'nothing is bought without a yes')
  await assert.rejects(points.pay('ann', wants, { buy: ['media:new_series'], subject: 'stub:42' }),
    error => error.points.item === 'media:binge_night' && error.points.affordable === false && error.points.gap === 25)
  const shop = ext.state().shop
  assert.deepEqual([shop['media:binge_night'].uses, shop['media:new_series'].cost], ['0', 30], 'the two items are registered with default prices')
  writeFileSync(ext.file, JSON.stringify({ ...ext.state(), players: { ann: 100 } }))
  const tickets = await points.pay('ann', wants, { buy: ['media:binge_night'], subject: 'stub:42' })
  assert.deepEqual(tickets.map(x => x.extra.key), ['media:new_series', 'media:binge_night'])
  await points.use('ann', tickets, { room: 'r1', subject: 'stub:42' })
  const calls = ext.state().calls
  assert.deepEqual(calls.filter(c => c[0] === 'buy').map(c => c.at(-1)), ['media:series:stub:42', 'media:binge:2026-11-18'])
  assert.deepEqual(calls.filter(c => c[0] === 'use').map(c => c.at(-1)), ['media:series:stub:42', 'media:start:r1'])
  assert.equal(calls.filter(c => c[0] === 'shop').length, 2, 'registered once per person while the hub runs')
})

test('someone the extension does not play with, or a failing extension, never stops anyone watching', async (t) => {
  const ext = pointsExtension(t, {}, NIGHT)
  const points = createPoints(ext.config, { logger: quietLogger, now: () => at(2).getTime() })
  assert.deepEqual(await points.pay('bo', [EXTRAS.newSeries]), [])
  assert.deepEqual(ext.state().calls.map(c => c[0]), ['shop'], 'one look, nothing written')
  writeFileSync(ext.file, JSON.stringify({ ...ext.state(), fail: true }))
  assert.deepEqual(await createPoints(ext.config, { logger: quietLogger }).pay('ann', [EXTRAS.newSeries]), [])
})
