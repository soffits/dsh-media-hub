import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createBoundary } from '../web/boundary.js'

class Component {
  constructor(props) { this.props = props }
}
const React = { Component, createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat() }) }
const texts = node => (node === null || typeof node !== 'object' ? [String(node)] : node.children.flatMap(texts))

test('a page that throws while drawing shows what broke and a way to reload, not a blank panel', () => {
  const Boundary = createBoundary(React)
  const page = { type: 'page' }
  const t = key => ({ 'page.crashed': 'This page stopped working.', 'page.reload': 'Reload' })[key]
  const boundary = new Boundary({ t, children: page })
  boundary.state = Boundary.getDerivedStateFromError(new Error('work.meta is not iterable'))
  const shown = boundary.render()
  assert.notEqual(shown, page)
  assert.deepEqual(texts(shown), ['This page stopped working.', 'work.meta is not iterable', 'Reload'])
  assert.equal(new Boundary({ t, children: page }).render(), page)
})
