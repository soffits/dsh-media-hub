/**
 * Which signed-in account yt-dlp reads a page with, from the `cookies`
 * setting: host rules (src/hosts.js), each with accounts. A request on
 * behalf of a person takes their own account, else the default one (no
 * person), else one its owner shared. No site is named in code.
 *
 * The hub never changes a session: yt-dlp writes its cookie jar back into
 * the file it reads, so each run gets a private copy that is deleted after
 * it, and the account's own file stays with whatever keeps it fresh. Cookie
 * values are never logged or returned; an account is shown by its name.
 */
import { randomBytes } from 'node:crypto'
import { copyFile, chmod, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { codedError } from './errors.js'
import { createHostRules } from './hosts.js'

/** What a page or the tool may know of an account. */
export const accountView = account => (account === null ? null : { name: account.name || account.person || '' })

/**
 * @param {{ hosts?: string[], hostsFile?: string, accounts?: { person?: string, name?: string, file: string, userAgent?: string, share?: boolean }[] }[]} rules - the `cookies` setting
 * @param {{ read?: (path: string) => Promise<string>, version?: (path: string) => Promise<number> }} [io] - tests replace the file system
 */
export function createCookies(rules = [], io = {}) {
  const hostRules = createHostRules(rules, io)

  return {
    /**
     * The account for reading `url` on behalf of `person` (a sign-in id, '' for nobody known), or null.
     * @returns {Promise<{ person: string, name: string, file: string, userAgent: string, share: boolean } | null>}
     */
    async account(url, person = '') {
      const rule = await hostRules.match(url)
      const accounts = (rule?.accounts ?? []).map(entry => ({ person: '', name: '', userAgent: '', share: false, ...entry }))
      return (person !== '' ? accounts.find(entry => entry.person === person) : undefined)
        ?? accounts.find(entry => entry.person === '')
        ?? accounts.find(entry => entry.share)
        ?? null
    },

    /**
     * yt-dlp's arguments for an account, with a private copy of its cookies in `dir`; `done` deletes the copy.
     * @returns {Promise<{ args: string[], done: () => Promise<void> }>}
     */
    async use(account, dir) {
      if (account === null) return { args: [], done: async () => {} }
      await mkdir(dir, { recursive: true })
      const copy = join(dir, `.cookies-${randomBytes(6).toString('hex')}.txt`)
      try {
        await copyFile(account.file, copy)
        await chmod(copy, 0o600)
      } catch (error) {
        await rm(copy, { force: true })
        throw codedError('cookies_unavailable', `cannot read the cookies of the account ${accountView(account).name}: ${error.code ?? error.message}`)
      }
      const args = ['--cookies', copy, ...(account.userAgent ? ['--user-agent', account.userAgent] : [])]
      return { args, done: () => rm(copy, { force: true }) }
    },
  }
}
