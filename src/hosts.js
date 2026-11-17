/**
 * Host rules: settings that apply per host (`proxies`, `cookies`) list rules,
 * each naming its hosts; the first rule naming a request's host applies. No
 * site is named in code: the owner lists them.
 *
 * Patterns: `example.com` is that host and every host under it, `.cn` every
 * host ending so, `*` every host. A rule's `hostsFile` (one pattern per line,
 * `#` comments) is read again whenever it changes; while it can't be read,
 * matching fails rather than guessing.
 */
import { readFile, stat } from 'node:fs/promises'

const hostsError = (code, message) => Object.assign(new Error(message), { code })

/** The host of a URL, lowercase and without a trailing dot, or '' when it is not one. */
export function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/\.$/, '')
  } catch {
    return ''
  }
}

/** Patterns from a hosts file's text: one per line, `#` starts a comment. */
export const parseHosts = text => text.split('\n').map(line => line.split('#')[0].trim().toLowerCase()).filter(Boolean)

export function hostMatches(host, pattern) {
  if (host === '') return false
  if (pattern === '*') return true
  if (pattern.startsWith('.')) return host.endsWith(pattern)
  return host === pattern || host.endsWith(`.${pattern}`)
}

/**
 * @template {{ hosts?: string[], hostsFile?: string }} Rule
 * @param {Rule[]} rules
 * @param {{ read?: (path: string) => Promise<string>, version?: (path: string) => Promise<number> }} [io] - tests replace the file system
 */
export function createHostRules(rules = [], io = {}) {
  const read = io.read ?? (path => readFile(path, 'utf8'))
  const version = io.version ?? (async path => (await stat(path)).mtimeMs)
  /** hostsFile -> { version, patterns } */
  const files = new Map()

  async function patternsOf(rule) {
    const listed = (rule.hosts ?? []).map(pattern => pattern.trim().toLowerCase()).filter(Boolean)
    if (!rule.hostsFile) return listed
    try {
      const current = await version(rule.hostsFile)
      if (files.get(rule.hostsFile)?.version !== current) files.set(rule.hostsFile, { version: current, patterns: parseHosts(await read(rule.hostsFile)) })
    } catch (error) {
      files.delete(rule.hostsFile)
      throw hostsError('hosts_unreadable', `cannot read the hosts file ${rule.hostsFile}: ${error.message}`)
    }
    return [...listed, ...files.get(rule.hostsFile).patterns]
  }

  return {
    /**
     * The first rule naming the host of any of `urls`, or null.
     * @param {...string} urls
     * @returns {Promise<Rule | null>}
     */
    async match(...urls) {
      const hosts = urls.map(hostOf).filter(Boolean)
      for (const rule of rules) {
        const patterns = await patternsOf(rule)
        if (hosts.some(host => patterns.some(pattern => hostMatches(host, pattern)))) return rule
      }
      return null
    },
  }
}
