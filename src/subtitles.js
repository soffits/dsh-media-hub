/**
 * Subtitles to WebVTT, the only format browsers' <track> reads.
 *
 * Text files arrive in many encodings: UTF-8 (with or without BOM), UTF-16,
 * and the legacy encodings of Chinese, Japanese and Korean releases. The
 * decoder takes the first one that reads the bytes without errors, trying
 * UTF-8 first because a legacy decoder accepts almost any byte sequence.
 */

/** Legacy encodings tried after UTF-8, most common first. */
export const LEGACY_ENCODINGS = Object.freeze(['gb18030', 'big5', 'shift_jis', 'euc-kr'])

/**
 * Decode subtitle bytes to text.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function decodeText(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  for (const encoding of ['utf-8', ...LEGACY_ENCODINGS]) {
    try {
      return new TextDecoder(encoding, { fatal: true, ignoreBOM: false }).decode(bytes)
    } catch {
      // Not this encoding; try the next.
    }
  }
  return new TextDecoder('utf-8').decode(bytes)
}

const SRT_TIME = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/g

/**
 * SubRip text to WebVTT text.
 * @param {string} srt
 * @returns {string}
 */
export function srtToVtt(srt) {
  const body = srt
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n')
      const timing = lines.findIndex(line => line.includes('-->'))
      if (timing < 0) return null
      const time = lines[timing].replace(SRT_TIME, (_, h, m, s, ms) => `${h.padStart(2, '0')}:${m}:${s}.${ms.padEnd(3, '0')}`)
      return [time, ...lines.slice(timing + 1)].join('\n')
    })
    .filter(Boolean)
    .join('\n\n')
  return `WEBVTT\n\n${body}\n`
}

/** Whether text is already WebVTT. */
export const isVtt = text => /^\uFEFF?WEBVTT/.test(text)
