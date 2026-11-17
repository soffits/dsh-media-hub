/**
 * Where the page is: which tab, and under Discover which source and
 * category. It lives in the URL query (vs-tab, vs-source, vs-kind) so a
 * refresh, the back button and a pasted link keep it; the last source and
 * category are also remembered per browser. Pure: no DOM, so it runs in Node.
 */

export const TABS = Object.freeze(['watching', 'library', 'discover'])
export const DEFAULT_TAB = 'watching'
export const PARAM_PREFIX = 'vs-'
export const PARAMS = Object.freeze({ tab: `${PARAM_PREFIX}tab`, source: `${PARAM_PREFIX}source`, kind: `${PARAM_PREFIX}kind`, work: `${PARAM_PREFIX}work` })

const MEMORY_KEY = 'dsh-media-hub:discover'

/** Whether a query string carries any of the page's own parameters. */
export const hasNavParams = search => [...new URLSearchParams(search).keys()].some(key => key.startsWith(PARAM_PREFIX))

/** @returns {{ tab: string, source: string | null, kind: string | null, work: string | null }} */
export function readNav(search) {
  const params = new URLSearchParams(search)
  const tab = params.get(PARAMS.tab)
  return {
    tab: TABS.includes(tab) ? tab : DEFAULT_TAB,
    source: params.get(PARAMS.source) || null,
    kind: params.get(PARAMS.kind) || null,
    work: params.get(PARAMS.work) || null,
  }
}

/**
 * The query string for a place, other parameters kept. The default tab
 * and what only Discover uses are left out when they do not apply.
 */
export function writeNav(search, nav) {
  const params = new URLSearchParams(search)
  for (const name of Object.values(PARAMS)) params.delete(name)
  if (nav.tab !== DEFAULT_TAB) params.set(PARAMS.tab, nav.tab)
  if (nav.tab === 'discover') {
    if (nav.source) params.set(PARAMS.source, nav.source)
    if (nav.kind) params.set(PARAMS.kind, nav.kind)
    if (nav.work && nav.source) params.set(PARAMS.work, nav.work)
  }
  const text = params.toString()
  return text === '' ? '' : `?${text}`
}

/** The query string without the page's parameters, for when the page is left. */
export const clearNav = search => writeNav(search, { tab: DEFAULT_TAB })

/** The source id that searches every source with the chosen category at once (src/sources/index.js ALL_SOURCES). */
export const ALL_SOURCE = 'all'

/** Whether typed text is a web address, what Link takes. */
export function isWebAddress(text) {
  try {
    return ['http:', 'https:'].includes(new URL(String(text).trim()).protocol)
  } catch {
    return false
  }
}

/** Whether a source takes a web address (Link) rather than a search. */
export const takesUrl = source => source?.input === 'url'

/** With more than one searchable source, All sources first: every category any of them has, each once, in the order they come. */
export function withAll(sources, allLabel) {
  const searchable = sources.filter(source => !takesUrl(source))
  if (searchable.length < 2) return sources
  const kinds = []
  for (const source of searchable) {
    for (const kind of source.kinds) if (!kinds.some(known => known.id === kind.id)) kinds.push(kind)
  }
  return [{ id: ALL_SOURCE, label: allLabel, kinds }, ...sources]
}

/** The source to show: what the URL asks for, else the one used last, else the first. */
export function pickSource(sources, wanted, remembered) {
  return (sources.find(s => s.id === wanted) ?? sources.find(s => s.id === remembered) ?? sources[0]) ?? null
}

/** The category to show for a source: what the URL asks for, else the one used last for it, else its first. */
export function pickKind(source, wanted, remembered) {
  if (source === null || source.kinds.length === 0 || takesUrl(source)) return null
  return (source.kinds.find(k => k.id === wanted) ?? source.kinds.find(k => k.id === remembered) ?? source.kinds[0]).id
}

/** The browser's local storage, or null where it is blocked. */
export function browserStorage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** The last source and, per source, category used in this browser. */
export function readMemory(storage) {
  try {
    const memory = JSON.parse(storage?.getItem(MEMORY_KEY) ?? 'null')
    return { source: typeof memory?.source === 'string' ? memory.source : null, kinds: memory?.kinds && typeof memory.kinds === 'object' ? memory.kinds : {} }
  } catch {
    return { source: null, kinds: {} }
  }
}

export function remember(storage, { source, kind }) {
  try {
    const memory = readMemory(storage)
    if (source) memory.source = source
    if (source && kind) memory.kinds[source] = kind
    storage?.setItem(MEMORY_KEY, JSON.stringify(memory))
  } catch {
    // Storage may be full or blocked; the choice is then simply not remembered.
  }
}
