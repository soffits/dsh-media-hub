/**
 * The media hub page: three tabs (Watching, Library, Discover) or one
 * room. client.js renders `Page` once this module has loaded. The tab, and
 * under Discover the source and category, live in the URL (web/nav.js).
 */
import { ShelfSection } from './books-view.js'
import { DiscoverView } from './discover-view.js'
import { LibrarySection } from './library-view.js'
import { clearNav, readNav, TABS, writeNav } from './nav.js'
import { RoomView } from './room-view.js'
import { WatchingTab, withNews } from './watching-view.js'
import { Known, POLL_MS, api, h, React, setWords } from './ui.js'

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

  const tabs = React.useRef([])
  const onKeyDown = (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    if (step === undefined) return
    event.preventDefault()
    const next = TABS[(TABS.indexOf(nav.tab) + step + TABS.length) % TABS.length]
    go({ tab: next })
    tabs.current[TABS.indexOf(next)]?.focus()
  }
  const count = tab => (tab === 'watching' && (rooms?.length ?? 0) + withNews(library).length > 0 ? (rooms?.length ?? 0) + withNews(library).length : null)

  return h('div', { className: 'vsync-scroll' },
    h('div', { className: 'vsync-content' },
      h('header', { className: 'vsync-heading' },
        h('h1', null, t('title')),
        h('p', { className: 'vsync-note' }, t('note'))),
      h('div', { className: 'vsync-nav', role: 'tablist', 'aria-label': t('title'), onKeyDown },
        TABS.map((tab, n) => h('button', {
          key: tab,
          ref: (node) => { tabs.current[n] = node },
          id: `vsync-tab-${tab}`,
          type: 'button',
          role: 'tab',
          className: 'vsync-navTab',
          'aria-selected': String(tab === nav.tab),
          'aria-controls': `vsync-panel-${tab}`,
          tabIndex: tab === nav.tab ? 0 : -1,
          onClick: () => go({ tab }),
        }, t(`tab.${tab}`), count(tab) !== null && h('span', { className: 'vsync-navCount' }, count(tab))))),
      nav.tab === 'watching' && h('div', { id: 'vsync-panel-watching', role: 'tabpanel', 'aria-labelledby': 'vsync-tab-watching' },
        h(WatchingTab, { t, rooms, library, onOpen, onChanged: load, onGo: tab => go({ tab }) })),
      nav.tab === 'library' && h('div', { id: 'vsync-panel-library', role: 'tabpanel', 'aria-labelledby': 'vsync-tab-library' },
        h(LibrarySection, { t, library, onOpen, onChanged: load, onOpenWork: (source, work) => go({ tab: 'discover', source, kind: work.kind ?? null, work: work.id }) }),
        h(ShelfSection, { t })),
      visitedDiscover && h('div', { id: 'vsync-panel-discover', role: 'tabpanel', 'aria-labelledby': 'vsync-tab-discover', hidden: nav.tab !== 'discover' },
        h(DiscoverView, { t, nav, onNav: go, onOpen, onSaved: load, onBack: () => (history.state?.[PUSHED] ? history.back() : go({ work: null }, { replace: true })) }))))
}

export function Page({ t, initialRoom }) {
  setWords(t)
  const [roomId, setRoomId] = React.useState(initialRoom)
  const [nav, go] = useNav()
  const [rooms, setRooms] = React.useState(undefined)
  const [library, setLibrary] = React.useState(null)

  const load = React.useCallback(async () => {
    const [list, lib] = await Promise.all([api('rooms'), api('library')])
    if (list.rooms) setRooms(list.rooms)
    if (lib.shows) setLibrary(lib)
  }, [])

  React.useEffect(() => {
    let live = true
    const tick = () => { if (live) load() }
    tick()
    const timer = setInterval(tick, POLL_MS)
    return () => { live = false; clearInterval(timer) }
  }, [load])

  const known = React.useMemo(() => ({ library, rooms, reload: load }), [library, rooms, load])
  return h(Known.Provider, { value: known }, roomId === null
    ? h(Home, { t, nav, go, onOpen: setRoomId, rooms, library, load })
    : h(RoomView, { key: roomId, t, roomId, onLeave: () => setRoomId(null), onOpen: setRoomId }))
}
