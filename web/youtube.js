/**
 * A YouTube embed as a media hub player.
 *
 * YouTube's IFrame Player API is a thin script around a postMessage
 * protocol between the page and the embed (`enablejsapi=1`): the page says
 * `listening`, the embed answers with `infoDelivery` messages (current
 * time, state, rate) and accepts `command` messages (playVideo, seekTo...).
 * Speaking that protocol directly keeps YouTube's script out of the DSH
 * page, which carries the signed-in user's full powers.
 *
 * YouTube only plays at its preset rates, so this player reports
 * `fineRate: false` and drift is corrected by seeking.
 */

const ORIGIN = 'https://www.youtube.com'
const STATES = Object.freeze({ unstarted: -1, ended: 0, playing: 1, paused: 2, buffering: 3, cued: 5 })
/** A jump this far from where playback should be is a seek someone made in the player. */
const JUMP_S = 1.5
/** How long our own command's effects are not reported as the viewer's. */
const QUIET_MS = 1500

/**
 * @param {HTMLElement} stage - the element the player fills
 * @param {object} events - onPlay(position), onPause(position), onSeek(position), onRate(rate), onEnded(), onDuration(seconds), onError(message)
 */
export function createYouTubePlayer(stage, events) {
  const frame = document.createElement('iframe')
  frame.className = 'vsync-media'
  frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'
  frame.allowFullscreen = true
  // The Web UI may send no referrer at all; embeds refuse to play without one.
  frame.referrerPolicy = 'strict-origin-when-cross-origin'
  frame.title = 'YouTube'
  stage.append(frame)

  const id = Math.random().toString(36).slice(2)
  let info = { currentTime: 0, playerState: STATES.unstarted, playbackRate: 1, duration: 0 }
  let infoAt = performance.now()
  let ready = false
  let videoId = null
  let listenTimer = null
  let quietUntil = 0
  let lastPosition = null
  let lastSampleAt = 0
  let duration = null

  const post = message => frame.contentWindow?.postMessage(JSON.stringify({ ...message, id, channel: 'widget' }), ORIGIN)
  const command = (func, args = []) => post({ event: 'command', func, args })

  function listen() {
    clearInterval(listenTimer)
    ready = false
    listenTimer = setInterval(() => post({ event: 'listening' }), 250)
  }
  frame.addEventListener('load', listen)

  function position() {
    const elapsed = info.playerState === STATES.playing ? (performance.now() - infoAt) / 1000 * info.playbackRate : 0
    return info.currentTime + elapsed
  }

  function onMessage(event) {
    if (event.source !== frame.contentWindow || event.origin !== ORIGIN) return
    let data
    try {
      data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
    } catch {
      return
    }
    if (data?.event === 'onReady' || data?.event === 'initialDelivery') {
      clearInterval(listenTimer)
      ready = true
      for (const name of ['onStateChange', 'onPlaybackRateChange', 'onError']) command('addEventListener', [name])
    }
    if (data?.event === 'onError') events.onError?.(`YouTube error ${data.info}`)
    if (data?.event === 'onPlaybackRateChange' && Date.now() > quietUntil) events.onRate?.(data.info)
    if (data?.info && typeof data.info === 'object') update(data.info)
  }
  window.addEventListener('message', onMessage)

  function update(next) {
    const before = info.playerState
    if (typeof next.currentTime === 'number') infoAt = performance.now()
    info = { ...info, ...next }
    if (typeof next.duration === 'number' && next.duration > 0 && Math.round(next.duration) !== duration) {
      duration = Math.round(next.duration)
      events.onDuration?.(next.duration)
    }
    const now = Date.now()
    if (next.playerState !== undefined && next.playerState !== before) {
      const state = next.playerState
      // Pressing play on a stopped embed often goes through buffering before playing.
      const active = value => value === STATES.playing || value === STATES.buffering
      if (now > quietUntil) {
        if (active(state) && !active(before)) events.onPlay?.(position())
        if (state === STATES.paused && active(before)) events.onPause?.(position())
      }
      if (state === STATES.ended) events.onEnded?.()
    }
    // A jump while nothing of ours is pending was a seek in the player's own controls.
    if (typeof next.currentTime === 'number') {
      const sampleAt = performance.now()
      if (lastPosition !== null && now > quietUntil) {
        const moving = info.playerState === STATES.playing ? (sampleAt - lastSampleAt) / 1000 * info.playbackRate : 0
        if (Math.abs(next.currentTime - (lastPosition + moving)) > JUMP_S) events.onSeek?.(next.currentTime)
      }
      lastPosition = next.currentTime
      lastSampleAt = sampleAt
    }
  }

  function quiet() {
    quietUntil = Date.now() + QUIET_MS
  }

  return {
    kind: 'youtube',
    fineRate: false,
    load(item, startAt = 0) {
      if (item.videoId === videoId) return
      videoId = item.videoId
      lastPosition = null
      quiet()
      const params = new URLSearchParams({ enablejsapi: '1', playsinline: '1', rel: '0', origin: location.origin, start: String(Math.floor(startAt)) })
      frame.src = `${ORIGIN}/embed/${encodeURIComponent(videoId)}?${params}`
    },
    ready: () => ready,
    // The embed reports no buffered range and loads nothing before it plays; ready once it answers and is not buffering.
    canStart: () => ready && info.playerState !== STATES.buffering,
    position,
    paused: () => info.playerState !== STATES.playing && info.playerState !== STATES.buffering,
    buffering: () => info.playerState === STATES.buffering,
    rate: () => info.playbackRate,
    async play() {
      quiet()
      command('playVideo')
    },
    pause() {
      quiet()
      command('pauseVideo')
    },
    seek(to) {
      quiet()
      lastPosition = null
      info = { ...info, currentTime: to }
      infoAt = performance.now()
      command('seekTo', [to, true])
    },
    setRate(rate) {
      if (rate === info.playbackRate) return
      quiet()
      command('setPlaybackRate', [rate])
    },
    destroy() {
      clearInterval(listenTimer)
      window.removeEventListener('message', onMessage)
      frame.remove()
    },
  }
}
