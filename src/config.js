import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import z from '@deepseek-ai/schemastery'
import { DELIVERY_MODES } from './delivery.js'
import { PROXY_URL } from './proxy.js'
import { FILTERS } from './sources/command.js'
import { MEDIA } from './sources/index.js'

const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')

/**
 * Where the plugin keeps rooms, the library, shelves and prepared media by default: `media-hub` in DSH's home, or
 * the `videosync` folder of an earlier Video Sync install when only that one exists. Its shows and watch log name
 * their files by absolute path, so that folder is used where it is rather than moved.
 */
export function defaultStateDir(home = DSH_HOME, exists = existsSync) {
  const current = join(home, 'media-hub')
  const earlier = join(home, 'videosync')
  return !exists(current) && exists(earlier) ? earlier : current
}

export const DEFAULT_STATE_DIR = defaultStateDir()

/** A name shown to people: one string, or `{ <tag>: text }` with a text per language, picked for the viewer (src/i18n.js). */
const Label = z.union([z.string(), z.dict(z.string())])

const SourceConfig = z.object({
  id: z.string().pattern(/^[a-z0-9][a-z0-9_-]{0,31}$/)
    .description('Stable id, lowercase letters, digits, - and _. Names the source in URLs and saved downloads, and the folder the command runs in (stateDir/<id>). Not local, link or all.'),
  label: Label.default('')
    .description('Name on the source\'s tab: a string, or { <tag>: text } per language. Empty uses the page\'s own words for this source id (source.name.<id> in locale/), else the id.'),
  kinds: z.array(z.object({
    id: z.string().pattern(/^[a-z0-9][a-z0-9_-]{0,31}$/).description('What the command\'s search --kind takes.'),
    label: Label.default('').description('Name of the category chip: a string, or { <tag>: text } per language. Empty uses the page\'s own words for this kind id (kind.<id> in locale/), else the id.'),
    media: z.union(MEDIA.map(media => z.const(media))).default('video')
      .description('What a work of this kind is: video or audio (episodes, watched or listened to together in a room) or book (one file, downloaded in a format).'),
  })).description('What the source can search for; at least one.'),
  filters: z.array(z.union(FILTERS.map(filter => z.const(filter)))).default([])
    .description('Search filters the command understands (docs/source-protocol.md). The hub filters the answers by language, format, year and size itself as well.'),
  command: z.array(z.string()).min(1)
    .description('The command and its fixed arguments, one entry per word; the plugin adds the protocol verbs after them.'),
  env: z.dict(z.string()).default({})
    .description('Extra environment variables for the command.'),
})

const ProxyRule = z.object({
  url: z.string().pattern(PROXY_URL)
    .description('The proxy: socks5h://host:port (names resolved by the proxy), socks5://, socks4://, http:// or https://.'),
  hosts: z.array(z.string()).default([])
    .description('Hosts it carries: example.com (that host and every host under it), .example (every host ending so), * (every host).'),
  hostsFile: z.string().default('')
    .description('A file with more such patterns, one per line, # starting a comment; read again when it changes. While it cannot be read, requests fail instead of going direct.'),
})

/** Default sources, each hidden while its command is not installed: Fanqie (fanqie-cli) for short dramas, audiobooks and novels, and bookfetch (bookfetch-cli) for ebooks and papers. */
const DEFAULT_SOURCES = Object.freeze([
  {
    id: 'fanqie',
    kinds: [{ id: 'drama', media: 'video' }, { id: 'audio', media: 'audio' }, { id: 'novel', media: 'book' }],
    filters: [],
    command: ['fanqie'],
    env: {},
  },
  {
    id: 'bookfetch',
    kinds: [{ id: 'ebook', media: 'book' }, { id: 'paper', media: 'book' }],
    filters: ['language', 'format', 'year'],
    command: ['bookfetch', 'source'],
    env: {},
  },
])

export const Config = z.object({
  label: Label.default('')
    .description('Name of the sidebar entry: a string, or { <tag>: text } per language (the viewer\'s tag, then its primary subtag, then en). Empty uses the page\'s own name in the viewer\'s language.'),
  libraryRoots: z.array(z.string()).default([])
    .description('Folders whose videos and episode folders anyone signed in may start a room from in the panel. The "library" folder inside the state folder is always included. The assistant's tool can open any path.'),
  delivery: z.union(DELIVERY_MODES.map(mode => z.const(mode))).default('origin')
    .description('Where viewers load local media from. origin: DSH\'s own web server (through whatever sits in front of DSH). r2: object storage with signed links (not built yet).'),
  stateDir: z.string().default(DEFAULT_STATE_DIR)
    .description('Folder for open rooms (rooms.json), the default library folder (library, where downloads go), prepared media (cache), the watch log (watch-log.jsonl) and library notes (shows.json, downloads.json).'),
  maxHeight: z.natural().min(240).default(1080)
    .description('Videos taller than this, or in codecs browsers cannot play, are transcoded to H.264 at this height.'),
  threads: z.natural().min(1).default(2)
    .description('ffmpeg threads for transcoding. Jobs run one at a time at low priority.'),
  emptyMinutes: z.natural().min(1).default(30)
    .description('A room closes this many minutes after its last viewer left.'),
  unopenedHours: z.natural().min(1).default(24)
    .description('A room nobody has opened yet closes this many hours after it was created, so a link sent ahead of time still works.'),
  cacheDays: z.natural().min(1).default(7)
    .description('Prepared media no open room uses is deleted after this many days.'),
  autoDeleteDays: z.natural().default(7)
    .description('A library show is deleted this many days after it was watched to the end (its last episode, or every episode), unless someone keeps it. 0 never deletes.'),
  cacheAhead: z.natural().default(5)
    .description('Rolling cache: how many episodes after the one being watched are kept on disk for a show from a source. The episode being watched is fetched first, then these in order.'),
  cacheBehind: z.natural().default(1)
    .description('Rolling cache: how many watched episodes before the current one stay on disk. Older watched episodes are deleted (the watch log still marks them watched).'),
  cacheLimitGb: z.number().min(0).default(5)
    .description('Rolling cache: the most disk, in GB, that cached episodes of shows from a source may use. Past it the least recently watched go first, never one near where a room is. Shows kept offline do not count. 0 means no limit.'),
  sources: z.array(SourceConfig).default(DEFAULT_SOURCES.map(source => ({ ...source, kinds: [...source.kinds], filters: [...source.filters], command: [...source.command] })))
    .description('Where the search box looks for shows and the library downloads them from. Each source is a command line tool that speaks the JSON protocol in docs/source-protocol.md; every request goes through that command, so a launcher that routes it through a proxy keeps that rule. A source is hidden while its command is not installed. The list replaces the default, so keep the default entry when adding another.'),
  coverCacheMb: z.number().min(0).default(50)
    .description('The most disk, in MB, that search result covers may use (stateDir/covers). Past it the least recently shown go. 0 means no limit.'),
  bookCacheGb: z.number().min(0).default(5)
    .description('The most disk, in GB, that downloaded books may use (stateDir/books). Past it the least recently used files go; they stay on their shelves and can be downloaded again. 0 means no limit.'),
  converter: z.string().default('ebook-convert')
    .description('Calibre\'s ebook-convert command. When it is installed, books can be downloaded in formats their source does not have (converted from the best one it has). Empty turns conversion off.'),
  notifyCommand: z.array(z.string()).default([])
    .description('A command (program and fixed arguments) run when a followed work gets a new season or new episodes, with one line of JSON describing it on its standard input. Empty means nothing is run.'),
  ffmpeg: z.string().default('ffmpeg').description('ffmpeg command.'),
  ffprobe: z.string().default('ffprobe').description('ffprobe command.'),
  ytDlp: z.string().default('yt-dlp')
    .description('yt-dlp command. Link reads and downloads web videos and playlists with it; without it Link is hidden. Its own config file (cookies, for example) applies.'),
  proxies: z.array(ProxyRule).default([])
    .description('Which proxy each outbound request takes, by host: the first rule naming the host wins, any other host goes direct. Applies to every yt-dlp call (by the page\'s host) and every picture the hub fetches itself. Sources\' commands keep their own network setup.'),
})
