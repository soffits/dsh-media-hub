import assert from 'node:assert/strict'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { follow, hlsArgs, playable, streamPlan } from '../src/stream.js'
import { tempDir } from './helpers.js'

test('a growing file is read from its start until it is complete', async (t) => {
  const file = join(tempDir(), 'part0.mp4')
  const ended = { done: false }
  const chunks = []
  const reading = (async () => { for await (const chunk of follow(file, ended, { pollMs: 5 })) chunks.push(String(chunk)) })()
  await new Promise(done => setTimeout(done, 20))
  writeFileSync(file, 'one ')
  await new Promise(done => setTimeout(done, 20))
  appendFileSync(file, 'two')
  await new Promise(done => setTimeout(done, 20))
  ended.done = true
  await reading
  assert.equal(chunks.join(''), readFileSync(file, 'utf8'))
})

test('streams browsers play are copied, others transcoded, from whichever input has them', () => {
  const video = { video: 'h264', audio: null, height: 1080 }
  const audio = { video: null, audio: 'opus', height: null }
  assert.deepEqual(streamPlan([video, audio], 1080), { video: { input: 0, copy: true }, audio: { input: 1, copy: false } })
  assert.deepEqual(streamPlan([{ video: 'hevc', audio: 'aac', height: 720 }], 1080), { video: { input: 0, copy: false }, audio: { input: 0, copy: true } })
  assert.equal(streamPlan([video], 720).video.copy, false, 'taller than the hub plays')
  assert.equal(streamPlan([{ video: null, audio: null }], 1080), null)
  const args = hlsArgs(streamPlan([video, audio], 1080), ['pipe:3', 'pipe:4'], '/c/s')
  assert.deepEqual(args.slice(0, 5), ['-y', '-i', 'pipe:3', '-i', 'pipe:4'])
  assert.ok(args.includes('event') && args.includes('fmp4') && args.at(-1) === '/c/s/index.m3u8')
})

test('a playlist plays once it has a few segments, or is complete', () => {
  const segment = '#EXTINF:4.0,\n00000.m4s\n'
  assert.equal(playable('#EXTM3U\n'), false)
  assert.equal(playable(`#EXTM3U\n${segment.repeat(2)}`), false)
  assert.equal(playable(`#EXTM3U\n${segment.repeat(3)}`), true)
  assert.equal(playable(`#EXTM3U\n${segment}#EXT-X-ENDLIST\n`), true)
})
