/**
 * Open rooms: who is in each, which episode, and joining, copying the
 * link or closing it from the list.
 */
import { AvatarStack } from './avatars.js'
import { Confirm, Icon, api, base, copyText, fill, h, React, roomLink, time } from './ui.js'

function meta(t, room) {
  const parts = []
  if (room.episodes > 1) parts.push(fill(t('rooms.episode'), { n: room.index + 1, total: room.episodes }))
  if (room.current && room.current !== room.title) parts.push(room.current)
  if (room.members.length === 0) {
    if (room.emptySince) parts.push(fill(t('rooms.emptySince'), { time: time(t, room.emptySince) }))
    else if (room.opened === false) parts.push(t('rooms.unopened'))
  }
  if (room.preparing > 0) parts.push(fill(t('rooms.preparing'), { n: room.preparing }))
  parts.push(fill(t('rooms.openedBy'), { name: room.createdBy || t('agent') }))
  return parts
}

function RoomRow({ t, room, onOpen, onChanged }) {
  const [closing, setClosing] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const copy = async () => {
    if (await copyText(roomLink(room.id), t('room.copy'))) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }
  const picture = room.frame ? new URL(`thumbs/${room.frame}`, base()).href : room.cover ? new URL(room.cover, base()).href : null
  const share = room.duration > 0 ? Math.min(1, Math.max(0, room.position / room.duration)) : null
  return h('li', { className: 'vsync-row vsync-roomRow' },
    picture
      ? h('img', { className: 'vsync-preview', src: picture, alt: '', loading: 'lazy' })
      : h('span', { className: 'vsync-glyph' }, room.source === 'youtube' ? h(Icon.Screen) : h(Icon.Film)),
    h('span', { className: 'vsync-rowText' },
      h('span', { className: 'vsync-rowTitle' }, room.title),
      h('span', { className: 'vsync-rowMeta' },
        room.members.length > 0 && h('span', { key: 'who', className: 'vsync-roomWho' }, h(AvatarStack, { t, members: room.members.map(name => ({ name })) })),
        meta(t, room).map((part, n) => h('span', { key: n }, part))),
      share !== null && h('span', { className: 'vsync-watchBar vsync-roomBar', 'aria-hidden': true }, h('span', { style: { width: `${Math.max(2, share * 100)}%` } }))),
    closing
      ? h(Confirm, {
        t,
        question: room.members.length > 0 ? fill(t('rooms.closeQuestionBusy'), { names: room.members.join(', ') }) : t('rooms.closeQuestion'),
        confirmLabel: t('room.close'),
        onCancel: () => setClosing(false),
        onConfirm: async () => {
          await api(`rooms/${encodeURIComponent(room.id)}`, { method: 'DELETE' })
          setClosing(false)
          onChanged()
        },
      })
      : h('span', { className: 'vsync-actions' },
        h('button', { type: 'button', className: 'vsync-icon', 'aria-label': copied ? t('room.copied') : t('room.copy'), title: copied ? t('room.copied') : t('room.copy'), onClick: copy }, h(Icon.Link)),
        h('button', { type: 'button', className: 'vsync-icon', 'aria-label': t('room.close'), title: t('room.close'), onClick: () => setClosing(true) }, h(Icon.Close)),
        h('button', { type: 'button', className: 'vsync-btn', onClick: () => onOpen(room.id) }, t('rooms.join'))))
}

export function RoomsSection({ t, rooms, onOpen, onChanged }) {
  if (rooms === undefined) return null
  return h('section', { className: 'vsync-section', 'aria-labelledby': 'vsync-rooms' },
    h('h2', { id: 'vsync-rooms' }, t('rooms.heading')),
    rooms.length === 0
      ? h('p', { className: 'vsync-empty' }, t('rooms.none'))
      : h('ul', { className: 'vsync-rows' }, rooms.map(room => h(RoomRow, { key: room.id, t, room, onOpen, onChanged }))))
}
