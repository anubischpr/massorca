import { z } from 'zod'
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
