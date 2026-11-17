/**
 * Shared pieces of the media hub page: React from the host page, requests
 * to the Host half, formatting, icons and two small controls (an inline
 * confirmation and a menu). The page's other modules import this one.
 */
export let React
export let h
/** What the page knows of the library and the open rooms (web/known.js): set by Page, read anywhere a work is shown. */
export let Known

/** Called once by client.js with the page's React before any view renders. */
export function init(react) {
  React = react
  h = react.createElement
  Known = react.createContext({ library: null, rooms: undefined, reload: () => {} })
}

export const base = () => new URL('media-hub/', document.baseURI)
export const LINK_PARAM = 'media-room'
export const POLL_MS = 4000

/** One request to the Host half; failures come back as { error }. */
export async function api(path, init = {}) {
  try {
    const response = await fetch(new URL(`api/${path}`, base()), { ...init, headers: { 'content-type': 'application/json' } })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return { error: data.error?.message ?? `HTTP ${response.status}`, code: data.error?.code }
    return data
  } catch (error) {
    return { error: error.message }
  }
}

export const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) })

/** The shelf's routes live under DSH's own /api, where the signed-in person is known (src/shelf-routes.js). */
export const shelfUrl = (path = '') => new URL(`api/media-hub/shelf${path}`, document.baseURI)

export async function shelf(path = '', body) {
  try {
    const response = await fetch(shelfUrl(path), body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return { error: data.error?.message ?? `HTTP ${response.status}` }
    return data
  } catch (error) {
    return { error: error.message }
  }
}

/** Starts a new conversation with a prefilled, editable message (set by client.js from the Web UI's workspace service). */
let startChat = null
export function setChat(start) { startChat = start }
export const canChat = () => startChat !== null

/**
 * Open a conversation about an item: its title and facts quoted, a small JSON context below, for the person to finish and send.
 * @param {string} intro - the first line, in the viewer's language
 * @param {string[]} lines - what is shown about the item
 * @param {object} context - ids that let the agent find it again
 */
export function chatAbout(intro, lines, context) {
  const quoted = lines.filter(Boolean).map(line => `> ${line}`).join('\n')
  return startChat?.(`${intro}\n\n${quoted}\n\n\`\`\`json\n${JSON.stringify(context)}\n\`\`\`\n\n`)
}
export const query = values => new URLSearchParams(values).toString()

/** The signed-in user's name and picture (when it has one) from the sign-in plugin, if there is one. */
let profileRequest
export function profile() {
  profileRequest ??= fetch(new URL('_dsh-oidc/session', document.baseURI))
    .then(r => (r.ok ? r.json() : null))
    .then(d => ({ name: (d && (d.name || d.username)) || null, picture: (d && (d.picture || d.avatar || d.avatar_url)) || null }), () => ({ name: null, picture: null }))
  return profileRequest
}

export const displayName = fallback => profile().then(({ name }) => name || fallback)

/**
 * A configured name in the viewer's language: a string as it is, or from `{ en, zh, ... }` the viewer's
 * language, else its primary subtag, else English, else the first one given.
 */
export function localized(value, t) {
  if (typeof value === 'string') return value
  if (value === null || typeof value !== 'object') return ''
  const tag = String(t('time.locale') || 'en')
  return value[tag] ?? value[tag.split('-')[0]] ?? value.en ?? Object.values(value)[0] ?? ''
}

export const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''))

export function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds ?? 0))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return hh > 0 ? `${hh}:${String(mm).padStart(2, '0')}:${ss}` : `${mm}:${ss}`
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB']
export function bytes(value) {
  let n = Math.max(0, value ?? 0)
  let unit = 0
  while (n >= 1000 && unit < UNITS.length - 1) {
    n /= 1000
    unit += 1
  }
  return `${n >= 10 || unit === 0 ? Math.round(n) : n.toFixed(1)} ${UNITS[unit]}`
}

/** Rough size of one downloaded episode by kind, for "about N GB" before a download (src/sources/index.js keeps the same numbers). */
export const EPISODE_BYTES = { drama: 15e6, audio: 8e6 }

export const DAY_MS = 86_400_000
export const day = (t, ms) => new Intl.DateTimeFormat(t('time.locale'), { month: 'short', day: 'numeric' }).format(new Date(ms))
export const time = (t, ms) => new Intl.DateTimeFormat(t('time.locale'), { hour: '2-digit', minute: '2-digit' }).format(new Date(ms))

export const roomLink = id => `${location.origin}${location.pathname}?${LINK_PARAM}=${encodeURIComponent(id)}`

export async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    window.prompt(label, text)
    return false
  }
}

// ------------------------------------------------------------ icons
// Drawn for this plugin on a 16-unit grid; the stroke follows the text colour.

const svg = (size, ...children) => h('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true, focusable: 'false' }, ...children)
const stroke = { stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round' }
export const Icon = {
  Screen: ({ size = 16 }) => svg(size,
    h('rect', { x: 1.75, y: 2.75, width: 12.5, height: 8.5, rx: 1.5, ...stroke }),
    h('path', { d: 'M6.9 5.3v3.4L9.7 7 6.9 5.3Z', fill: 'currentColor' }),
    h('path', { d: 'M4.5 13.6c1 .5 2.2.8 3.5.8s2.5-.3 3.5-.8', ...stroke })),
  Film: ({ size = 16 }) => svg(size, h('rect', { x: 2, y: 3, width: 12, height: 10, rx: 1.5, ...stroke }), h('path', { d: 'M5 3v10M11 3v10M2 6h3M2 10h3M11 6h3M11 10h3', ...stroke })),
  Audio: ({ size = 16 }) => svg(size, h('path', { d: 'M3 9.5V8a5 5 0 0 1 10 0v1.5', ...stroke }), h('rect', { x: 2.5, y: 9, width: 2.5, height: 4, rx: 1, ...stroke }), h('rect', { x: 11, y: 9, width: 2.5, height: 4, rx: 1, ...stroke })),
  Back: ({ size = 16 }) => svg(size, h('path', { d: 'M10 3.5 5.5 8l4.5 4.5', ...stroke })),
  Link: ({ size = 16 }) => svg(size, h('path', { d: 'M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-.6.6M9.2 6.8a2.6 2.6 0 0 0-3.7 0l-2 2a2.6 2.6 0 0 0 3.7 3.7l.6-.6', ...stroke })),
  Close: ({ size = 16 }) => svg(size, h('path', { d: 'M4 4l8 8M12 4l-8 8', ...stroke })),
  Search: ({ size = 16 }) => svg(size, h('circle', { cx: 7, cy: 7, r: 4.25, ...stroke }), h('path', { d: 'm10.2 10.2 3.3 3.3', ...stroke })),
  More: ({ size = 16 }) => svg(size, ...[4, 8, 12].map(x => h('circle', { key: x, cx: x, cy: 8, r: 1, fill: 'currentColor' }))),
  Chat: ({ size = 16 }) => svg(size, h('path', { d: 'M3 4.5A1.5 1.5 0 0 1 4.5 3h7A1.5 1.5 0 0 1 13 4.5v5a1.5 1.5 0 0 1-1.5 1.5H7l-3 2.5V11h.5A1.5 1.5 0 0 1 3 9.5Z', ...stroke })),
  Download: ({ size = 16 }) => svg(size, h('path', { d: 'M8 2.5v8M4.75 7.5 8 10.75l3.25-3.25M3 13.5h10', ...stroke })),
  Book: ({ size = 16 }) => svg(size, h('path', { d: 'M3 3.5A1.5 1.5 0 0 1 4.5 2H13v10H4.5A1.5 1.5 0 0 0 3 13.5Zm0 10A1.5 1.5 0 0 0 4.5 15H13v-3', ...stroke })),
  Check: ({ size = 16 }) => svg(size, h('path', { d: 'M3.5 8.5 6.5 11.5 12.5 4.5', ...stroke })),
  Chevron: ({ size = 16, open = false }) => svg(size, h('path', { d: open ? 'M4 6l4 4 4-4' : 'M6 4l4 4-4 4', ...stroke })),
}

/** A small turning ring, for something that is loading. */
export const Spinner = () => h('span', { className: 'vsync-spinner', 'aria-hidden': true })

// ------------------------------------------------------------ watched marks

/**
 * How an episode row shows what was watched: watched ones dimmed with a
 * check, partly watched ones a thin bar and where they stopped; the episode
 * playing now shows neither.
 * @returns {{ state: 'watched' | 'partial' | 'none', bar: object | null, note: object | null }}
 */
export function watchMark(t, watch, current = false) {
  if (current || watch === null || watch === undefined) return { state: 'none', bar: null, note: null }
  if (watch.finished) return { state: 'watched', bar: null, note: h('span', { className: 'vsync-watchCheck', title: t('watch.watched'), 'aria-label': t('watch.watched') }, h(Icon.Check, { size: 14 })) }
  if (!(watch.position > 0)) return { state: 'none', bar: null, note: null }
  const share = watch.duration > 0 ? Math.min(1, watch.position / watch.duration) : null
  return {
    state: 'partial',
    bar: share === null ? null : h('span', { className: 'vsync-watchBar', 'aria-hidden': true }, h('span', { style: { width: `${Math.max(3, share * 100)}%` } })),
    note: h('span', { className: 'vsync-episodeState' }, fill(t('watch.stoppedAt'), { time: clock(watch.position) })),
  }
}

// ------------------------------------------------------------ controls

/**
 * An action that asks first, in place: the trigger turns into the question
 * with Cancel and the confirming button. Closing a room, deleting a show.
 */
export function Confirm({ t, question, confirmLabel, onConfirm, onCancel, danger = true }) {
  const [busy, setBusy] = React.useState(false)
  return h('span', { className: 'vsync-confirm', role: 'group' },
    h('span', { className: 'vsync-confirmText' }, question),
    h('button', { type: 'button', className: 'vsync-btn', onClick: onCancel, disabled: busy }, t('action.cancel')),
    h('button', {
      type: 'button',
      className: `vsync-btn ${danger ? 'vsync-danger' : 'vsync-primary'}`,
      disabled: busy,
      onClick: async () => {
        setBusy(true)
        await onConfirm()
        setBusy(false)
      },
    }, confirmLabel))
}

/**
 * A button with a small menu of actions; closes on outside click or Escape.
 * Without children it is the "more" icon; with children, a quiet text button.
 */
export function Menu({ label, items, children, title }) {
  const [open, setOpen] = React.useState(false)
  const root = React.useRef(null)
  React.useEffect(() => {
    if (!open) return undefined
    const away = (event) => { if (!root.current?.contains(event.target)) setOpen(false) }
    const key = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', key)
    }
  }, [open])
  return h('span', { className: 'vsync-menuWrap', ref: root },
    h('button', { type: 'button', className: children ? 'vsync-metaButton' : 'vsync-icon', 'aria-label': label, title: title ?? label, 'aria-haspopup': 'menu', 'aria-expanded': String(open), onClick: () => setOpen(!open) }, children ?? h(Icon.More)),
    open && h('div', { className: 'vsync-menu', role: 'menu' }, items.filter(Boolean).map(item => h('button', {
      key: item.label,
      type: 'button',
      role: 'menuitem',
      className: `vsync-menuItem${item.danger ? ' vsync-menuDanger' : ''}`,
      onClick: () => {
        setOpen(false)
        item.onSelect()
      },
    }, item.label))))
}
