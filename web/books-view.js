/**
 * Books: the filter row of a book search, a book result as a card (pick a
 * format, download it onto your shelf, then save it to this device), and My
 * books, the signed-in person's shelf in the Library tab.
 *
 * Downloads go through the shelf (src/shelf-routes.js, under DSH's /api,
 * where the person is known): the Host fetches the file through its source,
 * converts it when the format asked for is not one the source has, and keeps
 * it on that person's shelf. Saving to the device is a plain link the person
 * taps, so phones treat it as a download they started (Safari offers Apple
 * Books for an epub).
 */
import { Cover } from './details.js'
import { offeredFormats } from './formats.js'
import { Confirm, Icon, Spinner, bytes, canChat, chatAbout, fill, h, React, shelf, shelfUrl } from './ui.js'

const SHELF_POLL_MS = 2000

export const FORMATS = ['', 'epub', 'pdf', 'txt', 'azw3', 'mobi']
export const SIZES = ['', '5', '20', '50', '200']

/** What the shelf says about itself (conversion on or off, use of the disk), shared by every card on the page. */
let shelfInfo = null
const loadShelf = () => {
  shelfInfo ??= shelf().then(answer => (answer.error ? (shelfInfo = null, { entries: [], convert: false, error: answer.error }) : answer))
  return shelfInfo
}
const forgetShelf = () => { shelfInfo = null }

/** A language's name in the viewer's language (Intl.DisplayNames), else its code. */
function languageName(t, code) {
  if (!code) return ''
  try {
    return new Intl.DisplayNames([t.language], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}

/** The filter row of a book search; `languages` are the codes to offer (src/i18n.js `languageChoices`), `onChange` gets the whole set. */
export function BookFilters({ t, filters, languages, onChange }) {
  const [open, setOpen] = React.useState(false)
  const active = Object.values(filters).filter(value => value !== '').length
  const set = patch => onChange({ ...filters, ...patch })
  const select = (label, value, options, render, key) => h('label', { className: 'vsync-filter' },
    h('span', null, label),
    h('select', { className: 'vsync-field', value, onChange: event => set({ [key]: event.target.value }) },
      options.map(option => h('option', { key: option, value: option }, option === '' ? t('filter.any') : render(option)))))
  const year = (label, key) => h('label', { className: 'vsync-filter' },
    h('span', null, label),
    h('input', { className: 'vsync-field vsync-year', type: 'number', inputMode: 'numeric', min: 1, max: 9999, placeholder: '—', value: filters[key], onChange: event => set({ [key]: event.target.value }) }))
  return h('div', { className: 'vsync-filterBox', 'data-open': String(open) },
    // On phones the filters fold behind this button; wider screens always show them.
    h('button', { type: 'button', className: 'vsync-btn vsync-filterToggle', 'aria-expanded': String(open), onClick: () => setOpen(!open) },
      h(Icon.Chevron, { size: 12, open }), active > 0 ? fill(t('filter.labelActive'), { n: active }) : t('filter.label')),
    h('div', { className: 'vsync-filters', role: 'group', 'aria-label': t('filter.label') },
    select(t('filter.language'), filters.language, ['', ...languages], code => languageName(t, code), 'language'),
    select(t('filter.format'), filters.format, FORMATS, format => format.toUpperCase(), 'format'),
    year(t('filter.yearFrom'), 'yearFrom'),
    year(t('filter.yearTo'), 'yearTo'),
    select(t('filter.size'), filters.maxMb, SIZES, mb => fill(t('filter.upTo'), { size: bytes(t, Number(mb) * 1e6) }), 'maxMb')))
}

/** The facts of a book in a row: author, year, language, publisher, where the file comes from. */
function bookFacts(t, book, sourceLabel) {
  return [book.author, book.year, languageName(t, book.language), book.publisher, book.origin || sourceLabel].filter(Boolean)
}

export function startChat(t, book, sourceLabel) {
  chatAbout({ title: book.title, lines: [bookFacts(t, book, sourceLabel).join(' · '), book.blurb], context: { source: book.source, id: book.id, kind: book.kind } })
}

/** "Ask": a new conversation about the item. On phones only its icon shows; its name stays for screen readers. */
export function ChatButton({ t, onClick }) {
  return canChat() && h('button', { type: 'button', className: 'vsync-btn vsync-ask', title: t('chat.about'), 'aria-label': t('chat.about'), onClick }, h(Icon.Chat, { size: 14 }), h('span', { className: 'vsync-askLabel' }, t('chat.ask')))
}

/** Waits until the shelf entry is no longer being fetched. */
function useEntry(entryId) {
  const [entry, setEntry] = React.useState(null)
  React.useEffect(() => {
    if (entryId === null) return undefined
    let live = true
    let timer
    const tick = async () => {
      const answer = await shelf()
      if (!live) return
      const found = answer.entries?.find(one => one.entry === entryId) ?? null
      setEntry(found)
      if (found?.state === 'fetching') timer = setTimeout(tick, SHELF_POLL_MS)
      else forgetShelf()
    }
    tick()
    return () => { live = false; clearTimeout(timer) }
  }, [entryId])
  return entry
}

export const fileLink = entry => `${shelfUrl('/file').href}?entry=${encodeURIComponent(entry.entry)}`

export function SaveLink({ t, entry, primary = true }) {
  return h('a', { className: `vsync-btn${primary ? ' vsync-primary' : ''}`, href: fileLink(entry), download: entry.name ?? '' }, h(Icon.Download, { size: 14 }), fill(t('book.save'), { format: entry.format.toUpperCase() }))
}

/** One book search result: facts, the formats it comes in, and a download in the one picked. */
export function BookCard({ t, source, result }) {
  const [convert, setConvert] = React.useState(false)
  React.useEffect(() => { loadShelf().then(info => setConvert(Boolean(info.convert))) }, [])
  const offered = offeredFormats(result.formats, convert)
  const [format, setFormat] = React.useState(null)
  const chosen = format ?? offered[0]?.format ?? 'epub'
  const [request, setRequest] = React.useState({ step: 'idle' })
  const entry = useEntry(request.entry ?? null)

  const download = async () => {
    setRequest({ step: 'adding' })
    const answer = await shelf('/add', { source: source.id, id: result.id, format: chosen, title: result.title, author: result.author })
    if (answer.error) return setRequest({ step: 'error', message: answer.error })
    return setRequest({ step: 'added', entry: answer.entry.entry })
  }

  let status = null
  if (request.step === 'adding' || (request.step === 'added' && (entry === null || entry.state === 'fetching'))) {
    status = h('span', { className: 'vsync-pending', role: 'status' }, h(Spinner), t(offered.find(one => one.format === chosen)?.converted ? 'book.converting' : 'book.fetching'))
  } else if (entry?.state === 'ready') {
    status = h(React.Fragment, null, h('span', { className: 'vsync-badge vsync-badgeHere' }, t('book.onShelf')), h(SaveLink, { t, entry }))
  } else if (entry?.state === 'failed' || request.step === 'error') {
    status = h('span', { className: 'vsync-error', role: 'alert' }, entry?.error ?? request.message)
  }

  const formatLabel = one => `${one.format.toUpperCase()}${one.bytes ? ` · ${bytes(t, one.bytes)}` : ''}${one.converted ? ` · ${t('book.converted')}` : ''}`
  return h('li', { className: 'vsync-card vsync-book' },
    h(Cover, { result: { ...result, media: 'book' } }),
    h('div', { className: 'vsync-cardBody' },
      h('div', { className: 'vsync-cardHead' }, h('span', { className: 'vsync-rowTitle' }, result.title)),
      h('span', { className: 'vsync-rowMeta' }, bookFacts(t, result, source.label).map((part, n) => h('span', { key: n }, part))),
      offered.length > 0 && h('span', { className: 'vsync-tags' }, offered.filter(one => !one.converted).map(one => h('span', { key: one.format, className: 'vsync-tag' }, formatLabel(one)))),
      result.blurb && h('span', { className: 'vsync-blurb' }, result.blurb),
      h('div', { className: 'vsync-cardFoot' },
        h('span', { className: 'vsync-actions' },
          h(ChatButton, { t, onClick: () => startChat(t, { ...result, source: source.id }, source.label) }),
          status,
          entry?.state !== 'ready' && request.step !== 'adding' && !(request.step === 'added' && entry?.state !== 'failed') && h(React.Fragment, null,
            offered.length > 1 && h('select', { className: 'vsync-field vsync-pick', 'aria-label': t('book.format'), value: chosen, onChange: event => setFormat(event.target.value) },
              offered.map(one => h('option', { key: one.format, value: one.format }, formatLabel(one)))),
            h('button', { type: 'button', className: 'vsync-btn vsync-primary', onClick: download }, h(Icon.Download, { size: 14 }), offered.length > 1 ? t('book.download') : fill(t('book.downloadAs'), { format: chosen.toUpperCase() })))))))
}

/** My books: what the signed-in person downloaded, to save again, fetch again or delete. */
export function ShelfSection({ t }) {
  const [state, setState] = React.useState(null)
  const [confirm, setConfirm] = React.useState(null)
  const load = React.useCallback(async () => {
    const answer = await shelf()
    setState(answer)
    return answer
  }, [])
  React.useEffect(() => {
    let live = true
    let timer
    const tick = async () => {
      const answer = await load()
      if (live && answer.entries?.some(entry => entry.state === 'fetching')) timer = setTimeout(tick, SHELF_POLL_MS)
    }
    tick()
    return () => { live = false; clearTimeout(timer) }
  }, [load])

  const act = async (path, entry) => {
    setConfirm(null)
    await shelf(path, { entry: entry.entry })
    forgetShelf()
    const answer = await load()
    if (answer.entries?.some(one => one.state === 'fetching')) setTimeout(load, SHELF_POLL_MS)
  }

  if (state === null) return null
  if (state.error) return h('section', { className: 'vsync-section' }, h('h2', null, t('shelf.title')), h('p', { className: 'vsync-error', role: 'alert' }, state.error))
  return h('section', { className: 'vsync-section vsync-shelf' },
    h('div', { className: 'vsync-sectionHead' },
      h('h2', null, t('shelf.title')),
      h('span', { className: 'vsync-note' }, state.capBytes > 0 ? fill(t('shelf.usedOf'), { used: bytes(t, state.usedBytes), cap: bytes(t, state.capBytes) }) : bytes(t, state.usedBytes))),
    state.entries.length === 0
      ? h('p', { className: 'vsync-empty' }, t('shelf.empty'))
      : h('ul', { className: 'vsync-rows' }, state.entries.map(entry => h('li', { key: entry.entry, className: 'vsync-card vsync-book vsync-shelfEntry' },
        h(Cover, { result: { ...entry, media: 'book' }, small: true }),
        h('div', { className: 'vsync-cardBody' },
          h('div', { className: 'vsync-cardHead' }, h('span', { className: 'vsync-rowTitle' }, entry.title || entry.id)),
          h('span', { className: 'vsync-rowMeta' }, [entry.author, entry.format.toUpperCase(), entry.bytes ? bytes(t, entry.bytes) : null, entry.converted ? t('book.converted') : null].filter(Boolean).map((part, n) => h('span', { key: n }, part))),
          entry.state === 'failed' && h('span', { className: 'vsync-error', role: 'alert' }, entry.error),
          entry.state === 'removed' && h('span', { className: 'vsync-note' }, t('shelf.removed')),
          h('div', { className: 'vsync-cardFoot' },
            h('span', { className: 'vsync-actions' },
              h(ChatButton, { t, onClick: () => startChat(t, entry, entry.source) }),
              confirm === entry.entry
                ? h(Confirm, { t, danger: true, question: t('shelf.deleteQuestion'), confirmLabel: t('shelf.delete'), onCancel: () => setConfirm(null), onConfirm: () => act('/remove', entry) })
                : h(React.Fragment, null,
                  h('button', { type: 'button', className: 'vsync-btn', onClick: () => setConfirm(entry.entry) }, t('shelf.delete')),
                  entry.state === 'fetching' && h('span', { className: 'vsync-pending', role: 'status' }, h(Spinner), t('book.fetching')),
                  (entry.state === 'failed' || entry.state === 'removed') && h('button', { type: 'button', className: 'vsync-btn vsync-primary', onClick: () => act('/retry', entry) }, t('shelf.again')),
                  entry.state === 'ready' && h(SaveLink, { t, entry })))))))))
}
