import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { isFastStart, matchSubtitles, naturalSort, planVideo, probe, scanSource } from '../src/library.js'
import { prepareEpisode } from '../src/prepare.js'
import { decodeText, srtToVtt } from '../src/subtitles.js'
import { parseYouTube } from '../src/youtube-url.js'
import { hasFfmpeg, makeVideo, tempDir } from './helpers.js'

test('episodes sort naturally, in any script', () => {
  assert.deepEqual(naturalSort(['10.mp4', '2.mp4', '1.mp4']), ['1.mp4', '2.mp4', '10.mp4'])
  assert.deepEqual(naturalSort(['第10集.mp4', '第2集.mp4', '第1集.mp4']), ['第1集.mp4', '第2集.mp4', '第10集.mp4'])
  assert.deepEqual(naturalSort(['E10.mkv', 'e2.mkv']), ['e2.mkv', 'E10.mkv'])
})

test('subtitles match their video by name, with an optional label', () => {
  const names = ['ep1.mp4', 'ep1.srt', 'ep1.zh-Hans.ass', 'ep10.srt', 'ep1x.srt', 'notes.txt']
  assert.deepEqual(matchSubtitles('ep1.mp4', names), [{ name: 'ep1.srt', label: '' }, { name: 'ep1.zh-Hans.ass', label: 'zh-Hans' }])
})

test('a folder becomes ordered episodes with their subtitles', async (t) => {
  const dir = tempDir(t)
  for (const name of ['2.mp4', '10.mp4', '1.mp4', '1.srt', 'cover.jpg']) writeFileSync(join(dir, name), '')
  mkdirSync(join(dir, 'nested'))
  const episodes = await scanSource(dir)
  assert.deepEqual(episodes.map(e => e.title), ['1', '2', '10'])
  assert.deepEqual(episodes[0].subtitles, [{ path: join(dir, '1.srt'), label: '' }])
  const single = await scanSource(join(dir, '2.mp4'))
  assert.equal(single.length, 1)
  await assert.rejects(scanSource(join(dir, 'nested')), { code: 'empty' })
})

test('SRT becomes WebVTT', () => {
  const srt = '1\r\n00:00:01,500 --> 00:00:03,000\r\nHello\r\n\r\n2\r\n0:00:04,5 --> 00:00:06,000\r\n你好\r\n'
  assert.equal(srtToVtt(srt), 'WEBVTT\n\n00:00:01.500 --> 00:00:03.000\nHello\n\n00:00:04.500 --> 00:00:06.000\n你好\n')
})

test('subtitle text decodes from UTF-8, UTF-16 and CJK legacy encodings', () => {
  assert.equal(decodeText(new TextEncoder().encode('你好')), '你好')
  assert.equal(decodeText(Buffer.from([0xff, 0xfe, 0x60, 0x4f, 0x7d, 0x59])), '你好')
  // "你好" in GBK
  assert.equal(decodeText(Buffer.from([0xc4, 0xe3, 0xba, 0xc3])), '你好')
})

test('the plan says what a browser needs', () => {
  const h264 = { video: 'h264', audio: 'aac', height: 720, duration: 10, subtitles: [] }
  assert.equal(planVideo('/a.mp4', h264, { fastStart: true, maxHeight: 1080 }), 'direct')
  assert.equal(planVideo('/a.mp4', h264, { fastStart: false, maxHeight: 1080 }), 'remux')
  assert.equal(planVideo('/a.mkv', h264, { fastStart: null, maxHeight: 1080 }), 'remux')
  assert.equal(planVideo('/a.mkv', { ...h264, video: 'hevc' }, { fastStart: null, maxHeight: 1080 }), 'transcode')
  assert.equal(planVideo('/a.mp4', { ...h264, audio: 'ac3' }, { fastStart: true, maxHeight: 1080 }), 'transcode')
  assert.equal(planVideo('/a.mp4', { ...h264, height: 2160 }, { fastStart: true, maxHeight: 1080 }), 'transcode')
  assert.equal(planVideo('/a.webm', { ...h264, video: 'vp9', audio: 'opus' }, { fastStart: null, maxHeight: 1080 }), 'direct')
  assert.equal(planVideo('/a.m3u8', {}, { fastStart: null, maxHeight: 1080 }), 'direct')
})

test('YouTube links give a video or a playlist', () => {
  assert.deepEqual(parseYouTube('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42'), { videoId: 'dQw4w9WgXcQ', listId: null })
  assert.deepEqual(parseYouTube('https://youtu.be/dQw4w9WgXcQ?si=x'), { videoId: 'dQw4w9WgXcQ', listId: null })
  assert.deepEqual(parseYouTube('https://www.youtube.com/shorts/dQw4w9WgXcQ'), { videoId: 'dQw4w9WgXcQ', listId: null })
  assert.deepEqual(parseYouTube('https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG'), { videoId: null, listId: 'PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG' })
  assert.deepEqual(parseYouTube('dQw4w9WgXcQ'), { videoId: 'dQw4w9WgXcQ', listId: null })
  assert.equal(parseYouTube('https://example.com/watch?v=dQw4w9WgXcQ'), null)
  assert.equal(parseYouTube('https://www.youtube.com/watch?v=short'), null)
})

test('fast start is read from the file layout', { skip: !hasFfmpeg && 'needs ffmpeg' }, async (t) => {
  const dir = tempDir(t)
  makeVideo(join(dir, 'fast.mp4'), { faststart: true })
  makeVideo(join(dir, 'slow.mp4'), { faststart: false })
  assert.equal(await isFastStart(join(dir, 'fast.mp4')), true)
  assert.equal(await isFastStart(join(dir, 'slow.mp4')), false)
})

test('episodes are prepared: remuxed when needed, subtitles converted, results cached', { skip: !hasFfmpeg && 'needs ffmpeg' }, async (t) => {
  const dir = tempDir(t)
  const cacheDir = join(dir, 'cache')
  makeVideo(join(dir, 'ep.mp4'), { faststart: false })
  writeFileSync(join(dir, 'ep.srt'), '1\n00:00:00,000 --> 00:00:01,000\nHi\n')
  writeFileSync(join(dir, 'ep.zh.ass'), Buffer.from(`[Script Info]\nScriptType: v4.00+\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,0,2,10,10,10,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,你好\n`))
  const [episode] = await scanSource(join(dir, 'ep.mp4'))
  const prepared = await prepareEpisode(episode, { cacheDir })
  assert.equal(prepared.plan, 'remux')
  assert.equal(await isFastStart(prepared.file), true)
  assert.ok(prepared.duration > 1.5)
  assert.deepEqual(prepared.subtitles.map(s => s.label), ['Subtitles', 'zh'])
  assert.match(readFileSync(prepared.subtitles[1].file, 'utf8'), /你好/)
  const again = await prepareEpisode(episode, { cacheDir })
  assert.equal(again.file, prepared.file)
})

test('videos in codecs browsers cannot play are transcoded to H.264', { skip: !hasFfmpeg && 'needs ffmpeg' }, async (t) => {
  const dir = tempDir(t)
  makeVideo(join(dir, 'old.avi'), { codec: 'mpeg4' })
  const [episode] = await scanSource(join(dir, 'old.avi'))
  const prepared = await prepareEpisode(episode, { cacheDir: join(dir, 'cache') })
  assert.equal(prepared.plan, 'transcode')
  const info = await probe(prepared.file)
  assert.equal(info.video, 'h264')
  assert.equal(info.audio, 'aac')
})
