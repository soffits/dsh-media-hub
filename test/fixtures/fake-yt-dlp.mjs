#!/usr/bin/env node
/**
 * A stand-in yt-dlp for tests, with no network. `-J` answers what the real
 * yt-dlp answered for a video and for a playlist (recorded in yt-dlp/, cut
 * down): an address with `list=` is the playlist, one with `fail` an error,
 * anything else the video. A download writes a few bytes per playlist item
 * under the `-o` name into the `-P home:` folder and prints the `--print`
 * templates as yt-dlp would; FAKE_YTDLP_FAIL=N makes item N fail. Every run
 * is appended to FAKE_YTDLP_LOG (when set) as one JSON array of arguments.
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
if (process.env.FAKE_YTDLP_LOG) appendFileSync(process.env.FAKE_YTDLP_LOG, `${JSON.stringify(args)}\n`)

const url = args[args.length - 1]
const value = name => args[args.indexOf(name) + 1]
const values = name => args.flatMap((arg, n) => (arg === name ? [args[n + 1]] : []))
const recorded = name => JSON.parse(readFileSync(new URL(`./yt-dlp/${name}.json`, import.meta.url), 'utf8'))

if (url.includes('fail')) {
  process.stderr.write(`ERROR: [generic] Unsupported URL: ${url}\n`)
  process.exit(1)
}
const data = url.includes('list=') ? recorded('playlist') : recorded('video')

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

mkdirSync(home, { recursive: true })
let failed = false
for (let index = playlist ? from : 1; index <= (playlist ? Math.min(to, items.length) : 1); index++) {
  const fields = { index, title: items[index - 1].title, ext }
  announce('before_dl')(fields)
  if (Number(process.env.FAKE_YTDLP_FAIL) === index) {
    process.stderr.write(`ERROR: [youtube] item ${index}: Video unavailable\n`)
    failed = true
    continue
  }
  writeFileSync(join(home, fill(value('-o'), fields)), `episode ${index}`)
  announce('after_move')(fields)
}
process.exit(failed ? 1 : 0)
