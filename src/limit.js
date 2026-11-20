/** Run at most `concurrency` jobs at once; the rest wait their turn in order. Each call answers its job's result. */
export function createLimiter(concurrency) {
  const waiting = []
  let running = 0
  const pump = () => {
    while (running < concurrency && waiting.length > 0) {
      running += 1
      waiting.shift()().finally(() => { running -= 1; pump() })
    }
  }
  return job => new Promise((resolve, reject) => { waiting.push(() => job().then(resolve, reject)); pump() })
}
