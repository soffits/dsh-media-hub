/**
 * The files the page loads from the Host, and the name of their build.
 *
 * The page loads them from /media-hub/web/<build>/<name>, because a browser keeps the first module it loaded from
 * an address for as long as the page lives. The build is a hash of every one of them, so an address names exact
 * bytes: scripts/build.mjs writes it into dist/client.js, the browser half DSH loads, and the Host serves an
 * address only while the files on disk are that build. An update that changes a page file therefore changes the
 * browser half's own bundle too, which is what DSH watches to swap a plugin's browser half into open pages.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { VENDORED } from './vendored.js'

/** `here` is src/ or dist/ (the built entries), both one level below the plugin's folder. */
const here = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(here, '..')
const WEB_NAME = /^[a-z0-9-]+\.(js|css)$/
/** The modules that also run in Node, by the name they are served under, and their place in the plugin's folder. */
const SHARED = Object.freeze({ 'sync.js': 'src/sync.js', 'formats.js': 'src/formats.js', 'i18n.js': 'src/i18n.js', 'captions.js': 'src/captions.js' })
export const MODULES = Object.freeze(Object.fromEntries(Object.entries(SHARED).map(([name, path]) => [name, resolve(ROOT, path)])))

/** A package's browser build the page loads (VENDORED): next to the built entries, else from the package (a source checkout). */
function vendoredFile(name, root) {
  const built = resolve(root, 'dist', name)
  if (existsSync(built)) return built
  const { pkg, file } = VENDORED[name]
  return resolve(dirname(createRequire(import.meta.url).resolve(`${pkg}/package.json`)), file)
}

/** The file served as /media-hub/web/<build>/<name>, or undefined; `root` is the plugin's folder. */
export function webFile(name, root = ROOT) {
  if (Object.hasOwn(VENDORED, name)) return vendoredFile(name, root)
  if (Object.hasOwn(SHARED, name)) return resolve(root, SHARED[name])
  return WEB_NAME.test(name) ? resolve(root, 'web', name) : undefined
}

/** Every file the page can load, as [served name, path], in a fixed order. */
export function webFiles(root = ROOT) {
  const names = [...readdirSync(resolve(root, 'web')).filter(name => WEB_NAME.test(name)), ...Object.keys(SHARED), ...Object.keys(VENDORED)]
  return names.sort().map(name => [name, webFile(name, root)])
}

/** The build of the page's files as they are on disk: it changes exactly when one of them does. */
export function webBuild(files = webFiles()) {
  const hash = createHash('sha256')
  for (const [name, file] of files) hash.update(`${name}\0`).update(readFileSync(file)).update('\0')
  return hash.digest('hex').slice(0, 12)
}

/**
 * The build on disk now, hashed again only when a file's identity changed (an install replaces files or rewrites
 * them in place), and every build this process has seen.
 */
export function createBuildWatch(list = webFiles) {
  let stamp = ''
  let build = ''
  const seen = new Set()
  const current = () => {
    const listed = list()
    const files = listed.map(([name, file]) => [name, statSync(file, { throwIfNoEntry: false })])
    const now = files.map(([name, info]) => `${name}:${info ? `${info.ino}:${info.size}:${info.mtimeMs}:${info.ctimeMs}` : '-'}`).join('|')
    if (now !== stamp) {
      stamp = now
      // A file missing is an install half done: no build until it is whole.
      build = files.every(([, info]) => info !== undefined) ? webBuild(listed) : ''
      if (build) seen.add(build)
    }
    return build
  }
  return { current, seen: name => seen.has(name) }
}
