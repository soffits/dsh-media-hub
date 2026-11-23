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
import { LibraryCard, LibraryCover } from './library-card.js'
import { Changes, Confirm, Icon, Menu, Spinner, bytes, canChat, chatAbout, failureText, fill, h, languageName, React, shelf, shelfUrl } from './ui.js'


export const FORMATS = ['', 'epub', 'pdf', 'txt', 'azw3', 'mobi']
export const SIZES = ['', '5', '20', '50', '200']

/** What the shelf says about itself (conversion on or off, use of the disk), shared by every card on the page. */
let shelfInfo = null
const loadShelf = () => {
  shelfInfo ??= shelf().then(answer => (answer.error ? (shelfInfo = null, { entries: [], convert: false, error: answer.error }) : answer))
  return shelfInfo
}
const forgetShelf = () => { shelfInfo = null }

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
  const changes = React.useContext(Changes)
  const [entry, setEntry] = React.useState(null)
  React.useEffect(() => {
    if (entryId === null) return undefined
    let live = true
    const read = async () => {
      const answer = await shelf()
      if (!live) return
      const found = answer.entries?.find(one => one.entry === entryId) ?? null
      setEntry(found)
      if (found?.state !== 'fetching') forgetShelf()
    }
    read()
    return () => { live = false }
  }, [entryId, changes.shelf])
  return entry
}

export const fileLink = entry => `${shelfUrl('/file').href}?entry=${encodeURIComponent(entry.entry)}`

/**
 * Saving a book to the device. A browser gets a plain attachment link. A page installed to an iPhone's or
 * iPad's home screen can't use one: iOS shows the file full screen with no way back, even from a new window.
 * There the file is fetched into the page first and handed to the share sheet (Save to Files, Books, other
 * apps), and the page never leaves. The share sheet opens only within a moment of a tap, so the tap that
 * opens it never waits on the network: a book just downloaded is prepared at once, and any other book is
 * prepared by a first tap that turns the button into a ready one.
 */
const installedOnIos = () => {
  const nav = globalThis.navigator
  const ios = /iPhone|iPad|iPod/.test(nav?.userAgent ?? '') || (nav?.platform === 'MacIntel' && nav?.maxTouchPoints > 1)
  const installed = globalThis.matchMedia?.('(display-mode: standalone)').matches === true || nav?.standalone === true
  return ios && installed && typeof nav.share === 'function'
}

/** Files prepared for sharing, by shelf entry, kept while the page is open so a book is fetched once. */
const prepared = new Map()

async function prepareFile(t, entry) {
  const response = await fetch(fileLink(entry), { credentials: 'same-origin', cache: 'no-store' })
  if (!response.ok) throw new Error(failureText(null, response.status))
  const blob = await response.blob()
  const file = new File([blob], entry.name || `book.${entry.format}`, { type: blob.type || 'application/octet-stream' })
  if (navigator.canShare?.({ files: [file] }) === false) throw new Error(t('book.cannotShare'))
  prepared.set(entry.entry, file)
  return file
}

/** The save action of a ready shelf entry; `prepareNow` fetches it for sharing straight away (a book just downloaded). */
export function SaveLink({ t, entry, primary = true, prepareNow = false }) {
  const className = `vsync-btn${primary ? ' vsync-primary' : ''}`
  const label = h(React.Fragment, null, h(Icon.Download, { size: 14 }), fill(t('book.save'), { format: entry.format.toUpperCase() }))
  if (!installedOnIos()) return h('a', { className, href: fileLink(entry), download: entry.name ?? '' }, label)
  return h(ShareSave, { t, entry, className, label, prepareNow })
}

function ShareSave({ t, entry, className, label, prepareNow }) {
  // idle: not fetched yet · preparing · ready: one tap opens the share sheet · error
  const [state, setState] = React.useState(() => ({ step: prepared.has(entry.entry) ? 'ready' : 'idle' }))
  const prepare = () => {
    setState({ step: 'preparing' })
    prepareFile(t, entry).then(
      () => setState({ step: 'ready', announce: !prepareNow }),
      error => setState({ step: 'error', message: error?.message ?? String(error) }))
  }
  React.useEffect(() => { if (prepareNow && state.step === 'idle') prepare() }, [prepareNow, entry.entry])
  const share = () => {
    // Called straight from the tap: nothing is awaited before share(), or iOS refuses to open the sheet.
    navigator.share({ files: [prepared.get(entry.entry)] }).then(
      () => setState({ step: 'ready' }),
      error => setState(error?.name === 'AbortError' ? { step: 'ready' } : { step: 'error', message: error?.message ?? String(error), retry: 'share' }))
  }
  if (state.step === 'preparing') return h('span', { className: 'vsync-pending', role: 'status' }, h(Spinner), t('book.preparing'))
  const ready = state.step === 'ready' || state.retry === 'share'
  return h(React.Fragment, null,
    ready && state.announce
      ? h('button', { type: 'button', className: `${className} vsync-ready`, onClick: share }, h(Icon.Check, { size: 14 }), fill(t('book.tapToSave'), { format: entry.format.toUpperCase() }))
      : h('button', { type: 'button', className, onClick: ready ? share : prepare }, label),
    state.step === 'error' && h('span', { className: 'vsync-error', role: 'alert' }, state.message))
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
    status = h(React.Fragment, null, h('span', { className: 'vsync-badge vsync-badgeHere' }, t('book.onShelf')), h(SaveLink, { t, entry, prepareNow: true }))
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

/** What the signed-in person downloaded: the shelf as the Host answers it, and the one action on an entry (remove, fetch again). */
export function useShelf() {
  const changes = React.useContext(Changes)
  const [state, setState] = React.useState(null)
  const load = React.useCallback(async () => {
    const answer = await shelf()
    setState(answer)
    return answer
  }, [])
  React.useEffect(() => { load() }, [load, changes.shelf])
  const act = async (path, entry) => {
    await shelf(path, { entry: entry.entry })
    forgetShelf()
    await load()
  }
  return { state, act }
}

/** One book of the shelf, as a library card like any other item: to save again, fetch again or delete. */
export function ShelfEntry({ t, entry, onAct }) {
  const [confirming, setConfirming] = React.useState(false)
  const act = async (path) => {
    setConfirming(false)
    await onAct(path, entry)
  }
  const actions = confirming
    ? h(Confirm, { t, danger: true, question: t('shelf.deleteQuestion'), confirmLabel: t('shelf.delete'), onCancel: () => setConfirming(false), onConfirm: () => act('/remove') })
    : h('span', { className: 'vsync-actions' },
      h(ChatButton, { t, onClick: () => startChat(t, entry, entry.source) }),
      entry.state === 'fetching' && h('span', { className: 'vsync-pending', role: 'status' }, h(Spinner), t('book.fetching')),
      (entry.state === 'failed' || entry.state === 'removed') && h('button', { type: 'button', className: 'vsync-btn vsync-primary', onClick: () => act('/retry') }, t('shelf.again')),
      entry.state === 'ready' && h(SaveLink, { t, entry }),
      h(Menu, { label: t('library.more'), items: [{ label: t('shelf.delete'), danger: true, onSelect: () => setConfirming(true) }] }))
  return h(LibraryCard, {
    cover: h(LibraryCover, { pictures: [entry.cover], icon: h(Icon.Book, { size: 18 }) }),
    title: h('span', { className: 'vsync-rowTitle' }, entry.title || entry.id),
    badge: t('type.book'),
    lead: [entry.author, entry.format.toUpperCase(), entry.bytes ? bytes(t, entry.bytes) : null].filter(Boolean),
    rest: [entry.converted ? t('book.converted') : null, entry.state === 'removed' ? t('shelf.removed') : null].filter(Boolean),
    aside: entry.state === 'failed' && h('span', { className: 'vsync-error', role: 'alert' }, entry.error),
    actions,
  })
}
