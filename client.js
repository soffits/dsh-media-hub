/*
 * Browser half of dsh-media-hub: the sidebar entry (named by the `label`
 * setting, else the page's own name in the viewer's language) and its page
 * in the main column. Its words come from the plugin's locale/ folder.
 *
 * Plain JavaScript in DSH's Client module format (no build step); React
 * comes from the page's module table. This file registers the entry, the
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
    const web = name => new URL(`media-hub/web/${name}`, document.baseURI).href

    function SidebarIcon({ size }) {
      const stroke = { stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round' }
      return h('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true, focusable: 'false' },
        h('rect', { x: 1.75, y: 2.75, width: 12.5, height: 8.5, rx: 1.5, ...stroke }),
        h('path', { d: 'M6.9 5.3v3.4L9.7 7 6.9 5.3Z', fill: 'currentColor' }),
        h('path', { d: 'M4.5 13.6c1 .5 2.2.8 3.5.8s2.5-.3 3.5-.8', ...stroke }))
    }

    /** Set in apply: opens a new conversation with an editable draft, through the Web UI's workspace service. */
    let startChat = null
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
    const loadStart = () => Promise.all([
      getJson('media-hub/api/locales', {}),
      getJson('media-hub/api/settings', {}),
      import(web('i18n.js')),
    ])

    /** The page's modules, loaded once and handed this page's React. */
    let pageModule
    const loadPage = () => {
      pageModule ??= Promise.all([import(web('ui.js')), import(web('page.js'))]).then(([ui, page]) => {
        ui.init(React)
        ui.setChat(startChat)
        return page
      })
      return pageModule
    }

    /** A room asked for by the page's URL (?media-room=<id> or ?videosync=<id>), taken once. */
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

    function MediaHubPage({ translate }) {
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
      useEffect(() => {
        let live = true
        loadPage().then(module => { if (live) setPage(module) }, (reason) => {
          pageModule = undefined
          if (live) setError(reason.message)
        })
        return () => { live = false }
      }, [])
      return h('div', { className: 'vsync-page' },
        page !== null && h(page.Page, { t, initialRoom }),
        error && h('p', { className: 'vsync-error', role: 'alert', style: { padding: 24 } }, error))
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const t = ctx.locale.bind(NS)
        localeStore = ctx.locale
        startChat = (prompt) => {
          const workspace = ctx.get('uiWorkspace')
          if (workspace === undefined) return undefined
          return workspace.startSession(undefined, { prompt, whenDraftExists: 'replace' })
        }

        ctx.effect(() => {
          if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return () => {}
          const tag = document.createElement('link')
          tag.id = STYLE_ID
          tag.rel = 'stylesheet'
          tag.href = web('panel.css')
          tag.dataset.plugin = '@soffits/dsh-media-hub'
          document.head.appendChild(tag)
          return () => tag.remove()
        }, 'media-hub: styles')

        // The words register first, so neither the entry nor the page ever shows a bare key.
        ctx.effect(() => {
          let live = true
          const disposers = []
          loadStart().then(([words, settings, { pick }]) => {
            if (!live) return
            try {
              disposers.push(ctx.locale.register(NS, words))
            } catch (error) {
              console.warn('[media-hub] words: %s', error.message)
            }
            const label = settings.label ?? ''
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
              label: () => pick(label, activeLanguage()).trim() || t('panel'),
            }, SidebarIcon)))
          })
          return () => {
            live = false
            for (const dispose of disposers.reverse()) dispose()
          }
        }, 'media-hub: words and entries')

        // A link to a room, or to a tab, opens this panel once it is registered.
        ctx.effect(() => {
          takeLinkedRoom()
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
          if (linkedRoom !== null) open()
          else import(web('nav.js')).then(({ hasNavParams }) => { if (live && hasNavParams(location.search)) open() }, () => {})
          return () => { live = false; clearInterval(timer) }
        }, 'media-hub: room link')
      },
    }
  },
})
