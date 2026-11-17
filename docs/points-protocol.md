# Points protocol

Watching is free. A points extension lets the people it plays with pay for two extras with points they earn elsewhere (a to-do app, a study log): starting a series that is new to the hub, and a binge night, starting to watch late at night. The extension keeps the shop, the tickets and who plays; the hub registers its two items, asks at the moment of the action whether the person holds a ticket, buys one only after the person says yes on the page, and records each use. Same rules as sources ([extensions.md](extensions.md)): one JSON document on stdout, free text on stderr, exit code 0 for success.

`<person>` is the stable id the sign-in gives the person asking (an OpenID subject, say). A person the extension doesn't play with gets `{"recorded": false}` from every verb, and the hub then changes nothing for them. Nobody signed in, and the assistant's own tool, are never asked.

## shop register

```
<command> shop <person> register <item> --name <name> --cost <points> --about <text> [--uses 0] [--until HH:MM] --json
```

Adds the hub's item to the person's shop, or updates its name, description and terms. `--cost` is a default: once the person changed the price, or retired the item, that stays theirs. The hub registers both items once per person while it runs, before the first check.

| Item | Default | Terms |
|---|---|---|
| `media:new_series` | 30 | one use: one series |
| `media:binge_night` | 40 | `--uses 0` (any number of rooms) `--until <night.to>` |

## check

```
<command> check <person> <item> --json
```

```json
{ "valid": false, "ticket": null, "pending": false,
  "quote": { "name": "Start a new series", "cost": 30, "balance": 45, "gap": 0, "affordable": true } }
```

`valid` with `ticket.id` when the person holds a usable ticket; `pending` when one waits for someone's approval; `quote` the price and balance now (`affordable` false over a spending cap too).

## buy

```
<command> buy <person> <item> --source <source> --json
```

Spends the points on a ticket. `--source` makes it once per source: the same call again returns the ticket already bought. The hub's sources are `media:series:<source id>:<work id>` and `media:binge:<YYYY-MM-DD>` (the evening the night started), so a retry never buys twice.

## use

```
<command> use <person> <ticket id> --source <source> --json
```

Records that a ticket was used, once per source: `media:series:<source id>:<work id>` for a series, `media:start:<room id>` for each room a binge night opened.

## When the hub asks

- **A new series**: saving or watching a work from a source when it has more than one episode and neither it nor any of its seasons (`related` entries with relation `season`) was ever in the library or the watch log. Going on with a series, a later season, a rewatch, a film or a single video is never an extra.
- **A binge night**: opening a room, or watching a work at once, between `points.night.from` and `points.night.to` on the host's clock. A room already open is never stopped or interrupted, so a room someone else shares stays theirs.

Without a ticket the hub answers the page `402` with `error.code` `points` and `error.points` (`item`, `name`, `cost`, `balance`, `gap`, `affordable`, `pending`); the page shows the price and the balance, and on *Buy* asks again naming the item in `buy`. A failing extension never stops anyone watching: the action goes through and the log says why.
