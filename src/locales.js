/** The page's words, read from `locale/<tag>.json`: every file there is a language, so adding one needs no code. */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BASE, TAG } from './i18n.js'

/**
 * `{ <tag>: { <key>: text } }` from each `<tag>.json` in `dir` (its `ui` table; `meta` is DSH's plugin
 * title and description). A file that is not a tag, not JSON or has no `ui` table is skipped and logged.
 */
export async function readLocales(dir, logger) {
  const names = (await readdir(dir).catch(() => [])).filter(name => name.endsWith('.json')).sort()
  const locales = {}
  for (const name of names) {
    const tag = name.slice(0, -'.json'.length)
    if (!TAG.test(tag)) {
      logger?.warn('locale/%s: the name is not a language tag; skipped', name)
      continue
    }
    try {
      const { ui } = JSON.parse(await readFile(join(dir, name), 'utf8'))
      if (ui === null || typeof ui !== 'object' || Array.isArray(ui)) throw new Error('no "ui" table')
      locales[tag] = Object.fromEntries(Object.entries(ui).filter(([, text]) => typeof text === 'string'))
    } catch (error) {
      logger?.warn('locale/%s: %s; skipped', name, error.message)
    }
  }
  if (locales[BASE] === undefined) logger?.warn('locale/%s.json is missing; every other language falls back to it', BASE)
  return locales
}
