/**
 * How a show's episodes are fetched, when its source offers a choice: `auto`
 * (the best the source has), a height cap (`720`: the picture's short side), or
 * `audio` only. The show keeps its quality and every download of it uses it. Pure.
 */
export const AUTO = 'auto'
export const AUDIO = 'audio'
const HEIGHT = /^\d{3,4}$/
const MIN_HEIGHT = 144

export const isHeight = value => HEIGHT.test(String(value)) && Number(value) >= MIN_HEIGHT
export const isQuality = value => value === AUTO || value === AUDIO || isHeight(value)

/** The choices a source's listed heights give, best first after `auto`; none when there is nothing to choose between. */
export function heightChoices(raw) {
  const heights = [...new Set((Array.isArray(raw) ? raw : []).map(String).filter(isHeight))].sort((a, b) => Number(b) - Number(a))
  return heights.length > 1 ? [AUTO, ...heights] : []
}
