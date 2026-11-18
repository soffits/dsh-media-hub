/**
 * Running a source's program: in its own process group, so a cancel stops the
 * whole chain (a launcher, an interpreter, ffmpeg), with stdout collected or
 * read line by line and the tail of stderr kept for the error message.
 */
import { spawn } from 'node:child_process'
import { access, constants } from 'node:fs/promises'
import { delimiter, isAbsolute, join } from 'node:path'

const MAX_OUTPUT = 16 * 1024 * 1024

const sourceError = (code, message) => Object.assign(new Error(message), { code })

/** Whether `command` names an executable file, on the PATH or by path. */
export async function commandExists(command, path = process.env.PATH ?? '') {
  const candidates = isAbsolute(command) ? [command] : path.split(delimiter).filter(Boolean).map(dir => join(dir, command))
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK)
      return true
    } catch {
      // Not in this folder.
    }
  }
  return false
}

/** Run `argv` (with `input` on its stdin when given); resolves with the exit code, stdout (unless read by line), the tail of stderr and whether stdout overflowed. */
export function run(argv, { signal, timeoutMs, onStdoutLine, cwd, env, input } = {}) {
  return new Promise((resolve, reject) => {
    const [command, ...args] = argv
    const child = spawn(command, args, { stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'], detached: true, cwd, env: { ...process.env, ...env } })
    if (input !== undefined) {
      child.stdin.on('error', () => {})
      child.stdin.end(input)
    }
    let stdout = ''
    let stderr = ''
    let pending = ''
    let oversized = false
    const stop = () => { try { process.kill(-child.pid, 'SIGTERM') } catch { /* already gone */ } }
    const timer = timeoutMs ? setTimeout(stop, timeoutMs) : null
    signal?.addEventListener('abort', stop, { once: true })
    child.stdout.on('data', (chunk) => {
      if (onStdoutLine === undefined) {
        stdout += chunk
        if (stdout.length > MAX_OUTPUT) { oversized = true; stop() }
        return
      }
      pending += chunk
      const lines = pending.split('\n')
      pending = lines.pop()
      for (const line of lines) onStdoutLine(line)
    })
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-8000) })
    child.on('error', (error) => {
      if (timer) clearTimeout(timer)
      reject(error.code === 'ENOENT' ? sourceError('unavailable', `${command} is not installed`) : error)
    })
    child.on('close', (code) => {
      if (timer) clearTimeout(timer)
      signal?.removeEventListener('abort', stop)
      if (onStdoutLine !== undefined && pending.trim() !== '') onStdoutLine(pending)
      resolve({ code, stdout, stderr, oversized })
    })
  })
}

/** One stdout line as a JSON object, or null for anything else (a command may print other text). */
export function parseLine(line) {
  try {
    const event = JSON.parse(line)
    return event !== null && typeof event === 'object' ? event : null
  } catch {
    return null
  }
}

/** The last non-empty line of a text: a failing command's message. */
export const lastLine = text => text.trim().split('\n').filter(Boolean).pop() ?? ''
