/**
 * Sync math shared by the server, the browser player and the tests. Pure:
 * no I/O, no timers, no Node or DOM APIs.
 *
 * Times are milliseconds on the server clock unless named otherwise;
 * positions are seconds of media time.
 */

/** Drift bands, in seconds. */
export const DRIFT = Object.freeze({
  /** Below this the players count as together. */
  ignore: 0.3,
  /** Above this a player jumps instead of catching up by rate. */
  seek: 2,
  /** A player already catching up by rate keeps at it until this close. */
  settle: 0.1,
  /** Rate change while catching up, as a fraction of the room's rate. */
  nudge: 0.05,
})

/**
 * Where the room's media is at a server time.
 * @param {{ playing: boolean, position: number, rate: number, updatedAt: number, duration?: number | null }} state
 * @param {number} serverNow
 * @returns {number} seconds
 */
export function expectedPosition(state, serverNow) {
  let position = state.position
  if (state.playing) position += Math.max(0, serverNow - state.updatedAt) / 1000 * state.rate
  if (typeof state.duration === 'number' && state.duration > 0) position = Math.min(position, state.duration)
  return Math.max(0, position)
}

/**
 * Clock offset from ping samples, NTP style: the sample with the shortest
 * round trip has the smallest error, so its offset is taken.
 * @param {{ sent: number, received: number, server: number }[]} samples - client send and receive times (client clock) and the server time in the reply.
 * @returns {{ offset: number, rtt: number } | null} offset to add to the client clock to get server time
 */
export function clockOffset(samples) {
  let best = null
  for (const { sent, received, server } of samples) {
    const rtt = received - sent
    if (!(rtt >= 0)) continue
    if (best === null || rtt < best.rtt) best = { offset: server - (sent + received) / 2, rtt }
  }
  return best
}

/**
 * What a player should do about its drift from the room.
 *
 * @param {object} input
 * @param {number} input.local - the player's position, seconds
 * @param {number} input.expected - the room's position, seconds
 * @param {number} input.rate - the room's rate
 * @param {boolean} [input.nudging=false] - whether the player is catching up by rate now
 * @returns {{ action: 'none', rate: number, drift: number } | { action: 'rate', rate: number, drift: number } | { action: 'seek', to: number, rate: number, drift: number }}
 *   drift is local minus expected (positive: ahead)
 */
export function correction({ local, expected, rate, nudging = false }) {
  const drift = local - expected
  const size = Math.abs(drift)
  if (size > DRIFT.seek) return { action: 'seek', to: expected, rate, drift }
  if (size >= DRIFT.ignore || (nudging && size > DRIFT.settle)) {
    const factor = drift > 0 ? 1 - DRIFT.nudge : 1 + DRIFT.nudge
    return { action: 'rate', rate: rate * factor, drift }
  }
  return { action: 'none', rate, drift }
}

/** The next episode starts loading this long before the current one ends (seconds). */
export const PRELOAD_BEFORE_END_S = 30
/** Episodes shorter than this preload the next one from the start. */
export const SHORT_EPISODE_S = 120

/**
 * Whether the next episode should be loading in the background by now.
 * @param {{ duration: number | null, position: number }} state - the current episode's length and position (seconds)
 */
export function preloadDue({ duration, position }) {
  if (!Number.isFinite(duration) || duration <= 0) return false
  return duration <= SHORT_EPISODE_S || duration - position <= PRELOAD_BEFORE_END_S
}
