/**
 * Which episodes are made playable (remuxed, transcoded, or played while
 * they download), and when, pure. It follows where the rooms are, never the
 * order files arrived in: the episode a room is on starts at once, beside
 * anything else running; the next `ahead` episodes after it come one at a
 * time, nearest first; nothing else is worked on, and a run nobody needs any
 * more (its room went somewhere it is not just ahead of) is stopped.
 */

/**
 * How much the rooms need each thing their items stand for: 0 when a room is
 * on it, n when it is n episodes ahead of where a room is; the nearest room wins.
 * @param {{ index: number, items: object[] }[]} rooms
 * @param {number} ahead
 * @param {(room: object, item: object) => string | null} keyOf - what an item stands for (null: nothing)
 * @returns {Map<string, number>}
 */
export function needs(rooms, ahead, keyOf) {
  const out = new Map()
  for (const room of rooms) {
    for (let distance = 0; distance <= ahead; distance++) {
      const item = room.items[room.index + distance]
      if (item === undefined) break
      const key = keyOf(room, item)
      if (key !== null && !(out.get(key) <= distance)) out.set(key, distance)
    }
  }
  return out
}

/**
 * What to start and what to stop.
 * @param {Map<string, number>} need - as `needs` gives it
 * @param {Iterable<string>} waiting - not playable yet
 * @param {Iterable<string>} running - being worked on
 * @returns {{ start: string[], stop: string[] }}
 */
export function planPreparing(need, waiting, running) {
  const busy = new Set(running)
  const idle = [...waiting].filter(key => !busy.has(key) && need.has(key))
  const stop = [...busy].filter(key => !need.has(key))
  const start = idle.filter(key => need.get(key) === 0)
  if (![...busy].some(key => need.get(key) > 0)) {
    const next = idle.filter(key => need.get(key) > 0).sort((a, b) => need.get(a) - need.get(b))[0]
    if (next !== undefined) start.push(next)
  }
  return { start, stop }
}
