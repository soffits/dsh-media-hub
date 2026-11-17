/**
 * Getting one episode ready for browsers: a fast-start MP4 (remuxed when
 * needed), or HLS when it has to be transcoded, and WebVTT subtitles, cached
 * by the source file's path, size and modification time so a second room reuses the work.
 *
 * ffmpeg runs at low CPU priority with few threads, so preparing never
 * starves the machine DSH runs on; which episodes are prepared when is
 * src/preparing.js.
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { isFastStart, isTextSubtitle, planVideo, probe } from './library.js'
import { captionLanguage } from './captions.js'
import { finishedPlaylist, streamEpisode } from './stream.js'
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

/** ffmpeg arguments that put the streams of `input` into a fast-start MP4 at `output`, as they are. */
export const remuxArgs = (input, output) => ['-y', '-i', input, '-map', '0:V:0?', '-map', '0:a:0?', '-sn', '-dn', '-c', 'copy', '-movflags', '+faststart', '-f', 'mp4', output]

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
 * Prepare one episode. A video that needs transcoding becomes HLS, playable (`onReady`) after its first segments
 * while the rest is still being made; the promise settles when it is complete.
 * @param {{ title: string, path: string, subtitles: { path: string, label: string }[] }} episode
 * @param {PrepareOptions & { onProgress?: (fraction: number) => void, onReady?: (prepared: object) => void, signal?: AbortSignal }} options
 * @returns {Promise<{ file: string, kind: 'file' | 'hls', duration: number | null, plan: string, subtitles: { file: string, label: string }[] }>}
 */
export async function prepareEpisode(episode, options) {
  const { cacheDir, ffmpeg = 'ffmpeg', ffprobe = 'ffprobe', maxHeight = 1080, threads = 2, onProgress, onReady, signal } = options
  if (extname(episode.path).toLowerCase() === '.m3u8') {
    return { file: episode.path, kind: 'hls', duration: null, plan: 'direct', subtitles: await externalSubtitles(episode, null, ffmpeg, cacheDir) }
  }
  const dir = join(cacheDir, await cacheKey(episode.path))
  await mkdir(dir, { recursive: true })
  const info = await probe(episode.path, { ffprobe })
  const mp4Family = ['.mp4', '.m4v', '.mov', '.m4a'].includes(extname(episode.path).toLowerCase())
  const plan = planVideo(episode.path, info, { fastStart: mp4Family ? await isFastStart(episode.path) : null, maxHeight })
  const subtitles = await externalSubtitles(episode, dir, ffmpeg, cacheDir)
  await embeddedSubtitles(episode.path, info, dir, ffmpeg, subtitles)
  if (plan === 'transcode') {
    const hls = join(dir, 'hls')
    const prepared = file => ({ file, kind: 'hls', duration: info.duration, plan, subtitles })
    const done = await finishedPlaylist(hls)
    if (done !== null) return prepared(done)
    const { playlist } = await streamEpisode({ files: [episode.path], dir: hls, ffmpeg, ffprobe, maxHeight, threads, signal, onReady: ready => onReady?.(prepared(ready.playlist)) })
    return prepared(playlist)
  }
  let file = episode.path
  if (plan === 'remux') {
    file = join(dir, 'video.mp4')
    if (!(await exists(file))) {
      await runFfmpeg(remuxArgs(episode.path, `${file}.part`), { ffmpeg, duration: info.duration, onProgress, signal })
      await rename(`${file}.part`, file)
    }
  }
  return { file, kind: 'file', duration: info.duration, plan, subtitles }
}

/** The text subtitle streams inside a file, as WebVTT in `dir`, added to `subtitles` under the language they name. */
async function embeddedSubtitles(path, info, dir, ffmpeg, subtitles) {
  for (const stream of info.subtitles.filter(s => isTextSubtitle(s.codec))) {
    const out = join(dir, `embedded-${stream.index}.vtt`)
    if (!(await exists(out))) {
      try {
        await runFfmpeg(['-y', '-i', path, '-map', `0:s:${stream.index}`, '-f', 'webvtt', `${out}.part`], { ffmpeg, duration: null })
        await rename(`${out}.part`, out)
      } catch {
        continue
      }
    }
    subtitles.push({ file: out, label: captionLanguage(stream.language) !== null ? stream.language : stream.title || `Track ${stream.index + 1}` })
  }
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
