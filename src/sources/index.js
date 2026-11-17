/**
 * Sources: catalogues the panel searches and the library downloads from.
 *
 * A source is a plain object:
 *
 *   id        stable id ('fanqie'), used in URLs and saved downloads
 *   label     name shown on its tab: a string or { <tag>: text }; empty uses the page's words for the id
 *   kinds     [{ id, label, media }]: what it can search for (short dramas, audiobooks...); labels as above
 *   available()                    -> Promise<boolean>   whether it can run here (its tool is installed)
 *   search(query, { kind, limit }) -> Promise<Result[]>
 *   info(id)                       -> Promise<Result>    with `episodes` known
 *   download({ id, dir, from, to, signal, onEpisode, onStart }) -> Promise<{ failed: string[] }>
 *       writes the numbered media files of episodes `from`..`to` (1-based,
 *       `to` null for the rest) into `dir` in order, skipping finished files;
 *       each file appears under its final name only when complete and its
 *       name starts with the episode number. `onEpisode()` is called whenever
 *       one may have landed, `onStart(n)` when episode n starts downloading.
 *
 *   Result = { id, title, kind, episodes?, score?, author?, blurb?, status? }
 *
 * The library and the rooms only ever see the files a source writes. The one
 * implementation is the command source (./command.js): every site is a
 * configured command speaking the JSON protocol in docs/source-protocol.md.
 */
import { join } from 'node:path'
import { createCommandSource } from './command.js'

/** Average size of one downloaded episode by kind, for "about N GB" before a download. */
export const EPISODE_BYTES = Object.freeze({ drama: 15e6, audio: 8e6 })

/** What a kind's works are: episodes watched or listened to together, or one file downloaded in a format. */
export const MEDIA = Object.freeze(['video', 'audio', 'book'])

/** Ids the plugin gives to its own kinds of room, so a source cannot take them. */
/** The source id that means every source at once in a search. */
export const ALL_SOURCES = 'all'

export const RESERVED_IDS = Object.freeze(['local', 'youtube', ALL_SOURCES])

/**
 * The sources this install offers, in tab order.
 * @param {{ id: string, label: string | Record<string, string>, kinds: { id: string, label: string | Record<string, string> }[], command: string[], env?: Record<string, string> }[]} definitions - the `sources` setting
 * @param {{ stateDir: string, logger: { warn: Function } }} options - each command runs in `<stateDir>/<id>`
 */
export function createSources(definitions, { stateDir, logger }) {
  const seen = new Set()
  for (const { id, kinds } of definitions) {
    if (kinds.length === 0) throw new Error(`source ${id} lists no kinds`)
    if (RESERVED_IDS.includes(id)) throw new Error(`source id ${id} is reserved`)
    if (seen.has(id)) throw new Error(`source id ${id} is listed twice`)
    seen.add(id)
  }
  return definitions.map(definition => createCommandSource(definition, { logger, cwd: join(stateDir, definition.id) }))
}

/** The sources whose tools are present, as the panel lists them. */
export async function describeSources(sources) {
  const out = []
  for (const source of sources) {
    if (await source.available()) out.push({ id: source.id, label: source.label, kinds: source.kinds.map(kind => ({ ...kind, media: kind.media ?? 'video' })), filters: source.filters })
  }
  return out
}
