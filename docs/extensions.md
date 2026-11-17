# Extensions

Everything the hub knows about the outside world comes from extensions (command line tools that speak a small JSON protocol, run through whatever launcher the owner configures) and from *Link*, which reads video and playlist pages with yt-dlp. A launcher keeps its own network rules (a proxy it requires, an account file it reads); what the hub fetches itself (Link's yt-dlp calls and thumbnails) takes the route the `proxies` setting gives its host. Each extension can be tested on its own and can live in any repository.

Roles:

| role | what it does | protocol |
|---|---|---|
| source | search a catalogue, describe a work, fetch its cover, download its episodes or one file in a format | [source-protocol.md](source-protocol.md) (stable) |
| requester | ask a download manager for a title that no source has, and report how the request is going | planned |
| tracker | keep a watched and read log with ratings in step with an outside service | planned |
| recommender | suggest works, each with the reason | planned |

Today the `sources` setting lists sources. The other roles get their own protocol documents here when they are built; each follows the same rules as sources: verbs with `--json`, one JSON document (or one event per line for long jobs) on stdout, free text on stderr, exit code 0 for success.
