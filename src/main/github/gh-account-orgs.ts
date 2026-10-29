/**
 * Org logins per bound gh account, for add-project account inference.
 */
import { normalizeGhAccountBinding } from '../../shared/github/account-binding'
import { ghAccountKey } from '../../shared/github/gh-account-inference'
import { ghExecFileAsync } from '../git/runner'
import type { LocalProjectWorktreeGitOptions } from '../project-runtime-git-options'

const ORG_LOOKUP_TIMEOUT_MS = 10_000
const ORG_CACHE_TTL_MS = 10 * 60 * 1000

type CacheEntry = { orgs: string[]; expiresAt: number }
const orgCache = new Map<string, CacheEntry>()

async function lookupOrgs(
  binding: { host: string; user: string },
  localGitOptions: LocalProjectWorktreeGitOptions
): Promise<string[]> {
  const { stdout } = await ghExecFileAsync(
    ['api', 'user/orgs', '--paginate', '--jq', '.[].login'],
    {
      host: binding.host,
      ghAccount: binding,
      timeout: ORG_LOOKUP_TIMEOUT_MS,
      ...(localGitOptions.wslDistro ? { wslDistro: localGitOptions.wslDistro } : {})
    }
  )
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/** Keyed by `ghAccountKey`; an account whose lookup fails maps to `[]` (never a guess). */
export async function listGhAccountOrgs(
  accountsInput: readonly unknown[],
  localGitOptions: LocalProjectWorktreeGitOptions = {},
  now: () => number = Date.now
): Promise<Record<string, string[]>> {
  const accounts = accountsInput
    .map((account) => normalizeGhAccountBinding(account))
    .filter((account): account is NonNullable<typeof account> => account !== null)
  const entries = await Promise.all(
    accounts.map(async (account) => {
      const key = ghAccountKey(account)
      const cacheKey = `${localGitOptions.wslDistro ?? ''}\0${key}`
      const cached = orgCache.get(cacheKey)
      if (cached && cached.expiresAt > now()) {
        return [key, cached.orgs] as const
      }
      try {
        const orgs = await lookupOrgs(account, localGitOptions)
        orgCache.set(cacheKey, { orgs, expiresAt: now() + ORG_CACHE_TTL_MS })
        return [key, orgs] as const
      } catch {
        return [key, []] as const
      }
    })
  )
  return Object.fromEntries(entries)
}

export function resetGhAccountOrgsCacheForTests(): void {
  orgCache.clear()
}
