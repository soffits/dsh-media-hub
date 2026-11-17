import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createServer as createTcpServer, connect } from 'node:net'
import { join } from 'node:path'
import { test } from 'node:test'
import { hostMatches, parseHosts } from '../src/hosts.js'
import { createProxies, proxyAnswers } from '../src/proxy.js'
import { tempDir } from './helpers.js'

/** A small web server: /pic answers a few bytes, /moved redirects to it, /big answers more than tests allow. */
async function webServer(t) {
  const server = createServer((req, res) => {
    if (req.url === '/moved') return res.writeHead(302, { location: '/pic' }).end()
    if (req.url === '/big') return res.writeHead(200).end(Buffer.alloc(5000))
    if (req.url === '/pic') return res.writeHead(200, { 'content-type': 'image/png' }).end('picture')
    return res.writeHead(404).end()
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  t.after(() => server.close())
  return server.address().port
}

/** A SOCKS5 proxy (no authentication) that resolves every name to 127.0.0.1 and remembers the hosts it was asked for. */
async function socksProxy(t) {
  const asked = []
  const server = createTcpServer((client) => {
    client.once('data', () => {
      client.write(Buffer.from([5, 0]))
      client.once('data', (request) => {
        const type = request[3]
        const host = type === 3 ? request.subarray(5, 5 + request[4]).toString() : [...request.subarray(4, 8)].join('.')
        const port = request.readUInt16BE(type === 3 ? 5 + request[4] : 8)
        asked.push(host)
        const target = connect(port, '127.0.0.1', () => {
          client.write(Buffer.from([5, 0, 0, 1, 0, 0, 0, 0, 0, 0]))
          target.pipe(client).pipe(target)
        })
        target.on('error', () => client.destroy())
      })
    })
    client.on('error', () => {})
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  t.after(() => server.close())
  return { url: `socks5h://127.0.0.1:${server.address().port}`, asked }
}

test('a pattern is a host with every host under it, a suffix, or every host', () => {
  assert.ok(hostMatches('site.example', 'site.example'))
  assert.ok(hostMatches('i0.cdn.site.example', 'site.example'))
  assert.ok(!hostMatches('notsite.example', 'site.example'))
  assert.ok(hostMatches('news.site.cn', '.cn'))
  assert.ok(!hostMatches('cn.example', '.cn'))
  assert.ok(hostMatches('anything.example', '*'))
  assert.ok(!hostMatches('', '*'))
  assert.deepEqual(parseHosts('# sites\n.CN\n\nvideo.example  # with a note\n'), ['.cn', 'video.example'])
})

test('the first rule naming the host or the page\'s host gives the proxy; others go direct', async () => {
  const proxies = createProxies([
    { url: 'socks5h://127.0.0.1:1', hosts: ['video.example'] },
    { url: 'http://127.0.0.1:2', hosts: ['*'] },
  ])
  assert.equal(await proxies.route('https://www.video.example/watch/1'), 'socks5h://127.0.0.1:1')
  assert.equal(await proxies.route('https://pictures.example/1.jpg', 'https://video.example/watch/1'), 'socks5h://127.0.0.1:1', 'a picture goes the way its page goes')
  assert.equal(await proxies.route('https://other.example/'), 'http://127.0.0.1:2')
  assert.equal(await createProxies([]).route('https://video.example/'), '')
})

test('a hosts file is read again when it changes, and while it can\'t be read nothing goes direct', async () => {
  const files = { '/hosts': { version: 1, text: 'video.example\n' } }
  const io = {
    version: async (path) => { if (!files[path]) throw new Error('ENOENT'); return files[path].version },
    read: async path => files[path].text,
  }
  const proxies = createProxies([{ url: 'socks5h://127.0.0.1:1', hostsFile: '/hosts' }], io)
  assert.equal(await proxies.route('https://video.example/'), 'socks5h://127.0.0.1:1')
  assert.equal(await proxies.route('https://other.example/'), '')
  files['/hosts'] = { version: 2, text: 'video.example\nother.example\n' }
  assert.equal(await proxies.route('https://other.example/'), 'socks5h://127.0.0.1:1')
  delete files['/hosts']
  await assert.rejects(proxies.route('https://unlisted.example/'), { code: 'proxy_unavailable' })
})

test('a download follows redirects and stops at the size limit and at errors', async (t) => {
  const port = await webServer(t)
  const dir = tempDir(t)
  const proxies = createProxies([])
  const options = { maxBytes: 1000, timeoutMs: 5000 }
  await proxies.download(`http://127.0.0.1:${port}/moved`, join(dir, 'a'), options)
  assert.equal(readFileSync(join(dir, 'a'), 'utf8'), 'picture')
  await assert.rejects(proxies.download(`http://127.0.0.1:${port}/big`, join(dir, 'b'), options), { code: 'too_large' })
  await assert.rejects(proxies.download(`http://127.0.0.1:${port}/gone`, join(dir, 'c'), options), { code: 'fetch_failed' })
  await assert.rejects(proxies.download('ftp://127.0.0.1/x', join(dir, 'd'), options), { code: 'invalid' })
})

test('a routed download goes through the proxy, names resolved there, and fails when the proxy is down', async (t) => {
  const port = await webServer(t)
  const socks = await socksProxy(t)
  const dir = tempDir(t)
  const options = { maxBytes: 1000, timeoutMs: 5000 }
  const proxies = createProxies([{ url: socks.url, hosts: ['pictures.invalid', 'video.example'] }])
  await proxies.download(`http://pictures.invalid:${port}/pic`, join(dir, 'a'), options)
  assert.equal(readFileSync(join(dir, 'a'), 'utf8'), 'picture', 'a name only the proxy resolves')
  await proxies.download(`http://127.0.0.1:${port}/pic`, join(dir, 'b'), { ...options, page: 'https://video.example/watch/1' })
  assert.deepEqual(socks.asked, ['pictures.invalid', '127.0.0.1'])
  const down = createProxies([{ url: 'socks5h://127.0.0.1:9', hosts: ['*'] }])
  await assert.rejects(down.download(`http://127.0.0.1:${port}/pic`, join(dir, 'c'), options))
})
