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
    trending: z.boolean().default(false)
      .description('Whether the command\'s trending verb answers for this kind (docs/source-protocol.md): its rank lists and new arrivals, shown on Discover before a search.'),
  })).description('What the source can search for; at least one.'),
  filters: z.array(z.union(FILTERS.map(filter => z.const(filter)))).default([])
    .description('Search filters the command understands (docs/source-protocol.md). The hub filters the answers by language, format, year and size itself as well.'),
  command: z.array(z.string()).min(1)
    .description('The command and its fixed arguments, one entry per word; the plugin adds the protocol verbs after them.'),
  env: z.dict(z.string()).default({})
    .description('Extra environment variables for the command.'),
})

/** The hosts a per-host rule names; shared by `proxies` and `cookies` (src/hosts.js). */
const hostFields = () => ({
  hosts: z.array(z.string()).default([])
    .description('Hosts it applies to: example.com (that host and every host under it), .example (every host ending so), * (every host).'),
  hostsFile: z.string().default('')
    .description('A file with more such patterns, one per line, # starting a comment; read again when it changes. While it cannot be read, requests to any host fail instead of going without the rule.'),
})

const ProxyRule = z.object({
  url: z.string().pattern(PROXY_URL)
    .description('The proxy: socks5h://host:port (names resolved by the proxy), socks5://, socks4://, http:// or https://.'),
  ...hostFields(),
})

const CookieAccount = z.object({
  person: z.string().default('')
    .description('Whose account this is: their sign-in id (the id the sign-in plugin gives, such as an OpenID subject). Empty makes it the default account, used by anyone without one of their own.'),
  name: z.string().default('')
    .description('The name shown for this account when someone looks up a link (never the cookies).'),
  file: z.string()
    .description('A Netscape cookies file of a signed-in session, kept fresh by whatever holds that session. The hub only reads it: yt-dlp gets a private copy for each run, so nothing is written back.'),
  userAgent: z.string().default('')
    .description('The User-Agent of the session the cookies belong to, sent with them, so the site sees the same device. Empty keeps yt-dlp\'s own.'),
  share: z.boolean().default(false)
    .description('Whether other people\'s requests may use this account when they have none of their own (a room started by its owner always does).'),
})

const CookieRule = z.object({
  accounts: z.array(CookieAccount).default([])
    .description('The signed-in accounts for these hosts. A request uses its person\'s own account, else the default one, else a shared one, in this order.'),
  ...hostFields(),
})

/** Default sources, each hidden while its command is not installed: Fanqie (fanqie-cli) for short dramas, audiobooks and novels, and bookfetch (bookfetch-cli) for ebooks and papers. */
const DEFAULT_SOURCES = Object.freeze([
  {
    id: 'fanqie',
    kinds: [{ id: 'drama', media: 'video', trending: true }, { id: 'audio', media: 'audio' }, { id: 'novel', media: 'book', trending: true }],
    filters: [],
    command: ['fanqie'],
    env: {},
  },
  {
    id: 'bookfetch',
    kinds: [{ id: 'ebook', media: 'book', trending: true }, { id: 'paper', media: 'book' }],
    filters: ['language', 'format', 'year'],
    command: ['bookfetch', 'source'],
    env: {},
  },
])

const Presence = z.object({
  continue: z.boolean().default(true)
    .description('The Continue card at the top of Watching: the show someone is in or last watched, its episodes and joining it.'),
  recap: z.boolean().default(false)
    .description('"So far" on the Continue card: a summary without spoilers kept with the show, written from outside through the tool (annotate). Shown only to viewers past the episodes it covers.'),
  ratings: z.boolean().default(false)
    .description('"How was it?": asks once about a show watched to the end or removed in the last two weeks; one tap writes a rating line to the watch log.'),
  picks: z.boolean().default(false)
    .description('Picks: works the recommender command suggests, each with its reason, to watch together or follow. Needs `recommender`.'),
})

const Recommender = z.object({
  command: z.array(z.string()).default([])
    .description('A command speaking docs/recommender-protocol.md (program and fixed arguments, the plugin adds the verbs). Empty means no picks.'),
  env: z.dict(z.string()).default({})
    .description('Extra environment variables for the command.'),
})

const Clock = z.string().pattern(/^([01]?\d|2[0-3]):[0-5]\d$/)

const Points = z.object({
  command: z.array(z.string()).default([])
    .description('A points extension speaking docs/points-protocol.md (program and fixed arguments, the plugin adds the verbs). Empty means every extra is free.'),
  env: z.dict(z.string()).default({})
    .description('Extra environment variables for the command.'),
  night: z.object({
    from: Clock.default('01:00').description('When late night starts, on the host\'s clock (HH:MM).'),
    to: Clock.default('06:00').description('When it ends; a binge night ticket lasts until then.'),
  }).default({ from: '01:00', to: '06:00' })
    .description('Starting to watch in this window is a binge night for people the extension keeps points for.'),
})

export const Config = z.object({
  label: Label.default('')
    .description('Name of the sidebar entry: a string, or { <tag>: text } per language (the viewer\'s tag, then its primary subtag, then en). Empty uses the page\'s own name in the viewer\'s language.'),
  libraryRoots: z.array(z.string()).default([])
    .description('Folders whose videos and episode folders anyone signed in may start a room from in the panel. The "library" folder inside the state folder is always included. The assistant\'s tool can open any path.'),
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
  presence: Presence.default({ continue: true, recap: false, ratings: false, picks: false })
    .description('What the Watching tab shows besides the open rooms and the library. Each part can be switched on or off.'),
  recommender: Recommender.default({ command: [], env: {} })
    .description('Where picks come from: a recommender extension. The hub has no taste of its own.'),
  points: Points.default({ command: [], env: {}, night: { from: '01:00', to: '06:00' } })
    .description('Extras a person\'s points pay for: starting a new series and a binge night, for the people a points extension plays with. Watching stays free; with no extension nothing changes.'),
  ffmpeg: z.string().default('ffmpeg').description('ffmpeg command.'),
  ffprobe: z.string().default('ffprobe').description('ffprobe command.'),
  ytDlp: z.string().default('yt-dlp')
    .description('yt-dlp command. Link reads and downloads web videos and playlists with it; without it Link is hidden. Its own config file applies.'),
  proxies: z.array(ProxyRule).default([])
    .description('Which proxy each outbound request takes, by host: the first rule naming the host wins, any other host goes direct. Applies to every yt-dlp call (by the page\'s host) and every picture the hub fetches itself. Sources\' commands keep their own network setup.'),
  cookies: z.array(CookieRule).default([])
    .description('Signed-in accounts for sites, by host: the first rule naming a page\'s host gives its accounts, and yt-dlp reads that page with the chosen account\'s cookies and User-Agent. A show keeps the account of whoever fetched it, or started the room on it.'),
})
