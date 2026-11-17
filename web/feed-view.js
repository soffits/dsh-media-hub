/**
 * What Discover shows before a search, for the source and category picked:
 * "For you" (the recommender's picks, each with its reason) and one list per
 * board the source itself puts forward (its rank lists, new arrivals). Under
 * All sources the picks of every source are interleaved and each source's lists
 * follow, headed by the source. Both come from dated copies the plugin keeps
 * (src/copies.js), so the page never waits on a site: while a copy is first
 * being made the area shows a loading state, and the plugin's change signal
 * brings the answer. A source that offers neither shows nothing.
 *
 * The works are the same cards as search results.
 */
import { BookCard } from './books-view.js'
import { pick } from './i18n.js'
import { Result } from './result-card.js'
import { Changes, K, Spinner, api, asPerson, fillNodes, h, query, React } from './ui.js'

/** Works of a list shown before "Show all". */
export const LIST_PREVIEW = 6

/** What the plugin has for one source and category: its trending lists and this person's picks. */
function useFeed(sourceId, kind, language) {
  const { discover } = React.useContext(Changes)
  const [feed, setFeed] = React.useState(null)
  const key = `${sourceId}|${kind}|${language}`
  React.useEffect(() => {
    let live = true
    const asked = query({ source: sourceId, kind })
    Promise.all([api(`trending?${asked}`), asPerson(`picks?${asked}&${query({ language })}`)]).then(([trending, picks]) => {
      if (!live) return
      setFeed({
        key,
        trending: Array.isArray(trending.trending) ? trending.trending : [],
        picks: Array.isArray(picks.picks) ? picks.picks : [],
        loading: trending.loading === true || picks.loading === true,
      })
    })
    return () => { live = false }
  }, [key, discover])
  return feed?.key === key ? feed : null
}

function Skeleton({ t }) {
  return h('div', { className: 'vsync-skeleton', role: 'status', 'aria-busy': 'true', 'aria-label': t('search.loading') },
    [0, 1, 2].map(n => h('span', { key: n, className: 'vsync-skeletonRow' })))
}

function FeedSection({ id, title, hint, children }) {
  return h('section', { className: 'vsync-section vsync-feedSection', 'aria-labelledby': id },
    h('div', { className: 'vsync-sectionHead vsync-sectionHeadInline' },
      h('h2', { id }, title),
      hint && h('span', { className: 'vsync-sectionMeta' }, hint)),
    children)
}

export function DiscoverFeed({ t, sourceId, kind, sourceOf, isBook, onOpen, onSaved, onFocus }) {
  const feed = useFeed(sourceId, kind ?? '', t.language)
  const [expanded, setExpanded] = React.useState(() => new Set())
  if (feed === null) return h(Skeleton, { t })
  const { trending, picks, loading } = feed
  if (trending.length === 0 && picks.length === 0) return loading ? h(Skeleton, { t }) : null

  const card = (work) => {
    const from = sourceOf(work.source)
    if (from === undefined) return null
    return isBook(work.kind, from)
      ? h(BookCard, { key: `${from.id}:${work.id}`, t, source: from, result: work })
      : h(Result, { key: `${from.id}:${work.id}`, t, source: from, result: work, onOpen, onSaved, onFocus })
  }
  const merged = sourceId === 'all'

  return h('div', { className: 'vsync-feed' },
    picks.length > 0 && h(FeedSection, { id: 'vsync-feed-picks', title: t('feed.picks'), hint: t('feed.picksHint') },
      h('ul', { className: 'vsync-rows vsync-results' }, picks.map(entry => h('li', { key: `${entry.work.source}:${entry.work.id}`, className: 'vsync-feedPick' },
        h('p', { className: 'vsync-pickWhy' }, h(K.Icon, { name: 'sparkles', size: 14, tone: 'violet' }), h('span', null, entry.why)),
        h('ul', { className: 'vsync-rows' }, card(entry.work)))))),
    trending.flatMap(({ source: from, at, lists }) => lists.map((list) => {
      const id = `${from}:${list.id}`
      const name = pick(list.label, t.language).trim() || t('feed.trending')
      const title = merged ? `${sourceOf(from)?.label ?? from} · ${name}` : name
      const all = expanded.has(id)
      const shown = all ? list.results : list.results.slice(0, LIST_PREVIEW)
      return h(FeedSection, { key: id, id: `vsync-feed-${id}`, title, hint: fillNodes(t('feed.updated'), { when: h(K.TimeAgo, { at: new Date(at).toISOString() }) }) },
        h('ul', { className: 'vsync-rows vsync-results' }, shown.map(card)),
        list.results.length > LIST_PREVIEW && h('button', { type: 'button', className: 'vsync-btn vsync-more', 'aria-expanded': String(all), onClick: () => setExpanded((current) => { const next = new Set(current); if (all) next.delete(id); else next.add(id); return next }) },
          all ? t('feed.fewer') : t('feed.all')))
    })),
    loading && h('p', { className: 'vsync-note', role: 'status' }, h(Spinner), ' ', t('feed.loading')))
}
