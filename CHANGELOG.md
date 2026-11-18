# Changelog

## 0.12.0

- A show and a book look the same in the Library. Every item is one card: the same cover slot, a title with its type, one line of facts (a show's rating, status and progress; a book's author, format and size), tags, and the actions in the same place, with Delete under the … menu for books as it is for shows.

## 0.11.1

- The page's words come from the language files each time it asks, not from a copy made when the plugin started. An update that only changed words (0.11.0's type badges) showed raw keys until DSH restarted.

## 0.11.0

- Library is one list. The shows and the books you downloaded (My books) used to sit in two sections; they are now cards in the same list, each marked Show, Video, Audio or Book, and every card has a background. The top line counts both: the library's size, how much of the books' room you used, and what is free.

## 0.10.2

- hls.js now loads. The page asked for it at the wrong address, so a browser that needed it (any Chromium one, since 0.10.1) never got past loading. Episodes that are still being made play there again.

## 0.10.1

- Replaying an episode that has to be transcoded now plays in Chrome, Brave and Edge. Their own HLS player can't take an episode that's still being made and stopped with "could not parse"; the page now uses hls.js there. Safari and iPhone keep their own player.

## 0.10.0

- Discover shows something before you search. Under the picked source and category it lists what the source itself puts forward (a source's rank lists and new arrivals, from the new optional `trending` verb of [docs/source-protocol.md](docs/source-protocol.md), asked for the kinds configured with `"trending": true`) and, when a `recommender` is set, *For you*: picks with the reason for each, narrowed to the source and category (the recommender now also gets `--source`, `--kind` and `--language`). Under *All sources* the picks are interleaved and each source's lists stay under its name. Link has neither.
- Both are dated local copies, rendered at once and asked again in the background when someone looks and the copy is about a day old (a failing source is left alone for an hour, the old copy stays), so the page never waits on a site. The Watching tab's picks use the same copies instead of waiting for the recommender.
- The default sources declare trending for Fanqie's dramas, audiobooks and novels and for bookfetch's ebooks. A source whose command lacks the verb just shows no lists.


## 0.9.0

- Points extras (`points` setting, [docs/points-protocol.md](docs/points-protocol.md)): with a points extension, the people it plays with pay points for starting a series that is new to the hub and for a binge night (starting to watch late at night, one ticket for the whole night). The page shows the price and their balance at that moment and buys on *Buy*; going on with a series, later seasons, films, single videos and rooms already playing stay free. Without an extension, or for anyone it doesn't play with, nothing changes.

## 0.8.0

- The page no longer polls. The plugin tells open pages when something they show changes (a watch-state write, a refreshed copy of a show's details, a download landing or progressing, a room opening, closing or changing, a book on the shelf), over a Server-Sent Events stream, and the page re-reads then, and once whenever the stream connects or reconnects. Before, the library and rooms were re-read every 4 seconds and the shelf every 2 seconds while a book was fetching.

## 0.7.1

- Opening the page no longer waits on the sources. Each show's details (title, blurb, score, related works, episode titles, cover) come from the copy saved with it, at once, as before 0.7.0. A copy that is missing (a show just added) or about a day old is refreshed from its source in the background, a couple of requests at a time and never for a source that just failed, and the new details show on the next look. A copy over a week old says when it was saved.
- The "Refresh info" menu item and the quiet backfill of details are gone; the background refresh replaces both.

## 0.6.2

- The page's tabs line up again: the selected tab no longer runs into the next one, and Discover's sort buttons keep their own width.

## 0.6.1

- A film, one video or a single link no longer talks about episodes. It gets no episode list, strip or "Episode 1 of 1", and its buttons say *Play*, *Continue at 12:34* or *Join Ana*, in the Continue card, Discover, the library, the room's side panel and the watch log the tool reads. Episode words show from two episodes on.
- "Preparing…" and "could not be prepared" no longer say "this episode".

## 0.6.0

- A new Watching tab. At the top, a card for the show someone is in now, or the one you watched last, over its blurred cover: who is in the room, the title, where it stands, a strip of its episodes (watched, now, on disk), and *Join … · episode n*, or *Continue* alone (still the default) with *Watch together* beside it, the room's link and *Ask*. Below it, news from followed works, the shared rooms as cards, and the other shows you started.
- Optional parts, each switched in the new `presence` setting and off by default: *So far*, a recap without spoilers kept with a show and shown only to viewers past what it covers; *How was it?*, asked once about a show finished or removed in the last two weeks, where one tap writes a `rating` line into the watch log, per person; and *Picks*, works a recommender extension suggests, each with its reason, to watch together or follow (the new `recommender` setting and docs/recommender-protocol.md).
- The tool's new `annotate` action keeps a recap or up to three suggested next steps with a library show; the steps show on the Continue card through @soffits/dsh-ui-actions, and starting one is written to the watch log.
- *Continue* from the page goes on where you stopped. Since 0.5 a room opened from the page started at the first episode, because the person's route never passed on that it was a library show.
- The page is built from DSH's own components (tabs, buttons, tags, state dots, icons) and @soffits/dsh-ui-kit (cards, the episode strip, tiles, times, suggested steps), with buttons 40 px tall on touch screens.

## 0.5.1

- Going back to an episode the cache already deleted, or jumping far ahead, no longer stays on loading. The episode you're on is now prepared at once, beside anything else; before, every episode that landed waited its turn in one line, so with sources that need a transcode (HEVC short dramas) the one you picked sat behind a dozen others. The next few episodes after yours are prepared one at a time, nearest first, and nothing outside that window is touched.
- Leaving an episode stops work on it unless it's one of the next few: its download, its transcode and its play-while-downloading copy. A copy cut off by a restart is made again instead of being offered half done.
- An episode whose download is already under way plays while it downloads as soon as a room comes to it, not only when someone was on it when the download started.

## 0.5.0

- Captions in the right language, for every source. The player starts the track in your language, else one in the video's own language that no machine translated, else none, and never a machine translation into a third language. The captions menu names each track in its own language (日本語, English) and marks machine-made ones *auto*. Link fetches every track a person made, plus machine-made ones only in your language and the video's own; a site's own codes that name no language (`ai-zh`) are left out. Local files follow the same rule by their file names (`ep1.zh.srt`), and text tracks inside a file go by their language.
- An episode plays while it downloads. Link fetches the video and the audio side by side and serves them as HLS once a few seconds are in, so a room starts in seconds instead of after the whole download and merge; the room keeps playing that copy when the file lands. Videos that have to be transcoded (local files, sources) start the same way, after their first seconds. A source's command can hand over files it is still writing with the new optional `partial` event (docs/source-protocol.md).
- One progress for the whole episode: the video and the audio are counted together from the start, with one size, speed and time left (estimated from the bitrate where a site announces no size), instead of the bar running once for the video and again for the audio.
- Watching starts alone. *Watch* (and continuing a show) opens a room only you are in, with the same progress, watch log, resume and rating as before; *Watch together* in the player opens that room to others where it stands and copies its link. Only rooms opened to others are listed. Rooms the assistant opens are shared from the start.
- Link looks each episode up when it fetches it, so a playlist's videos get their captions too, and episode file names are made by the hub (number, then title).

## 0.4.1

- A Link lookup of a long video with many generated subtitles no longer fails with "the page lists too much to read": the lookup asks yt-dlp for subtitle lists without the generated translations, which grew its answer past 25 MB.

## 0.4.0

- `cookies`: signed-in accounts for sites, by host, like `proxies` (`{ hosts, hostsFile, accounts }` rules). Each account is a Netscape cookies file with an optional User-Agent, belonging to a person (their sign-in id) or to everyone as the default, and optionally shared. A lookup or download uses the account of the person asking, else the default, else a shared one; a room uses the account of whoever opened it, for everyone in it. The Link card says which account a site is read with, and its qualities are what that account gets. yt-dlp reads a private copy of the cookies for each run, so the hub never changes the session it borrows, and cookie values are never logged or shown.
- Looking up and fetching a work and opening a room moved under DSH's `/api` (`/api/media-hub/info`, `/fetch`, `/rooms`), where the sign-in plugin says who is asking. `POST /media-hub/api/rooms`, `GET /media-hub/api/info` and `POST /media-hub/api/fetch` are gone.
- Errors say what happened in the viewer's language: a site that refused the request, one that wants a signed-in account, nothing at that address, or a proxy that isn't answering. yt-dlp's own output goes to the server log. A failed source is now HTTP 424 instead of 502, which proxies in front of DSH (Cloudflare among them) replaced with a page of their own, so the page only ever saw "HTTP 502". A response without the hub's JSON shows a sentence with its status instead of a bare code.
- Link fetches subtitles with each episode: every language the video has subtitles in, plus generated ones in your language and the video's own when nothing covers them, converted to WebVTT. The player offers them in its captions menu by language name and turns on the one in your language. Subtitles of a show from any source now reach the room (they were dropped before), and go with their episode when it is deleted.
- A room waiting on a download shows real progress, live for everyone in it: percent, size, speed and time left while yt-dlp fetches (video and audio counted together), then the preparing step, with a bar.

## 0.3.0

- Link reads any video or playlist page yt-dlp reads (YouTube, Vimeo, Bilibili and over a thousand more sites): it shows as one work with its thumbnail, length, uploader and episodes (a playlist's videos), and plays like a show from a source, downloaded through the rolling cache and served by DSH to every viewer. A quality picker on the card (*Auto*, a height, *Audio only*) sets yt-dlp's format choice; the show keeps it. Following a playlist adds its new videos as episodes.
- **Breaking:** YouTube no longer plays in an embedded player; it is one yt-dlp site like the others, so a room on it syncs as finely as a local file, works for viewers who can't reach YouTube, and is not split by ads. The assistant's tool (`videosync`) `start` takes `source: link` with `url` (and `quality`) instead of `source: youtube` with `urls`. Rooms lose their `source` field, and the watch log's `room.opened` lines no longer carry one.
- `proxies`: which proxy each request the hub makes itself takes, by host (`{ url, hosts, hostsFile }` rules, first match wins, others direct). Every yt-dlp call takes the rule of its page's host, a thumbnail the rule of its own host or its page's. A hosts file is read again when it changes; while it can't be read, or the proxy is down, the request fails instead of going direct. No site or country is named in the code.
- Pictures for everything through one pipeline and one cache (`coverCacheMb`): a source's cover through the source's command, a link's thumbnail through `proxies`, a still of the video for local files, shows without a cover and room previews. The page tries each picture in turn and shows a placeholder only when none exists. The `thumbs` route and folder are gone; `<stateDir>/thumbs` from earlier versions can be deleted.
- Source protocol: results and `info` may carry `url` (the work's page) and `duration` (seconds). A result's running time shows at a glance.
- *Ask* opens a conversation with the show or book attached to the message box as a card, through [@soffits/dsh-ui-actions](https://github.com/soffits/dsh-ui-actions) (install it as a plugin too; without it there is no *Ask*). The person writes beside the card, the sent message shows it with the hub's icon and name, and the agent gets the item as a short quote with its source and id instead of a block of Markdown and JSON.
- Languages: the page's words moved to `locale/<tag>.json`, one file per language, and the page now ships in French as well as English and Chinese. A language is added by adding its file; nothing in the code names a language. The sidebar `label` and source and kind labels take a string or `{ "<tag>": "text" }` (exact tag, then primary subtag, then English). The default sources' names come from the locale files (番茄 and 图书 in Chinese, Livres in French).
- Counts, sizes, dates, plural forms and language names are written by `Intl` for the viewer's language (sizes read "565 ko" in French; "1 episode" and "0 épisode" are right).
- The book language filter offers your language, the one picked and the languages in the results, instead of a fixed list.
- Phones: compact cards with a small fixed cover, the title and one info line beside it, and no gap under the cover; *Ask* is an icon in the card's corner; the search button stays beside the field; book filters fold behind a *Filters* button that shows how many are set; touch controls are at least 40 px. Wider screens: covers fill the card's height.

## 0.2.0

- Renamed from Video Sync to the media hub (`@soffits/dsh-media-hub`, repository soffits/dsh-media-hub). The page is *Media* in the sidebar (`label` renames it); routes moved from `/videosync` to `/media-hub`; room links are `?media-room=<id>`, and old `?videosync=<id>` links still open; an existing `$DSH_HOME/videosync` folder keeps being used. The agent tool keeps its name, `videosync`.
- Books: kinds have a `media` (`video`, `audio`, `book`). Book searches have filters (language, format, years, size) and cards with cover, author, year, language, origin and formats with sizes; *Download* fetches the file in the chosen format onto your shelf, *Save* hands it to the device with its proper type and name. Formats a source lacks are converted with Calibre's `ebook-convert` when it is installed (`converter`).
- My books: a shelf per signed-in person (through a `requestIdentity` provider; one shared shelf without one), with save, download again and delete; files kept under `bookCacheGb`.
- Discover searches *All sources* at once; a source that fails is named while the others still answer.
- *Ask* on every result and book opens a new conversation with a draft about it.
- Source protocol: `filters` (`--language`, `--format`, `--year-from`, `--year-to`), book fields (`formats`, `bytes`, `year`, `language`, `publisher`, `origin`) and `download --format` for one file. Default sources: fanqie (now with novels) and `bookfetch source`.

- iPhone: an episode change no longer leaves Safari on iOS stuck at "Loading…". A viewer counts as ready once the player can play (not only with 3 s buffered, which iOS never fetches while paused); a player that loads nothing while paused is started muted for a moment to make it load; after 8 s the viewer gets a "Tap to keep loading" button. Safari keeps one video element instead of preloading the next episode in a second one, which it would not let play with sound.
- Discover can sort the results it has (default order, most played, newest: each offered only when the results can be told apart by it) and load more: a source that has more pages says so (`next` in its search answer, `--offset` to ask for it, see docs/source-protocol.md) and a *Load more* button appends the next page, never repeating a work.
- Phone layout: on narrow screens the page description goes, the tabs stay at the top, library rows say the short thing first (score, status, how far you are) and the on-disk details muted below, and cards stack with a full-width action row; Discover's pickers, search and result actions fit the width (checked at 360 px). Details is a plain accent link.
- The plugin loads from a built `dist/` with its packages bundled in, so DSH imports it at boot without resolving any package (a link-installed copy failed to start with "Cannot find package 'ws'" after some restarts).
- Follow (追剧): a Follow button on a work (Discover, a library row's menu, a room's About tab). Following a work not in the library adds it as an empty show. Once a day per followed show (jittered, one at a time with a pause, through the source's command) and once when someone opens it, the host asks the source about it: a new season among the related works is added to the library as an empty show next to the earlier seasons and followed in turn; more episodes extend the season in progress. News shows in a "New" section of Watching (with a count on the tab), as chips on library rows, and in the watch log; `notifyCommand` (off by default) is run with a line of JSON on its standard input.
- Smoother automatic advance: the next episode loads in the background (at once for an episode under two minutes, else in the last 30 s) and is swapped in when the room moves on, so the switch passes the ready gate without a wait.
- A show from a source keeps its work's details in its notes (cover, title, score, popularity, episodes, status, tags, blurb, every `meta` field, related works one level deep, episode titles), taken when it is saved or watched. Library rows show the source's cover, score, status and tags, with the same Details as Discover (related works open in Discover); *Refresh info* in the row's menu asks the source again. Shows saved before this get their details once, in the background, one request at a time with a pause (`library` never repeats it by itself after a failure; use Refresh info). Episodes carry the source's titles.
- A room has two tabs beside the player: *Episodes* and *About* (the show's details; a related work opens in Discover in a new tab, so the room is never left by accident). The header shows the cover; at the bottom of the episode list the next season is offered with *Watch together now*.
- Rooms in Watching show a preview (a frame of the episode now playing, or the show's cover), who is in as overlapping avatars, and a progress bar. Viewers in a room are avatars too (picture when the sign-in plugin gives one for you, else initials), the stack opens a list with each person's state.
- The page has three tabs. *Watching* (the default) lists the open rooms with who is in and the episode, and the library shows someone started to continue, most recently watched first. *Library* is the library manager. *Discover* is search: first a source picker (every configured source, then *Link* for pasting a YouTube address), under it that source's own categories, then the search box. The tab, source and category are in the URL (`vs-tab`, `vs-source`, `vs-kind`), so a refresh, the back button and a link keep them; the last source and category are remembered per browser. Room links work as before. A work opened from another's related list is a focused view in Discover (with a Back control, its place in the URL as `vs-work`); related works are plain rows, so Details never nest inside Details.
- Ready gate: on opening a room, an episode change (including an episode still downloading) and a seek, the room waits until every viewer present can play a few seconds ahead, shows a waiting room with each viewer loading or ready, and starts everyone at one server time slightly ahead. After 10 s anyone may start without the viewers still loading. A viewer stalling mid-play for over a second pauses everyone ("Waiting for <name>") until they're ready again; stalls right after a start, or from a viewer just left out, are ignored. Someone leaving is no longer waited for; a room everybody left, or one reloaded after a restart, waits for its viewers again.
- Rooms with synced play, pause, seek, speed and episodes; server-timestamped state, clock-offset correction and drift correction by rate or seek; buffering holds the room briefly.
- Local files and episode folders, prepared for browsers (fast-start MP4, transcoding when needed), with subtitles converted to WebVTT.
- YouTube videos and playlists through the embed's own messaging, without YouTube's script in the DSH page.
- Video Sync page in the Web UI: open rooms, start a room from a YouTube link or the library, the player with episodes, viewers and who-did-what notices.
- `videosync` agent tool: start, list and close rooms.
- Rooms close by themselves 30 minutes after the last viewer leaves, or a day after creation when nobody opened them; the list shows who is watching or since when a room is empty.
- Library manager: posters, episodes, sizes, total and free space; delete a show or an episode, rename, keep; shows watched to the end are deleted after `autoDeleteDays` (7) unless kept; open rooms block deleting their show.
- Search with sources: each source is a configured command that speaks a small JSON protocol (`docs/source-protocol.md`; the `sources` setting, with a `fanqie` entry for short dramas and audiobooks by default); "Watch together now" opens a room with episode 1 and adds the rest as they download; "Save to library" downloads in the background.
- Watch log (`watch-log.jsonl`): rooms, viewers, episodes started and finished, where each viewer stopped. Library shows continue where they stopped. The tool gains `history`, `library` and `start` from a source's work id.
- Rolling cache for shows from a source: every episode is listed, only the one being watched, the next five (`cacheAhead`) and one behind (`cacheBehind`) are on disk; watched episodes fall out and are deleted, a jump to an uncached episode fetches it first, and `cacheLimitGb` (5) caps the total, least recently watched first. *Watch together now* opens the room at once. *Download all (offline)* keeps a whole show, never trimmed. The library says "cached N of M".
- The search box shows a loading state, drops answers older than the latest click and ignores a repeated click; Watch and Save buttons can't be pressed twice.
- Audio-only episodes (audiobook chapters) play in rooms.
- Search results are cards with cover, score, popularity (formatted per language), episodes, status and tags, and a Details view with every field the source gives and its related works and other seasons. Sources can send `cover`, `popularity`, `episode_count`, `status`, `tags`, `latest`, `meta` and (from `info`) `related`, and an optional `cover` verb; covers are fetched by the source's command, cached under `<stateDir>/covers` (`coverCacheMb`) and served on an authenticated route, never by the browser.
- Room list: copy the link or close a room from the list.
