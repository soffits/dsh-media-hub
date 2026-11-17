import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SKIP_AFTER_MS, STALL_COOLDOWN_MS, STALL_REARM_MS, START_LEAD, applyOp, clockOf, createRoom, hold, positionAt, settle } from '../src/room.js'

const items = [{ title: 'Episode 1', status: 'ready' }, { title: 'Episode 2', status: 'ready' }, { title: 'Episode 3', status: 'ready' }]
const both = new Map([['a', 'Alice'], ['b', 'Bob']])
const alone = new Map([['a', 'Alice']])
const by = (now, clientId = 'a', name = 'Alice', present = both) => ({ by: name, clientId, now, present })
/** Everyone present reports ready for the open gate. */
function allReady(room, now, present = both) {
  for (const clientId of present.keys()) room = applyOp(room, { op: 'ready', gate: room.gate.id }, by(now, clientId, present.get(clientId), present)).room
  return room
}
/** A room whose opening gate has passed. */
const fresh = () => allReady(createRoom({ id: 'r', title: 'T', source: 'local', items, createdBy: 'A', now: 0 }), 0)
const lead = START_LEAD.min

test('play, then the clock runs; pause keeps where it stopped', () => {
  let room = applyOp(fresh(), { op: 'play' }, by(1000)).room
  assert.equal(clockOf(room).playing, true)
  assert.equal(positionAt(room, 6000), 5)
  room = applyOp(room, { op: 'pause' }, by(6000, 'b', 'Bob')).room
  assert.equal(room.playing, false)
  assert.equal(positionAt(room, 60_000), 5)
  assert.deepEqual({ by: room.last.by, op: room.last.op, position: room.last.position }, { by: 'Bob', op: 'pause', position: 5 })
})

test('a play or pause that changes nothing is not announced', () => {
  const room = fresh()
  const result = applyOp(room, { op: 'pause' }, by(10))
  assert.equal(result.changed, false)
  assert.equal(result.room, room)
})

test('seek moves the position, waits for everyone to load it, then keeps playing', () => {
  let room = applyOp(fresh(), { op: 'play' }, by(0)).room
  room = applyOp(room, { op: 'seek', position: 120 }, by(2000)).room
  assert.equal(room.last.op, 'seek')
  assert.equal(room.gate.reason, 'seek')
  assert.equal(positionAt(room, 5000), 120)
  room = allReady(room, 5000)
  assert.equal(room.gate, null)
  assert.equal(positionAt(room, 5000 + lead + 1000), 121)
})

test('rate changes from now on and is clamped', () => {
  let room = applyOp(fresh(), { op: 'play' }, by(0)).room
  room = applyOp(room, { op: 'rate', rate: 2 }, by(10_000)).room
  assert.equal(positionAt(room, 12_000), 14)
  room = applyOp(room, { op: 'rate', rate: 9 }, by(12_000)).room
  assert.equal(room.rate, 2)
})

test('select switches episode from the start and keeps playing once everyone is ready', () => {
  let room = applyOp(fresh(), { op: 'play' }, by(0)).room
  room = applyOp(room, { op: 'select', index: 2 }, by(5000)).room
  assert.equal(room.index, 2)
  assert.equal(room.gate.reason, 'load')
  assert.equal(positionAt(room, 6000), 0)
  room = allReady(room, 6000)
  assert.equal(positionAt(room, 6000 + lead + 1000), 1)
  assert.equal(applyOp(room, { op: 'select', index: 3 }, by(6000)).error, 'no such item')
})

test('the end of an episode moves on once, even when both viewers report it', () => {
  let room = applyOp(fresh(), { op: 'play' }, by(0)).room
  room = applyOp(room, { op: 'ended', from: 0 }, by(100, 'a')).room
  const second = applyOp(room, { op: 'ended', from: 0 }, by(150, 'b'))
  assert.equal(second.changed, false)
  assert.equal(second.room.index, 1)
})

test('the end of the last episode pauses the room', () => {
  let room = { ...applyOp(fresh(), { op: 'play' }, by(0)).room, index: 2 }
  room = applyOp(room, { op: 'ended', from: 2 }, by(100)).room
  assert.equal(room.playing, false)
  assert.equal(room.index, 2)
})

test('duration is recorded for the current episode and clamps seeks', () => {
  let room = applyOp(fresh(), { op: 'duration', index: 0, duration: 90 }, by(0)).room
  assert.equal(clockOf(room).duration, 90)
  room = applyOp(room, { op: 'seek', position: 500 }, by(0)).room
  assert.equal(room.position, 90)
  assert.equal(applyOp(room, { op: 'duration', index: 1, duration: 10 }, by(0)).changed, false)
})

test('every change bumps seq; announced changes carry who and what', () => {
  const a = applyOp(fresh(), { op: 'play' }, by(0))
  assert.equal(a.announce, true)
  const b = applyOp(a.room, { op: 'stall', position: 0 }, by(STALL_REARM_MS, 'b', 'Bob'))
  assert.equal(b.room.seq, a.room.seq + 1)
  assert.equal(b.announce, false)
  assert.equal(b.room.last.op, 'play')
})

// ---------------------------------------------------------------- the ready gate

test('a new room waits for everyone; nobody starts before the last viewer is ready, then all start together after the lead', () => {
  let room = createRoom({ id: 'r', title: 'T', source: 'local', items, createdBy: 'A', now: 0 })
  assert.equal(room.gate.reason, 'load')
  room = applyOp(room, { op: 'play' }, by(100)).room
  assert.equal(room.playing, true)
  assert.equal(clockOf(room).playing, false, 'held while nobody is ready')
  room = applyOp(room, { op: 'ready', gate: room.gate.id, rtt: 120 }, by(2000, 'a')).room
  assert.equal(clockOf(room).playing, false, 'held while Bob loads')
  assert.equal(positionAt(room, 9000), 0)
  room = applyOp(room, { op: 'ready', gate: room.gate.id, rtt: 400 }, by(9000, 'b', 'Bob')).room
  assert.equal(room.gate, null)
  assert.equal(clockOf(room).playing, true)
  // The start lies ahead by the slowest round trip plus a margin, the same instant for everyone.
  assert.equal(room.updatedAt, 9000 + 400 + START_LEAD.extra)
  assert.equal(positionAt(room, 9000 + 400), 0)
  assert.equal(positionAt(room, room.updatedAt + 2000), 2)
})

test('a ready report for an old gate, or before the episode is on disk, does not count', () => {
  let room = applyOp(fresh(), { op: 'play' }, by(0)).room
  const old = room.gates
  room = applyOp(room, { op: 'seek', position: 30 }, by(1000)).room
  assert.equal(applyOp(room, { op: 'ready', gate: old }, by(1100)).changed, false)
  // An episode still downloading (the rolling cache marks it preparing) is not ready for anyone.
  const preparing = { ...room, items: room.items.map((item, n) => (n === room.index ? { ...item, status: 'preparing' } : item)) }
  assert.equal(applyOp(preparing, { op: 'ready', gate: room.gate.id }, by(1100)).changed, false)
  assert.equal(settle(preparing, new Map(), 1100).changed, false)
})

test('a viewer joining while the gate is open is waited for; one joining while it plays is not', () => {
  let room = applyOp(fresh(), { op: 'play' }, by(0)).room
  room = applyOp(room, { op: 'select', index: 1 }, by(1000, 'a', 'Alice', alone)).room
  room = applyOp(room, { op: 'ready', gate: room.gate.id }, by(1500, 'a', 'Alice', both)).room
  assert.notEqual(room.gate, null, 'Bob joined before Alice was ready, so he is waited for')
  room = applyOp(room, { op: 'ready', gate: room.gate.id }, by(4000, 'b', 'Bob', both)).room
  assert.equal(room.gate, null)
  const three = new Map([...both, ['c', 'Carol']])
  assert.equal(settle(room, three, 5000).changed, false, 'Carol joining a playing room does not stop it')
})

test('a viewer who drops out is no longer waited for', () => {
  let room = applyOp(fresh(), { op: 'play' }, by(0)).room
  room = applyOp(room, { op: 'select', index: 1 }, by(1000)).room
  room = applyOp(room, { op: 'ready', gate: room.gate.id }, by(1500, 'a')).room
  assert.equal(settle(room, both, 2000).changed, false)
  const result = settle(room, alone, 3000)
  assert.equal(result.changed, true)
  assert.equal(result.room.gate, null)
  assert.equal(clockOf(result.room).playing, true)
  assert.equal(result.room.updatedAt, 3000 + lead)
})

test('nobody present: the gate stays until people are back', () => {
  const room = createRoom({ id: 'r', title: 'T', source: 'local', items, createdBy: 'A', now: 0 })
  assert.equal(settle(room, new Map(), 1000).changed, false)
})

test('after the timeout anyone may start without the viewers still loading, who then cannot stall the room for a while', () => {
  let room = applyOp(fresh(), { op: 'play' }, by(0)).room
  room = applyOp(room, { op: 'select', index: 1 }, by(1000)).room
  room = applyOp(room, { op: 'ready', gate: room.gate.id }, by(1500, 'a')).room
  const early = applyOp(room, { op: 'skip', gate: room.gate.id }, by(1000 + SKIP_AFTER_MS - 1))
  assert.equal(early.changed, false)
  assert.match(early.error, /too early/)
  const skipped = applyOp(room, { op: 'skip', gate: room.gate.id }, by(1000 + SKIP_AFTER_MS))
  assert.equal(skipped.announce, true)
  assert.deepEqual(skipped.room.last.skipped, ['Bob'])
  room = skipped.room
  assert.equal(room.gate, null)
  assert.equal(clockOf(room).playing, true)
  const start = room.updatedAt
  // Bob catches up by himself; his stalls are ignored during the cooldown.
  assert.equal(applyOp(room, { op: 'stall', position: 1 }, by(start + STALL_REARM_MS, 'b', 'Bob')).changed, false)
  assert.equal(applyOp(room, { op: 'stall', position: 1 }, by(1000 + SKIP_AFTER_MS + STALL_COOLDOWN_MS, 'b', 'Bob')).changed, true)
})

test('a paused wait counts from the play for "start without"', () => {
  let room = applyOp(fresh(), { op: 'seek', position: 10 }, by(0)).room
  room = applyOp(room, { op: 'play' }, by(60_000)).room
  assert.equal(applyOp(room, { op: 'skip', gate: room.gate.id }, by(60_000 + SKIP_AFTER_MS - 1)).changed, false)
})

test('a paused room passes its gate without starting', () => {
  let room = applyOp(fresh(), { op: 'seek', position: 10 }, by(0)).room
  room = allReady(room, 500)
  assert.equal(room.gate, null)
  assert.equal(clockOf(room).playing, false)
  assert.equal(positionAt(room, 9000), 10)
})

test('a stall pauses everyone where the stalled viewer is, and all resume together when it is ready', () => {
  let room = applyOp(fresh(), { op: 'play' }, by(0)).room
  room = applyOp(room, { op: 'stall', position: 19.5 }, by(20_000, 'b', 'Bob')).room
  assert.equal(room.gate.reason, 'stall')
  assert.equal(room.gate.by, 'b')
  assert.equal(clockOf(room).playing, false)
  assert.equal(positionAt(room, 25_000), 19.5)
  // Alice is counted ready (she has it buffered); only Bob is waited for.
  assert.deepEqual(room.gate.ready, ['a'])
  room = applyOp(room, { op: 'ready', gate: room.gate.id }, by(26_000, 'b', 'Bob')).room
  assert.equal(room.gate, null)
  assert.equal(positionAt(room, 26_000 + lead + 1000), 20.5)
})

test('a stall never takes the room back further than a few seconds', () => {
  let room = applyOp(fresh(), { op: 'play' }, by(0)).room
  room = applyOp(room, { op: 'stall', position: 2 }, by(60_000, 'b', 'Bob')).room
  assert.equal(room.position, 50)
})

test('stalls do not flap: none in a paused room, during a wait, or right after a start', () => {
  assert.equal(applyOp(fresh(), { op: 'stall', position: 0 }, by(10_000, 'b')).changed, false)
  let room = applyOp(fresh(), { op: 'play' }, by(0)).room
  room = applyOp(room, { op: 'stall', position: 9.8 }, by(10_000, 'b', 'Bob')).room
  assert.equal(applyOp(room, { op: 'stall', position: 9.8 }, by(10_200, 'a')).changed, false, 'a second stall during the wait')
  room = applyOp(room, { op: 'ready', gate: room.gate.id }, by(11_000, 'b', 'Bob')).room
  const start = room.updatedAt
  assert.equal(applyOp(room, { op: 'stall', position: 9.8 }, by(start + STALL_REARM_MS - 1, 'b', 'Bob')).changed, false, 'the players spinning up')
  assert.equal(applyOp(room, { op: 'stall', position: 9.8 }, by(start + STALL_REARM_MS, 'b', 'Bob')).changed, true)
})

test('a room nobody is in any more stops its clock and waits for its viewers again', () => {
  let room = applyOp(fresh(), { op: 'play' }, by(0)).room
  room = hold(room, 30_000)
  assert.equal(clockOf(room).playing, false)
  assert.equal(positionAt(room, 90_000), 30)
  room = allReady(room, 90_000, alone)
  assert.equal(positionAt(room, 90_000 + lead + 1000), 31)
})

test('a seek during a wait starts the wait over', () => {
  let room = applyOp(fresh(), { op: 'play' }, by(0)).room
  room = applyOp(room, { op: 'seek', position: 10 }, by(1000)).room
  room = applyOp(room, { op: 'ready', gate: room.gate.id }, by(1100, 'a')).room
  room = applyOp(room, { op: 'seek', position: 50 }, by(1200, 'b', 'Bob')).room
  assert.deepEqual(room.gate.ready, [])
  assert.equal(room.position, 50)
})

test('the switch to the next episode is scheduled for the end of this one once every viewer has it ready', async () => {
  const { advance, advanceOf, applyOp, createRoom, settle } = await import('../src/room.js')
  const items = [{ status: 'ready', duration: 100 }, { status: 'ready', duration: 100 }]
  const present = new Map([['a', 'A'], ['b', 'B']])
  let room = createRoom({ id: 'r', title: 't', source: 'local', items, createdBy: 'x', now: 0 })
  for (const id of ['a', 'b']) room = applyOp(room, { op: 'ready', gate: 1 }, { by: id, clientId: id, now: 10, present }).room
  room = applyOp(room, { op: 'play', position: 0 }, { by: 'a', clientId: 'a', now: 20, present }).room
  room = settle(room, present, 30).room
  assert.equal(room.gate, null)
  assert.equal(advanceOf(room, present.keys()), null, 'nobody has said the next episode is ready')
  room = applyOp(room, { op: 'nextready', from: 0 }, { by: 'a', clientId: 'a', now: 40, present }).room
  assert.equal(advanceOf(room, present.keys()), null, 'one of two is not enough')
  room = applyOp(room, { op: 'nextready', from: 0 }, { by: 'b', clientId: 'b', now: 50, present }).room
  const due = advanceOf(room, present.keys())
  assert.deepEqual(due.to, 1)
  assert.equal(due.at, room.updatedAt + 100_000, 'at the end of the episode on the room clock')
  // A viewer joining who is not ready cancels it; so does a pause.
  assert.equal(advanceOf(room, [...present.keys(), 'c']), null)
  const paused = applyOp(room, { op: 'pause', position: 10 }, { by: 'a', clientId: 'a', now: 60, present }).room
  assert.equal(advanceOf(paused, present.keys()), null)
  // The viewers' own "ended" reports are left to the scheduled switch.
  assert.equal(applyOp(room, { op: 'ended', from: 0 }, { by: 'a', clientId: 'a', now: due.at, present }).changed, false)
  const next = advance(room, due.to, due.at)
  assert.deepEqual([next.index, next.position, next.updatedAt, next.gate, next.playing, next.nextReady], [1, 0, due.at, null, true, null])
  // Without it, "ended" still goes through the gate.
  const plain = applyOp(paused, { op: 'ended', from: 0 }, { by: 'a', clientId: 'a', now: 70, present })
  assert.equal(plain.room.gate?.reason, 'load')
})
