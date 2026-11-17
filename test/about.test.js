import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nextSeason } from '../web/about-view.js'

const related = [
  { id: '1', title: '假千金', relation: 'season' },
  { id: '2', title: '假千金第二季', relation: 'season' },
  { id: '3', title: '假千金第二季的另一个改编', relation: 'related' },
]

test('the next season is a related season whose title extends this work\'s', () => {
  assert.equal(nextSeason({ title: '假千金', related })?.id, '2')
  assert.equal(nextSeason({ title: '假千金第二季', related: [related[0], related[1]] }), null, 'the first season is not next to the second')
  assert.equal(nextSeason({ title: '假千金', related: [related[2]] }), null, 'only a related season counts')
  assert.equal(nextSeason(null), null)
})
