/**
 * What open pages are told: something they show has changed, and what kind
 * (`library`: shows, watch state, a refreshed copy, downloads; `rooms`;
 * `shelf`: books). The notice carries no data; the page re-reads what it
 * shows. Notices are gathered for a moment and sent at most once per
 * `intervalMs`, so a download's progress or a playing room's position
 * doesn't flood a page.
 *
 * @param {{ intervalMs?: number }} [options]
 */
export function createChanges({ intervalMs = 300 } = {}) {
  const listeners = new Set()
  let pending = new Set()
  let timer = null
  let lastAt = 0

  function flush() {
    timer = null
    lastAt = Date.now()
    const what = [...pending]
    pending = new Set()
    for (const listener of listeners) listener(what)
  }

  return {
    notify(kind) {
      pending.add(kind)
      if (timer !== null) return
      timer = setTimeout(flush, Math.max(0, lastAt + intervalMs - Date.now()))
      timer.unref?.()
    },
    /** @returns {() => void} stop listening */
    listen(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    close() {
      clearTimeout(timer)
      timer = null
      listeners.clear()
    },
  }
}
