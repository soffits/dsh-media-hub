/**
 * Sources: catalogues the panel searches and the library downloads from.
 *
 * A source is a plain object:
 *
 *   id        stable id ('fanqie'), used in URLs and saved downloads
 *   label     name shown on its tab: a string or { <tag>: text }; empty uses the page's words for the id
 *   input     'search' (a search box) or 'url' (a web address, Link)
 *   kinds     [{ id, label, media }]: what it can search for (short dramas, audiobooks...); labels as above
 *   available()                    -> Promise<boolean>   whether it can run here (its tool is installed)
 *   search(query, { kind, limit }) -> Promise<Result[]>  (input 'search' only)
 *   info(id)                       -> Promise<Result>    with `episodes` known
 *   cover(url, file, { page })     -> Promise<void>      optional: fetch a picture it named, its own way
 *   download({ id, dir, from, to, quality, signal, onEpisode, onStart }) -> Promise<{ failed: string[] }>
 *       writes the numbered media files of episodes `from`..`to` (1-based)
 *       into `dir` in order, skipping finished files; each file appears
 *       under its final name only when complete and its name starts with
 *       the episode number. `quality` is the show's choice, for a source
 *       that offers one. `onEpisode()` is called whenever one may have
 *       landed, `onStart(n)` when episode n starts downloading.
 *
 *   Result = { id, title, kind, episodes?, score?, author?, blurb?, status? }
 *
 * The library and the rooms only ever see the files a source writes. Two
 * implementations: the command source (./command.js), a configured command
 * speaking the JSON protocol in docs/source-protocol.md, so no site is known
 * to the code; and Link (./link.js), any address yt-dlp reads.
 */
import { join } from 'node:path'
import { createCommandSource } from './command.js'
import { LINK_SOURCE, createLinkSource } from './link.js'

/** Average size of one downloaded episode by kind, for "about N GB" before a download. */
export const EPISODE_BYTES = Object.freeze({ drama: 15e6, audio: 8e6 })

/** What a kind's works are: episodes watched or listened to together, or one file downloaded in a format. */
export const MEDIA = Object.freeze(['video', 'audio', 'book'])

/** The source id that means every source at once in a search. */
export const ALL_SOURCES = 'all'

/** Ids the plugin uses itself (local files, Link, all sources), so a configured source cannot take them. */
export const RESERVED_IDS = Object.freeze(['local', LINK_SOURCE, ALL_SOURCES])

/**
 * The sources this install offers, in tab order: the configured ones, then Link.
 * @param {{ id: string, label: string | Record<string, string>, kinds: { id: string, label: string | Record<string, string> }[], command: string[], env?: Record<string, string> }[]} definitions - the `sources` setting
 * @param {{ stateDir: string, logger: { warn: Function }, link: { ytDlp: string, proxies: object, cookies: object, maxHeight: number } }} options - each command runs in `<stateDir>/<id>`; `link` sets up Link (src/sources/link.js)
 */
export function createSources(definitions, { stateDir, logger, link }) {
  const seen = new Set()
  for (const { id, kinds } of definitions) {
    if (kinds.length === 0) throw new Error(`source ${id} lists no kinds`)
    if (RESERVED_IDS.includes(id)) throw new Error(`source id ${id} is reserved`)
    if (seen.has(id)) throw new Error(`source id ${id} is listed twice`)
    seen.add(id)
  }
  return [
    ...definitions.map(definition => createCommandSource(definition, { logger, cwd: join(stateDir, definition.id) })),
    createLinkSource({ ...link, logger, cwd: join(stateDir, LINK_SOURCE) }),
  ]
}

/** The sources whose tools are present, as the panel lists them. */
export async function describeSources(sources) {
  const out = []
  for (const source of sources) {
    if (await source.available()) out.push({ id: source.id, label: source.label, input: source.input ?? 'search', kinds: source.kinds.map(kind => ({ ...kind, media: kind.media ?? 'video' })), filters: source.filters })
  }
  return out
}
