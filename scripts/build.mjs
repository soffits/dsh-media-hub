/**
 * Builds dist/: the two entries (index.js, tools.js) with every package they
 * import (ws, schemastery) bundled in, so DSH imports the plugin without
 * resolving any bare package at boot, and hls.js's browser build, which the
 * page loads from the host. dist/ is committed: `npm run build` after changing
 * a source file under index.js, tools.js or src/; CI fails when it is stale.
 */
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

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
const hls = resolve(dirname(createRequire(import.meta.url).resolve('hls.js/package.json')), 'dist/hls.mjs')
copyFileSync(hls, resolve(root, 'dist/hls.mjs'))
