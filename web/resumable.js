/**
 * Fetching a whole file into the page so that a dropped connection costs only the bytes not yet here: the
 * request is made again for the rest (`Range`), a few times, the way a browser's own downloader carries on.
 * A phone far from the server loses a connection mid-file often enough that one plain fetch fails on it.
 * Pure: the fetch and the pause between attempts are passed in.
 */
export const ATTEMPTS = 5

/** An answer that will not get better by asking again (the server said no). */
class Refused extends Error {}

/**
 * @param {string} link
 * @param {object} [options]
 * @param {number} [options.bytes] - the file's size when the caller knows it, for progress before the server says
 * @param {(fraction: number | null) => void} [options.onProgress] - 0..1, or null while the size is unknown
 * @param {(status: number) => string} [options.refusal] - the words for a refused request
 * @returns {Promise<Blob>} the whole file, typed as the server typed it
 */
export async function fetchResumable(link, { bytes = 0, onProgress = () => {}, refusal = status => `HTTP ${status}`, fetch = globalThis.fetch, pause = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const parts = []
  let received = 0
  let total = bytes
  let type = ''
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(link, { credentials: 'same-origin', cache: 'no-store', headers: received > 0 ? { range: `bytes=${received}-` } : {} })
      if (!response.ok) throw new Refused(refusal(response.status))
      // A server that ignores Range sends the file from its start again.
      if (received > 0 && response.status !== 206) {
        parts.length = 0
        received = 0
      }
      type ||= response.headers.get('content-type')?.split(';')[0].trim() ?? ''
      total = Number(response.headers.get('content-range')?.split('/')[1]) || (response.status === 200 && Number(response.headers.get('content-length'))) || total
      const reader = response.body.getReader()
      for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
        parts.push(chunk.value)
        received += chunk.value.length
        onProgress(total > 0 ? Math.min(1, received / total) : null)
      }
      if (total > 0 && received < total) throw new Error('the connection closed before the file ended')
      return new Blob(parts, { type: type || 'application/octet-stream' })
    } catch (error) {
      if (error instanceof Refused || attempt === ATTEMPTS) throw error
      await pause(attempt * 600)
    }
  }
}
