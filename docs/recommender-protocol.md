# Recommender protocol

A recommender is a command line tool that suggests works, each with the reason it was picked. The hub has no taste of its own: it runs the command set in `recommender.command`, shows what it answers under *Picks* on the Watching tab (when `presence.picks` is on), and lets people watch a pick together or follow it. Same rules as sources ([extensions.md](extensions.md)): one JSON document on stdout, free text on stderr, exit code 0 for success.

## recommend

```
<command> recommend --json --limit <n> [--person <id>] [--source <id>] [--kind <kind>] [--language <tag>]
```

`--person` is the stable id the sign-in gives the person asking (an OpenID subject, say), when there is one; a recommender that keeps taste per person uses it, one that doesn't ignores it. `--source` and `--kind` narrow the picks to one source's works of one kind (what the Discover tab shows under that source and category; without them, picks of any source, as on the Watching tab). `--language` is the reader's language tag, for `why`. The hub keeps each answer as a dated copy per person, source, kind and language, and asks again in the background about once a day when someone looks and the copy is old, never while the page waits.

```json
{
  "picks": [
    {
      "work": { "source": "<source id>", "id": "<work id>", "title": "…", "kind": "drama", "year": 2026, "score": 8.5, "scoreLabel": "…", "cover": "https://…", "url": "https://…" },
      "why": "One sentence: why this work, for this person."
    }
  ]
}
```

- `work.source` is the id of a source configured in the hub, and `work.id` that source's id for the work, as its `search` returns it. Picks of a source the hub doesn't have are left out, since nobody could watch them.
- `title` and `why` are required; `kind`, `year`, `score` (a number), `scoreLabel` (the name of the score, shown before it), `cover` and `url` are optional, and so is any other descriptive field of a search result ([source-protocol.md](source-protocol.md): `episode_count`, `popularity`, `tags`, `formats`...), which saves the page asking the source about each pick. The cover is fetched by the hub through the source's own `cover` verb and its proxy rule, never by the browser.
- The hub shows at most `--limit` picks, in the order given, each work once.
- Write `why` in the `--language` given; the hub shows it as it is. A reason names the evidence ("You finished X", "On your to-read list"), not just the mood.

A failure (exit code not 0, or a document without `picks`) is logged and shows no picks until the next ask.
