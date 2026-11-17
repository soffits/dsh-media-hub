import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Config, defaultStateDir } from '../src/config.js'

test('the default configuration ships two sources: the fanqie launcher and bookfetch, each kind with its media', () => {
  const { sources } = Config({})
  assert.deepEqual(sources.map(source => [source.id, source.command, source.kinds.map(kind => `${kind.id}:${kind.media}`), source.filters]), [
    ['fanqie', ['fanqie'], ['drama:video', 'audio:audio', 'novel:book'], []],
    ['bookfetch', ['bookfetch', 'source'], ['ebook:book', 'paper:book'], ['language', 'format', 'year']],
  ])
})

test('the state folder is media-hub, or the folder of an earlier Video Sync install when only that one exists', () => {
  assert.equal(defaultStateDir('/h', () => false), '/h/media-hub')
  assert.equal(defaultStateDir('/h', path => path === '/h/videosync'), '/h/videosync')
  assert.equal(defaultStateDir('/h', () => true), '/h/media-hub')
})

test('a source needs an id, kinds and a command; its label and environment are optional', () => {
  const { sources } = Config({ sources: [{ id: 'bili', kinds: [{ id: 'video', label: 'Videos' }], command: ['bilibili-wrapper', '--cookies', 'c.txt'] }] })
  assert.deepEqual(sources, [{ id: 'bili', label: '', kinds: [{ id: 'video', label: 'Videos', media: 'video', trending: false }], filters: [], command: ['bilibili-wrapper', '--cookies', 'c.txt'], env: {} }])
  assert.throws(() => Config({ sources: [{ id: 'a', kinds: [{ id: 'v', label: 'V', media: 'game' }], command: ['x'] }] }))
  assert.throws(() => Config({ sources: [{ id: 'a', kinds: [{ id: 'v', label: 'V' }], filters: ['colour'], command: ['x'] }] }))
  assert.throws(() => Config({ sources: [{ id: 'Bad Id', kinds: [{ id: 'v', label: 'V' }], command: ['x'] }] }))
  assert.throws(() => Config({ sources: [{ id: 'a', kinds: [{ id: 'v', label: 'V' }], command: [] }] }))
})
