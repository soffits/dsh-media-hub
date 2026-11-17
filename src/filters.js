/**
 * Search filters the hub applies to every answer (pure), so a source that
 * ignores a filter flag still gives a right list, and the merging of answers
 * from several sources into one.
 *
 * A result whose field is unknown passes a filter on that field: most sites
 * leave some fields out, and hiding everything they did not describe would
 * hide most of a list.
 */
import { FORMAT } from './sources/command.js'

const LANGUAGE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/
const YEAR = value => (Number.isInteger(value) && value > 0 && value < 10000 ? value : null)

/**
 * Filters from request parameters, each null when absent or malformed.
 * @param {(name: string) => string} param
 */
export function parseFilters(param) {
  const whole = (name) => {
    const value = Number.parseInt(param(name), 10)
    return Number.isFinite(value) && value > 0 ? value : null
  }
  const language = param('language').trim()
  const format = param('format').trim().toLowerCase()
  return {
    language: LANGUAGE.test(language) ? language.toLowerCase() : '',
    format: FORMAT.test(format) ? format : '',
    yearFrom: YEAR(whole('yearFrom')),
    yearTo: YEAR(whole('yearTo')),
    maxBytes: whole('maxMb') === null ? null : whole('maxMb') * 1e6,
  }
}

export const hasFilters = filters => Boolean(filters.language || filters.format || filters.yearFrom || filters.yearTo || filters.maxBytes)

/** The primary language subtag of a code ('zh-Hans' -> 'zh'). */
const primary = code => code.toLowerCase().split('-')[0]

/** The smallest size known for a result: its single file, else its smallest format. */
export function smallestBytes(result) {
  const sizes = [result.bytes, ...(result.formats ?? []).map(entry => entry.bytes)].filter(size => Number.isInteger(size) && size > 0)
  return sizes.length === 0 ? null : Math.min(...sizes)
}

export function matches(result, { language = '', format = '', yearFrom = null, yearTo = null, maxBytes = null } = {}) {
  if (language && result.language && primary(result.language) !== primary(language)) return false
  if (format && (result.formats ?? []).length > 0 && !result.formats.some(entry => entry.format === format)) return false
  if (yearFrom !== null && result.year !== null && result.year !== undefined && result.year < yearFrom) return false
  if (yearTo !== null && result.year !== null && result.year !== undefined && result.year > yearTo) return false
  const size = smallestBytes(result)
  if (maxBytes !== null && size !== null && size > maxBytes) return false
  return true
}

export const applyFilters = (results, filters) => results.filter(result => matches(result, filters))

/** Several sources' answers as one list: first of each, then second of each..., so no source buries the others. */
export function interleave(lists) {
  const out = []
  const longest = Math.max(0, ...lists.map(list => list.length))
  for (let index = 0; index < longest; index += 1) {
    for (const list of lists) if (index < list.length) out.push(list[index])
  }
  return out
}
