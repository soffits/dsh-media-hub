# Roadmap

Decided, in this order. Each is its own pull request.

1. **Extensions with roles.** The `sources` setting becomes `extensions`, each with a `role`: `source`, `requester`, `tracker`, `recommender` ([extensions.md](extensions.md)), every role with its own protocol document. The command protocol stays the primary interface; the same roles from other DSH plugins through a Cordis service may follow.
2. **Per person from the first line.** Everything that belongs to one person is keyed by the person `requestIdentity` names and checked on the server: the library's shows (each person sees the shows they saved or watched; rooms stay shared and say who did what), follows, the watched and read log with ratings, requests, quality choice, tracker accounts. One owner without an identity provider.
3. **Plex as a source**: search a Plex library (token from a file the source command reads, per person where people have their own accounts), and a watch-together room from a Plex item through a `stream` verb.
4. **Requests**: a requester extension for the *arr suite (Overseerr/Jellyseerr-compatible API, Sonarr/Radarr, or a Plex watchlist a requester already follows). When Discover finds nothing it offers *Request*; status comes back, and "ready to watch" goes out through `notifyCommand`.
5. **Stream quality per person**: Original and lower bitrates, default Auto by measured bandwidth; Plex's transcoder for Plex items, ffmpeg otherwise.
6. **Recommendations, follows and one log**: a recommender extension over local taste data, following serial novels and shows with news through `notifyCommand`, one watched and read log with ratings kept in step with outside services by tracker extensions.
