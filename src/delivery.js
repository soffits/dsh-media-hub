/**
 * Where a room's media and subtitle URLs point.
 *
 * A delivery turns (room, item) into the URLs viewers load. `origin`, the
 * default, serves the files from DSH's own web server under /media-hub, so
 * they inherit DSH's login and whatever sits in front of DSH (a tunnel, a
 * reverse proxy). Other deliveries, such as object storage with short-lived
 * signed links, implement the same two methods; the room server, the
 * player and the tool never see the difference.
 *
 * URLs from `origin` are relative to the Web UI's base URL, like DSH's own
 * requests, so a deployment under a sub-path works unchanged.
 */
import { basename } from 'node:path'
import { codedError } from './errors.js'

export const PREFIX = 'media-hub'
export const DELIVERY_MODES = Object.freeze(['origin', 'r2'])

/**
 * @typedef {object} Delivery
 * @property {string} mode
 * @property {boolean} available - whether rooms with local media can use it now
 * @property {string} [reason] - why not, when unavailable
 * @property {(roomId: string, index: number, item: { file: string }) => string} mediaUrl
 * @property {(roomId: string, index: number, n: number) => string} subtitleUrl
 */

/** @returns {Delivery} */
export function createDelivery({ mode }) {
  if (mode === 'origin') {
    return {
      mode,
      available: true,
      mediaUrl: (roomId, index, item) => `${PREFIX}/media/${roomId}/${index}/${encodeURIComponent(basename(item.file))}`,
      subtitleUrl: (roomId, index, n) => `${PREFIX}/subs/${roomId}/${index}/${n}.vtt`,
    }
  }
  if (mode === 'r2') {
    const reason = 'R2 delivery is not built yet; use delivery mode "origin".'
    const missing = () => {
      throw codedError('unsupported', reason)
    }
    return { mode, available: false, reason, mediaUrl: missing, subtitleUrl: missing }
  }
  throw codedError('invalid', `unknown delivery mode ${String(mode)}`)
}
