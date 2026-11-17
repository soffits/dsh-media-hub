#!/usr/bin/env node
/**
 * A points extension for tests (docs/points-protocol.md): `points-extension.mjs <state.json> <verb...> --json`.
 * The state file holds `players` (person -> balance), the `shop`, `tickets` and every call in `calls`.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [file, ...argv] = process.argv.slice(2)
const state = JSON.parse(readFileSync(file, 'utf8'))
const args = argv.filter(arg => arg !== '--json')
const option = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
state.calls.push(args)
const save = () => writeFileSync(file, JSON.stringify(state))
const answer = (value) => { save(); process.stdout.write(`${JSON.stringify(value)}\n`) }

const [verb, person] = args
if (state.fail) { save(); process.stderr.write('ledger is broken\n'); process.exit(2) }
if (!(person in state.players)) answer({ recorded: false, reason: 'points game off' })
else if (verb === 'shop') {
  const key = args[3]
  state.shop[key] ??= { name: option('--name'), cost: Number(option('--cost')), uses: option('--uses') }
  answer({ changed: true, item: { key, ...state.shop[key] } })
} else {
  const key = args[2]
  const mine = state.tickets.filter(t => t.person === person)
  const quote = () => ({ item: key, name: state.shop[key].name, cost: state.shop[key].cost, balance: state.players[person],
    gap: Math.max(0, state.shop[key].cost - state.players[person]), affordable: state.shop[key].cost <= state.players[person] })
  if (verb === 'check') {
    const held = mine.find(t => t.item === key && !t.used)
    answer({ item: key, valid: Boolean(held), ticket: held ? { id: held.id } : null, pending: false, quote: quote() })
  } else if (verb === 'buy') {
    state.players[person] -= state.shop[key].cost
    const ticket = { id: `t${state.tickets.length + 1}`, person, item: key, source: option('--source'), used: false }
    state.tickets.push(ticket)
    answer({ bought: true, ticket })
  } else if (verb === 'use') {
    const ticket = mine.find(t => t.id === key)
    if (state.shop[ticket.item].uses !== '0') ticket.used = option('--source')
    answer({ used: true, ticket })
  }
}
