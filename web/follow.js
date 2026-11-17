/**
 * Following a work: the host looks for its next season (and new episodes)
 * now and then and adds a new season to the library by itself. A work not in
 * the library is added as an empty show when followed.
 */
import { useKnownWork } from './known.js'
import { Btn, K, Known, h, post, React } from './ui.js'

/** `compact`: the bell alone, its words on hover and for screen readers. */
export function FollowButton({ t, source, work, compact = false }) {
  const known = useKnownWork(source, work.id)
  const { reload } = React.useContext(Known)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState(null)
  const following = known.show?.follow != null
  const toggle = async () => {
    setBusy(true)
    setError(null)
    const answer = await post('follow', { source, id: work.id, follow: !following })
    setBusy(false)
    if (answer.error) setError(answer.error)
    reload()
  }
  return h(React.Fragment, null,
    compact
      ? h(Btn, { 'aria-pressed': String(following), 'aria-label': t(following ? 'follow.following' : 'follow.follow'), title: t(following ? 'follow.following' : 'follow.hint'), disabled: busy, onClick: toggle, icon: h(K.Icon, { name: following ? 'bell-ring' : 'bell-plus', size: 16 }) })
      : h('button', { type: 'button', className: `vsync-btn${following ? ' vsync-following' : ''}`, 'aria-pressed': String(following), disabled: busy, title: t('follow.hint'), onClick: toggle }, t(following ? 'follow.following' : 'follow.follow')),
    error && h('span', { className: 'vsync-error', role: 'alert' }, error))
}
