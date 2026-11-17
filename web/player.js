/**
 * The browser side of a room: the sync channel, the clock, and a player
 * kept in step with the room.
 *
 * The room's state on the server is the truth. Each viewer measures its
 * clock offset to the server, computes where the room is now, and corrects
 * its own player toward that (src/sync.js). What the viewer does in the
 * player (play, pause, seek, rate, end of an episode, a stall) goes to the
 * server as an operation; the server's next state brings everyone along.
 * While the room's ready gate is open (src/room.js) the player holds at the
 * room's position and says `ready` once it can play a few seconds ahead;
 * a start the server set slightly in the future is kept to the millisecond.
 * A dropped socket leaves the local player alone; the next state resyncs it.
 */
import { DRIFT, clockOffset, correction, expectedPosition, preloadDue } from './sync.js'
import { canStart, offerTap, shouldPrime } from './readiness.js'
import { defaultCaption, parseCaption } from './captions.js'

/** Reconcile the player with the room this often. */
const TICK_MS = 500
/** Clock pings: a quick burst on connect, then one this often. */
const PING_MS = 10_000
const PING_BURST = 5
const PING_SAMPLES = 8
/** After a seek, let the player settle this long before correcting again. */
const SEEK_SETTLE_MS = 1500
/** Buffering shorter than this does not stop the room. */
const STALL_GRACE_MS = 1000
/** A ready report the server has not acknowledged is sent again after this long (a reconnect lost it). */
const READY_RESEND_MS = 2000
/** After a start, the player gets this long to spin up before drift or stalls count. */
const START_SETTLE_MS = 1000
/** Events that count as a tap for letting media play (touchend on iOS, click elsewhere). */
const TAP_EVENTS = ['touchend', 'click']
/** Reconnect delays. */
const RETRY_MS = [500, 1000, 2000, 4000, 8000]
/** A seek in the native controls fires several events while dragging; report the last. */
const SEEK_DEBOUNCE_MS = 250
/** How long our own commands' events are not reported as the viewer's. */
const QUIET_MS = 1500
/** After the viewer acts, corrections wait this long for the server to echo it. */
const ECHO_WAIT_MS = 1500
/** Paused players are moved when this far from the room. */
const PAUSED_TOLERANCE_S = DRIFT.ignore
/** A priming play that has not started by then is given up. */
const PRIME_LIMIT_MS = 5000
/**
 * WebKit lets a media element play with sound only once that very element was played from a tap; a second element swapped
 * in would not be allowed to start. There the one element stays and is reused, and the next episode is not preloaded.
 */
const swapKeepsPlayPermission = () => !('webkitSupportsPresentationMode' in HTMLVideoElement.prototype)

/** An HTML <video> as a media hub player, with hls.js where the browser has no native HLS. */
function createVideoPlayer(stage, events, { base, language, trackLabel }) {
  let video = null
  let hls = null
  let src = null
  /** The next episode loading in a second element, swapped in when the room gets there: { url, video }. */
  let next = null
  const expect = { play: 0, pause: 0, rate: null, seekTo: null, seekUntil: 0 }
  let seekTimer = null
  /** A muted play started only to make the browser load (see prime); its events are not the viewer's. */
  let priming = false
  /** When each element last fetched media data. */
  const progressAt = new WeakMap()

  const now = () => Date.now()
  const absolute = item => new URL(item.src, document.baseURI).href

  /** A <video> whose events are the player's: only the one in front reports. */
  function makeVideo() {
    const el = document.createElement('video')
    el.className = 'vsync-media'
    el.playsInline = true
    el.preload = 'auto'
    const front = () => el === video
    const reports = () => front() && !priming
    el.addEventListener('loadstart', () => progressAt.set(el, now()))
    el.addEventListener('progress', () => progressAt.set(el, now()))
    el.addEventListener('playing', () => { el.dataset.played = 'true' })
    el.addEventListener('play', () => {
      if (!reports() || now() <= expect.play) return
      events.onPlay?.(el.currentTime)
    })
    el.addEventListener('pause', () => {
      if (!reports() || el.ended || now() <= expect.pause) return
      events.onPause?.(el.currentTime)
    })
    el.addEventListener('seeking', () => {
      if (!reports()) return
      if (expect.seekTo !== null && now() <= expect.seekUntil && Math.abs(el.currentTime - expect.seekTo) < 0.5) return
      clearTimeout(seekTimer)
      events.onLocal?.()
      seekTimer = setTimeout(() => events.onSeek?.(el.currentTime), SEEK_DEBOUNCE_MS)
    })
    el.addEventListener('ratechange', () => {
      if (!reports()) return
      if (expect.rate !== null && Math.abs(el.playbackRate - expect.rate) < 1e-6) return
      events.onRate?.(el.playbackRate)
    })
    el.addEventListener('ended', () => { if (front()) events.onEnded?.() })
    el.addEventListener('loadedmetadata', () => { if (front() && Number.isFinite(el.duration)) events.onDuration?.(el.duration) })
    el.addEventListener('error', () => { if (front()) events.onError?.(el.error?.message || 'This video could not be played.') })
    return el
  }

  /** Every subtitle as a track the native controls offer; the one src/captions.js picks for the viewer is on, or none. */
  function addTracks(el, item) {
    for (const track of [...el.querySelectorAll('track')]) track.remove()
    const on = defaultCaption(item.subtitles.map(sub => sub.label), language)
    for (const [n, sub] of item.subtitles.entries()) {
      const track = document.createElement('track')
      const caption = parseCaption(sub.label)
      track.kind = 'subtitles'
      track.label = trackLabel(sub.label) || String(n + 1)
      if (caption.language !== null) track.srclang = caption.tag
      track.src = new URL(sub.src, document.baseURI).href
      if (n === on) track.default = true
      el.append(track)
    }
  }

  const release = (el) => {
    el.removeAttribute('src')
    el.load()
    el.remove()
  }

  function dropNext() {
    if (next !== null) release(next.video)
    next = null
  }

  video = makeVideo()
  video.controls = true
  stage.append(video)

  /** A playlist that may still grow (an episode being fetched) starts where the room is, not at its newest segment. */
  async function attachHls(url, startAt) {
    const { default: Hls } = await import(new URL('hls.mjs', base).href)
    if (!Hls.isSupported()) throw new Error('This browser cannot play HLS.')
    hls = new Hls({ startPosition: startAt })
    hls.loadSource(url)
    hls.attachMedia(video)
  }

  /** Put the preloaded element in front of the finished one, keeping the viewer's volume. */
  function swapIn(startAt) {
    const old = video
    video = next.video
    next = null
    video.controls = true
    video.className = 'vsync-media'
    video.dataset.swapped = 'true'
    video.volume = old.volume
    video.muted = old.muted
    old.replaceWith(video)
    release(old)
    if (startAt > 0) video.currentTime = startAt
    // Its metadata arrived while it was loading in the background, when it did not speak for the room.
    if (Number.isFinite(video.duration)) events.onDuration?.(video.duration)
  }

  /** What readiness.js needs to know about an element. */
  const media = el => ({
    readyState: el.readyState,
    seeking: el.seeking,
    at: el.currentTime,
    duration: el.duration,
    ranges: Array.from({ length: el.buffered.length }, (_, n) => [el.buffered.start(n), el.buffered.end(n)]),
    loadIdleMs: now() - (progressAt.get(el) ?? 0),
  })

  /**
   * Play muted until playback really starts, then pause and go back to where it stood. Safari on iOS loads (almost)
   * nothing for a paused element, so this is what gets the data in. Muted, it needs no tap; from a tap it also lets the
   * element play with sound later. The play() call happens synchronously, so a tap that calls this still counts.
   */
  function prime() {
    const el = video
    if (priming || !el.paused) return Promise.resolve(false)
    const at = el.currentTime
    const muted = el.muted
    priming = true
    el.muted = true
    return new Promise((resolve) => {
      let settled = false
      const done = (ok) => {
        if (settled) return
        settled = true
        el.removeEventListener('playing', onPlaying)
        clearTimeout(timer)
        expect.pause = now() + QUIET_MS
        if (!el.paused) el.pause()
        el.muted = muted
        if (Math.abs(el.currentTime - at) > 0.01) {
          expect.seekTo = at
          expect.seekUntil = now() + 5000
          el.currentTime = at
        }
        // The pause and seek events above are still on their way; they are ours, not the viewer's.
        setTimeout(() => { priming = false }, 0)
        resolve(ok)
      }
      const onPlaying = () => done(true)
      el.addEventListener('playing', onPlaying)
      const timer = setTimeout(() => done(el.readyState >= 3), PRIME_LIMIT_MS)
      Promise.resolve(el.play()).catch(() => done(false))
    })
  }

  return {
    kind: 'file',
    /** Load the next episode in the background, so switching to it is near-instant. Not for HLS through hls.js, which is not preloaded. */
    preload(item) {
      const url = absolute(item)
      if (next?.url === url || url === src || !swapKeepsPlayPermission()) return
      if (item.kind === 'hls' && video.canPlayType('application/vnd.apple.mpegurl') === '') return
      dropNext()
      const el = makeVideo()
      el.className = 'vsync-preload'
      el.setAttribute('aria-hidden', 'true')
      addTracks(el, item)
      el.src = url
      stage.append(el)
      next = { url, video: el }
    },
    load(item, startAt = 0) {
      const url = absolute(item)
      if (url === src) return
      src = url
      hls?.destroy()
      hls = null
      expect.seekTo = startAt
      expect.seekUntil = now() + 5000
      // A preloaded episode that can play is swapped in (not while the old one is full screen or in a picture-in-picture window).
      const usable = next?.url === url && next.video.readyState >= 3 && document.fullscreenElement !== video && document.pictureInPictureElement !== video
      if (usable) return swapIn(startAt)
      dropNext()
      addTracks(video, item)
      if (item.kind === 'hls' && video.canPlayType('application/vnd.apple.mpegurl') === '') {
        attachHls(url, startAt).catch(error => events.onError?.(error.message))
      } else {
        video.src = url
      }
      if (startAt > 0) video.currentTime = startAt
      return undefined
    },
    ready: () => video.readyState >= 1,
    duration: () => video.duration,
    /** The next episode is loaded far enough to start at once when its turn comes. */
    nextReady: () => next !== null && next.video.currentTime < 0.05 && canStart(media(next.video)),
    canStart: () => !priming && canStart(media(video)),
    loadIdleMs: () => media(video).loadIdleMs,
    prime,
    get priming() { return priming },
    /**
     * On the viewer's first tap in the room, play and pause the element at once (muted, so nothing is heard). WebKit then
     * lets this element play with sound from then on, which the room's later starts need.
     */
    warm() {
      if (video.dataset.played === 'true' || !video.paused || priming) return
      const muted = video.muted
      expect.play = now() + QUIET_MS
      expect.pause = now() + QUIET_MS
      video.muted = true
      Promise.resolve(video.play()).catch(() => {})
      video.pause()
      video.muted = muted
    },
    position: () => video.currentTime,
    paused: () => video.paused,
    buffering: () => !video.paused && video.readyState < 3,
    rate: () => video.playbackRate,
    play() {
      expect.play = now() + QUIET_MS
      return video.play()
    },
    pause() {
      expect.pause = now() + QUIET_MS
      video.pause()
    },
    seek(to) {
      expect.seekTo = to
      expect.seekUntil = now() + 5000
      video.currentTime = to
    },
    setRate(rate) {
      if (Math.abs(video.playbackRate - rate) < 1e-6) return
      expect.rate = rate
      video.playbackRate = rate
    },
    get element() { return video },
    destroy() {
      clearTimeout(seekTimer)
      hls?.destroy()
      dropNext()
      release(video)
    },
  }
}

const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(9)), b => b.toString(16).padStart(2, '0')).join('')

/** One id per browser tab, kept across reconnects and reloads of the tab. */
function tabClientId() {
  try {
    const stored = sessionStorage.getItem('media-hub.clientId')
    if (stored) return stored
    const id = randomId()
    sessionStorage.setItem('media-hub.clientId', id)
    return id
  } catch {
    return randomId()
  }
}

/**
 * Join a room.
 * @param {object} options
 * @param {URL} options.base - the /media-hub/ base URL
 * @param {string} options.roomId
 * @param {string} options.name - shown to the others
 * @param {HTMLElement} options.stage - element the player fills
 * @param {(view: object) => void} options.onUpdate - connection, room, members, needsGesture, drift
 * @param {(event: object) => void} options.onEvent - { kind: 'action', last } | { kind: 'joined' | 'left', name }
 */
export function joinRoom({ base, roomId, name, language = '', trackLabel = label => label, stage, onUpdate, onEvent }) {
  const clientId = tabClientId()
  const samples = []
  let offset = null
  let ws = null
  let retry = 0
  let retryTimer = null
  let pingTimer = null
  let pingSeq = 0
  let state = null
  let player = null
  let loadedIndex = null
  let lastSeq = null
  let lastMembers = null
  let settleUntil = 0
  let nudging = false
  let needsGesture = false
  let playAttempts = 0
  let stalled = false
  let bufferingSince = null
  let readySent = { gate: null, at: 0 }
  let startTimer = null
  let connection = 'connecting'
  let closed = false
  let lastDrift = null
  let localUntil = 0
  let advancing = false
  let advanceTimer = null
  let nextSent = null
  /** While the open gate waits for this viewer: { gate, since, primed }. */
  let held = null

  const serverNow = () => Date.now() + (offset?.offset ?? 0)

  function view() {
    onUpdate({
      connection,
      room: state?.room ?? null,
      members: state?.members ?? [],
      clientId,
      needsGesture,
      drift: lastDrift,
      rtt: offset?.rtt ?? null,
      wait: waitView(),
    })
  }

  /** The open ready gate as the page shows it: whether it holds a playing room, for how long, whether "start without" is offered. */
  function waitView() {
    const gate = state?.room.gate ?? null
    if (gate === null) return null
    const now = serverNow()
    const tap = held?.gate === gate.id && typeof player?.prime === 'function' && offerTap({ loadingMs: Date.now() - held.since })
    return { reason: gate.reason, held: state.room.playing, age: now - gate.since, canSkip: now >= gate.skipAt, tap }
  }

  function send(message) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message))
  }

  function op(message) {
    send({ t: 'op', ...message })
  }

  function ping() {
    send({ t: 'ping', id: ++pingSeq, client: Date.now() })
  }

  function connect() {
    if (closed) return
    const url = new URL(`ws?room=${encodeURIComponent(roomId)}`, base)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    ws = new WebSocket(url)
    ws.addEventListener('open', () => {
      retry = 0
      nextSent = null
      send({ t: 'hello', clientId, name })
      for (let n = 0; n < PING_BURST; n++) setTimeout(ping, n * 150)
      clearInterval(pingTimer)
      pingTimer = setInterval(ping, PING_MS)
    })
    ws.addEventListener('message', (event) => {
      let message
      try {
        message = JSON.parse(event.data)
      } catch {
        return
      }
      if (message.t === 'pong') {
        samples.push({ sent: message.client, received: Date.now(), server: message.server })
        if (samples.length > PING_SAMPLES) samples.shift()
        offset = clockOffset(samples)
      } else if (message.t === 'state') {
        if (offset === null) offset = { offset: message.serverTime - Date.now(), rtt: Infinity }
        receive(message)
      }
    })
    ws.addEventListener('close', (event) => {
      clearInterval(pingTimer)
      if (closed) return
      if (event.code === 4404 || event.code === 4410) {
        connection = 'closed'
        view()
        return
      }
      connection = 'reconnecting'
      view()
      retryTimer = setTimeout(connect, RETRY_MS[Math.min(retry++, RETRY_MS.length - 1)])
    })
  }

  function receive(message) {
    const previous = state
    state = message
    connection = 'live'
    const last = message.room.last
    if (last !== null && lastSeq !== null && last.seq > lastSeq && last.clientId !== clientId) onEvent({ kind: 'action', last, item: message.room.items[last.index] })
    if (last !== null && last.clientId === clientId && last.seq > (lastSeq ?? 0)) localUntil = 0
    if (last !== null) lastSeq = Math.max(lastSeq ?? 0, last.seq)
    else lastSeq ??= 0
    const names = new Map(message.members.filter(m => m.clientId !== clientId).map(m => [m.clientId, m.name]))
    if (lastMembers !== null) {
      for (const [id, who] of names) if (!lastMembers.has(id)) onEvent({ kind: 'joined', name: who })
      for (const [id, who] of lastMembers) if (!names.has(id)) onEvent({ kind: 'left', name: who })
    }
    lastMembers = names
    if (previous?.room.index !== message.room.index) settleUntil = 0
    scheduleAdvance(message.clock.advance)
    reconcile()
    view()
  }

  /** The viewer did something in the player: let the server's answer, not the old state, decide. */
  const local = () => { localUntil = Date.now() + ECHO_WAIT_MS }
  const events = {
    onLocal: local,
    onPlay: (position) => {
      local()
      op({ op: 'play', position })
    },
    onPause: (position) => {
      local()
      op({ op: 'pause', position })
    },
    onSeek: (position) => {
      local()
      settleUntil = Date.now() + SEEK_SETTLE_MS
      op({ op: 'seek', position })
    },
    onRate: (rate) => {
      local()
      op({ op: 'rate', rate })
    },
    onEnded: () => op({ op: 'ended', from: state?.room.index }),
    onDuration: duration => op({ op: 'duration', index: state?.room.index, duration }),
    onError: message => onEvent({ kind: 'error', message }),
  }

  /**
   * The server scheduled the switch to the next episode at the moment this one ends on the room's clock, because everyone
   * has it loaded: make the switch here at that moment too, without waiting for the server's word to arrive.
   */
  function scheduleAdvance(advance) {
    if (advance === null || advance === undefined) {
      clearTimeout(advanceTimer?.id)
      advanceTimer = null
      return
    }
    if (advanceTimer?.at === advance.at && advanceTimer.to === advance.to) return
    clearTimeout(advanceTimer?.id)
    advanceTimer = {
      at: advance.at,
      to: advance.to,
      id: setTimeout(() => {
        advanceTimer = null
        if (state === null || state.room.index !== advance.to - 1) return
        const duration = state.room.items[advance.to]?.duration ?? null
        advancing = true
        state = { ...state, room: { ...state.room, index: advance.to }, clock: { ...state.clock, playing: true, position: 0, updatedAt: advance.at, duration, advance: null } }
        reconcile()
        view()
      }, Math.max(0, advance.at - serverNow())),
    }
  }

  /** Hold at the room's position until the start the server set, then start on the dot. */
  function scheduleStart(at) {
    if (startTimer?.at === at) return
    clearTimeout(startTimer?.id)
    startTimer = {
      at,
      id: setTimeout(() => {
        startTimer = null
        const current = player
        if (current === null || !current.paused()) return
        settleUntil = Date.now() + START_SETTLE_MS
        Promise.resolve(current.play()).catch(() => {
          needsGesture = true
          view()
        })
      }, Math.max(0, at - serverNow())),
    }
  }

  function cancelStart() {
    clearTimeout(startTimer?.id)
    startTimer = null
  }

  /** Tell the room this viewer can play from the gate's position. */
  function reportReady(current) {
    const gate = state.room.gate
    if (gate === null) return
    if (state.members.find(member => member.clientId === clientId)?.wait !== 'loading') return
    if (Math.abs(current.position() - state.clock.position) > PAUSED_TOLERANCE_S || !current.canStart()) return
    if (readySent.gate === gate.id && Date.now() - readySent.at < READY_RESEND_MS) return
    readySent = { gate: gate.id, at: Date.now() }
    op({ op: 'ready', gate: gate.id, ...(Number.isFinite(offset?.rtt) ? { rtt: Math.round(offset.rtt) } : {}) })
  }

  const ownWait = () => state.members.find(member => member.clientId === clientId)?.wait ?? null

  /** Keep track of how long the gate has waited for this viewer, and prime a player that does not load while paused. */
  function helpLoading(current) {
    const gate = state.room.gate
    if (gate === null || ownWait() !== 'loading') {
      held = null
      return
    }
    if (held?.gate !== gate.id) held = { gate: gate.id, since: Date.now(), primed: false }
    if (typeof current.prime !== 'function') return
    if (!shouldPrime({ heldMs: Date.now() - held.since, ready: current.canStart(), paused: current.paused(), loadIdleMs: current.loadIdleMs(), primed: held.primed })) return
    held.primed = true
    current.prime().then(() => reconcile())
  }

  function ensurePlayer() {
    if (player !== null) return player
    player = createVideoPlayer(stage, events, { base, language, trackLabel })
    loadedIndex = null
    return player
  }

  /**
   * Report buffering that lasts, once per stall, so the room waits for this
   * viewer. Buffering right after our own seek or a start is the player
   * spinning up, not a stall; the server debounces as well.
   */
  function watchBuffering(current) {
    const now = Date.now()
    const buffering = current.buffering()
    bufferingSince = buffering ? (bufferingSince ?? now) : null
    if (!buffering) stalled = false
    if (!buffering || stalled || now - bufferingSince < STALL_GRACE_MS || now < settleUntil) return
    if (!state.clock.playing || serverNow() < state.clock.updatedAt) return
    stalled = true
    op({ op: 'stall', position: current.position() })
  }

  function reconcile() {
    if (state === null) return
    const { room, clock } = state
    const item = room.items[room.index]
    if (item === undefined || item.status !== 'ready') {
      cancelStart()
      if (player !== null && loadedIndex !== room.index) {
        player.destroy()
        player = null
        loadedIndex = null
      }
      return
    }
    const target = expectedPosition(clock, serverNow())
    const current = ensurePlayer()
    if (loadedIndex !== room.index) {
      loadedIndex = room.index
      settleUntil = advancing ? 0 : Date.now() + SEEK_SETTLE_MS
      current.load(item, advancing && target < 0.5 ? 0 : target)
      advancing = false
      nudging = false
    }
    helpLoading(current)
    if (current.priming) return
    if (!current.ready() || Date.now() < localUntil) return
    watchBuffering(current)
    // Held by a gate, paused, or a start still ahead: wait at the room's position (a paused player keeps loading).
    const startsLater = clock.playing && serverNow() < clock.updatedAt
    if (!clock.playing || startsLater) {
      if (!current.paused()) current.pause()
      current.setRate(clock.rate)
      nudging = false
      lastDrift = current.position() - target
      if (Math.abs(lastDrift) > PAUSED_TOLERANCE_S && Date.now() > settleUntil) {
        current.seek(target)
        settleUntil = Date.now() + SEEK_SETTLE_MS
      }
      reportReady(current)
      if (startsLater) scheduleStart(clock.updatedAt)
      else cancelStart()
      return
    }
    if (current.paused()) {
      if (Date.now() < settleUntil) return
      // A refused autoplay that the element did not report leaves it paused after its attempt.
      if (playAttempts >= 2 && !needsGesture) {
        needsGesture = true
        view()
      }
      playAttempts += 1
      if (Math.abs(current.position() - target) > PAUSED_TOLERANCE_S) current.seek(target)
      settleUntil = Date.now() + SEEK_SETTLE_MS
      Promise.resolve(current.play()).catch(() => {
        if (!needsGesture) {
          needsGesture = true
          view()
        }
      })
      return
    }
    playAttempts = 0
    if (needsGesture) {
      needsGesture = false
      view()
    }
    if (current.buffering() || Date.now() < settleUntil) return
    const fix = correction({ local: current.position(), expected: target, rate: clock.rate, nudging })
    lastDrift = fix.drift
    if (fix.action === 'seek') {
      current.seek(fix.to)
      current.setRate(clock.rate)
      nudging = false
      settleUntil = Date.now() + SEEK_SETTLE_MS
    } else if (fix.action === 'rate') {
      current.setRate(fix.rate)
      nudging = true
    } else {
      current.setRate(clock.rate)
      nudging = false
    }
  }

  /** Start loading the next episode in the background once this one is close to its end (or short). */
  function preloadNext() {
    if (player === null || state === null) return
    const next = state.room.items[state.room.index + 1]
    if (next === undefined || next.status !== 'ready' || loadedIndex !== state.room.index) return
    if (preloadDue({ duration: player.duration(), position: player.position() })) player.preload(next)
    // Tell the room this viewer can switch with no waiting, so it can schedule the switch for the end of the episode.
    if (nextSent !== state.room.index && player.nextReady?.()) {
      nextSent = state.room.index
      op({ op: 'nextready', from: state.room.index })
    }
  }

  /** The viewer's first tap in the room lets the player start with sound later (WebKit asks for that per element). */
  const firstTap = () => {
    if (player === null || typeof player.warm !== 'function') return
    player.warm()
    for (const type of TAP_EVENTS) document.removeEventListener(type, firstTap, true)
  }
  for (const type of TAP_EVENTS) document.addEventListener(type, firstTap, true)

  const tick = setInterval(() => {
    reconcile()
    preloadNext()
    view()
  }, TICK_MS)
  connect()
  view()

  return {
    clientId,
    /** Switch the room to an episode. */
    select(index) {
      op({ op: 'select', index })
    },
    /** Start without the viewers the open gate still waits for. */
    skip() {
      const gate = state?.room.gate
      if (gate) op({ op: 'skip', gate: gate.id })
    },
    /** From a tap: make a player that sits loading start fetching (a muted play, then back to the room's position). */
    continueLoading() {
      if (typeof player?.prime !== 'function') return
      if (held !== null) held.primed = true
      player.prime().then(() => reconcile())
      view()
    },
    /** Start playback after the browser refused to without a click. */
    unlock() {
      needsGesture = false
      playAttempts = 0
      if (player !== null) Promise.resolve(player.play()).catch(() => { needsGesture = true; view() })
      view()
    },
    destroy() {
      closed = true
      for (const type of TAP_EVENTS) document.removeEventListener(type, firstTap, true)
      cancelStart()
      clearTimeout(advanceTimer?.id)
      clearInterval(tick)
      clearInterval(pingTimer)
      clearTimeout(retryTimer)
      ws?.close(1000, 'left')
      player?.destroy()
      player = null
    },
  }
}
