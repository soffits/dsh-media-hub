import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { bestTag } from '../src/i18n.js'
import { createProgress, failureReason, subtitleArgs, subtitleLanguages } from '../src/sources/ytdlp.js'

const recorded = name => readFileSync(new URL(`./fixtures/yt-dlp/${name}`, import.meta.url), 'utf8')

test('a language is matched by tag, then by language and script, then by language: Chinese, Japanese and Korean alike', () => {
  const tags = ['en', 'en-orig', 'zh-Hans', 'zh-Hant', 'ja', 'ko']
  assert.equal(bestTag(tags, 'zh-CN'), 'zh-Hans')
  assert.equal(bestTag(tags, 'zh-TW'), 'zh-Hant')
  assert.equal(bestTag(tags, 'zh-HK'), 'zh-Hant')
  assert.equal(bestTag(tags, 'ja-JP'), 'ja')
  assert.equal(bestTag(tags, 'ko'), 'ko')
  assert.equal(bestTag(tags, 'en-GB'), 'en')
  assert.equal(bestTag(tags, 'fr'), null)
  assert.equal(bestTag(tags, ''), null)
})

test('subtitles in text formats only; generated ones fill in the viewer\'s and the video\'s language', () => {
  const data = { language: 'ja', subtitles: { en: [{ ext: 'vtt' }], comments: [{ ext: 'xml' }], chat: [{ ext: 'json' }] }, automatic_captions: { ja: [{ ext: 'vtt' }], 'zh-Hans': [{ ext: 'srv3' }, { ext: 'vtt' }], de: [{ ext: 'vtt' }] } }
  assert.deepEqual(subtitleLanguages(data, 'zh-CN'), ['en', 'zh-Hans', 'ja'])
  assert.deepEqual(subtitleLanguages(data, 'en'), ['en', 'ja'])
  assert.equal(subtitleLanguages({ title: 'no lists' }, 'en'), null)
  assert.deepEqual(subtitleArgs([], 'en'), [], 'none chosen, none asked for')
  assert.deepEqual(subtitleArgs(null, 'zh-CN').slice(0, 4), ['--write-subs', '--write-auto-subs', '--sub-langs', '^zh(-.*)?$'], 'unknown lists: the viewer\'s language')
  assert.deepEqual(subtitleArgs(null, ''), [])
})

test('progress without announced sizes follows the file being fetched; lines about subtitles are not the episode', () => {
  const seen = []
  const progress = createProgress((n, value) => seen.push({ n, ...value }))
  progress.event({ event: 'progress', format: '', downloaded: 10, total: 10, speed: 1, eta: 0 })
  assert.equal(seen.length, 0, 'before the episode starts')
  progress.event({ event: 'start', number: 3, formats: ['18'], sizes: null, size: null })
  progress.event({ event: 'progress', format: '', downloaded: 5, total: 10, speed: null, eta: null })
  progress.event({ event: 'progress', format: '18', downloaded: 250, total: 1000, speed: 100, eta: 7.6 })
  assert.deepEqual(seen, [
    { n: 3, fraction: 0, done: 0, total: null, speed: null, eta: null },
    { n: 3, fraction: 0.25, done: 250, total: 1000, speed: 100, eta: 8 },
  ])
})

test('the reasons read from yt-dlp\'s recorded output', () => {
  const errors = JSON.parse(recorded('errors.json'))
  assert.equal(failureReason(errors.refused), 'blocked')
  assert.equal(failureReason(errors.signIn), 'sign_in')
  assert.equal(failureReason(errors.missing), 'not_found')
  assert.equal(failureReason(errors.proxyRefused), 'failed', 'a refused proxy is told by asking the proxy, not by reading the text')
  assert.equal(failureReason('ERROR: something new'), 'failed')
})
