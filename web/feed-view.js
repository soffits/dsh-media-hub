/**
 * What Discover shows before a search, for the source and category picked: one
 * list per board the source itself puts forward (its rank lists, new arrivals).
 * Under All sources each source's lists follow, headed by the source. Both come from dated copies the plugin keeps
 * (src/copies.js), so the page never waits on a site: while a copy is first
 * being made the area shows a loading state, and the plugin's change signal
 * brings the answer. A source with no lists shows nothing.
 *
 * The works are the same cards as search results; `PickedWork` is one under the
 * reason it was picked (the Watching tab's picks).
 */
import { BookCard } from './books-view.js'
import { pick } from './i18n.js'
import { Result } from './result-card.js'
import { Changes, K, Spinner, api, fillNodes, h, query, React } from './ui.js'

/** Works of a list shown before "Show all". */
export const LIST_PREVIEW = 6

/** What the plugin has for one source and category: its trending lists. */
function useFeed(sourceId, kind) {
  const { discover } = React.useContext(Changes)
  const [feed, setFeed] = React.useState(null)
  const key = `${sourceId}|${kind}`
  React.useEffect(() => {
    let live = true
    const asked = query({ source: sourceId, kind })
    api(`trending?${asked}`).then((trending) => {
      if (!live) return
      setFeed({
        key,
        trending: Array.isArray(trending.trending) ? trending.trending : [],
        loading: trending.loading === true,
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

/** A work as the card of its kind: a book is downloaded in a format, anything else watched or listened to. */
export function WorkCard({ t, source, work, isBook, onOpen, onSaved, onFocus }) {
  return isBook
    ? h(BookCard, { t, source, result: work })
    : h(Result, { t, source, result: work, onOpen, onSaved, onFocus })
}

/** One picked work under the reason it was picked. */
export function PickedWork({ t, source, work, why, onOpen, onSaved, onFocus }) {
  if (source === undefined) return null
  const book = source.kinds.find(kind => kind.id === work.kind)?.media === 'book'
  return h('li', { className: 'vsync-feedPick' },
    h('p', { className: 'vsync-pickWhy' }, h(K.Icon, { name: 'sparkles', size: 14, tone: 'violet' }), h('span', null, why)),
    h('ul', { className: 'vsync-rows' }, h(WorkCard, { t, source, work, isBook: book, onOpen, onSaved, onFocus })))
}

export function DiscoverFeed({ t, sourceId, kind, sourceOf, isBook, onOpen, onSaved, onFocus }) {
  const feed = useFeed(sourceId, kind ?? '')
  const [expanded, setExpanded] = React.useState(() => new Set())
  if (feed === null) return h(Skeleton, { t })
  const { trending, loading } = feed
  if (trending.length === 0) return loading ? h(Skeleton, { t }) : null

  const card = (work) => {
    const from = sourceOf(work.source)
    if (from === undefined) return null
    return h(WorkCard, { key: `${from.id}:${work.id}`, t, source: from, work, isBook: isBook(work.kind, from), onOpen, onSaved, onFocus })
  }
  const merged = sourceId === 'all'

  return h('div', { className: 'vsync-feed' },
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
