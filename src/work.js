/**
 * What the library keeps of a work from a source (the copy saved with a show):
 * the offline fallback for when the source can't answer (src/live-work.js),
 * with its related works one level deep and its episode titles. Pure.
 */

const RELATED_FIELDS = ['id', 'title', 'kind', 'relation', 'author', 'score', 'cover', 'popularity', 'episodes', 'status', 'tags']

/** The part of an `info` document worth keeping, with the time it was taken. */
export function snapshotOf(info, at) {
  const related = (info.related ?? []).map(work => Object.fromEntries(RELATED_FIELDS.map(field => [field, work[field] ?? null])))
  return {
    title: info.title,
    kind: info.kind,
    author: info.author,
    score: info.score ?? null,
    blurb: info.blurb ?? '',
    cover: info.cover ?? null,
    popularity: info.popularity ?? null,
    episodes: info.episodes ?? null,
    status: info.status ?? '',
    tags: info.tags ?? [],
    latest: info.latest ?? '',
    meta: info.meta ?? [],
    related: related.map(work => ({ ...work, tags: work.tags ?? [] })),
    episodeTitles: info.episodeTitles ?? [],
    at,
  }
}

/** The title the source gives episode `n` (1-based), or null. */
export const episodeTitle = (work, n) => work?.episodeTitles?.[n - 1] || null
