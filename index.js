/**
 * DeepSeek Harness Host plugin: rooms for watching a video together.
 *
 * Mounts /media-hub on DSH's web server (media, subtitles, the page's
 * browser modules, a JSON API for rooms, the library and sources) and the
 * room WebSocket, all behind DSH's own login. Provides the `mediaHub`
 * service, which the agent tool (tools.js) looks up at call time.
 */
import { join, resolve } from 'node:path'
import { WebSocketServer } from 'ws'
import { Config } from './src/config.js'
import { createDelivery } from './src/delivery.js'
import { ROUTE, WS_PATH, admitOwner, createHandler, refuseUpgrade } from './src/http.js'
import { createMediaHub } from './src/media.js'
import { createShelfRoutes } from './src/shelf-routes.js'
import { commandExists } from './src/sources/command.js'
import { createSources } from './src/sources/index.js'

export const name = 'dsh-media-hub'
export const inject = ['webServer', 'connection']
export { Config }

const ROOM_ID = /^[A-Za-z0-9_-]{6,32}$/
const DAY_MS = 86_400_000

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {import('@deepseek-ai/schemastery').default.infer<typeof Config>} config
 */
export function apply(ctx, config) {
  const logger = ctx.logger('media-hub')
  let current

  // The tool plugin looks this up at call time; `service()` is undefined while the rooms load or stop.
  ctx.provide?.('mediaHub', Object.freeze({ service: () => current }))

  ctx.effect(() => {
    const stateDir = resolve(config.stateDir)
    const service = createMediaHub({
      stateDir,
      libraryRoots: [join(stateDir, 'library'), ...config.libraryRoots.map(root => resolve(root))],
      delivery: createDelivery({ mode: config.delivery }),
      tools: { ffmpeg: config.ffmpeg, ffprobe: config.ffprobe, ytDlp: config.ytDlp, maxHeight: config.maxHeight, threads: config.threads },
      webUrl: () => ctx.get('webApp')?.getAdvertisedUrl(),
      lifetime: { emptyMinutes: config.emptyMinutes, unopenedHours: config.unopenedHours },
      autoDeleteDays: config.autoDeleteDays,
      sources: createSources(config.sources, { stateDir, logger }),
      coverCacheBytes: config.coverCacheMb * 1e6,
      books: {
        capBytes: config.bookCacheGb * 1e9,
        converter: { command: config.converter, available: () => (config.converter === '' ? Promise.resolve(false) : commandExists(config.converter)) },
      },
      notifyCommand: config.notifyCommand,
      cache: { ahead: config.cacheAhead, behind: config.cacheBehind, capBytes: config.cacheLimitGb * 1e9 },
      logger,
    })
    let stopped = false
    const loading = service.load().then(() => {
      if (stopped) return
      current = service
      return service.pruneCache(config.cacheDays)
    }).catch(error => logger.warn('could not start rooms: %s', error.message))
    const prune = setInterval(() => { service.pruneCache(config.cacheDays).catch(() => {}) }, DAY_MS)

    const shelfRoutes = createShelfRoutes({
      books: () => current?.books,
      identity: () => ctx.get('requestIdentity'),
    }).map(route => ctx.connection.fetch.register(route))

    const sockets = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: false })
    const disposeHttp = ctx.webServer.register({
      kind: 'prefix',
      path: ROUTE,
      handler: createHandler({ connection: ctx.connection, service: () => current, label: () => config.label, logger }),
    })
    const disposeUpgrade = ctx.webServer.registerUpgrade({
      path: WS_PATH,
      handler(req, socket, head) {
        const admitted = admitOwner(ctx.connection, req)
        if (!admitted.ok) return refuseUpgrade(socket, admitted.status)
        const room = new URL(req.url ?? '/', 'http://media-hub.invalid').searchParams.get('room')
        if (current === undefined || room === null || !ROOM_ID.test(room)) return refuseUpgrade(socket, room === null ? 400 : 404)
        sockets.handleUpgrade(req, socket, head, (ws) => {
          if (current === undefined) ws.close(1013, 'stopping')
          else current.attach(ws, room)
        })
      },
    })

    return async () => {
      stopped = true
      current = undefined
      clearInterval(prune)
      disposeUpgrade()
      disposeHttp()
      await Promise.all(shelfRoutes.map(dispose => dispose()))
      await loading
      await service.dispose()
      sockets.close()
    }
  }, 'media-hub.rooms()')
}
