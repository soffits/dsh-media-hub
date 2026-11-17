/**
 * The Continue card at the top of Watching: the show someone is in now, or
 * the one watched last, over its blurred cover. Who is in the room, the
 * title, where it stands, an episode strip, joining or continuing alone,
 * watching together, the link, asking about it, a recap without spoilers
 * (when the `recap` part is on and one was written) and suggested next steps.
 */
import { AvatarStack } from './avatars.js'
import { Picture } from './details.js'
import { currentEpisode, episodeStrip, stripCounts } from './continue.js'
import { hasEpisodes, resumeLabel } from './format.js'
import { Btn, Icon, K, P, api, asPerson, base, canChat, chatAbout, clock, copyText, displayName, fill, h, nameOf, plural, post, React, roomLink } from './ui.js'

const names = (t, list) => new Intl.ListFormat(t.language, { type: 'conjunction' }).format(list)
const picture = key => (key ? new URL(key, base()).href : undefined)

/** The show's episodes from the library, for the strip; refreshed when where it stands changes. */
function useEpisodes(path, version) {
  const [episodes, setEpisodes] = React.useState(null)
  React.useEffect(() => {
    if (!path) return undefined
    let live = true
    api(`library/episodes?path=${encodeURIComponent(path)}`).then((answer) => { if (live && Array.isArray(answer.episodes)) setEpisodes(answer.episodes) })
    return () => { live = false }
  }, [path, version])
  return path ? episodes : null
}

function Strip({ t, episodes, current }) {
  if (!episodes || episodes.length < 2) return null
  const counts = stripCounts(episodes, current)
  const note = [counts.watched > 0 && plural(t, 'continue.watched', counts.watched), counts.ahead > 0 && plural(t, 'continue.onDisk', counts.ahead)].filter(Boolean).join(' · ')
  const items = episodeStrip(episodes, current).map(item => ({ state: item.state, title: fill(t('continue.episode'), { n: item.n }) }))
  return h('div', { className: 'vsync-ccStrip' }, h(K.Segments, { items, end: note || undefined, label: note || fill(t('continue.episode'), { n: current }) }))
}

export function ContinueCard({ t, subject, presence, sources, onOpen, onChanged }) {
  const { room, show } = subject
  const work = show?.work ?? null
  const current = currentEpisode(subject)
  const total = show?.total ?? (show?.sourced ? null : show?.episodes) ?? room?.episodes ?? null
  const episodes = useEpisodes(show?.path, `${current}:${show?.finished}:${show?.episodes}`)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState(null)
  const [copied, setCopied] = React.useState(false)

  const title = work?.title ?? room?.title ?? show?.name ?? ''
  const sourceId = show?.source?.source ?? null
  const source = sourceId === null ? '' : nameOf(t, `source.name.${sourceId}`, sources.find(entry => entry.id === sourceId)?.label ?? '')
  const meta = [
    hasEpisodes(total) ? fill(t('rooms.episode'), { n: current, total }) : null,
    work?.tags?.[0] ?? null,
    Number.isFinite(work?.score) ? fill(t('continue.score'), { score: work.score }) : null,
    source ? fill(t('continue.from'), { source }) : null,
  ].filter(Boolean)
  const members = room?.members ?? []
  const position = room ? room.position : show?.resume?.position ?? null
  const cover = work?.cover ?? room?.cover ?? show?.frame ?? room?.frame ?? null

  const run = async (action) => {
    setBusy(true)
    setError(null)
    const failure = await action()
    setBusy(false)
    if (failure) setError(failure)
  }
  /** A room for this show: the shared one when there is one, else a new one for this person alone. */
  const openRoom = async () => {
    if (room) return room.id
    const answer = await asPerson('rooms', { source: 'local', path: show.path, by: await displayName(t('guest')) })
    if (answer.error) throw new Error(answer.error)
    return answer.room.id
  }
  const go = () => run(async () => {
    try { onOpen(await openRoom()) } catch (failure) { return failure.message }
    return null
  })
  const together = () => run(async () => {
    try {
      const id = await openRoom()
      const answer = await post(`rooms/${encodeURIComponent(id)}/together`, {})
      if (answer.error) return answer.error
      await copyText(roomLink(id), t('room.copy'))
      onChanged()
      onOpen(id)
    } catch (failure) { return failure.message }
    return null
  })
  const copy = async () => {
    if (await copyText(roomLink(room.id), t('room.copy'))) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }
  const about = { title, lines: [meta.join(' · '), work?.blurb ?? ''], context: { show: show?.path ?? null, room: room?.id ?? null, episode: current } }
  const recap = presence.recap ? show?.recap ?? null : null
  const started = show?.stepsStarted ?? {}
  const states = Object.fromEntries(Object.keys(started).map(id => [id, 'done']))

  return h(K.Surface, { as: 'section', backdrop: picture(cover), className: 'vsync-cc', 'aria-label': title },
    h(Picture, { pictures: [cover], className: 'vsync-ccPoster', emptyClassName: 'vsync-ccPoster vsync-ccPosterEmpty', icon: h(Icon.Film, { size: 28 }) }),
    h('div', { className: 'vsync-ccBody' },
      members.length > 0 && h('p', { className: 'vsync-ccLive' },
        h(P.StateDot, { state: 'done', size: 8 }),
        h('span', null, fill(t(members.length === 1 ? 'continue.inRoomOne' : 'continue.inRoomMany'), { names: names(t, members) })),
        h(AvatarStack, { t, members: members.map(name => ({ name })) })),
      h('h2', { className: 'vsync-ccTitle' }, title),
      meta.length > 0 && h('p', { className: 'vsync-ccMeta' }, meta.join(' · ')),
      h(Strip, { t, episodes, current }),
      recap && h(K.Surface, { className: 'vsync-ccRecap' },
        h('p', { className: 'vsync-ccRecapHead' }, h(K.Icon, { name: 'book-open', size: 14 }), t('continue.recap')),
        h('p', { className: 'vsync-ccRecapText' }, recap.text)),
      h('div', { className: 'vsync-ccActions' },
        h(Btn, { variant: 'primary', disabled: busy || (!room && !show), onClick: go, icon: h(P.IconPlayOutlineRegular, { size: 16 }) },
          resumeLabel(t, { count: total, n: current, position, at: clock(position), names: members.length > 0 ? names(t, members) : '' })),
        room
          ? h(Btn, { onClick: copy, icon: h(P.IconLinkOutlineRegular, { size: 16 }) }, t(copied ? 'room.copied' : 'room.copy'))
          : show && h(Btn, { disabled: busy, onClick: together, icon: h(P.IconUsersOutlineRegular, { size: 16 }) }, t('room.watchTogether')),
        canChat() && h(Btn, { onClick: () => chatAbout(about), icon: h(P.IconNewChatOutlineRegular, { size: 16 }) }, t('chat.ask'))),
      error && h('p', { className: 'vsync-error', role: 'alert' }, error),
      show?.steps && h(K.Suggested, {
        actions: show.steps,
        about: { source: '@soffits/dsh-media-hub', ...about },
        states,
        onPress: async (action) => {
          const answer = await asPerson('steps', { path: show.path, id: action.id })
          onChanged()
          if (answer.error) throw new Error(answer.error)
        },
      })))
}
