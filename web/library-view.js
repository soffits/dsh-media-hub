/**
 * The library: every show with its poster, episodes, size, download and
 * watch state; starting or continuing a room; renaming, keeping and
 * deleting a show or one episode. Deleting asks first, in place.
 */
import { WorkDetails } from './details.js'
import { Confirm, DAY_MS, EPISODE_BYTES, Icon, Menu, api, base, bytes, clock, day, displayName, fill, h, post, query, React, watchMark } from './ui.js'

const titleOf = name => name.replace(/\.[^.]+$/, '')

export function Poster({ show }) {
  if (show.work?.cover) return h('img', { className: 'vsync-poster vsync-posterCover', src: new URL(show.work.cover, base()).href, alt: '', loading: 'lazy' })
  if (show.thumb) return h('img', { className: 'vsync-poster', src: new URL(`thumbs/${show.thumb}`, base()).href, alt: '', loading: 'lazy' })
  return h('span', { className: 'vsync-poster vsync-posterEmpty' }, show.media === 'audio' ? h(Icon.Audio, { size: 18 }) : h(Icon.Film, { size: 18 }))
}

/** Library actions say who did them, for the watch log. */
const asViewer = async (t, body) => ({ ...body, by: await displayName(t('guest')) })

/** The countdown of a show about to be deleted, as a quiet button: keep it, or restart the countdown. */
function Countdown({ t, show, days, onChanged }) {
  const left = Math.ceil((show.deletesAt - Date.now()) / DAY_MS)
  const text = left <= 0 ? t('library.deletesSoon') : fill(t(left === 1 ? 'library.deletesInDay' : 'library.deletesIn'), { n: left })
  const act = path => async () => { await post(path, await asViewer(t, { path: show.path })); onChanged() }
  return h(Menu, {
    label: text,
    title: fill(t('library.deletesOn'), { date: day(t, show.deletesAt) }),
    items: [
      { label: t('library.keep'), onSelect: act('library/keep') },
      { label: fill(t('library.restartCountdown'), { n: days }), onSelect: act('library/countdown') },
    ],
  }, text)
}

/**
 * What a library row says: `lead` is the short line (how good it is, how far along, whether it is followed), `rest` the muted one
 * (what is on disk, downloads, who is in it, where the others stopped).
 */
export function showMeta(t, show) {
  const lead = [...workGlance(t, show)]
  if (show.watchedAt) lead.push(t('library.watchedAll'))
  else {
    if (show.finished > 0 && show.episodes > 1) lead.push(fill(t('library.watchedCount'), { n: show.finished, total: show.total ?? show.episodes }))
    if (show.resume) lead.push(fill(t(show.resume.position > 5 ? 'library.continueFromAt' : 'library.continueFrom'), { n: show.resume.index + 1, time: clock(show.resume.position) }))
  }
  if (show.follow) lead.push(t('follow.following'))
  if (show.seasons > 1) lead.push(fill(t('follow.season'), { n: show.season, total: show.seasons }))
  if (show.newEpisodes) lead.push(fill(t('follow.newEpisodes'), { n: show.newEpisodes.n }))
  if (show.newSeason) lead.push(t('follow.newSeason'))

  const rest = []
  rest.push(show.sourced
    ? fill(t('library.cachedOf'), { n: show.episodes, total: show.total })
    : fill(t(show.episodes === 1 ? 'library.episode' : 'library.episodes'), { n: show.episodes }))
  if (show.pinned) rest.push(t('library.offline'))
  rest.push(bytes(show.size))
  const download = show.download
  if (download?.status === 'running') rest.push(t('library.downloading'))
  else if (download?.status === 'queued') rest.push(t('library.queued'))
  else if (download?.status === 'failed') rest.push(fill(t('library.downloadFailed'), { message: download.error ?? '' }))
  if (show.inUse) rest.push(t('library.inRoom'))
  if (!show.watchedAt) for (const stop of show.stops ?? []) rest.push(fill(t('library.viewerStopped'), { name: stop.viewer, n: stop.index + 1, time: clock(stop.position) }))
  if (show.keep) rest.push(t('library.kept'))
  return { lead, rest }
}

/** What the source said about the show at a glance: score, status, how long it is. */
function workGlance(t, show) {
  const work = show.work
  if (!work) return []
  const status = { finished: 'search.finished', ongoing: 'search.ongoing', stopped: 'search.stopped' }[work.status]
  return [work.score && fill(t('search.score'), { score: work.score.toFixed(1) }), status && t(status)].filter(Boolean)
}

function Episodes({ t, show, onStart, onChanged }) {
  const [episodes, setEpisodes] = React.useState(null)
  const [confirming, setConfirming] = React.useState(null)
  const [error, setError] = React.useState(null)
  const load = React.useCallback(() => api(`library/episodes?${query({ path: show.path })}`).then(answer => setEpisodes(answer.episodes ?? [])), [show.path])
  React.useEffect(() => { load() }, [load, show.episodes])
  if (episodes === null) return null
  return h('ol', { className: 'vsync-subrows' },
    error && h('li', { className: 'vsync-error', role: 'alert' }, error),
    episodes.map((episode, index) => {
      const mark = watchMark(t, episode.watch)
      const title = episode.title ?? fill(t('library.episodeN'), { n: episode.n })
      return h('li', { key: episode.n, className: 'vsync-subrow', 'data-watch': mark.state, 'data-cached': String(episode.cached) },
      h('button', { type: 'button', className: 'vsync-subrowMain', title: episode.cached ? t('library.playFrom') : t('library.playFromFetch'), onClick: () => onStart({ index, position: 0 }) },
        h('span', { className: 'vsync-episodeNo' }, index + 1),
        h('span', { className: 'vsync-episodeMain' },
          h('span', { className: 'vsync-episodeTitle' }, title),
          mark.bar),
        mark.note,
        h('span', { className: 'vsync-episodeState' }, episode.cached ? bytes(episode.size) : t('library.notCached'))),
      !episode.cached ? null : confirming === episode.name
        ? h(Confirm, {
          t,
          question: t('library.deleteEpisodeQuestion'),
          confirmLabel: t('action.delete'),
          onCancel: () => setConfirming(null),
          onConfirm: async () => {
            const answer = await api(`library?${query({ path: show.path, episode: episode.name, by: await displayName(t('guest')) })}`, { method: 'DELETE' })
            setConfirming(null)
            setError(answer.error ?? null)
            load()
            onChanged()
          },
        })
        : h('button', { type: 'button', className: 'vsync-icon vsync-subrowDelete', 'aria-label': fill(t('library.deleteEpisode'), { episode: title }), title: t('action.delete'), disabled: show.inUse, onClick: () => setConfirming(episode.name) }, h(Icon.Close)))
    }))
}

function ShowRow({ t, show, days, onOpen, onChanged, onOpenWork }) {
  const { lead, rest } = showMeta(t, show)
  const [mode, setMode] = React.useState('idle')
  const [details, setDetails] = React.useState(false)
  const [name, setName] = React.useState(show.name)
  const [open, setOpen] = React.useState(false)
  const [error, setError] = React.useState(null)

  const act = async (request) => {
    const answer = await request()
    setError(answer.error ?? null)
    onChanged()
    return answer
  }
  const start = async (startAt) => {
    setError(null)
    const by = await displayName(t('guest'))
    const answer = await post('rooms', { source: 'local', path: show.path, by, ...(startAt ? { start: startAt } : {}) })
    if (answer.error) return setError(answer.error)
    return onOpen(answer.room.id)
  }

  let actions
  if (mode === 'delete') {
    actions = h(Confirm, {
      t,
      question: fill(t('library.deleteQuestion'), { size: bytes(show.size) }),
      confirmLabel: t('action.delete'),
      onCancel: () => setMode('idle'),
      onConfirm: async () => {
        await act(async () => api(`library?${query({ path: show.path, by: await displayName(t('guest')) })}`, { method: 'DELETE' }))
        setMode('idle')
      },
    })
  } else if (mode === 'pin') {
    const missing = show.total - show.episodes
    actions = h(Confirm, {
      t,
      danger: false,
      question: fill(t('library.downloadAllQuestion'), { n: missing, size: bytes(missing * (EPISODE_BYTES[show.media === 'audio' ? 'audio' : 'drama'])) }),
      confirmLabel: t('library.downloadAll'),
      onCancel: () => setMode('idle'),
      onConfirm: async () => {
        await act(async () => post('library/pin', await asViewer(t, { path: show.path, pinned: true })))
        setMode('idle')
      },
    })
  } else if (mode === 'rename') {
    actions = h('span', { className: 'vsync-actions' },
      h('button', { type: 'button', className: 'vsync-btn', onClick: () => { setMode('idle'); setName(show.name) } }, t('action.cancel')),
      h('button', { type: 'submit', form: `vsync-rename-${show.path}`, className: 'vsync-btn vsync-primary' }, t('action.save')))
  } else {
    actions = h('span', { className: 'vsync-actions' },
      (show.episodes > 0 || show.sourced) && h('button', { type: 'button', className: 'vsync-btn', onClick: () => start(null) }, show.resume ? t('library.continue') : t('library.watch')),
      h(Menu, {
        label: t('library.more'),
        items: [
          { label: t('library.rename'), onSelect: () => setMode('rename') },
          show.sourced && !show.pinned && show.episodes < show.total && { label: t('library.downloadAll'), onSelect: () => setMode('pin') },
          show.pinned && { label: t('library.stopOffline'), onSelect: () => act(async () => post('library/pin', await asViewer(t, { path: show.path, pinned: false }))) },
          days > 0 && show.deletesAt === null && { label: fill(t('library.startCountdown'), { n: days }), onSelect: () => act(async () => post('library/countdown', await asViewer(t, { path: show.path }))) },
          show.source?.source && show.sourced && { label: t(show.follow ? 'follow.stop' : 'follow.follow'), onSelect: () => act(() => post('follow', { source: show.source.source, id: show.source.id, follow: !show.follow })) },
          show.source?.source && { label: t('library.refreshInfo'), onSelect: () => act(() => post('library/refresh', { path: show.path })) },
          show.download?.status === 'failed' && { label: t('library.retry'), onSelect: () => act(() => post('library/retry', { path: show.path })) },
          show.download?.active && { label: t('library.stopDownload'), onSelect: () => act(() => post('library/cancel', { path: show.path })) },
          { label: t('action.delete'), danger: true, onSelect: () => (show.inUse ? setError(t('library.inUseError')) : setMode('delete')) },
        ],
      }))
  }

  return h('li', { className: 'vsync-show' },
    h('div', { className: 'vsync-row' },
      h('button', { type: 'button', className: 'vsync-expand', 'aria-expanded': String(open), 'aria-label': t('library.episodesToggle'), onClick: () => setOpen(!open) }, h(Icon.Chevron, { open })),
      h(Poster, { show }),
      h('span', { className: 'vsync-rowText' },
        mode === 'rename'
          ? h('form', {
            id: `vsync-rename-${show.path}`,
            onSubmit: async (event) => {
              event.preventDefault()
              const answer = await act(async () => post('library/rename', await asViewer(t, { path: show.path, name })))
              if (!answer.error) setMode('idle')
            },
          }, h('input', { className: 'vsync-field vsync-inline', value: name, autoFocus: true, 'aria-label': t('library.rename'), onChange: event => setName(event.target.value), onKeyDown: (event) => { if (event.key === 'Escape') { setMode('idle'); setName(show.name) } } }))
          : h('button', { type: 'button', className: 'vsync-rowTitle vsync-titleButton', onClick: () => setOpen(!open) }, show.kind === 'file' ? titleOf(show.name) : show.name),
        h('span', { className: 'vsync-rowMeta vsync-rowLead' }, lead.map((part, n) => h('span', { key: n }, part))),
        h('span', { className: 'vsync-rowMeta vsync-rowMuted' },
          rest.map((part, n) => h('span', { key: n }, part)),
          show.deletesAt !== null && h('span', { key: 'countdown' }, h(Countdown, { t, show, days, onChanged }))),
        show.work?.tags?.length > 0 && h('span', { className: 'vsync-tags' }, show.work.tags.slice(0, 5).map(tag => h('span', { key: tag, className: 'vsync-tag' }, tag))),
        show.work && h('button', { type: 'button', className: 'vsync-metaButton vsync-detailsToggle', 'aria-expanded': String(details), onClick: () => setDetails(!details) }, h(Icon.Chevron, { size: 12, open: details }), ' ', t(details ? 'search.hideDetails' : 'search.details')),
        error && h('span', { className: 'vsync-error', role: 'alert' }, error)),
      actions),
    details && show.work && h('div', { className: 'vsync-showDetails' }, h(WorkDetails, { t, info: show.work, source: show.source.source, onFocus: work => onOpenWork(show.source.source, work) })),
    open && h(Episodes, { t, show, onStart: start, onChanged }))
}

export function LibrarySection({ t, library, onOpen, onChanged, onOpenWork }) {
  const shows = library?.shows ?? []
  return h('section', { className: 'vsync-section', 'aria-labelledby': 'vsync-library' },
    h('div', { className: 'vsync-sectionHead' },
      h('h2', { id: 'vsync-library' }, t('start.library')),
      library && h('span', { className: 'vsync-sectionMeta' }, [
        shows.length > 0 && bytes(library.total),
        library.free !== null && fill(t('library.free'), { size: bytes(library.free) }),
      ].filter(Boolean).join(' · '))),
    library && shows.length === 0 && h('p', { className: 'vsync-empty' }, t('start.libraryEmpty')),
    h('ul', { className: 'vsync-rows' }, shows.map(show => h(ShowRow, { key: show.path, t, show, days: library.autoDeleteDays, onOpen, onChanged, onOpenWork }))))
}
