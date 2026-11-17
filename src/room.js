/**
 * Room state and the operations on it. Pure: every function takes the time
 * it runs at and returns a new room, so the server, its persistence and the
 * tests share one implementation.
 *
 * A room plays one list of items (episodes). Its clock is `position` at
 * `updatedAt` (server time) moving at `rate` while it plays. `playing` is
 * what the viewers asked for. The clock only moves when no gate is open:
 *
 * The ready gate. Opening the room, switching episode, a seek and a
 * viewer's stall open a gate: the clock stops, every viewer present loads
 * the position and reports ready once it can play a few seconds ahead.
 * When everyone present is ready (or was left out with "start without"),
 * the gate closes; a playing room then starts at a server time slightly in
 * the future, so every viewer begins at the same instant. A viewer who
 * leaves is no longer waited for; one who joins while a gate is open is.
 */
import { expectedPosition } from './sync.js'

/** How long a gate waits before anyone may start without the viewers still loading. */
export const SKIP_AFTER_MS = 10_000
/** After being left out, a viewer's stalls are ignored this long, so a bad line cannot freeze the room in a loop. */
export const STALL_COOLDOWN_MS = 30_000
/** Stalls right after a start are the players spinning up, not a stall. */
export const STALL_REARM_MS = 3000
/** How far back a stalled viewer's position may take the room. */
export const STALL_BACK_S = 10
/** The start lead: the slowest round trip of the viewers, plus this, within these bounds. */
export const START_LEAD = Object.freeze({ extra: 250, min: 300, max: 2000 })
/** Playback rates a viewer may pick. */
export const RATE_LIMITS = Object.freeze({ min: 0.25, max: 2 })

/** Operations viewers send. */
export const OPS = Object.freeze(['play', 'pause', 'seek', 'rate', 'select', 'ended', 'stall', 'ready', 'skip', 'duration', 'nextready'])

/**
 * A new room, waiting for its first viewers.
 * @param {{ id: string, title: string, source: 'local' | 'youtube', items: object[], createdBy: string, now: number }} input
 */
export function createRoom({ id, title, source, items, createdBy, now }) {
  const room = {
    id,
    title,
    source,
    items,
    index: 0,
    playing: false,
    position: 0,
    rate: 1,
    updatedAt: now,
    createdAt: now,
    createdBy,
    seq: 0,
    last: null,
    gate: null,
    gates: 0,
    startedAt: null,
    cooldown: {},
    nextReady: null,
  }
  return openGate(room, 'load', now)
}

/**
 * The clock viewers follow. While a gate is open it stands still; after a
 * gate closes, `updatedAt` may lie slightly in the future: the start time.
 * @returns {{ playing: boolean, position: number, rate: number, updatedAt: number, duration: number | null }}
 */
export function clockOf(room) {
  return {
    playing: room.playing && room.gate === null,
    position: room.position,
    rate: room.rate,
    updatedAt: room.updatedAt,
    duration: room.items[room.index]?.duration ?? null,
  }
}

/**
 * The switch to the next episode, when it can be scheduled ahead: the room
 * plays, no gate is open, the length is known, and every viewer present has
 * said the next episode is loaded and can play. The switch then happens at
 * the moment the current episode ends on the room's clock, in the server and
 * in every viewer, with no round trip and no gate. Anything else (someone
 * joined, someone is not ready) leaves the usual gate to do it.
 * @param {Iterable<string>} present - client ids of the viewers connected
 * @returns {{ at: number, to: number } | null} `at` is a server time
 */
export function advanceOf(room, present) {
  const ids = [...present]
  const duration = room.items[room.index]?.duration
  if (!room.playing || room.gate !== null || room.nextReady?.from !== room.index || ids.length === 0) return null
  if (!(duration > 0) || room.index + 1 >= room.items.length || room.items[room.index + 1].status !== 'ready') return null
  if (!ids.every(id => room.nextReady.ready.includes(id))) return null
  const left = Math.max(0, duration - room.position)
  return { at: Math.round(room.updatedAt + left * 1000 / room.rate), to: room.index + 1 }
}

/** Move to the next episode at the time `advanceOf` gave, playing from its start with no gate. */
export function advance(room, to, at) {
  const seq = room.seq + 1
  return { ...room, index: to, position: 0, updatedAt: at, startedAt: at, gate: null, nextReady: null, seq, last: { seq, by: '', clientId: null, op: 'advance', index: to, position: 0, rate: room.rate, at } }
}

/** The room's position now. */
export function positionAt(room, now) {
  return expectedPosition(clockOf(room), now)
}

/** Stop or restart the clock at `now` without moving the position; a start still ahead stays ahead. */
function rebase(room, now) {
  return { ...room, position: positionAt(room, now), updatedAt: Math.max(now, room.updatedAt) }
}

/**
 * Stop the clock until everyone present is ready.
 * @param {'load' | 'seek' | 'stall'} reason
 * @param {string[]} [ready] - viewers already counted ready (the ones not stalling)
 * @param {string | null} [by] - the stalled viewer
 */
function openGate(room, reason, now, ready = [], by = null) {
  const atNow = rebase(room, now)
  const id = (room.gates ?? 0) + 1
  return { ...atNow, gates: id, gate: { id, reason, since: now, ready, skipped: [], by, rtt: 0 } }
}

/** Viewers present the gate still waits for. */
export function waitingFor(room, present) {
  const gate = room.gate
  if (gate === null) return []
  return [...present.keys()].filter(clientId => !gate.ready.includes(clientId) && !gate.skipped.includes(clientId))
}

/** Close the gate when everyone present is ready; a playing room starts after the lead. */
function settleGate(room, present, now) {
  if (room.gate === null || present.size === 0 || room.items[room.index]?.status !== 'ready') return room
  if (waitingFor(room, present).length > 0) return room
  const lead = Math.min(START_LEAD.max, Math.max(START_LEAD.min, room.gate.rtt + START_LEAD.extra))
  if (!room.playing) return { ...room, gate: null }
  const startsAt = now + lead
  return { ...room, gate: null, updatedAt: startsAt, startedAt: startsAt }
}

/**
 * Close the gate if nobody it waits for is still present (someone left, the
 * item became ready). The hub calls this when viewers come and go.
 * @param {Map<string, string>} present - client id to name, of the viewers connected
 * @returns {{ room: object, changed: boolean }}
 */
export function settle(room, present, now) {
  const next = settleGate(room, present, now)
  if (next === room) return { room, changed: false }
  return { room: { ...next, seq: room.seq + 1 }, changed: true }
}

/** Stop a room's clock until the viewers are back and ready (a restart, everyone left while it played). */
export function hold(room, now) {
  if (room.gate !== null) return room
  return { ...openGate(room, 'load', now), seq: room.seq + 1 }
}

const finite = value => typeof value === 'number' && Number.isFinite(value)

/**
 * Apply one viewer's operation.
 * @param {object} room
 * @param {{ op: string, position?: number, rate?: number, index?: number, from?: number, duration?: number, gate?: number, rtt?: number }} op
 * @param {{ by: string, clientId: string, now: number, present: Map<string, string> }} actor - present: client id to name, of every viewer connected
 * @returns {{ room: object, changed: boolean, announce: boolean, error?: string }}
 *   announce: whether viewers should be told who did it
 */
export function applyOp(room, op, { by, clientId, now, present }) {
  const unchanged = error => ({ room, changed: false, announce: false, ...(error ? { error } : {}) })
  const done = (changed, announce = true, extra = {}) => {
    const next = settleGate(changed, present, now)
    const seq = room.seq + 1
    const last = announce
      ? { seq, by, clientId, op: op.op, index: next.index, position: next.position, rate: next.rate, at: now, ...extra }
      : room.last
    return { room: { ...next, seq, last }, changed: true, announce }
  }
  const atNow = rebase(room, now)
  const duration = room.items[room.index]?.duration ?? null
  const clamp = position => Math.max(0, duration ? Math.min(position, duration) : position)
  const gate = room.gate

  switch (op.op) {
    case 'play':
      if (room.playing) return unchanged()
      // A wait that was paused counts from now for "start without".
      return done({ ...atNow, playing: true, position: finite(op.position) && gate === null ? clamp(op.position) : atNow.position, gate: gate && { ...gate, since: now } })
    case 'pause':
      if (!room.playing) return unchanged()
      return done({ ...atNow, playing: false, position: finite(op.position) && gate === null ? clamp(op.position) : atNow.position })
    case 'seek':
      if (!finite(op.position)) return unchanged('seek needs a position')
      return done(openGate({ ...atNow, position: clamp(op.position) }, gate?.reason === 'load' ? 'load' : 'seek', now))
    case 'rate': {
      if (!finite(op.rate)) return unchanged('rate needs a rate')
      const rate = Math.min(RATE_LIMITS.max, Math.max(RATE_LIMITS.min, op.rate))
      if (rate === room.rate) return unchanged()
      return done({ ...atNow, rate })
    }
    case 'select': {
      if (!Number.isInteger(op.index) || op.index < 0 || op.index >= room.items.length) return unchanged('no such item')
      if (Number.isInteger(op.from) && op.from !== room.index) return unchanged()
      return done(openGate({ ...atNow, index: op.index, position: 0, nextReady: null }, 'load', now))
    }
    case 'ended': {
      // Several viewers report the end of the same item; only the first moves on.
      if (!Number.isInteger(op.from) || op.from !== room.index) return unchanged()
      // The switch is already scheduled to this very moment; the server makes it.
      if (advanceOf(room, present.keys()) !== null) return unchanged()
      if (room.index + 1 < room.items.length) return done(openGate({ ...atNow, index: room.index + 1, position: 0, nextReady: null }, 'load', now))
      if (!room.playing) return unchanged()
      return done({ ...atNow, playing: false }, false)
    }
    case 'stall': {
      // A stall while a gate is open, before the clock settled after a start, or from a viewer left out lately changes nothing.
      if (!room.playing || gate !== null || (room.cooldown[clientId] ?? 0) > now) return unchanged()
      if (room.startedAt !== null && now < room.startedAt + STALL_REARM_MS) return unchanged()
      // The room goes back to where the stalled viewer is; the others have that bit buffered behind them.
      const at = finite(op.position) ? Math.min(atNow.position, Math.max(atNow.position - STALL_BACK_S, clamp(op.position))) : atNow.position
      const others = [...present.keys()].filter(id => id !== clientId)
      return done(openGate({ ...atNow, position: at }, 'stall', now, others, clientId), false)
    }
    case 'ready': {
      if (gate === null || op.gate !== gate.id || gate.ready.includes(clientId)) return unchanged()
      if (room.items[room.index]?.status !== 'ready') return unchanged()
      const rtt = finite(op.rtt) ? Math.min(START_LEAD.max, Math.max(0, op.rtt)) : 0
      return done({ ...room, gate: { ...gate, ready: [...gate.ready, clientId], rtt: Math.max(gate.rtt, rtt) } }, false)
    }
    case 'skip': {
      if (gate === null || op.gate !== gate.id) return unchanged()
      if (now - gate.since < SKIP_AFTER_MS) return unchanged('too early to start without them')
      const left = waitingFor(room, present).filter(id => id !== clientId)
      if (left.length === 0) return unchanged()
      const cooldown = Object.fromEntries(Object.entries(room.cooldown).filter(([, until]) => until > now))
      for (const id of left) cooldown[id] = now + STALL_COOLDOWN_MS
      const next = { ...room, cooldown, gate: { ...gate, skipped: [...gate.skipped, ...left] } }
      return done(next, true, { skipped: left.map(id => present.get(id)) })
    }
    case 'nextready': {
      // This viewer has the next episode loaded and can play it.
      if (op.from !== room.index || room.index + 1 >= room.items.length) return unchanged()
      const ready = room.nextReady?.from === room.index ? room.nextReady.ready : []
      if (ready.includes(clientId)) return unchanged()
      return done({ ...room, nextReady: { from: room.index, ready: [...ready, clientId] } }, false)
    }
    case 'duration': {
      if (!finite(op.duration) || op.duration <= 0 || op.index !== room.index) return unchanged()
      if (room.items[room.index].duration === op.duration) return unchanged()
      const items = room.items.map((item, i) => (i === room.index ? { ...item, duration: op.duration } : item))
      return done({ ...room, items }, false)
    }
    default:
      return unchanged(`unknown op ${String(op.op)}`)
  }
}

/** Replace the items (an item finished preparing), keeping the clock. */
export function updateItems(room, items) {
  return { ...room, items, seq: room.seq + 1 }
}
