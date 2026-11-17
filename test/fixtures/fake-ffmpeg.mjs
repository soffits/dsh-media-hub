#!/usr/bin/env node
/** A stand-in ffmpeg for merging fetched parts in tests: the `-i` inputs, one after the other, into the last argument. */
import { readFileSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const inputs = args.flatMap((arg, n) => (arg === '-i' ? [args[n + 1]] : []))
writeFileSync(args.at(-1), Buffer.concat(inputs.map(input => readFileSync(input))))
