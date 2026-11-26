import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { crc32, deflateRawSync } from 'node:zlib'
import { test } from 'node:test'
import { MIN_TEXT_CHARS, isBlankBook } from '../src/blank.js'
import { tempDir } from './helpers.js'

/** A zip with every entry deflated, as an epub is. */
function zip(files) {
  const locals = []
  const central = []
  let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const body = deflateRawSync(Buffer.from(text))
    const nameBytes = Buffer.from(name)
    const head = Buffer.alloc(30)
    head.writeUInt32LE(0x04034b50, 0)
    head.writeUInt16LE(8, 8)
    head.writeUInt32LE(crc32(Buffer.from(text)), 14)
    head.writeUInt32LE(body.length, 18)
    head.writeUInt32LE(text.length, 22)
    head.writeUInt16LE(nameBytes.length, 26)
    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(8, 10)
    entry.writeUInt32LE(body.length, 20)
    entry.writeUInt16LE(nameBytes.length, 28)
    entry.writeUInt32LE(offset, 42)
    locals.push(head, nameBytes, body)
    central.push(entry, nameBytes)
    offset += head.length + nameBytes.length + body.length
  }
  const directory = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(Object.keys(files).length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, directory, end])
}

const chapter = text => `<html><body><h1>Chapter</h1>${text}</body></html>`
const prose = '风吹过很长的街。'.repeat(MIN_TEXT_CHARS)

async function blank(t, format, body) {
  const path = join(tempDir(), `book.${format}`)
  writeFileSync(path, body)
  return isBlankBook(path, format)
}

test('a file with no bytes is blank in every format', async (t) => {
  for (const format of ['epub', 'txt', 'pdf', 'azw3']) assert.equal(await blank(t, format, ''), true, format)
})

test('a text file is blank when it holds no real text', async (t) => {
  assert.equal(await blank(t, 'txt', '\n \t\n  \n'), true)
  assert.equal(await blank(t, 'txt', `第1章\n${prose}`), false)
})

test('an epub whose chapters hold only titles is blank; one with text in any chapter is not', async (t) => {
  const shell = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`OEBPS/chapters/ch${i + 1}.xhtml`, chapter('')]))
  assert.equal(await blank(t, 'epub', zip({ mimetype: 'application/epub+zip', 'OEBPS/cover.jpg': 'jpeg', ...shell })), true)
  assert.equal(await blank(t, 'epub', zip({ ...shell, 'OEBPS/chapters/ch31.xhtml': chapter(`<p>${prose}</p>`) })), false)
})

test('what cannot be read as a book is not called blank, and neither is a book of pictures', async (t) => {
  assert.equal(await blank(t, 'epub', 'PK\x03\x04 a short body that is no archive'), false)
  assert.equal(await blank(t, 'pdf', '%PDF'), false)
  const pages = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`OEBPS/p${i}.png`, 'png']))
  assert.equal(await blank(t, 'epub', zip({ 'OEBPS/page.xhtml': '<html><body><img src="p0.png"/></body></html>', ...pages })), false)
})
