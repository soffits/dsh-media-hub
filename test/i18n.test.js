/**
 * The page's words live in locale/<tag>.json, one file per language, and nothing in the code names a language:
 * a language is added by adding its file. Every file has every key of the base language, with the same
 * placeholders, so a screen is never half in one language. Names from sources (titles, tags, blurbs) are data and
 * stay as given.
 */
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { BASE, chain, languageChoices, pick } from '../src/i18n.js'
import { readLocales } from '../src/locales.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = path => readFileSync(join(root, path), 'utf8')
const localeDir = join(root, 'locale')
const files = readdirSync(localeDir).filter(name => name.endsWith('.json'))
const tables = Object.fromEntries(files.map(name => [name.slice(0, -'.json'.length), JSON.parse(read(`locale/${name}`))]))
const base = tables[BASE].ui

const codeFiles = () => [
  'client.js', 'index.js', 'tools.js',
  ...readdirSync(join(root, 'web')).filter(name => name.endsWith('.js')).map(name => `web/${name}`),
  ...readdirSync(join(root, 'src'), { recursive: true }).filter(name => name.endsWith('.js')).map(name => `src/${name}`),
].map(path => ({ path, text: read(path) }))
const uiFiles = () => codeFiles().filter(({ path }) => path === 'client.js' || path.startsWith('web/'))
/** Lines that are code, not comments. */
const lines = text => text.split('\n').filter(line => !/^\s*(\/\/|\*|\/\*)/.test(line))
const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()

test('the shipped languages are there, each with DSH\'s plugin title and description', () => {
  for (const tag of [BASE, 'fr', 'zh']) assert.ok(tables[tag], `locale/${tag}.json`)
  for (const [tag, table] of Object.entries(tables)) {
    assert.ok(table.meta?.title && table.meta?.description, `${tag}: meta`)
  }
})

test('every locale file has every key of the base language, no others, and the same placeholders', () => {
  for (const [tag, { ui }] of Object.entries(tables)) {
    assert.deepEqual(Object.keys(base).filter(key => !(key in ui)), [], `missing in ${tag}`)
    assert.deepEqual(Object.keys(ui).filter(key => !(key in base)), [], `not in ${BASE}, in ${tag}`)
    for (const [key, text] of Object.entries(ui)) {
      assert.ok(typeof text === 'string' && text.trim() !== '', `${tag}: ${key} is empty`)
      assert.deepEqual(placeholders(text), placeholders(base[key]), `${tag}: ${key} placeholders`)
    }
  }
})

test('every key the page asks for by name is in the base table, and every count has its plural forms', () => {
  const used = new Set()
  const counted = new Set()
  for (const { text } of uiFiles()) {
    for (const match of text.matchAll(/\bt\('([\w.-]+)'/g)) used.add(match[1])
    for (const match of text.matchAll(/\bplural\(t, (?:[^,]*\? )?'([\w.-]+)'(?: : '([\w.-]+)')?/g)) {
      counted.add(match[1])
      if (match[2]) counted.add(match[2])
    }
  }
  assert.ok(used.size > 50)
  assert.deepEqual([...used].filter(key => !(key in base)), [])
  assert.ok(counted.size >= 4)
  assert.deepEqual([...counted].filter(key => !(`${key}.one` in base && `${key}.other` in base)), [])
})

test('no words are written into the page modules outside the locale files', () => {
  // A literal that people would read: a child of h(), or a title, placeholder, aria-label or alt value.
  const literal = /(?:\b(?:title|placeholder|alt)\s*:\s*|'aria-label'\s*:\s*|h\([^()]*?,\s*(?:null|\{[^{}]*\})\s*,\s*)'([^'\\]*)'/g
  const words = /[A-Za-z]{2,}[^']*\s|^[A-Z][a-z]+$|[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/
  const found = []
  for (const { path, text } of uiFiles()) {
    for (const line of lines(text)) {
      for (const match of line.matchAll(literal)) if (words.test(match[1])) found.push(`${path}: ${match[1]}`)
    }
  }
  assert.deepEqual(found, [])
})

test('no language is named in code: no locale tag as a string, no CJK text outside comments', () => {
  const tags = Object.keys(tables).flatMap(tag => [tag, `${tag}-[A-Za-z]{2,4}`]).join('|')
  const named = new RegExp(`(['"\`])(?:${tags})\\1`, 'i')
  const cjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/
  const found = []
  for (const { path, text } of codeFiles()) {
    for (const line of lines(text)) {
      // The one place the base language is named: the end of every lookup.
      if (path === 'src/i18n.js' && /^export const BASE = /.test(line)) continue
      if (named.test(line) || cjk.test(line)) found.push(`${path}: ${line.trim()}`)
    }
  }
  assert.deepEqual(found, [])
})

test('a text given per language is picked by exact tag, then primary subtag, then the base language', () => {
  const name = { en: 'Media', fr: 'Médias', 'pt-BR': 'Mídia' }
  assert.equal(pick(name, 'fr'), 'Médias')
  assert.equal(pick(name, 'fr-CA'), 'Médias')
  assert.equal(pick(name, 'PT-br'), 'Mídia')
  assert.equal(pick(name, 'pt'), 'Media')
  assert.equal(pick(name, 'de'), 'Media')
  assert.equal(pick({ fr: 'Médias' }, 'de'), 'Médias', 'no base text: the first one given')
  assert.equal(pick('Shows', 'fr'), 'Shows', 'a plain string for everyone')
  assert.equal(pick({ fr: '' , en: 'Media' }, 'fr'), 'Media', 'an empty text counts as missing')
  assert.equal(pick(undefined, 'fr'), '')
  assert.deepEqual(chain('zh-Hant-TW'), ['zh-hant-tw', 'zh-hant', 'zh', BASE])
})

test('a language filter offers the viewer\'s language, the one picked and the results\' languages', () => {
  const results = [{ language: 'de' }, { language: 'pt-BR' }, { language: 'de-AT' }, {}]
  assert.deepEqual(languageChoices('fr-CA', results, 'ja'), ['fr', 'ja', 'de', 'pt'])
  assert.deepEqual(languageChoices('fr', [], ''), ['fr'])
})

test('an extra locale file works with no code change', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'media-hub-locale-'))
  try {
    cpSync(localeDir, dir, { recursive: true })
    const ui = Object.fromEntries(Object.entries(base).map(([key, text]) => [key, `[de] ${text}`]))
    writeFileSync(join(dir, 'de.json'), JSON.stringify({ meta: { title: 'Medien', description: 'Test' }, ui }))
    writeFileSync(join(dir, 'notes.json'), '{}')
    const warnings = []
    const locales = await readLocales(dir, { warn: (...args) => warnings.push(args) })
    assert.deepEqual(Object.keys(locales).sort(), [...Object.keys(tables), 'de'].sort())
    assert.equal(warnings.length, 1, 'a file that is not a language is skipped and logged')
    // The viewer's lookup, as DSH's locale store walks it: their tag, its primary subtag, then the base.
    const translate = (tag, key) => chain(tag).map(one => locales[one]?.[key]).find(text => text !== undefined)
    assert.equal(translate('de-AT', 'tab.library'), `[de] ${base['tab.library']}`)
    assert.equal(translate('es', 'tab.library'), base['tab.library'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
