/**
 * A room's Comments tab: what people wrote about the work on its site, read
 * only, newest copy first from the hub (src/remarks.js), with more pages on
 * request.
 */
import { formatCount } from './format.js'
import { React, api, day, fill, h, plural } from './ui.js'

function Comment({ t, item }) {
  return h('li', { className: 'vsync-comment' },
    h('div', { className: 'vsync-commentHead' },
      h('strong', { className: 'vsync-commentName' }, item.name || t('comments.someone')),
      item.rating !== null && h('span', { className: 'vsync-commentRating' }, fill(t('comments.rating'), { score: item.rating })),
      item.created && h('span', { className: 'vsync-commentDate' }, day(t, Date.parse(item.created)))),
    h('p', { className: 'vsync-commentText' }, item.text),
    (item.likes > 0 || item.replies > 0) && h('div', { className: 'vsync-commentStats' },
      item.likes > 0 && h('span', null, fill(t('comments.likes'), { n: formatCount(item.likes, t.language) })),
      item.replies > 0 && h('span', null, plural(t, 'comments.replies', item.replies))))
}

export function Comments({ t, roomId }) {
  const [pages, setPages] = React.useState(null)
  const [error, setError] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const path = `rooms/${encodeURIComponent(roomId)}/comments`

  React.useEffect(() => {
    let live = true
    api(path).then((answer) => {
      if (!live) return
      if (answer.error) setError(answer.error)
      else setPages([answer])
    })
    return () => { live = false }
  }, [path])

  if (error !== null) return h('p', { className: 'vsync-commentNote' }, error)
  if (pages === null) return h('p', { className: 'vsync-commentNote', role: 'status' }, t('comments.loading'))
  const items = pages.flatMap(page => page.items)
  const next = pages[pages.length - 1].next
  const more = async () => {
    setBusy(true)
    const answer = await api(`${path}?cursor=${encodeURIComponent(next)}`)
    setBusy(false)
    if (answer.error) return setError(answer.error)
    const seen = new Set(items.map(item => item.id))
    return setPages([...pages, { ...answer, items: answer.items.filter(item => !seen.has(item.id)) }])
  }
  return h('div', { className: 'vsync-comments' },
    pages[0].total > 0 && h('p', { className: 'vsync-commentNote' }, plural(t, 'comments.total', pages[0].total)),
    items.length === 0
      ? h('p', { className: 'vsync-commentNote' }, t('comments.none'))
      : h('ul', { className: 'vsync-commentList' }, items.map(item => h(Comment, { key: item.id, t, item }))),
    next && h('button', { type: 'button', className: 'vsync-btn', disabled: busy, onClick: more }, busy ? t('comments.loading') : t('comments.more')))
}
