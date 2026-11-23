/**
 * Builds dist/: the two entries (index.js, tools.js) with every package they
 * import (ws, schemastery) bundled in, so DSH imports the plugin without
 * resolving any bare package at boot, and the browser builds the page loads
 * from the host (src/vendored.js), and dist/client.js, the browser half DSH loads: client.js
 * with the build of the page's files written in (src/web-files.js), so a change to any page
 * file changes the browser half and DSH swaps it into open pages. dist/ is committed: `npm run
 * build` after changing anything the plugin ships; CI fails when it is stale.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { VENDORED } from '../src/vendored.js'
import { webBuild } from '../src/web-files.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

await build({
  entryPoints: [resolve(root, 'index.js'), resolve(root, 'tools.js')],
  outdir: resolve(root, 'dist'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // ws's optional native helpers are tried and skipped when absent.
  external: ['bufferutil', 'utf-8-validate'],
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  legalComments: 'none',
  logLevel: 'warning',
})

mkdirSync(resolve(root, 'dist'), { recursive: true })
const require = createRequire(import.meta.url)
for (const [name, { pkg, file }] of Object.entries(VENDORED)) {
  copyFileSync(resolve(dirname(require.resolve(`${pkg}/package.json`)), file), resolve(root, 'dist', name))
}

// After the vendored builds, which are page files too.
const BUILD_MARK = "'%WEB_BUILD%'"
const client = readFileSync(resolve(root, 'client.js'), 'utf8')
if (client.split(BUILD_MARK).length !== 2) throw new Error(`client.js must hold ${BUILD_MARK} once`)
writeFileSync(resolve(root, 'dist/client.js'), client.replace(BUILD_MARK, JSON.stringify(webBuild())))
