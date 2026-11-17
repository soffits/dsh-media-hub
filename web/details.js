/**
 * What the page knows about a work, shown the same wherever a work is shown
 * (a search result, a work opened from another's related list): the full
 * blurb, every field the source gives, and the other seasons and linked
 * works as a plain list. A related work is a row that opens it (onFocus),
 * never a card with details of its own, so details never nest.
 */
import { hasEpisodes, metaLabel, popularityText } from './format.js'
import { useKnownWork } from './known.js'
import { Icon, Spinner, asPerson, base, clock, day, fill, h, plural, query, React } from './ui.js'

const INFO_CONCURRENCY = 3

/** Fetch work details a few at a time, so a page of results doesn't start ten downloads of metadata at once. */
function createInfoQueue() {
  const cache = new Map()
  const waiting = []
  let running = 0
  const pump = () => {
    while (running < INFO_CONCURRENCY && waiting.length > 0) {
      const { key, path, resolve } = waiting.shift()
      running += 1
      asPerson(path).then((info) => {
        if (info.error) cache.delete(key)
        resolve(info)
      }).finally(() => { running -= 1; pump() })
    }
  }
  /** `language` is the viewer's: a work's subtitles are chosen for it. */
  return (source, id, language = '') => {
    const key = `${source}/${id}/${language}`
    if (!cache.has(key)) cache.set(key, new Promise(resolve => { waiting.push({ key, path: `info?${query({ source, id, language })}`, resolve }); pump() }))
    return cache.get(key)
  }
}
export const infoOf = createInfoQueue()

/**
 * A picture from the host (`covers/<key>` routes), trying each in order: one
 * that fails to load (it could not be made) gives way to the next, and a
 * placeholder icon shows only when none loads.
 */
export function Picture({ pictures, className, emptyClassName, icon }) {
  const candidates = pictures.filter(Boolean)
  const [failed, setFailed] = React.useState(0)
  const key = candidates.join('|')
  React.useEffect(() => setFailed(0), [key])
  const src = candidates[failed]
  if (src !== undefined) return h('img', { key: src, className, src: new URL(src, base()).href, alt: '', loading: 'lazy', onError: () => setFailed(failed + 1) })
  return h('span', { className: emptyClassName }, icon)
}

/** A work's cover, or a quiet placeholder. */
export function Cover({ result, small = false }) {
  const size = small ? ' vsync-coverSmall' : ''
  const icon = result.media === 'book' ? Icon.Book : result.kind === 'audio' ? Icon.Audio : Icon.Film
  return h(Picture, { pictures: [result.cover], className: `vsync-cover${size}`, emptyClassName: `vsync-cover vsync-coverEmpty${size}`, icon: h(icon, { size: 22 }) })
}

/** What to show about a work at a glance: the fields in a row, skipping what is missing. */
export function glance(t, result) {
  const status = { finished: 'search.finished', ongoing: 'search.ongoing', stopped: 'search.stopped' }[result.status]
  return [
    popularityText(t, result.popularity),
    hasEpisodes(result.episodes) && plural(t, result.kind === 'audio' ? 'search.chapters' : 'search.episodes', result.episodes),
    result.duration > 0 && clock(result.duration),
    status && t(status),
    result.author,
  ].filter(Boolean)
}


/** A related work: a small cover, title, how it relates, score and the glance; pressing it opens that work. */
function RelatedWork({ t, source, work, onFocus }) {
  const known = useKnownWork(source, work.id)
  return h('li', { className: 'vsync-related' },
    h('button', { type: 'button', className: 'vsync-relatedButton', title: t('search.openWork'), onClick: () => onFocus(work) },
      h(Cover, { result: work, small: true }),
      h('span', { className: 'vsync-relatedText' },
        h('span', { className: 'vsync-cardHead' },
          h('span', { className: 'vsync-rowTitle' }, work.title),
          work.relation && h('span', { className: 'vsync-badge' }, t(`relation.${work.relation}`)),
          known.show !== null && h('span', { className: 'vsync-badge vsync-badgeHere' }, t(known.show.pinned ? 'search.offline' : 'search.inLibrary')),
          work.score && h('span', { className: 'vsync-score' }, fill(t('search.score'), { score: work.score.toFixed(1) }))),
        h('span', { className: 'vsync-rowMeta' }, glance(t, work).map((part, n) => h('span', { key: n }, part)))),
      h(Icon.Chevron, { size: 14 })))
}

/** `info` is the work's details (null while they load); onFocus opens a related work. */
export function WorkDetails({ t, info, source, onFocus }) {
  if (info === null) return h('p', { className: 'vsync-note', role: 'status' }, h(Spinner), ' ', t('search.relatedLoading'))
  const rows = info.meta ?? []
  const related = info.related ?? []
  return h('div', { className: 'vsync-details' },
    info.offline && h('p', { className: 'vsync-note', role: 'status' }, fill(t('library.offlineCopy'), { date: info.at ? day(t, info.at) : '?' })),
    info.blurb && h('p', { className: 'vsync-fullBlurb' }, info.blurb),
    info.latest && h('p', { className: 'vsync-note' }, fill(t('search.latest'), { title: info.latest })),
    rows.length > 0 && h('dl', { className: 'vsync-facts' }, rows.flatMap(row => [h('dt', { key: `${row.key}-k` }, metaLabel(t, row)), h('dd', { key: `${row.key}-v` }, row.value)])),
    h('h3', { className: 'vsync-subheading' }, t('search.related')),
    related.length === 0
      ? h('p', { className: 'vsync-note' }, t('search.noRelated'))
      : h('ul', { className: 'vsync-relatedList' }, related.map(work => h(RelatedWork, { key: work.id, t, source, work, onFocus }))))
}
