/**
 * Turning a local path into a room's episodes: which files are videos, in
 * which order, which subtitles belong to each, and what each video needs
 * before a browser can play and seek it.
 */
import { open, readdir, stat } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

export const VIDEO_EXTENSIONS = Object.freeze(['.mp4', '.m4v', '.mov', '.webm', '.mkv', '.ts', '.avi', '.flv', '.m3u8'])
/** Audio-only episodes (audiobook chapters); they play in the same player, without a picture. */
export const AUDIO_EXTENSIONS = Object.freeze(['.m4a', '.mp3', '.aac'])
export const SUBTITLE_EXTENSIONS = Object.freeze(['.vtt', '.srt', '.ass', '.ssa'])

/** Codecs every current browser decodes, by container family. */
const BROWSER_VIDEO = new Set(['h264', 'vp8', 'vp9', 'av1'])
const BROWSER_AUDIO = new Set(['aac', 'mp3', 'opus', 'vorbis'])
/** Containers served as they are when their codecs fit. */
const DIRECT_CONTAINERS = new Set(['.mp4', '.m4v', '.mov', '.webm'])

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

const extOf = name => extname(name).toLowerCase()
export const isVideo = name => VIDEO_EXTENSIONS.includes(extOf(name))
export const isAudio = name => AUDIO_EXTENSIONS.includes(extOf(name))
/** Files a room can play as an episode. */
export const isMedia = name => !name.startsWith('.') && (isVideo(name) || isAudio(name))
export const isSubtitle = name => SUBTITLE_EXTENSIONS.includes(extOf(name))

/** Natural order: "2" before "10", case and width folded. */
export function naturalSort(names) {
  return [...names].sort(collator.compare)
}

/**
 * The subtitles in `names` that belong to the video `video`: same base
 * name, optionally followed by a language or label (`ep1.zh.srt`).
 * @returns {{ name: string, label: string }[]}
 */
export function matchSubtitles(video, names) {
  const stem = basename(video, extname(video))
  const found = []
  for (const name of naturalSort(names)) {
    if (!isSubtitle(name)) continue
    const subStem = basename(name, extname(name))
    if (subStem === stem) found.push({ name, label: '' })
    else if (subStem.startsWith(`${stem}.`)) found.push({ name, label: subStem.slice(stem.length + 1) })
  }
  return found
}

/** A title from a file name: the name without its extension. */
export const titleOf = file => basename(file, extname(file))

/**
 * Episodes at a path: one file, or every video or audio file in a folder (not nested),
 * in natural order. HLS playlists count as one video each.
 * @param {string} path - absolute
 * @returns {Promise<{ title: string, path: string, subtitles: { path: string, label: string }[] }[]>}
 */
export async function scanSource(path) {
  const info = await stat(path)
  const folder = info.isDirectory() ? path : dirname(path)
  const names = await readdir(folder)
  const videos = info.isDirectory() ? naturalSort(names.filter(isMedia)) : [basename(path)]
  if (videos.length === 0) throw Object.assign(new Error(`no video or audio files in ${path}`), { code: 'empty' })
  return videos.map(name => ({
    title: titleOf(name),
    path: join(folder, name),
    subtitles: matchSubtitles(name, names).map(sub => ({ path: join(folder, sub.name), label: sub.label })),
  }))
}

/**
 * What ffprobe says about a file.
 * @returns {Promise<{ duration: number | null, video: string | null, audio: string | null, height: number | null, subtitles: { index: number, codec: string, language: string, title: string }[] }>}
 */
export async function probe(path, { ffprobe = 'ffprobe' } = {}) {
  const { stdout } = await run(ffprobe, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path], { maxBuffer: 8 * 1024 * 1024 })
  const data = JSON.parse(stdout)
  const streams = data.streams ?? []
  const video = streams.find(s => s.codec_type === 'video' && s.disposition?.attached_pic !== 1)
  const audio = streams.find(s => s.codec_type === 'audio')
  const duration = Number.parseFloat(data.format?.duration)
  return {
    duration: Number.isFinite(duration) ? duration : null,
    video: video?.codec_name ?? null,
    audio: audio?.codec_name ?? null,
    height: video?.height ?? null,
    subtitles: streams
      .filter(s => s.codec_type === 'subtitle')
      .map((s, n) => ({ index: n, codec: s.codec_name, language: s.tags?.language ?? '', title: s.tags?.title ?? '' })),
  }
}

/** Text subtitle codecs ffmpeg can turn into WebVTT. */
const TEXT_SUBTITLES = new Set(['subrip', 'ass', 'ssa', 'webvtt', 'mov_text', 'text'])
export const isTextSubtitle = codec => TEXT_SUBTITLES.has(codec)

/**
 * Whether an MP4-family file has its index (moov) before the media data, so
 * a browser can start and seek with Range requests without reading to the end.
 */
export async function isFastStart(path) {
  const handle = await open(path, 'r')
  try {
    const header = Buffer.alloc(16)
    let offset = 0
    const { size } = await handle.stat()
    while (offset + 8 <= size) {
      const { bytesRead } = await handle.read(header, 0, 16, offset)
      if (bytesRead < 8) return false
      let length = header.readUInt32BE(0)
      const type = header.toString('latin1', 4, 8)
      if (type === 'moov') return true
      if (type === 'mdat') return false
      if (length === 1) length = Number(header.readBigUInt64BE(8))
      else if (length === 0) return false
      if (length < 8) return false
      offset += length
    }
    return false
  } finally {
    await handle.close()
  }
}

/**
 * What a video needs before a browser plays it well.
 * - direct: served as it is
 * - remux: same streams into a fast-start MP4 (quick, no quality loss)
 * - transcode: H.264/AAC MP4, at most `maxHeight` lines
 * @param {string} path
 * @param {Awaited<ReturnType<typeof probe>>} info
 * @param {{ fastStart: boolean | null, maxHeight: number }} facts
 * @returns {'direct' | 'remux' | 'transcode'}
 */
export function planVideo(path, info, { fastStart, maxHeight }) {
  const ext = extOf(path)
  if (ext === '.m3u8') return 'direct'
  if (info.video === null && info.audio !== null) {
    if (!BROWSER_AUDIO.has(info.audio)) return 'transcode'
    if (ext === '.mp3' || ext === '.aac') return 'direct'
    return fastStart ? 'direct' : 'remux'
  }
  const videoOk = info.video !== null && BROWSER_VIDEO.has(info.video)
  const audioOk = info.audio === null || BROWSER_AUDIO.has(info.audio)
  if (!videoOk || !audioOk || (info.height ?? 0) > maxHeight) return 'transcode'
  if (ext === '.webm') return 'direct'
  if (!DIRECT_CONTAINERS.has(ext)) return info.video === 'h264' ? 'remux' : 'transcode'
  if (info.video !== 'h264' && info.video !== 'av1' && info.video !== 'vp9') return 'transcode'
  return fastStart ? 'direct' : 'remux'
}
