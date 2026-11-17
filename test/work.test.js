import assert from 'node:assert/strict'
import { test } from 'node:test'
import { slotsOf } from '../src/episodes.js'
import { episodeTitle, snapshotOf } from '../src/work.js'

const info = {
  id: '9', title: '初尝玫瑰！', kind: 'drama', author: '云景文化', score: 8.2, blurb: '简介', cover: 'https://cdn.example/c.heic', status: 'finished',
  tags: ['都市'], latest: '第2集', meta: [{ key: 'cast', label: 'Cast', value: '某人' }], episodes: 2, episodeTitles: ['开始', ''],
  popularity: { count: 5, label: 'plays', text: '' },
  related: [{ id: '10', title: '第二季', kind: 'drama', relation: 'season', blurb: 'long', score: 8, cover: null, episodes: 40, tags: [], latest: 'x', meta: [{ key: 'a' }] }],
}

test('a snapshot keeps the details and related works one level deep, without the related works\' own bulk', () => {
  const snapshot = snapshotOf(info, 123)
  assert.equal(snapshot.at, 123)
  assert.deepEqual([snapshot.title, snapshot.score, snapshot.episodes, snapshot.tags, snapshot.episodeTitles], ['初尝玫瑰！', 8.2, 2, ['都市'], ['开始', '']])
  assert.deepEqual(snapshot.related.map(work => [work.id, work.relation, work.episodes]), [['10', 'season', 40]])
  assert.equal('blurb' in snapshot.related[0] || 'meta' in snapshot.related[0], false)
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), snapshot, 'it survives being saved as JSON')
})

test('episode titles come from the work when it gives one, else from the file', () => {
  const work = snapshotOf(info, 1)
  assert.equal(episodeTitle(work, 1), '开始')
  assert.equal(episodeTitle(work, 2), null, 'an empty title is no title')
  assert.equal(episodeTitle(null, 1), null)
  const slots = slotsOf({ source: { episodes: 3 }, work }, [{ name: '01 第1集.mp4' }, { name: '02 第2集.mp4' }])
  assert.deepEqual(slots.map(slot => slot.title), ['开始', '02 第2集', null])
})
