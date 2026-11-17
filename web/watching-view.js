/**
 * The Watching tab: the open rooms (who is in, which episode), and the
 * library shows someone has started, most recently watched first, to
 * continue in a new room.
 */
import { Poster, showMeta } from './library-view.js'
import { continueWatching } from './continue.js'
import { RoomsSection } from './rooms-view.js'
import { React, asPerson, displayName, fill, h, plural, post } from './ui.js'

function ContinueRow({ t, show, onOpen }) {
  const [error, setError] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const start = async () => {
    setBusy(true)
    setError(null)
    const by = await displayName(t('guest'))
    const answer = await asPerson('rooms', { source: 'local', path: show.path, by })
    setBusy(false)
    if (answer.error) return setError(answer.error)
    return onOpen(answer.room.id)
  }
  return h('li', { className: 'vsync-row' },
    h(Poster, { show }),
    h('span', { className: 'vsync-rowText' },
      h('span', { className: 'vsync-rowTitle' }, show.kind === 'file' ? show.name.replace(/\.[^.]+$/, '') : show.name),
      h('span', { className: 'vsync-rowMeta' }, Object.values(showMeta(t, show)).flat().map((part, n) => h('span', { key: n }, part))),
      error && h('span', { className: 'vsync-error', role: 'alert' }, error)),
    h('span', { className: 'vsync-actions' },
      h('button', { type: 'button', className: 'vsync-btn', disabled: busy, onClick: start }, t('library.continue'))))
}

/** Shows with news from a followed work: a new season added, or more episodes. */
export const withNews = library => (library?.shows ?? []).filter(show => show.newSeason || show.newEpisodes)

function NewsRow({ t, show, onOpen, onChanged }) {
  const dismiss = async () => { await post('library/seen', { path: show.path }); onChanged() }
  return h('li', { className: 'vsync-row' },
    h(Poster, { show }),
    h('span', { className: 'vsync-rowText' },
      h('span', { className: 'vsync-rowTitle' }, show.work?.title ?? show.name),
      h('span', { className: 'vsync-rowMeta' },
        show.newSeason && h('span', { key: 's' }, show.newSeason.from ? fill(t('follow.newSeasonOf'), { title: show.newSeason.from }) : t('follow.newSeason')),
        show.newEpisodes && h('span', { key: 'e' }, plural(t, 'follow.newEpisodes', show.newEpisodes.n)))),
    h('span', { className: 'vsync-actions' },
      h('button', { type: 'button', className: 'vsync-btn', onClick: dismiss }, t('follow.dismiss')),
      h(StartButton, { t, show, onOpen, onStarted: dismiss })))
}

function StartButton({ t, show, onOpen, onStarted }) {
  const [busy, setBusy] = React.useState(false)
  const start = async () => {
    setBusy(true)
    const answer = await asPerson('rooms', { source: 'local', path: show.path, by: await displayName(t('guest')) })
    setBusy(false)
    if (answer.error) return
    onStarted()
    onOpen(answer.room.id)
  }
  return h('button', { type: 'button', className: 'vsync-btn vsync-primary', disabled: busy, onClick: start }, t('library.watch'))
}

export function WatchingTab({ t, rooms, library, onOpen, onChanged, onGo }) {
  const shows = continueWatching(library?.shows ?? [])
  const news = withNews(library)
  const quiet = rooms !== undefined && rooms.length === 0 && library !== null && shows.length === 0 && news.length === 0
  return h('div', { className: 'vsync-tabPanel' },
    news.length > 0 && h('section', { className: 'vsync-section', 'aria-labelledby': 'vsync-news' },
      h('h2', { id: 'vsync-news' }, t('follow.news')),
      h('ul', { className: 'vsync-rows' }, news.map(show => h(NewsRow, { key: show.path, t, show, onOpen, onChanged })))),
    h(RoomsSection, { t, rooms, onOpen, onChanged }),
    shows.length > 0 && h('section', { className: 'vsync-section', 'aria-labelledby': 'vsync-continue' },
      h('h2', { id: 'vsync-continue' }, t('watching.continue')),
      h('ul', { className: 'vsync-rows' }, shows.map(show => h(ContinueRow, { key: show.path, t, show, onOpen })))),
    quiet && h('div', { className: 'vsync-emptyState' },
      h('p', { className: 'vsync-emptyTitle' }, t('watching.emptyTitle')),
      h('p', { className: 'vsync-emptyHint' }, t('watching.emptyHint')),
      h('span', { className: 'vsync-actions vsync-emptyActions' },
        h('button', { type: 'button', className: 'vsync-btn', onClick: () => onGo('library') }, t('tab.library')),
        h('button', { type: 'button', className: 'vsync-btn vsync-primary', onClick: () => onGo('discover') }, t('tab.discover')))))
}
