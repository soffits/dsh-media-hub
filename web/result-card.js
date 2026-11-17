/**
 * One search result as a card: cover, title, score, how many watched it,
 * episodes, status and tags at a glance, with the actions to watch or save
 * it. Details (web/details.js) opens everything the source gives and the
 * other seasons and linked works, which open as a work of their own.
 */
import { ChatButton } from './books-view.js'
import { Cover, WorkDetails, glance, infoOf } from './details.js'
import { FollowButton } from './follow.js'
import { hasEpisodes, resumeLabel } from './format.js'
import { useKnownWork } from './known.js'
import { Confirm, EPISODE_BYTES, Icon, React, Spinner, asPersonPaying, bytes, chatAbout, clock, displayName, fill, h } from './ui.js'

/** Episodes fetched ahead of the one being watched; the Host's `cacheAhead` default, for the size hint. */
const WINDOW_EPISODES = 6

/** The words for a quality a source offers: auto, audio, or a height. */
const qualityLabel = (t, quality) => (/^\d+$/.test(quality) ? fill(t('quality.height'), { n: quality }) : t(`quality.${quality}`))

/** How the episodes are fetched, for a source that offers a choice (Link); its first choice (auto) is the default. */
function QualityPicker({ t, qualities, value, onChange }) {
  return h('select', { className: 'vsync-field vsync-pick vsync-quality', value, 'aria-label': t('quality.label'), title: t('quality.label'), onChange: event => onChange(event.target.value) },
    qualities.map(quality => h('option', { key: quality, value: quality }, qualityLabel(t, quality))))
}

export function Result({ t, source, result, onOpen, onSaved, onFocus, defaultOpen = false }) {
  const [info, setInfo] = React.useState(null)
  const [open, setOpen] = React.useState(defaultOpen)
  const [state, setState] = React.useState({ step: 'idle' })
  const qualities = result.qualities ?? []
  const [quality, setQuality] = React.useState(qualities[0] ?? '')
  const submitting = React.useRef(false)
  const known = useKnownWork(source.id, result.id)
  // The episode count normally comes with the result; ask for the details only when it did not.
  const needInfo = open || result.episodes === null
  React.useEffect(() => {
    if (!needInfo) return undefined
    let live = true
    infoOf(source.id, result.id, t.language).then(value => { if (live && !value.error) setInfo(value) })
    return () => { live = false }
  }, [source.id, result.id, needInfo])

  const episodes = result.episodes ?? info?.episodes ?? null
  const shown = { ...result, ...(info ?? {}), episodes, cover: result.cover ?? info?.cover }

  /** One request at a time per result: a second click while one is on its way does nothing. */
  const fetchIt = async ({ watch, all = false }) => {
    if (submitting.current) return undefined
    submitting.current = true
    setState({ step: watch ? 'opening' : 'saving' })
    const by = await displayName(t('guest'))
    const answer = await asPersonPaying('fetch', { source: source.id, id: result.id, watch, all, quality, language: t.language, by })
    submitting.current = false
    if (answer.error) return setState({ step: 'error', message: answer.error })
    if (answer.declined) return setState({ step: 'idle' })
    if (watch && answer.room) return onOpen(answer.room.id)
    setState({ step: 'saved', all })
    onSaved()
    return undefined
  }

  const busy = state.step === 'opening' || state.step === 'saving'
  let actions
  if (state.step === 'confirm') {
    actions = h(Confirm, {
      t,
      danger: false,
      question: fill(t('search.saveAllQuestion'), { n: episodes, size: bytes(t, episodes * (EPISODE_BYTES[result.kind] ?? EPISODE_BYTES.drama)) }),
      confirmLabel: t('search.saveAll'),
      onCancel: () => setState({ step: 'idle' }),
      onConfirm: () => fetchIt({ watch: false, all: true }),
    })
  } else if (busy) {
    actions = h('span', { className: 'vsync-pending', role: 'status' }, h(Spinner), t(state.step === 'opening' ? 'search.opening' : 'search.saving'))
  } else if (state.step === 'saved' && known.show === null) {
    actions = h('span', { className: 'vsync-pending' }, t(state.all ? 'search.savedAll' : 'search.saved'))
  } else if (known.show !== null) {
    // Already here: say so, and offer what makes sense for it instead of saving it again.
    const { show, room } = known
    const resume = show.resume
    actions = h(React.Fragment, null,
      h('span', { className: 'vsync-badge vsync-badgeHere' }, t(show.pinned ? 'search.offline' : 'search.inLibrary')),
      h(FollowButton, { t, source: source.id, work: result }),
      !show.pinned && show.sourced && hasEpisodes(show.total) && show.episodes < show.total && h('button', { type: 'button', className: 'vsync-btn', title: t('search.saveAllHint'), onClick: () => setState({ step: 'confirm' }) }, t('search.saveAll')),
      room !== null
        ? h('button', { type: 'button', className: 'vsync-btn vsync-primary', onClick: () => onOpen(room.id) }, t('search.joinRoom'))
        : h('button', { type: 'button', className: 'vsync-btn vsync-primary', onClick: () => fetchIt({ watch: true }) }, resume ? resumeLabel(t, { count: show.total ?? show.episodes, n: resume.index + 1, position: resume.position, at: clock(resume.position) }) : t('search.open')))
  } else {
    actions = h(React.Fragment, null,
      result.account && h('span', { className: 'vsync-account', title: t('link.accountHint') }, fill(t('link.account'), { name: result.account.name })),
      qualities.length > 1 && h(QualityPicker, { t, qualities, value: quality, onChange: setQuality }),
      h(FollowButton, { t, source: source.id, work: result }),
      hasEpisodes(result.episodes) && h('button', { type: 'button', className: 'vsync-btn', disabled: episodes === null, title: t('search.saveAllHint'), onClick: () => setState({ step: 'confirm' }) }, t('search.saveAll')),
      h('button', { type: 'button', className: 'vsync-btn', title: fill(t('search.saveHint'), { n: WINDOW_EPISODES }), onClick: () => fetchIt({ watch: false }) }, t('search.save')),
      h('button', { type: 'button', className: 'vsync-btn vsync-primary', onClick: () => fetchIt({ watch: true }) }, t('search.watch')))
  }

  return h('li', { className: 'vsync-card' },
    h(Cover, { result: shown }),
    h('div', { className: 'vsync-cardBody' },
      h('div', { className: 'vsync-cardHead' },
        h('span', { className: 'vsync-rowTitle' }, result.title),
        result.relation && h('span', { className: 'vsync-badge' }, t(`relation.${result.relation}`)),
        result.score && h('span', { className: 'vsync-score' }, fill(t('search.score'), { score: result.score.toFixed(1) }))),
      h('span', { className: 'vsync-rowMeta' }, glance(t, shown).map((part, n) => h('span', { key: n }, part))),
      result.tags.length > 0 && h('span', { className: 'vsync-tags' }, result.tags.slice(0, 6).map(tag => h('span', { key: tag, className: 'vsync-tag' }, tag))),
      result.blurb && !open && h('span', { className: 'vsync-blurb' }, result.blurb),
      open && h(WorkDetails, { t, info, source: source.id, onFocus }),
      state.step === 'error' && h('span', { className: 'vsync-error', role: 'alert' }, state.message),
      h('div', { className: 'vsync-cardFoot' },
        h('button', { type: 'button', className: 'vsync-metaButton vsync-detailsToggle', 'aria-expanded': String(open), onClick: () => setOpen(!open) }, h(Icon.Chevron, { size: 12, open }), ' ', t(open ? 'search.hideDetails' : 'search.details')),
        h('span', { className: 'vsync-actions' },
          h(ChatButton, { t, onClick: () => chatAbout({ title: result.title, lines: [glance(t, shown).join(' · '), result.blurb], context: { source: source.id, id: result.id, kind: result.kind } }) }),
          actions))))
}
