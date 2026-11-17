# Queue

- **`src/hub.js` and `src/shows.js` are past 500 lines**: views (public room, summary) and the episode listing could each move to their own module.
- **Cache refill is not driven by free disk**: a downloads run stops when the disk has under 1 GB free, but the window is not shrunk to fit.
- **Fanqie search paging and sorting**: the app's search request has an `offset` that, tried once, returned the same works; a working page parameter (or a sort one) would let fanqie-cli answer `next` and sort at the source.
- **Estimated size per kind**: `EPISODE_BYTES` (drama, audio) is keyed by kind names; a source with other kinds gets the drama estimate. A per-kind size in the config would fix it.
- **HEVC as it is where the browser can**: Safari and Chrome on macOS/Windows decode HEVC; serving the original as a first `<source>` would skip the transcode (and its cache copy) for them, with the H.264 copy for the rest.
- **Source-formatted words in `meta` values** ("126 min") are shown as the source wrote them; the protocol could carry numbers with a unit instead.
- **Plex**: copy a library item out through Plex's API into the local pipeline rather than streaming Plex's HLS with a token.
- **R2 delivery**: upload prepared episodes to an R2 bucket and hand out short-lived presigned URLs (SigV4 query signing); delete after the room closes. `src/delivery.js` has the slot.
- **Watch beside a conversation**: a right-sidebar tab with the same room view, kept mounted, so playback continues while chatting. The main-column page unmounts (and leaves the room) when another page is opened.
- **The assistant watching along**: let the assistant follow a room's state (what is playing, where) through the `mediaHub` service.
- **Hidden tabs**: browsers throttle timers in background tabs to about 1 s, so a viewer whose tab is hidden starts up to a second late and catches up by seek.
- **Fanqie plays only after its download**: fanqie-cli downloads an encrypted stream and decrypts at the end, so it sends no `partial` event; its episodes are a few MB and land in seconds, then play while they transcode. A decrypting reader that writes a growing file would let it stream too.
- **A source's name per language**: `label` is one string, so Discover's picker shows it as configured ("Fanqie" or "番茄"); an optional `labels: { zh: "番茄" }` in the `sources` entry would follow the page language.
- **Other people's pictures**: the avatar stack shows initials for everyone but the signed-in person (the sign-in plugin only tells a browser about itself); sending a picture URL with each viewer's name would need identity plumbing in the sync channel.
- **Room card frames at the current position**: the preview frame is one per episode (a tenth in), not a frame near where people are.
- **Flaky under load**: the browser test's "the switch needed no ready gate" check (preloaded next episode) failed once while the machine was busy converting a PDF, then passed on rerun.
- **Book covers beyond Project Gutenberg**: `bookfetch source cover` only knows Gutenberg's cover address; Anna's Archive and Open Library covers need their own allow-listed patterns (and the per-source proxy for Anna's).
- **Z-Library from the page**: its search runs in a browser over CDP, so `bookfetch source` leaves it out unless `--providers` names it; a page search driving someone's browser needs a design first.
- **Paging for book searches**: `bookfetch source` answers one page per source; *Load more* would need offsets per source.
- **Link size estimate**: *Download all* estimates a show by a per-kind average; a link knows its duration and the chosen height, which would give a far better number.
- **Playlists that reorder**: Link numbers a playlist's videos by position when it downloads; a playlist that changes order (a chart) shifts which video an episode number means between runs. The entry ids in the work's snapshot could pin them.
- **Download progress from command sources**: the source protocol has no progress event, so only Link reports how far a download is; a `progress` line in the protocol would bring it to every source.
- **The person behind the sync channel**: a room records who opened it by display name; the account a room fetches with comes from the request that opened it, so a room reopened by the assistant's tool (no signed-in person) uses the default account.

- **Live duration while downloading**: an episode played as it downloads is an event playlist, so the player's timeline grows with what has arrived; the length is known from the start (probe) and could be shown.
- **Browser suite after solo watching**: `npm run test:browsers` opens rooms with *Watch* and expects them in the Watching tab; rooms are now unlisted until *Watch together*, so its room-list steps need that click. Not rerun for 0.5.
- **A person's own solo rooms**: an unlisted room is reached only by its link; the Watching tab could list the asking person's own (rooms would need to record the person, not only a display name).
- **Episode titles in an open room are the saved copy**: a room's episode list is built when it opens or a show changes, and must not wait for a source, so it reads the offline copy of the work (refreshed by every live read of the library or About tab); the library's episode list shows the live titles.
