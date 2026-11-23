/**
 * A book's copy on this device. In a browser that is a plain download link. A page installed to an iPhone's
 * or iPad's home screen can't use one: iOS shows the file full screen with no way back. There a book has two
 * states the person sees and controls:
 *
 *   not on this device  ->  "Download to device", with its progress
 *   on this device      ->  "Save to other apps" (the share sheet) and "Open in Safari", as icon buttons
 *
 * The copy is kept in the page's Cache Storage, so it is still there when the app is opened again (iOS may
 * clear it after weeks unused; the state then reads "not on this device" again, which is true). Because the
 * file is already here, the tap on "Save to other apps" opens the share sheet at once: iOS opens it only
 * within a moment of a tap, so nothing may be awaited in between. The share sheet lists only apps that take
 * shared files; "Open in Safari" (iOS 17's `x-safari-https:` link) opens the book in Safari itself, whose
 * download view offers every app that opens the file and has its own way back. Safari keeps its own sign-in.
 */
import { failureText, fill, h, Icon, ProgressBar, React, Spinner } from './ui.js'

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
    const response = await fetch(link, { credentials: 'same-origin', cache: 'no-store' })
    if (!response.ok) throw new Error(failureText(null, response.status))
    const total = Number(response.headers.get('content-length')) || entry.bytes || 0
    const reader = response.body.getReader()
    const parts = []
    let received = 0
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      parts.push(chunk.value)
      received += chunk.value.length
      if (total > 0) put(id, { step: 'downloading', fraction: Math.min(1, received / total) })
    }
    const type = response.headers.get('content-type')?.split(';')[0].trim() || 'application/octet-stream'
    const blob = new Blob(parts, { type })
    const file = toFile(entry, blob)
    if (navigator.canShare?.({ files: [file] }) === false) throw new Error(t('book.cannotShare'))
    // Kept for later visits when the page may store it; without storage the copy lasts while the app is open.
    const store = await cache().catch(() => null)
    await store?.put(link, new Response(blob, { headers: { 'content-type': type } }))
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

/** What a ready shelf entry offers for this device. */
export function DeviceCopy({ t, entry, link }) {
  const format = entry.format.toUpperCase()
  const downloadLabel = h(React.Fragment, null, h(Icon.Download, { size: 14 }), fill(t('book.save'), { format }))
  if (!installedOnIos()) return h('a', { className: 'vsync-btn vsync-primary', href: link, download: entry.name ?? '' }, downloadLabel)
  return h(InstalledCopy, { t, entry, link, downloadLabel })
}

function InstalledCopy({ t, entry, link, downloadLabel }) {
  const copy = useDeviceCopy(entry, link)
  const [shareError, setShareError] = React.useState(null)
  const share = () => {
    setShareError(null)
    navigator.share({ files: [copy.file] }).catch(error => { if (error?.name !== 'AbortError') setShareError(error?.message ?? String(error)) })
  }
  switch (copy.step) {
    case 'checking':
      return h('span', { className: 'vsync-pending', role: 'status' }, h(Spinner))
    case 'downloading':
      return h('span', { className: 'vsync-pending', role: 'status' },
        h(Spinner),
        copy.fraction === null ? t('book.toDevice') : fill(t('book.toDevicePercent'), { n: Math.round(copy.fraction * 100) }),
        h(ProgressBar, { progress: { fraction: copy.fraction } }))
    case 'here':
      return h(React.Fragment, null,
        h('span', { className: 'vsync-badge vsync-badgeHere' }, t('book.onDevice')),
        h('button', { type: 'button', className: 'vsync-btn vsync-primary vsync-iconBtn', title: t('book.shareTo'), 'aria-label': t('book.shareTo'), onClick: share }, h(Icon.Share, { size: 18 })),
        h('a', { className: 'vsync-btn vsync-iconBtn', title: t('book.openInSafari'), 'aria-label': t('book.openInSafari'), href: `x-safari-${new URL(link, document.baseURI).href}` }, h(Icon.Compass, { size: 18 })),
        shareError && h('span', { className: 'vsync-error', role: 'alert' }, shareError))
    default:
      return h(React.Fragment, null,
        h('button', { type: 'button', className: 'vsync-btn vsync-primary', onClick: () => download(t, entry, link) }, downloadLabel),
        copy.step === 'failed' && h('span', { className: 'vsync-error', role: 'alert' }, copy.message))
  }
}
