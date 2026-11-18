/**
 * Browser builds of packages the page loads from the host, by the name they
 * are served under: hls.js (HLS where the browser has no native player) and
 * Danmaku (flying comments over the picture). `npm run build` copies them
 * into dist/, which is what an installed plugin serves.
 */
export const VENDORED = Object.freeze({
  'hls.mjs': { pkg: 'hls.js', file: 'dist/hls.mjs' },
  'danmaku.mjs': { pkg: 'danmaku', file: 'dist/esm/danmaku.dom.js' },
})
