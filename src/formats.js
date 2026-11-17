/**
 * Book formats a converter can write and read, and what a work is offered
 * in (pure; also served to the page as /media-hub/web/formats.js).
 */

/** What a converter (Calibre's ebook-convert) can write, and the source formats it best starts from, most faithful first. */
export const CONVERT_TARGETS = Object.freeze(['epub', 'azw3', 'mobi', 'pdf', 'txt', 'docx', 'fb2'])
export const CONVERT_INPUTS = Object.freeze(['epub', 'azw3', 'mobi', 'fb2', 'docx', 'txt', 'pdf'])

/**
 * The formats a work is offered in: the source's own, then (with a converter) every target it can be converted to.
 * @returns {{ format: string, bytes: number | null, converted: boolean }[]}
 */
export function offeredFormats(formats, canConvert) {
  const own = (formats ?? []).map(entry => ({ format: entry.format, bytes: entry.bytes ?? null, converted: false }))
  if (!canConvert || !own.some(entry => CONVERT_INPUTS.includes(entry.format))) return own
  const have = new Set(own.map(entry => entry.format))
  return [...own, ...CONVERT_TARGETS.filter(format => !have.has(format)).map(format => ({ format, bytes: null, converted: true }))]
}

/** The source format to convert from: the most faithful one the work has. */
export function convertBase(formats) {
  const have = new Set((formats ?? []).map(entry => entry.format))
  return CONVERT_INPUTS.find(format => have.has(format)) ?? null
}
