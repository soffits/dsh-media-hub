/**
 * The rolling cache's arithmetic, pure: which episodes of a show to have on
 * disk around where people are watching, which to fetch (in order), which
 * to delete, and which to give up first when the cache is over its cap.
 *
 * Episodes are numbered from 1 as the source lists them. A show's *focuses*
 * are the episodes people are on now (one per open room), or the place it
 * would continue from when no room is open.
 */

/** The episodes around a focus that stay on disk: `behind` before it to `ahead` after, within 1..total. */
export function windowOf(focus, total, { ahead, behind }) {
  return { first: Math.max(1, focus - behind), last: Math.min(total, focus + ahead) }
}

/**
 * What to do about one show's cache.
 * @param {object} input
 * @param {number} input.total - episodes the source lists
 * @param {number[]} input.focuses - episodes people are on, in priority order; empty when nobody is
 * @param {Set<number>} input.cached - episodes on disk
 * @param {Set<number>} input.finished - episodes watched to the end
 * @param {Set<number>} [input.skip] - episodes someone deleted by hand: not fetched again unless they are a focus
 * @param {boolean} [input.pinned] - the whole show is kept offline: everything is fetched and nothing trimmed
 * @param {number} input.ahead
 * @param {number} input.behind
 * @returns {{ want: number[], protect: Set<number>, trim: number[] }}
 *   want: episodes to fetch, the first focus first, then the ones after it in order;
 *   protect: episodes inside some focus' window, never trimmed or evicted;
 *   trim: cached episodes that were watched and fell out of every window
 */
export function planCache({ total, focuses, cached, finished, skip = new Set(), pinned = false, ahead, behind }) {
  const protect = new Set()
  const want = []
  const add = (n) => {
    if (!cached.has(n) && !want.includes(n) && (!skip.has(n) || focuses.includes(n))) want.push(n)
  }
  for (const focus of focuses) {
    const { first, last } = windowOf(focus, total, { ahead, behind })
    for (let n = first; n <= last; n++) protect.add(n)
    for (let n = focus; n <= last; n++) add(n)
  }
  if (pinned) {
    const start = focuses[0] ?? 1
    for (let n = start; n <= total; n++) add(n)
    for (let n = 1; n < start; n++) add(n)
  }
  const trim = pinned ? [] : [...cached].filter(n => finished.has(n) && !protect.has(n)).sort((a, b) => a - b)
  return { want, protect, trim }
}

/**
 * Which cached episodes to give up so the cache fits `capBytes`: the least
 * recently watched first, never a protected one.
 * @param {{ key: string, bytes: number, lastAt: number, protected: boolean }[]} entries - every cached episode that counts
 * @param {number} capBytes - 0 means no cap
 * @returns {string[]} keys to delete
 */
export function pickEvictions(entries, capBytes) {
  if (!(capBytes > 0)) return []
  let used = entries.reduce((sum, entry) => sum + entry.bytes, 0)
  const out = []
  for (const entry of entries.filter(e => !e.protected).sort((a, b) => a.lastAt - b.lastAt)) {
    if (used <= capBytes) break
    out.push(entry.key)
    used -= entry.bytes
  }
  return out
}

/** The episodes to fetch next as one run: the first missing one and the missing ones directly after it, as [from, to]. */
export function nextRun(want, have) {
  const missing = want.filter(n => !have.has(n))
  if (missing.length === 0) return null
  const from = missing[0]
  let to = from
  while (missing.includes(to + 1)) to += 1
  return [from, to]
}
