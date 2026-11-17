/**
 * YouTube links to a video id and/or playlist id. Shared by the server and
 * the browser (the panel checks a pasted link before sending it).
 */

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
const LIST_ID = /^[A-Za-z0-9_-]{10,64}$/
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtube-nocookie.com', 'youtube-nocookie.com'])

/**
 * @param {string} text - a URL, or a bare 11-character video id
 * @returns {{ videoId: string | null, listId: string | null } | null} null when it is not a YouTube link
 */
export function parseYouTube(text) {
  const value = String(text ?? '').trim()
  if (VIDEO_ID.test(value)) return { videoId: value, listId: null }
  let url
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (!HOSTS.has(url.hostname)) return null
  const listParam = url.searchParams.get('list')
  const listId = listParam !== null && LIST_ID.test(listParam) ? listParam : null
  let videoId = null
  if (url.hostname === 'youtu.be') videoId = url.pathname.slice(1).split('/')[0]
  else if (url.pathname === '/watch') videoId = url.searchParams.get('v')
  else {
    const match = /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(url.pathname)
    if (match) videoId = match[1]
  }
  if (videoId !== null && !VIDEO_ID.test(videoId)) videoId = null
  if (videoId === null && listId === null) return null
  // A watch link inside a playlist plays that one video; a bare playlist link plays the list.
  return { videoId, listId: videoId === null ? listId : null }
}
