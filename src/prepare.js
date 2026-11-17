/**
 * Getting one episode ready for browsers: a fast-start MP4 (remuxed or
 * transcoded when needed) and WebVTT subtitles, cached by the source file's
 * path, size and modification time so a second room reuses the work.
 *
 * ffmpeg runs one job at a time, at low CPU priority with few threads, so
 * preparing a series never starves the machine DSH runs on.
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { isFastStart, isTextSubtitle, planVideo, probe } from './library.js'
import { decodeText, isVtt, srtToVtt } from './subtitles.js'

/**
 * @typedef {object} PrepareOptions
 * @property {string} cacheDir
 * @property {string} [ffmpeg]
 * @property {string} [ffprobe]
 * @property {number} [maxHeight]
 * @property {number} [threads]
 */

/** Cache folder of one source file. */
export async function cacheKey(path) {
  const info = await stat(path)
  return createHash('sha256').update(`${path}\0${info.size}\0${info.mtimeMs}`).digest('hex').slice(0, 20)
}

/** Bytes of the prepared copy of one source file (0 when it has none). */
export async function preparedBytes(cacheDir, path) {
  const key = await cacheKey(path).catch(() => null)
  if (key === null) return 0
  let total = 0
  for (const name of await readdir(join(cacheDir, key)).catch(() => [])) total += (await stat(join(cacheDir, key, name)).catch(() => null))?.size ?? 0
  return total
}

/** Delete the prepared copy of one source file. */
export async function dropPrepared(cacheDir, path) {
  const key = await cacheKey(path).catch(() => null)
  if (key !== null) await rm(join(cacheDir, key), { recursive: true, force: true })
}

/** A promise queue: jobs run one after another. */
export function createQueue() {
  let tail = Promise.resolve()
  return job => {
    const result = tail.then(job, job)
    tail = result.catch(() => {})
    return result
  }
}

/**
 * Run ffmpeg, reporting progress as a fraction of `duration`.
 * @param {string[]} args
 * @param {{ ffmpeg: string, duration: number | null, onProgress?: (fraction: number) => void, signal?: AbortSignal }} options
 */
export function runFfmpeg(args, { ffmpeg, duration, onProgress, signal }) {
  return new Promise((resolve, reject) => {
    const child = spawn('nice', ['-n', '10', ffmpeg, '-hide_banner', '-loglevel', 'error', '-nostdin', '-progress', 'pipe:1', ...args], { stdio: ['ignore', 'pipe', 'pipe'], signal })
    let errors = ''
    child.stderr.on('data', (chunk) => { errors = (errors + chunk).slice(-4000) })
    child.stdout.on('data', (chunk) => {
      const match = /out_time_us=(\d+)/.exec(String(chunk))
      if (match && duration && onProgress) onProgress(Math.min(1, Number(match[1]) / 1e6 / duration))
    })
    child.on('error', reject)
    child.on('close', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}: ${errors.trim().split('\n').pop() ?? ''}`))))
  })
}

/** ffmpeg arguments that turn `input` into a browser-ready MP4 at `output`. */
export function videoArgs(plan, input, output, { maxHeight = 1080, threads = 2 } = {}) {
  const common = ['-y', '-i', input, '-map', '0:V:0?', '-map', '0:a:0?', '-sn', '-dn']
  const tail = ['-movflags', '+faststart', '-f', 'mp4', output]
  if (plan === 'remux') return [...common, '-c', 'copy', ...tail]
  return [
    ...common,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p',
    '-vf', `scale=-2:'min(ih,${maxHeight})'`,
    '-c:a', 'aac', '-b:a', '160k', '-ac', '2',
    '-threads', String(threads),
    ...tail,
  ]
}

/** Write a file through a temporary name, so a cut-off run never leaves a half file under the real name. */
async function writeAtomic(path, data) {
  await writeFile(`${path}.part`, data)
  await rename(`${path}.part`, path)
}

const exists = path => stat(path).then(() => true, () => false)

/**
 * One external subtitle file to WebVTT in `dir`.
 * @returns {Promise<string>} the .vtt path
 */
export async function convertSubtitle(source, dir, name, { ffmpeg = 'ffmpeg' } = {}) {
  const out = join(dir, `${name}.vtt`)
  if (await exists(out)) return out
  const text = decodeText(await readFile(source))
  const ext = extname(source).toLowerCase()
  if (ext === '.srt') await writeAtomic(out, srtToVtt(text))
  else if (ext === '.vtt' || isVtt(text)) await writeAtomic(out, text)
  else {
    // ASS/SSA: hand ffmpeg a UTF-8 copy, since it assumes UTF-8.
    const utf8 = join(dir, `${name}.utf8${ext}`)
    await writeFile(utf8, text)
    try {
      await runFfmpeg(['-y', '-i', utf8, '-f', 'webvtt', `${out}.part`], { ffmpeg, duration: null })
      await rename(`${out}.part`, out)
    } finally {
      await rm(utf8, { force: true })
    }
  }
  return out
}

/**
 * Prepare one episode.
 * @param {{ title: string, path: string, subtitles: { path: string, label: string }[] }} episode
 * @param {PrepareOptions & { onProgress?: (fraction: number) => void }} options
 * @returns {Promise<{ file: string, kind: 'file' | 'hls', duration: number | null, plan: string, subtitles: { file: string, label: string }[] }>}
 */
export async function prepareEpisode(episode, options) {
  const { cacheDir, ffmpeg = 'ffmpeg', ffprobe = 'ffprobe', maxHeight = 1080, threads = 2, onProgress } = options
  if (extname(episode.path).toLowerCase() === '.m3u8') {
    return { file: episode.path, kind: 'hls', duration: null, plan: 'direct', subtitles: await externalSubtitles(episode, null, ffmpeg, cacheDir) }
  }
  const dir = join(cacheDir, await cacheKey(episode.path))
  await mkdir(dir, { recursive: true })
  const info = await probe(episode.path, { ffprobe })
  const mp4Family = ['.mp4', '.m4v', '.mov', '.m4a'].includes(extname(episode.path).toLowerCase())
  const plan = planVideo(episode.path, info, { fastStart: mp4Family ? await isFastStart(episode.path) : null, maxHeight })
  let file = episode.path
  if (plan !== 'direct') {
    file = join(dir, 'video.mp4')
    if (!(await exists(file))) {
      await runFfmpeg(videoArgs(plan, episode.path, `${file}.part`, { maxHeight, threads }), { ffmpeg, duration: info.duration, onProgress })
      await rename(`${file}.part`, file)
    }
  }
  const subtitles = await externalSubtitles(episode, dir, ffmpeg, cacheDir)
  for (const stream of info.subtitles.filter(s => isTextSubtitle(s.codec))) {
    const out = join(dir, `embedded-${stream.index}.vtt`)
    if (!(await exists(out))) {
      try {
        await runFfmpeg(['-y', '-i', episode.path, '-map', `0:s:${stream.index}`, '-f', 'webvtt', `${out}.part`], { ffmpeg, duration: null })
        await rename(`${out}.part`, out)
      } catch {
        continue
      }
    }
    subtitles.push({ file: out, label: stream.title || stream.language || `Track ${stream.index + 1}` })
  }
  return { file, kind: 'file', duration: info.duration, plan, subtitles }
}

async function externalSubtitles(episode, dir, ffmpeg, cacheDir) {
  if (episode.subtitles.length === 0) return []
  const target = dir ?? join(cacheDir, await cacheKey(episode.path))
  await mkdir(target, { recursive: true })
  const out = []
  for (const [n, sub] of episode.subtitles.entries()) {
    try {
      out.push({ file: await convertSubtitle(sub.path, target, `external-${n}`, { ffmpeg }), label: sub.label || 'Subtitles' })
    } catch {
      // An unreadable subtitle file must not stop the episode.
    }
  }
  return out
}

/**
 * Delete cache folders no file in `used` lives in, untouched for `days`.
 * @param {string} cacheDir
 * @param {(string | undefined)[]} used - prepared files rooms still play
 */
export async function pruneCache(cacheDir, used, days, now = Date.now()) {
  const keep = new Set(used.filter(file => typeof file === 'string' && file.startsWith(`${cacheDir}/`)).map(file => file.slice(cacheDir.length + 1).split('/')[0]))
  for (const name of await readdir(cacheDir).catch(() => [])) {
    if (keep.has(name)) continue
    const info = await stat(join(cacheDir, name)).catch(() => null)
    if (info !== null && now - info.mtimeMs > days * 86_400_000) await rm(join(cacheDir, name), { recursive: true, force: true })
  }
}
