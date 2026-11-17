/**
 * YouTube links into room items: one item per video, or every video of a
 * playlist (listed with yt-dlp). Titles come from YouTube's oEmbed endpoint.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { parseYouTube } from './youtube-url.js'

const run = promisify(execFile)
const serviceError = (code, message) => Object.assign(new Error(message), { code })

export async function youtubeItems(urls, { ytDlp, fetchTitle = youtubeTitle }) {
  const list = (Array.isArray(urls) ? urls : [urls]).filter(url => typeof url === 'string' && url.trim() !== '')
  if (list.length === 0) throw serviceError('invalid', 'give at least one YouTube URL')
  const items = []
  for (const url of list) {
    const parsed = parseYouTube(url)
    if (parsed === null) throw serviceError('invalid', `not a YouTube video or playlist URL: ${url}`)
    if (parsed.videoId === null) {
      for (const entry of await playlistEntries(parsed.listId, ytDlp)) items.push({ title: entry.title, kind: 'youtube', status: 'ready', videoId: entry.id })
    } else {
      items.push({ title: (await fetchTitle(parsed.videoId)) ?? `YouTube ${parsed.videoId}`, kind: 'youtube', status: 'ready', videoId: parsed.videoId })
    }
  }
  return items
}

async function playlistEntries(listId, ytDlp) {
  let stdout
  try {
    ({ stdout } = await run(ytDlp, ['--flat-playlist', '-J', '--no-warnings', `https://www.youtube.com/playlist?list=${listId}`], { maxBuffer: 32 * 1024 * 1024, timeout: 60_000 }))
  } catch (error) {
    throw serviceError('invalid', `could not read the playlist (${error.code === 'ENOENT' ? 'yt-dlp is not installed' : error.message.split('\n')[0]})`)
  }
  const entries = (JSON.parse(stdout).entries ?? []).filter(entry => typeof entry.id === 'string')
  if (entries.length === 0) throw serviceError('empty', 'the playlist has no videos')
  return entries.map(entry => ({ id: entry.id, title: entry.title ?? `YouTube ${entry.id}` }))
}

/** A YouTube video's title from its public oEmbed endpoint. */
export async function youtubeTitle(videoId) {
  try {
    const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { 'user-agent': 'dsh-media-hub' } })
    if (!response.ok) return null
    const data = await response.json()
    return typeof data.title === 'string' ? data.title : null
  } catch {
    return null
  }
}
