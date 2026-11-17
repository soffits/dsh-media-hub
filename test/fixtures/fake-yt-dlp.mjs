#!/usr/bin/env node
/**
 * A stand-in yt-dlp for tests, with no network. `-J` answers what the real
 * yt-dlp answered for a video, a video with subtitles and a playlist
 * (recorded in yt-dlp/, cut down): an address with `list=` is the playlist,
 * one with `captioned` the video with subtitles, one with `fail` an
 * unsupported address, anything else the video; FAKE_YTDLP_ERROR=<name>
 * fails with the recorded error of that name (yt-dlp/errors.json). A
 * download writes a copy of FAKE_YTDLP_SAMPLE (or a few bytes) per playlist
 * item under the `-o` name into the `-P home:` folder, a WebVTT file for each
 * subtitle language asked for that the document lists, and prints the
 * `--print` templates as yt-dlp would; with a progress template it prints the
 * progress lines a real run printed (yt-dlp/download.jsonl) instead.
 * FAKE_YTDLP_FAIL=N makes item N fail. Every run is appended to
 * FAKE_YTDLP_LOG (when set) as one JSON array of arguments; the text of the
 * `--cookies` file a run was given goes to FAKE_YTDLP_COOKIES (when set).
 */
import { appendFileSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
if (process.env.FAKE_YTDLP_LOG) appendFileSync(process.env.FAKE_YTDLP_LOG, `${JSON.stringify(args)}\n`)

const url = args[args.length - 1]
const value = name => args[args.indexOf(name) + 1]
const values = name => args.flatMap((arg, n) => (arg === name ? [args[n + 1]] : []))
const recorded = name => JSON.parse(readFileSync(new URL(`./yt-dlp/${name}.json`, import.meta.url), 'utf8'))

if (process.env.FAKE_YTDLP_COOKIES && args.includes('--cookies')) writeFileSync(process.env.FAKE_YTDLP_COOKIES, readFileSync(value('--cookies')))
if (process.env.FAKE_YTDLP_ERROR) {
  process.stderr.write(`${recorded('errors')[process.env.FAKE_YTDLP_ERROR]}\n`)
  process.exit(1)
}
if (url.includes('fail')) {
  process.stderr.write(`ERROR: [generic] Unsupported URL: ${url}\n`)
  process.exit(1)
}
const data = url.includes('list=') ? recorded('playlist') : url.includes('captioned') ? recorded('captioned') : recorded('video')

if (args.includes('-J')) {
  process.stdout.write(JSON.stringify(data))
  process.exit(0)
}

/** yt-dlp's template fields this stand-in fills: `%(playlist_index|1)03d`, `%(playlist_index|1)s`, `%(title).100B`, `%(ext)s`. */
const fill = (template, fields) => template
  .replace(/%\(playlist_index\|1\)(0?\d*)d/g, (_, width) => String(fields.index).padStart(Number(width) || 0, '0'))
  .replace(/%\(playlist_index\|1\)s/g, String(fields.index))
  .replace(/%\(title\)\.\d+B/g, fields.title.replace(/\//g, '_'))
  .replace(/%\(ext\)s/g, fields.ext)

const playlist = data._type === 'playlist'
const items = playlist ? data.entries : [data]
const [from, to] = value('--playlist-items').split(':').map(Number)
const home = value('-P').replace(/^home:/, '')
const ext = args.includes('-x') ? 'm4a' : 'mp4'
const prints = values('--print').map(spec => spec.split(/:(.*)/s))
const announce = stage => fields => prints.filter(([when]) => when === stage).forEach(([, template]) => process.stdout.write(`${fill(template, fields)}\n`))
/** A real run's lines (subtitle fetches, the episode's start with its formats, each file's progress), numbered for this item. */
const replay = index => readFileSync(new URL('./yt-dlp/download.jsonl', import.meta.url), 'utf8').trim().split('\n')
  .filter(line => !line.includes('"done"'))
  .forEach(line => process.stdout.write(`${line.replace(/"number":\d+/, `"number":${index}`)}\n`))
const progressing = args.includes('--progress-template')
/** `--sub-langs` as yt-dlp reads it: comma-separated regular expressions, matched against the listed languages. */
const subtitleTags = (item) => {
  if (!args.includes('--write-subs')) return []
  const listed = [...Object.keys(item.subtitles ?? {}), ...Object.keys(item.automatic_captions ?? {})]
  const patterns = value('--sub-langs').split(',').map(pattern => new RegExp(`${pattern}$`))
  return [...new Set(listed.filter(tag => patterns.some(pattern => pattern.test(tag))))]
}

mkdirSync(home, { recursive: true })
let failed = false
for (let index = playlist ? from : 1; index <= (playlist ? Math.min(to, items.length) : 1); index++) {
  const fields = { index, title: items[index - 1].title, ext }
  const stem = fill(value('-o'), fields).replace(/\.[^.]+$/, '')
  for (const tag of subtitleTags(items[index - 1])) writeFileSync(join(home, `${stem}.${tag}.vtt`), `WEBVTT\n\n00:00.000 --> 00:01.000\n${tag}\n`)
  if (progressing) replay(index)
  else announce('before_dl')(fields)
  if (Number(process.env.FAKE_YTDLP_FAIL) === index) {
    process.stderr.write(`ERROR: [youtube] item ${index}: Video unavailable\n`)
    failed = true
    continue
  }
  const file = join(home, fill(value('-o'), fields))
  if (process.env.FAKE_YTDLP_SAMPLE) copyFileSync(process.env.FAKE_YTDLP_SAMPLE, file)
  else writeFileSync(file, `episode ${index}`)
  announce('after_move')(fields)
}
process.exit(failed ? 1 : 0)
