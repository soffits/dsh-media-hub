/**
 * The Watching tab's optional parts, each shown only when switched on in the
 * `presence` setting and when there is something to show: "How was it?" for
 * shows finished or removed lately (one tap writes a rating to the watch
 * log), and picks from the recommender extension with the reason for each.
 */
import { PickedWork } from './feed-view.js'
import { Btn, Changes, K, P, React, asPerson, fillNodes, h, query } from './ui.js'

/** The answers, in order, with the icon each one shows (DSH's own where it has one). */
const ANSWERS = [
  { rating: 'loved', icon: () => h(K.Icon, { name: 'heart', size: 16 }) },
  { rating: 'fine', icon: () => h(P.IconLikeOutlineRegular, { size: 16 }) },
  { rating: 'not-for-me', icon: () => h(P.IconDislikeOutlineRegular, { size: 16 }) },
  { rating: 'unfinished', icon: () => h(K.Icon, { name: 'circle-pause', size: 16 }) },
]

/** Loads a person route once the part is on; `null` until it answers. */
function usePersonList(on, path, field, version) {
  const [list, setList] = React.useState(null)
  React.useEffect(() => {
    if (!on) return undefined
    let live = true
    asPerson(path, undefined).then((answer) => { if (live) setList(Array.isArray(answer[field]) ? answer[field] : []) })
    return () => { live = false }
  }, [on, path, field, version])
  return [on ? list : null, setList]
}

function Section({ id, title, hint, children }) {
  return h('section', { className: 'vsync-section', 'aria-labelledby': id },
    h('div', { className: 'vsync-sectionHead vsync-sectionHeadInline' },
      h('h2', { id }, title),
      hint && h('span', { className: 'vsync-sectionMeta' }, hint)),
    children)
}

function RatingRow({ t, ask, onAnswered }) {
  const [busy, setBusy] = React.useState(false)
  const answer = async (rating) => {
    setBusy(true)
    const result = await asPerson('ratings', { show: ask.show, title: ask.title, rating })
    setBusy(false)
    if (!result.error) onAnswered(ask.show)
  }
  return h(K.Surface, { as: 'li', className: 'vsync-rate' },
    h('div', { className: 'vsync-rateHead' },
      h(K.Tile, { icon: 'clapperboard', tone: 'violet', size: 36 }),
      h('div', { className: 'vsync-rateText' },
        h('p', { className: 'vsync-rowTitle' }, ask.title),
        h('p', { className: 'vsync-rowMeta' }, fillNodes(t(`ratings.${ask.why}`), { when: h(K.TimeAgo, { at: new Date(ask.at).toISOString() }) })))),
    h('div', { className: 'vsync-rateAnswers', role: 'group', 'aria-label': t('ratings.heading') },
      ANSWERS.map(({ rating, icon }) => h(Btn, { key: rating, variant: rating === 'unfinished' ? 'toolbar' : 'outline', disabled: busy, icon: icon(), onClick: () => answer(rating) }, t(`ratings.${rating}`)))))
}

export function RatingsSection({ t, on, version }) {
  const [pending, setPending] = usePersonList(on, 'ratings', 'pending', version)
  if (!pending || pending.length === 0) return null
  return h(Section, { id: 'vsync-ratings', title: t('ratings.heading'), hint: t('ratings.hint') },
    h('ul', { className: 'vsync-cards' }, pending.map(ask => h(RatingRow, { key: ask.show, t, ask, onAnswered: show => setPending(pending.filter(other => other.show !== show)) }))))
}

/** The picks, each the card of its kind (watch it, or download the book) under the reason it was picked. */
export function PicksSection({ t, on, sources, onOpen, onSaved, onOpenWork }) {
  const { discover } = React.useContext(Changes)
  const [picks] = usePersonList(on, `picks?${query({ language: t.language })}`, 'picks', discover)
  if (!picks || picks.length === 0 || !sources) return null
  return h(Section, { id: 'vsync-picks', title: t('picks.heading'), hint: t('picks.hint') },
    h('ul', { className: 'vsync-rows vsync-results' }, picks.map(({ work, why }) => h(PickedWork, { key: `${work.source}:${work.id}`, t, source: sources.find(one => one.id === work.source), work, why, onOpen, onSaved, onFocus: other => onOpenWork(other.source ?? work.source, other) }))))
}
