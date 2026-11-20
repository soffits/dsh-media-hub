import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { test } from 'node:test'

const web = new URL('../web/', import.meta.url)

test('every module the page loads imports cleanly, with every name it imports there', async () => {
  const names = readdirSync(web).filter(name => name.endsWith('.js'))
  assert.ok(names.includes('page.js'))
  for (const name of names) await assert.doesNotReject(import(new URL(name, web)), name)
})
