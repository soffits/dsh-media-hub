import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import vm from 'node:vm'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const page = readdirSync(new URL('../web/', import.meta.url)).filter(name => name.endsWith('.js')).map(name => read(`../web/${name}`)).join('\n')
const used = prefix => [...new Set([...page.matchAll(new RegExp(`\\b${prefix}\\.([A-Za-z]\\w*)`, 'g'))].map(m => m[1]))]

test('every DSH component the page takes exists in the oldest DSH it supports', () => {
  const shipped = read('../node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/index.js')
  const exported = new Set([...shipped.matchAll(/^export \{([^}]*)\}/gm)].flatMap(m => m[1].split(',').map(name => name.trim().split(/\s+as\s+/).pop())))
  assert.ok(exported.has('Button'), 'read the export list')
  const names = used('P')
  assert.ok(names.includes('SegmentedTabs'))
  for (const name of names) assert.ok(exported.has(name), `${name} is not in dsh-client-ui-primitives`)
})

test('every kit piece the page takes is in the kit version it needs, and every icon it names is bundled', () => {
  let registration
  vm.runInNewContext(read('../node_modules/@soffits/dsh-ui-kit/client.js'), { window: { __ModuleLoader__: { load: (value) => { registration = value } } }, console })
  const react = { createElement: () => null, useState: v => [v, () => {}], useEffect: () => {}, useRef: v => ({ current: v }), useLayoutEffect: () => {}, useCallback: f => f, useSyncExternalStore: (s, get) => get() }
  const kitModule = registration.factory(id => (id === 'react' ? react : new Proxy({}, { get: (_, name) => name })))
  let kit
  kitModule.apply({ effect: () => {}, locale: { register: () => () => {}, bind: () => key => key, subscribe: () => () => {}, getSnapshot: () => ({ active: 'en' }) }, provide: (name, value) => { kit = value }, inject: () => {} })
  for (const name of used('K')) assert.ok(name in kit, `${name} is not in @soffits/dsh-ui-kit`)
  const icons = [...new Set([...page.matchAll(/K\.Icon, \{ name: '([a-z0-9-]+)'/g), ...page.matchAll(/K\.Tile, \{ icon: '([a-z0-9-]+)'/g), ...page.matchAll(/'(bell-ring|bell-plus)'/g)].map(m => m[1]))]
  assert.ok(icons.length > 3)
  for (const icon of icons) assert.ok(kit.ICON_NAMES.includes(icon), `the kit bundles no ${icon} icon`)
})
