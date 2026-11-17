# Media hub for DeepSeek Harness

One page in the DSH Web UI for shows, novels, ebooks and papers. Search every source at once, watch a show together from different places with play, pause, seeking and episodes in sync, and download a book in the format you want (epub, txt, pdf...) onto your own shelf.

This plugin was called Video Sync (`@soffits/dsh-video-sync`) until 0.2.0; the repository moved from soffits/dsh-video-sync, and room links made under the old name still open. It is not related to the npm package `dsh-media-hub`, which embeds a different self-hosted app.

- **Books**: a book category (ebooks, novels, papers) gets filters for language, format, years and size. A result shows its cover, author, year, language, where the file comes from and the formats with their sizes; pick one and *Download* puts it on your shelf, then *Save* hands it to the device (Safari on iPhone offers Apple Books for an epub). With Calibre's `ebook-convert` installed, a format the source doesn't have is converted from the best one it has. **My books** in the Library tab lists what you downloaded: save again, download again, delete. Each person signed in has their own shelf when a sign-in plugin provides the `requestIdentity` service (dsh-oidc does); without one everyone shares one shelf. Files are shared between shelves and kept under `bookCacheGb`; past it the least recently used go and stay on the shelf to fetch again.
- **Chat about it**: every result and book has an *Ask* button that opens a new conversation with a draft quoting it, for you to finish and send.

- **Local files**: one video or a folder of episodes (numbered files play in natural order). Videos browsers can't play or seek well are remuxed or transcoded once and cached. Subtitles next to a video (`.srt`, `.ass`, `.vtt`, also `name.zh.srt`) and text subtitle tracks inside MKV files show up in the player; Chinese, Japanese and Korean legacy encodings are detected.
- **YouTube**: a video, several videos as episodes, or a playlist. Each viewer streams from YouTube in an embedded player.
- **Sync**: the room's state lives on the server with server timestamps; each browser corrects its own clock offset and drift (under 0.3 s ignored, 0.3–2 s caught up by playing 5 % faster or slower, more than 2 s by a seek). Opening a room, switching episode and seeking go through a waiting room, as in Plex: playback holds until every viewer can play a few seconds ahead, each listed as loading or ready, then everyone starts at the same instant; after 10 s anyone may start without the ones still loading. When someone's player stalls mid-episode, everyone pauses with "Waiting for <name>" and resumes together. A dropped connection doesn't stop playback; the player resyncs when it's back.
- **Library**: shows (a folder of episodes, or one file) in `<stateDir>/library` and any `libraryRoots`, with a poster frame, episodes, size, the total and the free space on the disk. Delete a show or one episode, rename a show, keep it. Watched episodes are marked in the library and in the room; a show watched to the end (its last episode, or every episode) is deleted `autoDeleteDays` later unless someone keeps it, and the list says when. A show an open room plays can't be deleted or renamed. Opening a show again continues where its viewers stopped.
- **Sources**: one search box over *All sources* or one of them; each source is a configured command line tool that speaks a small JSON protocol ([docs/source-protocol.md](docs/source-protocol.md), the hub's public interface for extensions, see [docs/extensions.md](docs/extensions.md)) and brings its kinds. The defaults are `fanqie` (short dramas, audiobooks, novels) and `bookfetch source` (ebooks and papers); every request runs through the source's command, so any proxy its launcher enforces holds, and a wrapper for another site is one more entry. *Watch together now* opens the room at once; *Save to library* adds the show; *Download all (offline)* keeps every episode on disk. Sources implement one small interface (`src/sources/index.js`).
- **Search results as cards**: cover, title, score, how many watched it ("36.7万次播放" or "36.7K plays", by the page language), episodes, whether it is finished, tags; *Details* shows everything the source gives (cast, heat, last update…) and the other seasons and linked works. Covers are fetched by the host through the source's command (so a proxy keeps applying), cached under `<stateDir>/covers` and served to signed-in browsers; a browser never contacts the site's CDN.
- **Details kept with a show**: a show from a source keeps what the source said about its work (cover, score, popularity, tags, blurb, other fields, related works, episode titles), so the library, a room's *About* tab and the episode list show it without asking the source; *Refresh info* asks again by hand.
- **Follow**: a followed work is checked about once a day through its source (and when someone opens it). A new season is added to the library as an empty show, grouped with the earlier ones and followed too, and shows under *New* in Watching and in the watch log; more episodes extend the show. With `notifyCommand` set, that command gets one line of JSON on its standard input for each piece of news.
- **Rolling cache**: a show from a source lists every episode, but only a window is on disk: the episode people are on is fetched first, then the next few (`cacheAhead`, 5), and `cacheBehind` (1) watched ones stay. Watched episodes that fall out of the window are deleted (the watch log still marks them watched). Jumping to an episode that is not cached fetches it first (the room shows it as preparing), then refills the window around it. A show kept offline (*Download all (offline)*, or the library menu) is never trimmed. All cached episodes of other shows together stay under `cacheLimitGb` (5 GB): past it the least recently watched go first, never one near an open room. The library says *cached N of M* (and *offline*), and the episode list marks the ones not on disk.
- **Watch log**: `<stateDir>/watch-log.jsonl`, one JSON object per line: rooms opened and closed, viewers joining and leaving, episodes started and finished, and where each viewer stopped (`position` lines when someone leaves, the episode changes, the room closes, and every two minutes while playing).
- **Access**: only browsers signed in to DSH reach the rooms, the media and the sync channel. Names come from the sign-in plugin (dsh-oidc) when there is one.

## Install

```sh
dsh plugin --profile web add github:soffits/dsh-media-hub
```

The bundle adds two rows: `media-hub` (the page, shelves, rooms, media) and `media-hub-tools` (the agent's `videosync` tool for rooms). Needs `ffmpeg`/`ffprobe` on the PATH for local media, `yt-dlp` for YouTube playlists, the commands of the sources you use (`fanqie` from fanqie-cli, `bookfetch` from [bookfetch-cli](https://github.com/soffits/bookfetch-cli); a source is hidden without its command), and optionally Calibre's `ebook-convert` for format conversion. Coming from Video Sync: replace the `@soffits/dsh-video-sync` package with this one; an existing `$DSH_HOME/videosync` folder keeps being used. A source's command runs in `<stateDir>/<source id>`, so nothing it writes into its working folder lands in DSH's.

## Use

- **From the page**: open **Media** in the sidebar (the `label` setting renames it). Three tabs: **Watching** (the default) lists the open rooms for everyone with who is in them and the episode, with copying a room's link or closing it, and the shows someone started, to continue; **Library** manages the shows and starts or continues one; **Discover** searches: pick a source (*All sources*, every configured one, or *Link* to paste a YouTube video or playlist), then one of that source's categories, then search. The tab, source and category are in the page's URL (`?vs-tab=library`, `?vs-tab=discover&vs-source=<id>&vs-kind=<id>`), so a refresh and the back button keep them and a link can open a tab directly; the last source and category are remembered per browser.
- **From the agent**: `videosync` with `action: start` and `source: local` plus `path`, `source: youtube` plus `urls`, or `source: <source id>` plus `id` (and `offline: true` to keep every episode), returns a link to send. `list` and `close` manage rooms, `library` lists the shows, `history` summarises the watch log (shows, episodes finished, where each viewer stopped, with whom, when).

A room link looks like `https://dsh.example.com/?media-room=<room>` (DSH's advertised URL, `--public-url` when set) and opens the panel on that room.

## Configuration

| Field | Default | |
|---|---|---|
| `label` | empty | Name of the sidebar entry; empty shows *Media* in the viewer's language. |
| `libraryRoots` | `[]` | More folders the panel may start rooms from. |
| `delivery` | `origin` | `origin` serves media from DSH's own web server. `r2` (object storage with signed links) is reserved and not built yet. |
| `stateDir` | `$DSH_HOME/media-hub` (or an existing `$DSH_HOME/videosync`) | Open rooms, the default library folder (downloads go there), shelves and book files (`books/`), prepared media, posters, the watch log and library notes. |
| `maxHeight` | `1080` | Taller videos are transcoded to this height. |
| `threads` | `2` | ffmpeg threads; jobs run one at a time at low priority. |
| `emptyMinutes` | `30` | A room closes this long after its last viewer left. |
| `unopenedHours` | `24` | A room nobody opened yet closes this long after it was created. |
| `cacheDays` | `7` | Prepared media no room uses is deleted after this long. |
| `autoDeleteDays` | `7` | A show is deleted this long after it was watched to the end, unless kept. `0` keeps everything. |
| `cacheAhead` | `5` | Rolling cache: episodes kept after the one being watched. |
| `cacheBehind` | `1` | Rolling cache: watched episodes kept before it; older watched ones are deleted. |
| `cacheLimitGb` | `5` | Rolling cache: most disk (GB) cached episodes of shows from a source may use, the prepared copies included. Kept-offline shows don't count. `0` is no limit. |
| `notifyCommand` | `[]` | A command (program and fixed arguments) run with one line of JSON on stdin when a followed work gets a new season or new episodes. Empty runs nothing. |
| `coverCacheMb` | `50` | Most disk (MB) search result covers may use. They are fetched through the source's `cover` command, never by the browser, and the least recently shown are dropped past this. `0` is no limit. |
| `bookCacheGb` | `5` | Most disk (GB) downloaded books may use; past it the least recently used files go and stay on their shelves to fetch again. `0` is no limit. |
| `converter` | `ebook-convert` | Calibre's converter; when installed, books can be downloaded in formats their source lacks. Empty turns conversion off. |
| `sources` | `fanqie`, `bookfetch` | The sources: a list of `{ id, label, kinds: [{ id, label, media }], filters, command: [program, ...fixed arguments], env }`; `label` is the source's name in Discover's picker and each kind's `label` its category (set them in the language you want to see; the page translates only the kinds it has words for); `media` is `video`, `audio` or `book`; `filters` lists the search filters the command understands (`language`, `format`, `year`). The list replaces the default, so keep the default entries when adding one; an empty list turns sources off. See [docs/source-protocol.md](docs/source-protocol.md). |

The tools row takes `agentName` (shown as who opened the agent's rooms) and `waitSeconds` (how long `start` waits for the first episode to be ready).

## Development

`npm test` runs the unit tests (ffmpeg tests skip without ffmpeg). `npm run test:browsers` boots a throwaway DSH home with this checkout linked in and drives two Chromium contexts through a room: play, pause, seek, rate-based and seek-based drift correction, an episode switch and a reconnect; then the tabs with their state in the URL, the source and category pickers, a search through a stand-in source command, *Watch together now* with the room growing as episodes arrive, the watch log, watched marks, and deleting an episode and a show from the library.

## License

MIT
