/**
 * The assistant's Video Sync tool: open a room on local media, a library show,
 * a web video or playlist (Link, through yt-dlp) or a work from a configured source and get the link to send; list and close rooms;
 * list the library; read what was watched (the watch log).
 *
 * A separate plugin entry from the room service (index.js), so reloading
 * that row never unregisters the tool: the service is looked up as
 * `mediaHub` at call time.
 */
import z from '@deepseek-ai/schemastery'
import { LINK_SOURCE } from './src/sources/link.js'

export const name = 'dsh-media-hub-tools'
export const inject = ['tools']

export const Config = z.object({
  agentName: z.string().default('')
    .description('Name shown as who opened rooms the assistant starts. Empty shows "the assistant" in the viewer\'s language.'),
  waitSeconds: z.natural().default(120)
    .description('How long start waits for the first episode to be downloaded and prepared before it returns the link.'),
})

export const PARAMETERS = Object.freeze({
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['start', 'list', 'close', 'library', 'history'], description: 'start opens a room and returns its link; list shows open rooms; close ends one; library lists the shows in the library; history says what was watched, with whom, and where each viewer stopped.' },
    source: { type: 'string', description: 'start: local (files on this machine; a library show continues where its viewers stopped), link (a web video or playlist yt-dlp can read, by url), or the id of a configured source (see the panel\'s search tabs) to watch one of its works by id. For link and sources the room opens at once, the episode being watched is downloaded first, then the next few.' },
    id: { type: 'string', description: 'start, a source: the work id (from that source\'s search).' },
    offline: { type: 'boolean', description: 'start, a source: keep every episode on disk (large). By default only the episode being watched and the next few are kept, and watched ones are deleted as the room moves on.' },
    days: { type: 'integer', minimum: 1, description: 'history: how far back, default 30.' },
    path: { type: 'string', description: 'start, local: absolute path of one video or of a folder of episodes (numbered files play in natural order). Subtitles next to a video with the same name (.srt, .ass, .vtt, also name.zh.srt) are added. Videos browsers cannot play or seek well are remuxed or transcoded first.' },
    url: { type: 'string', description: 'start, link: the page of a video, or of a playlist whose videos become episodes. A video inside a playlist plays alone.' },
    quality: { type: 'string', description: 'start, link: auto (default: the best up to the hub\'s height limit), a height such as 720, or audio.' },
    title: { type: 'string', description: 'start: room title; defaults to the video or folder name.' },
    room: { type: 'string', description: 'close: the room id.' },
  },
  required: ['action'],
  additionalProperties: false,
})

const DESCRIPTION = 'Video Sync: watch a video together. Each viewer streams their own copy in the DSH Web UI\'s Video Sync page, and play, pause, seek and episode changes stay in sync. start opens a room (a local file or episode folder, a library show, a web video or playlist, or a work from a configured source) and returns a link anyone signed in to this DSH can open; send it to them. history reads the watch log: shows watched, episodes finished, where each viewer stopped, with whom and when.'

const failure = (code, message) => ({ ok: false, error: { code, message } })

const clock = (seconds) => {
  const s = Math.max(0, Math.round(seconds ?? 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** "1-5, 7" from [1, 2, 3, 4, 5, 7]. */
export function ranges(numbers) {
  const out = []
  for (const n of numbers) {
    const last = out[out.length - 1]
    if (last && n === last[1] + 1) last[1] = n
    else out.push([n, n])
  }
  return out.map(([a, b]) => (a === b ? String(a) : `${a}-${b}`)).join(', ')
}

function historyView(entry) {
  return {
    title: entry.title,
    with: entry.with,
    from: entry.from,
    to: entry.to,
    finished: ranges(entry.episodesFinished),
    stopped: Object.fromEntries(Object.entries(entry.stoppedAt).map(([viewer, at]) => [viewer, at.finished ? `finished ep ${at.episode}` : `ep ${at.episode} at ${clock(at.position)}`])),
  }
}

function libraryView(library) {
  return {
    free: library.free,
    shows: library.shows.map(show => ({
      title: show.name,
      path: show.path,
      episodes: show.sourced ? `${show.episodes} cached of ${show.total}` : show.episodes,
      ...(show.pinned ? { offline: true } : {}),
      size: show.size,
      ...(show.resume ? { continuesAt: `${show.resume.title} at ${clock(show.resume.position)}` } : {}),
      ...(show.deletesAt ? { deletesAt: new Date(show.deletesAt).toISOString() } : {}),
      ...(show.download?.active ? { downloading: true } : {}),
    })),
  }
}

/** @returns {object} the tool definition */
export function createTool({ getService, agentName = '', waitSeconds = 120 }) {
  return {
    name: 'videosync',
    description: DESCRIPTION,
    parameters: PARAMETERS,
    output: { schema: { type: 'object' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    async execute(args = {}) {
      const service = getService()
      if (service === undefined) return failure('unavailable', 'The media hub is starting or reloading; try again in a few seconds.')
      try {
        if (args.action === 'list') return { ok: true, rooms: await service.listRooms() }
        if (args.action === 'library') return { ok: true, ...libraryView(await service.library()) }
        if (args.action === 'history') return { ok: true, log: service.logFile, shows: (await service.history({ days: args.days ?? 30 })).map(historyView) }
        if (args.action === 'close') {
          if (typeof args.room !== 'string') return failure('invalid_arguments', 'close needs room')
          return { ok: true, ...service.closeRoom(args.room) }
        }
        if (args.action !== 'start') return failure('invalid_arguments', 'action must be start, list, close, library or history')
        let room
        if (args.source === undefined || args.source === 'local') {
          ({ room } = await service.createRoom({ path: args.path, title: args.title, by: agentName, together: true }))
        } else {
          const id = args.source === LINK_SOURCE ? args.url : args.id
          if (typeof id !== 'string') return failure('invalid_arguments', `start with source ${args.source} needs ${args.source === LINK_SOURCE ? 'url' : 'id'}`)
          room = (await service.fetch({ source: args.source, id, watch: true, together: true, all: args.offline === true, quality: args.quality ?? '', by: agentName })).room
        }
        await service.waitReady(room.id, service.room(room.id).index, waitSeconds * 1000)
        const detail = service.room(room.id)
        const first = detail.items[detail.index]
        return {
          ok: true,
          room: detail.id,
          title: detail.title,
          link: detail.link,
          episodes: detail.items.length,
          firstEpisode: first.status,
          ...(first.status === 'failed' ? { error: first.error } : {}),
          ...(detail.index > 0 ? { startsAt: detail.items[detail.index].title } : {}),
          note: first.status === 'preparing'
            ? 'The first episode is still being prepared; it plays as soon as it is ready. The link works already.'
            : 'Send the link; the room is also listed in the Video Sync page.',
        }
      } catch (error) {
        if (typeof error?.code === 'string') return failure(error.code, error.message)
        throw error
      }
    },
    presentCall: args => ({ card: 'generic', title: 'Video Sync', kind: 'other', ...(args?.title ?? args?.path ?? args?.room ? { rawInput: args.title ?? args.path ?? args.room } : {}) }),
  }
}

export function apply(ctx, config = {}) {
  ctx.tools.register(createTool({
    getService: () => ctx.get('mediaHub')?.service(),
    agentName: config.agentName ?? '',
    waitSeconds: config.waitSeconds ?? 120,
  }))
}
