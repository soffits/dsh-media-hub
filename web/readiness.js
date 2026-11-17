/**
 * When a <video> held at the ready gate counts as ready, and what to do when
 * it never gets there on its own. Pure, so Node tests it.
 *
 * Desktop browsers keep loading a paused video. Safari on iOS loads little
 * or nothing until the element plays, so a test like "3 s buffered" can wait
 * forever there. Ready therefore means the element itself says it can play
 * (HAVE_FUTURE_DATA, the state behind `canplay`), with a few seconds buffered
 * while the browser is still fetching, or as much as it chose to fetch once it
 * stopped. An element that does not get even that far is primed: played muted
 * for a moment, which makes iOS load, then put back where the room holds.
 */

export const HAVE_FUTURE_DATA = 3
export const HAVE_ENOUGH_DATA = 4
/** Ready with this much buffered ahead (or to the end) while the browser is still fetching. */
export const READY_AHEAD_S = 3
/** The browser stopped fetching when no `progress` came for this long. */
export const LOAD_IDLE_MS = 1000
/** A viewer held at a gate this long without being able to play gets its player primed. */
export const PRIME_AFTER_MS = 1500
/** A viewer still loading after this long is offered a button that starts loading from a tap. */
export const TAP_AFTER_MS = 8000

/** Seconds buffered ahead of `at` in one continuous range. */
export function bufferedAhead(ranges, at) {
  for (const [start, end] of ranges) if (start <= at + 0.05 && end > at) return end - at
  return 0
}

/**
 * Whether the element can start from where it stands.
 * @param {{ readyState: number, seeking: boolean, at: number, duration: number, ranges: Array<[number, number]>, loadIdleMs: number }} media
 */
export function canStart({ readyState, seeking, at, duration, ranges, loadIdleMs }) {
  if (seeking || readyState < HAVE_FUTURE_DATA) return false
  if (readyState >= HAVE_ENOUGH_DATA || !fetching(loadIdleMs)) return true
  const need = Math.min(READY_AHEAD_S, Math.max(0, (Number.isFinite(duration) ? duration : Infinity) - at - 0.1))
  return bufferedAhead(ranges, at) >= need
}

/** Whether the browser is still fetching for the element: a `progress` came lately. */
export const fetching = loadIdleMs => loadIdleMs < LOAD_IDLE_MS

/**
 * Whether to prime a held player now: it has waited a while, cannot start,
 * is paused, the browser stopped fetching for it (a slow line that still
 * loads is left alone), and it was not primed for this gate yet.
 */
export function shouldPrime({ heldMs, ready, paused, loadIdleMs, primed }) {
  return !ready && paused && !primed && !fetching(loadIdleMs) && heldMs >= PRIME_AFTER_MS
}

/** Whether to offer this viewer "tap to continue": still loading at a gate after a while. */
export const offerTap = ({ loadingMs }) => loadingMs >= TAP_AFTER_MS
