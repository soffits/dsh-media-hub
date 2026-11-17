import assert from 'node:assert/strict'
import { test } from 'node:test'
import { captionLabel, captionLanguage, captionName, defaultCaption, parseCaption } from '../src/captions.js'

test('a tag names a language only when it is one: three-letter codes count, a site\'s own codes do not', () => {
  assert.equal(captionLanguage('jpn'), 'ja')
  assert.equal(captionLanguage('zh-Hans'), 'zh')
  assert.equal(captionLanguage('en-orig'), 'en')
  assert.equal(captionLanguage('ai-zh'), null)
  assert.equal(captionLanguage('forced'), null)
  assert.equal(captionLanguage('und'), null)
  assert.equal(captionLanguage(''), null)
})

test('a label carries its marks', () => {
  assert.equal(captionLabel({ tag: 'ko', auto: true, original: true }), 'ko.auto.original')
  assert.deepEqual(parseCaption('ko.auto.original'), { tag: 'ko', language: 'ko', auto: true, original: true })
  assert.deepEqual(parseCaption('en.forced'), { tag: 'en.forced', language: null, auto: false, original: false }, 'marks it does not know stay in the label')
  assert.deepEqual(parseCaption(''), { tag: '', language: null, auto: false, original: false })
})

test('a viewer starts with their language (a person\'s over a machine\'s), else the video\'s own, else nothing', () => {
  assert.equal(defaultCaption(['ar', 'zh-Hans.auto', 'zh-CN', 'ja.original'], 'zh-CN'), 2)
  assert.equal(defaultCaption(['ar', 'zh-Hans.auto', 'ja.original'], 'zh-TW'), 1, 'a machine\'s track in the viewer\'s language')
  assert.equal(defaultCaption(['ar', 'fr', 'ja.original'], 'ko'), 2, 'the video\'s own language')
  assert.equal(defaultCaption(['ar', 'fr', 'ja.auto.original'], 'ko'), 2, 'its own language transcribed by a machine is no translation')
  assert.equal(defaultCaption(['ar', 'ai-zh', 'fr'], 'zh-CN'), -1, 'never a third language')
  assert.equal(defaultCaption(['', 'Commentary'], 'en'), -1, 'labels that name no language')
  assert.equal(defaultCaption([], 'en'), -1)
})

test('the picker names a track in its own language', () => {
  assert.equal(captionName('ja.auto'), '日本語')
  assert.equal(captionName('zh-Hans'), '简体中文')
  assert.equal(captionName('ko.original'), '한국어')
  assert.equal(captionName('Commentary'), 'Commentary')
})
