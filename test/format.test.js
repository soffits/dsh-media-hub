import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatCount, metaLabel, popularityText } from '../web/format.js'

const words = {
  'time.locale': 'zh-CN',
  'pop.plays': '{n}次播放',
  'pop.readers': '{n}人读过',
  'meta.cast': '演员',
}
const zh = key => words[key] ?? key
const en = key => ({ 'time.locale': 'en-US', 'pop.plays': '{n} plays' }[key] ?? key)

test('counts are written the way the page language writes them', () => {
  assert.deepEqual([0, 999, 3667, 12345, 415590, 3546984, 33740000, 130000000].map(n => formatCount(n, 'zh-CN')), ['0', '999', '3667', '1.2万', '41.6万', '354.7万', '3374万', '1.3亿'])
  assert.deepEqual([0, 999, 3667, 12345, 415590, 3546984, 33740000].map(n => formatCount(n, 'en-US')), ['0', '999', '3.7K', '12.3K', '415.6K', '3.5M', '33.7M'])
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
