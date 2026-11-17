import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatCount, hasEpisodes, metaLabel, popularityText, resumeLabel, stoppedText } from '../web/format.js'

const words = {
  'pop.plays': '{n}次播放',
  'pop.readers': '{n}人读过',
  'meta.cast': '演员',
}
// A page's `t` carries the viewer's language tag, as DSH's locale store names it.
const zh = Object.assign(key => words[key] ?? key, { language: 'zh' })
const en = Object.assign(key => ({ 'pop.plays': '{n} plays' }[key] ?? key), { language: 'en' })

test('counts are written the way the page language writes them, by Intl', () => {
  assert.deepEqual([0, 999, 3667, 12345, 415590, 3546984, 33740000, 130000000].map(n => formatCount(n, 'zh-CN')), ['0', '999', '3667', '1.2万', '41.6万', '354.7万', '3374万', '1.3亿'])
  assert.deepEqual([0, 999, 3667, 12345, 415590, 3546984, 33740000].map(n => formatCount(n, 'en-US')), ['0', '999', '3.7K', '12.3K', '415.6K', '3.5M', '33.7M'])
  // French puts a decimal comma and a (no-break) space before the unit; which space depends on the ICU version.
  assert.deepEqual([999, 36700, 3546984].map(n => formatCount(n, 'fr').replace(/\s/gu, ' ')), ['999', '36,7 k', '3,5 M'])
  assert.equal(formatCount(-1, 'en'), '')
  assert.equal(formatCount(Number.NaN, 'zh-CN'), '')
})

test('popularity reads as a phrase; an unknown label shows its own words', () => {
  assert.equal(popularityText(zh, { count: 366700, label: 'plays' }), '36.7万次播放')
  assert.equal(popularityText(en, { count: 366700, label: 'plays' }), '366.7K plays')
  assert.equal(popularityText(zh, { count: 12, label: 'likes', text: '12个赞' }), '12个赞')
  assert.equal(popularityText(en, { count: 1200, label: 'likes', text: '' }), '1.2K likes')
  assert.equal(popularityText(zh, null), null)
})

test('a meta row uses the panel\'s word for a key it knows, else the source\'s label', () => {
  assert.equal(metaLabel(zh, { key: 'cast', label: 'Cast', value: 'x' }), '演员')
  assert.equal(metaLabel(zh, { key: 'region', label: 'Region', value: 'x' }), 'Region')
  assert.equal(metaLabel(zh, { key: '', label: 'Anything', value: 'x' }), 'Anything')
})

test('a film, one video or a single link is spoken of without episodes; from two on, with them', () => {
  const t = key => ({
    'continue.join': 'Join {names} · episode {n}', 'continue.joinOne': 'Join {names}', 'continue.continue': 'Continue · episode {n}',
    'continue.continueAt': 'Continue at {time}', 'continue.play': 'Play',
    'library.continueFrom': 'continue from ep {n}', 'library.continueFromAt': 'continue from ep {n} at {time}', 'library.continueAt': 'continue at {time}',
  })[key]
  assert.equal(hasEpisodes(1), false)
  assert.equal(hasEpisodes(null), false)
  assert.equal(hasEpisodes(2), true)
  assert.equal(hasEpisodes(null, 3), true, 'a later episode means there are several, even without a count')
  assert.equal(resumeLabel(t, { count: 1, n: 1, position: 0 }), 'Play')
  assert.equal(resumeLabel(t, { count: 1, n: 1, position: 754, at: '12:34' }), 'Continue at 12:34')
  assert.equal(resumeLabel(t, { count: 1, n: 1, names: 'Ana' }), 'Join Ana')
  assert.equal(resumeLabel(t, { count: 24, n: 7, position: 10, at: '0:10' }), 'Continue · episode 7')
  assert.equal(resumeLabel(t, { count: 24, n: 7, names: 'Ana' }), 'Join Ana · episode 7')
  assert.equal(stoppedText(t, { count: 1, n: 1, position: 2 }), null)
  assert.equal(stoppedText(t, { count: 1, n: 1, position: 754, at: '12:34' }), 'continue at 12:34')
  assert.equal(stoppedText(t, { count: 9, n: 3, position: 754, at: '12:34' }), 'continue from ep 3 at 12:34')
})
