import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createLimiter } from '../src/limit.js'

test('a limiter runs at most n jobs at once, in order, and hands back each result or failure', async () => {
  const limit = createLimiter(2)
  let running = 0
  let most = 0
  const started = []
  const job = (n, fail = false) => async () => {
    started.push(n)
    running += 1
    most = Math.max(most, running)
    await new Promise(done => setTimeout(done, 10))
    running -= 1
    if (fail) throw new Error(`job ${n}`)
    return n
  }
  const results = await Promise.allSettled([1, 2, 3, 4, 5].map(n => limit(job(n, n === 3))))
  assert.equal(most, 2)
  assert.deepEqual(started, [1, 2, 3, 4, 5])
  assert.deepEqual(results.map(r => r.value ?? r.reason.message), [1, 2, 'job 3', 4, 5])
})
