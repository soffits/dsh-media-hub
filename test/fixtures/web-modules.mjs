/**
 * Tests load the page's modules the way the browser does: a module the Host serves under web/ from
 * elsewhere (src/http.js MODULES, such as `./i18n.js`) resolves to that file.
 */
import { registerHooks } from 'node:module'
import { pathToFileURL } from 'node:url'
import { MODULES } from '../../src/http.js'

const web = new URL('../../web/', import.meta.url).href

registerHooks({
  resolve(specifier, context, next) {
    const served = specifier.startsWith('./') && context.parentURL?.startsWith(web) ? MODULES[specifier.slice(2)] : undefined
    return next(served === undefined ? specifier : pathToFileURL(served).href, context)
  },
})
