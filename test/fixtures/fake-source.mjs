#!/usr/bin/env node
/**
 * A stand-in source command for tests: speaks the protocol of
 * docs/source-protocol.md with no network. Episodes are copies of
 * FAKE_SOURCE_SAMPLE (or a few bytes), FAKE_SOURCE_EPISODES of them (default
 * 3), FAKE_SOURCE_DELAY_MS apart. A second work (a long one, 12 episodes)
 * answers to a search for 长剧. FAKE_SOURCE_SLOW_KIND names a search kind that
 * answers FAKE_SOURCE_SLOW_MS late. Every download run is appended to
 * FAKE_SOURCE_LOG (when set) as its --episodes range. FAKE_SOURCE_FAIL=N makes
 * episode N fail; FAKE_SOURCE_BAD_HASH=N reports a wrong hash for episode N.
 * Search hits carry covers (a made-up CDN URL), popularity and the other
 * descriptive fields; `info` adds related works. The `cover` verb writes a
 * small PNG whose colour follows the URL, and appends the URL to
 * FAKE_SOURCE_COVER_LOG (when set); FAKE_SOURCE_COVER_FAIL makes it fail, and
 * FAKE_SOURCE_COVER_BYTES makes it write that many bytes of junk instead.
 * Extra words on the command line before the verb (the config's fixed
 * arguments) are ignored.
 *
 * Books: a search of kind `book`, `ebook` or `paper` answers two public-domain titles (one in
 * epub and txt, one only in txt) and appends its filter flags to
 * FAKE_SOURCE_LOG; `info` of a book id lists its formats; `download
 * --format F` writes one small file `<title>.<F>` (an epub is a zip, so it
 * starts with PK).
 */
import { createHash } from 'node:crypto'
import { deflateSync, crc32 } from 'node:zlib'
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const verbAt = argv.findIndex(word => ['search', 'info', 'download', 'cover'].includes(word))
const command = argv[verbAt]
const args = argv.slice(verbAt + 1)
const flag = (name) => {
  const joined = args.find(word => word.startsWith(`${name}=`))
  return joined === undefined ? args[args.indexOf(name) + 1] : joined.slice(name.length + 1)
}
const positional = args[args.indexOf('--') + 1]
const episodes = Number(process.env.FAKE_SOURCE_EPISODES ?? 3)
const delay = Number(process.env.FAKE_SOURCE_DELAY_MS ?? 50)
const sleep = ms => new Promise(done => setTimeout(done, ms))
const emit = value => console.log(JSON.stringify(value))
const ID = '7600000000000000001'
const LONG_ID = '7600000000000000004'
const LONG_EPISODES = 12

const SEASON_TWO_ID = '7600000000000000005'
const coverUrl = id => `https://cdn.invalid/novel-pic/${id}~tplv-600.heic?x-signature=abc`

/** A PNG of width x height with a vertical gradient from `top` to `bottom` (rgb triples). */
function png(width, height, top, bottom) {
  const rows = []
  for (let y = 0; y < height; y++) {
    const mix = i => Math.round(top[i] + (bottom[i] - top[i]) * (y / (height - 1)))
    rows.push(Buffer.from([0, ...Array.from({ length: width }, () => [mix(0), mix(1), mix(2)]).flat()]))
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data])
    const out = Buffer.alloc(body.length + 8)
    out.writeUInt32BE(data.length, 0)
    body.copy(out, 4)
    out.writeUInt32BE(crc32(body), body.length + 4)
    return out
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))])
}

const PALETTE = [[[240, 150, 120], [120, 60, 110]], [[110, 190, 220], [30, 70, 130]], [[170, 220, 140], [40, 110, 90]], [[240, 210, 120], [190, 90, 60]], [[190, 160, 230], [70, 50, 130]]]
const paletteOf = id => PALETTE[Number(id.slice(-1)) % PALETTE.length]

const DRAMA_FACTS = {
  popularity: { count: 3667000, label: 'plays' },
  episode_count: 3,
  status: 'finished',
  tags: ['奇幻爱情', '都市', '总裁'],
  meta: [{ key: 'heat', label: 'Heat', value: '3374万' }, { key: 'cast', label: 'Cast', value: '王奕然,侯呈玥' }, { key: 'duration', label: 'Duration', value: '126 min' }, { key: 'region', label: 'Region', value: '内地' }],
}

/** Search kinds answered with books (the kind is echoed back, so any configured book kind works). */
const BOOK_KINDS = ['book', 'ebook', 'paper']

const BOOKS = {
  'pg-1342': { id: 'pg-1342', title: 'Pride and Prejudice', author: 'Jane Austen', kind: 'book', year: 1813, language: 'en', origin: 'Test Gutenberg', cover: coverUrl('1342'), formats: [{ format: 'epub', bytes: 300 }, { format: 'txt', bytes: 700 }] },
  'pg-2701': { id: 'pg-2701', title: 'Moby Dick', author: 'Herman Melville', kind: 'book', year: 1851, language: 'en', origin: 'Test Gutenberg', formats: [{ format: 'txt', bytes: 8_000_000 }] },
  'zh-1': { id: 'zh-1', title: '红楼梦', author: '曹雪芹', kind: 'book', year: 1791, language: 'zh', origin: 'Test Library', formats: [{ format: 'txt', bytes: 900 }] },
}

if (command === 'search' && BOOK_KINDS.includes(flag('--kind'))) {
  if (process.env.FAKE_SOURCE_LOG) appendFileSync(process.env.FAKE_SOURCE_LOG, `search ${args.filter(word => word.startsWith('--') && !['--kind', '--limit', '--json', '--'].includes(word)).join(' ')}\n`)
  emit({ results: Object.values(BOOKS).map(book => ({ ...book, kind: flag('--kind') })) })
} else if (command === 'info' && BOOKS[positional] !== undefined) {
  emit(BOOKS[positional])
} else if (command === 'download' && args.includes('--format')) {
  const book = BOOKS[flag('--id')]
  const format = flag('--format')
  if (book === undefined || !book.formats.some(entry => entry.format === format)) {
    console.error(`error: no ${format} for ${flag('--id')}`)
    process.exit(1)
  }
  const dir = flag('--output')
  mkdirSync(dir, { recursive: true })
  await sleep(delay)
  const name = `${book.title}.${format}`
  const body = format === 'epub' ? Buffer.concat([Buffer.from('PK\x03\x04'), Buffer.from(`epub of ${book.title}`)]) : Buffer.from(`${book.title}\n${book.author}\n`)
  writeFileSync(join(dir, `.${name}.part`), body)
  renameSync(join(dir, `.${name}.part`), join(dir, name))
  const file = { name, bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') }
  emit({ event: 'done', ...file })
  emit({ event: 'result', folder: dir, files: [file] })
} else if (command === 'cover') {
  const url = positional
  if (process.env.FAKE_SOURCE_COVER_LOG) appendFileSync(process.env.FAKE_SOURCE_COVER_LOG, `${url}\n`)
  if (process.env.FAKE_SOURCE_COVER_FAIL) {
    console.error('error: cover cdn is unreachable')
    process.exit(1)
  }
  const id = /novel-pic\/(\d+)~/.exec(url)?.[1] ?? '0'
  const [top, bottom] = paletteOf(id)
  writeFileSync(flag('--output'), process.env.FAKE_SOURCE_COVER_BYTES ? Buffer.alloc(Number(process.env.FAKE_SOURCE_COVER_BYTES), 0x41) : png(84, 112, top, bottom))
} else if (command === 'search') {
  if (flag('--kind') === process.env.FAKE_SOURCE_SLOW_KIND) await sleep(Number(process.env.FAKE_SOURCE_SLOW_MS ?? 3000))
  if (positional.includes('分页')) {
    // Two pages: two works, then one more.
    const at = args.includes('--offset') ? Number(flag('--offset')) : 0
    const work = (id, title, plays) => ({ id, title, author: '测试影业', kind: 'drama', score: 8, blurb: '分页测试。', popularity: { count: plays, label: 'plays' }, episode_count: 3 })
    emit(at === 0
      ? { results: [work('7600000000000000011', '分页甲', 100), work('7600000000000000012', '分页乙', 900)], next: 2 }
      : { results: [work('7600000000000000013', '分页丙', 500)] })
  } else if (positional.includes('长剧')) {
    emit({ results: [{ id: LONG_ID, title: '长剧测试', author: '测试影业', kind: 'drama', score: 8, blurb: '一部很长的测试短剧。', cover: coverUrl(LONG_ID), ...DRAMA_FACTS, episode_count: LONG_EPISODES, status: 'ongoing' }] })
  } else if (flag('--kind') === 'audio') {
    emit({ results: [{ id: '7600000000000000002', title: '测试有声书', author: '某作者（主播：某人）', kind: 'audio', score: 9, blurb: '一本用来测试的有声书。' }] })
  } else {
    emit({
      results: [
        { id: ID, title: '测试短剧', author: '测试影业', kind: 'drama', score: 8.6, blurb: '一部用来测试的短剧，三集，讲两个人交换了身体。 第二行简介。', cover: coverUrl(ID), ...DRAMA_FACTS, episode_count: episodes },
        { id: SEASON_TWO_ID, title: '测试短剧第二季', author: '测试影业', kind: 'drama', score: 8.9, blurb: '第二季。', cover: coverUrl(SEASON_TWO_ID), ...DRAMA_FACTS, popularity: { count: 15368, label: 'plays' }, episode_count: 2, status: 'ongoing' },
        { id: '7600000000000000003', title: '一本小说', author: '某作者', kind: 'novel', score: 7, blurb: '这一条不是短剧，应该被跳过。' },
      ],
    })
  }
} else if (command === 'info') {
  if (![ID, LONG_ID, SEASON_TWO_ID].includes(positional)) {
    console.error('error: no such work')
    process.exit(1)
  }
  const long = positional === LONG_ID
  const count = long ? LONG_EPISODES : positional === SEASON_TWO_ID ? 2 : episodes
  const related = positional === ID
    ? [
        { id: SEASON_TWO_ID, title: '测试短剧第二季', kind: 'drama', relation: 'season', author: '测试影业', score: 8.9, cover: coverUrl(SEASON_TWO_ID), popularity: { count: 15368, label: 'plays' }, episode_count: 2, status: 'ongoing' },
        { id: '7600000000000000007', title: '另一个改编', kind: 'drama', relation: 'related', author: '别家影业', cover: coverUrl('7600000000000000007'), episode_count: 40 },
      ]
    : positional === SEASON_TWO_ID
      ? [{ id: ID, title: '测试短剧', kind: 'drama', relation: 'season', author: '测试影业', score: 8.6, cover: coverUrl(ID), episode_count: episodes }]
      : []
  emit({
    id: positional,
    title: positional === SEASON_TWO_ID ? '测试短剧第二季' : long ? '长剧测试' : '测试短剧',
    kind: 'drama',
    author: '测试影业',
    status: 'finished',
    score: 8.6,
    blurb: '一部用来测试的短剧。完整简介，不会被截断，讲两个人交换了身体之后的故事。',
    cover: coverUrl(positional),
    ...DRAMA_FACTS,
    latest: `第${count}集`,
    related,
    episodes: Array.from({ length: count }, (_, i) => ({ number: i + 1, id: `e${i + 1}`, title: `第${i + 1}集`, locked: false })),
  })
} else if (command === 'download') {
  const dir = flag('--output')
  const id = flag('--id')
  const total = id === LONG_ID ? LONG_EPISODES : episodes
  const [, first, last] = /^(\d+)(?:-(\d*))?$/.exec(flag('--episodes') ?? '1-') ?? []
  const from = Number(first ?? 1)
  const to = flag('--episodes')?.includes('-') ? Number(last || total) : from
  if (process.env.FAKE_SOURCE_LOG) appendFileSync(process.env.FAKE_SOURCE_LOG, `${flag('--episodes')}\n`)
  mkdirSync(dir, { recursive: true })
  emit({ event: 'work', id, title: '测试短剧', kind: 'drama', selected: to - from + 1, total })
  const files = []
  const failed = []
  let done = 0
  for (let n = from; n <= Math.min(to, total); n++) {
    const name = `${String(n).padStart(2, '0')} 第${n}集.mp4`
    if (existsSync(join(dir, name))) {
      emit({ event: 'skipped', number: n, name })
      continue
    }
    done += 1
    emit({ event: 'start', number: n, name, index: done, of: to - from + 1, label: '1080p' })
    await sleep(delay)
    if (Number(process.env.FAKE_SOURCE_FAIL) === n) {
      failed.push({ number: n, name, reason: 'no stream' })
      emit({ event: 'failed', number: n, name, reason: 'no stream' })
      continue
    }
    const part = join(dir, `.${name}.part`)
    if (process.env.FAKE_SOURCE_SAMPLE) copyFileSync(process.env.FAKE_SOURCE_SAMPLE, part)
    else writeFileSync(part, `episode ${n}\n`)
    renameSync(part, join(dir, name))
    const sha256 = Number(process.env.FAKE_SOURCE_BAD_HASH) === n ? '0'.repeat(64) : createHash('sha256').update(readFileSync(join(dir, name))).digest('hex')
    const file = { number: n, name, bytes: statSync(join(dir, name)).size, sha256 }
    files.push(file)
    emit({ event: 'done', ...file })
  }
  emit({ event: 'result', kind: 'drama', folder: dir, files, written: files.length, skipped: 0, bytes: 0, failed })
  process.exit(failed.length > 0 ? 1 : 0)
} else {
  console.error(`unknown command ${command}`)
  process.exit(2)
}
