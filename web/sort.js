/**
 * Sorting a list of search results by what the results carry: how many
 * played it, when it was last updated. The source's own order stays the
 * default. Pure.
 */

/** The date a result says it was updated (its `updated` fact), as a time, or null. */
export function updatedAt(result) {
  const text = (result.meta ?? []).find(row => row.key === 'updated')?.value
  const time = text ? Date.parse(String(text).replace(/\./g, '-')) : NaN
  return Number.isFinite(time) ? time : null
}

/** The orders worth offering for these results: the default, and the ones at least two results can be told apart by. */
export function sortModes(results) {
  const modes = ['default']
  if (results.filter(result => result.popularity?.count > 0).length > 1) modes.push('plays')
  if (results.filter(result => updatedAt(result) !== null).length > 1) modes.push('newest')
  return modes
}

/** The results in an order; ones without the value go last, and ties keep the source's order. */
export function sortResults(results, mode) {
  const key = { plays: result => result.popularity?.count ?? null, newest: updatedAt }[mode]
  if (key === undefined) return results
  return results
    .map((result, n) => ({ result, n, value: key(result) }))
    .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity) || a.n - b.n)
    .map(entry => entry.result)
}
