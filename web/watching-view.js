/**
 * The Watching tab, in the order of what matters now: the Continue card (the
 * show someone is in, or the one watched last), news from followed works,
 * "How was it?", picks, the shared rooms, and the other shows someone has
 * started. Which optional parts show is the `presence` setting; a part with
 * nothing to show takes no room.
 */
import { ContinueCard } from './continue-card.js'
import { continueSubject, continueWatching } from './continue.js'
import { Poster, showMeta } from './library-view.js'
import { PicksSection, RatingsSection } from './presence-view.js'
import { RoomsSection } from './rooms-view.js'
import { Btn, K, React, api, asPersonPaying, displayName, fill, h, plural, post } from './ui.js'

/** Shows with news from a followed work: a new season added, or more episodes. */
export const withNews = library => (library?.shows ?? []).filter(show => show.newSeason || show.newEpisodes)

/** One show in a list: its poster, title, what is known, and its buttons. */
function ShowRow({ show, title, meta, children }) {
  return h(K.Surface, { as: 'li', className: 'vsync-row vsync-roomCard' },
    h(Poster, { show }),
    h('span', { className: 'vsync-rowText' },
      h('span', { className: 'vsync-rowTitle' }, title),
      h('span', { className: 'vsync-rowMeta' }, meta.filter(Boolean).map((part, n) => h('span', { key: n }, part)))),
    h('span', { className: 'vsync-actions' }, children))
}

/** Opens a room for this person alone on a library show (watching alone is the default; the room offers sharing). */
function StartButton({ t, show, label, variant, onOpen, onStarted }) {
  const [busy, setBusy] = React.useState(false)
  const start = async () => {
    setBusy(true)
    const answer = await asPersonPaying('rooms', { source: 'local', path: show.path, by: await displayName(t('guest')) })
    setBusy(false)
    if (answer.error || answer.declined) return
    onStarted?.()
    onOpen(answer.room.id)
  }
  return h(Btn, { variant, disabled: busy, onClick: start }, label)
}

function NewsRow({ t, show, onOpen, onChanged }) {
  const dismiss = async () => { await post('library/seen', { path: show.path }); onChanged() }
  return h(ShowRow, {
    show,
    title: show.work?.title ?? show.name,
    meta: [
      show.newSeason && (show.newSeason.from ? fill(t('follow.newSeasonOf'), { title: show.newSeason.from }) : t('follow.newSeason')),
      show.newEpisodes && plural(t, 'follow.newEpisodes', show.newEpisodes.n),
    ],
  },
  h(Btn, { variant: 'ghost', onClick: dismiss }, t('follow.dismiss')),
  h(StartButton, { t, show, label: t('library.watch'), variant: 'primary', onOpen, onStarted: dismiss }))
}

/** The page's settings that shape this tab, and the configured sources (for their names), loaded once. */
function useSettings() {
  const [settings, setSettings] = React.useState({ presence: { continue: true }, sources: [] })
  React.useEffect(() => {
    let live = true
    Promise.all([api('settings'), api('sources')]).then(([answer, list]) => {
      if (live) setSettings({ presence: { continue: true, ...answer.presence }, sources: list.sources ?? [] })
    })
    return () => { live = false }
  }, [])
  return settings
}

export function WatchingTab({ t, rooms, library, onOpen, onChanged, onGo, onOpenWork }) {
  const { presence, sources } = useSettings()
  const shows = library?.shows ?? []
  const subject = presence.continue ? continueSubject(rooms, shows) : null
  const others = continueWatching(shows).filter(show => show.path !== subject?.show?.path)
  const news = withNews(library)
  // A rating or a finished show changes what "How was it?" asks; the library's watched marks say when.
  const watchedVersion = shows.map(show => show.watchedAt ?? 0).join(',')
  const quiet = rooms !== undefined && rooms.length === 0 && library !== null && subject === null && others.length === 0 && news.length === 0
  return h('div', { className: 'vsync-tabPanel vsync-watching' },
    subject && h(ContinueCard, { key: subject.room?.id ?? subject.show?.path, t, subject, presence, sources, onOpen, onChanged }),
    news.length > 0 && h('section', { className: 'vsync-section', 'aria-labelledby': 'vsync-news' },
      h('h2', { id: 'vsync-news' }, t('follow.news')),
      h('ul', { className: 'vsync-cards' }, news.map(show => h(NewsRow, { key: show.path, t, show, onOpen, onChanged })))),
    h(RatingsSection, { t, on: presence.ratings === true, version: watchedVersion }),
    h(PicksSection, { t, on: presence.picks === true, onOpen, onOpenWork }),
    h(RoomsSection, { t, rooms, onOpen, onChanged }),
    others.length > 0 && h('section', { className: 'vsync-section', 'aria-labelledby': 'vsync-continue' },
      h('h2', { id: 'vsync-continue' }, t('watching.continue')),
      h('ul', { className: 'vsync-cards' }, others.map(show => h(ShowRow, {
        key: show.path,
        show,
        title: show.kind === 'file' ? show.name.replace(/\.[^.]+$/, '') : show.work?.title ?? show.name,
        meta: Object.values(showMeta(t, show)).flat(),
      }, h(StartButton, { t, show, label: t('library.continue'), onOpen }))))),
    quiet && h(K.Surface, { className: 'vsync-emptyState' },
      h('p', { className: 'vsync-emptyTitle' }, t('watching.emptyTitle')),
      h('p', { className: 'vsync-emptyHint' }, t('watching.emptyHint')),
      h('span', { className: 'vsync-actions vsync-emptyActions' },
        h(Btn, { onClick: () => onGo('library') }, t('tab.library')),
        h(Btn, { variant: 'primary', onClick: () => onGo('discover') }, t('tab.discover')))))
}
