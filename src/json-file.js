/**
 * The hub's JSON state files. A file that can't be read is moved aside, never
 * overwritten by the next save, so one bad byte costs a restore by hand, not
 * the data. Writes go to `<file>.part` first and are renamed in, one after another.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const isObject = value => typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Read a state file (an object). `value` is undefined when there is none, or when it could not be read or `valid` turned it down;
 * then `damaged` is true and the file now sits beside as `<file>.bad-<time>`.
 * @param {string} file
 * @param {{ logger: { warn: Function }, valid?: (value: unknown) => boolean, now?: () => number }} options
 * @returns {Promise<{ value: any, damaged: boolean }>}
 */
export async function readJson(file, { logger, valid = isObject, now = Date.now }) {
  let problem
  try {
    const value = JSON.parse(await readFile(file, 'utf8'))
    if (valid(value)) return { value, damaged: false }
    problem = 'not the expected shape'
  } catch (error) {
    if (error.code === 'ENOENT') return { value: undefined, damaged: false }
    problem = error.message
  }
  const aside = `${file}.bad-${now()}`
  await rename(file, aside).then(
    () => logger.warn('could not read %s (%s); moved it to %s and started empty', file, problem, aside),
    error => logger.warn('could not read %s (%s) nor move it aside: %s', file, problem, error.message))
  return { value: undefined, damaged: true }
}

const serialize = value => JSON.stringify(value, null, 1)

async function writeWhole(file, body) {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(`${file}.part`, body)
  await rename(`${file}.part`, file)
}

/** Write a value whole: beside the file, then renamed over it. */
export const writeJson = (file, value) => writeWhole(file, serialize(value))

/**
 * Saves of one file in the order they were asked for, each taking the value as it is at the call. A failed save is logged.
 * @param {string} file
 * @param {{ warn: Function }} logger
 */
export function createJsonSaver(file, logger) {
  let saving = Promise.resolve()
  return {
    save(value) {
      const body = serialize(value)
      saving = saving.then(() => writeWhole(file, body)).catch(error => logger.warn('could not save %s: %s', file, error.message))
      return saving
    },
    settled: () => saving,
  }
}
