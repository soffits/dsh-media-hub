import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CONTROLS_HEIGHT, pictureClick } from '../web/picture-click.js'

test('a mouse click on the picture plays or pauses; taps, the control bar and a browser that already did it are left alone', () => {
  const height = 400
  assert.equal(pictureClick({ pointerType: 'mouse', y: 100, height, toggledByBrowser: false }), 'toggle')
  assert.equal(pictureClick({ pointerType: 'touch', y: 100, height, toggledByBrowser: false }), 'none', 'a tap shows the controls first')
  assert.equal(pictureClick({ pointerType: 'pen', y: 100, height, toggledByBrowser: false }), 'none')
  assert.equal(pictureClick({ pointerType: 'mouse', y: height - CONTROLS_HEIGHT / 2, height, toggledByBrowser: false }), 'none', 'the control bar is the browser\'s')
  assert.equal(pictureClick({ pointerType: 'mouse', y: 100, height, toggledByBrowser: true }), 'none', 'a browser that toggles on click is not undone')
})
