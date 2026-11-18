/**
 * The media hub page: three tabs (Watching, Library, Discover) or one
 * room. client.js renders `Page` once this module has loaded. The tab, and
 * under Discover the source and category, live in the URL (web/nav.js).
 */
import { DiscoverView } from './discover-view.js'
import { LibrarySection } from './library-view.js'
import { clearNav, readNav, TABS, writeNav } from './nav.js'
import { RoomView } from './room-view.js'
import { WatchingTab, withNews } from './watching-view.js'
import { Changes, K, Known, P, api, fill, h, React, setOffer, setWords } from './ui.js'

/** Marks the history entries this page added, so a back control knows going back stays on the page. */
const PUSHED = 'vsyncPushed'

/** The page's place, kept in the URL: tab changes add a history entry (back goes to the last tab), the rest replace it. */
function useNav() {
  const [nav, setNav] = React.useState(() => readNav(location.search))
  const current = React.useRef(nav)
  React.useEffect(() => {
    const restore = () => { current.current = readNav(location.search); setNav(current.current) }
    window.addEventListener('popstate', restore)
    return () => {
      window.removeEventListener('popstate', restore)
      history.replaceState(history.state, '', `${location.pathname}${clearNav(location.search)}${location.hash}`)
    }
  }, [])
  const go = React.useCallback((patch, { replace = false } = {}) => {
    const next = { ...current.current, ...patch }
    const before = current.current
    if (next.tab === before.tab && next.source === before.source && next.kind === before.kind && next.work === before.work) return
    // A new place (another tab, a work opened) is a history entry of its own, so back returns to the one before.
    const push = !replace && (next.tab !== before.tab || next.work !== before.work)
    history[push ? 'pushState' : 'replaceState'](push ? { ...history.state, [PUSHED]: true } : history.state, '', `${location.pathname}${writeNav(location.search, next)}${location.hash}`)
    current.current = next
    setNav(next)
  }, [])
  return [nav, go]
}

function Home({ t, nav, go, onOpen, rooms, library, load }) {
  /** Discover keeps its search and results while another tab is open, once it has been visited. */
  const [visitedDiscover, setVisitedDiscover] = React.useState(nav.tab === 'discover')
  React.useEffect(() => { if (nav.tab === 'discover') setVisitedDiscover(true) }, [nav.tab])

  // Coming back from a room, what the page shows is fresh, not up to one poll old.
  React.useEffect(() => { load() }, [load])

  const count = tab => (tab === 'watching' && (rooms?.length ?? 0) + withNews(library).length > 0 ? (rooms?.length ?? 0) + withNews(library).length : null)

  return h('div', { className: 'vsync-scroll' },
    h('div', { className: 'vsync-content' },
      h('header', { className: 'vsync-heading' },
        h('h1', null, t('title')),
        h('p', { className: 'vsync-note' }, t('note'))),
      h(P.SegmentedTabs, {
        className: 'vsync-pageTabs',
        label: t('title'),
        value: nav.tab,
        onChange: tab => go({ tab }),
        items: TABS.map(tab => ({
          value: tab,
          id: `vsync-tab-${tab}`,
          panelId: `vsync-panel-${tab}`,
          label: [t(`tab.${tab}`), count(tab) !== null && h(P.Tag, { key: 'n', tone: 'quiet', className: 'vsync-tabCount' }, count(tab))],
        })),
      }),
      nav.tab === 'watching' && h('div', { id: 'vsync-panel-watching', role: 'tabpanel', 'aria-labelledby': 'vsync-tab-watching' },
        h(WatchingTab, { t, rooms, library, onOpen, onChanged: load, onGo: tab => go({ tab }), onOpenWork: (source, work) => go({ tab: 'discover', source, kind: work.kind ?? null, work: work.id }) })),
      nav.tab === 'library' && h('div', { id: 'vsync-panel-library', role: 'tabpanel', 'aria-labelledby': 'vsync-tab-library' },
        h(LibrarySection, { t, library, onOpen, onChanged: load, onOpenWork: (source, work) => go({ tab: 'discover', source, kind: work.kind ?? null, work: work.id }) })),
      visitedDiscover && h('div', { id: 'vsync-panel-discover', role: 'tabpanel', 'aria-labelledby': 'vsync-tab-discover', hidden: nav.tab !== 'discover' },
        h(DiscoverView, { t, nav, onNav: go, onOpen, onSaved: load, onBack: () => (history.state?.[PUSHED] ? history.back() : go({ work: null }, { replace: true })) }))))
}

/** The page's words for the extras the hub sells (src/points.js EXTRAS), by item key; another item keeps its shop name. */
const EXTRA_WORDS = Object.freeze({ 'media:new_series': 'points.newSeries', 'media:binge_night': 'points.bingeNight' })

/**
 * The offer of an extra at the moment of the action: its price and the person's balance, and Buy when they can.
 * One at a time; `asPersonPaying` (ui.js) waits for the answer.
 */
function PointsOffer({ t }) {
  const [ask, setAsk] = React.useState(null)
  React.useEffect(() => {
    setOffer(points => new Promise(resolve => setAsk({ points, resolve })))
    return () => setOffer(null)
  }, [])
  if (ask === null) return null
  const { points, resolve } = ask
  const done = (yes) => { setAsk(null); resolve(yes) }
  const name = EXTRA_WORDS[points.item] ? t(EXTRA_WORDS[points.item]) : points.name
  const key = points.pending ? 'points.pending' : points.affordable ? 'points.offer' : 'points.short'
  return h('div', { className: 'vsync-pointsOffer', role: 'alertdialog', 'aria-live': 'polite' },
    h('span', { className: 'vsync-pointsText' }, fill(t(key), { name, cost: points.cost, balance: points.balance, gap: points.gap })),
    h('span', { className: 'vsync-actions' },
      points.affordable && !points.pending
        ? [h('button', { key: 'no', type: 'button', className: 'vsync-btn', onClick: () => done(false) }, t('points.notNow')),
           h('button', { key: 'yes', type: 'button', className: 'vsync-btn vsync-primary', autoFocus: true, onClick: () => done(true) }, t('points.buy'))]
        : h('button', { type: 'button', className: 'vsync-btn', autoFocus: true, onClick: () => done(false) }, t('points.ok'))))
}

export function Page({ t, initialRoom }) {
  setWords(t)
  const [roomId, setRoomId] = React.useState(initialRoom)
  const [nav, go] = useNav()
  const [rooms, setRooms] = React.useState(undefined)
  const [library, setLibrary] = React.useState(null)

  const load = React.useCallback(async () => {
    const [list, lib] = await Promise.all([api('rooms'), api('library')])
    // A room someone watches alone is theirs: it is listed once they open it to others.
    if (list.rooms) setRooms(list.rooms.filter(room => room.together))
    if (lib.shows) setLibrary(lib)
  }, [])

  // The plugin announces every change of what the page shows (src/changes.js); the page re-reads then, and once when the stream (re)connects. No timer.
  const [shelf, setShelf] = React.useState(0)
  const [discover, setDiscover] = React.useState(0)
  const [shows, setShows] = React.useState(0)
  const stream = K.useEventStream('api/media-hub/events', (message) => {
    if (message.what?.includes('shelf')) setShelf(count => count + 1)
    if (message.what?.includes('discover')) setDiscover(count => count + 1)
    if (message.what?.includes('library')) setShows(count => count + 1)
    if (message.what?.some(kind => kind === 'library' || kind === 'rooms')) load()
  })
  React.useEffect(() => { if (stream === 'live') { load(); setShelf(count => count + 1) } }, [stream, load])
  React.useEffect(() => { load() }, [load])

  const known = React.useMemo(() => ({ library, rooms, reload: load }), [library, rooms, load])
  const changes = React.useMemo(() => ({ shelf, discover, shows }), [shelf, discover, shows])
  return h(Changes.Provider, { value: changes }, h(Known.Provider, { value: known }, h(React.Fragment, null,
    roomId === null
      ? h(Home, { t, nav, go, onOpen: setRoomId, rooms, library, load })
      : h(RoomView, { key: roomId, t, roomId, onLeave: () => setRoomId(null), onOpen: setRoomId }),
    h(PointsOffer, { t }))))
}
