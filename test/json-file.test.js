import assert from 'node:assert/strict'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { createJsonSaver, readJson } from '../src/json-file.js'
import { quietLogger, tempDir } from './helpers.js'

test('a state file that cannot be read is moved aside, so the next save does not overwrite it', async (t) => {
  const dir = tempDir(t)
  const file = join(dir, 'shows.json')
  assert.deepEqual(await readJson(file, { logger: quietLogger }), { value: undefined, damaged: false })
  writeFileSync(file, '{"shows": {"a": 1}')
  assert.deepEqual(await readJson(file, { logger: quietLogger, now: () => 7 }), { value: undefined, damaged: true })
  await createJsonSaver(file, quietLogger).save({ shows: {} })
  assert.equal(readFileSync(join(dir, 'shows.json.bad-7'), 'utf8'), '{"shows": {"a": 1}')
  assert.deepEqual((await readJson(file, { logger: quietLogger })).value, { shows: {} })
  writeFileSync(file, '[1]')
  assert.equal((await readJson(file, { logger: quietLogger, now: () => 8 })).damaged, true, 'an array is not a state object')
  assert.deepEqual(readdirSync(dir).sort(), ['shows.json.bad-7', 'shows.json.bad-8'])
})

test('saves land in the order asked, each with the value as it was then', async (t) => {
  const file = join(tempDir(t), 'nested', 'state.json')
  const saver = createJsonSaver(file, quietLogger)
  const value = { n: 1 }
  saver.save(value)
  value.n = 2
  saver.save(value)
  value.n = 3
  await saver.settled()
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { n: 2 })
})
