import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const root = new URL('..', import.meta.url).pathname
/** Sites the hub must work for without knowing them: no name of one may appear in what it runs or shows. */
const SITES = /youtube|youtu\.be|bilibili|b23\.tv|vimeo|twitch|tiktok|niconico|nicovideo|dailymotion|soundcloud/i
const filesIn = dir => readdirSync(join(root, dir), { recursive: true }).filter(name => /\.(js|mjs|json|css)$/.test(name)).map(name => join(dir, name))

test('the plugin names no site in its code, page or words; sites are settings', () => {
  const files = ['index.js', 'tools.js', 'client.js', 'cordis.patch.yml', ...filesIn('src'), ...filesIn('web'), ...filesIn('locale')]
  const found = files.filter(file => SITES.test(readFileSync(join(root, file), 'utf8')))
  assert.deepEqual(found, [])
})
