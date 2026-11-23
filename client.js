/*
 * Browser half of dsh-media-hub: the sidebar entry (named by the `label`
 * setting, else the page's own name in the viewer's language) and its page
 * in the main column. Its words come from the plugin's locale/ folder.
 *
 * Plain JavaScript in DSH's Client module format; React comes from the
 * page's module table. DSH loads dist/client.js, this file with the build of
 * the page's files written in (scripts/build.mjs). It registers the entry, the
 * words and the styles; the page itself (search, rooms, library, one room)
 * lives in browser modules the Host half serves under /media-hub/web/
 * (page.js and the modules it imports), loaded when the page first opens.
 *
 * A link with ?media-room=<room> (or ?videosync=<room>, as links from the
 * time this was Video Sync have it) opens the page on that room; one with
 * the page's own vs-* parameters (tab, source, category: web/nav.js) opens
 * the panel on them. "Chat about this" on a card starts a conversation
 * through the Web UI's workspace service with a draft the person sends.
 */
window.__ModuleLoader__.load({
  id: '@soffits/dsh-media-hub',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect } = React

    const NS = 'dsh-media-hub'
    const PANEL = 'dsh-media-hub'
    const STYLE_ID = 'dsh-media-hub'
    const LINK_PARAMS = ['media-room', 'videosync']
    /**
     * The build of the page's files (src/web-files.js), which the page loads from addresses named by it, since a
     * browser keeps the first module it loaded from an address for the life of the page. Being part of this bundle,
     * it makes an update of any page file an update of the browser half, which DSH swaps into open pages.
     */
    const BUILD = '%WEB_BUILD%'
    const web = name => new URL(`media-hub/web/${BUILD}/${name}`, document.baseURI).href

    /**
     * Where an open page stood (its place in the URL and the room it showed), handed from the browser half DSH swaps
     * out to the one it swaps in: DSH closes a main panel whose entry goes away, and the page's state leaves with
     * its modules. `showing` and `openRoom` are what the mounted page reports.
     */
    const HANDOVER = Symbol.for('@soffits/dsh-media-hub: hand-over')
    let showing = false
    let openRoom = null
    let handedSearch = null
    const reportRoom = (id) => { openRoom = id }

    function SidebarIcon({ size }) {
      const stroke = { stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round' }
      return h('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true, focusable: 'false' },
        h('rect', { x: 1.75, y: 2.75, width: 12.5, height: 8.5, rx: 1.5, ...stroke }),
        h('path', { d: 'M6.9 5.3v3.4L9.7 7 6.9 5.3Z', fill: 'currentColor' }),
        h('path', { d: 'M4.5 13.6c1 .5 2.2.8 3.5.8s2.5-.3 3.5-.8', ...stroke }))
    }

    /**
     * "Ask" through @soffits/dsh-ui-actions (ctx.uiActions), when it is installed: a new conversation with the
     * item attached as a card. `source` names this plugin on the card; set in apply.
     */
    let uiActions = null
    let sourceName = () => ''
    const chat = {
      available: () => uiActions !== null,
      start: about => uiActions?.chat({ source: '@soffits/dsh-media-hub', sourceName: sourceName(), ...about }),
    }
    /** The points plugin's offer (ctx.points from @soffits/dsh-points), when it is installed. */
    let pointsService = null
    const points = {
      available: () => pointsService !== null,
      offer: request => pointsService.offer(request),
    }
    /** DSH's locale store, set in apply before anything renders, so the page renders again when the viewer switches language. */
    let localeStore
    const activeLanguage = () => localeStore.getSnapshot().active
    // Called through the store, never detached: its methods read their own `this`.
    const subscribeLocale = listener => localeStore.subscribe(listener)

    /** JSON from one of the Host's routes, or `fallback` (logged) when it does not answer. */
    const getJson = (path, fallback) => fetch(new URL(path, document.baseURI))
      .then(response => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .catch((error) => {
        console.warn('[media-hub] %s: %s', path, error.message)
        return fallback
      })

    /**
     * What the entry and the page need before they show: the words (one table per locale/<tag>.json, so a
     * language is added by adding its file), the `label` setting, and the language lookup for it.
     */
    const loadStart = async () => {
      const [settings, words, { pick }] = await Promise.all([getJson('media-hub/api/settings', {}), getJson('media-hub/api/locales', {}), import(web('i18n.js'))])
      return { words, settings, pick }
    }

    /** DSH's own components, shared through the page's module table. */
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    /** The shared kit (ctx.uiKit), once it is there; the page waits for it. */
    let kit = null
    const kitListeners = new Set()
    const kitStore = {
      set(value) { kit = value; for (const listener of kitListeners) listener() },
      subscribe(listener) { kitListeners.add(listener); return () => { kitListeners.delete(listener) } },
      get: () => kit,
    }

    /** The page's modules, loaded once and handed this page's React, DSH's components and the kit. */
    let pageModule
    const loadPage = () => {
      pageModule ??= Promise.all([import(web('ui.js')), import(web('page.js')), import(web('boundary.js')), import(web('nav.js'))]).then(([ui, page, boundary, nav]) => {
        ui.init(React, { primitives, kit })
        ui.setChat(chat)
        ui.setPoints(points)
        return { Page: page.Page, Boundary: boundary.createBoundary(React), nav }
      })
      return pageModule
    }

    /** The page's place as the swapped-out half left it, put back in the URL before the page reads it. */
    const restoreNav = (nav) => {
      if (handedSearch === null) return
      const search = nav.writeNav(location.search, nav.readNav(handedSearch))
      handedSearch = null
      history.replaceState(history.state, '', `${location.pathname}${search}${location.hash}`)
    }

    /** A room asked for by the page's URL (?media-room=<id> or ?videosync=<id>), or handed over, taken once. */
    let linkedRoom = null
    const takeLinkedRoom = () => {
      const params = new URLSearchParams(location.search)
      const param = LINK_PARAMS.find(name => params.get(name) !== null)
      if (param === undefined) return
      linkedRoom = params.get(param)
      params.delete(param)
      const query = params.toString()
      history.replaceState(history.state, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`)
    }

    /**
     * Which layout widths the panel is within, as `data-within` for panel.css (the numbers are its breakpoints).
     * The layout follows the panel's own width, not the window's: a side bar or a split view leaves a wide
     * window with a panel as narrow as a phone.
     */
    const LAYOUT_WIDTHS = [640, 767, 900]
    function useWithin() {
      const box = React.useRef(null)
      React.useLayoutEffect(() => {
        const node = box.current
        const measure = () => { node.dataset.within = LAYOUT_WIDTHS.filter(width => node.clientWidth <= width).join(' ') }
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(node)
        return () => observer.disconnect()
      }, [])
      return box
    }

    function MediaHubPage({ translate }) {
      const box = useWithin()
      const language = React.useSyncExternalStore(subscribeLocale, activeLanguage)
      // A new function per language, so every view that keeps text derived from `t` builds it again;
      // `t.language` is the viewer's tag, for Intl and for texts given per language.
      const t = React.useMemo(() => Object.assign((...args) => translate(...args), { language }), [translate, language])
      const [initialRoom] = useState(() => {
        const id = linkedRoom
        linkedRoom = null
        return id
      })
      const [page, setPage] = useState(null)
      const [error, setError] = useState(null)
      const ready = React.useSyncExternalStore(kitStore.subscribe, kitStore.get) !== null
      useEffect(() => {
        showing = true
        return () => {
          showing = false
          openRoom = null
        }
      }, [])
      useEffect(() => {
        if (!ready) return undefined
        let live = true
        loadPage().then((module) => {
          if (!live) return
          restoreNav(module.nav)
          setPage(module)
        }, (reason) => {
          pageModule = undefined
          if (live) setError(reason.message)
        })
        return () => { live = false }
      }, [ready])
      return h('div', { className: 'vsync-page', ref: box },
        page !== null && h(page.Boundary, { t }, h(page.Page, { t, initialRoom, onRoom: reportRoom })),
        error && h('p', { className: 'vsync-error', role: 'alert', style: { padding: 24 } }, error))
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const t = ctx.locale.bind(NS)
        localeStore = ctx.locale
        sourceName = () => t('panel')
        ctx.inject(['uiKit'], (scope) => {
          scope.effect(() => {
            kitStore.set(scope.uiKit)
            return () => kitStore.set(null)
          }, 'media-hub: kit')
        })
        ctx.inject(['points'], (scope) => {
          scope.effect(() => {
            pointsService = scope.points
            return () => { pointsService = null }
          }, 'media-hub: points')
        })
        ctx.inject(['uiActions'], (scope) => {
          scope.effect(() => {
            uiActions = scope.uiActions
            const off = uiActions.registerSource({ id: '@soffits/dsh-media-hub', name: () => sourceName(), icon: SidebarIcon })
            return () => { off(); uiActions = null }
          }, 'media-hub: ask')
        })

        // The words register first, so neither the entry nor the page ever shows a bare key.
        ctx.effect(() => {
          let live = true
          const disposers = []
          loadStart().then(({ words, settings, pick }) => {
            if (!live) return
            const styles = document.createElement('link')
            styles.id = STYLE_ID
            styles.rel = 'stylesheet'
            styles.href = web('panel.css')
            styles.dataset.plugin = '@soffits/dsh-media-hub'
            document.head.appendChild(styles)
            disposers.push(() => styles.remove())
            try {
              disposers.push(ctx.locale.register(NS, words))
            } catch (error) {
              console.warn('[media-hub] words: %s', error.message)
            }
            const label = settings.label ?? ''
            sourceName = () => pick(label, activeLanguage()).trim() || t('panel')
            disposers.push(ctx.slots.inject('main', () => ctx.slots.register({
              name: 'main',
              key: PANEL,
              locale: NS,
              inject: () => ({ translate: t }),
            }, MediaHubPage)))
            disposers.push(ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
              name: 'sidebar.panellist',
              id: PANEL,
              order: 12,
              locale: NS,
              label: () => sourceName(),
            }, SidebarIcon)))
          }, error => console.warn('[media-hub] could not load its words and settings: %s', error.message))
          return () => {
            live = false
            // Read before the entries go: DSH disposes this half before it applies the one swapped in.
            if (showing) globalThis[HANDOVER] = { search: location.search, room: openRoom }
            for (const dispose of disposers.reverse()) dispose()
          }
        }, 'media-hub: words, styles and entries')

        // A link to a room, or to a tab, opens this panel once it is registered, as does a page handed over.
        ctx.effect(() => {
          const handed = globalThis[HANDOVER]
          delete globalThis[HANDOVER]
          if (handed === undefined) takeLinkedRoom()
          else {
            linkedRoom = handed.room
            handedSearch = handed.search
          }
          let timer
          let live = true
          const open = () => {
            let tries = 0
            timer = setInterval(() => {
              const layout = ctx.get('layout')
              try {
                layout?.selectPanel(PANEL)
                if (layout) clearInterval(timer)
              } catch {
                // The main slot entry is not registered yet.
              }
              if (++tries > 50) clearInterval(timer)
            }, 100)
          }
          if (linkedRoom !== null || handed !== undefined) open()
          else import(web('nav.js')).then(({ hasNavParams }) => { if (live && hasNavParams(location.search)) open() }, () => {})
          return () => { live = false; clearInterval(timer) }
        }, 'media-hub: room link')
      },
    }
  },
})
