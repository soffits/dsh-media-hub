/**
 * Danmaku over the picture: the comments people posted at a moment of an
 * episode fly across it in time with the <video> playing, through Danmaku
 * (weizhenye/Danmaku, its DOM engine, served by the host as danmaku.mjs).
 * How they show (on or off, how opaque, how much of the picture they may
 * cover, how large) is each viewer's own choice, kept in this browser.
 */
import { React, h } from './ui.js'

const SETTINGS_KEY = 'media-hub.danmaku'
/** Seconds a comment takes to cross the picture, whatever its width (the official apps use about this). */
const CROSS_SECONDS = 8
export const AREAS = Object.freeze([0.25, 0.5, 1])
export const SIZES = Object.freeze(['small', 'medium', 'large'])
export const OPACITIES = Object.freeze([0.25, 0.5, 0.75, 1])
const DEFAULTS = Object.freeze({ on: true, opacity: 0.75, area: 0.5, size: 'medium' })

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')
    return {
      on: typeof saved.on === 'boolean' ? saved.on : DEFAULTS.on,
      opacity: OPACITIES.includes(saved.opacity) ? saved.opacity : DEFAULTS.opacity,
      area: AREAS.includes(saved.area) ? saved.area : DEFAULTS.area,
      size: SIZES.includes(saved.size) ? saved.size : DEFAULTS.size,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

/** This viewer's danmaku settings and a way to change some of them. */
export function useDanmakuSettings() {
  const [settings, setSettings] = React.useState(loadSettings)
  const change = React.useCallback((patch) => {
    setSettings((current) => {
      const next = { ...current, ...patch }
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      } catch { /* private mode: the choice lasts for this page */ }
      return next
    })
  }, [])
  return [settings, change]
}

/**
 * The layer over the stage. `media` is the <video> in front (the player swaps
 * elements between episodes), `items` the episode's danmaku `[{ time, text }]`.
 */
export function DanmakuLayer({ media, items, settings }) {
  const box = React.useRef(null)
  React.useEffect(() => {
    const container = box.current
    if (container === null || media === null || items.length === 0) return undefined
    let engine = null
    let gone = false
    const fit = () => {
      if (engine === null) return
      engine.resize()
      engine.speed = Math.max(60, container.offsetWidth / CROSS_SECONDS)
    }
    const watcher = new ResizeObserver(fit)
    import(new URL('./danmaku.mjs', import.meta.url).href).then(({ default: Danmaku }) => {
      if (gone) return
      engine = new Danmaku({ container, media, engine: 'dom', comments: items.map(item => ({ text: item.text, time: item.time, mode: 'rtl' })) })
      fit()
      watcher.observe(container)
    })
    return () => {
      gone = true
      watcher.disconnect()
      engine?.destroy()
    }
  }, [media, items])
  return h('div', {
    ref: box,
    className: 'vsync-danmaku',
    'aria-hidden': 'true',
    'data-size': settings.size,
    style: { opacity: settings.opacity, height: `${settings.area * 100}%` },
  })
}
