/**
 * One room: the player, its episodes, who is watching, and who did what.
 * The player and its sync live in player.js.
 */
import { About, nextSeason } from './about-view.js'
import { AvatarStack } from './avatars.js'
import { Comments } from './comments-view.js'
import { DanmakuLayer, useDanmakuSettings } from './danmaku-layer.js'
import { Cover } from './details.js'
import { useKnownWork } from './known.js'
import { PlayerBar } from './player-bar.js'
import { Changes, Confirm, Icon, ProgressBar, React, api, asPersonPaying, base, captionText, clock, copyText, displayName, fill, h, post, progressFraction, progressText, roomLink, watchMark } from './ui.js'

const TOAST_MS = 4000
/** A wait shorter than this (a seek into what is already loaded) shows nothing. */
const WAIT_SHOWN_AFTER_MS = 600

function toastText(t, event) {
  if (event.kind === 'joined' || event.kind === 'left') return fill(t(`toast.${event.kind}`), { name: event.name })
  if (event.kind === 'error') return event.message
  const { last, item } = event
  const values = { name: last.by, time: clock(last.position), episode: item?.title ?? fill(t('room.episodeN'), { n: (last.index ?? 0) + 1 }), rate: last.rate, names: (last.skipped ?? []).join(', ') }
  return fill(t(`toast.${last.op}`), values)
}

/**
 * The waiting room, like Plex's: the room holds until everyone can play,
 * each viewer listed as loading or ready; after a while anyone may start
 * without those still loading.
 */
function WaitPanel({ t, view, item, onSkip, onContinue }) {
  const others = view.members.filter(member => member.clientId !== view.clientId && member.wait === 'loading')
  const names = others.map(member => member.name).join(', ')
  let title
  if (item.status !== 'ready') title = progressText(t, item.progress)
  else if (others.length > 0) title = fill(t('room.waitingFor'), { names })
  else title = t('room.loading')
  return h('div', { className: 'vsync-wait', role: 'status' },
    h('p', { className: 'vsync-waitTitle' }, title),
    item.status !== 'ready' && h(ProgressBar, { progress: item.progress }),
    h('ul', { className: 'vsync-waitList' }, view.members.map(member => h('li', { key: member.clientId, className: 'vsync-waitMember', 'data-wait': member.wait },
      member.wait === 'ready' ? h('span', { className: 'vsync-waitMark' }, h(Icon.Check, { size: 14 })) : h('span', { className: 'vsync-spinner', 'aria-hidden': 'true' }),
      h('span', { className: 'vsync-waitName' }, member.clientId === view.clientId ? `${member.name} (${t('room.you')})` : member.name),
      h('span', { className: 'vsync-waitState' }, t(`room.wait.${member.wait}`))))),
    view.wait.tap && h('button', { type: 'button', className: 'vsync-btn vsync-primary', onClick: onContinue }, t('room.tapToContinue')),
    view.wait.canSkip && others.length > 0 && view.wait.held && h('button', { type: 'button', className: 'vsync-btn', onClick: onSkip }, fill(t('room.startWithout'), { names })))
}

/** No danmaku yet: the same empty list each time, so the layer is not rebuilt. */
const NO_DANMAKU = Object.freeze([])

/**
 * The player filling the screen with the danmaku and the bar on top: the browser's full screen for the player's box
 * where it has one, else (iPhone, which only lets a bare <video> go full screen) the box covering the page.
 */
function useFullScreen(box) {
  const [covering, setCovering] = React.useState(false)
  const [native, setNative] = React.useState(false)
  React.useEffect(() => {
    const changed = () => setNative(document.fullscreenElement === box.current && box.current !== null)
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  }, [])
  const toggle = () => {
    if (native) return void document.exitFullscreen()
    if (covering) return setCovering(false)
    if (typeof box.current?.requestFullscreen === 'function' && document.fullscreenEnabled) return void box.current.requestFullscreen().catch(() => setCovering(true))
    return setCovering(true)
  }
  return { full: native || covering, covering, toggle }
}

export function RoomView({ t, roomId, onLeave, onOpen }) {
  const stage = React.useRef(null)
  const playerBox = React.useRef(null)
  const { shows } = React.useContext(Changes)
  const [danmakuSettings, setDanmakuSettings] = useDanmakuSettings()
  const [danmaku, setDanmaku] = React.useState({ index: null, items: NO_DANMAKU })
  const [qualityBusy, setQualityBusy] = React.useState(false)
  const screen = useFullScreen(playerBox)
  const toggleFull = React.useRef(screen.toggle)
  toggleFull.current = screen.toggle
  const session = React.useRef(null)
  const [view, setView] = React.useState({ connection: 'connecting', room: null, members: [], needsGesture: false })
  const [toasts, setToasts] = React.useState([])
  const [copied, setCopied] = React.useState(false)
  /** What the show's source told about its work, kept with the show (null: none, or not known yet). */
  const [about, setAbout] = React.useState(null)
  const [side, setSide] = React.useState('episodes')
  const [seasonBusy, setSeasonBusy] = React.useState(false)

  const toast = React.useCallback((text) => {
    const id = Math.random()
    setToasts(list => [...list.slice(-2), { id, text }])
    setTimeout(() => setToasts(list => list.filter(item => item.id !== id)), TOAST_MS)
  }, [])

  React.useEffect(() => {
    let cancelled = false
    const start = async () => {
      const [module, name] = await Promise.all([import('./player.js'), displayName(t('guest'))])
      if (cancelled || stage.current === null) return
      session.current = module.joinRoom({
        base: base(),
        roomId,
        name,
        language: t.language,
        trackLabel: label => captionText(t, label),
        stage: stage.current,
        onUpdate: setView,
        onEvent: event => toast(toastText(t, event)),
        onFullScreen: () => toggleFull.current(),
      })
    }
    start().catch(error => toast(error.message))
    return () => {
      cancelled = true
      session.current?.destroy()
      session.current = null
    }
  }, [roomId])

  // The show's notes change (another viewer picked a quality, the work was read again): read them again.
  React.useEffect(() => {
    let live = true
    api(`rooms/${encodeURIComponent(roomId)}/work`).then((answer) => { if (live && answer.work) setAbout(answer) })
    return () => { live = false }
  }, [roomId, shows])

  const room = view.room
  const item = room?.items[room.index]
  const index = room?.index ?? null
  const wantsDanmaku = about?.danmaku === true && danmakuSettings.on
  React.useEffect(() => {
    if (!wantsDanmaku || index === null) return undefined
    let live = true
    setDanmaku({ index, items: NO_DANMAKU })
    api(`rooms/${encodeURIComponent(roomId)}/danmaku/${index}`).then((answer) => {
      if (live && Array.isArray(answer.items)) setDanmaku({ index, items: answer.items })
    })
    return () => { live = false }
  }, [roomId, index, wantsDanmaku])
  const choices = about?.work?.qualities ?? []
  const pickQuality = async (quality) => {
    setQualityBusy(true)
    const answer = await post(`rooms/${encodeURIComponent(roomId)}/quality`, { quality })
    setQualityBusy(false)
    if (answer.error) toast(answer.error)
    else setAbout(current => ({ ...current, quality: answer.quality }))
  }
  const copy = async () => {
    if (await copyText(roomLink(roomId), t('room.copy'))) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }
  /** Someone watching alone opens the room to others where it stands, and gets its link to send. */
  const together = async () => {
    const answer = await post(`rooms/${encodeURIComponent(roomId)}/together`, {})
    if (answer.error) return toast(answer.error)
    if (await copyText(roomLink(roomId), t('room.copy'))) toast(t('room.togetherCopied'))
    return undefined
  }
  const [closing, setClosing] = React.useState(false)
  const close = async () => {
    await api(`rooms/${encodeURIComponent(roomId)}`, { method: 'DELETE' })
    onLeave()
  }

  const tabs = [room && room.items.length > 1 && 'episodes', about && 'about', about?.comments && 'comments'].filter(Boolean)
  const shownSide = tabs.includes(side) ? side : tabs[0]
  const season = about ? nextSeason(about.work) : null
  const seasonKnown = useKnownWork(about?.source, season?.id)
  const watchSeason = async () => {
    if (seasonKnown.room !== null) return onOpen(seasonKnown.room.id)
    setSeasonBusy(true)
    const answer = await asPersonPaying('fetch', { source: about.source, id: season.id, watch: true, all: false, language: t.language, by: await displayName(t('guest')) })
    setSeasonBusy(false)
    if (answer.error) return toast(answer.error)
    if (answer.declined) return undefined
    return onOpen(answer.room.id)
  }

  let overlay = null
  if (view.connection === 'closed') overlay = h('p', null, t('room.closed'))
  else if (item?.status === 'failed') overlay = h('p', null, item.reason ? t(`error.${item.reason}`) : t('room.failed'))
  else if (item && view.wait && (item.status !== 'ready' || view.wait.tap || (view.wait.held && view.wait.age >= WAIT_SHOWN_AFTER_MS))) overlay = h(WaitPanel, { t, view, item, onSkip: () => session.current?.skip(), onContinue: () => session.current?.continueLoading() })
  else if (item?.status === 'preparing' || item?.status === 'remote') overlay = h('div', { className: 'vsync-preparing', role: 'status' }, h('p', null, progressText(t, item.progress)), h(ProgressBar, { progress: item.progress }))
  else if (view.needsGesture) overlay = h('button', { type: 'button', className: 'vsync-btn vsync-btnLarge vsync-primary', onClick: () => session.current?.unlock() }, t('room.tapToJoin'))
  else if (room === null) overlay = h('p', null, t('room.connecting'))

  return h(React.Fragment, null,
    h('div', { className: 'vsync-bar' },
      h('button', { type: 'button', className: 'vsync-icon', 'aria-label': t('room.back'), title: t('room.back'), onClick: onLeave }, h(Icon.Back)),
      about && h('span', { className: 'vsync-barCover' }, h(Cover, { result: about.work, small: true })),
      h('div', { className: 'vsync-barTitle' },
        h('strong', null, room?.title ?? ''),
        room && room.items.length > 1 && item && h('span', null, item.title ?? fill(t('room.episodeN'), { n: room.index + 1 }))),
      view.connection === 'reconnecting' && h('span', { className: 'vsync-status', role: 'status' }, t('room.reconnecting')),
      room && !room.together && h('button', { type: 'button', className: 'vsync-btn', onClick: together }, h(Icon.Link), t('room.watchTogether')),
      room?.together && h('div', { className: 'vsync-members', 'aria-label': t('room.viewers') }, h(AvatarStack, {
        t,
        members: view.members.map(member => ({ key: member.clientId, name: member.name, self: member.clientId === view.clientId, state: member.wait ? t(`room.wait.${member.wait}`) : t(room?.playing ? 'room.state.playing' : 'room.state.paused') })),
      })),
      closing
        ? h(Confirm, { t, question: t('room.closeConfirm'), confirmLabel: t('room.close'), onCancel: () => setClosing(false), onConfirm: close })
        : h(React.Fragment, null,
          room?.together && h('button', { type: 'button', className: 'vsync-icon', 'aria-label': copied ? t('room.copied') : t('room.copy'), title: copied ? t('room.copied') : t('room.copy'), onClick: copy }, h(Icon.Link)),
          h('button', { type: 'button', className: 'vsync-icon', 'aria-label': t('room.close'), title: t('room.close'), onClick: () => setClosing(true) }, h(Icon.Close)))),
    h('div', { className: 'vsync-body' },
      h('div', { className: 'vsync-player', ref: playerBox, 'data-covering': String(screen.covering) },
        h('div', { className: 'vsync-stageWrap' },
          h('div', { className: 'vsync-stage', ref: stage }),
          wantsDanmaku && danmaku.index === index && h(DanmakuLayer, { media: session.current?.media ?? null, items: danmaku.items, settings: danmakuSettings }),
          overlay && h('div', { className: 'vsync-overlay' }, overlay),
          h('div', { className: 'vsync-toasts', role: 'status', 'aria-live': 'polite' }, toasts.map(item => h('span', { key: item.id, className: 'vsync-toast' }, item.text)))),
        room && h(PlayerBar, {
          t,
          settings: danmakuSettings,
          onSettings: setDanmakuSettings,
          danmaku: about?.danmaku === true,
          count: danmaku.index === index && danmaku.items !== NO_DANMAKU ? danmaku.items.length : null,
          quality: choices.length > 1 ? { value: choices.includes(about.quality) ? about.quality : choices[0], choices, onChange: pickQuality, busy: qualityBusy } : null,
          full: screen.full,
          onFull: screen.toggle,
        })),
      tabs.length > 0 && h('aside', { className: 'vsync-episodes', 'aria-label': t('room.episodes') },
        tabs.length > 1 && h('div', { className: 'vsync-sideTabs', role: 'tablist' },
          tabs.map(tab => h('button', { key: tab, type: 'button', role: 'tab', className: 'vsync-chip', 'aria-selected': String(shownSide === tab), onClick: () => setSide(tab) }, t(`room.tab.${tab}`)))),
        shownSide === 'about' && h(About, { t, work: about.work, source: about.source, workId: about.id }),
        shownSide === 'comments' && h(Comments, { t, roomId }),
        shownSide === 'episodes' && h(React.Fragment, null,
          !about && h('h2', null, t('room.episodes')),
          h('ol', { className: 'vsync-episodeList' }, room.items.map((episode, index) => {
            const mark = watchMark(t, episode.watch, index === room.index)
            const title = episode.title ?? fill(t('room.episodeN'), { n: index + 1 })
            return h('li', { key: index },
              h('button', {
                type: 'button',
                className: 'vsync-episode',
                'aria-current': String(index === room.index),
                'data-watch': mark.state,
                'data-cached': String(episode.cached),
                title: episode.cached ? undefined : t('room.notCached'),
                disabled: episode.status === 'failed' && episode.cached,
                onClick: () => session.current?.select(index),
              },
              h('span', { className: 'vsync-episodeNo' }, index + 1),
              h('span', { className: 'vsync-episodeMain' },
                h('span', { className: 'vsync-episodeTitle' }, title),
                mark.bar),
              episode.status === 'preparing'
                ? h('span', { className: 'vsync-episodeState' }, progressFraction(episode.progress) === null ? '…' : `${Math.floor(progressFraction(episode.progress) * 100)}%`)
                : mark.note))
          })),
          season && h('div', { className: 'vsync-nextSeason', 'data-last': String(room.index === room.items.length - 1) },
            h('span', { className: 'vsync-nextSeasonText' }, fill(t('room.nextSeason'), { title: season.title })),
            h('button', { type: 'button', className: 'vsync-btn vsync-primary', disabled: seasonBusy, onClick: watchSeason }, seasonBusy ? t('search.opening') : seasonKnown.room !== null ? t('search.joinRoom') : seasonKnown.show !== null ? t(seasonKnown.show.resume ? 'search.continue' : 'search.open') : t('search.watch')))))))
}
