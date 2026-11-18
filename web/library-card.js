/**
 * The one card every library item is shown in, whatever it is: a cover, a title with its type, a line of facts, a
 * muted line, tags, what to show beside them, the actions, and room below for what opens out (episodes, details).
 * Shows and books differ only in what they put in these places.
 */
import { Icon, React, h } from './ui.js'
import { Picture } from './details.js'

/** The cover slot: the item's own picture when it has one, else a quiet icon, in the same size for every kind. */
export function LibraryCover({ pictures, icon }) {
  return h(Picture, { pictures, className: 'vsync-poster vsync-libCover', emptyClassName: 'vsync-poster vsync-libCover vsync-posterEmpty', icon })
}

/**
 * @param {object} props
 * @param {React.ReactNode} props.cover - a LibraryCover
 * @param {React.ReactNode} props.title - the title (a button, or a form while renaming)
 * @param {string} props.badge - what kind of item it is, in words
 * @param {string[]} props.lead - the short line of facts
 * @param {React.ReactNode[]} [props.rest] - the muted line
 * @param {string[]} [props.tags]
 * @param {React.ReactNode} [props.aside] - under the tags: a details toggle, an error
 * @param {React.ReactNode} props.actions - the buttons, or a confirmation in their place
 * @param {{ open: boolean, label: string, onToggle: () => void } | null} [props.expand] - the chevron of an item that opens out
 * @param {React.ReactNode} [props.below] - what opens out
 */
export function LibraryCard({ cover, title, badge, lead, rest = [], tags = [], aside = null, actions, expand = null, below = null }) {
  return h('li', { className: 'vsync-show' },
    h('div', { className: 'vsync-row' },
      expand
        ? h('button', { type: 'button', className: 'vsync-expand', 'aria-expanded': String(expand.open), 'aria-label': expand.label, onClick: expand.onToggle }, h(Icon.Chevron, { open: expand.open }))
        : h('span', { className: 'vsync-expand', 'aria-hidden': true }),
      cover,
      h('span', { className: 'vsync-rowText' },
        h('span', { className: 'vsync-cardHead' }, title, h('span', { className: 'vsync-badge' }, badge)),
        h('span', { className: 'vsync-rowMeta vsync-rowLead' }, lead.map((part, n) => h('span', { key: n }, part))),
        rest.length > 0 && h('span', { className: 'vsync-rowMeta vsync-rowMuted' }, rest.map((part, n) => h('span', { key: n }, part))),
        tags.length > 0 && h('span', { className: 'vsync-tags' }, tags.map(tag => h('span', { key: tag, className: 'vsync-tag' }, tag))),
        aside),
      actions),
    below)
}
