/** The page's words, read from `locale/<tag>.json` by the shared kit: every file there is a language, so adding one needs no code. */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readLocales } from '@soffits/dsh-host-kit'

/** The plugin's locale folder, beside src/ and dist/ alike. */
export const LOCALE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../locale')

/** `{ <tag>: { <key>: text } }`; files that can't be used are skipped and reported to `logger`. */
export const readWords = (dir, logger) => readLocales(dir, { warn: message => logger?.warn(message) })
