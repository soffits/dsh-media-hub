/*
 * Browser half of dsh-media-hub: the sidebar entry (named by the `label`
 * setting, else Media in the viewer's language) and its page in the main
 * column.
 *
 * Plain JavaScript in DSH's Client module format (no build step); React
 * comes from the page's module table. This file registers the entry, the
 * words and the styles; the page itself (search, rooms, library, one room)
 * lives in browser modules the Host half serves under /media-hub/web/
 * (page.js and the modules it imports), loaded when the page first opens.
 *
 * A link with ?media-room=<room> (or ?videosync=<room>, as links from the
 * time this was Video Sync have it) opens the page on that room; one with
 * the page's own vs-* parameters (tab, source, category: web/nav.js) opens
 * the panel on them. "Chat about this" on a card starts a conversation
 * through the Web UI's workspace service with a draft the person sends.
 */
window.__ModuleLoader__.load({
  id: '@soffits/dsh-media-hub',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect } = React

    const NS = 'dsh-media-hub'
    const PANEL = 'dsh-media-hub'
    const STYLE_ID = 'dsh-media-hub'
    const LINK_PARAMS = ['media-room', 'videosync']
    const web = name => new URL(`media-hub/web/${name}`, document.baseURI).href

    const en = {
      panel: 'Media',
      title: 'Media',
      note: 'Find shows, novels, books and papers. Watch together in sync, or download a book in the format you want.',
      'source.all': 'All sources',
      'search.sourceFailed': '{source} did not answer: {message}',
      'filter.label': 'Filters',
      'filter.labelActive': 'Filters ({n})',
      'filter.any': 'Any',
      'filter.language': 'Language',
      'filter.format': 'Format',
      'filter.yearFrom': 'From year',
      'filter.yearTo': 'To year',
      'filter.size': 'Size',
      'filter.upTo': 'up to {size}',
      'book.format': 'Format',
      'book.download': 'Download',
      'book.downloadAs': 'Download {format}',
      'book.fetching': 'Downloading…',
      'book.converting': 'Downloading and converting…',
      'book.converted': 'converted',
      'book.onShelf': 'On your shelf',
      'book.save': 'Save {format}',
      'shelf.title': 'My books',
      'shelf.empty': 'Nothing yet. Find a book or novel in Discover and download it.',
      'shelf.usedOf': '{used} of {cap}',
      'shelf.removed': 'Removed to save space; download it again any time.',
      'shelf.again': 'Download again',
      'shelf.delete': 'Delete',
      'shelf.deleteQuestion': 'Delete this book from your shelf?',
      'chat.ask': 'Ask',
      'chat.about': 'Chat about this',
      'chat.aboutBook': 'About this:',
      'kind.novel': 'Novels',
      'kind.ebook': 'Ebooks',
      'kind.paper': 'Papers',
      'tab.watching': 'Watching',
      'tab.library': 'Library',
      'tab.discover': 'Discover',
      'discover.source': 'Source',
      'discover.kind': 'Category',
      'discover.back': 'Back',
      'discover.workFailed': 'Could not load this work: {message}',
      'search.openWork': 'Open this work',
      'search.more': 'Load more',
      'sort.label': 'Sort results',
      'sort.default': 'Default',
      'sort.plays': 'Most played',
      'sort.newest': 'Newest',
      'search.inLibrary': 'In library',
      'search.offline': 'Offline',
      'search.joinRoom': 'Join room',
      'search.continueEp': 'Continue ep {n}',
      'search.continue': 'Continue',
      'search.open': 'Open',
      'source.link': 'Link',
      'link.invalid': 'That is not a YouTube video or playlist link.',
      'watching.continue': 'Continue watching',
      'watching.emptyTitle': 'Nothing is playing right now.',
      'watching.emptyHint': 'Pick up a show from the library, or find something new.',
      'search.label': 'Search',
      'search.placeholder': 'Search {source}',
      'search.go': 'Search',
      'search.none': 'Nothing found.',
      'search.episodes': '{n} episodes',
      'search.chapters': '{n} chapters',
      'search.score': '★ {score}',
      'search.finished': 'complete',
      'search.ongoing': 'ongoing',
      'search.watch': 'Watch together now',
      'search.save': 'Save to library',
      'search.saveHint': 'Keeps the first episodes ({n}) on disk and fetches more as you watch',
      'search.saveAll': 'Download all (offline)',
      'search.saveAllHint': 'Keep every episode on disk, to watch offline',
      'search.saveAllQuestion': 'All {n} episodes, about {size}?',
      'search.loading': 'Searching…',
      'search.opening': 'Opening the room…',
      'search.saving': 'Adding…',
      'search.saved': 'Saved; the first episodes are downloading',
      'search.savedAll': 'Downloading the whole show',
      'search.stopped': 'stopped',
      'search.details': 'Details',
      'search.hideDetails': 'Hide details',
      'search.latest': 'Latest: {title}',
      'search.related': 'Other seasons and related works',
      'search.relatedLoading': 'Looking for other seasons…',
      'search.noRelated': 'No other seasons or related works found.',
      'relation.season': 'Season',
      'relation.same-title': 'Same title',
      'relation.related': 'Related',
      'pop.plays': '{n} plays',
      'pop.readers': '{n} readers',
      'pop.listeners': '{n} listeners',
      'pop.viewers': '{n} viewers',
      'pop.followers': '{n} followers',
      'pop.heat': '{n} heat',
      'meta.heat': 'Heat',
      'meta.followers': 'Followers',
      'meta.cast': 'Cast',
      'meta.duration': 'Duration',
      'meta.updated': 'Updated',
      'meta.publisher': 'Publisher',
      'meta.narrator': 'Narrator',
      'meta.words': 'Words',
      'meta.studio': 'Studio',
      'kind.drama': 'Short dramas',
      'kind.audio': 'Audiobooks',
      'rooms.heading': 'Open rooms',
      'rooms.none': 'No open rooms.',
      'room.tab.episodes': 'Episodes',
      'room.tab.about': 'About',
      'room.nextSeason': 'Next season: {title}',
      'room.state.playing': 'playing',
      'room.state.paused': 'paused',
      'library.refreshInfo': 'Refresh info',
      'follow.follow': 'Follow',
      'follow.following': 'Following',
      'follow.stop': 'Stop following',
      'follow.hint': 'Watch for its next season; a new one is added to the library by itself',
      'follow.season': 'season {n} of {total}',
      'follow.newEpisodes': '{n} new episodes',
      'follow.newSeason': 'new season',
      'follow.newSeasonOf': 'New season of {title}',
      'follow.news': 'New',
      'follow.dismiss': 'Got it',
      'rooms.emptySince': 'empty since {time}',
      'rooms.unopened': 'not opened yet',
      'rooms.join': 'Join',
      'rooms.watching': '{names} watching',
      'rooms.episode': 'Episode {n} of {total}',
      'rooms.preparing': 'preparing {n}',
      'rooms.openedBy': 'opened by {name}',
      'rooms.closeQuestion': 'Close this room?',
      'rooms.closeQuestionBusy': '{names} still in. Close?',
      'start.youtubePlaceholder': 'Paste a YouTube video or playlist link',
      'start.go': 'Start',
      'start.library': 'Library',
      'start.libraryEmpty': 'Nothing in the library yet. Find a show in Discover and save it, or ask the agent.',
      'start.failed': 'Could not start the room: {message}',
      'library.episode': '{n} episode',
      'library.episodes': '{n} episodes',
      'library.cachedOf': 'cached {n} of {total}',
      'library.offline': 'offline',
      'library.notCached': 'not cached',
      'library.episodeN': 'Episode {n}',
      'library.playFromFetch': 'Watch from this episode (it is fetched first)',
      'library.downloadAll': 'Download all (offline)',
      'library.stopOffline': 'Stop keeping offline',
      'library.downloadAllQuestion': '{n} more episodes, about {size}?',
      'library.downloading': 'downloading',
      'library.queued': 'waiting to download',
      'library.downloadFailed': 'download stopped: {message}',
      'library.inRoom': 'in a room',
      'library.deletesOn': 'Deletes on {date}',
      'library.deletesIn': 'deletes in {n} days',
      'library.deletesInDay': 'deletes tomorrow',
      'library.deletesSoon': 'deletes soon',
      'library.watchedAll': 'watched',
      'library.startCountdown': 'Delete in {n} days',
      'library.restartCountdown': 'Restart countdown ({n} days)',
      'library.kept': 'kept',
      'library.watchedCount': 'watched {n}/{total}',
      'library.continueFrom': 'continue from ep {n}',
      'library.continueFromAt': 'continue from ep {n} at {time}',
      'library.viewerStopped': '{name} stopped at ep {n}, {time}',
      'watch.watched': 'Watched',
      'watch.stoppedAt': 'Stopped at {time}',
      'library.watch': 'Watch',
      'library.continue': 'Continue',
      'library.more': 'More',
      'library.rename': 'Rename',
      'library.keep': 'Keep',
      'library.retry': 'Retry download',
      'library.stopDownload': 'Stop download',
      'library.inUseError': 'A room is playing this show. Close the room first.',
      'library.deleteQuestion': 'Delete it ({size})?',
      'library.deleteEpisodeQuestion': 'Delete?',
      'library.deleteEpisode': 'Delete {episode}',
      'library.episodesToggle': 'Episodes',
      'library.playFrom': 'Watch from this episode',
      'library.free': '{size} free',
      'action.cancel': 'Cancel',
      'action.delete': 'Delete',
      'action.save': 'Save',
      'room.back': 'Media',
      'time.locale': 'en-US',
      'room.copy': 'Copy link',
      'room.copied': 'Link copied',
      'room.close': 'Close room',
      'room.closeConfirm': 'Close for everyone?',
      'room.closed': 'This room was closed.',
      'room.episodes': 'Episodes',
      'room.connecting': 'Connecting…',
      'room.reconnecting': 'Reconnecting…',
      'room.episodeN': 'Episode {n}',
      'room.notCached': 'Not downloaded yet; it is fetched first when you pick it',
      'room.preparing': 'Preparing this episode…',
      'room.preparingProgress': 'Preparing this episode… {n}%',
      'room.failed': 'This episode could not be prepared.',
      'room.tapToJoin': 'Join playback',
      'room.tapToContinue': 'Tap to keep loading',
      'room.you': 'you',
      'room.viewers': 'Watching now',
      'room.waitingFor': 'Waiting for {names}…',
      'room.loading': 'Loading…',
      'room.wait.loading': 'loading',
      'room.wait.ready': 'ready',
      'room.wait.skipped': 'catching up',
      'room.startWithout': 'Start without {names}',
      'toast.play': '{name} pressed play',
      'toast.pause': '{name} paused at {time}',
      'toast.seek': '{name} jumped to {time}',
      'toast.select': '{name} switched to {episode}',
      'toast.ended': 'Next: {episode}',
      'toast.rate': '{name} set speed to {rate}×',
      'toast.joined': '{name} joined',
      'toast.left': '{name} left',
      'toast.skip': '{name} started without {names}',
      guest: 'Guest',
      agent: 'the agent',
    }
    const zh = {
      panel: '媒体',
      title: '媒体',
      note: '找剧、小说、电子书和论文。一起看的时候进度同步，书可以按想要的格式下载。',
      'source.all': '全部来源',
      'search.sourceFailed': '{source} 没有回应：{message}',
      'filter.label': '筛选',
      'filter.labelActive': '筛选（{n}）',
      'filter.any': '不限',
      'filter.language': '语言',
      'filter.format': '格式',
      'filter.yearFrom': '起始年份',
      'filter.yearTo': '截止年份',
      'filter.size': '大小',
      'filter.upTo': '不超过 {size}',
      'book.format': '格式',
      'book.download': '下载',
      'book.downloadAs': '下载 {format}',
      'book.fetching': '下载中…',
      'book.converting': '下载并转换中…',
      'book.converted': '转换',
      'book.onShelf': '已在书架',
      'book.save': '保存 {format}',
      'shelf.title': '我的书',
      'shelf.empty': '还没有书。在「发现」里找本书或小说下载吧。',
      'shelf.usedOf': '已用 {used}，共 {cap}',
      'shelf.removed': '为了省空间已删掉文件，随时可以再下载。',
      'shelf.again': '重新下载',
      'shelf.delete': '删除',
      'shelf.deleteQuestion': '从书架删除这本书？',
      'chat.ask': '问问',
      'chat.about': '聊聊这个',
      'chat.aboutBook': '关于这个：',
      'kind.novel': '小说',
      'kind.ebook': '电子书',
      'kind.paper': '论文',
      'tab.watching': '正在看',
      'tab.library': '片库',
      'tab.discover': '发现',
      'discover.source': '来源',
      'discover.kind': '分类',
      'discover.back': '返回',
      'discover.workFailed': '没能加载这部作品：{message}',
      'search.openWork': '打开这部作品',
      'search.more': '加载更多',
      'sort.label': '排序',
      'sort.default': '默认',
      'sort.plays': '播放量',
      'sort.newest': '最新',
      'search.inLibrary': '已在片库',
      'search.offline': '已离线',
      'search.joinRoom': '加入房间',
      'search.continueEp': '继续看 第{n}集',
      'search.continue': '继续看',
      'search.open': '打开',
      'source.link': '链接',
      'link.invalid': '这不是 YouTube 视频或播放列表链接。',
      'watching.continue': '继续看',
      'watching.emptyTitle': '现在没有人在看。',
      'watching.emptyHint': '从片库接着看，或者去发现新的。',
      'search.label': '搜索',
      'search.placeholder': '搜索{source}',
      'search.go': '搜索',
      'search.none': '没有找到。',
      'search.episodes': '{n} 集',
      'search.chapters': '{n} 章',
      'search.score': '★ {score}',
      'search.finished': '已完结',
      'search.ongoing': '连载中',
      'search.watch': '现在一起看',
      'search.save': '存进片库',
      'search.saveHint': '先存最前面的几集（{n} 集），看到哪下到哪',
      'search.saveAll': '全部下载（离线）',
      'search.saveAllHint': '把每一集都存在本地，离线也能看',
      'search.saveAllQuestion': '全部 {n} 集，大约 {size}？',
      'search.loading': '正在搜索…',
      'search.opening': '正在开房间…',
      'search.saving': '正在添加…',
      'search.saved': '已存入，前几集正在下载',
      'search.savedAll': '正在下载整部',
      'search.stopped': '已停更',
      'search.details': '详情',
      'search.hideDetails': '收起',
      'search.latest': '最新：{title}',
      'search.related': '其他季与相关作品',
      'search.relatedLoading': '正在找其他季…',
      'search.noRelated': '没有找到其他季或相关作品。',
      'relation.season': '其他季',
      'relation.same-title': '同名',
      'relation.related': '相关',
      'pop.plays': '{n}次播放',
      'pop.readers': '{n}人读过',
      'pop.listeners': '{n}人在听',
      'pop.viewers': '{n}人看过',
      'pop.followers': '{n}人关注',
      'pop.heat': '{n}热度',
      'meta.heat': '热度',
      'meta.followers': '关注',
      'meta.cast': '演员',
      'meta.duration': '时长',
      'meta.updated': '更新',
      'meta.publisher': '出品方',
      'meta.narrator': '主播',
      'meta.words': '字数',
      'meta.studio': '出品',
      'kind.drama': '短剧',
      'kind.audio': '有声书',
      'rooms.heading': '正在进行的房间',
      'rooms.none': '没有打开的房间。',
      'room.tab.episodes': '选集',
      'room.tab.about': '简介',
      'room.nextSeason': '下一季：{title}',
      'room.state.playing': '播放中',
      'room.state.paused': '已暂停',
      'library.refreshInfo': '刷新信息',
      'follow.follow': '追剧',
      'follow.following': '追剧中',
      'follow.stop': '取消追剧',
      'follow.hint': '关注它的下一季，新的一季会自动加进片库',
      'follow.season': '第 {n} 季，共 {total} 季',
      'follow.newEpisodes': '更新了 {n} 集',
      'follow.newSeason': '新一季上线',
      'follow.newSeasonOf': '{title} 新一季上线',
      'follow.news': '有更新',
      'follow.dismiss': '知道了',
      'rooms.emptySince': '{time} 起没人在看',
      'rooms.unopened': '还没人进来过',
      'rooms.join': '加入',
      'rooms.watching': '{names} 在看',
      'rooms.episode': '第 {n} 集，共 {total} 集',
      'rooms.preparing': '{n} 集准备中',
      'rooms.openedBy': '{name} 开的',
      'rooms.closeQuestion': '关闭这个房间？',
      'rooms.closeQuestionBusy': '{names} 还在里面，关闭？',
      'start.youtubePlaceholder': '粘贴 YouTube 视频或播放列表链接',
      'start.go': '开始',
      'start.library': '片库',
      'start.libraryEmpty': '片库还是空的。可以去「发现」找一部存进来，或者让智能体准备。',
      'start.failed': '没能开房间：{message}',
      'library.episode': '{n} 集',
      'library.episodes': '{n} 集',
      'library.cachedOf': '已缓存 {n}/{total} 集',
      'library.offline': '离线',
      'library.notCached': '未缓存',
      'library.episodeN': '第 {n} 集',
      'library.playFromFetch': '从这一集开始看（先下载它）',
      'library.downloadAll': '全部下载（离线）',
      'library.stopOffline': '不再离线保存',
      'library.downloadAllQuestion': '还有 {n} 集，大约 {size}？',
      'library.downloading': '下载中',
      'library.queued': '等待下载',
      'library.downloadFailed': '下载中断：{message}',
      'library.inRoom': '房间里正在放',
      'library.deletesOn': '{date} 删除',
      'library.deletesIn': '{n} 天后删除',
      'library.deletesInDay': '明天删除',
      'library.deletesSoon': '即将删除',
      'library.watchedAll': '已看完',
      'library.startCountdown': '{n} 天后删除',
      'library.restartCountdown': '重新计时（{n} 天）',
      'library.kept': '已保留',
      'library.watchedCount': '看过 {n}/{total}',
      'library.continueFrom': '从第 {n} 集继续',
      'library.continueFromAt': '从第 {n} 集 {time} 继续',
      'library.viewerStopped': '{name} 停在第 {n} 集 {time}',
      'watch.watched': '看过',
      'watch.stoppedAt': '停在 {time}',
      'library.watch': '观看',
      'library.continue': '继续看',
      'library.more': '更多',
      'library.rename': '重命名',
      'library.keep': '保留',
      'library.retry': '重新下载',
      'library.stopDownload': '停止下载',
      'library.inUseError': '有房间正在放这部，先关掉房间。',
      'library.deleteQuestion': '删除（{size}）？',
      'library.deleteEpisodeQuestion': '删除？',
      'library.deleteEpisode': '删除 {episode}',
      'library.episodesToggle': '剧集',
      'library.playFrom': '从这一集开始看',
      'library.free': '剩余 {size}',
      'action.cancel': '取消',
      'action.delete': '删除',
      'action.save': '保存',
      'room.back': '媒体',
      'time.locale': 'zh-CN',
      'room.copy': '复制链接',
      'room.copied': '链接已复制',
      'room.close': '关闭房间',
      'room.closeConfirm': '为所有人关闭？',
      'room.closed': '这个房间已经关闭了。',
      'room.episodes': '剧集',
      'room.connecting': '正在连接…',
      'room.reconnecting': '正在重新连接…',
      'room.episodeN': '第 {n} 集',
      'room.notCached': '还没下载，选它时会先下载',
      'room.preparing': '正在准备这一集…',
      'room.preparingProgress': '正在准备这一集… {n}%',
      'room.failed': '这一集没能准备好。',
      'room.tapToJoin': '加入播放',
      'room.tapToContinue': '点一下继续加载',
      'room.you': '你',
      'room.viewers': '正在看的人',
      'room.waitingFor': '正在等 {names}…',
      'room.loading': '正在加载…',
      'room.wait.loading': '加载中',
      'room.wait.ready': '准备好了',
      'room.wait.skipped': '随后跟上',
      'room.startWithout': '不等 {names}，先开始',
      'toast.play': '{name} 开始播放',
      'toast.pause': '{name} 暂停在 {time}',
      'toast.seek': '{name} 跳到了 {time}',
      'toast.select': '{name} 切到了 {episode}',
      'toast.ended': '下一集：{episode}',
      'toast.rate': '{name} 把速度调成 {rate}×',
      'toast.joined': '{name} 来了',
      'toast.left': '{name} 离开了',
      'toast.skip': '{name} 没等 {names} 先开始了',
      guest: '访客',
      agent: '智能体',
    }

    function SidebarIcon({ size }) {
      const stroke = { stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round' }
      return h('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true, focusable: 'false' },
        h('rect', { x: 1.75, y: 2.75, width: 12.5, height: 8.5, rx: 1.5, ...stroke }),
        h('path', { d: 'M6.9 5.3v3.4L9.7 7 6.9 5.3Z', fill: 'currentColor' }),
        h('path', { d: 'M4.5 13.6c1 .5 2.2.8 3.5.8s2.5-.3 3.5-.8', ...stroke }))
    }

    /** Set in apply: opens a new conversation with an editable draft, through the Web UI's workspace service. */
    let startChat = null
    /** The `label` setting once the Host answered: a string, or one per language; empty means the default name in the viewer's language. */
    let customLabel = ''
    /** DSH's locale store (set in apply), so the page renders again when the viewer switches language. */
    let localeStore = null
    const activeLanguage = () => localeStore?.getSnapshot().active ?? 'en'
    const labelFor = (language) => {
      if (typeof customLabel === 'string') return customLabel
      return customLabel[language] ?? customLabel[language.split('-')[0]] ?? ''
    }
    // Called through the store, never detached: its methods read their own `this`.
    const subscribeLocale = (listener) => localeStore ? localeStore.subscribe(listener) : () => {}

    /** The page's modules, loaded once and handed this page's React. */
    let pageModule
    const loadPage = () => {
      pageModule ??= Promise.all([import(web('ui.js')), import(web('page.js'))]).then(([ui, page]) => {
        ui.init(React)
        ui.setChat(startChat)
        return page
      })
      return pageModule
    }

    /** A room asked for by the page's URL (?media-room=<id> or ?videosync=<id>), taken once. */
    let linkedRoom = null
    const takeLinkedRoom = () => {
      const params = new URLSearchParams(location.search)
      const param = LINK_PARAMS.find(name => params.get(name) !== null)
      if (param === undefined) return
      linkedRoom = params.get(param)
      params.delete(param)
      const query = params.toString()
      history.replaceState(history.state, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`)
    }

    function MediaHubPage({ translate }) {
      const language = React.useSyncExternalStore(subscribeLocale, activeLanguage)
      // A new function per language, so every view that keeps text derived from `t` builds it again.
      const t = React.useMemo(() => (...args) => translate(...args), [translate, language])
      const [initialRoom] = useState(() => {
        const id = linkedRoom
        linkedRoom = null
        return id
      })
      const [page, setPage] = useState(null)
      const [error, setError] = useState(null)
      useEffect(() => {
        let live = true
        loadPage().then(module => { if (live) setPage(module) }, (reason) => {
          pageModule = undefined
          if (live) setError(reason.message)
        })
        return () => { live = false }
      }, [])
      return h('div', { className: 'vsync-page' },
        page !== null && h(page.Page, { t, initialRoom }),
        error && h('p', { className: 'vsync-error', role: 'alert', style: { padding: 24 } }, error))
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => {
          const disposers = [ctx.locale.register(NS, 'en', en), ctx.locale.register(NS, 'zh', zh)]
          return () => { for (const dispose of disposers) dispose() }
        }, 'media-hub: dictionaries')
        const t = ctx.locale.bind(NS)
        localeStore = ctx.locale
        startChat = (prompt) => {
          const workspace = ctx.get('uiWorkspace')
          if (workspace === undefined) return undefined
          return workspace.startSession(undefined, { prompt, whenDraftExists: 'replace' })
        }
        fetch(new URL('media-hub/api/settings', document.baseURI)).then(r => (r.ok ? r.json() : null)).then((settings) => {
          const label = settings?.label
          if (typeof label === 'string') customLabel = label.trim()
          else if (label !== null && typeof label === 'object') customLabel = label
        }, () => {})

        ctx.effect(() => {
          if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return () => {}
          const tag = document.createElement('link')
          tag.id = STYLE_ID
          tag.rel = 'stylesheet'
          tag.href = web('panel.css')
          tag.dataset.plugin = '@soffits/dsh-media-hub'
          document.head.appendChild(tag)
          return () => tag.remove()
        }, 'media-hub: styles')

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL,
          locale: NS,
          inject: () => ({ translate: t }),
        }, MediaHubPage))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL,
          order: 12,
          locale: NS,
          label: () => labelFor(activeLanguage()) || t('panel'),
        }, SidebarIcon))

        // A link to a room, or to a tab, opens this panel once it is registered.
        ctx.effect(() => {
          takeLinkedRoom()
          let timer
          let live = true
          const open = () => {
            let tries = 0
            timer = setInterval(() => {
              const layout = ctx.get('layout')
              try {
                layout?.selectPanel(PANEL)
                if (layout) clearInterval(timer)
              } catch {
                // The main slot entry is not registered yet.
              }
              if (++tries > 50) clearInterval(timer)
            }, 100)
          }
          if (linkedRoom !== null) open()
          else import(web('nav.js')).then(({ hasNavParams }) => { if (live && hasNavParams(location.search)) open() }, () => {})
          return () => { live = false; clearInterval(timer) }
        }, 'media-hub: room link')
      },
    }
  },
})
