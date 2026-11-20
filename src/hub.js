/**
 * The room service: open rooms, their viewers' sockets, preparing local
 * episodes, and saving rooms so they survive a DSH restart.
 *
 * Wire protocol on /media-hub/ws?room=<id> (JSON text frames):
 *   viewer → server  { t: 'hello', clientId, name }
 *                    { t: 'ping', id, client }                  client = viewer clock, ms
 *                    { t: 'op', op, position?, rate?, index?, from?, duration?, gate?, rtt? }
 *   server → viewer  { t: 'state', room, clock, members, serverTime }   after every change;
 *                    room.gate is the open ready gate, each member's `wait` its part in it
 *                    { t: 'pong', id, client, server }
 *                    { t: 'error', message }
 * A viewer that reconnects says hello again and follows the next state.
 */
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { readJson, writeJson } from './json-file.js'
import { SKIP_AFTER_MS, advance, advanceOf, applyOp, clockOf, createRoom, hold, positionAt, settle, updateItems } from './room.js'
import { scanSource } from './library.js'
import { convertSubtitle, prepareEpisode, pruneCache } from './prepare.js'
import { needs, planPreparing } from './preparing.js'
import { createStreams, finishedPlaylist, streamKey } from './stream.js'

/** Keep-alive ping on each socket; a tunnel drops idle sockets after about 100 s. */
const PING_MS = 20_000
const SAVE_DELAY_MS = 1000
/** How often empty rooms are checked for closing. */
const SWEEP_MS = 60_000
/** How often a playing room's position goes to the watch log. */
const PROGRESS_MS = 120_000
const MAX_NAME = 40

/** A room item for a local episode, waiting to be prepared. */
const localItem = episode => ({ title: episode.title, kind: 'file', status: 'preparing', sourcePath: episode.path, sourceSubtitles: episode.subtitles })
/** A room item for one episode of a show from a source: `slot` is its number, `sourcePath` null while it is not on disk (status `remote`, or `preparing` while it is being fetched). */
const slotItem = (entry, status) => ({ title: entry.title, kind: 'file', slot: entry.n, status: entry.path === null ? status : 'preparing', sourcePath: entry.path, sourceSubtitles: entry.subtitles ?? [] })
/** What identifies an item across its states: its episode number, or its file. */
const itemKey = item => item.slot ?? item.sourcePath
const serviceError = (code, message) => Object.assign(new Error(message), { code })
/** Whether a room is open to others (listed, its link shared), or one person watching alone. Rooms from before the choice were all shared. */
const isTogether = room => room.together !== false
const cleanText = (value, max) => (typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '')

/**
 * @param {object} options
 * @param {string} options.stateDir - rooms.json and the prepared-media cache live here
 * @param {string[]} options.libraryRoots - folders the panel may start rooms from
 * @param {import('./delivery.js').Delivery} options.delivery
 * @param {{ ffmpeg: string, ffprobe: string, maxHeight: number, threads: number }} options.tools
 * @param {() => string | undefined} options.webUrl - the Web UI's advertised root URL, for links
 * @param {{ emptyMinutes: number, unopenedHours: number }} options.lifetime - a room closes this long after its last viewer left, or after it was created when nobody opened it
 * @param {{ info: Function, warn: Function }} options.logger
 * @param {(item: object, show: string | undefined) => object | null} [options.watchOf] - how far an episode was watched, shown in the room's episode list
 * @param {(path: string) => Promise<{ n: number, title: string | null, path: string | null }[] | null>} [options.directory] - every episode of a show from a source (null for other folders), on disk or not
 * @param {{ ahead: number }} [options.cache] - how many episodes after the one a room is on are made ready ahead of time
 * @param {(showPath: string, change: { retry: boolean }) => void} [options.focus] - told when a room on a show goes to another episode, or opens
 * @param {(type: string, detail: object) => void} [options.observe] - told what happens in rooms:
 *   opened { room }, closed { room, position }, joined { room, viewer }, left { room, viewer, position },
 *   op { before, after, op, viewers }, progress { room, position, viewers }
 * @param {() => number} [options.now]
 */
export function createRoomService(options) {
  const { stateDir, libraryRoots, delivery, tools, lifetime, logger, now = Date.now } = options
  const observe = (type, detail) => {
    try {
      options.observe?.(type, detail)
    } catch (error) {
      logger.warn('watch log: %s', error.message)
    }
  }
  const cacheDir = join(stateDir, 'cache')
  const file = join(stateDir, 'rooms.json')
  const rooms = new Map()
  const peers = new Map()
  const waiters = new Map()
  const ahead = options.cache?.ahead ?? 5
  /** Episode files being prepared: path to the run's controller. */
  const preparing = new Map()
  let replanning = false
  let saveTimer = null
  let disposed = false
  /** Rooms waiting on episode `number` of a show while it is not on disk yet. */
  const waitingOn = (show, number) => [...rooms.values()].filter(room => room.showPath === show && room.items.some(item => item.slot === number && item.sourcePath === null && item.status === 'preparing'))
  const streams = createStreams({
    cacheDir,
    tools,
    logger,
    convert: (source, dir, name) => convertSubtitle(source, dir, name, { ffmpeg: tools.ffmpeg }),
    need: () => needs([...rooms.values()], ahead, (room, item) => (room.showPath !== undefined && item.slot !== undefined ? streamKey(room.showPath, item.slot) : null)),
    ready: (show, number, prepared) => {
      for (const room of waitingOn(show, number)) setItem(room.id, number, { status: 'ready', progress: null, error: null, streamed: true, ...prepared })
    },
    // The copy stopped before it was complete: the episode waits for its file (and is prepared from it), or for a room to want it again.
    lost: (show, number) => {
      for (const room of [...rooms.values()]) {
        const item = room.showPath === show ? room.items.find(entry => entry.slot === number && entry.streamed) : undefined
        if (item === undefined) continue
        const waited = typeof item.sourcePath === 'string' || room.items[room.index] === item
        setItem(room.id, number, { status: waited ? 'preparing' : 'remote', streamed: false, progress: null })
      }
    },
  })
  const sweepTimer = setInterval(() => sweep(), SWEEP_MS)
  const progressTimer = setInterval(() => progress(), PROGRESS_MS)

  // ---------------------------------------------------------------- state

  async function load() {
    await mkdir(stateDir, { recursive: true })
    for (const root of libraryRoots) await mkdir(root, { recursive: true }).catch(() => {})
    const data = (await readJson(file, { logger })).value ?? {}
    // Nobody is connected right after a start; viewers who were reconnect within seconds and start together again.
    for (const { holds, ...room } of data.rooms ?? []) rooms.set(room.id, { ...hold({ gate: null, gates: 0, startedAt: null, ...room }, now()), cooldown: {}, nextReady: null, emptySince: room.emptySince ?? (room.opened ? now() : null) })
    sweep()
    for (const room of [...rooms.values()]) await reopen(room)
    for (const path of new Set([...rooms.values()].map(room => room.showPath).filter(Boolean))) await syncShow(path)
  }

  function save() {
    if (saveTimer !== null || disposed) return
    saveTimer = setTimeout(() => {
      saveTimer = null
      flush().catch(error => logger.warn('could not save rooms: %s', error.message))
    }, SAVE_DELAY_MS)
  }

  async function flush() {
    await writeJson(file, { rooms: [...rooms.values()] })
  }

  /** Store a changed room, tell its viewers, save. */
  function commit(room) {
    rooms.set(room.id, { ...room, touchedAt: now() })
    broadcast(room.id)
    save()
    replan()
  }

  // ---------------------------------------------------------------- views

  function publicItem(room, item, index) {
    const roomId = room.id
    const ready = item.status === 'ready'
    return {
      title: item.title ?? null,
      kind: item.kind,
      status: item.status,
      cached: item.slot === undefined || typeof item.sourcePath === 'string',
      progress: item.progress ?? null,
      error: item.error ?? null,
      reason: item.reason ?? null,
      duration: item.duration ?? null,
      watch: options.watchOf?.(item, room.showPath) ?? null,
      src: ready ? delivery.mediaUrl(roomId, index, item) : null,
      subtitles: ready ? (item.subtitles ?? []).map((sub, n) => ({ label: sub.label, src: delivery.subtitleUrl(roomId, index, n) })) : [],
    }
  }

  function publicRoom(room) {
    return {
      id: room.id,
      title: room.title,
      index: room.index,
      seq: room.seq,
      last: room.last,
      playing: room.playing,
      together: isTogether(room),
      gate: room.gate === null ? null : { id: room.gate.id, reason: room.gate.reason, since: room.gate.since, skipAt: room.gate.since + SKIP_AFTER_MS, by: room.gate.by },
      items: room.items.map((item, index) => publicItem(room, item, index)),
    }
  }

  /** Each viewer once (a tab reconnecting may briefly have two sockets), with its part in an open gate: loading, ready or skipped. */
  function members(roomId) {
    const gate = rooms.get(roomId)?.gate ?? null
    const wait = clientId => (gate === null ? null : gate.ready.includes(clientId) ? 'ready' : gate.skipped.includes(clientId) ? 'skipped' : 'loading')
    return [...present(roomId)].map(([clientId, name]) => ({ clientId, name, wait: wait(clientId) }))
  }

  /** Names of the people in a room, each once. */
  const viewers = roomId => [...new Set(members(roomId).map(member => member.name))]

  function summary(room) {
    return {
      opened: room.opened === true,
      emptySince: room.emptySince ?? null,
      id: room.id,
      title: room.title,
      show: room.showPath ?? null,
      episodes: room.items.length,
      index: room.index,
      current: room.items[room.index]?.title ?? '',
      file: room.items[room.index]?.sourcePath ?? null,
      position: positionAt(room, now()),
      duration: room.items[room.index]?.duration ?? null,
      preparing: room.items.filter(item => item.status === 'preparing').length,
      members: viewers(room.id),
      createdBy: room.createdBy,
      createdAt: room.createdAt,
      together: isTogether(room),
      link: linkFor(room.id),
    }
  }

  /** The Web UI's URL opening a room; relative when DSH advertises no URL. */
  function linkFor(id) {
    const root = options.webUrl?.()
    const query = `?media-room=${id}`
    return root ? new URL(query, root).href : query
  }

  // ---------------------------------------------------------------- sockets

  function send(peer, message) {
    if (peer.ws.readyState === 1) peer.ws.send(JSON.stringify(message))
  }

  function stateMessage(roomId) {
    const room = rooms.get(roomId)
    return { t: 'state', room: publicRoom(room), clock: { ...clockOf(room), advance: advanceOf(room, present(roomId).keys()) }, members: members(roomId), serverTime: now() }
  }

  /** One timer per room for the switch to the next episode that is scheduled ahead (src/room.js `advanceOf`). */
  const advanceTimers = new Map()
  function scheduleAdvance(roomId) {
    const room = rooms.get(roomId)
    const due = room === undefined ? null : advanceOf(room, present(roomId).keys())
    const timer = advanceTimers.get(roomId)
    if (due === null || (timer !== undefined && timer.at === due.at && timer.to === due.to)) {
      if (due === null && timer !== undefined) { clearTimeout(timer.id); advanceTimers.delete(roomId) }
      return
    }
    if (timer !== undefined) clearTimeout(timer.id)
    const id = setTimeout(() => {
      advanceTimers.delete(roomId)
      const current = rooms.get(roomId)
      const again = current === undefined ? null : advanceOf(current, present(roomId).keys())
      if (again === null || again.to !== due.to) return
      const after = advance(current, again.to, again.at)
      commit(after)
      observe('op', { before: current, after, op: 'ended', viewers: viewers(roomId), now: now() })
    }, Math.max(0, due.at - now()))
    id.unref?.()
    advanceTimers.set(roomId, { id, at: due.at, to: due.to })
  }

  function broadcast(roomId) {
    if (!rooms.has(roomId)) return
    scheduleAdvance(roomId)
    const message = stateMessage(roomId)
    for (const peer of peers.get(roomId) ?? []) if (peer.clientId !== null) send(peer, message)
  }

  /** The viewers connected to a room: client id to name. */
  function present(roomId) {
    const map = new Map()
    for (const peer of peers.get(roomId) ?? []) if (peer.clientId !== null) map.set(peer.clientId, peer.name)
    return map
  }

  /**
   * Take over one admitted WebSocket for a room.
   * @param {import('ws').WebSocket} ws
   * @param {string} roomId
   */
  function attach(ws, roomId) {
    if (!rooms.has(roomId)) {
      ws.close(4404, 'no such room')
      return
    }
    const peer = { ws, clientId: null, name: 'Guest' }
    if (!peers.has(roomId)) peers.set(roomId, new Set())
    peers.get(roomId).add(peer)
    let alive = true
    const ping = setInterval(() => {
      if (!alive) return ws.terminate()
      alive = false
      ws.ping()
    }, PING_MS)
    ws.on('pong', () => { alive = true })
    ws.on('message', (data) => {
      alive = true
      let message
      try {
        message = JSON.parse(String(data))
      } catch {
        return send(peer, { t: 'error', message: 'not JSON' })
      }
      if (typeof message !== 'object' || message === null) return send(peer, { t: 'error', message: 'not an object' })
      try {
        handle(peer, roomId, message)
      } catch (error) {
        logger.warn('room %s: a message failed: %s', roomId, error.message)
      }
    })
    ws.on('close', () => {
      clearInterval(ping)
      peers.get(roomId)?.delete(peer)
      let room = rooms.get(roomId)
      if (room === undefined) return
      if (peer.clientId !== null && !viewers(roomId).includes(peer.name)) observe('left', { room, viewer: peer.name, position: positionAt(room, now()) })
      if (present(roomId).size === 0) {
        // Nobody left to watch: the clock stops until people are back and ready.
        if (room.opened) commit({ ...hold(room, now()), emptySince: now() })
        return
      }
      // A viewer who left is no longer waited for.
      const result = settle(room, present(roomId), now())
      if (result.changed) commit(result.room)
      else broadcast(roomId)
    })
  }

  function handle(peer, roomId, message) {
    const room = rooms.get(roomId)
    if (room === undefined) return peer.ws.close(4404, 'room closed')
    if (message.t === 'ping') return send(peer, { t: 'pong', id: message.id, client: message.client, server: now() })
    if (message.t === 'hello') {
      const known = viewers(roomId)
      peer.clientId = cleanText(message.clientId, 64) || randomBytes(8).toString('base64url')
      peer.name = cleanText(message.name, MAX_NAME) || 'Guest'
      if (!known.includes(peer.name)) observe('joined', { room, viewer: peer.name })
      rooms.set(roomId, { ...room, opened: true, emptySince: null, touchedAt: now() })
      broadcast(roomId)
      save()
      return undefined
    }
    if (message.t !== 'op' || peer.clientId === null) return send(peer, { t: 'error', message: 'say hello first' })
    const result = applyOp(room, message, { by: peer.name, clientId: peer.clientId, now: now(), present: present(roomId) })
    if (result.error) return send(peer, { t: 'error', message: result.error })
    if (!result.changed) return undefined
    const moved = result.room.index !== room.index && result.room.showPath !== undefined
    const after = moved ? wanting(result.room) : result.room
    commit(after)
    observe('op', { before: room, after, op: message.op, viewers: viewers(roomId), now: now() })
    // Going to an episode that is missing, or whose fetch failed, asks for it again.
    if (moved) options.focus?.(after.showPath, { retry: after !== result.room || result.room.items[result.room.index]?.status === 'failed' })
    return undefined
  }

  /** Close rooms nobody is in any more: empty too long, or never opened. */
  function sweep() {
    for (const room of [...rooms.values()]) {
      if (present(room.id).size > 0) continue
      const age = room.opened ? now() - (room.emptySince ?? now()) : now() - room.createdAt
      const limit = room.opened ? lifetime.emptyMinutes * 60_000 : lifetime.unopenedHours * 3_600_000
      if (age >= limit) close(room.id)
    }
  }

  /** Tell the watch log where playing rooms are. */
  function progress() {
    for (const room of rooms.values()) {
      if (room.playing && present(room.id).size > 0) observe('progress', { room, position: positionAt(room, now()), viewers: viewers(room.id) })
    }
  }

  function close(id) {
    const room = rooms.get(id)
    if (room === undefined) return false
    observe('closed', { room, position: positionAt(room, now()), viewers: viewers(id) })
    rooms.delete(id)
    clearTimeout(advanceTimers.get(id)?.id)
    advanceTimers.delete(id)
    for (const peer of peers.get(id) ?? []) peer.ws.close(4410, 'room closed')
    peers.delete(id)
    save()
    replan()
    return true
  }

  // ---------------------------------------------------------------- items

  /** Change one item, found by its key (episode number or source file). */
  function setItem(roomId, key, patch) {
    const room = rooms.get(roomId)
    if (room === undefined) return
    const items = room.items.map(item => (itemKey(item) === key ? { ...item, ...patch } : item))
    commit(updateItems(room, items))
    if (patch.status !== undefined && patch.status !== 'preparing') {
      for (const resolveWaiter of waiters.get(`${roomId}/${key}`) ?? []) resolveWaiter()
      waiters.delete(`${roomId}/${key}`)
    }
  }

  /** A room standing on an episode that is not on disk shows it as preparing while the cache fetches it. */
  function wanting(room) {
    const item = room.items[room.index]
    if (item === undefined || item.slot === undefined || typeof item.sourcePath === 'string' || item.status === 'preparing') return room
    return { ...room, items: room.items.map((entry, n) => (n === room.index ? { ...entry, status: 'preparing', error: null } : entry)) }
  }

  /**
   * Items saved as playable while their copy was still being made (DSH stopped mid-way) are not playable on their
   * own: they are made again when a room needs them.
   */
  async function reopen(room) {
    const unfinished = async item => item.status === 'ready' && item.kind === 'hls' && typeof item.file === 'string'
      && item.file.startsWith(`${cacheDir}/`) && (await finishedPlaylist(dirname(item.file))) === null
    const items = []
    for (const item of room.items) {
      if (!(await unfinished(item))) items.push(item)
      else items.push({ ...item, status: typeof item.sourcePath === 'string' ? 'preparing' : 'remote', streamed: false, progress: null })
    }
    if (items.some((item, n) => item !== room.items[n])) commit(wanting(updateItems(room, items)))
  }

  /** Bring the work on episodes in line with where the rooms are now (src/preparing.js), once the current change is done. */
  function replan() {
    if (replanning || disposed) return
    replanning = true
    queueMicrotask(() => {
      replanning = false
      if (disposed) return
      const all = [...rooms.values()]
      const need = needs(all, ahead, (_, item) => (typeof item.sourcePath === 'string' && !item.streamed ? item.sourcePath : null))
      const waiting = new Set(all.flatMap(room => room.items.filter(item => item.status === 'preparing' && typeof item.sourcePath === 'string' && !item.streamed).map(item => item.sourcePath)))
      const { start, stop } = planPreparing(need, waiting, preparing.keys())
      for (const path of stop) preparing.get(path).abort('left')
      for (const path of start) prepare(path)
      streams.update()
    })
  }

  /** Change every room's item played from `path` (one prepared copy serves them all). */
  function setPath(path, patch) {
    for (const room of [...rooms.values()]) {
      for (const item of room.items) if (item.sourcePath === path && !item.streamed) setItem(room.id, itemKey(item), patch)
    }
  }

  function prepare(path) {
    const item = [...rooms.values()].flatMap(room => room.items).find(entry => entry.sourcePath === path)
    const controller = new AbortController()
    preparing.set(path, controller)
    let last = 0
    prepareEpisode({ title: item.title, path, subtitles: item.sourceSubtitles ?? [] }, {
      cacheDir,
      ffmpeg: tools.ffmpeg,
      ffprobe: tools.ffprobe,
      maxHeight: tools.maxHeight,
      threads: tools.threads,
      signal: controller.signal,
      onReady: prepared => setPath(path, { status: 'ready', progress: null, ...prepared }),
      onProgress: (fraction) => {
        if (fraction - last < 0.02) return
        last = fraction
        setPath(path, { progress: { step: 'prepare', fraction: Math.round(fraction * 100) / 100 } })
      },
    }).then((prepared) => {
      setPath(path, { status: 'ready', progress: null, ...prepared })
    }, (error) => {
      // Stopped because nobody needs it now: what was made so far is not playable on its own.
      if (controller.signal.aborted) return setPath(path, { status: 'preparing', progress: null })
      logger.warn('could not prepare %s: %s', path, error.message)
      return setPath(path, { status: 'failed', progress: null, error: error.message, reason: null })
    }).finally(() => {
      preparing.delete(path)
      replan()
    })
  }

  async function localItems(path, fromPanel) {
    if (typeof path !== 'string' || !isAbsolute(path)) throw serviceError('invalid', 'path must be an absolute path')
    const target = resolve(path)
    if (fromPanel && !libraryRoots.some(root => target === root || target.startsWith(`${root}/`))) {
      throw serviceError('outside', 'the panel can only open files from the library folders')
    }
    const entries = await options.directory?.(target)
    if (entries) return entries.map(entry => slotItem(entry, 'remote'))
    let episodes
    try {
      episodes = await scanSource(target)
    } catch (error) {
      if (error.code === 'ENOENT') throw serviceError('not_found', `${path} does not exist`)
      throw error
    }
    return episodes.map(localItem)
  }

  /**
   * Bring the rooms on a show from a source in line with the files on disk:
   * an episode that landed waits to be prepared (`replan` says when), one
   * that was dropped goes back to not cached. Rooms from before episodes were numbered are rebuilt.
   */
  async function syncShow(path) {
    const target = resolve(path)
    const entries = await options.directory?.(target)
    if (!entries) return
    for (const room of [...rooms.values()]) {
      if (room.showPath !== target) continue
      const current = rooms.get(room.id)
      if (current === undefined) continue
      const legacy = current.items.some(item => item.slot === undefined)
      const before = new Map(current.items.map(item => [legacy ? item.sourcePath : item.slot, item]))
      const items = entries.map((entry) => {
        const prev = before.get(legacy ? entry.path : entry.n)
        // An episode that plays while it downloads keeps playing from its copy when its file lands.
        if (prev?.streamed) return { ...prev, title: entry.title, sourcePath: entry.path, sourceSubtitles: entry.subtitles ?? [] }
        if (entry.path === null) {
          const waiting = prev !== undefined && prev.sourcePath === null && (prev.status === 'preparing' || prev.status === 'failed')
          return waiting ? { ...prev, title: entry.title } : slotItem(entry, 'remote')
        }
        if (prev !== undefined && prev.sourcePath === entry.path) return { ...prev, title: entry.title, slot: entry.n }
        return slotItem(entry, 'remote')
      })
      const playing = current.items[current.index]
      const index = legacy ? Math.max(0, entries.findIndex(entry => entry.path !== null && entry.path === playing?.sourcePath)) : Math.min(current.index, items.length - 1)
      commit(wanting({ ...updateItems(current, items), index }))
    }
  }

  // ---------------------------------------------------------------- operations

  return {
    load,

    /**
     * Create a room on a local file or folder of episodes.
     * @param {{ path: string, title?: string, by?: string, fromPanel?: boolean, together?: boolean, start?: { index: number, position: number } | null }} input - `together`: open to others from the start; else one person watches until they share it
     */
    async createRoom(input) {
      if (!delivery.available) throw serviceError('unsupported', delivery.reason)
      const items = await localItems(input.path, input.fromPanel === true)
      const id = randomBytes(9).toString('base64url')
      const title = cleanText(input.title, 120) || (items.length === 1 ? items[0].title : input.path.split('/').filter(Boolean).pop())
      const created = createRoom({ id, title, items, createdBy: cleanText(input.by, MAX_NAME), now: now() })
      const start = input.start
      const room = {
        ...created,
        showPath: resolve(input.path),
        together: input.together === true,
        ...(Number.isInteger(start?.index) && start.index >= 0 && start.index < items.length ? { index: start.index, position: Math.max(0, Number(start.position) || 0) } : {}),
      }
      commit(wanting(room))
      observe('opened', { room })
      if (room.showPath !== undefined) options.focus?.(room.showPath, { retry: true })
      return { room: summary(rooms.get(id)) }
    },

    /** Resolves once an item is no longer preparing, or after `timeoutMs`. */
    waitReady(roomId, index, timeoutMs) {
      const item = rooms.get(roomId)?.items[index]
      if (item === undefined || item.status !== 'preparing') return Promise.resolve()
      return new Promise((resolveWait) => {
        const key = `${roomId}/${itemKey(item)}`
        const timer = setTimeout(resolveWait, timeoutMs)
        if (!waiters.has(key)) waiters.set(key, [])
        waiters.get(key).push(() => { clearTimeout(timer); resolveWait() })
      })
    },

    room(id) {
      const room = rooms.get(id)
      return room === undefined ? undefined : { ...summary(room), items: room.items.map(item => ({ title: item.title, status: item.status, progress: item.progress ?? null, error: item.error ?? null, reason: item.reason ?? null, subtitles: (item.subtitles ?? []).map(sub => sub.label) })) }
    },

    listRooms() {
      const occupied = room => present(room.id).size > 0
      return [...rooms.values()]
        .sort((a, b) => Number(occupied(b)) - Number(occupied(a)) || (b.touchedAt ?? b.createdAt) - (a.touchedAt ?? a.createdAt))
        .map(summary)
    },

    /** Open a room someone watches alone to others, as it is: same episode, same position. */
    watchTogether(id) {
      const room = rooms.get(id)
      if (room === undefined) throw serviceError('not_found', 'no such room')
      if (!isTogether(room)) commit({ ...room, together: true })
      return { room: summary(rooms.get(id)) }
    },

    closeRoom(id) {
      if (!close(id)) throw serviceError('not_found', 'no such room')
      return { closed: id }
    },

    sweep,

    /** Tell the viewers of rooms on a show its new watch progress. */
    refreshShow(path) {
      for (const room of rooms.values()) if (room.showPath === path) broadcast(room.id)
    },

    /** Whether an open room plays anything from `path` (a show folder or file). */
    usesPath(path) {
      const target = resolve(path)
      return [...rooms.values()].some(room => room.showPath === target || room.items.some(item => typeof item.sourcePath === 'string' && (item.sourcePath === target || item.sourcePath.startsWith(`${target}/`))))
    },

    /** The episode numbers rooms on a show are on, one per room; empty when no room has it open. */
    focusesOf(path) {
      const target = resolve(path)
      return [...rooms.values()].filter(room => room.showPath === target).map(room => room.items[room.index]?.slot).filter(n => n !== undefined)
    },

    syncShow,

    /** Episodes someone waits on that could not be fetched: show them as failed (with the reason, when known), so a click on one tries again. */
    failWaiting(path, message, reason = null) {
      const target = resolve(path)
      for (const room of [...rooms.values()]) {
        if (room.showPath !== target) continue
        const items = room.items.map(item => (item.slot !== undefined && item.sourcePath === null && item.status === 'preparing' ? { ...item, status: 'failed', progress: null, error: message, reason } : item))
        if (items.some((item, n) => item !== room.items[n])) commit(updateItems(rooms.get(room.id), items))
      }
    },

    /**
     * How far the download of episode `number` of a show is, told to the viewers of the rooms waiting on it
     * (a source reports it about once a second).
     * @param {{ fraction: number | null, done: number, total: number | null, speed: number | null, eta: number | null }} progress
     */
    downloadProgress(path, number, progress) {
      const target = resolve(path)
      for (const room of [...rooms.values()]) {
        if (room.showPath !== target) continue
        const item = room.items.find(entry => entry.slot === number && entry.sourcePath === null && entry.status === 'preparing')
        if (item === undefined) continue
        setItem(room.id, number, { progress: { step: 'download', ...progress } })
      }
    },

    /**
     * Episode `number` of a show while a source still fetches it, as files that play while they grow
     * (`growing` settles when they are complete): rooms waiting on it play it once enough is there.
     */
    streamEpisode: (path, number, partial) => streams.offer(resolve(path), number, partial),

    /** The episode number of a room's item in its show (undefined for a room on plain files). */
    slotOf: (roomId, index) => rooms.get(roomId)?.items[index]?.slot,

    /** The prepared file of a ready local item. */
    mediaFile(roomId, index) {
      const item = rooms.get(roomId)?.items[index]
      return item?.status === 'ready' ? { file: item.file, kind: item.kind } : undefined
    },

    subtitleFile(roomId, index, n) {
      const item = rooms.get(roomId)?.items[index]
      return item?.status === 'ready' ? item.subtitles?.[n]?.file : undefined
    },

    attach,
    linkFor,

    /** Remove prepared media no open room uses, older than `days`. */
    pruneCache: days => pruneCache(cacheDir, [...rooms.values()].flatMap(room => room.items.map(item => item.file)), days, now()),

    async dispose() {
      disposed = true
      for (const controller of preparing.values()) controller.abort('stop')
      streams.stop()
      for (const timer of advanceTimers.values()) clearTimeout(timer.id)
      clearInterval(sweepTimer)
      clearInterval(progressTimer)
      for (const set of peers.values()) for (const peer of set) peer.ws.close(1001, 'stopping')
      peers.clear()
      if (saveTimer !== null) {
        clearTimeout(saveTimer)
        saveTimer = null
      }
      await flush().catch(error => logger.warn('could not save rooms: %s', error.message))
    },
  }
}
