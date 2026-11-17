/**
 * Discover: pick a source (All sources, every configured one, then Link for
 * pasting a YouTube address), under it that source's own categories, then
 * search. Book categories add a filter row (language, format, years, size).
 * Results are cards: a show or audiobook (web/result-card.js) is watched
 * together right away, saved to the library (the episodes being watched and
 * the next few are kept on disk), or downloaded whole to keep offline; a
 * book (web/books-view.js) is downloaded in a format onto the person's shelf.
 *
 * The source and category come from the URL (web/nav.js) and are
 * remembered per browser. Only the newest search or category click may show
 * its results: an older answer that arrives late is dropped, and the results
 * area shows a loading state until the newest one answers.
 */
import { BookCard, BookFilters } from './books-view.js'
import { LINK_SOURCE, browserStorage, pickKind, pickSource, readMemory, remember, withAll, withLink } from './nav.js'
import { Result } from './result-card.js'
import { sortModes, sortResults } from './sort.js'
import { infoOf } from './details.js'
import { Icon, Spinner, api, displayName, fill, h, localized, post, query, React } from './ui.js'
import { parseYouTube } from './youtube-url.js'

/** A category's name: the page's own translation when it has one, else the label the source's configuration gives. */
export function kindLabel(t, kind) {
  const key = `kind.${kind.id}`
  const text = t(key)
  return text && text !== key ? text : localized(kind.label, t)
}

export function DiscoverView({ t, nav, onNav, onOpen, onSaved, onBack }) {
  const [configured, setConfigured] = React.useState(null)
  const [text, setText] = React.useState('')
  const [results, setResults] = React.useState(null)
  const [loading, setLoading] = React.useState(null)
  const [error, setError] = React.useState(null)
  const [sort, setSort] = React.useState('default')
  const [more, setMore] = React.useState(false)
  const [filters, setFilters] = React.useState({ language: '', format: '', yearFrom: '', yearTo: '', maxMb: '' })
  /** The newest request: its number and abort controller; every older answer is dropped. */
  const latest = React.useRef({ id: 0, controller: null, key: null })

  React.useEffect(() => {
    api('sources').then(answer => setConfigured(answer.sources ?? []))
    return () => latest.current.controller?.abort()
  }, [])

  const sources = React.useMemo(() => withLink(withAll((configured ?? []).map(one => ({ ...one, label: localized(one.label, t) || one.id })), t('source.all')), t('source.link')), [configured, t])
  const sourceOf = id => sources.find(one => one.id === id)
  const storage = browserStorage()
  const memory = readMemory(storage)
  const source = configured === null ? null : pickSource(sources, nav.source, memory.source)
  const kind = source === null ? null : pickKind(source, nav.kind, memory.kinds[source.id])
  const isLink = source?.id === LINK_SOURCE
  const isBook = (kindId, from = source) => from?.kinds.find(k => k.id === kindId)?.media === 'book'
  /** A request for the source on screen is on its way. */
  const searching = loading !== null && loading.source === source?.id

  // The URL shows what is picked, even when it fell back to the remembered or first choice.
  React.useEffect(() => {
    if (source === null) return
    if (nav.source !== source.id || nav.kind !== kind) onNav({ source: source.id, kind, work: nav.source === source.id ? nav.work : null }, { replace: true })
    remember(storage, { source: source.id, kind })
  }, [source?.id, kind, nav.source, nav.kind])

  const run = async ({ nextSource = source, nextKind = kind, from = 'search', nextFilters = filters } = {}) => {
    const q = text.trim()
    if (q === '' || nextSource === null) return undefined
    const filtering = isBook(nextKind, nextSource) ? Object.fromEntries(Object.entries(nextFilters).filter(([, value]) => value !== '')) : {}
    const key = `${nextSource.id}|${nextKind}|${q}|${JSON.stringify(filtering)}`
    // The same question already on its way or on screen: nothing new to ask.
    if (from === 'pick' && latest.current.key === key) return undefined
    latest.current.controller?.abort()
    const request = { id: latest.current.id + 1, controller: new AbortController(), key }
    latest.current = request
    const stale = () => latest.current.id !== request.id
    setLoading({ from, source: nextSource.id, kind: nextKind })
    setError(null)
    if (nextSource.id === LINK_SOURCE) {
      if (parseYouTube(q) === null) {
        setLoading(null)
        return setError(t('link.invalid'))
      }
      const by = await displayName(t('guest'))
      const answer = await post('rooms', { source: 'youtube', urls: [q], by })
      if (stale()) return undefined
      setLoading(null)
      if (answer.error) return setError(fill(t('start.failed'), { message: answer.error }))
      return onOpen(answer.room.id)
    }
    const answer = await api(`search?${query({ source: nextSource.id, q, kind: nextKind ?? '', ...filtering })}`, { signal: request.controller.signal })
    if (stale()) return undefined
    setLoading(null)
    if (answer.error) {
      latest.current.key = null
      return setError(answer.error)
    }
    setResults({ source: nextSource, kind: nextKind, items: answer.results, next: answer.next ?? null, query: q, failed: answer.failed ?? [], filtering })
    return undefined
  }

  /** The next page of the same search, added below; a page with nothing new ends the list. */
  const loadMore = async () => {
    if (results === null || results.next === null || more) return
    setMore(true)
    const answer = await api(`search?${query({ source: results.source.id, q: results.query, kind: results.kind ?? '', offset: results.next, ...results.filtering })}`)
    setMore(false)
    if (answer.error) return setError(answer.error)
    setResults((current) => {
      if (current === null || current.query !== results.query || current.kind !== results.kind || current.source.id !== results.source.id) return current
      const known = new Set(current.items.map(item => item.id))
      const fresh = answer.results.filter(item => !known.has(item.id))
      return { ...current, items: [...current.items, ...fresh], next: fresh.length > 0 ? (answer.next ?? null) : null }
    })
    return undefined
  }

  const again = results !== null || loading !== null
  const pickSourceId = (next) => {
    const nextKind = pickKind(next, null, memory.kinds[next.id])
    onNav({ source: next.id, kind: nextKind, work: null })
    setError(null)
    if (again && next.id !== LINK_SOURCE) run({ nextSource: next, nextKind, from: 'pick' })
  }
  const pickKindId = (id) => {
    onNav({ source: source.id, kind: id, work: null })
    if (again) run({ nextKind: id, from: 'pick' })
  }
  const filter = (next) => {
    setFilters(next)
    if (again) run({ nextFilters: next, from: 'pick' })
  }
  const type = (value) => {
    setText(value)
    if (value === '') setResults(null)
    // A YouTube address pasted into a source's search box belongs to Link.
    else if (!isLink && parseYouTube(value.trim()) !== null) onNav({ source: LINK_SOURCE, kind: null, work: null })
  }

  const onFocus = work => onNav({ work: work.id })
  const focused = nav.work !== null && source !== null && !isLink
  const modes = results === null ? ['default'] : sortModes(results.items)
  const activeSort = modes.includes(sort) ? sort : 'default'
  const sorted = results === null ? [] : sortResults(results.items, activeSort)
  const shown = results !== null && source !== null && results.source.id === source.id && results.kind === kind

  return h('div', { className: 'vsync-tabPanel' },
    focused && h(FocusedWork, { key: `${source.id}/${nav.work}`, t, source, id: nav.work, onOpen, onSaved, onFocus, onBack }),
    h('div', { hidden: focused },
    source !== null && h('div', { className: 'vsync-picker' },
      h('div', { className: 'vsync-segment', role: 'tablist', 'aria-label': t('discover.source') },
        sources.map(s => h('button', { key: s.id, type: 'button', role: 'tab', className: 'vsync-seg', 'aria-selected': String(s.id === source.id), onClick: () => pickSourceId(s) }, s.id === LINK_SOURCE ? h('span', { className: 'vsync-segIcon' }, h(Icon.Link, { size: 14 })) : null, s.label))),
      source.kinds.length > 0 && h('div', { className: 'vsync-tabs', role: 'tablist', 'aria-label': t('discover.kind') },
        source.kinds.map(k => h('button', {
          key: k.id,
          type: 'button',
          role: 'tab',
          className: 'vsync-chip',
          'aria-selected': String(k.id === kind),
          'aria-busy': String(searching && k.id === loading.kind),
          'data-loading': String(searching && k.id === loading.kind),
          onClick: () => pickKindId(k.id),
        }, searching && k.id === loading.kind ? h(Spinner) : null, kindLabel(t, k))))),
    h('form', { className: 'vsync-search', role: 'search', onSubmit: (event) => { event.preventDefault(); run({ from: 'search' }) } },
      h('span', { className: 'vsync-searchIcon' }, isLink ? h(Icon.Link) : h(Icon.Search)),
      h('input', {
        className: 'vsync-field vsync-searchField',
        type: isLink ? 'text' : 'search',
        inputMode: isLink ? 'url' : undefined,
        value: text,
        placeholder: isLink ? t('start.youtubePlaceholder') : fill(t('search.placeholder'), { source: source?.label ?? '' }),
        'aria-label': t('search.label'),
        onChange: event => type(event.target.value),
      }),
      h('button', { type: 'submit', className: 'vsync-btn vsync-btnLarge', disabled: (searching && loading.from === 'search') || text.trim() === '' || source === null }, searching && loading.from === 'search' ? h(Spinner) : null, isLink ? t('start.go') : t('search.go'))),
    !isLink && isBook(kind) && h(BookFilters, { t, filters, onChange: filter }),
    error && h('p', { className: 'vsync-error', role: 'alert' }, error),
    !searching && shown && results.failed.length > 0 && h('p', { className: 'vsync-note', role: 'status' }, results.failed.map(one => fill(t('search.sourceFailed'), { source: sourceOf(one.source)?.label ?? one.source, message: one.message })).join(' ')),
    searching && !isLink && h('div', { className: 'vsync-skeleton', role: 'status', 'aria-busy': 'true', 'aria-label': t('search.loading') },
      [0, 1, 2].map(n => h('span', { key: n, className: 'vsync-skeletonRow' }))),
    !searching && shown && results.items.length > 1 && modes.length > 1 && h('div', { className: 'vsync-tabs vsync-sort', role: 'group', 'aria-label': t('sort.label') },
      modes.map(mode => h('button', { key: mode, type: 'button', className: 'vsync-chip', 'aria-pressed': String(mode === activeSort), onClick: () => setSort(mode) }, t(`sort.${mode}`)))),
    !searching && shown && (results.items.length === 0
      ? h('p', { className: 'vsync-empty' }, t('search.none'))
      : h('ul', { className: 'vsync-rows vsync-results' }, sorted.map((result) => {
        const from = sourceOf(result.source) ?? results.source
        return isBook(result.kind, from) || isBook(results.kind, results.source)
          ? h(BookCard, { key: `${from.id}:${result.id}`, t, source: from, result })
          : h(Result, { key: `${from.id}:${result.id}`, t, source: from, result, onOpen, onSaved, onFocus })
      }))),
    !searching && shown && results.next !== null && h('button', { type: 'button', className: 'vsync-btn vsync-more', disabled: more, onClick: loadMore }, more ? h(Spinner) : null, t('search.more'))))
}

/** One work opened from a related list: its card with the details open (their related works, one level), and a way back. */
function FocusedWork({ t, source, id, onOpen, onSaved, onFocus, onBack }) {
  const [work, setWork] = React.useState(null)
  React.useEffect(() => {
    let live = true
    infoOf(source.id, id).then(value => { if (live) setWork(value) })
    return () => { live = false }
  }, [source.id, id])
  return h('div', { className: 'vsync-focus' },
    h('button', { type: 'button', className: 'vsync-btn vsync-back', onClick: onBack }, h(Icon.Back, { size: 14 }), t('discover.back')),
    work === null && h('p', { className: 'vsync-note', role: 'status' }, h(Spinner), ' ', t('search.loading')),
    work?.error && h('p', { className: 'vsync-error', role: 'alert' }, fill(t('discover.workFailed'), { message: work.error })),
    work && !work.error && h('ul', { className: 'vsync-rows' }, h(Result, { t, source, result: work, onOpen, onSaved, onFocus, defaultOpen: true })))
}
