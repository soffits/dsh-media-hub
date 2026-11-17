/**
 * Who is asking. A sign-in plugin may provide the generic `requestIdentity`
 * service (`current()` → `{ provider, issuer, id, name? } | null`, set for
 * the length of one DSH `/api` request); with it every person has their own
 * shelf, keyed by a hash of who vouches for them and their stable id. Without
 * one, DSH has a single owner and everyone it lets in shares the owner's
 * shelf.
 */
import { createHash } from 'node:crypto'

export const OWNER = 'owner'

/**
 * @param {{ current?: () => ({ issuer?: string, id?: string, name?: string } | null) } | undefined} identityService
 * @returns {{ key: string, name: string, verified: boolean }}
 */
export function personOf(identityService) {
  const identity = typeof identityService?.current === 'function' ? identityService.current() : null
  if (identity === null || typeof identity?.id !== 'string' || identity.id === '') return { key: OWNER, name: '', verified: false }
  const key = createHash('sha256').update(`${identity.issuer ?? ''}\n${identity.id}`).digest('hex').slice(0, 20)
  return { key, name: typeof identity.name === 'string' ? identity.name.slice(0, 80) : '', verified: true }
}
