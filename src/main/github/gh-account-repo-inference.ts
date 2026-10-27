/**
 * Suggests the GitHub account for a registered repo from its pin and origin remote.
 */
import type { Repo } from '../../shared/repo-types'
import { isFolderRepo } from '../../shared/repo-kind'
import {
  normalizeGhAccountBinding,
  type GhAccountBinding
} from '../../shared/github/account-binding'
import {
  ghAccountInferenceNeedsOrgLookup,
  inferGhAccount,
  parseGhRemoteUrl,
  type InferGhAccountInput,
  type RepoGhAccountInference
} from '../../shared/github/gh-account-inference'
import { listGhAccountBindingInventory } from './gh-account-binding-inventory'
import {
  createRepoGitConfigRunner,
  readGhAccountGitConfig,
  type GitConfigRunner
} from './gh-account-git-config'
import { listGhAccountOrgs } from './gh-account-orgs'
import type { LocalProjectWorktreeGitOptions } from '../project-runtime-git-options'

const NO_INFERENCE: RepoGhAccountInference = { inference: null, remoteOwner: null }

export type InferRepoGhAccountDeps = {
  runner?: GitConfigRunner | null
  listInventory?: typeof listGhAccountBindingInventory
  listOrgs?: typeof listGhAccountOrgs
}

/** Keyring accounts only: env-token accounts cannot be pinned for a repo. */
async function listKeyringBindings(
  localGitOptions: LocalProjectWorktreeGitOptions,
  listInventory: typeof listGhAccountBindingInventory
): Promise<GhAccountBinding[]> {
  const inventory = await listInventory(localGitOptions, {}).catch(() => null)
  return (inventory?.accounts ?? [])
    .filter((account) => account.source === 'keyring')
    .map((account) => normalizeGhAccountBinding(account))
    .filter((account): account is GhAccountBinding => account !== null)
}

/** Read-only: never writes the pin. Folder workspaces and unreachable hosts yield no suggestion. */
export async function inferRepoGhAccount(
  repo: Pick<Repo, 'path' | 'connectionId' | 'kind'>,
  localGitOptions: LocalProjectWorktreeGitOptions = {},
  deps: InferRepoGhAccountDeps = {}
): Promise<RepoGhAccountInference> {
  if (isFolderRepo(repo)) {
    return NO_INFERENCE
  }
  const run =
    deps.runner === undefined ? createRepoGitConfigRunner(repo, localGitOptions) : deps.runner
  if (!run) {
    return NO_INFERENCE
  }
  const pin = await readGhAccountGitConfig(run).catch(() => null)
  // Why: `origin` is read through the same runner, so the SSH relay answers with its own remote.
  const remoteUrl = await run(['remote', 'get-url', 'origin'])
    .then((stdout) => stdout.trim() || null)
    .catch(() => null)
  const accounts = await listKeyringBindings(
    localGitOptions,
    deps.listInventory ?? listGhAccountBindingInventory
  )
  const input: InferGhAccountInput = {
    accounts,
    remoteUrl,
    existingGhAccount: pin?.account ?? null
  }
  const remote = remoteUrl ? parseGhRemoteUrl(remoteUrl) : null
  let inference = inferGhAccount(input)
  if (!inference && ghAccountInferenceNeedsOrgLookup(input)) {
    // Why: only accounts on the remote's host can be org members for it, so skip the others.
    const orgAccounts = accounts.filter((account) => account.host === remote?.host)
    const orgs = await (deps.listOrgs ?? listGhAccountOrgs)(orgAccounts, localGitOptions)
    inference = inferGhAccount({ ...input, orgsByAccount: new Map(Object.entries(orgs)) })
  }
  return { inference, remoteOwner: remote?.owner ?? null }
}
