/**
 * Which engine plays an HLS item: the browser's own, or hls.js. Native HLS is kept for WebKit, whose player takes
 * the growing playlists of an episode still being made; Chromium-based browsers answer "maybe" to HLS too since
 * their own player arrived, but it fails a playlist without an end (DEMUXER_ERROR_COULD_NOT_PARSE), so they get
 * hls.js. A browser without Media Source cannot run hls.js and uses native HLS when it has it.
 * @param {{ canPlayType: (type: string) => string }} video
 * @param {{ webkit?: boolean, mse?: boolean }} [env]
 */
export function playsHlsNatively(video, {
  webkit = typeof HTMLVideoElement !== 'undefined' && 'webkitSupportsPresentationMode' in HTMLVideoElement.prototype,
  mse = typeof MediaSource !== 'undefined' || typeof ManagedMediaSource !== 'undefined',
} = {}) {
  if (video.canPlayType('application/vnd.apple.mpegurl') === '') return false
  return webkit || !mse
}
