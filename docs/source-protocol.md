# Source protocol

A source is a command line tool. The media hub knows nothing about the site behind it: it runs the command from the `sources` setting with a few verbs and reads JSON back. Anything that can do that is a source, for instance a site's own app API or a book catalogue. (Video and playlist pages any yt-dlp site serves need no source: the built-in *Link* reads them.) This document is the hub's public interface for sources; it stays stable across releases, and a change to it is called out in the changelog.

```json
{ "sources": [
  { "id": "fanqie", "label": "Fanqie",
    "kinds": [{ "id": "drama", "label": "Short dramas", "media": "video" },
              { "id": "audio", "label": "Audiobooks", "media": "audio" },
              { "id": "novel", "label": "Novels", "media": "book" }],
    "command": ["fanqie"] },
  { "id": "bookfetch", "label": "Books",
    "kinds": [{ "id": "ebook", "label": "Ebooks", "media": "book" }],
    "filters": ["language", "format", "year"],
    "command": ["bookfetch", "source"] }
] }
```

Each kind says what its works are (`media`): `video` or `audio` works have episodes and are watched or listened to together in a room; `book` works are one file, downloaded in a format onto the person's shelf. `media` defaults to `video`.

`command` is the program and its fixed arguments (a proxy flag, a cookies file); the hub appends the verb and its arguments. `env` adds environment variables. The command runs with `<stateDir>/<id>` as its working folder, so anything it writes there lands outside DSH's own folder. The network policy belongs to the command: a launcher that sends everything through a proxy keeps doing so, and the hub never contacts the site itself. A source whose program is not installed is hidden.

Every verb gets `--json` and ends its options with `--` where a free value follows (a query or id may start with a dash). Output is UTF-8. Exit code 0 means it worked; anything else is a failure and the last line of stderr is shown to the user. stderr is free text for people (progress, warnings) and is never parsed. A verb that finds nothing is not a failure: `search` answers an empty list.

## search

```
<command> search --kind <kind> --limit <n> [--offset <n>] --json -- <query>
```

`kind` is one of the source's configured kinds. A source whose config lists `filters` also gets, when the person set them, `--language <code>` (a language code such as `en` or `zh`), `--format <ext>` (`epub`, `pdf`...), `--year-from <n>` and `--year-to <n>`, before the `--`. They are hints: the hub filters the answer by language, format, year and size itself as well, and a result that leaves a field out passes that filter. Prints one JSON object:

```json
{ "results": [
  { "id": "7595108838659853336", "title": "…", "author": "…", "kind": "drama", "score": 8.1, "blurb": "…" }
] }
```

A source that can give more results says so with a whole number `next` in the answer: where the following page starts. The hub then offers *Load more* and asks again with `--offset <next>` (the flag is only sent for a later page, never for the first). A source without `next` has no more pages and never sees `--offset`; a page that adds nothing new ends the list.

`id` and `kind` are required (an id is any string without spaces, up to 200 characters; it is passed back unchanged); `title`, `author`, `blurb` are strings and `score` a number, all optional. Results of another kind than the one asked for are dropped.

### Optional descriptive fields

A result (and the `info` document, and each entry of its `related`) may also carry these, so that people can choose between works. Leave out what the site does not know; an empty or wrong-typed field is ignored. Names are written for the panel to format in the viewer's language, so a source sends raw numbers and codes, never "123万人在看".

| field | type | meaning |
|---|---|---|
| `cover` | string | `http(s)` URL of a cover picture. See [Covers](#covers); the browser never fetches it. |
| `url` | string | `http(s)` URL of the work's own page on the site. |
| `duration` | number | running time in seconds: of the video, or of all episodes together. |
| `popularity` | `{ "count": n, "label": "plays", "text": "…" }` | how many people watched, read or follow it. `label` says what is counted: `plays`, `readers`, `listeners`, `viewers`, `followers`, `heat`, or another word the source uses (shown as is). `text` is the source's own wording, used only for a label the panel does not know. |
| `episode_count` | integer | episodes (chapters for a book) in the work. |
| `status` | `finished`, `ongoing` or `stopped` | whether more is coming. |
| `tags` | strings | genres and themes. |
| `latest` | string | title of the latest episode. |
| `meta` | `[{ "key": "cast", "label": "Cast", "value": "…" }]` | anything else worth choosing by (heat, followers, cast, duration, last update, studio). `label` is the English name shown when the panel has no translation for `key`; `value` is a string. |

```json
{ "id": "7595108838659853336", "title": "…", "kind": "drama", "score": 8.1, "blurb": "…",
  "cover": "https://cdn.example/c.heic", "popularity": { "count": 36670, "label": "plays" },
  "episode_count": 60, "status": "finished", "tags": ["奇幻爱情", "都市"],
  "meta": [{ "key": "heat", "label": "Heat", "value": "3374万" }, { "key": "cast", "label": "Cast", "value": "…" }] }
```

### Fields for books

A work of a book kind may also carry:

| field | type | meaning |
|---|---|---|
| `formats` | `[{ "format": "epub", "bytes": 482113 }]` | the file formats it can be downloaded in, `bytes` when known. Formats are lowercase file extensions. |
| `bytes` | integer | size of the file when there is only one |
| `year` | integer | year of publication |
| `language` | string | language code (`en`, `zh`, `pt-BR`) |
| `publisher` | string | |
| `origin` | string | where the file comes from, when a source gathers several catalogues (`Project Gutenberg`) |

```json
{ "id": "gutenberg:1342", "title": "Pride and Prejudice", "author": "Jane Austen", "kind": "ebook",
  "year": 1813, "language": "en", "origin": "Project Gutenberg",
  "formats": [{ "format": "epub", "bytes": 482113 }, { "format": "txt", "bytes": 772419 }] }
```

## info

```
<command> info --json -- <id>
```

Prints one object describing the work and listing every episode in order:

```json
{ "id": "…", "title": "…", "kind": "drama", "author": "…", "status": "finished", "score": 8.1, "blurb": "…",
  "episodes": [ { "number": 1, "title": "第1集" }, { "number": 2, "title": "第2集" } ] }
```

A video or audio work with no episodes cannot be fetched; a book needs no `episodes` and may list `formats`. Episode `number` is the position in the list, starting at 1, and is the number `download` takes and files carry. Extra fields (an episode id, `locked`) are allowed and ignored.

`info` takes the optional descriptive fields above and may add `related`, the other works a person looking at this one would want: other seasons, a sequel, another adaptation of the same story. Each entry has the fields of a search result plus a `relation` (`season`, `same-title`, or `related`; the panel shows the word and groups by it), at most 30. Whether a site links its works is the source's business; one that does not may find seasons by name. A failing lookup should leave `related` empty rather than fail `info`, which the panel needs to start a download.

```json
{ "id": "…", "title": "…第一季", "kind": "drama", "episodes": [ … ],
  "related": [ { "id": "…", "title": "…第二季", "kind": "drama", "relation": "season", "episode_count": 200, "cover": "…" } ] }
```

## cover

```
<command> cover --output <file> -- <url>
```

Optional. Writes the picture at a `cover` URL to `file` as an image a browser shows (JPEG, PNG, GIF or WebP; convert anything else) and exits 0. The hub gives a `cover` URL only back to the command that produced it.

### Covers

A cover URL often points at a CDN the owner does not want browsers contacting. So The hub never sends the URL to the browser and never fetches it itself: it calls this verb, which keeps the command's network policy (a launcher that routes through a proxy keeps doing so, and fails closed when the proxy is down). A source without the verb, or a failing one, just has no pictures. Results carry a route under `/media-hub/covers/<key>` instead, served to admitted owners from `<stateDir>/covers`, each file at most 2 MB and the folder at most `coverCacheMb` (least recently shown go first). The file must be a picture by its first bytes, else it is dropped.

## download

```
<command> download --id=<id> --episodes <range> --output <dir> --json     (video and audio)
<command> download --id=<id> --format <ext> --output <dir> --json         (books)
```

A book is one file: the command writes it into `dir` in the format asked for (under a temporary name first), prints a `done` event with its `name`, `bytes` and `sha256`, then the `result`. The hub checks the file as below and keeps it on the person's shelf. A format the source does not have may be made by the hub's converter (Calibre's `ebook-convert`, when installed) from the best format the work lists, so a source only offers what it really has.

For episodes:

`range` is `5`, `3-7` or `20-` (to the end); numbers are the episodes' `number`. The command writes one media file per episode into `dir` (created if missing), named so the name **starts with the episode number**, zero padded to sort (`07 第7集.mp4`). A file is written under a temporary name (a leading dot) and renamed when complete, so a file with its final name is always whole. Files that already exist are skipped, and running the same command again resumes: it fetches what is missing. The hub starts a download for a range, cuts it (SIGTERM to the command's process group) when someone jumps elsewhere or deletes the show, and starts again.

stdout is one JSON object per line, each with an `event`:

| event | fields | meaning |
|---|---|---|
| `work` | `id`, `title`, `kind`, `selected`, `total` | first line (optional) |
| `skipped` | `number`, `name` | the file is already there |
| `start` | `number`, `name`, `index`, `of`, `label` | an episode begins downloading |
| `partial` | `number`, `files` | optional: the episode's files in `dir` while they are being written (one file, or a video and an audio file), readable from their start as they grow |
| `done` | `number`, `name`, `bytes`, `sha256` | the file is complete |
| `failed` | `number`, `name`, `reason` | this episode could not be fetched; the run goes on |
| `result` | `folder`, `files` (each `number`, `name`, `bytes`, `sha256`), `written`, `skipped`, `bytes`, `failed` | the last line |

Lines that are not JSON objects and events it does not know are ignored. What the hub uses: `start` (which episode the run is on), `partial` (play the episode while it downloads: the hub follows those files until the episode's `done` or `failed`, or the end of the run), `done` (look at the folder again, after checking the file), `failed`, and `result` (a run that exits 0 without one is an error).

A `done` file is checked against the `bytes` and `sha256` it reports; one that does not match is deleted and counted as failed, so the next run fetches it again. Exit non-zero when any episode failed (after printing `result`), so a failure is never silent; The hub then shows the failed episodes and stops until someone retries.

Two implementations: `fanqie` (fanqie-cli) takes `--json` on `search`, `info` and `download`, `--id` as another name for its `--book-id`, and has a `cover` verb; its popularity is `plays` for dramas, `readers` for novels, `listeners` for audiobooks, its `related` lists the works the app links plus same-title seasons, and a novel downloads as txt or epub. `bookfetch source` (bookfetch-cli) speaks the protocol for ebooks and papers from the catalogues bookfetch knows.
