/**
 * A book on this device. In a browser that is a plain download link. A page installed to an iPhone's or iPad's
 * home screen can't use one: iOS shows the file full screen with no way back. There a book has two ways out:
 *
 *   to the share sheet   the file is first brought into the page (a download icon, then a spinner with the
 *                        percentage), kept in Cache Storage so it is still there when the app is opened again,
 *                        and then a share icon hands it over. Because the file is already here, that tap opens
 *                        the sheet at once: iOS opens it only within a moment of a tap, so nothing may be awaited
 *                        in between.
 *   to Safari            a compass, there from the start: iOS 17's `x-safari-https:` link opens the book in Safari
 *                        itself, whose download view offers every app that opens the file and has its own way back.
 *
 * Both exist because neither does it all. WebKit hands a web page's shared file to the share sheet as a data
 * placeholder, not as a file (WKShareSheet's item provider for shares that come from web content), so the sheet
 * lists what takes any data (Save to Files, AirDrop, messengers) and leaves out what wants a file: Books and
 * most reader apps, whatever the file's type and name. Safari downloads the book itself, since one app can't read
 * another's storage, the page's copy included, and keeps its own sign-in.
 * The download carries on after a dropped connection (web/resumable.js).
 */
import { fetchResumable } from './resumable.js'
import { failureText, fill, h, Icon, IconButton, networkText, Pending, React } from './ui.js'

const CACHE = 'media-hub-books'

export function installedOnIos() {
  const nav = globalThis.navigator
  const ios = /iPhone|iPad|iPod/.test(nav?.userAgent ?? '') || (nav?.platform === 'MacIntel' && nav?.maxTouchPoints > 1)
  const installed = globalThis.matchMedia?.('(display-mode: standalone)').matches === true || nav?.standalone === true
  return ios && installed && typeof nav.share === 'function'
}

/** By shelf entry: { step: 'checking' | 'absent' | 'downloading' | 'here' | 'failed', fraction?, file?, message? }. */
const copies = new Map()
const listeners = new Set()
const put = (id, copy) => {
  copies.set(id, copy)
  for (const listener of listeners) listener()
}
const cache = () => (globalThis.caches ? caches.open(CACHE) : Promise.resolve(null))
const toFile = (entry, blob) => new File([blob], entry.name || `book.${entry.format}`, { type: blob.type || 'application/octet-stream' })

async function look(entry, link) {
  put(entry.entry, { step: 'checking' })
  const hit = await cache().then(store => store?.match(link)).catch(() => undefined)
  put(entry.entry, hit ? { step: 'here', file: toFile(entry, await hit.blob()) } : { step: 'absent' })
}

async function download(t, entry, link) {
  const id = entry.entry
  put(id, { step: 'downloading', fraction: null })
  try {
    const blob = await fetchResumable(link, {
      bytes: entry.bytes ?? 0,
      refusal: status => failureText(null, status),
      onProgress: fraction => put(id, { step: 'downloading', fraction }),
    }).catch((error) => { throw error instanceof TypeError ? new Error(networkText(error)) : error })
    const file = toFile(entry, blob)
    if (navigator.canShare?.({ files: [file] }) === false) throw new Error(t('book.cannotShare'))
    // Kept for later visits when the page may store it; without storage the copy lasts while the app is open.
    const store = await cache().catch(() => null)
    await store?.put(link, new Response(blob, { headers: { 'content-type': blob.type } }))
    put(id, { step: 'here', file })
  } catch (error) {
    put(id, { step: 'failed', message: error?.message ?? String(error) })
  }
}

/** Drops this device's copy (the menu's "Remove from device", and deleting the book from the shelf). */
export async function removeDeviceCopy(entry, link) {
  if (!copies.has(entry.entry)) return
  await cache().then(store => store?.delete(link)).catch(() => undefined)
  put(entry.entry, { step: 'absent' })
}

/** The device copy of a shelf entry, looked up once per page. */
export function useDeviceCopy(entry, link) {
  const [, redraw] = React.useState(0)
  React.useEffect(() => {
    const listener = () => redraw(n => n + 1)
    listeners.add(listener)
    if (installedOnIos() && !copies.has(entry.entry)) look(entry, link)
    return () => { listeners.delete(listener) }
  }, [entry.entry])
  return copies.get(entry.entry) ?? { step: 'checking' }
}

/** What a ready shelf entry offers for this device, as icons. */
export function DeviceCopy({ t, entry, link }) {
  const name = fill(t('book.save'), { format: entry.format.toUpperCase() })
  if (!installedOnIos()) return h(IconButton, { label: name, icon: Icon.Download, primary: true, href: link, download: entry.name ?? '' })
  return h(InstalledCopy, { t, entry, link, name })
}

function InstalledCopy({ t, entry, link, name }) {
  const copy = useDeviceCopy(entry, link)
  const [shareError, setShareError] = React.useState(null)
  const share = () => {
    setShareError(null)
    navigator.share({ files: [copy.file] }).catch(error => { if (error?.name !== 'AbortError') setShareError(error?.message ?? String(error)) })
  }
  const toShareSheet = {
    checking: () => h(Pending, { label: name }),
    downloading: () => h(Pending, { label: t('book.toDevice'), figure: copy.fraction === null ? null : `${Math.round(copy.fraction * 100)}%` }),
    here: () => h(IconButton, { label: t('book.shareTo'), icon: Icon.Share, primary: true, onClick: share }),
  }[copy.step] ?? (() => h(IconButton, { label: name, icon: Icon.Download, primary: true, onClick: () => download(t, entry, link) }))
  const failure = copy.step === 'failed' ? copy.message : shareError
  return h(React.Fragment, null,
    toShareSheet(),
    h(IconButton, { label: t('book.openInSafari'), icon: Icon.Compass, href: `x-safari-${new URL(link, document.baseURI).href}` }),
    failure && h('span', { className: 'vsync-error', role: 'alert' }, failure))
}
