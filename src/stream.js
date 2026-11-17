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
 * Episodes a source is still fetching, played while they grow: one HLS copy per episode someone waits on, made in
 * `cacheDir`, with its subtitles turned into WebVTT beside it.
 * @param {object} options
 * @param {string} options.cacheDir
 * @param {{ ffmpeg: string, ffprobe: string, maxHeight: number, threads: number }} options.tools
 * @param {(show: string, number: number) => boolean} options.wanted - whether a room waits on the episode
 * @param {(show: string, number: number, prepared: { file: string, kind: 'hls', duration: number | null, subtitles: { file: string, label: string }[] }) => void} options.ready - it can be played
 * @param {(show: string, number: number) => void} options.lost - its copy broke off after it could be played
 * @param {(source: string, dir: string, name: string) => Promise<string>} options.convert - a subtitle file to WebVTT in `dir`
 * @param {{ warn: Function }} options.logger
 */
export function createStreams({ cacheDir, tools, wanted, ready, lost, logger, convert }) {
  const running = new Map()
  return {
    /** @param {{ files: string[], subtitles: { path: string, label: string }[], growing: Promise<unknown> }} partial */
    start(show, number, { files, subtitles = [], growing }) {
      const key = `${show}\0${number}`
      if (running.has(key) || !wanted(show, number)) return
      const dir = join(cacheDir, `stream-${createHash('sha256').update(`${key}\0${Date.now()}`).digest('hex').slice(0, 20)}`)
      let played = false
      const run = streamEpisode({
        files, growing, dir, ...tools,
        onReady: async ({ playlist, duration }) => {
          const converted = []
          for (const [n, sub] of subtitles.entries()) {
            try {
              converted.push({ file: await convert(sub.path, dir, `external-${n}`), label: sub.label })
            } catch {
              // An unreadable subtitle file must not stop the episode.
            }
          }
          played = true
          ready(show, number, { file: playlist, kind: 'hls', duration, subtitles: converted })
        },
      })
      running.set(key, run)
      run.catch((error) => {
        logger.warn('could not play %s episode %d while it downloads: %s', show, number, error.message)
        if (played) lost(show, number)
      }).finally(() => running.delete(key))
    },
  }
}
