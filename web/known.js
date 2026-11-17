/**
 * Where a work from a source stands here: in the library (its show), in an
 * open room. Looked up by source id and work id, so every place a work
 * appears can say so instead of offering to save it again.
 */
import { Known, React } from './ui.js'

/** @returns {{ show: object | null, room: object | null }} */
export function lookupWork(library, rooms, sourceId, workId) {
  const show = library?.shows?.find(entry => entry.source?.source === sourceId && entry.source?.id === workId) ?? null
  const room = show === null ? null : (rooms ?? []).find(entry => entry.show === show.path) ?? null
  return { show, room }
}

/** The known state of one work (from the page's polled library and rooms). */
export function useKnownWork(sourceId, workId) {
  const { library, rooms } = React.useContext(Known)
  return lookupWork(library, rooms, sourceId, workId)
}
