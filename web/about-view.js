/**
 * About a show in a room: its cover, score, popularity, tags and everything
 * the source gave (web/details.js), kept with the show so no request goes to
 * the source. A related work opens in Discover in a new tab, so the room is
 * never left by accident.
 */
import { Cover, WorkDetails, glance } from './details.js'
import { writeNav } from './nav.js'
import { FollowButton } from './follow.js'
import { fill, h } from './ui.js'

/** The Discover URL of a work. */
export const discoverLink = (source, work) => `${location.origin}${location.pathname}${writeNav('', { tab: 'discover', source, kind: work.kind ?? null, work: work.id })}`

/** The next season of a work: a related season whose title extends this one's ("X" then "X第二季"). */
export function nextSeason(work) {
  if (!work?.title) return null
  return (work.related ?? []).find(other => other.relation === 'season' && other.title !== work.title && other.title.startsWith(work.title)) ?? null
}

export function About({ t, work, source, workId }) {
  return h('div', { className: 'vsync-about' },
    h('div', { className: 'vsync-aboutHead' },
      h(Cover, { result: work }),
      h('div', { className: 'vsync-aboutTitle' },
        h('strong', null, work.title),
        work.score && h('span', { className: 'vsync-score' }, fill(t('search.score'), { score: work.score.toFixed(1) })),
        h('span', { className: 'vsync-rowMeta' }, glance(t, work).map((part, n) => h('span', { key: n }, part))),
        work.tags?.length > 0 && h('span', { className: 'vsync-tags' }, work.tags.slice(0, 6).map(tag => h('span', { key: tag, className: 'vsync-tag' }, tag))),
        h('span', { className: 'vsync-actions' }, h(FollowButton, { t, source, work: { id: workId } })))),
    h(WorkDetails, { t, info: work, source, onFocus: other => window.open(discoverLink(source, other), '_blank', 'noopener') }))
}
