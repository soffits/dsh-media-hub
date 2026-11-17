/**
 * An episode as HLS while it is still being made. ffmpeg reads the episode's
 * inputs (files a source is still fetching, followed as they grow, or files
 * that are complete) and writes a playlist of short fMP4 segments that
 * browsers play while it grows (hls.js, or native HLS). The episode is
 * playable once a few segments exist; streams browsers play are copied,
 * others are transcoded to H.264/AAC on the way.
 *
 * Inputs that cannot be read from their start (an MP4 with its index at the
 * end) make ffmpeg fail before anything is playable; the caller then plays
 * the finished file as before.
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, open, readFile, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { probe } from './library.js'

export const PLAYLIST = 'index.m3u8'
/** Segments listed before the episode counts as playable. */
const READY_SEGMENTS = 3
const SEGMENT_SECONDS = 4
const POLL_MS = 300
/** A growing input is probed again after it grew this much. */
const PROBE_STEP = 64 << 10
const CHUNK = 1 << 20

const sleep = ms => new Promise(done => setTimeout(done, ms))
const sizeOf = path => stat(path).then(info => info.size, () => null)

/** Whether a promise has settled, as a flag that flips when it does. */
function settledFlag(promise) {
  const flag = { done: false }
  Promise.resolve(promise).then(() => { flag.done = true }, () => { flag.done = true })
  return flag
}

/**
 * A file read from its start as it grows, until `ended` is set and nothing more is there.
 * @param {string} path
 * @param {{ done: boolean }} ended
 */
export async function* follow(path, ended, { pollMs = POLL_MS, signal } = {}) {
  while ((await sizeOf(path)) === null) {
    if (ended.done || signal?.aborted) return
    await sleep(pollMs)
  }
  const handle = await open(path, 'r')
  try {
    let position = 0
    const buffer = Buffer.alloc(CHUNK)
    for (;;) {
      if (signal?.aborted) return
      const finished = ended.done
      const { bytesRead } = await handle.read(buffer, 0, CHUNK, position)
      if (bytesRead > 0) {
        position += bytesRead
        yield Buffer.from(buffer.subarray(0, bytesRead))
      } else if (finished) {
        return
      } else {
        await sleep(pollMs)
      }
    }
  } finally {
    await handle.close()
  }
}

/** What becomes of each stream: copied when browsers play it in fMP4 HLS, else transcoded. */
export function streamPlan(infos, maxHeight) {
  const videoAt = infos.findIndex(info => info.video !== null)
  const audioAt = infos.findIndex(info => info.audio !== null)
  if (videoAt < 0 && audioAt < 0) return null
  const video = videoAt < 0 ? null : infos[videoAt]
  return {
    video: videoAt < 0 ? null : { input: videoAt, copy: video.video === 'h264' && (video.height ?? 0) <= maxHeight },
    audio: audioAt < 0 ? null : { input: audioAt, copy: ['aac', 'mp3'].includes(infos[audioAt].audio) },
  }
}

/** ffmpeg's arguments for a plan: `inputs` as ffmpeg names them (files or `pipe:N`), the playlist and its segments into `dir`. */
export function hlsArgs(plan, inputs, dir, { maxHeight = 1080, threads = 2 } = {}) {
  const video = plan.video === null ? [] : plan.video.copy
    ? ['-map', `${plan.video.input}:v:0`, '-c:v', 'copy']
    : ['-map', `${plan.video.input}:v:0`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p',
        '-vf', `scale=-2:'min(ih,${maxHeight})'`, '-force_key_frames', `expr:gte(t,n_forced*${SEGMENT_SECONDS})`]
  const audio = plan.audio === null ? [] : plan.audio.copy
    ? ['-map', `${plan.audio.input}:a:0`, '-c:a', 'copy']
    : ['-map', `${plan.audio.input}:a:0`, '-c:a', 'aac', '-b:a', '160k', '-ac', '2']
  return [
    '-y', ...inputs.flatMap(input => ['-i', input]),
    ...video, ...audio, '-sn', '-dn', '-threads', String(threads),
    '-f', 'hls', '-hls_time', String(SEGMENT_SECONDS), '-hls_list_size', '0', '-hls_playlist_type', 'event',
    '-hls_segment_type', 'fmp4', '-hls_flags', 'independent_segments+temp_file',
    '-hls_segment_filename', join(dir, '%05d.m4s'), join(dir, PLAYLIST),
  ]
}

/** What a file holds, read as soon as its header is there: tried again as it grows, until it reads or the file is complete. */
async function probeGrowing(file, ended, { ffprobe, signal }) {
  let tried = -1
  for (;;) {
    if (signal?.aborted) throw new Error('stopped')
    const finished = ended.done
    const size = (await sizeOf(file)) ?? 0
    if (finished || size >= tried + PROBE_STEP) {
      tried = size
      const info = await probe(file, { ffprobe }).catch(() => null)
      if (info !== null && (info.video !== null || info.audio !== null)) return info
      if (finished) throw new Error(`cannot read ${file}`)
    }
    await sleep(POLL_MS)
  }
}

/** Whether a playlist ffmpeg is writing can be played: enough segments, or it is complete. */
export function playable(text) {
  return text.includes('#EXT-X-ENDLIST') || (text.match(/#EXTINF:/g) ?? []).length >= READY_SEGMENTS
}

/** A complete playlist from an earlier run in `dir`, or null. */
export async function finishedPlaylist(dir) {
  const file = join(dir, PLAYLIST)
  const text = await readFile(file, 'utf8').catch(() => '')
  return text.includes('#EXT-X-ENDLIST') ? file : null
}

/**
 * Make `dir` an HLS copy of an episode.
 * @param {object} options
 * @param {string[]} options.files - the episode's inputs: one file, or its video and its audio
 * @param {Promise<unknown>} [options.growing] - set while the files are still being written; settles when they are complete
 * @param {string} options.dir - emptied first
 * @param {(ready: { playlist: string, duration: number | null }) => void} [options.onReady] - once it can be played
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ playlist: string, duration: number | null }>} once the playlist is complete
 */
export async function streamEpisode({ files, growing, dir, ffmpeg = 'ffmpeg', ffprobe = 'ffprobe', maxHeight = 1080, threads = 2, onReady, signal }) {
  const ended = settledFlag(growing ?? null)
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  const infos = []
  for (const file of files) infos.push(await probeGrowing(file, ended, { ffprobe, signal }))
  const plan = streamPlan(infos, maxHeight)
  if (plan === null) throw new Error('nothing to play in the inputs')
  const duration = Math.max(0, ...infos.map(info => info.duration ?? 0)) || null
  const inputs = growing === undefined ? files : files.map((_, n) => `pipe:${n + 3}`)
  const args = hlsArgs(plan, inputs, dir, { maxHeight, threads })
  const playlist = join(dir, PLAYLIST)
  const child = spawn('nice', ['-n', '10', ffmpeg, '-hide_banner', '-loglevel', 'error', '-nostdin', ...args], {
    stdio: ['ignore', 'ignore', 'pipe', ...(growing === undefined ? [] : files.map(() => 'pipe'))],
    signal,
  })
  if (growing !== undefined) {
    files.forEach((file, n) => {
      const pipe = child.stdio[n + 3]
      pipe.on('error', () => {})
      const feed = Readable.from(follow(file, ended, { signal }))
      feed.on('error', () => pipe.destroy())
      feed.pipe(pipe)
    })
  }
  let errors = ''
  child.stderr.on('data', (chunk) => { errors = (errors + chunk).slice(-4000) })
  const exited = new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('close', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}: ${errors.trim().split('\n').pop() ?? ''}`))))
  })
  const running = settledFlag(exited)
  let told = false
  while (!running.done && !told) {
    if (playable(await readFile(playlist, 'utf8').catch(() => ''))) {
      told = true
      onReady?.({ playlist, duration })
    } else {
      await sleep(POLL_MS)
    }
  }
  await exited
  if (!told) onReady?.({ playlist, duration })
  return { playlist, duration }
}

/**
 * Episodes a source is still fetching, played while they grow: one HLS copy, made in `cacheDir` with its subtitles
 * turned into WebVTT beside it, for each such episode a room is on. A source hands over an episode's growing files
 * when its download starts (`offer`); they are kept until it ends, so a room arriving later still plays it at once.
 * `update` follows the rooms (src/preparing.js): a copy starts when a room is on its episode and stops when no room
 * is on it or just before it.
 * @param {object} options
 * @param {string} options.cacheDir
 * @param {{ ffmpeg: string, ffprobe: string, maxHeight: number, threads: number }} options.tools
 * @param {() => Map<string, number>} options.need - how much the rooms need each episode, by `streamKey`
 * @param {(show: string, number: number, prepared: { file: string, kind: 'hls', duration: number | null, subtitles: { file: string, label: string }[] }) => void} options.ready - it can be played
 * @param {(show: string, number: number) => void} options.lost - its copy stopped before it was complete
 * @param {(source: string, dir: string, name: string) => Promise<string>} options.convert - a subtitle file to WebVTT in `dir`
 * @param {{ warn: Function }} options.logger
 */
export function createStreams({ cacheDir, tools, need, ready, lost, logger, convert }) {
  /** By `streamKey`: the episode's growing files, and its copy while one is made. */
  const episodes = new Map()
  const forget = (key, entry) => { if (episodes.get(key) === entry) episodes.delete(key) }

  function start(key, entry) {
    const { show, number, partial: { files, subtitles = [], growing } } = entry
    const controller = new AbortController()
    const dir = join(cacheDir, `stream-${createHash('sha256').update(`${key}\0${Date.now()}`).digest('hex').slice(0, 20)}`)
    entry.controller = controller
    entry.prepared = null
    streamEpisode({
      files, growing, dir, ...tools, signal: controller.signal,
      onReady: async ({ playlist, duration }) => {
        const converted = []
        for (const [n, sub] of subtitles.entries()) {
          try {
            converted.push({ file: await convert(sub.path, dir, `external-${n}`), label: sub.label })
          } catch {
            // An unreadable subtitle file must not stop the episode.
          }
        }
        if (controller.signal.aborted) return
        entry.prepared = { file: playlist, kind: 'hls', duration, subtitles: converted }
        ready(show, number, entry.prepared)
      },
    }).then(() => {
      // Complete: the rooms keep playing it; nothing is left to follow.
      forget(key, entry)
    }, (error) => {
      // A copy that cannot be made is not tried again: the rooms play the file once it lands.
      if (!controller.signal.aborted) {
        logger.warn('could not play %s episode %d while it downloads: %s', show, number, error.message)
        entry.failed = true
      }
      entry.controller = null
      entry.prepared = null
      if (entry.ended || entry.failed) forget(key, entry)
      lost(show, number)
    })
  }

  function update() {
    const wanted = need()
    for (const [key, entry] of episodes) {
      const rank = wanted.get(key)
      if (rank === undefined) entry.controller?.abort('left')
      else if (rank === 0 && entry.controller === null && !entry.ended) start(key, entry)
      else if (rank === 0 && entry.prepared !== null) ready(entry.show, entry.number, entry.prepared)
    }
  }

  return {
    /**
     * An episode's files while its download goes on (a source's `onPartial`).
     * @param {{ files: string[], subtitles: { path: string, label: string }[], growing: Promise<unknown> }} partial
     */
    offer(show, number, partial) {
      const key = streamKey(show, number)
      episodes.get(key)?.controller?.abort('replaced')
      const entry = { show, number, partial, controller: null, prepared: null, ended: false, failed: false }
      episodes.set(key, entry)
      Promise.resolve(partial.growing).catch(() => {}).finally(() => {
        entry.ended = true
        if (entry.controller === null) forget(key, entry)
      })
      update()
    },

    update,

    stop() {
      for (const entry of episodes.values()) entry.controller?.abort('stop')
    },
  }
}

/** What identifies an episode of a show for `createStreams`. */
export const streamKey = (show, number) => `${show}\0${number}`
