/**
 * Which way an outbound request goes, from the `proxies` setting: a list of
 * host rules (src/hosts.js), each with a proxy URL. The first rule naming a
 * host wins; a host no rule names goes direct. Every request the hub makes
 * itself (pictures) and every yt-dlp call asks here, so no site is named in
 * code.
 *
 * A request may name the page it belongs to (a video's thumbnail): it takes
 * the first rule naming its own host or that page's host, so a picture on a
 * CDN nobody listed goes the way its site goes. While a rule's hosts file
 * can't be read, requests fail rather than go direct.
 */
import { createWriteStream } from 'node:fs'
import { connect } from 'node:net'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { pipeline } from 'node:stream/promises'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { codedError } from './errors.js'
import { createHostRules, hostOf } from './hosts.js'

/** Proxy URL schemes, the ones yt-dlp takes too. */
export const PROXY_URL = /^(socks4a?|socks5h?|https?):\/\/[^\s/]+\/?$/
const MAX_REDIRECTS = 5
const USER_AGENT = 'dsh-media-hub'
const PROBE_TIMEOUT_MS = 3000

/** Whether a proxy accepts a connection at all: the signal that tells "the proxy is down" from "the site said no". */
export function proxyAnswers(proxy, timeoutMs = PROBE_TIMEOUT_MS) {
  const { hostname, port, protocol } = new URL(proxy)
  const defaultPort = protocol.startsWith('socks') ? 1080 : protocol === 'https:' ? 443 : 80
  return new Promise((resolve) => {
    const socket = connect({ host: hostname.replace(/^\[|\]$/g, ''), port: Number(port) || defaultPort })
    const done = (up) => { socket.destroy(); resolve(up) }
    socket.setTimeout(timeoutMs, () => done(false))
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
  })
}

/**
 * @param {{ url: string, hosts?: string[], hostsFile?: string }[]} rules - the `proxies` setting
 * @param {{ read?: (path: string) => Promise<string>, version?: (path: string) => Promise<number> }} [io] - tests replace the file system
 */
export function createProxies(rules = [], io = {}) {
  const hostRules = createHostRules(rules, io)
  const agents = new Map()

  /** The proxy URL for a request to `url` on behalf of `page`, or '' to go direct. */
  async function route(url, page = '') {
    try {
      return (await hostRules.match(url, page))?.url ?? ''
    } catch (error) {
      throw codedError('proxy_unavailable', error.message)
    }
  }

  function agentFor(proxy) {
    if (proxy === '') return undefined
    if (!agents.has(proxy)) agents.set(proxy, proxy.startsWith('socks') ? new SocksProxyAgent(proxy) : new HttpsProxyAgent(proxy))
    return agents.get(proxy)
  }

  /** One GET through its route; resolves with the response once headers arrive. */
  async function get(url, page, timeoutMs) {
    const protocol = new URL(url).protocol
    if (protocol !== 'https:' && protocol !== 'http:') throw codedError('invalid', `not a web address: ${url}`)
    const agent = agentFor(await route(url, page))
    return new Promise((resolve, reject) => {
      const send = protocol === 'https:' ? httpsRequest : httpRequest
      const req = send(url, { agent, headers: { 'user-agent': USER_AGENT, accept: 'image/*,*/*;q=0.5' }, timeout: timeoutMs }, resolve)
      req.on('timeout', () => req.destroy(codedError('timeout', `no answer from ${hostOf(url)} in ${timeoutMs / 1000} s`)))
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
          throw codedError('fetch_failed', `${hostOf(target)} answered ${statusCode}`)
        }
        if (Number(headers['content-length']) > maxBytes) {
          response.destroy()
          throw codedError('too_large', `the file is over ${maxBytes} bytes`)
        }
        let received = 0
        response.on('data', (chunk) => {
          received += chunk.length
          if (received > maxBytes) response.destroy(codedError('too_large', `the file is over ${maxBytes} bytes`))
        })
        await pipeline(response, createWriteStream(file))
        return
      }
      throw codedError('fetch_failed', `more than ${MAX_REDIRECTS} redirects from ${hostOf(url)}`)
    },
  }
}
