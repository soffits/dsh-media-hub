#!/usr/bin/env node
/**
 * A stand-in ffmpeg for an encode that takes long: it writes an HLS playlist that is playable at once, then holds
 * until it is stopped. Each start and stop is a line `start <input>` / `stop <input>` in $HELD_FFMPEG_LOG.
 */
import { appendFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'

const args = process.argv.slice(2)
const input = basename(args[args.indexOf('-i') + 1])
const log = line => appendFileSync(process.env.HELD_FFMPEG_LOG, `${line} ${input}\n`)
log('start')
const segments = [0, 1, 2].map(n => `#EXTINF:4.0,\n${String(n).padStart(5, '0')}.m4s\n`).join('')
writeFileSync(args.at(-1), `#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-TARGETDURATION:4\n#EXT-X-PLAYLIST-TYPE:EVENT\n${segments}`)
process.on('SIGTERM', () => {
  log('stop')
  process.exit(143)
})
setInterval(() => {}, 1000)
