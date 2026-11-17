/**
 * Which way an outbound request goes, from the `proxies` setting: a list of
 * rules, each a proxy URL and the hosts it carries. The first rule naming a
 * host wins; a host no rule names goes direct. Every request the hub makes
 * itself (pictures) and every yt-dlp call asks here, so no site is named in
 * code.
 *
 * A request may name the page it belongs to (a video's thumbnail): it takes
 * the first rule naming its own host or that page's host, so a picture on a
 * CDN nobody listed goes the way its site goes.
 *
 * Patterns: `example.com` is that host and every host under it, `.cn` every
 * host ending so, `*` every host. A rule's `hostsFile` (one pattern per line,
 * `#` comments) is read again whenever it changes; while it can't be read,
 * requests fail rather than go direct.
 */
import { createWriteStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { pipeline } from 'node:stream/promises'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'

/** Proxy URL schemes, the ones yt-dlp takes too. */
export const PROXY_URL = /^(socks4a?|socks5h?|https?):\/\/[^\s/]+\/?$/
const MAX_REDIRECTS = 5
const USER_AGENT = 'dsh-media-hub'

const proxyError = (code, message) => Object.assign(new Error(message), { code })

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
 * @param {{ url: string, hosts?: string[], hostsFile?: string }[]} rules - the `proxies` setting
 * @param {{ read?: (path: string) => Promise<string>, version?: (path: string) => Promise<number> }} [io] - tests replace the file system
 */
export function createProxies(rules = [], io = {}) {
  const read = io.read ?? (path => readFile(path, 'utf8'))
  const version = io.version ?? (async path => (await stat(path)).mtimeMs)
  /** hostsFile -> { version, patterns } */
  const files = new Map()
  const agents = new Map()

  async function patternsOf(rule) {
    const listed = (rule.hosts ?? []).map(pattern => pattern.trim().toLowerCase()).filter(Boolean)
    if (!rule.hostsFile) return listed
    try {
      const current = await version(rule.hostsFile)
      if (files.get(rule.hostsFile)?.version !== current) files.set(rule.hostsFile, { version: current, patterns: parseHosts(await read(rule.hostsFile)) })
    } catch (error) {
      files.delete(rule.hostsFile)
      throw proxyError('proxy_unavailable', `cannot read the proxy hosts file ${rule.hostsFile}: ${error.message}`)
    }
    return [...listed, ...files.get(rule.hostsFile).patterns]
  }

  /** The proxy URL for a request to `url` on behalf of `page`, or '' to go direct. */
  async function route(url, page = '') {
    const hosts = [hostOf(url), hostOf(page)].filter(Boolean)
    for (const rule of rules) {
      const patterns = await patternsOf(rule)
      if (hosts.some(host => patterns.some(pattern => hostMatches(host, pattern)))) return rule.url
    }
    return ''
  }

  function agentFor(proxy) {
    if (proxy === '') return undefined
    if (!agents.has(proxy)) agents.set(proxy, proxy.startsWith('socks') ? new SocksProxyAgent(proxy) : new HttpsProxyAgent(proxy))
    return agents.get(proxy)
  }

  /** One GET through its route; resolves with the response once headers arrive. */
  async function get(url, page, timeoutMs) {
    const protocol = new URL(url).protocol
    if (protocol !== 'https:' && protocol !== 'http:') throw proxyError('invalid', `not a web address: ${url}`)
    const agent = agentFor(await route(url, page))
    return new Promise((resolve, reject) => {
      const send = protocol === 'https:' ? httpsRequest : httpRequest
      const req = send(url, { agent, headers: { 'user-agent': USER_AGENT, accept: 'image/*,*/*;q=0.5' }, timeout: timeoutMs }, resolve)
      req.on('timeout', () => req.destroy(proxyError('timeout', `no answer from ${hostOf(url)} in ${timeoutMs / 1000} s`)))
      req.on('error', reject)
      req.end()
    })
  }

  return {
    route,

    /**
     * Fetch `url` into `file` through its route, following redirects (each hop routed again).
     * @param {{ page?: string, maxBytes: number, timeoutMs: number }} options
     */
    async download(url, file, { page = '', maxBytes, timeoutMs }) {
      let target = url
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const response = await get(target, page, timeoutMs)
        const { statusCode = 0, headers } = response
        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          response.resume()
          target = new URL(headers.location, target).href
          continue
        }
        if (statusCode !== 200) {
          response.resume()
          throw proxyError('fetch_failed', `${hostOf(target)} answered ${statusCode}`)
        }
        if (Number(headers['content-length']) > maxBytes) {
          response.destroy()
          throw proxyError('too_large', `the file is over ${maxBytes} bytes`)
        }
        let received = 0
        response.on('data', (chunk) => {
          received += chunk.length
          if (received > maxBytes) response.destroy(proxyError('too_large', `the file is over ${maxBytes} bytes`))
        })
        await pipeline(response, createWriteStream(file))
        return
      }
      throw proxyError('fetch_failed', `more than ${MAX_REDIRECTS} redirects from ${hostOf(url)}`)
    },
  }
}
