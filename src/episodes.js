/**
 * Episodes of a library show as the show's source lists them. A show that
 * came from a source lists every episode (`source.episodes` of them) though
 * only some are on disk; its files are matched to episodes by the number
 * their names start with ("07 第7集.mp4" is episode 7). A show without a
 * source (a folder someone added) lists the files it has.
 */
import { basename, extname } from 'node:path'
import { episodeTitle } from './work.js'

export const titleOf = name => basename(name, extname(name))

/** The episode number a file name starts with, or null. */
export function episodeNumber(name) {
  const match = /^\s*0*(\d+)(?!\d)/.exec(basename(name))
  return match === null ? null : Number(match[1])
}

/** Whether a show's notes say it came from a source with a known episode count. */
export const isSourced = entry => entry?.source?.episodes > 0

/** The episode numbers among some file names. */
export const numbersOf = names => new Set(names.map(episodeNumber).filter(n => n !== null))

/**
 * The episodes of a show in order (a sourced show's titles are the ones its
 * source gave, kept in the show's notes as `work`, else the file's name). Sourced: one per number from 1 to the
 * source's total (plus any numbered file beyond it), `file` null when not on
 * disk, `key` the number. Otherwise one per file, `key` its name.
 * @param {object} entry - the show's notes
 * @param {{ name: string }[]} files - media files in the folder, in order
 * @returns {{ key: string | number, n: number, title: string | null, file: object | null }[]}
 */
export function slotsOf(entry, files) {
  if (!isSourced(entry)) return files.map((file, index) => ({ key: file.name, n: index + 1, title: titleOf(file.name), file }))
  const byNumber = new Map()
  for (const file of files) {
    const n = episodeNumber(file.name)
    if (n !== null && !byNumber.has(n)) byNumber.set(n, file)
  }
  const numbers = new Set(byNumber.keys())
  for (let n = 1; n <= entry.source.episodes; n++) numbers.add(n)
  return [...numbers].sort((a, b) => a - b).map(n => ({ key: n, n, title: episodeTitle(entry.work, n) ?? (byNumber.has(n) ? titleOf(byNumber.get(n).name) : null), file: byNumber.get(n) ?? null }))
}

/** The key a file has in `slotsOf` for this show. */
export const keyOf = (entry, name) => (isSourced(entry) ? episodeNumber(name) : name)

/** The value saved under a file name in a notes object (progress by file), found by episode number for sourced shows. */
export function noteFor(entry, notes, name) {
  if (notes === undefined) return undefined
  if (!isSourced(entry)) return notes[name]
  const n = episodeNumber(name)
  const found = Object.entries(notes).find(([saved]) => episodeNumber(saved) === n)
  return found?.[1]
}
