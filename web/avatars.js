/**
 * Who is watching, as overlapping round avatars (the first few, then +N):
 * the person's picture when the sign-in plugin has one for this browser's
 * user, else initials on a colour taken from the name. Pressing the stack
 * opens a small list with each person's name and state.
 */
import { h, profile, React } from './ui.js'

const SHOWN = 3

const hueOf = name => [...name].reduce((sum, char) => (sum * 31 + char.codePointAt(0)) % 360, 7)
const initialsOf = name => [...name.trim()].slice(0, 2).join('').toUpperCase() || '?'

function Avatar({ name, picture }) {
  if (picture) return h('img', { className: 'vsync-avatar', src: picture, alt: '', title: name, referrerPolicy: 'no-referrer' })
  return h('span', { className: 'vsync-avatar', title: name, style: { background: `hsl(${hueOf(name)} 45% 42%)` } }, initialsOf(name))
}

/**
 * @param {{ key?: string, name: string, state?: string | null, self?: boolean }[]} members
 */
export function AvatarStack({ t, members }) {
  const [open, setOpen] = React.useState(false)
  const [mine, setMine] = React.useState(null)
  const root = React.useRef(null)
  React.useEffect(() => { profile().then(setMine) }, [])
  React.useEffect(() => {
    if (!open) return undefined
    const away = (event) => { if (!root.current?.contains(event.target)) setOpen(false) }
    const key = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', key) }
  }, [open])
  if (members.length === 0) return null
  const pictureOf = member => (member.self && mine?.picture ? mine.picture : null)
  const label = members.map(member => member.name).join(', ')
  return h('span', { className: 'vsync-avatarWrap', ref: root },
    h('button', { type: 'button', className: 'vsync-avatarStack', 'aria-label': label, title: label, 'aria-haspopup': 'true', 'aria-expanded': String(open), onClick: () => setOpen(!open) },
      members.slice(0, SHOWN).map((member, n) => h(Avatar, { key: member.key ?? `${member.name}-${n}`, name: member.name, picture: pictureOf(member) })),
      members.length > SHOWN && h('span', { className: 'vsync-avatar vsync-avatarMore' }, `+${members.length - SHOWN}`)),
    open && h('ul', { className: 'vsync-avatarMenu', role: 'list' }, members.map((member, n) => h('li', { key: member.key ?? `${member.name}-${n}`, className: 'vsync-avatarItem' },
      h(Avatar, { name: member.name, picture: pictureOf(member) }),
      h('span', { className: 'vsync-avatarName' }, member.self ? `${member.name} (${t('room.you')})` : member.name),
      member.state && h('span', { className: 'vsync-avatarState' }, member.state)))))
}
