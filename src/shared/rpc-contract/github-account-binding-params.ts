import { z } from 'zod'
import type { GhAccountBindingInventory } from '../github/auth-types'
import { RepoSelector } from './github-repo-target-params'
import { requiredString } from './rpc-param-primitives'

export const BindableAccounts = RepoSelector.extend({
  refreshCapability: z.boolean().optional()
})

export const ValidateAccountBinding = RepoSelector.extend({
  host: requiredString('Missing host'),
  user: requiredString('Missing user')
})

export const ApplyAccountGitConfig = RepoSelector.extend({
  next: z.object({ host: z.string(), user: z.string() }).nullable(),
  previous: z.object({ host: z.string(), user: z.string() }).nullable(),
  setIdentity: z.boolean().optional()
})

// Why: a bare RepoSelector alias would attribute every selector-only method to this export.
export const ReadAccountGitConfig = RepoSelector.extend({})

export const ListHostBindableAccounts = z.object({
  refreshCapability: z.boolean().optional()
})

export const ListAccountOrgs = z.object({
  accounts: z
    .array(z.object({ host: requiredString('Missing host'), user: requiredString('Missing user') }))
    .max(20)
})

export const InferRepoAccount = RepoSelector.extend({})

/** One gh login on one host, named by its host and user; the token never crosses this boundary. */
export const HostGitHubAccount = z.object({
  host: requiredString('Missing host'),
  user: requiredString('Missing user')
})

const GitHubAccountAnswer = z.object({
  host: z.string(),
  user: z.string(),
  active: z.boolean(),
  envToken: z.enum(['GITHUB_TOKEN', 'GH_TOKEN']).nullable(),
  source: z.enum(['env', 'keyring']),
  scopes: z.array(z.string())
})

const GitHubInventoryAnswer = z.object({
  capability: z.enum(['supported', 'unsupported', 'unknown']),
  accounts: z.array(GitHubAccountAnswer).max(100)
})

const GitHubChangeAnswer = z.union([
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), reason: z.enum(['invalid_account', 'unsupported', 'failed']) })
])

/** A host's inventory, or why it gave none; a host that predates the methods needs an update. */
export type GitHubAccountsHostList =
  | { ok: true; inventory: GhAccountBindingInventory }
  | { ok: false; reason: 'host-needs-update' | 'unreachable' | 'failed' }

/** A host's switch or remove result; gh's own output never crosses this boundary. */
export type GitHubAccountsHostChange =
  | { ok: true }
  | {
      ok: false
      reason: 'invalid_account' | 'unsupported' | 'failed' | 'host-needs-update' | 'unreachable'
    }

/** Rebuilds an inventory from its known fields; anything else on the answer is dropped. */
export function readGitHubAccountInventoryAnswer(
  answer: unknown
): GhAccountBindingInventory | null {
  const parsed = GitHubInventoryAnswer.safeParse(answer)
  return parsed.success ? parsed.data : null
}

/** Rebuilds a switch or remove answer; an unreadable answer counts as a failed call. */
export function readGitHubAccountChangeAnswer(answer: unknown): GitHubAccountsHostChange {
  const parsed = GitHubChangeAnswer.safeParse(answer)
  return parsed.success ? parsed.data : { ok: false, reason: 'failed' }
}
