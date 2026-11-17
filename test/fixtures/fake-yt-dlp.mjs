#!/usr/bin/env node
/**
 * A stand-in yt-dlp for tests, with no network. `-J` answers what the real
 * yt-dlp answered for a video, a video with subtitles and a playlist
 * (recorded in yt-dlp/, cut down): an address with `list=` is the playlist,
 * one with `captioned` the video with subtitles, one with `fail` an
 * unsupported address, anything else the video; FAKE_YTDLP_ERROR=<name>
 * fails with the recorded error of that name (yt-dlp/errors.json). Without
 * `--flat-playlist`, `-J` answers for the one item `--playlist-items` names,
 * with the formats chosen for it (a video and an audio file, or the audio
 * alone for `-f ba/b`); FAKE_YTDLP_FAIL=N makes item N unavailable. With
 * `--load-info-json`, `--skip-download` writes a WebVTT file per caption
 * asked for that the document lists, and `-f <id>` writes that format under
 * the `-o` name (a copy of FAKE_YTDLP_SAMPLE, or a few bytes), printing the
 * progress lines a real run printed for it (yt-dlp/download.jsonl) when given
 * a progress template. Every run is appended to FAKE_YTDLP_LOG (when set) as
 * one JSON array of arguments; the text of the `--cookies` file a run was
 * given goes to FAKE_YTDLP_COOKIES (when set).
 */
import { appendFileSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
if (process.env.FAKE_YTDLP_LOG) appendFileSync(process.env.FAKE_YTDLP_LOG, `${JSON.stringify(args)}\n`)

const value = name => args[args.indexOf(name) + 1]
const recorded = name => JSON.parse(readFileSync(new URL(`./yt-dlp/${name}.json`, import.meta.url), 'utf8'))

if (process.env.FAKE_YTDLP_COOKIES && args.includes('--cookies')) writeFileSync(process.env.FAKE_YTDLP_COOKIES, readFileSync(value('--cookies')))
if (process.env.FAKE_YTDLP_ERROR) {
  process.stderr.write(`${recorded('errors')[process.env.FAKE_YTDLP_ERROR]}\n`)
  process.exit(1)
}

/** The progress lines a real run printed, one file after the other (the formats and their sizes come from it too). */
const lines = readFileSync(new URL('./yt-dlp/download.jsonl', import.meta.url), 'utf8').trim().split('\n').map(line => JSON.parse(line))
const sizes = Object.fromEntries(lines.filter(line => line.event === 'progress' && line.format !== '').map(line => [line.format, line.total]))
const VIDEO = { format_id: '160', ext: 'mp4', vcodec: 'avc1.4D400B', acodec: 'none', filesize: sizes['160'] }
const AUDIO = { format_id: '140', ext: 'm4a', vcodec: 'none', acodec: 'mp4a.40.2', filesize: sizes['140'] }

if (args.includes('--load-info-json')) {
  const entry = JSON.parse(readFileSync(value('--load-info-json'), 'utf8'))
  const output = value('-o')
  if (args.includes('--skip-download')) {
    const listed = [...Object.keys(entry.subtitles ?? {}), ...Object.keys(entry.automatic_captions ?? {})]
    const patterns = value('--sub-langs').split(',').map(pattern => new RegExp(`${pattern}$`))
    for (const tag of new Set(listed.filter(tag => patterns.some(pattern => pattern.test(tag))))) writeFileSync(`${output}.${tag}.vtt`, `WEBVTT\n\n00:00.000 --> 00:01.000\n${tag}\n`)
    process.exit(0)
  }
  const format = entry.requested_formats.find(entry => entry.format_id === value('-f'))
  if (args.includes('--progress-template')) for (const line of lines) if (line.format === format.format_id) process.stdout.write(`${JSON.stringify(line)}\n`)
  const file = output.replace('%(ext)s', args.includes('-x') ? 'm4a' : format.ext)
  if (process.env.FAKE_YTDLP_SAMPLE) copyFileSync(process.env.FAKE_YTDLP_SAMPLE, file)
  else writeFileSync(file, `format ${format.format_id}`)
  process.exit(0)
}

const url = args[args.length - 1]
if (url.includes('fail')) {
  process.stderr.write(`ERROR: [generic] Unsupported URL: ${url}\n`)
  process.exit(1)
}
const data = url.includes('list=') ? recorded('playlist') : url.includes('captioned') ? recorded('captioned') : recorded('video')

if (args.includes('--flat-playlist')) {
  process.stdout.write(JSON.stringify(data))
  process.exit(0)
}

const number = Number(value('--playlist-items'))
if (Number(process.env.FAKE_YTDLP_FAIL) === number) {
  process.stderr.write(`ERROR: [youtube] item ${number}: Video unavailable\n`)
  process.exit(1)
}
const requested_formats = value('-f') === 'ba/b' ? [AUDIO] : [VIDEO, AUDIO]
if (data._type === 'playlist') process.stdout.write(JSON.stringify({ ...data, entries: [{ ...data.entries[number - 1], _type: 'video', requested_formats }] }))
else process.stdout.write(JSON.stringify({ ...data, requested_formats }))
