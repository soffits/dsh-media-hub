/**
 * Whether a downloaded book holds nothing to read (pure apart from reading the file).
 *
 * A source can finish "successfully" and still hand over a shell: no bytes, a text file with only whitespace,
 * or an epub whose chapters carry titles and no text. Such a file must never count as a finished book.
 * A container this module cannot read is not called blank: an odd file is not an empty one.
 */
import { open, readFile, stat } from 'node:fs/promises'
import { inflateRawSync } from 'node:zlib'

/** An epub with fewer characters than this in every part is a shell: a chapter title is tens, a page of prose hundreds. */
export const MIN_TEXT_CHARS = 200

const MAX_ZIP_BYTES = 64 * 1024 * 1024
const END_OF_DIRECTORY = 0x06054b50
const DIRECTORY_ENTRY = 0x02014b50
const PARTS = /\.(?:x?html?)$/i
const IMAGES = /\.(?:jpe?g|png|gif|webp)$/i
/** A cover and a few pictures make no picture book; more pages of images do, and carry no text. */
const PICTURE_BOOK_IMAGES = 4

const readableLength = text => text.replace(/<[^>]*>/g, '').replace(/&#?\w+;/g, ' ').replace(/\s+/g, '').length

/** The names and bodies of an archive's entries, read lazily; `null` when it is not a zip we can read. */
function zipEntries(buffer) {
  let end = -1
  for (let at = buffer.length - 22; at >= Math.max(0, buffer.length - 22 - 0xffff); at--) {
    if (buffer.readUInt32LE(at) === END_OF_DIRECTORY) { end = at; break }
  }
  if (end === -1) return null
  const count = buffer.readUInt16LE(end + 10)
  let at = buffer.readUInt32LE(end + 16)
  const entries = []
  for (let i = 0; i < count; i++) {
    if (at + 46 > buffer.length || buffer.readUInt32LE(at) !== DIRECTORY_ENTRY) return null
    const method = buffer.readUInt16LE(at + 10)
    const size = buffer.readUInt32LE(at + 20)
    const local = buffer.readUInt32LE(at + 42)
    const nameLength = buffer.readUInt16LE(at + 28)
    const name = buffer.toString('utf8', at + 46, at + 46 + nameLength)
    entries.push({
      name,
      read() {
        const data = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28)
        const body = buffer.subarray(data, data + size)
        return method === 0 ? body : inflateRawSync(body)
      },
    })
    at += 46 + nameLength + buffer.readUInt16LE(at + 30) + buffer.readUInt16LE(at + 32)
  }
  return entries
}

async function epubIsBlank(path) {
  try {
    const entries = zipEntries(await readFile(path))
    if (entries === null || entries.filter(entry => IMAGES.test(entry.name)).length >= PICTURE_BOOK_IMAGES) return false
    return !entries.filter(entry => PARTS.test(entry.name)).some(part => readableLength(part.read().toString('utf8')) >= MIN_TEXT_CHARS)
  } catch {
    return false
  }
}

async function textIsBlank(path) {
  const handle = await open(path)
  try {
    const chunk = Buffer.alloc(64 * 1024)
    for (let position = 0; ; position += chunk.length) {
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, position)
      if (bytesRead === 0) return true
      if (/\S/.test(chunk.toString('utf8', 0, bytesRead))) return false
    }
  } finally {
    await handle.close()
  }
}

/**
 * @param {string} path
 * @param {string} format - the book's format (`epub`, `txt`...)
 * @returns {Promise<boolean>} true when the file has no bytes, a text file only whitespace, or an epub no real text
 */
export async function isBlankBook(path, format) {
  const { size } = await stat(path)
  if (size === 0) return true
  if (format === 'txt') return textIsBlank(path)
  if (format === 'epub' && size <= MAX_ZIP_BYTES) return epubIsBlank(path)
  return false
}
