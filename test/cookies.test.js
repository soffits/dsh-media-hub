import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { accountView, createCookies } from '../src/cookies.js'
import { tempDir } from './helpers.js'

const PAGE = 'https://www.site.example/watch/1'

test('a person\'s own account first, then the default, then one its owner shared; never someone\'s unshared one', async () => {
  const cookies = createCookies([{ hosts: ['site.example'], accounts: [
    { person: 'ann', name: 'Ann', file: '/a' },
    { person: 'bo', name: 'Bo', file: '/b', share: true },
  ] }])
  assert.equal((await cookies.account(PAGE, 'ann')).name, 'Ann')
  assert.equal((await cookies.account(PAGE, 'cy')).name, 'Bo', 'shared')
  assert.equal((await cookies.account(PAGE, '')).name, 'Bo', 'nobody signed in may use a shared one too')
  const unshared = createCookies([{ hosts: ['site.example'], accounts: [{ person: 'ann', file: '/a' }] }])
  assert.equal(await unshared.account(PAGE, 'cy'), null)
  const withDefault = createCookies([{ hosts: ['site.example'], accounts: [{ person: 'bo', file: '/b', share: true }, { name: 'House', file: '/h' }] }])
  assert.equal((await withDefault.account(PAGE, 'cy')).name, 'House', 'the default before another person\'s shared account')
  assert.equal(await withDefault.account('https://other.example/', 'bo'), null, 'a host no rule names has none')
})

test('the page sees an account by its name only; the private copy is mode 600; an unreadable file is a clear error', async (t) => {
  assert.deepEqual(accountView({ person: 'sub-1', name: '', file: '/secret', userAgent: 'x', share: false }), { name: 'sub-1' })
  assert.equal(accountView(null), null)
  const dir = tempDir(t)
  const file = join(dir, 'cookies.txt')
  writeFileSync(file, 'value', { mode: 0o644 })
  const cookies = createCookies([])
  const { args, done } = await cookies.use({ name: 'Ann', file, userAgent: '' }, join(dir, 'work'))
  const copy = args[1]
  assert.equal(readFileSync(copy, 'utf8'), 'value')
  assert.equal(statSync(copy).mode & 0o777, 0o600)
  assert.ok(!args.includes('--user-agent'), 'no User-Agent given, yt-dlp keeps its own')
  await done()
  assert.ok(!existsSync(copy))
  await assert.rejects(cookies.use({ name: 'Ann', file: join(dir, 'gone.txt') }, join(dir, 'work')), (error) => error.code === 'cookies_unavailable' && !error.message.includes('value'))
  assert.deepEqual((await cookies.use(null, dir)).args, [])
})
