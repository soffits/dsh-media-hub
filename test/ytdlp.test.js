import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { bestTag } from '../src/i18n.js'
import { captionArgs, chooseCaptions, createProgress, failureReason, sizeEstimate } from '../src/sources/ytdlp.js'

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

test('captions: every track a person made in a named language, and a machine\'s only for the viewer\'s language and the video\'s', () => {
  const data = {
    language: 'ja',
    subtitles: { en: [{ ext: 'vtt' }], comments: [{ ext: 'xml' }], 'ai-zh': [{ ext: 'srt' }], forced: [{ ext: 'srt' }] },
    automatic_captions: { ja: [{ ext: 'vtt' }], 'zh-Hans': [{ ext: 'srv3' }, { ext: 'vtt' }], de: [{ ext: 'vtt' }], ko: [{ ext: 'vtt' }] },
  }
  assert.deepEqual(chooseCaptions(data, 'zh-CN'), [
    { tag: 'en', auto: false, original: false },
    { tag: 'zh-Hans', auto: true, original: false },
    { tag: 'ja', auto: true, original: true },
  ], 'labels that name no language are left out; no Korean or German, which nobody asked for')
  assert.deepEqual(chooseCaptions(data, 'en').map(track => track.tag), ['en', 'ja'])
  assert.deepEqual(chooseCaptions({ language: null, subtitles: { 'ai-zh': [{ ext: 'srt' }], 'ai-ar': [{ ext: 'srt' }] } }, 'zh-CN'), [], 'a site\'s own codes are not languages')
  assert.deepEqual(chooseCaptions({ title: 'no lists' }, 'en'), [])
  assert.deepEqual(captionArgs([]), [], 'none chosen, none asked for')
  assert.deepEqual(captionArgs([{ tag: 'zh-Hans' }, { tag: 'en' }]).slice(0, 4), ['--write-subs', '--write-auto-subs', '--sub-langs', '^zh-Hans$,^en$'])
})

test('one progress for an episode\'s parts fetched side by side, sizes estimated until yt-dlp knows them', () => {
  const seen = []
  const progress = createProgress([{ format: 'v', estimate: 900 }, { format: 'a', estimate: 100 }], value => seen.push(value))
  assert.deepEqual(seen[0], { fraction: 0, done: 0, total: 1000, speed: null, eta: null })
  progress.event({ event: 'progress', format: '', downloaded: 10, total: 10, speed: 1, eta: 0 })
  assert.equal(seen.length, 1, 'a caption file is not the episode')
  progress.event({ event: 'progress', format: 'v', downloaded: 300, total: 1200, speed: 100, eta: 9 })
  progress.event({ event: 'progress', format: 'a', downloaded: 50, total: null, speed: 50, eta: null })
  assert.deepEqual(seen.at(-1), { fraction: 350 / 1300, done: 350, total: 1300, speed: 150, eta: 6 })
  progress.event({ event: 'progress', format: 'a', downloaded: 80, total: null, speed: 10, eta: null })
  progress.finished('a')
  assert.deepEqual(seen.at(-1), { fraction: 380 / 1280, done: 380, total: 1280, speed: 100, eta: 9 }, 'a finished part counts as its bytes, its speed no longer')
  assert.equal(sizeEstimate({ filesize_approx: 19546061.4 }, 10), 19546061)
  assert.equal(sizeEstimate({ tbr: 1000 }, 10), 1250000, 'kbit/s over the length')
  assert.equal(sizeEstimate({}, 10), null)
})

test('the reasons read from yt-dlp\'s recorded output', () => {
  const errors = JSON.parse(recorded('errors.json'))
  assert.equal(failureReason(errors.refused), 'blocked')
  assert.equal(failureReason(errors.signIn), 'sign_in')
  assert.equal(failureReason(errors.missing), 'not_found')
  assert.equal(failureReason(errors.proxyRefused), 'failed', 'a refused proxy is told by asking the proxy, not by reading the text')
  assert.equal(failureReason('ERROR: something new'), 'failed')
})
