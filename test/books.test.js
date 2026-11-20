import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { attachment, createBooks } from '../src/books.js'
import { convertBase, offeredFormats } from '../src/formats.js'
import { createCommandSource } from '../src/sources/command.js'
import { applyFilters, interleave, parseFilters } from '../src/filters.js'
import { personOf } from '../src/people.js'
import { createShelfRoutes } from '../src/shelf-routes.js'
import { tempDir } from './helpers.js'

const FAKE = fileURLToPath(new URL('./fixtures/fake-source.mjs', import.meta.url))
const quiet = { warn() {} }
const covers = { ofSource: (source, url) => (url ? `covers/${source}-x` : null) }

function setup(t, { capBytes = 0, convert = false, log } = {}) {
  const dir = tempDir(t)
  const source = createCommandSource({ id: 'lib', label: 'Lib', kinds: [{ id: 'book', label: 'Books', media: 'book' }], filters: ['language', 'year'], command: [process.execPath, FAKE], env: { FAKE_SOURCE_DELAY_MS: '5', ...(log ? { FAKE_SOURCE_LOG: log } : {}) } }, { logger: quiet, cwd: join(dir, 'cwd') })
  let converter = { command: '', available: async () => false }
  if (convert) {
    const script = join(dir, 'fake-convert')
    writeFileSync(script, '#!/bin/sh\nprintf "converted from %s\\n" "$1" > "$2"\n')
    chmodSync(script, 0o755)
    converter = { command: script, available: async () => true }
  }
  const books = createBooks({ dir: join(dir, 'books'), sources: new Map([['lib', source]]), capBytes, converter, covers, logger: quiet })
  t.after(() => books.dispose())
  return { dir, books, source }
}

async function settled(books, person, entry) {
  for (let i = 0; i < 200; i++) {
    const found = (await books.list(person)).entries.find(one => one.entry === entry)
    if (found.state !== 'fetching') return found
    await new Promise(done => setTimeout(done, 20))
  }
  throw new Error('the fetch did not settle')
}

test('a book is fetched once into the shelf and its file served with its type; two people share one file', async (t) => {
  const { books } = setup(t)
  await books.load()
  const added = await books.add('ann', { source: 'lib', id: 'pg-1342', format: 'epub' })
  assert.equal(added.state, 'fetching')
  const ready = await settled(books, 'ann', added.entry)
  assert.deepEqual([ready.state, ready.name, ready.title, ready.author, ready.cover], ['ready', 'Pride and Prejudice.epub', 'Pride and Prejudice', 'Jane Austen', 'covers/lib-x'])
  const file = await books.file('ann', added.entry)
  assert.equal(file.type, 'application/epub+zip')
  assert.equal(readFileSync(file.path).subarray(0, 2).toString(), 'PK')

  const theirs = await books.add('bea', { source: 'lib', id: 'pg-1342', format: 'epub' })
  assert.equal(theirs.state, 'ready', 'the file already here is not fetched again')
  assert.equal(await books.file('bea', added.entry), null, 'one person cannot read another person\'s entry')
  assert.equal((await books.list('carl')).entries.length, 0)

  await books.remove('ann', added.entry)
  assert.ok(existsSync(file.path), 'the file stays while another shelf holds it')
  await books.remove('bea', theirs.entry)
  assert.ok(!existsSync(file.path), 'the last holder removing it deletes the file')
})

test('a format the source lacks is converted from the best one it has, only with a converter', async (t) => {
  const plain = setup(t)
  await plain.books.load()
  const refused = await plain.books.add('ann', { source: 'lib', id: 'pg-2701', format: 'epub' })
  const failed = await settled(plain.books, 'ann', refused.entry)
  assert.equal(failed.state, 'failed')
  assert.match(failed.error, /not offered as epub/)

  const { books } = setup(t, { convert: true })
  await books.load()
  const added = await books.add('ann', { source: 'lib', id: 'pg-2701', format: 'epub' })
  const ready = await settled(books, 'ann', added.entry)
  assert.deepEqual([ready.state, ready.name, ready.converted], ['ready', 'Moby Dick.epub', true])
  assert.match(readFileSync((await books.file('ann', added.entry)).path, 'utf8'), /converted from .*Moby Dick\.txt/)
})

test('past the cap the least recently used files go; their entries stay and can be fetched again', async (t) => {
  const { books } = setup(t, { capBytes: 60 })
  await books.load()
  const first = await books.add('ann', { source: 'lib', id: 'pg-1342', format: 'txt' })
  await settled(books, 'ann', first.entry)
  const second = await books.add('ann', { source: 'lib', id: 'pg-1342', format: 'epub' })
  await settled(books, 'ann', second.entry)
  const third = await books.add('ann', { source: 'lib', id: 'zh-1', format: 'txt' })
  await settled(books, 'ann', third.entry)
  const { entries, usedBytes } = await books.list('ann')
  assert.ok(usedBytes <= 60)
  assert.equal(entries.find(one => one.entry === first.entry).state, 'removed')
  assert.equal(entries.find(one => one.entry === third.entry).state, 'ready')
  await books.retry('ann', first.entry)
  assert.equal((await settled(books, 'ann', first.entry)).state, 'ready')
})

test('shelves survive a restart; a fetch cut short starts again', async (t) => {
  const { dir, books, source } = setup(t)
  await books.load()
  const added = await books.add('ann', { source: 'lib', id: 'zh-1', format: 'txt' })
  await settled(books, 'ann', added.entry)
  await books.dispose()
  const again = createBooks({ dir: join(dir, 'books'), sources: new Map([['lib', source]]), capBytes: 0, converter: { command: '', available: async () => false }, covers, logger: quiet })
  t.after(() => again.dispose())
  await again.load()
  const [entry] = (await again.list('ann')).entries
  assert.deepEqual([entry.state, entry.title, entry.name], ['ready', '红楼梦', '红楼梦.txt'])
  assert.deepEqual(readdirSync(join(dir, 'books')).sort(), ['books.json', 'files'])
})

test('formats on offer and the base a conversion starts from', () => {
  assert.deepEqual(offeredFormats([{ format: 'txt', bytes: 5 }], false), [{ format: 'txt', bytes: 5, converted: false }])
  const offered = offeredFormats([{ format: 'pdf', bytes: 5 }, { format: 'epub', bytes: null }], true)
  assert.deepEqual(offered.filter(entry => !entry.converted).map(entry => entry.format), ['pdf', 'epub'])
  assert.ok(offered.some(entry => entry.format === 'txt' && entry.converted))
  assert.deepEqual(offeredFormats([{ format: 'cbz' }], true).map(entry => entry.format), ['cbz'], 'nothing the converter cannot read is converted')
  assert.equal(convertBase([{ format: 'pdf' }, { format: 'mobi' }]), 'mobi')
})

test('an attachment keeps a name in any script and gives a plain fallback', () => {
  assert.equal(attachment('红楼梦.epub'), `attachment; filename="___.epub"; filename*=UTF-8''${encodeURIComponent('红楼梦.epub')}`)
  assert.equal(attachment('Moby "Dick".txt'), 'attachment; filename="Moby _Dick_.txt"; filename*=UTF-8\'\'Moby%20%22Dick%22.txt')
})

test('search filters: flags only for what the source understands, and the answer filtered by the hub too', async (t) => {
  const dir = tempDir(t)
  const log = join(dir, 'log')
  const { source } = setup(t, { log })
  const filters = parseFilters(name => ({ language: 'zh-Hans', format: 'TXT', yearFrom: '1700', yearTo: 'x', maxMb: '1' })[name] ?? '')
  assert.deepEqual(filters, { language: 'zh-hans', format: 'txt', yearFrom: 1700, yearTo: null, maxBytes: 1e6 })
  const { results } = await source.search('anything', { kind: 'book', filters })
  assert.match(readFileSync(log, 'utf8'), /^search --language --year-from\n$/, 'format is not in the source\'s filters, so it is not sent')
  assert.deepEqual(applyFilters(results, filters).map(result => result.id), ['zh-1'])
  assert.deepEqual(applyFilters(results, parseFilters(() => '')).length, 3)
  assert.deepEqual(applyFilters([{ id: 'u', formats: [], year: null, language: '' }], filters).map(result => result.id), ['u'], 'unknown fields pass')
  assert.deepEqual(interleave([[1, 2, 3], ['a'], ['x', 'y']]), [1, 'a', 'x', 2, 'y', 3])
})

test('the person behind a request: a verified identity gets its own key, without one everyone is the owner', () => {
  const ann = personOf({ current: () => ({ provider: 'oidc', issuer: 'https://id.example', id: 'sub-1', name: 'Ann' }) })
  assert.equal(ann.verified, true)
  assert.equal(ann.name, 'Ann')
  assert.notEqual(ann.key, personOf({ current: () => ({ issuer: 'https://other.example', id: 'sub-1' }) }).key, 'the same id from another issuer is someone else')
  assert.deepEqual(personOf(undefined), { key: 'owner', id: '', name: '', verified: false })
  assert.deepEqual(personOf({ current: () => null }), { key: 'owner', id: '', name: '', verified: false })
})

test('shelf routes answer for the asking person only and serve the file as an attachment', async (t) => {
  const { books } = setup(t)
  await books.load()
  let who = 'sub-1'
  const routes = createShelfRoutes({ books: () => books, identity: () => ({ current: () => ({ issuer: 'i', id: who, name: who }) }) })
  const route = path => routes.find(one => one.path === path).fetch
  const post = (path, value) => route(path)(new Request(`http://dsh.invalid${path}`, { method: 'POST', body: JSON.stringify(value) }))
  const added = await (await post('/api/media-hub/shelf/add', { source: 'lib', id: 'zh-1', format: 'txt' })).json()
  const key = personOf({ current: () => ({ issuer: 'i', id: 'sub-1' }) }).key
  await settled(books, key, added.entry.entry)
  const list = await (await route('/api/media-hub/shelf')(new Request('http://dsh.invalid/api/media-hub/shelf'))).json()
  assert.deepEqual([list.entries.length, list.person.name], [1, 'sub-1'])
  const file = await route('/api/media-hub/shelf/file')(new Request(`http://dsh.invalid/api/media-hub/shelf/file?entry=${added.entry.entry}`))
  assert.equal(file.status, 200)
  assert.equal(file.headers.get('content-type'), 'text/plain; charset=utf-8')
  assert.match(file.headers.get('content-disposition'), /^attachment; /)
  assert.equal(await file.text(), '红楼梦\n曹雪芹\n')
  who = 'sub-2'
  const other = await route('/api/media-hub/shelf/file')(new Request(`http://dsh.invalid/api/media-hub/shelf/file?entry=${added.entry.entry}`))
  assert.equal(other.status, 404)
  assert.equal((await (await route('/api/media-hub/shelf')(new Request('http://dsh.invalid/api/media-hub/shelf'))).json()).entries.length, 0)
  const bad = await post('/api/media-hub/shelf/add', { source: 'nope', id: 'x', format: 'txt' })
  assert.equal(bad.status, 404)
})

test('a shelves file that cannot be read is set aside and the downloaded books stay, then and after a restart', async (t) => {
  const { dir, books, source } = setup(t)
  const reopen = () => {
    const opened = createBooks({ dir: join(dir, 'books'), sources: new Map([['lib', source]]), converter: { command: '', available: async () => false }, covers, logger: quiet })
    t.after(() => opened.dispose())
    return opened
  }
  await books.load()
  const added = await books.add('ann', { source: 'lib', id: 'pg-1342', format: 'epub' })
  await settled(books, 'ann', added.entry)
  const { path } = await books.file('ann', added.entry)
  await books.dispose()
  writeFileSync(join(dir, 'books', 'books.json'), '{"files": {"trunc')

  const again = reopen()
  await again.load()
  assert.ok(existsSync(path), 'the book survives the bad read')
  assert.deepEqual(readdirSync(join(dir, 'books')).filter(name => name.startsWith('books.json.bad-')).map(name => readFileSync(join(dir, 'books', name), 'utf8')), ['{"files": {"trunc'])
  const other = await again.add('bea', { source: 'lib', id: 'pg-1342', format: 'txt' })
  await settled(again, 'bea', other.entry)
  await again.dispose()

  const cutOff = join(dir, 'books', 'files', 'cut-off')
  mkdirSync(cutOff)
  utimesSync(cutOff, new Date(Date.now() + 60_000), new Date(Date.now() + 60_000))
  await reopen().load()
  assert.ok(existsSync(path), 'the book survives the next start too')
  assert.equal(existsSync(cutOff), false, 'a folder newer than the saved shelves is a fetch cut off before its save')
})
