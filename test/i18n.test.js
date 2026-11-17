/**
 * Every word the page shows comes from the message table in client.js (en and zh), so a screen is never half in one
 * language and half in another. Names that come from sources (titles, tags, blurbs) are data and stay as given.
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'

const root = new URL('..', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const client = read('client.js')
const modules = readdirSync(new URL('web/', root)).filter(name => name.endsWith('.js')).map(name => ({ name, text: read(`web/${name}`) }))

/** The keys of one dictionary in client.js (`const en = { ... }`). */
function keysOf(name) {
  const start = client.indexOf(`const ${name} = {`)
  assert.notEqual(start, -1, `client.js has a ${name} table`)
  const end = client.indexOf('\n    }\n', start)
  return new Set([...client.slice(start, end).matchAll(/^\s+'?([\w.-]+)'?:/gm)].map(match => match[1]))
}

const lines = text => text.split('\n').filter(line => !/^\s*(\/\/|\*|\/\*)/.test(line))

test('the English and Chinese tables have the same keys', () => {
  const en = keysOf('en')
  const zh = keysOf('zh')
  assert.deepEqual([...en].filter(key => !zh.has(key)), [], 'missing in zh')
  assert.deepEqual([...zh].filter(key => !en.has(key)), [], 'missing in en')
})

test('every key the page asks for by name is in the table', () => {
  const en = keysOf('en')
  const used = new Set()
  for (const { text } of [...modules, { text: client }]) {
    for (const match of text.matchAll(/\bt\('([\w.-]+)'\)/g)) used.add(match[1])
  }
  assert.ok(used.size > 50)
  assert.deepEqual([...used].filter(key => !en.has(key)), [])
})

test('no words are written into the page modules outside the table', () => {
  // A literal that people would read: a child of h(), or a title, placeholder, aria-label or alt value.
  const literal = /(?:\b(?:title|placeholder|alt)\s*:\s*|'aria-label'\s*:\s*|h\([^()]*?,\s*(?:null|\{[^{}]*\})\s*,\s*)'([^'\\]*)'/g
  const words = /[A-Za-z]{2,}[^']*\s|^[A-Z][a-z]+$|[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/
  const found = []
  for (const { name, text } of modules) {
    for (const line of lines(text)) {
      for (const match of line.matchAll(literal)) if (words.test(match[1])) found.push(`${name}: ${match[1]}`)
    }
  }
  assert.deepEqual(found, [])
})
