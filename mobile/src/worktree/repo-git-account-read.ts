import { z } from 'zod'
import { createReadLimiter } from '../session/mobile-artifact-read-limiter'
import { rpcClientKey } from '../session/mobile-rpc-client-key'
import { isMobileMethodUnavailableError } from '../transport/mobile-method-unavailable'
import type { RpcClient } from '../transport/rpc-client'
import type { RpcResponse } from '../transport/types'

/**
 * A repo's GitHub login as its own git config pins it (`gh.account`), read on the host that owns the
 * repo. Desktop reads this first and falls back to the repo's bound account; so does the phone.
 *
 * - `bound`: the repo's `gh.account`, exactly as the host sent it.
 * - `unbound`: the host read the repo and it pins no login; the caller falls back.
 * - `unavailable`: the host predates the method (or does not allow it to phones): asked no more.
 * - `unreachable`: no answer this time; not remembered, so a later read asks again.
 */
export type RepoGitAccount =
  | { kind: 'bound'; login: string }
  | { kind: 'unbound' }
  | { kind: 'unavailable' }
  | { kind: 'unreachable' }

const READ_TIMEOUT_MS = 15_000
/** How long a host's answer for one repo is kept before the host is asked again. */
export const REPO_GIT_ACCOUNT_TTL_MS = 5 * 60_000

/** `null` when the repo has no `gh.account` config entry set; otherwise the login it names. */
const gitAccountReplySchema = z.union([z.null(), z.looseObject({ account: z.string().nullable() })])

type CachedAccount = { login: string | null; readAt: number }

/** Hosts that answered "no such method" (or refused it to phones), by client. Never asked again. */
const unavailableClients = new WeakSet<object>()
const cache = new Map<string, CachedAccount>()
const inFlight = new Map<string, Promise<RepoGitAccount>>()
/** Background reads for the list's groups run two at a time, so a long host list never floods a host. */
const overlayLimiter = createReadLimiter(2)

function cacheKey(client: RpcClient, repoId: string): string {
  return `${rpcClientKey(client)}|${repoId}`
}

function verdictOf(entry: CachedAccount): RepoGitAccount {
  return entry.login === null ? { kind: 'unbound' } : { kind: 'bound', login: entry.login }
}

/** The repo's `gh.account` on its host. Never throws, never blocks a caller past the request itself. */
export function readRepoGitAccount(
  client: RpcClient,
  repoId: string,
  now: () => number = Date.now
): Promise<RepoGitAccount> {
  if (unavailableClients.has(client)) {
    return Promise.resolve({ kind: 'unavailable' })
  }
  const key = cacheKey(client, repoId)
  const hit = cache.get(key)
  if (hit && now() - hit.readAt < REPO_GIT_ACCOUNT_TTL_MS) {
    return Promise.resolve(verdictOf(hit))
  }
  const pending = inFlight.get(key)
  if (pending) {
    return pending
  }
  const read = requestRepoGitAccount(client, repoId, key, now).finally(() => {
    inFlight.delete(key)
  })
  inFlight.set(key, read)
  return read
}

async function requestRepoGitAccount(
  client: RpcClient,
  repoId: string,
  key: string,
  now: () => number
): Promise<RepoGitAccount> {
  let response: RpcResponse
  try {
    response = await client.sendRequest(
      'github.readAccountGitConfig',
      { repo: `id:${repoId}` },
      { timeoutMs: READ_TIMEOUT_MS, budgetSpansConnect: true }
    )
  } catch {
    return { kind: 'unreachable' }
  }
  if (!response.ok) {
    if (isMobileMethodUnavailableError(response.error.code, response.error.message)) {
      unavailableClients.add(client)
      return { kind: 'unavailable' }
    }
    return { kind: 'unreachable' }
  }
  const parsed = gitAccountReplySchema.safeParse(response.result)
  if (!parsed.success) {
    return { kind: 'unreachable' }
  }
  const login = parsed.data?.account ? parsed.data.account : null
  cache.set(key, { login, readAt: now() })
  return login === null ? { kind: 'unbound' } : { kind: 'bound', login }
}

/**
 * Reads each repo's git login in the background, two at a time, and reports the bound ones as they
 * arrive. Nothing is reported for an unbound, unavailable or unreachable repo: the caller keeps its
 * fallback for those.
 */
export function watchRepoGitAccounts(
  client: RpcClient,
  repoIds: readonly string[],
  onBound: (repoId: string, login: string) => void
): void {
  for (const repoId of repoIds) {
    void overlayLimiter(() => readRepoGitAccount(client, repoId)).then((verdict) => {
      if (verdict.kind === 'bound') {
        onBound(repoId, verdict.login)
      }
    })
  }
}

/** Test seam: forget every host's answer and every unavailable mark. */
export function resetRepoGitAccountReadForTest(): void {
  cache.clear()
  inFlight.clear()
  // A WeakSet cannot be cleared; tests create a fresh client object instead.
}
