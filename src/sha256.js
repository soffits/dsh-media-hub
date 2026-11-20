import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'

/** The SHA-256 of a file, read as a stream so a large book or episode is never held in memory. */
export function sha256Of(path) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(path).on('data', chunk => hash.update(chunk)).on('error', reject).on('end', () => resolve(hash.digest('hex')))
  })
}
