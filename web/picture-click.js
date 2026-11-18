/**
 * What a press on the picture does, as players have it: a mouse click plays
 * or pauses, a double click goes full screen, and a tap leaves it to the
 * browser (its first tap shows the controls). Presses on the browser's own
 * control bar along the bottom are its own. Pure.
 */

/** How tall the browser's control bar is at most, from the bottom of the picture (CSS pixels). */
export const CONTROLS_HEIGHT = 56
/** How long a click waits to see whether it is the first half of a double click. */
export const DOUBLE_CLICK_MS = 250

/**
 * @param {{ pointerType: string, y: number, height: number, toggledByBrowser: boolean }} press - `y` from the
 *   picture's top; `toggledByBrowser`: the element already changed between playing and paused for this press
 * @returns {'toggle' | 'none'}
 */
export function pictureClick({ pointerType, y, height, toggledByBrowser }) {
  if (pointerType !== 'mouse' || toggledByBrowser) return 'none'
  return y < height - CONTROLS_HEIGHT ? 'toggle' : 'none'
}
